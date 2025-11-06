/**
 * バッチ処理モデル
 * MVCアーキテクチャのModel層
 * データ処理とビジネスロジックを担当
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
    ProcessingResult,
    BatchProcessingOptions,
    ProcessingStatistics,
    ProcessingProgress,
    MemoryUsageInfo,
    ErrorReport,
    PullRequestInfo,
    DatasetValidationResult,
    LLMControllerResult,
    ProcessingStatus
} from '../types/BatchProcessTypes.js';

// LLMFlowControllerのインポート
import LLMFlowController from '../modules/llmFlowController.js';

// Node.js型の宣言
declare const process: any;

export class BatchProcessModel {
    private statistics: ProcessingStatistics;
    private options: BatchProcessingOptions;
    private errorReports: ErrorReport[] = [];
    private processedCount: number = 0;
    private currentController: LLMFlowController | null = null;

    constructor(options: BatchProcessingOptions = {}) {
        this.options = {
            baseOutputDir: '/app/output',
            maxRetries: 3,
            memoryCleanupInterval: 5,
            timeoutMs: 30 * 60 * 1000, // 30分
            enableGarbageCollection: true,
            ...options
        };

        this.statistics = {
            totalRepositories: 0,
            totalCategories: 0,
            totalPullRequests: 0,
            successfulPullRequests: 0,
            failedPullRequests: 0,
            skippedPullRequests: 0,
            startTime: new Date(),
            errorsByType: {},
            successRate: 0
        };

        // 出力ディレクトリの作成
        this.ensureOutputDirectory();
    }

    /**
     * データセット構造の検証
     */
    async validateDatasetStructure(datasetDir: string): Promise<DatasetValidationResult> {
        const issues: string[] = [];

        // データセットディレクトリの存在確認
        if (!fs.existsSync(datasetDir)) {
            issues.push(`Dataset directory not found: ${datasetDir}`);
            return {
                isValid: false,
                repositoryCount: 0,
                totalPullRequests: 0,
                issues
            };
        }

        // リポジトリディレクトリの確認
        const repositories = this.getDirectories(datasetDir);
        let totalPullRequests = 0;

        for (const repo of repositories) {
            const repoPath = path.join(datasetDir, repo);
            const categories = this.getDirectories(repoPath);
            
            for (const category of categories) {
                const categoryPath = path.join(repoPath, category);
                const pullRequests = this.getDirectories(categoryPath);
                totalPullRequests += pullRequests.length;

                // premergeディレクトリの存在確認
                for (const pr of pullRequests) {
                    const prPath = path.join(categoryPath, pr);
                    const hasPremerge = this.hasPremergeDirectory(prPath);
                    if (!hasPremerge) {
                        issues.push(`No premerge directory found in ${prPath}`);
                    }
                }
            }
        }

        return {
            isValid: issues.length === 0,
            repositoryCount: repositories.length,
            totalPullRequests,
            issues
        };
    }

    /**
     * リポジトリ一覧取得
     */
    async getRepositoryList(datasetDir: string): Promise<string[]> {
        const repositories = this.getDirectories(datasetDir);
        this.statistics.totalRepositories = repositories.length;
        return repositories;
    }

    /**
     * カテゴリ一覧取得
     */
    async getCategoryList(datasetDir: string, repositoryName: string): Promise<string[]> {
        const repositoryPath = path.join(datasetDir, repositoryName);
        const categories = this.getDirectories(repositoryPath);
        this.statistics.totalCategories += categories.length;
        return categories;
    }

    /**
     * プルリクエスト一覧取得
     */
    async getPullRequestList(
        datasetDir: string, 
        repositoryName: string, 
        category: string
    ): Promise<string[]> {
        const categoryPath = path.join(datasetDir, repositoryName, category);
        const pullRequests = this.getDirectories(categoryPath);
        this.statistics.totalPullRequests += pullRequests.length;
        return pullRequests;
    }

    /**
     * プルリクエスト処理
     */
    async processPullRequest(
        datasetDir: string,
        repositoryName: string,
        category: string,
        pullRequestTitle: string
    ): Promise<ProcessingResult> {
        const startTime = Date.now();
        const pullRequestPath = path.join(datasetDir, repositoryName, category, pullRequestTitle);
        
        try {
            // premergeディレクトリの検索
            const premergeDir = this.findPremergeDirectory(pullRequestPath);
            if (!premergeDir) {
                const result: ProcessingResult = {
                    success: false,
                    repositoryName,
                    category,
                    pullRequestTitle,
                    pullRequestPath,
                    premergeDir: '',
                    processingTime: Date.now() - startTime,
                    errorMessage: 'No premerge directory found',
                    errorType: 'MissingPremergeDirectory'
                };
                
                this.updateStatistics('skip');
                return result;
            }

            // LLMFlowControllerでの処理
            const llmResult = await this.executeLLMController(premergeDir);
            
            // 処理結果の分析
            const isSuccess = this.analyzeProcessingResult(
                repositoryName, 
                category, 
                pullRequestTitle, 
                llmResult
            );

            const result: ProcessingResult = {
                success: isSuccess,
                repositoryName,
                category,
                pullRequestTitle,
                pullRequestPath,
                premergeDir,
                processingTime: Date.now() - startTime,
                errorMessage: isSuccess ? undefined : llmResult.errorMessage,
                errorType: isSuccess ? undefined : 'ProcessingFailure'
            };

            this.updateStatistics(isSuccess ? 'success' : 'failure', result.errorType);
            return result;

        } catch (error) {
            const result: ProcessingResult = {
                success: false,
                repositoryName,
                category,
                pullRequestTitle,
                pullRequestPath,
                premergeDir: '',
                processingTime: Date.now() - startTime,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
            };

            this.updateStatistics('failure', result.errorType);
            return result;
        }
    }

    /**
     * LLMFlowControllerの実行
     */
    private async executeLLMController(premergeDir: string): Promise<LLMControllerResult> {
        const startTime = Date.now();
        
        try {
            // pullRequestTitle を取得（premergeDir からパースするか、デフォルト値を使用）
            const pullRequestTitle = this.extractPullRequestTitle(premergeDir);
            this.currentController = new LLMFlowController(premergeDir, pullRequestTitle);
            
            // タイムアウト設定
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Process timeout after ${this.options.timeoutMs! / 1000}s`));
                }, this.options.timeoutMs);
            });

            // 実際の処理実行
            await Promise.race([
                this.currentController.run(),
                timeoutPromise
            ]);

            return {
                success: true,
                processingTime: Date.now() - startTime
            };

        } catch (error) {
            return {
                success: false,
                processingTime: Date.now() - startTime,
                errorMessage: error instanceof Error ? error.message : String(error)
            };
        } finally {
            // クリーンアップ
            if (this.currentController) {
                try {
                    // LLMFlowControllerにcleanupメソッドがある場合のみ呼び出し
                    if (typeof (this.currentController as any).cleanup === 'function') {
                        await (this.currentController as any).cleanup();
                    }
                } catch (cleanupError) {
                    console.warn('⚠️ Controller cleanup failed:', cleanupError);
                }
            }
            this.currentController = null;
        }
    }

    /**
     * premergeDir からプルリクエストタイトルを抽出
     * パスの形式: /path/to/repo/pullrequest/pr_name/premerge_xxx
     */
    private extractPullRequestTitle(premergeDir: string): string {
        const parts = premergeDir.split('/');
        // premerge_xxx の一つ上のディレクトリがPRタイトル
        const premergeIndex = parts.findIndex(part => part.startsWith('premerge_'));
        if (premergeIndex > 0) {
            return parts[premergeIndex - 1] || 'unknown-pr';
        }
        return 'unknown-pr';
    }

    /**
     * 処理結果の分析
     */
    private analyzeProcessingResult(
        repositoryName: string,
        category: string,
        pullRequestTitle: string,
        llmResult: LLMControllerResult
    ): boolean {
        if (!llmResult.success) {
            return false;
        }

        try {
            // ログディレクトリの検索
            const logDir = path.join('/app/log', repositoryName, category, pullRequestTitle);
            if (!fs.existsSync(logDir)) {
                console.log(`⚠️ Log directory not found: ${logDir}`);
                return false;
            }

            // .logファイルを検索
            const logFiles = fs.readdirSync(logDir).filter((file: any) => file.endsWith('.log'));
            if (logFiles.length === 0) {
                console.log(`⚠️ No log files found for ${pullRequestTitle}`);
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
            return hasFinTag && !hasErrors;

        } catch (error) {
            console.error(`❌ Error analyzing processing result for ${pullRequestTitle}:`, error);
            return false;
        }
    }

    /**
     * 統計の更新
     */
    private updateStatistics(type: 'success' | 'failure' | 'skip', errorType?: string): void {
        switch (type) {
            case 'success':
                this.statistics.successfulPullRequests++;
                break;
            case 'failure':
                this.statistics.failedPullRequests++;
                if (errorType) {
                    this.statistics.errorsByType[errorType] = 
                        (this.statistics.errorsByType[errorType] || 0) + 1;
                }
                break;
            case 'skip':
                this.statistics.skippedPullRequests++;
                break;
        }

        // 成功率の計算
        const totalProcessed = this.statistics.successfulPullRequests + 
                              this.statistics.failedPullRequests + 
                              this.statistics.skippedPullRequests;
        
        if (totalProcessed > 0) {
            this.statistics.successRate = Math.round(
                (this.statistics.successfulPullRequests / totalProcessed) * 100
            );
        }

        this.processedCount++;
    }

    /**
     * エラー記録
     */
    async recordRepositoryError(repositoryName: string, error: any): Promise<void> {
        const errorReport = this.createErrorReport({
            repositoryName,
            category: 'REPOSITORY_ERROR',
            pullRequestTitle: 'N/A',
            pullRequestPath: 'N/A',
            premergeDir: 'N/A',
            error,
            processingPhase: 'REPOSITORY_PROCESSING'
        });
        
        this.errorReports.push(errorReport);
    }

    async recordCategoryError(repositoryName: string, category: string, error: any): Promise<void> {
        const errorReport = this.createErrorReport({
            repositoryName,
            category,
            pullRequestTitle: 'N/A',
            pullRequestPath: 'N/A',
            premergeDir: 'N/A',
            error,
            processingPhase: 'CATEGORY_PROCESSING'
        });
        
        this.errorReports.push(errorReport);
    }

    async recordPullRequestError(
        repositoryName: string, 
        category: string, 
        pullRequestTitle: string, 
        error: any
    ): Promise<void> {
        const errorReport = this.createErrorReport({
            repositoryName,
            category,
            pullRequestTitle,
            pullRequestPath: 'N/A',
            premergeDir: 'N/A',
            error,
            processingPhase: 'PULLREQUEST_PROCESSING'
        });
        
        this.errorReports.push(errorReport);
    }

    async recordCriticalError(errorReport: ErrorReport): Promise<void> {
        this.errorReports.push(errorReport);
    }

    /**
     * エラーレポート作成
     */
    private createErrorReport(params: {
        repositoryName: string;
        category: string;
        pullRequestTitle: string;
        pullRequestPath: string;
        premergeDir: string;
        error: any;
        processingPhase: string;
    }): ErrorReport {
        return {
            timestamp: new Date().toISOString(),
            repositoryName: params.repositoryName,
            category: params.category,
            pullRequestTitle: params.pullRequestTitle,
            pullRequestPath: params.pullRequestPath,
            premergeDir: params.premergeDir,
            errorType: params.error instanceof Error ? params.error.constructor.name : 'UnknownError',
            errorMessage: params.error instanceof Error ? params.error.message : String(params.error),
            stackTrace: params.error instanceof Error ? params.error.stack || '' : '',
            processingPhase: params.processingPhase
        };
    }

    /**
     * 処理進捗の取得
     */
    getProcessingProgress(): ProcessingProgress {
        const processedPullRequests = this.statistics.successfulPullRequests + 
                                    this.statistics.failedPullRequests + 
                                    this.statistics.skippedPullRequests;

        return {
            totalRepositories: this.statistics.totalRepositories,
            processedRepositories: 0, // TODO: 実装
            totalPullRequests: this.statistics.totalPullRequests,
            processedPullRequests,
            successfulPullRequests: this.statistics.successfulPullRequests,
            failedPullRequests: this.statistics.failedPullRequests,
            skippedPullRequests: this.statistics.skippedPullRequests,
            progressPercentage: this.statistics.totalPullRequests > 0 
                ? Math.round((processedPullRequests / this.statistics.totalPullRequests) * 100)
                : 0
        };
    }

    /**
     * 処理統計の取得
     */
    getProcessingStatistics(): ProcessingStatistics {
        return { ...this.statistics };
    }

    /**
     * エラーレポートの取得
     */
    getErrorReport(): ErrorReport[] {
        return [...this.errorReports];
    }

    /**
     * メモリ使用量の取得
     */
    getMemoryUsage(): MemoryUsageInfo {
        const memUsage = process.memoryUsage();
        return {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
        };
    }

    /**
     * メモリクリーンアップが必要かどうかの判定
     */
    shouldPerformMemoryCleanup(): boolean {
        return this.processedCount % this.options.memoryCleanupInterval! === 0;
    }

    /**
     * クリーンアップ
     */
    async cleanup(): Promise<void> {
        if (this.currentController) {
            try {
                // LLMFlowControllerにcleanupメソッドがある場合のみ呼び出し
                if (typeof (this.currentController as any).cleanup === 'function') {
                    await (this.currentController as any).cleanup();
                }
            } catch (error) {
                console.warn('⚠️ Controller cleanup failed during model cleanup:', error);
            }
        }
        this.currentController = null;
    }

    // ヘルパーメソッド
    private getDirectories(dirPath: string): string[] {
        try {
            return fs.readdirSync(dirPath).filter((item: any) => {
                return fs.statSync(path.join(dirPath, item)).isDirectory();
            });
        } catch (error) {
            console.error(`❌ Error reading directory ${dirPath}:`, error);
            return [];
        }
    }

    private hasPremergeDirectory(pullRequestPath: string): boolean {
        try {
            const items = fs.readdirSync(pullRequestPath);
            return items.some((item: any) => {
                const itemPath = path.join(pullRequestPath, item);
                return fs.statSync(itemPath).isDirectory() && item.startsWith('premerge');
            });
        } catch (error) {
            return false;
        }
    }

    private findPremergeDirectory(pullRequestPath: string): string | null {
        try {
            const items = fs.readdirSync(pullRequestPath);
            for (const item of items) {
                const itemPath = path.join(pullRequestPath, item);
                if (fs.statSync(itemPath).isDirectory() && item.startsWith('premerge')) {
                    return itemPath;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    private ensureOutputDirectory(): void {
        if (!fs.existsSync(this.options.baseOutputDir!)) {
            fs.mkdirSync(this.options.baseOutputDir!, { recursive: true });
        }
    }
}
