import path from 'path';
import { DatasetRepository } from '../Repository/DatasetRepository.js';
import { APRLogService } from '../Service/APRLogService.js';
import { LLMEvaluationService } from '../Service/LLMEvaluationService.js';
import { ProcessingStats } from '../Model/ProcessingStats.js';
import { ConsoleView } from '../View/ConsoleView.js';
import { StatisticsReportView } from '../View/StatisticsReportView.js';

/**
 * データセット解析のメイン制御を行うControllerクラス
 */
export class DatasetAnalysisController {
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
            // パスの取得
            const projectDirs = await this.datasetRepository.getProjectDirectories(datasetDir);

            // {dataset}/{projectName}/ 
            for (const projectName of projectDirs) {
                await this.processProject(projectName, datasetDir, aprOutputPath);
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
     * プロジェクトの処理
     * @param {string} projectName - プロジェクト名
     * @param {string} datasetDir - データセットディレクトリのパス
     * @param {string} aprOutputPath - APRログディレクトリのパス
     */
    async processProject(projectName, datasetDir, aprOutputPath) {
        // `{dataset}/{projectName}/`パスの取得
        const projectPath = path.join(datasetDir, projectName);
        
        try {
            // `{dataset}/{projectName}/{pullrequest or issue}`
            const categoryDirs = await this.datasetRepository.getCategoryDirectories(projectPath);
            
            for (const category of categoryDirs) {
                await this.processCategory(projectName, category, projectPath, datasetDir, aprOutputPath);
            }
        } catch (error) {
            this.consoleView.showCategoryReadError(projectPath, error.message);
            this.stats.addErrorEntry({
                project: projectName,
                error: `Category read error: ${error.message}`
            });
        }
    }

    /**
     * カテゴリの処理
     * @param {string} projectName - プロジェクト名
     * @param {string} category - カテゴリ名
     * @param {string} projectPath - プロジェクトパス
     * @param {string} datasetDir - データセットディレクトリのパス
     * @param {string} aprOutputPath - APRログディレクトリのパス
     */
    async processCategory(projectName, category, projectPath, datasetDir, aprOutputPath) {
        const categoryPath = path.join(projectPath, category);
        
        try {
            // `{dataset}/{projectName}/{pullrequest or issue}/{title}`
            const titleDirs = await this.datasetRepository.getTitleDirectories(categoryPath);
            
            for (const pullRequestTitle of titleDirs) {
                await this.processPullRequest(
                    projectName, 
                    category, 
                    pullRequestTitle, 
                    categoryPath, 
                    datasetDir, 
                    aprOutputPath
                );
            }
        } catch (error) {
            this.consoleView.showCategoryReadError(categoryPath, error.message);
        }
    }

    /**
     * プルリクエストの処理
     * @param {string} projectName - プロジェクト名
     * @param {string} category - カテゴリ名
     * @param {string} pullRequestTitle - プルリクエストタイトル
     * @param {string} categoryPath - カテゴリパス
     * @param {string} datasetDir - データセットディレクトリのパス
     * @param {string} aprOutputPath - APRログディレクトリのパス
     */
    async processPullRequest(projectName, category, pullRequestTitle, categoryPath, datasetDir, aprOutputPath) {
        this.stats.incrementTotalEntries();
        
        const pullRequestPath = path.join(categoryPath, pullRequestTitle);
        const entryId = `${projectName}/${category}/${pullRequestTitle}`;

        this.consoleView.showProcessingEntry(this.stats.totalDatasetEntries, entryId);

        try {
            // パス情報の取得
            const paths = await this.datasetRepository.getPullRequestPaths(pullRequestPath);
            
            if (!paths.hasValidPaths) {
                this.consoleView.showPathErrors(Boolean(paths.premergePath), Boolean(paths.mergePath));
                return;
            }

            // 変更ファイルの取得
            const changedFiles = await this.datasetRepository.getChangedFiles(
                paths.premergePath, 
                paths.mergePath, 
                null // fileExtension
            );

            // APRログの処理
            const aprLogRelativePath = this.datasetRepository.buildAPRLogPath(
                aprOutputPath, 
                datasetDir, 
                pullRequestPath
            );

            await this.processAPRLog(
                entryId, 
                aprLogRelativePath, 
                paths, 
                changedFiles
            );

        } catch (error) {
            this.consoleView.showDiffAnalysisError(error.message);
        }
    }

    /**
     * APRログの処理
     * @param {string} entryId - エントリーID
     * @param {string} aprLogPath - APRログパス
     * @param {Object} paths - premerge/mergeパス情報
     * @param {string[]} changedFiles - 変更ファイルリスト
     */
    async processAPRLog(entryId, aprLogPath, paths, changedFiles) {
        // APRログの存在確認
        const aprLogInfo = await this.aprLogService.checkAPRLogExistence(aprLogPath);
        
        if (!aprLogInfo.exists) {
            this.handleAPRLogNotFound(entryId, aprLogPath, paths, changedFiles, aprLogInfo.error);
            return;
        }

        this.consoleView.showAPRLogFound(aprLogPath, aprLogInfo.logFiles.length);
        this.stats.incrementAprLogFound();

        // APRログの解析
        await this.analyzeAPRLog(entryId, aprLogPath, aprLogInfo, paths, changedFiles);
    }

    /**
     * APRログの解析実行
     * @param {string} entryId - エントリーID
     * @param {string} aprLogPath - APRログパス
     * @param {Object} aprLogInfo - APRログ情報
     * @param {Object} paths - パス情報
     * @param {string[]} changedFiles - 変更ファイルリスト
     */
    async analyzeAPRLog(entryId, aprLogPath, aprLogInfo, paths, changedFiles) {
        this.consoleView.showAPRLogAnalysisStart(entryId, aprLogInfo.logFiles.length);

        try {
            const parseResult = await this.aprLogService.parseAPRLog(aprLogPath);
            
            if (!parseResult.success) {
                this.handleAPRLogParseFailure(entryId, aprLogPath, paths, changedFiles, parseResult.error);
                return;
            }

            this.stats.incrementAprParseSuccess();
            this.consoleView.showAPRLogAnalysisSuccess();

            // 成功した解析の処理
            await this.processSuccessfulAnalysis(
                entryId, 
                aprLogPath, 
                aprLogInfo, 
                parseResult.data, 
                paths, 
                changedFiles
            );

        } catch (error) {
            this.handleAPRLogParseError(entryId, aprLogPath, paths, changedFiles, error.message);
        }
    }

    /**
     * 成功した解析の処理
     * @param {string} entryId - エントリーID
     * @param {string} aprLogPath - APRログパス
     * @param {Object} aprLogInfo - APRログ情報
     * @param {Object} analysisData - 解析データ
     * @param {Object} paths - パス情報
     * @param {string[]} changedFiles - 変更ファイルリスト
     */
    async processSuccessfulAnalysis(entryId, aprLogPath, aprLogInfo, analysisData, paths, changedFiles) {
        const { aprLogData, diffAnalysis } = analysisData;
        
        this.consoleView.showDiffAnalysisResult(diffAnalysis);

        // 最終修正内容の抽出
        const finalModsResult = this.aprLogService.extractFinalModifications(aprLogData);
        
        let finalModInfo = null;
        let groundTruthDiff = null;

        if (finalModsResult.hasModification) {
            finalModInfo = finalModsResult.finalModInfo;
            const aprDiffFiles = finalModsResult.aprDiffFiles;

            this.consoleView.showFinalModification(finalModInfo, aprDiffFiles);

            // Ground Truth Diffの作成
            if (paths.premergePath && paths.mergePath && aprDiffFiles.length > 0) {
                groundTruthDiff = await this.createGroundTruthDiff(
                    paths.premergePath, 
                    paths.mergePath, 
                    aprDiffFiles
                );
            }

            /*
            LLMによる評価の実行

            ここまでにテンプレートに埋め込む変数を用意する

            ground_truth_diff
            agent_generated_diff
            agent_thought_process
            code_context
            */
            await this.executeLLMEvaluation(
                finalModInfo, 
                paths, 
                aprDiffFiles, 
                groundTruthDiff, 
                aprLogData
            );
        } else {
            this.consoleView.showNoFinalModification();
        }

        // 成功したマッチングを記録
        this.recordSuccessfulMatch(
            entryId, 
            aprLogPath, 
            aprLogInfo, 
            paths, 
            changedFiles, 
            finalModsResult.aprDiffFiles, 
            groundTruthDiff, 
            aprLogData, 
            diffAnalysis, 
            finalModInfo
        );
    }

    /**
     * Ground Truth Diffの作成
     * @param {string} premergePath - premergeパス
     * @param {string} mergePath - mergeパス
     * @param {string[]} aprDiffFiles - APR差分ファイルリスト
     * @returns {Promise<string|null>} 作成されたdiff
     */
    async createGroundTruthDiff(premergePath, mergePath, aprDiffFiles) {
        this.consoleView.showGroundTruthDiffStart(aprDiffFiles.length);
        
        try {
            // 新しい統合機能を使用
            const result = await this.datasetRepository.getChangedFilesWithDiff(
                premergePath, 
                mergePath, 
                null // 全ファイル対象
            );
            
            if (result.groundTruthDiff) {
                const diffLines = result.groundTruthDiff.split('\n').length;
                this.consoleView.showGroundTruthDiffSuccess(diffLines);
                this.consoleView.showGroundTruthDiffInfo(result.changedFiles.length, result.changedFiles);
            } else {
                this.consoleView.showGroundTruthDiffFailure();
            }
            
            return result.groundTruthDiff;
        } catch (error) {
            this.consoleView.showGroundTruthDiffError(error.message);
            return null;
        }
    }

    /**
     * Ground Truth Diffの作成（ファイルパス指定版）
     * @param {string} premergePath - premergeパス
     * @param {string} mergePath - mergeパス
     * @param {string[]} specificFiles - 対象ファイルパスリスト
     * @returns {Promise<Object>} { changedFiles, groundTruthDiff }
     */
    async createGroundTruthDiffForFiles(premergePath, mergePath, specificFiles) {
        this.consoleView.showGroundTruthDiffStart(specificFiles.length);
        
        try {
            // 指定されたファイルのみからdiffを生成
            const { generateGroundTruthDiff } = await import('../GenerateFIleChanged.js');
            const groundTruthDiff = await generateGroundTruthDiff(premergePath, mergePath, specificFiles);
            
            const result = {
                changedFiles: specificFiles,
                groundTruthDiff
            };
            
            if (groundTruthDiff) {
                const diffLines = groundTruthDiff.split('\n').length;
                this.consoleView.showGroundTruthDiffSuccess(diffLines);
                this.consoleView.showGroundTruthDiffInfo(specificFiles.length, specificFiles);
            } else {
                this.consoleView.showGroundTruthDiffFailure();
            }
            
            return result;
        } catch (error) {
            this.consoleView.showGroundTruthDiffError(error.message);
            return {
                changedFiles: [],
                groundTruthDiff: ''
            };
        }
    }

    /**
     * LLM評価の実行
     * @param {Object} finalModInfo - 最終修正情報
     * @param {Object} paths - パス情報
     * @param {string[]} aprDiffFiles - APR差分ファイル
     * @param {string} groundTruthDiff - Ground Truth Diff
     * @param {Object} aprLogData - APRログデータ
     */
    async executeLLMEvaluation(finalModInfo, paths, aprDiffFiles, groundTruthDiff, aprLogData) {
        if (!finalModInfo.diff || finalModInfo.diff.trim().length === 0) {
            this.consoleView.showLLMEvaluationSkipped();
            finalModInfo.llmEvaluation = { skipped: "no_modifications" };
            return;
        }

        this.consoleView.showLLMEvaluationStart();

        try {
            const evaluationContext = {
                // パス情報
                premergePath: paths.premergePath,
                mergePath: paths.mergePath,
                
                // Diff情報
                groundTruthDiff,
                agentGeneratedDiff: finalModInfo.diff,
                
                // プロセス情報
                agentThoughtProcess: aprLogData.turns.map(turn => {
                    let turnContent = `Turn ${turn.turnNumber}:`;
                    if (turn.thought) {
                        turnContent += `\n思考: ${turn.thought}`;
                    }
                    if (turn.plan) {
                        turnContent += `\n計画: ${turn.plan}`;
                    }
                    if (turn.commentText) {

                        
                    }
                    return turnContent;
                }).join('\n\n')
            };

            const evaluationResult = await this.llmEvaluationService.evaluateWithTemplate(evaluationContext);

            if (evaluationResult.success) {
                this.consoleView.showPromptGenerated(evaluationResult.result.promptLength || 0);
                this.consoleView.showLLMEvaluationSuccess(evaluationResult.result);
                finalModInfo.llmEvaluation = evaluationResult.result;
            } else {
                this.consoleView.showLLMEvaluationFailure();
                finalModInfo.llmEvaluation = { error: evaluationResult.error };
            }

        } catch (error) {
            this.consoleView.showLLMEvaluationError(error.message);
            finalModInfo.llmEvaluation = { error: error.message, templateUsed: false };
        }
    }

    /**
     * コードコンテキストの生成
     * @param {Object} paths - パス情報
     * @param {string[]} aprDiffFiles - APR差分ファイル
     * @returns {Promise<Object>} コードコンテキスト情報
     */
    async generateCodeContext(paths, aprDiffFiles) {
        const codeContext = {
            fileContents: {},
            premergeFiles: {},
            mergeFiles: {},
            fileSummary: {
                totalFiles: aprDiffFiles.length,
                fileTypes: {},
                totalLines: 0
            }
        };

        try {
            // 影響を受けたファイルのコンテキストを収集
            for (const filePath of aprDiffFiles) {
                try {
                    const premergeFilePath = path.join(paths.premergePath, filePath);
                    const mergeFilePath = path.join(paths.mergePath, filePath);

                    // ファイルの存在確認と内容読み取り
                    const [premergeExists, mergeExists] = await Promise.allSettled([
                        this.datasetRepository.fileExists(premergeFilePath),
                        this.datasetRepository.fileExists(mergeFilePath)
                    ]);

                    if (premergeExists.status === 'fulfilled' && premergeExists.value) {
                        try {
                            const { readFile } = await import('fs/promises');
                            const content = await readFile(premergeFilePath, 'utf8');
                            codeContext.premergeFiles[filePath] = {
                                content: content,
                                lineCount: content.split('\n').length,
                                size: content.length
                            };
                        } catch (error) {
                            codeContext.premergeFiles[filePath] = { error: `読み取りエラー: ${error.message}` };
                        }
                    }

                    if (mergeExists.status === 'fulfilled' && mergeExists.value) {
                        try {
                            const { readFile } = await import('fs/promises');
                            const content = await readFile(mergeFilePath, 'utf8');
                            codeContext.mergeFiles[filePath] = {
                                content: content,
                                lineCount: content.split('\n').length,
                                size: content.length
                            };
                        } catch (error) {
                            codeContext.mergeFiles[filePath] = { error: `読み取りエラー: ${error.message}` };
                        }
                    }

                    // ファイルタイプの統計
                    const fileExt = path.extname(filePath);
                    codeContext.fileSummary.fileTypes[fileExt] = 
                        (codeContext.fileSummary.fileTypes[fileExt] || 0) + 1;

                } catch (error) {
                    console.error(`⚠️ コードコンテキスト生成エラー (${filePath}): ${error.message}`);
                }
            }

            // 統計情報の計算
            codeContext.fileSummary.totalLines = Object.values(codeContext.mergeFiles)
                .reduce((total, file) => total + (file.lineCount || 0), 0);

            return codeContext;

        } catch (error) {
            console.error(`⚠️ コードコンテキスト生成エラー: ${error.message}`);
            return codeContext;
        }
    }

    /**
     * 成功したマッチングの記録
     */
    recordSuccessfulMatch(entryId, aprLogPath, aprLogInfo, paths, changedFiles, aprDiffFiles, groundTruthDiff, aprLogData, diffAnalysis, finalModInfo) {
        const latestLogFile = aprLogInfo.logFiles.sort().pop();
        
        this.stats.addMatchedPair({
            datasetEntry: entryId,
            aprLogPath: aprLogPath,
            logFiles: aprLogInfo.logFiles,
            latestLogFile: latestLogFile,
            premergePath: paths.premergePath,
            mergePath: paths.mergePath,
            changedFiles: changedFiles,
            aprDiffFiles: aprDiffFiles || [],
            groundTruthDiff: groundTruthDiff,
            aprLogData: {
                turns: aprLogData.turns.length,
                totalTokens: aprLogData.totalTokens,
                modifications: aprLogData.modificationHistory.length,
                affectedFiles: diffAnalysis.affectedFiles.length,
                phases: diffAnalysis.progressionAnalysis.phases.length
            },
            finalModification: finalModInfo
        });
    }

    /**
     * APRログ未発見時の処理
     */
    handleAPRLogNotFound(entryId, aprLogPath, paths, changedFiles, error) {
        if (error.includes('アクセスエラー')) {
            this.consoleView.showAPRLogAccessError(aprLogPath, error);
            this.stats.incrementAprLogAccessError();
        } else {
            this.consoleView.showAPRLogNotFound(error);
            this.stats.incrementAprLogNotFound();
        }

        this.stats.addUnmatchedEntry({
            datasetEntry: entryId,
            aprLogPath: aprLogPath,
            premergePath: paths.premergePath,
            mergePath: paths.mergePath,
            changedFiles: changedFiles,
            aprDiffFiles: [],
            reason: error
        });
    }

    /**
     * APRログ解析失敗時の処理
     */
    handleAPRLogParseFailure(entryId, aprLogPath, paths, changedFiles, error) {
        this.stats.incrementAprParseFailure();
        this.consoleView.showAPRLogParseFailure(aprLogPath);
        
        this.stats.addUnmatchedEntry({
            datasetEntry: entryId,
            aprLogPath: aprLogPath,
            premergePath: paths.premergePath,
            mergePath: paths.mergePath,
            changedFiles: changedFiles,
            aprDiffFiles: [],
            reason: 'APRログ解析失敗（空のデータまたは無効な形式）'
        });
    }

    /**
     * APRログ解析エラー時の処理
     */
    handleAPRLogParseError(entryId, aprLogPath, paths, changedFiles, errorMessage) {
        this.stats.incrementAprParseFailure();
        this.consoleView.showAPRLogParseError(entryId, errorMessage);
        
        this.stats.addErrorEntry({
            datasetEntry: entryId,
            aprLogPath: aprLogPath,
            premergePath: paths.premergePath,
            mergePath: paths.mergePath,
            changedFiles: changedFiles,
            aprDiffFiles: [],
            error: `解析エラー: ${errorMessage}`
        });
    }
}
