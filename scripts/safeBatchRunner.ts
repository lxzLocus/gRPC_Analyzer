import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { runForAllDatasets } from '../src/modules/llmFlowBatchRunner.js';
import LLMFlowController from '../src/modules/llmFlowController.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module環境での __dirname の取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数の設定 - 正しいパスで .env ファイルを読み込み
config({ path: path.join(__dirname, '..', '..', '..', '.env') });

// エラー報告インターフェース
interface ErrorReport {
    timestamp: string;
    repositoryName: string;
    category: string;
    pullRequestTitle: string;
    pullRequestPath: string;
    premergeDir: string;
    errorType: string;
    errorMessage: string;
    stackTrace: string;
    processingPhase: string;
}

// 処理統計インターフェース
interface ProcessingStats {
    totalRepositories: number;
    totalCategories: number;
    totalPullRequests: number;
    successfulPullRequests: number;
    failedPullRequests: number;
    skippedPullRequests: number;
    startTime: Date;
    endTime?: Date;
    totalDuration?: number;
    errorsByType: Record<string, number>;
}

class SafeBatchRunner {
    private errorReportFile: string;
    private summaryReportFile: string;
    private stats: ProcessingStats;

    constructor(baseOutputDir: string = '/app/output') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.errorReportFile = path.join(baseOutputDir, `error_report_${timestamp}.json`);
        this.summaryReportFile = path.join(baseOutputDir, `processing_summary_${timestamp}.json`);
        
        // 環境変数デバッグ情報
        console.log(`🔍 SafeBatchRunner Environment Debug:`);
        console.log(`   LLM_PROVIDER: ${process.env.LLM_PROVIDER || 'undefined'}`);
        console.log(`   GEMINI_API_KEY length: ${(process.env.GEMINI_API_KEY || '').length}`);
        console.log(`   OPENAI_TOKEN length: ${(process.env.OPENAI_TOKEN || '').length}`);
        console.log(`   OPENAI_API_KEY length: ${(process.env.OPENAI_API_KEY || '').length}`);
        
        this.stats = {
            totalRepositories: 0,
            totalCategories: 0,
            totalPullRequests: 0,
            successfulPullRequests: 0,
            failedPullRequests: 0,
            skippedPullRequests: 0,
            startTime: new Date(),
            errorsByType: {}
        };

        // 出力ディレクトリの作成
        if (!fs.existsSync(baseOutputDir)) {
            fs.mkdirSync(baseOutputDir, { recursive: true });
        }

        console.log(`📋 Error report will be saved to: ${this.errorReportFile}`);
        console.log(`📋 Summary report will be saved to: ${this.summaryReportFile}`);
    }

    /**
     * エラーレポートを追記
     */
    private appendErrorReport(errorReport: ErrorReport): void {
        try {
            let existingErrors: ErrorReport[] = [];
            
            // 既存のエラーレポートを読み込み
            if (fs.existsSync(this.errorReportFile)) {
                const content = fs.readFileSync(this.errorReportFile, 'utf-8');
                existingErrors = JSON.parse(content);
            }

            // 新しいエラーを追加
            existingErrors.push(errorReport);

            // ファイルに書き込み
            fs.writeFileSync(this.errorReportFile, JSON.stringify(existingErrors, null, 2));
            
            console.log(`❌ Error recorded: ${errorReport.pullRequestTitle} (${errorReport.errorType})`);
            console.log(`   Error message: ${errorReport.errorMessage}`);
            console.log(`   Total errors so far: ${existingErrors.length}`);
            
        } catch (writeError) {
            console.error(`❌ Failed to write error report:`, writeError);
        }
    }

    /**
     * 処理統計を更新
     */
    private updateStats(type: 'success' | 'failure' | 'skip', errorType?: string): void {
        switch (type) {
            case 'success':
                this.stats.successfulPullRequests++;
                break;
            case 'failure':
                this.stats.failedPullRequests++;
                if (errorType) {
                    this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
                }
                break;
            case 'skip':
                this.stats.skippedPullRequests++;
                break;
        }
    }

    /**
     * 統計サマリーを保存
     */
    private saveSummaryReport(): void {
        try {
            this.stats.endTime = new Date();
            this.stats.totalDuration = this.stats.endTime.getTime() - this.stats.startTime.getTime();

            const summary = {
                ...this.stats,
                totalDurationFormatted: this.formatDuration(this.stats.totalDuration),
                successRate: this.stats.totalPullRequests > 0 
                    ? Math.round((this.stats.successfulPullRequests / this.stats.totalPullRequests) * 100) 
                    : 0,
                errorReportPath: this.errorReportFile,
                topErrorTypes: Object.entries(this.stats.errorsByType)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([type, count]) => ({ type, count }))
            };

            fs.writeFileSync(this.summaryReportFile, JSON.stringify(summary, null, 2));
            console.log(`📊 Summary report saved to: ${this.summaryReportFile}`);
            
        } catch (error) {
            console.error(`❌ Failed to save summary report:`, error);
        }
    }

    /**
     * 継続時間をフォーマット
     */
    private formatDuration(milliseconds: number): string {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * 処理結果を解析してログファイルから成功/失敗を判定
     */
    private analyzeProcessingResult(
        repositoryName: string,
        category: string,
        pullRequestTitle: string,
        pullRequestPath: string,
        premergeDir: string
    ): boolean {
        try {
            // ログディレクトリの検索
            const logDir = path.join('/app/log', repositoryName, category, pullRequestTitle);
            
            if (!fs.existsSync(logDir)) {
                console.log(`⚠️  Log directory not found: ${logDir}`);
                return false;
            }
            
            // .logファイルを検索
            const logFiles = fs.readdirSync(logDir).filter(file => file.endsWith('.log'));
            
            if (logFiles.length === 0) {
                console.log(`⚠️  No log files found for ${pullRequestTitle}`);
                return false;
            }
            
            // 最新のログファイルを確認
            const latestLogFile = logFiles.sort().pop();
            if (!latestLogFile) return false;
            
            const logFilePath = path.join(logDir, latestLogFile);
            const logContent = fs.readFileSync(logFilePath, 'utf-8');
            const logData = JSON.parse(logContent);
            
            // ステータスを確認（%%_Fin_%%タグベースの厳密な判定）
            const status = logData.experiment_metadata?.status || 'Unknown';
            
            // %%_Fin_%%タグの存在確認
            const hasFinTag = logContent.includes('%%_Fin_%%') || status.includes('%%_Fin_%%');
            
            // 明示的なエラーの確認
            const hasErrors = logContent.includes('400 This model\'s maximum context length') ||
                             logContent.includes('JSON parse failed') ||
                             status.includes('Incomplete') ||
                             status.includes('Error') ||
                             status.includes('Failed');
            
            // 成功条件: %%_Fin_%%タグがあり、重大なエラーがない
            const isSuccess = hasFinTag && !hasErrors;
            
            console.log(`📊 Processing result for ${pullRequestTitle}:`);
            console.log(`   Status: ${status}`);
            console.log(`   %%_Fin_%% tag: ${hasFinTag ? 'YES' : 'NO'}`);
            console.log(`   Has errors: ${hasErrors ? 'YES' : 'NO'}`);
            console.log(`   Final result: ${isSuccess ? 'SUCCESS' : 'FAILURE'}`);
            
            return isSuccess;
            
        } catch (error) {
            console.error(`❌ Error analyzing processing result for ${pullRequestTitle}:`, error);
            return false;
        }
    }

    /**
     * 単一のPullRequestを安全に処理
     */
    private async processSinglePullRequest(
        repositoryName: string,
        category: string,
        pullRequestTitle: string,
        pullRequestPath: string,
        premergeDir: string
    ): Promise<boolean> {
        let controller: any = null;
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let retry = 0; retry <= maxRetries; retry++) {
            try {
                console.log(`🔄 Processing (attempt ${retry + 1}/${maxRetries + 1}): ${repositoryName}/${category}/${pullRequestTitle}`);
                
                // LLMFlowControllerを直接インスタンス化
                controller = new LLMFlowController(premergeDir);
                
                // エラーハンドリングを強化した処理実行
                await this.runControllerWithEnhancedErrorHandling(controller, repositoryName, category, pullRequestTitle);
                
                // 処理結果を解析して実際の成功/失敗を判定
                const isActualSuccess = this.analyzeProcessingResult(
                    repositoryName,
                    category,
                    pullRequestTitle,
                    pullRequestPath,
                    premergeDir
                );
                
                if (isActualSuccess) {
                    console.log(`✅ Successfully processed: ${pullRequestTitle}`);
                    this.updateStats('success');
                    return true;
                } else {
                    console.log(`⚠️  Processing completed but status indicates failure: ${pullRequestTitle}`);
                    this.updateStats('failure', 'ProcessingIncomplete');
                    
                    // 処理は完了しているがステータスが失敗の場合、リトライしない
                    return false;
                }
                
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(`❌ Error in attempt ${retry + 1}/${maxRetries + 1} for ${pullRequestTitle}:`, lastError.message);
                
                // 特定のエラータイプはリトライ対象外
                const isRetryableError = this.isRetryableError(lastError);
                
                if (!isRetryableError || retry === maxRetries) {
                    break;
                }
                
                // リトライ前の待機時間（指数バックオフ）
                const waitTime = Math.pow(2, retry) * 1000; // 1秒, 2秒, 4秒
                console.log(`⏳ Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                // メモリクリーンアップ
                if (controller && typeof controller.cleanup === 'function') {
                    try {
                        await controller.cleanup();
                    } catch (cleanupError) {
                        console.warn(`⚠️  Controller cleanup failed: ${cleanupError}`);
                    }
                }
                
                // ガベージコレクション
                if ((global as any).gc) {
                    (global as any).gc();
                }
            }
        }

        // 全てのリトライが失敗した場合
        const errorReport: ErrorReport = {
            timestamp: new Date().toISOString(),
            repositoryName,
            category,
            pullRequestTitle,
            pullRequestPath,
            premergeDir,
            errorType: lastError?.constructor.name || 'UnknownError',
            errorMessage: lastError?.message || 'Unknown error after retries',
            stackTrace: lastError?.stack || '',
            processingPhase: 'CONTROLLER_EXECUTION_WITH_RETRIES'
        };

        this.appendErrorReport(errorReport);
        this.updateStats('failure', errorReport.errorType);
        
        return false;
    }

    /**
     * エラーがリトライ可能かどうかを判定
     */
    private isRetryableError(error: Error): boolean {
        const retryablePatterns = [
            /network|timeout|connection/i,
            /rate.*limit/i,
            /temporary|temp/i,
            /502|503|504/i,
            /JSON.*parse/i,
            /SyntaxError/i,
            /unexpected/i
        ];

        const nonRetryablePatterns = [
            /401|403|404|413/i,  // 認証・権限・見つからない・ペイロード過大
            /invalid.*request/i,
            /malformed/i,
            /file.*not.*found/i,
            /directory.*not.*found/i
        ];

        // 非リトライ対象のエラーをチェック
        const errorMessage = error.message.toLowerCase();
        for (const pattern of nonRetryablePatterns) {
            if (pattern.test(errorMessage)) {
                console.log(`🚫 Non-retryable error detected: ${error.message}`);
                return false;
            }
        }

        // リトライ対象のエラーをチェック
        for (const pattern of retryablePatterns) {
            if (pattern.test(errorMessage)) {
                console.log(`🔄 Retryable error detected: ${error.message}`);
                return true;
            }
        }

        // デフォルトはリトライ対象外
        console.log(`❓ Unknown error type, not retrying: ${error.message}`);
        return false;
    }

    /**
     * 強化されたエラーハンドリングでコントローラーを実行
     */
    private async runControllerWithEnhancedErrorHandling(
        controller: any,
        repositoryName: string,
        category: string,
        pullRequestTitle: string
    ): Promise<void> {
        try {
            // 実行前にメモリ状況をチェック
            const memUsage = process.memoryUsage();
            console.log(`💾 Memory before execution: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);

            // タイムアウト設定（30分）
            const timeoutMs = 30 * 60 * 1000;
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Process timeout after ${timeoutMs / 1000}s`)), timeoutMs);
            });

            // 実際の処理実行
            await Promise.race([
                controller.run(),
                timeoutPromise
            ]);

            console.log(`✅ Controller execution completed for ${pullRequestTitle}`);

        } catch (error) {
            console.error(`❌ Enhanced error handler caught error in ${pullRequestTitle}:`, error);
            
            // JSONパースエラーの詳細分析
            if (error instanceof Error && /JSON.*parse|SyntaxError/.test(error.message)) {
                console.log(`🔍 JSON Parse Error Analysis:`);
                console.log(`   Error message: ${error.message}`);
                console.log(`   Stack trace preview: ${error.stack?.substring(0, 300)}...`);
                
                // ログファイルから問題のある部分を抽出して分析
                await this.analyzeJsonParseError(repositoryName, category, pullRequestTitle, error);
            }

            // メモリリーク対策
            const memUsageAfter = process.memoryUsage();
            console.log(`💾 Memory after error: RSS=${Math.round(memUsageAfter.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsageAfter.heapUsed / 1024 / 1024)}MB`);

            throw error;
        }
    }

    /**
     * JSONパースエラーの詳細分析
     */
    private async analyzeJsonParseError(
        repositoryName: string,
        category: string,
        pullRequestTitle: string,
        error: Error
    ): Promise<void> {
        try {
            const logDir = path.join('/app/log', repositoryName, category, pullRequestTitle);
            if (!fs.existsSync(logDir)) {
                console.log(`⚠️  Log directory not found for JSON error analysis: ${logDir}`);
                return;
            }

            const logFiles = fs.readdirSync(logDir).filter(file => file.endsWith('.log'));
            if (logFiles.length === 0) {
                console.log(`⚠️  No log files found for JSON error analysis`);
                return;
            }

            const latestLogFile = logFiles.sort().pop();
            if (!latestLogFile) return;

            const logFilePath = path.join(logDir, latestLogFile);
            const logContent = fs.readFileSync(logFilePath, 'utf-8');

            console.log(`🔍 JSON Error Analysis for ${pullRequestTitle}:`);
            console.log(`   Log file: ${logFilePath}`);
            console.log(`   Log size: ${Math.round(logContent.length / 1024)}KB`);

            // LLMレスポンス部分を検索
            const llmResponseMatches = logContent.match(/"llm_response":\s*\{[\s\S]*?"raw_content":\s*"([\s\S]*?)"/g);
            if (llmResponseMatches) {
                console.log(`   Found ${llmResponseMatches.length} LLM responses in log`);
                
                // 最後のLLMレスポンスをチェック
                const lastResponse = llmResponseMatches[llmResponseMatches.length - 1];
                const contentMatch = lastResponse.match(/"raw_content":\s*"([\s\S]*?)"/);
                if (contentMatch) {
                    const content = contentMatch[1];
                    console.log(`   Last LLM response length: ${content.length} chars`);
                    console.log(`   Content preview: ${content.substring(0, 200)}...`);
                    
                    // JSONパースが失敗しそうな箇所を特定
                    const problemPatterns = [
                        /\\"/g,  // エスケープされた引用符
                        /\n/g,   // 改行文字
                        /\r/g,   // 復帰文字
                        /\t/g,   // タブ文字
                        /\\n/g,  // エスケープされた改行
                        /\\r/g,  // エスケープされた復帰
                        /\\t/g   // エスケープされたタブ
                    ];
                    
                    for (const pattern of problemPatterns) {
                        const matches = content.match(pattern);
                        if (matches) {
                            console.log(`   Found ${matches.length} instances of ${pattern.toString()}`);
                        }
                    }
                }
            }

        } catch (analysisError) {
            console.error(`❌ JSON error analysis failed: ${analysisError}`);
        }
    }

    /**
     * 安全なバッチ処理実行
     */
    async runSafeDatasetProcessing(datasetDir: string): Promise<void> {
        console.log(`🚀 Starting safe batch processing for: ${datasetDir}`);
        console.log(`📅 Started at: ${this.stats.startTime.toISOString()}`);
        
        try {
            const datasetDirs = fs.readdirSync(datasetDir).filter(dir => 
                fs.statSync(path.join(datasetDir, dir)).isDirectory()
            );
            
            this.stats.totalRepositories = datasetDirs.length;
            console.log(`📊 Found ${this.stats.totalRepositories} repositories to process`);

            for (const repositoryName of datasetDirs) {
                const savedRepositoryPath = path.join(datasetDir, repositoryName);
                let categoryDirs: string[] = [];
                
                try {
                    categoryDirs = fs.readdirSync(savedRepositoryPath).filter(dir => 
                        fs.statSync(path.join(savedRepositoryPath, dir)).isDirectory()
                    );
                } catch (err) {
                    console.error(`❌ Error reading repository ${repositoryName}:`, (err as Error).message);
                    continue;
                }

                this.stats.totalCategories += categoryDirs.length;
                console.log(`📁 Repository ${repositoryName}: ${categoryDirs.length} categories`);

                for (const category of categoryDirs) {
                    const categoryPath = path.join(savedRepositoryPath, category);
                    let titleDirs: string[] = [];
                    
                    try {
                        titleDirs = fs.readdirSync(categoryPath).filter(dir => 
                            fs.statSync(path.join(categoryPath, dir)).isDirectory()
                        );
                    } catch (err) {
                        console.error(`❌ Error reading category ${category}:`, (err as Error).message);
                        continue;
                    }

                    this.stats.totalPullRequests += titleDirs.length;
                    console.log(`📋 Category ${category}: ${titleDirs.length} pull requests`);

                    for (const pullRequestTitle of titleDirs) {
                        const pullRequestPath = path.join(categoryPath, pullRequestTitle);

                        try {
                            // premerge_で始まるサブディレクトリを取得
                            const premergeDir = fs.readdirSync(pullRequestPath)
                                .map(dir => path.join(pullRequestPath, dir))
                                .find(filePath => 
                                    fs.statSync(filePath).isDirectory() && 
                                    path.basename(filePath).startsWith('premerge')
                                );

                            if (!premergeDir) {
                                console.warn(`⚠️  No premerge directory found in ${pullRequestPath}`);
                                this.updateStats('skip');
                                continue;
                            }

                            // 単一のPullRequestを安全に処理
                            const success = await this.processSinglePullRequest(
                                repositoryName,
                                category,
                                pullRequestTitle,
                                pullRequestPath,
                                premergeDir
                            );

                            // 進捗報告
                            if (this.stats.totalPullRequests > 0) {
                                const processed = this.stats.successfulPullRequests + this.stats.failedPullRequests + this.stats.skippedPullRequests;
                                const progress = Math.round((processed / this.stats.totalPullRequests) * 100);
                                console.log(`📊 Progress: ${processed}/${this.stats.totalPullRequests} (${progress}%) - Success: ${this.stats.successfulPullRequests}, Failed: ${this.stats.failedPullRequests}, Skipped: ${this.stats.skippedPullRequests}`);
                            }

                            // メモリ管理：定期的なガベージコレクション
                            if ((this.stats.successfulPullRequests + this.stats.failedPullRequests) % 5 === 0) {
                                console.log(`🗑️  Running memory management...`);
                                
                                // メモリ使用量をチェック
                                const memUsage = process.memoryUsage();
                                const memUsageMB = {
                                    rss: Math.round(memUsage.rss / 1024 / 1024),
                                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                                    external: Math.round(memUsage.external / 1024 / 1024)
                                };
                                
                                console.log(`💾 Current memory usage: RSS=${memUsageMB.rss}MB, Heap=${memUsageMB.heapUsed}/${memUsageMB.heapTotal}MB, External=${memUsageMB.external}MB`);
                                
                                // ガベージコレクション実行
                                if ((global as any).gc) {
                                    (global as any).gc();
                                    
                                    // GC後のメモリ使用量をチェック
                                    const memUsageAfterGC = process.memoryUsage();
                                    const memUsageAfterMB = {
                                        rss: Math.round(memUsageAfterGC.rss / 1024 / 1024),
                                        heapUsed: Math.round(memUsageAfterGC.heapUsed / 1024 / 1024)
                                    };
                                    
                                    console.log(`🗑️  Memory after GC: RSS=${memUsageAfterMB.rss}MB (Δ${memUsageAfterMB.rss - memUsageMB.rss}), Heap=${memUsageAfterMB.heapUsed}MB (Δ${memUsageAfterMB.heapUsed - memUsageMB.heapUsed})`);
                                    
                                    // メモリ使用量が高い場合の警告
                                    if (memUsageAfterMB.rss > 4000) { // 4GB以上
                                        console.warn(`⚠️  High memory usage detected: ${memUsageAfterMB.rss}MB RSS`);
                                    }
                                } else {
                                    console.warn(`⚠️  Garbage collection not available. Start Node.js with --expose-gc flag for better memory management.`);
                                }
                            }

                        } catch (dirError) {
                            console.error(`❌ Error processing pullRequest ${pullRequestTitle}:`, dirError);
                            
                            const errorReport: ErrorReport = {
                                timestamp: new Date().toISOString(),
                                repositoryName,
                                category,
                                pullRequestTitle,
                                pullRequestPath,
                                premergeDir: 'N/A',
                                errorType: dirError instanceof Error ? dirError.constructor.name : 'DirectoryError',
                                errorMessage: dirError instanceof Error ? dirError.message : String(dirError),
                                stackTrace: dirError instanceof Error ? dirError.stack || '' : '',
                                processingPhase: 'DIRECTORY_SCANNING'
                            };

                            this.appendErrorReport(errorReport);
                            this.updateStats('failure', errorReport.errorType);
                        }
                    }
                }
            }

        } catch (error) {
            console.error(`❌ Fatal error in batch processing:`, error);
            throw error;
        } finally {
            // 最終統計を保存
            this.saveSummaryReport();
            this.printFinalReport();
        }
    }

    /**
     * 最終レポートを表示
     */
    private printFinalReport(): void {
        console.log(`\n🎯 ===== FINAL PROCESSING REPORT =====`);
        console.log(`📊 Total Repositories: ${this.stats.totalRepositories}`);
        console.log(`📊 Total Categories: ${this.stats.totalCategories}`);
        console.log(`📊 Total Pull Requests: ${this.stats.totalPullRequests}`);
        console.log(`✅ Successful: ${this.stats.successfulPullRequests}`);
        console.log(`❌ Failed: ${this.stats.failedPullRequests}`);
        console.log(`⏭️  Skipped: ${this.stats.skippedPullRequests}`);
        
        if (this.stats.totalPullRequests > 0) {
            const successRate = Math.round((this.stats.successfulPullRequests / this.stats.totalPullRequests) * 100);
            console.log(`📈 Success Rate: ${successRate}%`);
        }

        if (this.stats.totalDuration) {
            console.log(`⏱️  Total Duration: ${this.formatDuration(this.stats.totalDuration)}`);
        }

        console.log(`📄 Error Report: ${this.errorReportFile}`);
        console.log(`📄 Summary Report: ${this.summaryReportFile}`);
        console.log(`=====================================`);
    }
}

// グレースフルシャットダウンの実装
let isShuttingDown = false;
let currentRunner: SafeBatchRunner | null = null;

const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log(`📡 Received ${signal}. Starting graceful shutdown...`);
    
    // 現在の統計を保存
    if (currentRunner) {
        console.log('💾 Saving current processing state...');
        try {
            (currentRunner as any).saveSummaryReport();
            console.log('✅ Processing state saved successfully');
        } catch (saveError) {
            console.error('❌ Failed to save processing state:', saveError);
        }
    }
    
    // リソースのクリーンアップ
    console.log('🧹 Cleaning up resources...');
    
    // アクティブな処理のキャンセル
    if (currentRunner) {
        try {
            // 現在進行中の処理の情報を保存
            const currentStats = (currentRunner as any).stats;
            console.log(`📊 Final stats before shutdown: Success=${currentStats.successfulPullRequests}, Failed=${currentStats.failedPullRequests}, Skipped=${currentStats.skippedPullRequests}`);
        } catch (statError) {
            console.error('❌ Error accessing current stats:', statError);
        }
    }
    
    // ガベージコレクション強制実行
    if ((global as any).gc) {
        console.log('🗑️ Running final garbage collection...');
        try {
            (global as any).gc();
            console.log('✅ Garbage collection completed');
        } catch (gcError) {
            console.error('❌ Garbage collection failed:', gcError);
        }
    }
    
    // プロセス情報の表示
    const memUsage = process.memoryUsage();
    console.log(`💾 Final memory usage: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
};

// シグナルハンドラーの設定
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 異常終了のキャッチ
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    console.error('Stack:', error.stack);
    
    // エラーの詳細をログに記録
    if (currentRunner) {
        try {
            const errorReport = {
                timestamp: new Date().toISOString(),
                repositoryName: 'SYSTEM',
                category: 'UNCAUGHT_EXCEPTION',
                pullRequestTitle: 'N/A',
                pullRequestPath: 'N/A',
                premergeDir: 'N/A',
                errorType: error.constructor.name,
                errorMessage: error.message,
                stackTrace: error.stack || '',
                processingPhase: 'SYSTEM_LEVEL'
            };
            
            (currentRunner as any).appendErrorReport(errorReport);
            console.log('📝 Uncaught exception logged to error report');
        } catch (logError) {
            console.error('❌ Failed to log uncaught exception:', logError);
        }
    }
    
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Unhandled rejectionの詳細をログに記録
    if (currentRunner) {
        try {
            const errorReport = {
                timestamp: new Date().toISOString(),
                repositoryName: 'SYSTEM',
                category: 'UNHANDLED_REJECTION',
                pullRequestTitle: 'N/A',
                pullRequestPath: 'N/A',
                premergeDir: 'N/A',
                errorType: reason instanceof Error ? reason.constructor.name : 'UnhandledRejection',
                errorMessage: reason instanceof Error ? reason.message : String(reason),
                stackTrace: reason instanceof Error ? reason.stack || '' : '',
                processingPhase: 'PROMISE_REJECTION'
            };
            
            (currentRunner as any).appendErrorReport(errorReport);
            console.log('📝 Unhandled rejection logged to error report');
        } catch (logError) {
            console.error('❌ Failed to log unhandled rejection:', logError);
        }
    }
    
    gracefulShutdown('unhandledRejection');
});

// メモリ使用量監視（定期チェック）
setInterval(() => {
    if (!isShuttingDown && currentRunner) {
        const memUsage = process.memoryUsage();
        const memUsageMB = Math.round(memUsage.rss / 1024 / 1024);
        
        // メモリ使用量が異常に高い場合の警告
        if (memUsageMB > 6000) { // 6GB以上
            console.warn(`⚠️  CRITICAL: Very high memory usage detected: ${memUsageMB}MB`);
            console.warn(`⚠️  Consider terminating the process to prevent system instability`);
            
            // 緊急ガベージコレクション
            if ((global as any).gc) {
                console.log('🚨 Running emergency garbage collection...');
                (global as any).gc();
            }
        } else if (memUsageMB > 4000) { // 4GB以上
            console.warn(`⚠️  High memory usage: ${memUsageMB}MB - monitoring closely`);
        }
    }
}, 60000); // 60秒ごとにチェック

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
    const datasetDir = process.argv[2] || "/app/dataset/filtered_fewChanged";
    const outputDir = process.argv[3] || "/app/output";
    
    console.log(`🎯 Safe Batch Runner Starting...`);
    console.log(`📁 Dataset Directory: ${datasetDir}`);
    console.log(`📁 Output Directory: ${outputDir}`);
    console.log(`🐛 Process ID: ${process.pid}`);
    console.log(`💾 Node.js Version: ${process.version}`);
    console.log(`🗑️  Garbage Collection: ${(global as any).gc ? 'Available' : 'Not Available (use --expose-gc)'}`);
    
    // メモリ制限の確認と設定
    const memUsage = process.memoryUsage();
    console.log(`💾 Initial Memory: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    
    try {
        // プロセス制限の確認
        if (process.platform === 'linux') {
            console.log(`🔧 Platform: ${process.platform} (containerized environment)`);
        }
        
        // データセットディレクトリの事前チェック
        if (!fs.existsSync(datasetDir)) {
            throw new Error(`Dataset directory not found: ${datasetDir}`);
        }
        
        // アウトプットディレクトリの作成
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`📁 Created output directory: ${outputDir}`);
        }
        
        // プロセス開始の記録
        console.log(`⏰ Process started at: ${new Date().toISOString()}`);
        
        currentRunner = new SafeBatchRunner(outputDir);
        await currentRunner.runSafeDatasetProcessing(datasetDir);
        console.log("✅ Safe batch processing completed successfully.");
        
        // 正常終了
        process.exit(0);
    } catch (error) {
        console.error("❌ Critical error in safe batch processing:", error);
        
        // 最終エラーレポートの生成
        if (currentRunner) {
            try {
                const finalErrorReport = {
                    timestamp: new Date().toISOString(),
                    repositoryName: 'SYSTEM',
                    category: 'CRITICAL_ERROR',
                    pullRequestTitle: 'BATCH_PROCESSING',
                    pullRequestPath: datasetDir,
                    premergeDir: 'N/A',
                    errorType: error instanceof Error ? error.constructor.name : 'CriticalError',
                    errorMessage: error instanceof Error ? error.message : String(error),
                    stackTrace: error instanceof Error ? error.stack || '' : '',
                    processingPhase: 'BATCH_INITIALIZATION'
                };
                
                (currentRunner as any).appendErrorReport(finalErrorReport);
                console.log('📝 Critical error logged to final error report');
            } catch (reportError) {
                console.error('❌ Failed to log critical error:', reportError);
            }
        }
        
        gracefulShutdown('error');
    }
}

export { SafeBatchRunner };
