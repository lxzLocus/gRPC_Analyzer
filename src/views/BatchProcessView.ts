/**
 * バッチ処理ビュー
 * MVCアーキテクチャのView層
 * 出力とレポート生成を担当
 */

import * as fs from 'fs';
import * as path from 'path';
import { getJSTFileTimestamp, getJSTTimestamp, convertUTCtoJST } from '../utils/timeUtils.js';
import { 
    ProcessingResult,
    ProcessingStatistics,
    ProcessingProgress,
    MemoryUsageInfo,
    ErrorReport
} from '../types/BatchProcessTypes.js';

// Node.js型の宣言
declare const process: any;
declare const global: any;

export class BatchProcessView {
    private outputDir: string;
    private errorReportFile: string;
    private summaryReportFile: string;

    constructor(outputDir: string = '/app/output') {
        this.outputDir = outputDir;
        
    const timestamp = getJSTFileTimestamp();
    this.errorReportFile = path.join(outputDir, `error_report_${timestamp}.json`);
    this.summaryReportFile = path.join(outputDir, `processing_summary_${timestamp}.json`);

        // 出力ディレクトリの作成
        this.ensureOutputDirectory();
        
        console.log(`📋 Error report will be saved to: ${this.errorReportFile}`);
        console.log(`📋 Summary report will be saved to: ${this.summaryReportFile}`);
    }

    /**
     * 処理開始の表示
     */
    displayProcessingStart(datasetDir: string): void {
        console.log('🚀 Starting safe batch processing for:', datasetDir);
    console.log('📅 Started at (JST):', getJSTTimestamp());
        console.log('🐛 Process ID:', process.pid);
        console.log('📝 Node.js Version:', process.version);
        console.log('🗑️ Garbage Collection:', global.gc ? 'Available' : 'Not Available (use --expose-gc)');
        
        // 初期メモリ使用量の表示
        const memUsage = process.memoryUsage();
        console.log(`💾 Initial Memory: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }

    /**
     * リポジトリ数の表示
     */
    displayRepositoryCount(count: number): void {
        console.log(`📊 Found ${count} repositories to process`);
    }

    /**
     * リポジトリ処理開始の表示
     */
    displayRepositoryProcessingStart(repositoryName: string): void {
        console.log(`\n🔄 Processing repository: ${repositoryName}`);
    }

    /**
     * リポジトリ処理完了の表示
     */
    displayRepositoryProcessingComplete(repositoryName: string): void {
        console.log(`✅ Completed repository: ${repositoryName}`);
    }

    /**
     * カテゴリ処理開始の表示
     */
    displayCategoryProcessingStart(repositoryName: string, category: string): void {
        console.log(`  📁 Category ${repositoryName}/${category}`);
    }

    /**
     * カテゴリ処理完了の表示
     */
    displayCategoryProcessingComplete(repositoryName: string, category: string): void {
        console.log(`  ✅ Completed category ${repositoryName}/${category}`);
    }

    /**
     * プルリクエスト処理開始の表示
     */
    displayPullRequestProcessingStart(
        repositoryName: string, 
        category: string, 
        pullRequestTitle: string
    ): void {
        console.log(`    🔄 Processing: ${repositoryName}/${category}/${pullRequestTitle}`);
    }

    /**
     * プルリクエスト処理結果の表示
     */
    displayPullRequestResult(result: ProcessingResult): void {
        const status = result.success ? '✅' : '❌';
        const duration = `${Math.round(result.processingTime / 1000)}s`;
        
        console.log(`    ${status} ${result.pullRequestTitle} (${duration})`);
        
        if (!result.success && result.errorMessage) {
            console.log(`      Error: ${result.errorMessage}`);
        }
    }

    /**
     * 進捗の表示
     */
    displayProgress(progress: ProcessingProgress): void {
        const processed = progress.processedPullRequests;
        const total = progress.totalPullRequests;
        const percentage = progress.progressPercentage;
        
        console.log(`📊 Progress: ${processed}/${total} (${percentage}%) - Success: ${progress.successfulPullRequests}, Failed: ${progress.failedPullRequests}, Skipped: ${progress.skippedPullRequests}`);
    }

    /**
     * メモリ使用量の表示
     */
    displayMemoryUsage(memoryInfo: MemoryUsageInfo): void {
        console.log(`💾 Current memory usage: RSS=${memoryInfo.rss}MB, Heap=${memoryInfo.heapUsed}/${memoryInfo.heapTotal}MB, External=${memoryInfo.external}MB`);
    }

    /**
     * ガベージコレクション後のメモリ使用量表示
     */
    displayMemoryUsageAfterGC(before: MemoryUsageInfo, after: MemoryUsageInfo): void {
        const rssDiff = after.rss - before.rss;
        const heapDiff = after.heapUsed - before.heapUsed;
        
        console.log(`🗑️ Memory after GC: RSS=${after.rss}MB (Δ${rssDiff}), Heap=${after.heapUsed}MB (Δ${heapDiff})`);
        
        // メモリ使用量が高い場合の警告
        if (after.rss > 4000) { // 4GB以上
            console.warn(`⚠️ High memory usage detected: ${after.rss}MB RSS`);
        }
    }

    /**
     * 処理完了の表示
     */
    displayProcessingComplete(): void {
    console.log('\n✅ Safe batch processing completed successfully.');
    console.log('⏰ Process completed at (JST):', getJSTTimestamp());
    }

    /**
     * 致命的エラーの表示
     */
    displayCriticalError(errorReport: ErrorReport): void {
        console.error('\n💥 CRITICAL ERROR OCCURRED:');
        console.error(`   Repository: ${errorReport.repositoryName}`);
        console.error(`   Category: ${errorReport.category}`);
        console.error(`   Pull Request: ${errorReport.pullRequestTitle}`);
        console.error(`   Error Type: ${errorReport.errorType}`);
        console.error(`   Error Message: ${errorReport.errorMessage}`);
        console.error(`   Processing Phase: ${errorReport.processingPhase}`);
        console.error(`   Timestamp: ${errorReport.timestamp}`);
    }

    /**
     * 最終レポート生成
     */
    async generateFinalReport(
        statistics: ProcessingStatistics, 
        errorReports: ErrorReport[]
    ): Promise<void> {
        try {
            // 統計レポートの生成
            await this.generateStatisticsReport(statistics);
            
            // エラーレポートの生成
            await this.generateErrorReport(errorReports);
            
            // コンソールサマリーの表示
            this.displayFinalSummary(statistics, errorReports);
            
        } catch (error) {
            console.error('❌ Failed to generate final report:', error);
        }
    }

    /**
     * 統計レポートの生成
     */
    private async generateStatisticsReport(statistics: ProcessingStatistics): Promise<void> {
        const endTime = new Date();
        const totalDuration = endTime.getTime() - statistics.startTime.getTime();
        
        const summary = {
            ...statistics,
            // 互換性のため従来のendTime(Date→ISO化)も保持しつつ、JST文字列も追加
            endTime,
            endTimeJST: getJSTTimestamp(),
            startTimeJST: convertUTCtoJST(statistics.startTime.toISOString()),
            totalDuration,
            totalDurationFormatted: this.formatDuration(totalDuration),
            successRate: statistics.totalPullRequests > 0
                ? Math.round((statistics.successfulPullRequests / statistics.totalPullRequests) * 100)
                : 0,
            errorReportPath: this.errorReportFile,
            topErrorTypes: Object.entries(statistics.errorsByType)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([type, count]) => ({ type, count }))
        };

        fs.writeFileSync(this.summaryReportFile, JSON.stringify(summary, null, 2));
        console.log(`📊 Summary report saved to: ${this.summaryReportFile}`);
    }

    /**
     * エラーレポートの生成
     */
    private async generateErrorReport(errorReports: ErrorReport[]): Promise<void> {
        if (errorReports.length > 0) {
            fs.writeFileSync(this.errorReportFile, JSON.stringify(errorReports, null, 2));
            console.log(`❌ Error report saved to: ${this.errorReportFile} (${errorReports.length} errors)`);
        } else {
            // エラーレポートが空でも、統計情報の参照用に空の配列で作成
            fs.writeFileSync(this.errorReportFile, JSON.stringify([], null, 2));
            console.log('✅ No errors to report');
            console.log(`📄 Empty error report created at: ${this.errorReportFile}`);
        }
    }

    /**
     * 最終サマリーの表示
     */
    private displayFinalSummary(statistics: ProcessingStatistics, errorReports: ErrorReport[]): void {
        console.log('\n📊 FINAL PROCESSING SUMMARY');
        console.log('================================');
        console.log(`📦 Total Repositories: ${statistics.totalRepositories}`);
        console.log(`📁 Total Categories: ${statistics.totalCategories}`);
        console.log(`📋 Total Pull Requests: ${statistics.totalPullRequests}`);
        console.log(`✅ Successful: ${statistics.successfulPullRequests}`);
        console.log(`❌ Failed: ${statistics.failedPullRequests}`);
        console.log(`⏭️ Skipped: ${statistics.skippedPullRequests}`);
        console.log(`📈 Success Rate: ${statistics.successRate}%`);
        console.log(`🚨 Total Errors: ${errorReports.length}`);
        
        if (Object.keys(statistics.errorsByType).length > 0) {
            console.log('\n🔍 Error Types:');
            Object.entries(statistics.errorsByType)
                .sort(([, a], [, b]) => b - a)
                .forEach(([type, count]) => {
                    console.log(`   ${type}: ${count}`);
                });
        }
        
        const totalDuration = Date.now() - statistics.startTime.getTime();
        console.log(`⏱️ Total Duration: ${this.formatDuration(totalDuration)}`);
        console.log('================================');
    }

    /**
     * 継続時間のフォーマット
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
     * 出力ディレクトリの確保
     */
    private ensureOutputDirectory(): void {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * エラーレポートの追記（個別エラー用）
     */
    async appendErrorReport(errorReport: ErrorReport): Promise<void> {
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
            console.error('❌ Failed to write error report:', writeError);
        }
    }

    /**
     * リアルタイム統計表示（オプション）
     */
    displayRealtimeStatistics(statistics: ProcessingStatistics): void {
        const processed = statistics.successfulPullRequests + 
                         statistics.failedPullRequests + 
                         statistics.skippedPullRequests;
        
        if (processed > 0 && processed % 10 === 0) { // 10件ごとに表示
            console.log('\n📊 Current Statistics:');
            console.log(`   Processed: ${processed}/${statistics.totalPullRequests}`);
            console.log(`   Success Rate: ${statistics.successRate}%`);
            console.log(`   Errors: ${statistics.failedPullRequests}`);
        }
    }
}
