/**
 * バッチ処理コントローラー
 * MVCアーキテクチャのController層
 * 処理フローの制御とリクエスト処理を担当
 */

import { BatchProcessingService } from '../Service/BatchProcessingService.js';
import { BatchProcessView } from '../views/BatchProcessView.js';
import { MemoryManagementService } from '../Service/MemoryManagementService.js';
import { 
    ProcessingResult, 
    BatchProcessingOptions, 
    ErrorReport 
} from '../types/BatchProcessTypes.js';
import { getJSTTimestamp } from '../utils/timeUtils.js';

// Node.js型の宣言
declare const process: any;
declare const global: any;

export class BatchProcessController {
    private service: BatchProcessingService;
    private view: BatchProcessView;
    private memoryService: MemoryManagementService;
    private isShuttingDown: boolean = false;

    constructor(options: BatchProcessingOptions = {}) {
        this.service = new BatchProcessingService(options);
        this.view = new BatchProcessView();
        this.memoryService = new MemoryManagementService(options);
        
        // シグナルハンドラーの設定
        this.setupSignalHandlers();
        
        console.log('🎮 BatchProcessController initialized');
        this.memoryService.checkMemoryLimits();
    }

    /**
     * メインのバッチ処理実行
     */
    async runBatchProcessing(datasetDir: string): Promise<void> {
        try {
            // 処理開始の表示
            this.view.displayProcessingStart(datasetDir);

            // データセット構造の検証
            await this.service.validateDataset(datasetDir);

            // リポジトリ一覧取得
            const repositories = await this.service.getRepositories(datasetDir);
            this.view.displayRepositoryCount(repositories.length);

            // 各リポジトリの処理
            for (const repositoryName of repositories) {
                if (this.isShuttingDown) {
                    console.log('🛑 Graceful shutdown requested, stopping processing...');
                    break;
                }

                await this.processRepository(datasetDir, repositoryName);
            }

            // 最終レポート生成
            await this.generateFinalReport();

            this.view.displayProcessingComplete();

        } catch (error) {
            console.error('❌ Critical error in batch processing:', error);
            await this.handleCriticalError(error, datasetDir);
            throw error;
        }
    }

    /**
     * 単一リポジトリの処理
     */
    private async processRepository(datasetDir: string, repositoryName: string): Promise<void> {
        try {
            this.view.displayRepositoryProcessingStart(repositoryName);

            // カテゴリ一覧取得
            const categories = await this.service.getCategories(datasetDir, repositoryName);
            
            for (const category of categories) {
                if (this.isShuttingDown) break;
                
                await this.processCategory(datasetDir, repositoryName, category);
            }

            this.view.displayRepositoryProcessingComplete(repositoryName);

        } catch (error) {
            console.error(`❌ Error processing repository ${repositoryName}:`, error);
            await this.service.recordError(repositoryName, 'N/A', 'N/A', error, 'REPOSITORY_PROCESSING');
        }
    }

    /**
     * 単一カテゴリの処理
     */
    private async processCategory(
        datasetDir: string, 
        repositoryName: string, 
        category: string
    ): Promise<void> {
        try {
            this.view.displayCategoryProcessingStart(repositoryName, category);

            // プルリクエスト一覧取得
            const pullRequests = await this.service.getPullRequests(
                datasetDir, 
                repositoryName, 
                category
            );

            for (const pullRequestTitle of pullRequests) {
                if (this.isShuttingDown) break;

                await this.processPullRequest(
                    datasetDir, 
                    repositoryName, 
                    category, 
                    pullRequestTitle
                );

                // 定期的なメモリ管理
                await this.performMemoryManagement();
            }

            this.view.displayCategoryProcessingComplete(repositoryName, category);

        } catch (error) {
            console.error(`❌ Error processing category ${category}:`, error);
            await this.service.recordError(repositoryName, category, 'N/A', error, 'CATEGORY_PROCESSING');
        }
    }

    /**
     * 単一プルリクエストの処理
     */
    private async processPullRequest(
        datasetDir: string,
        repositoryName: string,
        category: string,
        pullRequestTitle: string
    ): Promise<void> {
        try {
            this.view.displayPullRequestProcessingStart(repositoryName, category, pullRequestTitle);

            // プルリクエスト処理実行
            const result = await this.service.processPullRequest(
                datasetDir,
                repositoryName,
                category,
                pullRequestTitle
            );

            // 結果表示
            this.view.displayPullRequestResult(result);

            // 進捗表示
            const progress = this.service.getProcessingProgress();
            this.view.displayProgress(progress);

        } catch (error) {
            console.error(`❌ Error processing pull request ${pullRequestTitle}:`, error);
            await this.service.recordError(
                repositoryName,
                category,
                pullRequestTitle,
                error,
                'PULLREQUEST_PROCESSING'
            );
        }
    }

    /**
     * 最終レポート生成
     */
    private async generateFinalReport(): Promise<void> {
        try {
            const statistics = this.service.getProcessingStatistics();
            const errorReport = await this.service.getErrorReports();

            await this.view.generateFinalReport(statistics, errorReport);
            
            console.log('📊 Final report generated successfully');
        } catch (error) {
            console.error('❌ Failed to generate final report:', error);
        }
    }

    /**
     * 定期的なメモリ管理
     */
    private async performMemoryManagement(): Promise<void> {
        const shouldRunGC = this.service.shouldPerformMemoryCleanup();
        
        if (shouldRunGC) {
            const memoryInfo = this.service.getMemoryUsage();
            this.view.displayMemoryUsage(memoryInfo);
            
            const afterGC = this.memoryService.performCleanup();
            if (afterGC) {
                this.view.displayMemoryUsageAfterGC(memoryInfo, afterGC);
            }
        }
    }

    /**
     * 致命的エラーの処理
     */
    private async handleCriticalError(error: any, datasetDir: string): Promise<void> {
        try {
            const errorReport: ErrorReport = {
                timestamp: getJSTTimestamp(),
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

            await this.service.recordError('SYSTEM', 'CRITICAL_ERROR', 'BATCH_PROCESSING', errorReport, 'BATCH_INITIALIZATION');
            this.view.displayCriticalError(errorReport);

        } catch (reportError) {
            console.error('❌ Failed to handle critical error:', reportError);
        }
    }

    /**
     * シグナルハンドラーの設定
     */
    private setupSignalHandlers(): void {
        const gracefulShutdown = (signal: string) => {
            if (this.isShuttingDown) {
                console.log('🔴 Force shutdown requested');
                process.exit(1);
            }

            console.log(`🛑 ${signal} received, initiating graceful shutdown...`);
            this.isShuttingDown = true;

            // 一定時間後に強制終了
            setTimeout(() => {
                console.log('⏰ Graceful shutdown timeout, forcing exit');
                process.exit(1);
            }, 30000); // 30秒
        };

        // シグナルハンドラー設定
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // 未処理例外のハンドリング
        process.on('uncaughtException', async (error: any) => {
            console.error('💥 Uncaught Exception:', error);
            await this.handleCriticalError(error, 'unknown');
            gracefulShutdown('uncaughtException');
        });

        process.on('unhandledRejection', async (reason: any, promise: any) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            await this.handleCriticalError(reason, 'unknown');
            gracefulShutdown('unhandledRejection');
        });
    }

    /**
     * シャットダウン処理
     */
    async shutdown(): Promise<void> {
        console.log('🔄 Controller shutdown initiated...');
        
        try {
            // サービスのクリーンアップ
            await this.service.cleanup();
            
            // 最終レポート生成
            await this.generateFinalReport();
            
            console.log('✅ Controller shutdown completed');
        } catch (error) {
            console.error('❌ Error during controller shutdown:', error);
        }
    }
}
