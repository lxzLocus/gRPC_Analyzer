/**
 * キャッシュ機能付きDatasetAnalysisController
 * 元のDatasetAnalysisControllerにキャッシュ機能を統合
 * 並列処理対応版
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { CachedDatasetRepository } from '../Repository/CachedDatasetRepository.js';
import { APRLogService } from '../Service/APRLogService.js';
import LLMErrorHandler from '../Service/LLMErrorHandler.js';
import LLMEvaluationService from '../Service/LLMEvaluationService.js';
import { LLMClientController } from '../Controller/LLMClientController.js';
import { TemplateRenderer } from '../Service/TemplateCompiler.js';
import { ProcessingStats } from '../Model/ProcessingStats.js';
import { ConsoleView } from '../View/ConsoleView.js';
import { StatisticsReportView } from '../View/StatisticsReportView.js';
import { HTMLReportController } from './HTMLReportController.js';
import Config from '../Config/config.js';
import pLimit from 'p-limit';

/**
 * キャッシュ機能付きデータセット解析のメイン制御を行うControllerクラス
 * 並列処理対応版
 */
export class CachedDatasetAnalysisController {
    constructor(configPath, cacheEnabled = true, concurrency = null) {
        // プロジェクトルートから設定ファイルのデフォルトパスを取得
        const projectRoot = '/app';
        const defaultConfigPath = configPath || path.join(projectRoot, 'config', 'config.json');
        
        // Repository層（executeAnalysisで再初期化される）
        this.datasetRepository = null;
        
        // Service層
        this.aprLogService = new APRLogService();
        // LLMEvaluationServiceは後でexecuteAnalysisで適切に初期化される
        this.llmEvaluationService = null;
        
        // View層
        this.consoleView = new ConsoleView();
        this.statisticsReportView = new StatisticsReportView();
        
        // HTMLレポート生成
        this.config = new Config(null, configPath);
        this.htmlReportController = new HTMLReportController(this.config);
        
        // Model
        this.stats = new ProcessingStats();
        
        // 共通エラーハンドラー
        this.errorHandler = new LLMErrorHandler();
        
        // キャッシュ設定
        this.cacheEnabled = cacheEnabled;
        
        // 並列処理設定
        // デフォルト: CPU数の2倍（I/O待機が多いため）、最大16並列
        // LLM API呼び出しがボトルネックのため、より多くの並列度が有効
        const defaultConcurrency = Math.min(16, (os.cpus().length || 4) * 2);
        this.concurrency = concurrency || defaultConcurrency;
        
        // プロジェクトレベル: 全プロジェクトを同時に処理（最大concurrency）
        // PRレベル: 各プロジェクト内でも並列処理
        this.projectLimit = pLimit(this.concurrency); // プロジェクトレベルも全並列
        this.prLimit = pLimit(this.concurrency); // プルリクエストレベル
        
        // LLM API呼び出し専用制限（Rate Limit対策）
        // OpenAI APIは通常、同時リクエスト数に制限があるため、少し控えめに設定
        this.llmLimit = pLimit(Math.min(this.concurrency, 10)); // LLM API用（最大10並列）
        
        console.log(`⚡ 並列処理設定: ${this.concurrency}並列 (プロジェクト: ${this.concurrency}, PR: ${this.concurrency}, LLM API: ${Math.min(this.concurrency, 10)})`);
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
     * LLMEvaluationServiceを初期化
     */
    async initializeLLMEvaluationService() {
        try {
            // LLMクライアントの初期化
            const llmClient = LLMClientController.create(this.config);
            await llmClient.waitForInitialization();
            
            // テンプレートレンダラーの初期化
            const templatePath = '/app/prompt/00_evaluationPrompt.txt';
            const templateString = await fs.readFile(templatePath, 'utf-8');
            const templateRenderer = new TemplateRenderer(templateString);
            
            // LLMEvaluationServiceの初期化
            this.llmEvaluationService = new LLMEvaluationService(llmClient, templateRenderer);
            
            console.log('✅ LLMEvaluationService初期化完了');
        } catch (error) {
            console.error('❌ LLMEvaluationService初期化失敗:', error.message);
            throw error;
        }
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
            generateDetailedAnalysis = false,
            useCache = true,
            clearCacheFirst = false
        } = options;
        
        // Repository層を正しいパラメータで再初期化
        this.datasetRepository = new CachedDatasetRepository(datasetDir, aprOutputPath, useCache);
        
        // LLMEvaluationServiceを初期化
        if (!this.llmEvaluationService) {
            await this.initializeLLMEvaluationService();
        }
        
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

            console.log(`📦 ${projectDirs.length}個のプロジェクトを並列処理します`);

            // 事前に全PR数をカウント（並列処理による競合を防ぐ）
            let totalPRCount = 0;
            for (const projectName of projectDirs) {
                const projectPath = path.join(datasetDir, projectName);
                try {
                    const categoryDirs = await this.datasetRepository.getCategoryDirectories(projectPath);
                    for (const category of categoryDirs) {
                        const categoryPath = path.join(projectPath, category);
                        try {
                            const titleDirs = await this.datasetRepository.getPullRequestDirectories(categoryPath);
                            totalPRCount += titleDirs.length;
                        } catch (err) {
                            // カウントは続行
                        }
                    }
                } catch (err) {
                    // カウントは続行
                }
            }
            
            // 事前に総数を設定
            this.stats.totalDatasetEntries = totalPRCount;
            console.log(`📋 合計 ${totalPRCount}個のPRを処理します`);

            // {dataset}/{projectName}/ を並列処理
            await Promise.all(
                projectDirs.map(projectName => 
                    this.projectLimit(() => this.processProject(projectName, datasetDir, aprOutputPath))
                )
            );

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
                const htmlReportResult = await this.generateHTMLReports(generateErrorReport, generateDetailReports, generateDetailedAnalysis, options);
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
            
            // カテゴリも並列処理
            await Promise.all(
                categoryDirs.map(category =>
                    this.processCategory(projectName, category, projectPath, datasetDir, aprOutputPath)
                )
            );
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
            
            console.log(`  📄 ${projectName}/${category}: ${titleDirs.length}個のPRを並列処理`);
            
            // プルリクエストを並列処理
            await Promise.all(
                titleDirs.map(pullRequestTitle => 
                    this.prLimit(() => this.processPullRequest(
                        projectName, 
                        category, 
                        pullRequestTitle, 
                        categoryPath, 
                        datasetDir, 
                        aprOutputPath
                    ))
                )
            );
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
        
        // データセットエントリー数は事前カウント済み（並列処理競合防止）
        
        try {
            // パスの構築と存在確認
            const paths = await this.datasetRepository.getPullRequestPaths(pullRequestPath);
            
            // pullRequestPathをpathsオブジェクトに追加
            paths.pullRequestPath = pullRequestPath;
            
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

            const aprLogFiles = await this.datasetRepository.getAPRLogFiles(aprLogRelativePath);
            if (aprLogFiles.length > 0) {
                // APRログ発見の統計を更新
                this.stats.incrementAprLogFound();
            }
            
            if (aprLogFiles.length === 0) {
                this.stats.addErrorEntry({
                    project: projectName,
                    category: categoryName,
                    pullRequest: pullRequestName,
                    error: `APRログファイルが見つかりません`
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
            const finalModsResult = this.aprLogService.extractFinalModifications(aprLogData);
            
            let finalModInfo = null;
            let groundTruthDiff = null;

            if (finalModsResult.hasModification) {
                finalModInfo = finalModsResult.finalModInfo;
                const aprDiffFiles = finalModsResult.aprDiffFiles;

                this.consoleView.showFinalModification(finalModInfo, aprDiffFiles);

                // Ground Truth Diffの作成（キャッシュ機能適用）
                // APRが修正したファイルリストではなく、実際に変更されたすべてのファイルを使用
                if (paths.premergePath && paths.mergePath && changedFiles && changedFiles.length > 0) {
                    groundTruthDiff = await this.createGroundTruthDiff(
                        paths.premergePath, 
                        paths.mergePath, 
                        changedFiles  // aprDiffFiles → changedFiles に変更
                    );
                }

                /*
                LLM評価の並列実行
                
                LLM_B（4軸評価）とLLM_C（Intent Fulfillment評価）を同時に実行
                Rate Limit対策でllmLimitを使用
                */
                console.log('🚀 LLM評価の並列実行開始 (LLM_B + LLM_C)');
                console.log('   - finalModInfo.diff length:', finalModInfo.diff?.length || 0);
                console.log('   - groundTruthDiff length:', groundTruthDiff?.length || 0);
                
                await Promise.all([
                    // LLM_B: 4軸評価
                    this.llmLimit(() => this.executeLLMEvaluation(
                        finalModInfo,
                        paths,
                        aprDiffFiles,
                        groundTruthDiff,
                        aprLogData
                    )),
                    // LLM_C: Intent Fulfillment評価
                    this.llmLimit(() => this.executeIntentFulfillmentEvaluation(
                        finalModInfo,
                        paths.pullRequestPath,
                        aprLogData
                    ))
                ]);
                
                console.log('✅ LLM評価の並列実行完了');
                console.log('   - llmEvaluation exists:', !!finalModInfo.llmEvaluation);
                console.log('   - intentFulfillmentEvaluation exists:', !!finalModInfo.intentFulfillmentEvaluation);

                // Intent Fulfillment評価結果の表示
                if (finalModInfo.intentFulfillmentEvaluation) {
                    this.consoleView.showIntentFulfillmentResult(finalModInfo.intentFulfillmentEvaluation);
                }
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
                    diff: null  // diffはnullだが、これは正常（修正なしケース）
                };

                /*
                修正なしケースでもIntent Fulfillment評価を実行
                
                エージェントが「修正不要」と判断した場合、その判断が
                コミットメッセージの意図と整合しているかを評価する
                */
                await this.llmLimit(() => this.executeIntentFulfillmentEvaluation(
                    finalModInfo,
                    paths.pullRequestPath,
                    aprLogData
                ));

                // Intent Fulfillment評価結果の表示
                if (finalModInfo.intentFulfillmentEvaluation) {
                    this.consoleView.showIntentFulfillmentResult(finalModInfo.intentFulfillmentEvaluation);
                }
            }

            // 成功した処理の統計に追加
            // APRログの終了ステータスを取得
            const aprStatus = aprLogData.experiment_metadata?.status || null;
            
            this.stats.addMatchedPair({
                datasetEntry: pullRequestKey, // 追加: datasetEntryフィールド
                project: projectName,
                category: categoryName,
                pullRequest: pullRequestName,
                changedFiles,
                aprDiffFiles: finalModsResult.aprDiffFiles || [],
                groundTruthDiff: groundTruthDiff || '',
                aprLogFile: latestLogFile,
                aprLogData: aprLogData,  // APRログデータを追加
                aprStatus: aprStatus,  // APRログの終了ステータスを追加
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
     * @param {string[]} changedFilesList - 変更されたファイルリスト
     * @returns {Promise<string|null>} 作成されたdiff
     */
    async createGroundTruthDiff(premergePath, mergePath, changedFilesList) {
        this.consoleView.showGroundTruthDiffStart(changedFilesList.length);
        
        try {
            // 変更されたファイルのdiffを生成
            if (!changedFilesList || changedFilesList.length === 0) {
                console.log('⚠️ 変更ファイルリストが空のため、Ground Truth Diffを生成できません');
                return null;
            }

            // キャッシュ機能付きの generateGroundTruthDiff を直接使用
            const { generateGroundTruthDiff } = await import('../GenerateFileChanged_Cached.js');
            const groundTruthDiff = await generateGroundTruthDiff(
                premergePath, 
                mergePath, 
                changedFilesList,
                true // useCache = true
            );
            
            if (groundTruthDiff && groundTruthDiff.trim()) {
                const diffLines = groundTruthDiff.split('\n').length;
                this.consoleView.showGroundTruthDiffSuccess(diffLines);
                this.consoleView.showGroundTruthDiffInfo(changedFilesList.length, changedFilesList);
                console.log(`✅ Ground Truth Diff生成成功: ${diffLines}行, ${changedFilesList.length}ファイル`);
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
     * HTMLレポート生成
     * @param {boolean} generateErrorReport - エラーレポート生成の有無
     * @param {boolean} generateDetailReports - 詳細レポート生成の有無
     * @returns {Promise<Object>} HTMLレポート生成結果
     */
    async generateHTMLReports(generateErrorReport, generateDetailReports, generateDetailedAnalysis, reportOptions = {}) {
        try {
            const sessionId = this.getJSTTimestamp();
            const reportResults = [];

            // 統計レポート生成
            const statsResult = await this.htmlReportController.generateStatisticsReport(this.stats, sessionId);
            reportResults.push(statsResult);

            // エラーレポート生成
            if (generateErrorReport && this.stats.errorEntries.length > 0) {
                console.log('🔍 generateHTMLReports - this.stats.errorEntries type:', typeof this.stats.errorEntries);
                console.log('🔍 generateHTMLReports - this.stats.errorEntries isArray:', Array.isArray(this.stats.errorEntries));
                console.log('🔍 generateHTMLReports - this.stats.errorEntries length:', this.stats.errorEntries.length);
                console.log('🔍 generateHTMLReports - this.stats.errorEntries sample:', this.stats.errorEntries[0]);
                
                const errorResult = await this.htmlReportController.generateErrorReport(this.stats.errorEntries, sessionId);
                reportResults.push(errorResult);
            }

            // 詳細レポート生成（最初の数件）
            if (generateDetailReports && this.stats.matchedPairs.length > 0) {
                const maxDetailReports = reportOptions?.maxDetailReports || 10;
                const detailPairs = this.stats.matchedPairs.slice(0, maxDetailReports);
                
                console.log(`📝 詳細レポート生成開始: ${detailPairs.length}件`);
                
                for (const pair of detailPairs) {
                    const detailResult = await this.htmlReportController.generateEntryDetailReport(pair, sessionId);
                    reportResults.push(detailResult);
                }
            }

            // 詳細分析レポート生成
            if (generateDetailedAnalysis && this.stats.matchedPairs.length > 0) {
                console.log('🔬 詳細分析レポートを生成中...');
                const detailedAnalysisReport = await this.htmlReportController.generateDetailedAnalysisReport(this.stats, sessionId);
                reportResults.push(detailedAnalysisReport);
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

            const evaluationResult = await this.executeLLMEvaluationWithRetry(evaluationContext);

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
                
                const errorAnalysis = evaluationResult.result?.errorAnalysis;
                this.consoleView.showLLMEvaluationFailure(errorAnalysis);
                finalModInfo.llmEvaluation = { error: evaluationResult.error };
                
                // 評価パイプライン失敗
                this.stats.incrementEvaluationPipelineFailure();
            }

        } catch (error) {
            console.error('❌ LLM評価例外の詳細:');
            console.error('  - エラーメッセージ:', error.message);
            console.error('  - スタックトレース:', error.stack);
            
            // 標準化エラーからエラー解析を取得
            const errorAnalysis = error.errorAnalysis || this.errorHandler.analyzeLLMError(error);
            this.consoleView.showLLMEvaluationError(error.message, errorAnalysis);
            finalModInfo.llmEvaluation = { error: error.message, templateUsed: false };
            
            // 評価パイプライン失敗
            this.stats.incrementEvaluationPipelineFailure();
        }
    }

    /**
     * Intent Fulfillment評価の実行（LLM_C）
     * コミットメッセージに記載された意図をエージェントが満たしているかを評価
     * @param {Object} finalModInfo - 最終修正情報
     * @param {string} pullRequestPath - PRディレクトリパス
     * @param {Object} aprLogData - APRログデータ
     */
    async executeIntentFulfillmentEvaluation(finalModInfo, pullRequestPath, aprLogData) {
        // コミットメッセージの読み込み
        const commitMessages = await this.datasetRepository.getCommitMessages(pullRequestPath);
        
        if (!commitMessages) {
            // commit_messages.jsonが存在しない場合はスキップ
            finalModInfo.intentFulfillmentEvaluation = { 
                skipped: true,
                reason: "no_commit_messages" 
            };
            return;
        }

        console.log('🎯 Intent Fulfillment評価開始（LLM_C）...');

        try {
            // マージコミットメッセージを取得
            const commitMessage = {
                subject: commitMessages.merge_commit?.subject || '',
                body: commitMessages.merge_commit?.body || ''
            };

            // デバッグ情報の出力
            console.log('📝 コミットメッセージ情報:');
            console.log(`   Subject: "${commitMessage.subject}"`);
            console.log(`   Body length: ${commitMessage.body.length} chars`);
            console.log(`   Body preview: "${commitMessage.body.substring(0, 100)}..."`);

            // エージェントの思考過程を抽出
            // turns配列が空の場合もサポート（調査フェーズ/未完了ケース）
            const agentThoughtProcess = (aprLogData.turns && aprLogData.turns.length > 0)
                ? aprLogData.turns.map(turn => {
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
                : '[No agent interaction recorded]';

            // Intent Fulfillment評価コンテキスト
            const intentContext = {
                commitMessage,
                agentGeneratedDiff: finalModInfo.diff || '',
                agentThoughtProcess,
                agentMadeChanges: finalModInfo.diff && finalModInfo.diff.trim().length > 0
            };

            const intentResult = await this.llmEvaluationService.evaluateIntentFulfillment(intentContext);

            if (intentResult.success) {
                // labelまたはlevelフィールドからIntent Fulfillmentレベルを取得
                const intentLevel = intentResult.result?.label || intentResult.result?.level || 'UNKNOWN';
                console.log(`  ✅ Intent Fulfillment評価成功: レベル=${intentLevel}`);
                
                // スコア情報の表示
                const intentScore = intentResult.result?.score ?? 0.0;
                const scorePercentage = (intentScore * 100).toFixed(0);
                
                if (intentLevel !== 'FULLY_FULFILLED') {
                    console.log(`  ❌ Intent Fulfillment スコア: ${intentScore.toFixed(2)} (${scorePercentage}%)`);
                    if (intentResult.result?.reasoning) {
                        console.log(`     理由: ${intentResult.result.reasoning.substring(0, 200)}${intentResult.result.reasoning.length > 200 ? '...' : ''}`);
                    }
                } else {
                    console.log(`  ✅ Intent Fulfillment スコア: ${intentScore.toFixed(2)} (${scorePercentage}%)`);
                }
                
                finalModInfo.intentFulfillmentEvaluation = intentResult.result;
                
                // 統計カウンターを更新
                if (this.stats && typeof this.stats.incrementIntentFulfillment === 'function') {
                    this.stats.incrementIntentFulfillment(intentLevel);
                }
            } else {
                console.error('  ❌ Intent Fulfillment評価失敗:', intentResult.error);
                finalModInfo.intentFulfillmentEvaluation = { error: intentResult.error };
            }

        } catch (error) {
            console.error('  ❌ Intent Fulfillment評価例外:', error.message);
            finalModInfo.intentFulfillmentEvaluation = { error: error.message };
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

    /**
     * リトライ機能付きのLLM評価実行
     * @param {Object} evaluationContext - 評価コンテキスト
     * @param {number} maxRetries - 最大リトライ回数（デフォルト: 2）
     * @param {number} baseDelayMs - 基本待機時間（デフォルト: 1000ms）
     * @returns {Promise<Object>} 評価結果
     */
    async executeLLMEvaluationWithRetry(evaluationContext, maxRetries = 2, baseDelayMs = 1000) {
        let lastError = null;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 LLM評価実行 (試行 ${attempt + 1}/${maxRetries + 1})`);
                
                const result = await this.llmEvaluationService.evaluateWithTemplate(evaluationContext);
                
                if (result.success) {
                    if (attempt > 0) {
                        console.log(`✅ LLM評価成功 (${attempt + 1}回目で成功)`);
                    }
                    return result;
                }
                
                // 失敗した場合のエラー解析
                const errorAnalysis = result.result?.errorAnalysis;
                if (errorAnalysis && !this.errorHandler.isRetryable(errorAnalysis)) {
                    console.log(`❌ リトライ不可能なエラーのため中断: ${errorAnalysis.type}`);
                    return result;
                }
                
                lastError = result;
                
                // 最後の試行でなければ待機
                if (attempt < maxRetries) {
                    const delayMs = baseDelayMs * Math.pow(2, attempt); // 指数バックオフ
                    console.log(`⏳ ${delayMs}ms 待機してリトライします...`);
                    await this.sleep(delayMs);
                }
                
            } catch (error) {
                console.error(`❌ LLM評価例外 (試行 ${attempt + 1}):`, error.message);
                
                // 共通エラーハンドラーでエラーを解析
                const errorAnalysis = this.errorHandler.analyzeLLMError(error);
                this.errorHandler.logErrorDetails(errorAnalysis);
                
                if (!this.errorHandler.isRetryable(errorAnalysis)) {
                    console.log(`❌ リトライ不可能なエラーのため中断: ${errorAnalysis.type}`);
                    
                    // 標準化エラーを作成してスロー
                    const standardError = this.errorHandler.createStandardError(error, errorAnalysis);
                    throw standardError;
                }
                
                lastError = error;
                
                // 最後の試行でなければ待機
                if (attempt < maxRetries) {
                    const delayMs = baseDelayMs * Math.pow(2, attempt);
                    console.log(`⏳ ${delayMs}ms 待機してリトライします...`);
                    await this.sleep(delayMs);
                } else {
                    // 最後の試行で失敗した場合はエラーをスロー
                    throw error;
                }
            }
        }
        
        // すべての試行が失敗した場合
        if (lastError && lastError.success !== undefined) {
            // LLMEvaluationServiceからの結果の場合
            return lastError;
        } else {
            // 例外の場合
            throw lastError;
        }
    }

    /**
     * 指定された時間だけ待機する
     * @param {number} ms - 待機時間（ミリ秒）
     * @returns {Promise<void>}
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
