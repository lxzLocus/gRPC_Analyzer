/**
 * レポートサービス
 * エラーレポートと統計レポートの生成・管理
 */

import * as fs from 'fs';
import * as path from 'path';
import { DatasetRepository } from '../Repository/DatasetRepository.js';
import { ProcessingStatistics, ErrorReport } from '../types/BatchProcessTypes.js';
import { getJSTFileTimestamp, getJSTTimestamp, convertUTCtoJST } from '../utils/timeUtils.js';

// Node.js型の宣言
declare const process: any;

export class ReportService {
    private datasetRepository: DatasetRepository;
    private outputDir: string;
    private errorReportFile: string;
    private summaryReportFile: string;
    private errorReports: ErrorReport[] = [];

    constructor(outputDir: string = '/app/output') {
        this.datasetRepository = new DatasetRepository();
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
     * エラーレポートの記録
     */
    async recordError(errorReport: ErrorReport): Promise<void> {
        try {
            this.errorReports.push(errorReport);

            // リアルタイムでファイルにも追記
            let existingErrors: ErrorReport[] = [];
            
            if (await this.datasetRepository.fileExists(this.errorReportFile)) {
                const content = await this.datasetRepository.readFile(this.errorReportFile);
                existingErrors = JSON.parse(content);
            }
            
            existingErrors.push(errorReport);
            await this.datasetRepository.writeFile(
                this.errorReportFile, 
                JSON.stringify(existingErrors, null, 2)
            );
            
            console.log(`❌ Error recorded: ${errorReport.pullRequestTitle} (${errorReport.errorType})`);
            console.log(`   Error message: ${errorReport.errorMessage}`);
            console.log(`   Total errors so far: ${existingErrors.length}`);
            
        } catch (writeError) {
            console.error('❌ Failed to write error report:', writeError);
        }
    }

    /**
     * エラーレポートの取得
     */
    async getErrorReports(): Promise<ErrorReport[]> {
        return [...this.errorReports];
    }

    /**
     * 最終レポートの生成
     */
    async generateFinalReport(statistics: ProcessingStatistics): Promise<void> {
        try {
            await this.generateStatisticsReport(statistics);
            await this.generateErrorReportFile();
            this.displayFinalSummary(statistics);
            
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
            // 従来のISO(UTC)も維持しつつ、JST文字列を追加
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

        await this.datasetRepository.writeFile(
            this.summaryReportFile, 
            JSON.stringify(summary, null, 2)
        );
        console.log(`📊 Summary report saved to: ${this.summaryReportFile}`);
    }

    /**
     * エラーレポートファイルの生成
     */
    private async generateErrorReportFile(): Promise<void> {
        if (this.errorReports.length > 0) {
            await this.datasetRepository.writeFile(
                this.errorReportFile, 
                JSON.stringify(this.errorReports, null, 2)
            );
            console.log(`❌ Error report saved to: ${this.errorReportFile} (${this.errorReports.length} errors)`);
        } else {
            console.log('✅ No errors to report');
        }
    }

    /**
     * 最終サマリーの表示
     */
    private displayFinalSummary(statistics: ProcessingStatistics): void {
        console.log('\n📊 FINAL PROCESSING SUMMARY');
        console.log('================================');
        console.log(`📦 Total Repositories: ${statistics.totalRepositories}`);
        console.log(`📁 Total Categories: ${statistics.totalCategories}`);
        console.log(`📋 Total Pull Requests: ${statistics.totalPullRequests}`);
        console.log(`✅ Successful: ${statistics.successfulPullRequests}`);
        console.log(`❌ Failed: ${statistics.failedPullRequests}`);
        console.log(`⏭️ Skipped: ${statistics.skippedPullRequests}`);
        console.log(`📈 Success Rate: ${statistics.successRate}%`);
        console.log(`🚨 Total Errors: ${this.errorReports.length}`);
        
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
        try {
            if (!fs.existsSync(this.outputDir)) {
                fs.mkdirSync(this.outputDir, { recursive: true });
            }
        } catch (error) {
            console.error(`Error creating output directory ${this.outputDir}:`, error);
            throw error;
        }
    }

    /**
     * サービスのクリーンアップ
     */
    async cleanup(): Promise<void> {
        // 最終的なレポートファイルの確保
        try {
            if (this.errorReports.length > 0) {
                await this.generateErrorReportFile();
            }
        } catch (error) {
            console.error('❌ Error during report service cleanup:', error);
        }
    }
}
