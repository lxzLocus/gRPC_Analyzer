/**
 * キャッシュ機能付きDatasetAnalysisController
 * 元のDatasetAnalysisControllerにキャッシュ機能を統合
 */
import path from 'path';
import { CachedDatasetRepository } from '../Repository/CachedDatasetRepository.js';
import { APRLogService } from '../Service/APRLogService.js';
import { LLMEvaluationService } from '../Service/LLMEvaluationService.js';
import { ProcessingStats } from '../Model/ProcessingStats.js';
import { ConsoleView } from '../View/ConsoleView.js';
import { StatisticsReportView } from '../View/StatisticsReportView.js';
import { HTMLReportController } from './HTMLReportController.js';
import Config from '../Config/config.js';

/**
 * キャッシュ機能付きデータセット解析のメイン制御を行うControllerクラス
 */
export class CachedDatasetAnalysisController {
    constructor(configPath, cacheEnabled = true) {
        // プロジェクトルートから設定ファイルのデフォルトパスを取得
        const projectRoot = '/app';
        const defaultConfigPath = configPath || path.join(projectRoot, 'config', 'config.json');
        
        // Repository層（executeAnalysisで再初期化される）
        this.datasetRepository = null;
        
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
        
        // キャッシュ設定
        this.cacheEnabled = cacheEnabled;
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
     * データセット解析のメイン実行メソッド（キャッシュ機能付き）
     * @param {string} datasetDir - データセットディレクトリのパス
     * @param {string} aprOutputPath - APRログディレクトリのパス
     * @param {Object} options - 実行オプション
     * @param {boolean} options.generateHTMLReport - HTMLレポート生成の有無 (default: true)
     * @param {boolean} options.generateErrorReport - エラーレポート生成の有無 (default: true)
     * @param {boolean} options.generateDetailReports - 詳細レポート生成の有無 (default: false)
     * @param {boolean} options.useCache - キャッシュ使用の有無 (default: true)
     * @param {boolean} options.clearCacheFirst - 実行前にキャッシュをクリアするか (default: false)
     * @returns {Promise<Object>} 解析結果の統計情報
     */
    async executeAnalysis(datasetDir, aprOutputPath, options = {}) {
        const {
            generateHTMLReport = true,
            generateErrorReport = true,
            generateDetailReports = false,
            useCache = true,
            clearCacheFirst = false
        } = options;
        
        // Repository層を正しいパラメータで再初期化
        this.datasetRepository = new CachedDatasetRepository(datasetDir, aprOutputPath, useCache);
        
        // 初回キャッシュクリア（オプション）
        if (clearCacheFirst) {
            console.log('🗑️ キャッシュクリアを実行中...');
            await this.datasetRepository.clearDiffCache();
        }
        
        // キャッシュ統計初期化
        const startTime = Date.now();
        
        this.consoleView.showAnalysisStart(datasetDir, aprOutputPath);
        
        // キャッシュ使用状況を表示
        if (useCache) {
            console.log('📈 Diffキャッシュ機能: 有効');
            console.log('   - メモリキャッシュ + ディスクキャッシュ使用');
            console.log('   - キャッシュディレクトリ: /app/cache/diff-cache');
        } else {
            console.log('⚠️ Diffキャッシュ機能: 無効');
        }

        try {
            // パスの取得
            const projectDirs = await this.datasetRepository.getProjectDirectories(datasetDir);

            // {dataset}/{projectName}/ 
            for (const projectName of projectDirs) {
                await this.processProject(projectName, datasetDir, aprOutputPath);
            }

            // 統計レポートの表示
            this.statisticsReportView.showStatisticsReport(this.stats);
            
            // キャッシュ統計表示
            if (useCache) {
                const cacheStats = this.datasetRepository.getCacheStatistics();
                console.log('\n📈 最終キャッシュ統計:');
                console.log(`   ヒット率: ${cacheStats.hitRate}`);
                console.log(`   総ヒット数: ${cacheStats.hits}`);
                console.log(`   総ミス数: ${cacheStats.misses}`);
                console.log(`   メモリキャッシュサイズ: ${cacheStats.memoryCacheSize}`);
                
                const totalTime = (Date.now() - startTime) / 1000;
                console.log(`   総実行時間: ${totalTime.toFixed(2)}秒`);
                
                if (cacheStats.hits > 0) {
                    const hitRate = parseFloat(cacheStats.hitRate.replace('%', ''));
                    if (hitRate > 0) {
                        console.log('   🚀 キャッシュにより処理が高速化されました！');
                    }
                }
            }
            
            // HTMLレポート生成
            if (generateHTMLReport) {
                const htmlReportResult = await this.generateHTMLReports(generateErrorReport, generateDetailReports);
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
            this.stats.addErrorEntry({
                project: projectName,
                category,
                error: `Pull request read error: ${error.message}`
            });
        }
    }

    /**
     * プルリクエストの処理（キャッシュ機能適用）
     * @param {string} projectName - プロジェクト名
     * @param {string} category - カテゴリ名
     * @param {string} pullRequestTitle - プルリクエストタイトル
     * @param {string} categoryPath - カテゴリパス
     * @param {string} datasetDir - データセットディレクトリのパス
     * @param {string} aprOutputPath - APRログディレクトリのパス
     */
    async processPullRequest(projectName, category, pullRequestTitle, categoryPath, datasetDir, aprOutputPath) {
        const pullRequestPath = path.join(categoryPath, pullRequestTitle);
        const pullRequestKey = `${projectName}/${category}/${pullRequestTitle}`;
        
        this.consoleView.showProcessingStart(pullRequestKey);
        
        // データセットエントリー数をインクリメント
        this.stats.incrementTotalEntries();
        
        try {
            // パスの構築と存在確認
            const paths = await this.datasetRepository.getPullRequestPaths(pullRequestPath);
            
            if (!paths.hasValidPaths) {
                this.consoleView.showPathErrors(Boolean(paths.premergePath), Boolean(paths.mergePath));
                return;
            }

            // 変更ファイルの取得（キャッシュ機能適用）
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
            
            console.log(`🔍 APRログパス: ${aprLogRelativePath}`);

            const aprLogFiles = await this.datasetRepository.getAPRLogFiles(aprLogRelativePath);
            console.log(`📄 発見されたAPRログファイル数: ${aprLogFiles.length}`);
            if (aprLogFiles.length > 0) {
                console.log(`📄 発見されたAPRログファイル: ${aprLogFiles.join(', ')}`);
                // APRログ発見の統計を更新
                this.stats.incrementAprLogFound();
            }
            
            if (aprLogFiles.length === 0) {
                console.log(`⚠️ APRログファイルが見つかりません: ${aprLogRelativePath}`);
                this.stats.addErrorEntry({
                    project: projectName,
                    category: categoryName,
                    pullRequest: pullRequestName,
                    error: `APRログファイルが見つかりません: ${aprLogRelativePath}`
                });
                return;
            }

            this.consoleView.showAPRLogsFound(aprLogFiles.length);
            this.consoleView.showAPRParsingStart(pullRequestKey, aprLogFiles.length);

            // 最新のAPRログファイルを処理
            const latestLogFile = aprLogFiles[aprLogFiles.length - 1];
            const logContent = await this.datasetRepository.readLogFile(latestLogFile);

            // APRログをパースして解析データを取得
            const parseResult = await this.aprLogService.parseAPRLog(latestLogFile);
            
            if (!parseResult.success) {
                this.stats.addErrorEntry({
                    project: projectName,
                    category: categoryName,
                    pullRequest: pullRequestName,
                    error: 'APRログの解析に失敗しました'
                });
                return;
            }

            const { aprLogData, diffAnalysis } = parseResult.data;
            this.consoleView.showDiffAnalysisResult(diffAnalysis);

            // APRログ解析成功（ステップ1完了）の統計を更新
            this.stats.incrementAprParseSuccess();

            // 最終修正内容の抽出
            console.log('🔍 extractFinalModifications呼び出し前:');
            console.log('  - aprLogData keys:', Object.keys(aprLogData));
            console.log('  - aprLogData.turns exists:', !!aprLogData.turns);
            console.log('  - aprLogData.turns length:', aprLogData.turns ? aprLogData.turns.length : 'N/A');
            if (aprLogData.turns && aprLogData.turns.length > 0) {
                const firstTurn = aprLogData.turns[0];
                console.log('  - First turn keys:', Object.keys(firstTurn));
                console.log('  - modifiedDiff exists:', !!firstTurn.modifiedDiff);
                console.log('  - modifiedDiff length:', firstTurn.modifiedDiff ? firstTurn.modifiedDiff.length : 'N/A');
            }
            
            const finalModsResult = this.aprLogService.extractFinalModifications(aprLogData);
            
            console.log('🔍 extractFinalModifications結果:');
            console.log('  - hasModification:', finalModsResult.hasModification);
            console.log('  - finalModInfo exists:', !!finalModsResult.finalModInfo);
            
            let finalModInfo = null;
            let groundTruthDiff = null;

            if (finalModsResult.hasModification) {
                finalModInfo = finalModsResult.finalModInfo;
                const aprDiffFiles = finalModsResult.aprDiffFiles;

                this.consoleView.showFinalModification(finalModInfo, aprDiffFiles);

                // Ground Truth Diffの作成（キャッシュ機能適用）
                if (paths.premergePath && paths.mergePath && aprDiffFiles.length > 0) {
                    groundTruthDiff = await this.createGroundTruthDiff(
                        paths.premergePath, 
                        paths.mergePath, 
                        aprDiffFiles
                    );
                }

                // LLM評価の実行
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

            // 成功した処理の統計に追加
            this.stats.addMatchedPair({
                project: projectName,
                category: categoryName,
                pullRequest: pullRequestName,
                changedFiles,
                aprDiffFiles: finalModsResult.aprDiffFiles || [],
                groundTruthDiff: groundTruthDiff || '',
                aprLogFile: latestLogFile,
                aprLogData: aprLogData,  // APRログデータを追加
                finalModification: finalModInfo  // 最終修正情報を追加
            });

        } catch (error) {
            this.consoleView.showProcessingError(pullRequestKey, error.message);
            this.stats.addErrorEntry({
                project: projectName,
                category,
                pullRequest: pullRequestTitle,
                error: error.message
            });
        }
    }

    /**
     * Ground Truth Diffの作成（キャッシュ機能適用）
     * @param {string} premergePath - premergeパス
     * @param {string} mergePath - mergeパス
     * @param {string[]} aprDiffFiles - APR差分ファイルリスト
     * @returns {Promise<string|null>} 作成されたdiff
     */
    async createGroundTruthDiff(premergePath, mergePath, aprDiffFiles) {
        this.consoleView.showGroundTruthDiffStart(aprDiffFiles.length);
        
        try {
            // キャッシュ機能付き統合機能を使用
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
     * HTMLレポート生成
     * @param {boolean} generateErrorReport - エラーレポート生成の有無
     * @param {boolean} generateDetailReports - 詳細レポート生成の有無
     * @returns {Promise<Object>} HTMLレポート生成結果
     */
    async generateHTMLReports(generateErrorReport, generateDetailReports) {
        try {
            const sessionId = this.getJSTTimestamp();
            const reportResults = [];

            // 統計レポート生成
            const statsResult = await this.htmlReportController.generateStatisticsReport(this.stats, sessionId);
            reportResults.push(statsResult);

            // エラーレポート生成
            if (generateErrorReport && this.stats.errorEntries.length > 0) {
                const errorResult = await this.htmlReportController.generateErrorReport(this.stats.errorEntries, sessionId);
                reportResults.push(errorResult);
            }

            // 詳細レポート生成（最初の数件）
            if (generateDetailReports && this.stats.matchedPairs.length > 0) {
                const maxDetailReports = 10;
                const detailPairs = this.stats.matchedPairs.slice(0, maxDetailReports);
                
                for (const pair of detailPairs) {
                    const detailResult = await this.htmlReportController.generateEntryDetailReport(pair, sessionId);
                    reportResults.push(detailResult);
                }
            }

            // サマリーページの生成
            const summaryResult = await this.htmlReportController.generateReportSummary(reportResults);

            return {
                success: true,
                sessionId,
                totalReports: reportResults.length,
                summaryPath: summaryResult.filePath,
                reports: reportResults
            };
        } catch (error) {
            console.error('HTMLレポート生成エラー:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * キャッシュ管理メソッド
     */
    async clearCache() {
        await this.datasetRepository.clearDiffCache();
    }

    async limitCacheSize(maxFiles = 5000) {
        await this.datasetRepository.limitDiffCacheSize(maxFiles);
    }

    getCacheStatistics() {
        return this.datasetRepository.getCacheStatistics();
    }

    setCacheEnabled(enabled) {
        this.cacheEnabled = enabled;
        this.datasetRepository.setCacheEnabled(enabled);
    }

    /**
     * LLM評価の実行
     * @param {Object} finalModInfo - 最終修正情報
     * @param {Object} paths - パス情報
     * @param {string[]} aprDiffFiles - APR差分ファイルリスト
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
     * 評価スキップ理由の詳細分析
     * @param {Object} finalModsResult - 最終修正抽出結果
     * @param {Object} aprLogData - APRログデータ
     * @returns {Object} スキップ理由の詳細
     */
    analyzeEvaluationSkipReason(finalModsResult, aprLogData) {
        console.log('🔍 analyzeEvaluationSkipReason デバッグ:');
        console.log('  - APR metadata status:', aprLogData.experiment_metadata?.status);
        
        // 基本情報の確認（配列形式とオブジェクト形式の両方に対応）
        const hasInteractionLog = aprLogData.interaction_log && 
                                  ((Array.isArray(aprLogData.interaction_log) && aprLogData.interaction_log.length > 0) ||
                                   (typeof aprLogData.interaction_log === 'object' && Object.keys(aprLogData.interaction_log).length > 0));
        
        console.log('  - hasInteractionLog:', hasInteractionLog);
        console.log('  - interaction_log type:', Array.isArray(aprLogData.interaction_log) ? 'Array' : typeof aprLogData.interaction_log);
        
        // ターン数の確認（配列形式とオブジェクト形式の両方に対応）
        let totalTurns = 0;
        if (hasInteractionLog) {
            if (Array.isArray(aprLogData.interaction_log)) {
                totalTurns = aprLogData.interaction_log.length;
            } else {
                totalTurns = Object.keys(aprLogData.interaction_log).length;
            }
        }
        
        console.log('  - totalTurns:', totalTurns);
        
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
            
            console.log('  - 処理するターン数:', turns.length);
            
            turns.forEach((turn, index) => {
                const parsedContent = turn.parsed_content || turn.llm_response?.parsed_content;
                
                console.log(`  - Turn ${index + 1}:`);
                console.log(`    - parsedContent exists:`, !!parsedContent);
                
                if (parsedContent) {
                    console.log(`    - modified_diff exists:`, !!parsedContent.modified_diff);
                    console.log(`    - modified_diff is null:`, parsedContent.modified_diff === null);
                    
                    if (parsedContent.modified_diff && parsedContent.modified_diff.trim().length > 0) {
                        turnsWithModification++;
                        console.log(`    - ✓ 修正あり (length: ${parsedContent.modified_diff.length})`);
                    } else if (parsedContent.modified_diff === null) {
                        turnsWithNullModification++;
                        console.log(`    - ✗ 修正なし (null)`);
                    }
                    
                    // 最後のターンの詳細分析
                    if (index === turns.length - 1) {
                        lastTurnHasContent = parsedContent.modified_diff && parsedContent.modified_diff.trim().length > 0;
                        console.log(`    - 最終ターンに修正あり:`, lastTurnHasContent);
                        // 調査フェーズの判定
                        investigationPhase = parsedContent.reply_required && 
                                           Array.isArray(parsedContent.reply_required) && 
                                           parsedContent.reply_required.length > 0;
                        console.log(`    - 調査フェーズ:`, investigationPhase);
                    }
                }
            });
        }
        
        console.log('  - turnsWithModification:', turnsWithModification);
        console.log('  - turnsWithNullModification:', turnsWithNullModification);
        console.log('  - lastTurnHasContent:', lastTurnHasContent);
        
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
        
        console.log('  - 決定された理由:', reason);
        console.log('  - 詳細:', details);
        
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
