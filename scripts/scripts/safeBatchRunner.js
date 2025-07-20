import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
// 環境変数の設定
config({ path: path.join(process.cwd(), '.env') });
class SafeBatchRunner {
    constructor(baseOutputDir = '/app/output') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.errorReportFile = path.join(baseOutputDir, `error_report_${timestamp}.json`);
        this.summaryReportFile = path.join(baseOutputDir, `processing_summary_${timestamp}.json`);
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
    appendErrorReport(errorReport) {
        try {
            let existingErrors = [];
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
        }
        catch (writeError) {
            console.error(`❌ Failed to write error report:`, writeError);
        }
    }
    /**
     * 処理統計を更新
     */
    updateStats(type, errorType) {
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
    saveSummaryReport() {
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
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([type, count]) => ({ type, count }))
            };
            fs.writeFileSync(this.summaryReportFile, JSON.stringify(summary, null, 2));
            console.log(`📊 Summary report saved to: ${this.summaryReportFile}`);
        }
        catch (error) {
            console.error(`❌ Failed to save summary report:`, error);
        }
    }
    /**
     * 継続時間をフォーマット
     */
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    /**
     * 処理結果を解析してログファイルから成功/失敗を判定
     */
    analyzeProcessingResult(repositoryName, category, pullRequestTitle, pullRequestPath, premergeDir) {
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
            if (!latestLogFile)
                return false;
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
        }
        catch (error) {
            console.error(`❌ Error analyzing processing result for ${pullRequestTitle}:`, error);
            return false;
        }
    }
    /**
     * 単一のPullRequestを安全に処理
     */
    async processSinglePullRequest(repositoryName, category, pullRequestTitle, pullRequestPath, premergeDir) {
        try {
            console.log(`🔄 Processing: ${repositoryName}/${category}/${pullRequestTitle}`);
            // LLMFlowControllerを直接インスタンス化
            const { default: LLMFlowController } = await import('../src/modules/llmFlowController.js');
            const controller = new LLMFlowController(premergeDir);
            // 処理実行
            await controller.run();
            // 処理結果を解析して実際の成功/失敗を判定
            const isActualSuccess = this.analyzeProcessingResult(repositoryName, category, pullRequestTitle, pullRequestPath, premergeDir);
            if (isActualSuccess) {
                console.log(`✅ Successfully processed: ${pullRequestTitle}`);
                this.updateStats('success');
                return true;
            }
            else {
                console.log(`⚠️  Processing completed but status indicates failure: ${pullRequestTitle}`);
                this.updateStats('failure', 'ProcessingIncomplete');
                return false;
            }
        }
        catch (error) {
            const errorReport = {
                timestamp: new Date().toISOString(),
                repositoryName,
                category,
                pullRequestTitle,
                pullRequestPath,
                premergeDir,
                errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
                errorMessage: error instanceof Error ? error.message : String(error),
                stackTrace: error instanceof Error ? error.stack || '' : '',
                processingPhase: 'CONTROLLER_EXECUTION'
            };
            this.appendErrorReport(errorReport);
            this.updateStats('failure', errorReport.errorType);
            return false;
        }
    }
    /**
     * 安全なバッチ処理実行
     */
    async runSafeDatasetProcessing(datasetDir) {
        console.log(`🚀 Starting safe batch processing for: ${datasetDir}`);
        console.log(`📅 Started at: ${this.stats.startTime.toISOString()}`);
        try {
            const datasetDirs = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());
            this.stats.totalRepositories = datasetDirs.length;
            console.log(`📊 Found ${this.stats.totalRepositories} repositories to process`);
            for (const repositoryName of datasetDirs) {
                const savedRepositoryPath = path.join(datasetDir, repositoryName);
                let categoryDirs = [];
                try {
                    categoryDirs = fs.readdirSync(savedRepositoryPath).filter(dir => fs.statSync(path.join(savedRepositoryPath, dir)).isDirectory());
                }
                catch (err) {
                    console.error(`❌ Error reading repository ${repositoryName}:`, err.message);
                    continue;
                }
                this.stats.totalCategories += categoryDirs.length;
                console.log(`📁 Repository ${repositoryName}: ${categoryDirs.length} categories`);
                for (const category of categoryDirs) {
                    const categoryPath = path.join(savedRepositoryPath, category);
                    let titleDirs = [];
                    try {
                        titleDirs = fs.readdirSync(categoryPath).filter(dir => fs.statSync(path.join(categoryPath, dir)).isDirectory());
                    }
                    catch (err) {
                        console.error(`❌ Error reading category ${category}:`, err.message);
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
                                .find(filePath => fs.statSync(filePath).isDirectory() &&
                                path.basename(filePath).startsWith('premerge'));
                            if (!premergeDir) {
                                console.warn(`⚠️  No premerge directory found in ${pullRequestPath}`);
                                this.updateStats('skip');
                                continue;
                            }
                            // 単一のPullRequestを安全に処理
                            const success = await this.processSinglePullRequest(repositoryName, category, pullRequestTitle, pullRequestPath, premergeDir);
                            // 進捗報告
                            if (this.stats.totalPullRequests > 0) {
                                const processed = this.stats.successfulPullRequests + this.stats.failedPullRequests + this.stats.skippedPullRequests;
                                const progress = Math.round((processed / this.stats.totalPullRequests) * 100);
                                console.log(`📊 Progress: ${processed}/${this.stats.totalPullRequests} (${progress}%) - Success: ${this.stats.successfulPullRequests}, Failed: ${this.stats.failedPullRequests}, Skipped: ${this.stats.skippedPullRequests}`);
                            }
                            // メモリ管理：定期的なガベージコレクション
                            if ((this.stats.successfulPullRequests + this.stats.failedPullRequests) % 10 === 0) {
                                if (global.gc) {
                                    console.log(`🗑️  Running garbage collection...`);
                                    global.gc();
                                }
                            }
                        }
                        catch (dirError) {
                            console.error(`❌ Error processing pullRequest ${pullRequestTitle}:`, dirError);
                            const errorReport = {
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
        }
        catch (error) {
            console.error(`❌ Fatal error in batch processing:`, error);
            throw error;
        }
        finally {
            // 最終統計を保存
            this.saveSummaryReport();
            this.printFinalReport();
        }
    }
    /**
     * 最終レポートを表示
     */
    printFinalReport() {
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
let currentRunner = null;
const gracefulShutdown = (signal) => {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    console.log(`📡 Received ${signal}. Starting graceful shutdown...`);
    // 現在の統計を保存
    if (currentRunner) {
        console.log('💾 Saving current processing state...');
        currentRunner.saveSummaryReport();
    }
    // リソースのクリーンアップ
    console.log('🧹 Cleaning up resources...');
    // ガベージコレクション強制実行
    if (global.gc) {
        console.log('🗑️ Running garbage collection...');
        global.gc();
    }
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
    gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});
// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
    const datasetDir = process.argv[2] || "/app/dataset/test";
    const outputDir = process.argv[3] || "/app/output";
    console.log(`🎯 Safe Batch Runner Starting...`);
    console.log(`📁 Dataset Directory: ${datasetDir}`);
    console.log(`📁 Output Directory: ${outputDir}`);
    try {
        currentRunner = new SafeBatchRunner(outputDir);
        await currentRunner.runSafeDatasetProcessing(datasetDir);
        console.log("✅ Safe batch processing completed.");
        // 正常終了
        process.exit(0);
    }
    catch (error) {
        console.error("❌ Error in safe batch processing:", error);
        gracefulShutdown('error');
    }
}
export { SafeBatchRunner };
