import path from 'path';
import { DatasetRepository } from '../Repository/DatasetRepository.js';
import { APRLogService } from '../Service/APRLogService.js';
import LLMEvaluationService from '../Service/LLMEvaluationService.js';
import { ProcessingStats } from '../Model/ProcessingStats.js';
import { ConsoleView } from '../View/ConsoleView.js';
import { StatisticsReportView } from '../View/StatisticsReportView.js';
import { HTMLReportController } from './HTMLReportController.js';
import Config from '../Config/config.js';

/**
 * データセット解析のメイン制御を行うControllerクラス
 */
export class DatasetAnalysisController {
    constructor(configPath) {
        // プロジェクトルートから設定ファイルのデフォルトパスを取得
        const projectRoot = '/app';
        const defaultConfigPath = configPath || path.join(projectRoot, 'config', 'config.json');
        
        // Repository層
        this.datasetRepository = new DatasetRepository();
        
        // Service層
        this.aprLogService = new APRLogService();
        this.llmEvaluationService = new LLMEvaluationService();
        
        // View層
        this.consoleView = new ConsoleView();
        this.statisticsReportView = new StatisticsReportView();
        
        // HTMLレポート生成
        this.config = new Config(null, configPath);
        this.htmlReportController = new HTMLReportController(this.config);
        
        // Model
        this.stats = new ProcessingStats();
    }

    /**
     * UTC時刻をJST時刻に変換してYYMMDD_HHmmss形式で返す
     * @returns {string} JST時刻文字列 (YYMMDD_HHmmss 形式)
     */
    getJSTTimestamp() {
        const now = new Date();
        // JST = UTC + 9時間
        const jstOffset = 9 * 60; // 分単位
        const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
        
        // YYMMDD_HHmmss形式に変換
        const year = String(jstTime.getFullYear()).slice(-2);
        const month = String(jstTime.getMonth() + 1).padStart(2, '0');
        const day = String(jstTime.getDate()).padStart(2, '0');
        const hours = String(jstTime.getHours()).padStart(2, '0');
        const minutes = String(jstTime.getMinutes()).padStart(2, '0');
        const seconds = String(jstTime.getSeconds()).padStart(2, '0');
        
        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    }

    /**
     * データセット解析のメイン実行メソッド
     * @param {string} datasetDir - データセットディレクトリのパス
     * @param {string} aprOutputPath - APRログディレクトリのパス
     * @param {Object} options - 実行オプション
     * @param {boolean} options.generateHTMLReport - HTMLレポート生成の有無 (default: true)
     * @param {boolean} options.generateErrorReport - エラーレポート生成の有無 (default: true)
     * @param {boolean} options.generateDetailReports - 詳細レポート生成の有無 (default: false)
     * @param {boolean} options.generateDetailedAnalysis - 詳細分析レポート生成の有無 (default: false)
     * @returns {Promise<Object>} 解析結果の統計情報
     */
    async executeAnalysis(datasetDir, aprOutputPath, options = {}) {
        const {
            generateHTMLReport = true,
            generateErrorReport = true,
            generateDetailReports = false,
            generateDetailedAnalysis = false
        } = options;
        
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
            
            // HTMLレポート生成
            if (generateHTMLReport) {
                const htmlReportResult = await this.generateHTMLReports(generateErrorReport, generateDetailReports, generateDetailedAnalysis);
                this.stats.htmlReportResult = htmlReportResult;
            }
            
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
            const titleDirs = await this.datasetRepository.getPullRequestDirectories(categoryPath);
            
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
            // pullRequestPathからproject、category、pullRequestを抽出
            const relativePath = path.relative(datasetDir, pullRequestPath);
            const pathParts = relativePath.split(path.sep);
            const projectName = pathParts[0];
            const categoryName = pathParts[1];
            const pullRequestName = pathParts[2];
            
            const aprLogRelativePath = this.datasetRepository.buildAPRLogPath(
                projectName, 
                categoryName, 
                pullRequestName
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
        // デバッグ情報
        console.log(`🔧 Debug - entryId: ${entryId}`);
        console.log(`🔧 Debug - aprLogPath: ${aprLogPath}`);
        
        // APRログの存在確認
        const aprLogInfo = await this.aprLogService.checkAPRLogExistence(aprLogPath);
        
        console.log(`🔧 Debug - aprLogInfo:`, JSON.stringify(aprLogInfo, null, 2));
        
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
            // 評価できない理由の詳細分析
            const skipReason = this.analyzeEvaluationSkipReason(finalModsResult, aprLogData);
            
            this.consoleView.showNoFinalModification();
            console.log(`   📋 評価スキップ理由: ${skipReason.reason}`);
            console.log(`   📋 詳細: ${skipReason.details}`);
            
            // 最終修正なしの場合も評価パイプライン完了とみなす（スキップケース）
            this.stats.incrementEvaluationPipelineSuccess();
            
            // スキップ理由を統計に記録
            finalModInfo = {
                evaluationSkipped: true,
                skipReason: skipReason,
                turn: null,
                timestamp: null,
                diffLines: 0,
                affectedFiles: [],
                diff: null
            };
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
            // APRで修正されたファイルのみを対象にするため、
            // 指定されたファイルリストのdiffを生成
            if (!aprDiffFiles || aprDiffFiles.length === 0) {
                console.log('⚠️ APR差分ファイルリストが空のため、Ground Truth Diffを生成できません');
                return null;
            }

            // オリジナルの generateGroundTruthDiff を直接使用
            const { generateGroundTruthDiff } = await import('../GenerateFIleChanged.js');
            const groundTruthDiff = await generateGroundTruthDiff(
                premergePath, 
                mergePath, 
                aprDiffFiles
            );
            
            if (groundTruthDiff && groundTruthDiff.trim()) {
                const diffLines = groundTruthDiff.split('\n').length;
                this.consoleView.showGroundTruthDiffSuccess(diffLines);
                this.consoleView.showGroundTruthDiffInfo(aprDiffFiles.length, aprDiffFiles);
                console.log(`✅ Ground Truth Diff生成成功: ${diffLines}行, ${aprDiffFiles.length}ファイル`);
            } else {
                this.consoleView.showGroundTruthDiffFailure();
                console.log('⚠️ Ground Truth Diffが空または生成失敗');
            }
            
            return groundTruthDiff;
        } catch (error) {
            this.consoleView.showGroundTruthDiffError(error.message);
            console.error('❌ Ground Truth Diff生成エラー:', error);
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
                        turnContent += `\nThought: ${turn.thought}`;
                    }
                    if (turn.plan) {
                        turnContent += `\nPlan: ${turn.plan}`;
                    }
                    if (turn.commentText) {
                        turnContent += `\nComment: ${turn.commentText}`;
                    }
                    return turnContent;
                }).join('\n\n')
            };

            const evaluationResult = await this.llmEvaluationService.evaluateWithTemplate(evaluationContext);

            if (evaluationResult.success) {
                this.consoleView.showPromptGenerated(evaluationResult.result.promptLength || 0);
                this.consoleView.showLLMEvaluationSuccess(evaluationResult.result);
                finalModInfo.llmEvaluation = evaluationResult.result;
                
                // 評価パイプライン成功（ステップ1+2完了）
                this.stats.incrementEvaluationPipelineSuccess();
            } else {
                // 詳細なエラー情報を出力
                console.error('❌ LLM評価失敗の詳細:');
                console.error('  - エラー:', evaluationResult.error);
                console.error('  - 結果:', JSON.stringify(evaluationResult.result, null, 2));
                
                this.consoleView.showLLMEvaluationFailure();
                finalModInfo.llmEvaluation = { error: evaluationResult.error };
                
                // 評価パイプライン失敗
                this.stats.incrementEvaluationPipelineFailure();
            }

        } catch (error) {
            console.error('❌ LLM評価例外の詳細:');
            console.error('  - エラーメッセージ:', error.message);
            console.error('  - スタックトレース:', error.stack);
            
            this.consoleView.showLLMEvaluationError(error.message);
            finalModInfo.llmEvaluation = { error: error.message, templateUsed: false };
            
            // 評価パイプライン失敗
            this.stats.incrementEvaluationPipelineFailure();
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

    /**
     * HTMLレポート生成
     * @param {boolean} generateErrorReport - エラーレポート生成の有無
     * @param {boolean} generateDetailReports - 詳細レポート生成の有無
     * @returns {Promise<Object>} レポート生成結果
     */
    async generateHTMLReports(generateErrorReport = true, generateDetailReports = false, generateDetailedAnalysis = false) {
        console.log('\n🚀 HTMLレポート生成を開始...');
        
        try {
            const reportResults = [];
            
            // 統計レポート生成
            const statsReport = await this.htmlReportController.generateStatisticsReport(this.stats);
            reportResults.push(statsReport);
            
            // エラーレポート生成（エラーがある場合のみ）
            if (generateErrorReport && this.stats.errorEntries.length > 0) {
                const errorReport = await this.htmlReportController.generateErrorReport(this.stats.errorEntries);
                reportResults.push(errorReport);
            }
            
            // 詳細レポート生成（成功したマッチングペアの上位件数）
            if (generateDetailReports && this.stats.matchedPairs.length > 0) {
                const detailCount = Math.min(this.stats.matchedPairs.length, 10); // 最大10件
                console.log(`📝 エントリー詳細レポートを${detailCount}件生成中...`);
                
                for (let i = 0; i < detailCount; i++) {
                    const pair = this.stats.matchedPairs[i];
                    const detailReport = await this.htmlReportController.generateEntryDetailReport(pair);
                    reportResults.push(detailReport);
                }
            }
            
            // 詳細分析レポート生成
            if (generateDetailedAnalysis && this.stats.matchedPairs.length > 0) {
                console.log('🔬 詳細分析レポートを生成中...');
                const detailedAnalysisReport = await this.htmlReportController.generateDetailedAnalysisReport(this.stats);
                reportResults.push(detailedAnalysisReport);
            }
            
            // レポートサマリー生成
            const summaryResult = {
                sessionId: this.generateSessionId(),
                timestamp: this.getJSTTimestamp(),
                reports: reportResults
            };
            
            const summaryPath = await this.htmlReportController.generateReportSummary(summaryResult);
            
            console.log('\n🎉 HTMLレポート生成完了!');
            console.log(`📊 生成されたレポート数: ${reportResults.length}`);
            console.log(`📋 サマリーレポート: ${summaryPath}`);
            console.log(`🔗 ブラウザで開く: file://${summaryPath}`);
            
            return {
                success: true,
                sessionId: summaryResult.sessionId,
                summaryPath,
                reports: reportResults,
                totalReports: reportResults.length
            };
            
        } catch (error) {
            console.error(`❌ HTMLレポート生成エラー: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * セッションID生成
     * @returns {string} ユニークなセッションID
     */
    generateSessionId() {
        const timestamp = this.getJSTTimestamp().replace(/[:.]/g, '-');
        const random = Math.random().toString(36).substring(2, 8);
        return `analysis_${timestamp}_${random}`;
    }

    /**
     * HTMLレポート単体生成（統計のみ）
     * @returns {Promise<Object>} レポート生成結果
     */
    async generateStatisticsHTMLReport() {
        console.log('\n📊 統計HTMLレポートを生成中...');
        
        try {
            const statsReport = await this.htmlReportController.generateStatisticsReport(this.stats);
            
            console.log('✅ 統計HTMLレポート生成完了!');
            console.log(`📊 レポートパス: ${statsReport.htmlPath}`);
            console.log(`🔗 ブラウザで開く: file://${statsReport.htmlPath}`);
            
            return statsReport;
            
        } catch (error) {
            console.error(`❌ 統計HTMLレポート生成エラー: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * エラーHTMLレポート単体生成
     * @returns {Promise<Object>} レポート生成結果
     */
    async generateErrorHTMLReport() {
        if (this.stats.errorEntries.length === 0) {
            console.log('ℹ️ エラーが発生していないため、エラーレポートの生成をスキップします。');
            return {
                success: false,
                reason: 'No errors to report'
            };
        }
        
        console.log('\n❌ エラーHTMLレポートを生成中...');
        
        try {
            const errorReport = await this.htmlReportController.generateErrorReport(this.stats.errorEntries);
            
            console.log('✅ エラーHTMLレポート生成完了!');
            console.log(`📊 レポートパス: ${errorReport.htmlPath}`);
            console.log(`🔗 ブラウザで開く: file://${errorReport.htmlPath}`);
            
            return errorReport;
            
        } catch (error) {
            console.error(`❌ エラーHTMLレポート生成エラー: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 評価スキップ理由の詳細分析
     * @param {Object} finalModsResult - 最終修正抽出結果
     * @param {Object} aprLogData - APRログデータ
     * @returns {Object} スキップ理由の詳細
     */
    analyzeEvaluationSkipReason(finalModsResult, aprLogData) {
        // 基本情報の確認（配列形式とオブジェクト形式の両方に対応）
        const hasInteractionLog = aprLogData.interaction_log && 
                                  ((Array.isArray(aprLogData.interaction_log) && aprLogData.interaction_log.length > 0) ||
                                   (typeof aprLogData.interaction_log === 'object' && Object.keys(aprLogData.interaction_log).length > 0));
        
        // ターン数の確認（配列形式とオブジェクト形式の両方に対応）
        let totalTurns = 0;
        if (hasInteractionLog) {
            if (Array.isArray(aprLogData.interaction_log)) {
                totalTurns = aprLogData.interaction_log.length;
            } else {
                totalTurns = Object.keys(aprLogData.interaction_log).length;
            }
        }
        
        const experimentStatus = aprLogData.experiment_metadata?.status || 'unknown';
        
        // ターン別の修正状況を確認
        let turnsWithModification = 0;
        let turnsWithNullModification = 0;
        let lastTurnHasContent = false;
        let investigationPhase = false;
        
        if (hasInteractionLog) {
            let turns = [];
            
            // 配列形式とオブジェクト形式の両方に対応
            if (Array.isArray(aprLogData.interaction_log)) {
                turns = aprLogData.interaction_log;
            } else {
                const turnKeys = Object.keys(aprLogData.interaction_log).sort((a, b) => parseInt(a) - parseInt(b));
                turns = turnKeys.map(key => aprLogData.interaction_log[key]);
            }
            
            turns.forEach((turn, index) => {
                const parsedContent = turn.parsed_content || turn.llm_response?.parsed_content;
                
                if (parsedContent) {
                    if (parsedContent.modified_diff && parsedContent.modified_diff.trim().length > 0) {
                        turnsWithModification++;
                    } else if (parsedContent.modified_diff === null) {
                        turnsWithNullModification++;
                    }
                    
                    // 最後のターンの詳細分析
                    if (index === turns.length - 1) {
                        lastTurnHasContent = parsedContent.modified_diff && parsedContent.modified_diff.trim().length > 0;
                        // 調査フェーズの判定
                        investigationPhase = parsedContent.reply_required && 
                                           Array.isArray(parsedContent.reply_required) && 
                                           parsedContent.reply_required.length > 0;
                    }
                }
            });
        }
        
        // 理由の判定
        let reason, details;
        
        if (!hasInteractionLog) {
            reason = "NO_INTERACTION_LOG";
            details = "APRログにinteraction_logが存在しません";
        } else if (totalTurns === 0) {
            reason = "EMPTY_INTERACTION_LOG";
            details = "interaction_logが空です";
        } else if (turnsWithModification === 0 && turnsWithNullModification === 0) {
            reason = "NO_MODIFICATION_PROPERTY";
            details = "全てのターンでmodified_diffプロパティが見つかりません";
        } else if (turnsWithModification === 0) {
            if (investigationPhase) {
                reason = "INVESTIGATION_PHASE";
                details = `調査フェーズ中（${totalTurns}ターン、全てmodified_diff=null、reply_requiredあり）`;
            } else {
                reason = "ALL_MODIFICATIONS_NULL";
                details = `全ターンでmodified_diffがnull（${totalTurns}ターン、修正生成なし）`;
            }
        } else if (!lastTurnHasContent) {
            reason = "FINAL_TURN_NO_MODIFICATION";
            details = `最終ターンに修正なし（${turnsWithModification}/${totalTurns}ターンで修正生成、最終ターンは調査継続）`;
        } else {
            reason = "EXTRACTION_LOGIC_ERROR";
            details = `抽出ロジックエラー（修正あり: ${turnsWithModification}、null: ${turnsWithNullModification}）`;
        }
        
        return {
            reason,
            details,
            metadata: {
                totalTurns,
                turnsWithModification,
                turnsWithNullModification,
                lastTurnHasContent,
                investigationPhase,
                experimentStatus,
                hasInteractionLog
            }
        };
    }
}
