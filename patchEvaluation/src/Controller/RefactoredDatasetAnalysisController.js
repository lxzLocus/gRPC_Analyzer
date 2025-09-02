import path from 'path';
import { DatasetRepository } from '../Repository/DatasetRepository.js';
import { APRLogService } from '../Service/APRLogService.js';
import { LLMEvaluationService } from '../Service/LLMEvaluationService.js';
import { ProcessingStats } from '../Model/ProcessingStats.js';
import { ConsoleView } from '../View/ConsoleView.js';
import { StatisticsReportView } from '../View/StatisticsReportView.js';

// 新しい責任分離されたController群
import { WorkflowController } from './WorkflowController.js';
import { ProjectProcessingController } from './ProjectProcessingController.js';
import { LLMEvaluationController } from './LLMEvaluationController.js';
import { DiffProcessingController } from './DiffProcessingController.js';

/**
 * リファクタリング版 - データセット解析のメイン制御を行うControllerクラス
 * 各専門Controllerに処理を委譲し、ワークフロー制御に専念
 */
export class RefactoredDatasetAnalysisController {
    constructor() {
        // Repository層
        this.datasetRepository = new DatasetRepository();
        
        // Service層
        this.aprLogService = new APRLogService();
        this.llmEvaluationService = new LLMEvaluationService();
        
        // View層
        this.consoleView = new ConsoleView();
        this.statisticsReportView = new StatisticsReportView();
        
        // Model
        this.stats = new ProcessingStats();

        // 専門Controller群の初期化
        this.initializeControllers();
    }

    /**
     * 専門Controller群の初期化
     */
    initializeControllers() {
        // ワークフロー制御
        this.workflowController = new WorkflowController();
        
        // プロジェクト処理
        this.projectController = new ProjectProcessingController(
            this.datasetRepository,
            this.aprLogService,
            this.consoleView,
            this.stats
        );
        
        // LLM評価処理
        this.llmController = new LLMEvaluationController(
            this.llmEvaluationService,
            this.datasetRepository,
            this.consoleView
        );
        
        // Diff処理
        this.diffController = new DiffProcessingController(
            this.datasetRepository,
            this.aprLogService,
            this.consoleView,
            this.stats
        );
    }

    /**
     * データセット解析のメイン実行メソッド
     * @param {string} datasetDir - データセットディレクトリのパス
     * @param {string} aprOutputPath - APRログディレクトリのパス
     * @returns {Promise<Object>} 解析結果の統計情報
     */
    async executeAnalysis(datasetDir, aprOutputPath) {
        this.consoleView.showAnalysisStart(datasetDir, aprOutputPath);

        try {
            // ワークフローベースの実行
            const workflowResult = await this.workflowController.executeWorkflow({
                datasetDir,
                aprOutputPath,
                controllers: {
                    project: this.projectController,
                    llm: this.llmController,
                    diff: this.diffController
                },
                stats: this.stats,
                view: this.consoleView
            });

            if (workflowResult.success) {
                // 統計レポートの表示
                this.statisticsReportView.showStatisticsReport(this.stats);
                
                return {
                    success: true,
                    stats: this.stats,
                    workflow: workflowResult.workflow
                };
            } else {
                throw new Error(`Workflow failed: ${workflowResult.error}`);
            }

        } catch (error) {
            this.consoleView.showAnalysisError(error);
            return {
                success: false,
                error: error.message,
                stats: this.stats
            };
        }
    }

    /**
     * 従来互換性のためのメソッド（デプリケート予定）
     * @deprecated 新しいワークフローベースの実行を使用してください
     */
    async executeLegacyAnalysis(datasetDir, aprOutputPath) {
        console.warn('⚠️ Legacy execution mode - consider migrating to new workflow-based execution');
        
        try {
            // パスの取得
            const projectDirs = await this.datasetRepository.getProjectDirectories(datasetDir);

            // 各プロジェクトの処理
            for (const projectName of projectDirs) {
                const projectResult = await this.projectController.processProject(
                    projectName, 
                    datasetDir, 
                    aprOutputPath
                );

                if (projectResult.success && projectResult.data.categories) {
                    // 成功したプルリクエストの後処理
                    await this.processSuccessfulCategories(projectResult.data.categories);
                }
            }

            // 統計レポートの表示
            this.statisticsReportView.showStatisticsReport(this.stats);
            
            return this.stats;

        } catch (error) {
            this.consoleView.showAnalysisError(error);
            throw error;
        }
    }

    /**
     * 成功したカテゴリの後処理
     * @param {Array} categories - カテゴリ処理結果配列
     */
    async processSuccessfulCategories(categories) {
        for (const category of categories) {
            if (category.success && category.data.pullRequests) {
                await this.processSuccessfulPullRequests(category.data.pullRequests);
            }
        }
    }

    /**
     * 成功したプルリクエストの後処理
     * @param {Array} pullRequests - プルリクエスト処理結果配列
     */
    async processSuccessfulPullRequests(pullRequests) {
        for (const pr of pullRequests) {
            if (pr.success && pr.data.aprResult && pr.data.aprResult.analysis) {
                await this.processSuccessfulAPRAnalysis(pr.data);
            }
        }
    }

    /**
     * 成功したAPR解析の後処理
     * @param {Object} prData - プルリクエストデータ
     */
    async processSuccessfulAPRAnalysis(prData) {
        const { entryId, paths, changedFiles, aprResult } = prData;
        const { logInfo, analysis } = aprResult;

        // Diff処理の実行
        const diffResult = await this.diffController.processSuccessfulAnalysis(
            entryId,
            aprResult.aprLogPath || '',
            logInfo,
            analysis,
            paths,
            changedFiles
        );

        if (diffResult.success && diffResult.data.hasModification) {
            // LLM評価の実行
            const llmResult = await this.llmController.executeLLMEvaluation(
                diffResult.data.finalModInfo,
                paths,
                diffResult.data.aprDiffFiles,
                diffResult.data.groundTruthDiff,
                analysis.aprLogData
            );

            // 結果をfinalModInfoに統合
            diffResult.data.finalModInfo.llmEvaluation = llmResult.result;
        }
    }

    /**
     * 処理統計の取得
     * @returns {Object} 処理統計情報
     */
    getProcessingStats() {
        return {
            stats: this.stats,
            summary: {
                totalEntries: this.stats.totalDatasetEntries,
                aprLogFound: this.stats.aprLogFound,
                aprParseSuccess: this.stats.aprParseSuccess,
                matchedPairs: this.stats.matchedPairs.length,
                unmatchedEntries: this.stats.unmatchedEntries.length,
                errorEntries: this.stats.errorEntries.length
            }
        };
    }

    /**
     * 設定の更新
     * @param {Object} config - 新しい設定
     */
    updateConfiguration(config) {
        if (config.diffStrategy) {
            this.diffController.defaultStrategy = config.diffStrategy;
        }
        
        if (config.llmSettings) {
            this.llmController.updateSettings(config.llmSettings);
        }
        
        if (config.workflowSteps) {
            this.workflowController.updateSteps(config.workflowSteps);
        }
    }

    /**
     * デバッグ情報の取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            controllers: {
                workflow: this.workflowController ? 'initialized' : 'not_initialized',
                project: this.projectController ? 'initialized' : 'not_initialized', 
                llm: this.llmController ? 'initialized' : 'not_initialized',
                diff: this.diffController ? 'initialized' : 'not_initialized'
            },
            services: {
                datasetRepository: this.datasetRepository ? 'initialized' : 'not_initialized',
                aprLogService: this.aprLogService ? 'initialized' : 'not_initialized',
                llmEvaluationService: this.llmEvaluationService ? 'initialized' : 'not_initialized'
            },
            views: {
                console: this.consoleView ? 'initialized' : 'not_initialized',
                statistics: this.statisticsReportView ? 'initialized' : 'not_initialized'
            },
            stats: this.stats ? this.stats.getBasicStats() : 'not_initialized'
        };
    }
}
