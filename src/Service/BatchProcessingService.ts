/**
 * バッチ処理サービス
 * ビジネスロジックの抽象化とコーディネーション
 */

import { DatasetRepository } from '../Repository/DatasetRepository.js';
import { LLMProcessingService } from './LLMProcessingService.js';
import { ReportService } from './ReportService.js';
import { MemoryManagementService } from './MemoryManagementService.js';
import { 
    ProcessingResult,
    ProcessingStatistics,
    ProcessingProgress,
    ErrorReport,
    BatchProcessingOptions
} from '../types/BatchProcessTypes.js';

export class BatchProcessingService {
    private datasetRepository: DatasetRepository;
    private llmService: LLMProcessingService;
    private reportService: ReportService;
    private memoryService: MemoryManagementService;
    private statistics: ProcessingStatistics;
    private options: BatchProcessingOptions;

    constructor(options: BatchProcessingOptions = {}) {
        this.options = {
            baseOutputDir: '/app/output',
            maxRetries: 3,
            memoryCleanupInterval: 5,
            timeoutMs: 30 * 60 * 1000,
            enableGarbageCollection: true,
            ...options
        };

        this.datasetRepository = new DatasetRepository();
        this.llmService = new LLMProcessingService(this.options);
        this.reportService = new ReportService(this.options.baseOutputDir!);
        this.memoryService = new MemoryManagementService(this.options);

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
    }

    /**
     * データセット構造の検証
     */
    async validateDataset(datasetDir: string) {
        return await this.datasetRepository.validateStructure(datasetDir);
    }

    /**
     * リポジトリ一覧の取得
     */
    async getRepositories(datasetDir: string): Promise<string[]> {
        const repositories = await this.datasetRepository.getRepositoryList(datasetDir);
        this.statistics.totalRepositories = repositories.length;
        return repositories;
    }

    /**
     * カテゴリ一覧の取得
     */
    async getCategories(datasetDir: string, repositoryName: string): Promise<string[]> {
        const categories = await this.datasetRepository.getCategoryList(datasetDir, repositoryName);
        this.statistics.totalCategories += categories.length;
        return categories;
    }

    /**
     * プルリクエスト一覧の取得
     */
    async getPullRequests(
        datasetDir: string, 
        repositoryName: string, 
        category: string
    ): Promise<string[]> {
        const pullRequests = await this.datasetRepository.getPullRequestList(
            datasetDir, 
            repositoryName, 
            category
        );
        this.statistics.totalPullRequests += pullRequests.length;
        return pullRequests;
    }

    /**
     * 単一プルリクエストの処理
     */
    async processPullRequest(
        datasetDir: string,
        repositoryName: string,
        category: string,
        pullRequestTitle: string
    ): Promise<ProcessingResult> {
        const startTime = Date.now();

        try {
            // premergeディレクトリの検索
            const pullRequestPath = await this.datasetRepository.getPullRequestPath(
                datasetDir, repositoryName, category, pullRequestTitle
            );
            
            const premergeDir = await this.datasetRepository.findPremergeDirectory(pullRequestPath);
            if (!premergeDir) {
                const result = this.createFailureResult(
                    repositoryName, category, pullRequestTitle, pullRequestPath, '',
                    'No premerge directory found', 'MissingPremergeDirectory', startTime
                );
                this.updateStatistics('skip');
                return result;
            }

            // LLM処理の実行
            const llmResult = await this.llmService.processWithRetry(
                premergeDir, repositoryName, category, pullRequestTitle
            );

            // 結果の分析
            const isSuccess = await this.llmService.analyzeResult(
                repositoryName, category, pullRequestTitle, llmResult
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
            const result = this.createFailureResult(
                repositoryName, category, pullRequestTitle, '', '',
                error instanceof Error ? error.message : String(error),
                error instanceof Error ? error.constructor.name : 'UnknownError',
                startTime
            );
            this.updateStatistics('failure', result.errorType);
            return result;
        }
    }

    /**
     * エラーの記録
     */
    async recordError(
        repositoryName: string,
        category: string,
        pullRequestTitle: string,
        error: any,
        phase: string
    ): Promise<void> {
        const errorReport: ErrorReport = {
            timestamp: new Date().toISOString(),
            repositoryName,
            category,
            pullRequestTitle,
            pullRequestPath: 'N/A',
            premergeDir: 'N/A',
            errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
            errorMessage: error instanceof Error ? error.message : String(error),
            stackTrace: error instanceof Error ? error.stack || '' : '',
            processingPhase: phase
        };

        await this.reportService.recordError(errorReport);
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
     * エラーレポートの取得
     */
    async getErrorReports(): Promise<ErrorReport[]> {
        return await this.reportService.getErrorReports();
    }

    /**
     * メモリクリーンアップの判定
     */
    shouldPerformMemoryCleanup(): boolean {
        return this.memoryService.shouldCleanup();
    }

    /**
     * メモリ使用量の取得
     */
    getMemoryUsage() {
        return this.memoryService.getMemoryUsage();
    }

    /**
     * 最終レポートの生成
     */
    async generateFinalReport(): Promise<void> {
        await this.reportService.generateFinalReport(this.statistics);
    }

    /**
     * クリーンアップ
     */
    async cleanup(): Promise<void> {
        await this.llmService.cleanup();
        await this.reportService.cleanup();
    }

    // プライベートヘルパーメソッド
    private createFailureResult(
        repositoryName: string,
        category: string,
        pullRequestTitle: string,
        pullRequestPath: string,
        premergeDir: string,
        errorMessage: string,
        errorType: string,
        startTime: number
    ): ProcessingResult {
        return {
            success: false,
            repositoryName,
            category,
            pullRequestTitle,
            pullRequestPath,
            premergeDir,
            processingTime: Date.now() - startTime,
            errorMessage,
            errorType
        };
    }

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
    }

    /**
     * 処理統計の取得
     */
    getProcessingStatistics(): ProcessingStatistics {
        return { ...this.statistics };
    }
}
