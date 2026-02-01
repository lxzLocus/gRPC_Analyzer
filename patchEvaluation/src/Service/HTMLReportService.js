/**
 * HTMLレポート生成サービス
 * ログデータを視覚的に分かりやすいHTMLレポートに変換
 */
import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';

export class HTMLReportService {
    constructor(config) {
        this.config = config;
        this.reportsDir = path.join(config.outputDir, 'reports');
        // templatesディレクトリを参照
        const projectRoot = '/app';
        this.templateDir = path.join(projectRoot, 'templates');
        this.assetsDir = path.join(this.reportsDir, 'assets');
        this.outputBaseDir = config.outputDir; // 階層化出力用のベースディレクトリ
        
        // Handlebarsのカスタムヘルパーを登録
        this.setupHandlebarsHelpers();
        
        this.initializeDirectories();
    }

    /**
     * Handlebarsのカスタムヘルパーを設定
     */
    setupHandlebarsHelpers() {
        // 数値フォーマットヘルパー
        Handlebars.registerHelper('formatNumber', function(value) {
            if (typeof value === 'number') {
                return value.toLocaleString('ja-JP');
            }
            return value;
        });

        // パーセンテージ計算ヘルパー
        Handlebars.registerHelper('formatPercent', function(value, total) {
            if (typeof value === 'number' && typeof total === 'number' && total > 0) {
                return ((value / total) * 100).toFixed(2) + '%';
            }
            return '0%';
        });

        // 数値乗算ヘルパー（意味的類似度スコア用）
        Handlebars.registerHelper('multiply', function(value, multiplier) {
            if (typeof value === 'number' && typeof multiplier === 'number') {
                return (value * multiplier).toFixed(1);
            }
            return '0.0';
        });

        // 比較演算ヘルパー
        Handlebars.registerHelper('gte', function(value, threshold, options) {
            if (parseFloat(value) >= parseFloat(threshold)) {
                return options.fn(this);
            } else {
                return options.inverse(this);
            }
        });

        Handlebars.registerHelper('lt', function(value, threshold, options) {
            if (parseFloat(value) < parseFloat(threshold)) {
                return options.fn(this);
            } else {
                return options.inverse(this);
            }
        });

        // 日付フォーマットヘルパー
        Handlebars.registerHelper('formatDate', function(date) {
            if (!date) return '';
            const d = new Date(date);
            return d.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        });

        // 等値比較ヘルパー
        Handlebars.registerHelper('eq', function(a, b) {
            return a === b;
        });

        // より大きい比較ヘルパー
        Handlebars.registerHelper('gt', function(a, b) {
            return a > b;
        });

        // 以上比較ヘルパー
        Handlebars.registerHelper('gte', function(a, b) {
            return a >= b;
        });

        // より小さい比較ヘルパー
        Handlebars.registerHelper('lt', function(a, b) {
            return a < b;
        });

        // 以下比較ヘルパー
        Handlebars.registerHelper('lte', function(a, b) {
            return a <= b;
        });

        // OR条件ヘルパー
        Handlebars.registerHelper('or', function(...args) {
            const options = args.pop();
            return args.some(arg => !!arg);
        });

        // AND条件ヘルパー
        Handlebars.registerHelper('and', function(...args) {
            const options = args.pop();
            return args.every(arg => !!arg);
        });

        // 配列の長さヘルパー
        Handlebars.registerHelper('length', function(array) {
            return Array.isArray(array) ? array.length : 0;
        });

        // 数値フォーマットヘルパー（カンマ区切り）
        Handlebars.registerHelper('formatNumber', function(number) {
            if (typeof number === 'number' && !isNaN(number)) {
                return number.toLocaleString();
            }
            return number || 0;
        });

        // 配列フィルタリングヘルパー
        Handlebars.registerHelper('filter', function(array, property, value) {
            if (!Array.isArray(array)) return [];
            return array.filter(item => item[property] === value);
        });

        // パーセンテージヘルパー
        Handlebars.registerHelper('percentage', function(value, total) {
            if (typeof value === 'number' && typeof total === 'number' && total > 0) {
                return ((value / total) * 100).toFixed(1) + '%';
            }
            return '0%';
        });

        // デバッグ用ヘルパー
        Handlebars.registerHelper('debug', function(value) {
            console.log('Handlebars Debug:', value);
            return '';
        });
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
     * エントリーIDから階層化パスを生成
     * @param {string} entryId - データセットエントリーID (例: "pravega/pullrequest/Issue_3758-_Fix_typo_in_controller_API_call_name")
     * @returns {Object} パス情報 { projectName, type, entryName, outputDir }
     */
    parseEntryPath(entryId) {
        const parts = entryId.split('/');
        if (parts.length >= 3) {
            const projectName = parts[0];
            const type = parts[1]; // "pullrequest" or "issue"
            const entryName = parts.slice(2).join('/');
            const outputDir = path.join(this.outputBaseDir, projectName, type, entryName);
            
            return { projectName, type, entryName, outputDir };
        }
        
        // フォールバック: 従来の構造
        return {
            projectName: 'unknown',
            type: 'unknown', 
            entryName: entryId.replace(/[/\\:*?"<>|]/g, '_'),
            outputDir: this.reportsDir
        };
    }

    /**
     * 必要なディレクトリを初期化
     */
    async initializeDirectories() {
        const directories = [this.reportsDir, this.assetsDir];
        
        for (const dir of directories) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                console.error(`ディレクトリ作成エラー (${dir}): ${error.message}`);
            }
        }
    }

    /**
     * 統計レポート生成（全体評価結果を /output 直下に出力）
     * @param {Object} stats - ProcessingStats オブジェクト
     * @param {string} timestamp - レポート生成時刻
     * @returns {Promise<string>} 生成されたHTMLファイルのパス
     */
    async generateStatisticsReport(stats, timestamp = this.getJSTTimestamp()) {
        const statsData = this.extractStatsData(stats);
        
        // 不足している計算値を追加
        const totalEntries = stats.totalDatasetEntries || 1; // 0除算回避
        const unmatchedRate = ((stats.unmatchedEntries.length / totalEntries) * 100).toFixed(1);
        const errorRate = ((stats.errorEntries.length / totalEntries) * 100).toFixed(1);
        
        // JSONファイルパス
        const jsonFileName = `statistics_data_${timestamp.replace(/[:.]/g, '-')}.json`;
        const jsonDataPath = `./${jsonFileName}`; // 相対パス
        
        const reportData = {
            timestamp,
            stats: statsData,
            averageStats: this.calculateAverageStats(stats), // パフォーマンス統計を追加
            unmatchedRate, // テンプレートで期待される値
            errorRate, // テンプレートで期待される値
            jsonDataPath, // JSONデータへのリンク
            successfulMatches: stats.matchedPairs.slice(0, 10), // 最初の10件を表示
            errorEntries: stats.errorEntries.slice(0, 20), // 最初の20件を表示
            unmatchedEntries: stats.unmatchedEntries.slice(0, 15), // 最初の15件を表示
            // 完全なmatchedPairsデータをJSON出力用に保存
            matchedPairs: stats.matchedPairs,
            // エラーエントリーと未マッチングエントリーの完全版
            allErrorEntries: stats.errorEntries,
            allUnmatchedEntries: stats.unmatchedEntries
        };

        const htmlContent = await this.renderStatisticsTemplate(reportData);
        const fileName = `statistics_report_${timestamp.replace(/[:.]/g, '-')}.html`;
        // 全体評価結果は /output 直下に出力
        const filePath = path.join(this.outputBaseDir, fileName);
        
        // /output ディレクトリが存在することを確認
        await fs.mkdir(this.outputBaseDir, { recursive: true });
        await fs.writeFile(filePath, htmlContent, 'utf-8');
        
        // JSON版も同時に出力（/output 直下）
        const jsonFilePath = path.join(this.outputBaseDir, jsonFileName);
        await fs.writeFile(jsonFilePath, JSON.stringify(reportData, null, 2), 'utf-8');
        
        console.log(`📊 HTMLレポート生成完了: ${filePath}`);
        console.log(`📊 JSONデータ出力完了: ${jsonFilePath}`);
        
        return filePath;
    }

    /**
     * 詳細分析レポート生成（APRシステム分析用）
     * @param {Object} stats - ProcessingStats オブジェクト
     * @param {string} timestamp - レポート生成時刻
     * @returns {Promise<string>} 生成されたHTMLファイルのパス
     */
    async generateDetailedAnalysisReport(stats, timestamp = this.getJSTTimestamp()) {
        const detailedData = this.extractDetailedEvaluationData(stats);
        
        const reportData = {
            timestamp,
            ...detailedData
        };

        const fileName = `detailed_analysis_report_${timestamp.replace(/[:]/g, '').replace(/[T]/g, '_').replace(/[.]/g, '_').substring(0, 15)}.html`;
        const filePath = path.join(this.outputBaseDir, fileName);

        // HTMLレポート生成
        try {
            const html = await this.renderDetailedAnalysisTemplate(reportData);
            await fs.writeFile(filePath, html, 'utf-8');
        } catch (error) {
            console.error('詳細分析レポート生成エラー:', error);
            // フォールバック
            const html = this.getDefaultDetailedAnalysisTemplate(reportData);
            await fs.writeFile(filePath, html, 'utf-8');
        }

        // JSONデータも出力
        const jsonFileName = fileName.replace('.html', '.json');
        const jsonFilePath = path.join(this.outputBaseDir, jsonFileName);
        await fs.writeFile(jsonFilePath, JSON.stringify(reportData, null, 2), 'utf-8');
        
        console.log(`🔬 詳細分析レポート生成完了: ${filePath}`);
        console.log(`📊 詳細分析JSONデータ出力完了: ${jsonFilePath}`);
        
        return filePath;
    }    /**
     * 個別エントリーの詳細レポート生成（階層化されたディレクトリに出力）
     * @param {Object} matchedPair - マッチングペアデータ
     * @param {string} timestamp - レポート生成時刻
     * @returns {Promise<string>} 生成されたHTMLファイルのパス
     */
    async generateEntryDetailReport(matchedPair, timestamp = this.getJSTTimestamp()) {
        const reportData = {
            timestamp,
            entryId: matchedPair.datasetEntry,
            ...matchedPair
        };

        // 階層化パスを取得
        const pathInfo = this.parseEntryPath(matchedPair.datasetEntry);
        
        // 階層化ディレクトリを作成
        await fs.mkdir(pathInfo.outputDir, { recursive: true });

        const htmlContent = await this.renderEntryDetailTemplate(reportData);
        const fileName = `entry_detail_${timestamp.replace(/[:.]/g, '-')}.html`;
        const filePath = path.join(pathInfo.outputDir, fileName);
        
        await fs.writeFile(filePath, htmlContent, 'utf-8');
        
        // JSON版も同時に出力
        const jsonFileName = `entry_data_${timestamp.replace(/[:.]/g, '-')}.json`;
        const jsonFilePath = path.join(pathInfo.outputDir, jsonFileName);
        await fs.writeFile(jsonFilePath, JSON.stringify(reportData, null, 2), 'utf-8');
        
        console.log(`📝 エントリー詳細レポート生成完了: ${filePath}`);
        console.log(`   プロジェクト: ${pathInfo.projectName}`);
        console.log(`   タイプ: ${pathInfo.type}`);
        console.log(`   エントリー: ${pathInfo.entryName}`);
        
        return filePath;
    }

    /**
     * エラーレポートの生成
     * @param {Array} errorEntries - エラーエントリーリスト
     * @param {string} timestamp - レポート生成時刻
     * @returns {Promise<string>} 生成されたHTMLファイルのパス
     */
    async generateErrorReport(errorEntries, timestamp = this.getJSTTimestamp()) {
        // errorEntriesの検証
        if (!Array.isArray(errorEntries)) {
            console.warn('⚠️ HTMLReportService.generateErrorReport - errorEntries is not an array:', typeof errorEntries);
            throw new Error(`Invalid errorEntries: expected array, got ${typeof errorEntries}`);
        }
        
        console.log('🔍 HTMLReportService.generateErrorReport - errorEntries length:', errorEntries.length);
        
        const errorAnalysis = this.analyzeErrors(errorEntries);
        
        const reportData = {
            timestamp,
            totalErrors: errorEntries.length,
            errorsByType: errorAnalysis.byType,
            errorsByFrequency: errorAnalysis.byFrequency,
            recentErrors: errorEntries.slice(0, 50),
            errorAnalysis
        };

        const htmlContent = await this.renderErrorTemplate(reportData);
        const fileName = `error_report_${timestamp.replace(/[:.]/g, '-')}.html`;
        const filePath = path.join(this.reportsDir, fileName);
        
        await fs.writeFile(filePath, htmlContent, 'utf-8');
        
        // JSON版も同時に出力
        const jsonFileName = `error_data_${timestamp.replace(/[:.]/g, '-')}.json`;
        const jsonFilePath = path.join(this.reportsDir, jsonFileName);
        await fs.writeFile(jsonFilePath, JSON.stringify(reportData, null, 2), 'utf-8');
        
        console.log(`❌ エラーレポート生成完了: ${filePath}`);
        
        return filePath;
    }

    /**
     * 統計データの抽出
     * @param {Object} stats - ProcessingStats オブジェクト
     * @returns {Object} HTMLテンプレート用統計データ
     */
    extractStatsData(stats) {
        return {
            totalDatasetEntries: stats.totalDatasetEntries,
            aprLogFound: stats.aprLogFound,
            aprLogNotFound: stats.aprLogNotFound,
            aprLogAccessError: stats.aprLogAccessError,
            aprParseSuccess: stats.aprParseSuccess,
            aprParseFailure: stats.aprParseFailure,
            evaluationPipelineSuccess: stats.evaluationPipelineSuccess,
            evaluationPipelineFailure: stats.evaluationPipelineFailure,
            
            // 成功率計算（文字列を数値に変換）
            aprFoundRate: parseFloat(stats.calculateAprFoundRate()) || 0,
            step1CompletionRate: parseFloat(stats.calculateStep1CompletionRate()) || 0,
            evaluationPipelineSuccessRate: parseFloat(stats.calculateEvaluationPipelineSuccessRate()) || 0,
            parseSuccessFromFound: parseFloat(stats.calculateParseSuccessFromFound()) || 0,
            
            // APR品質指標
            aprQualityGood: stats.aprQualityGood,
            aprQualityBad: stats.aprQualityBad,
            aprQualitySuccessRate: parseFloat(stats.calculateAprQualitySuccessRate()) || 0,
            aprEffectiveFixed: stats.aprEffectiveFixed,
            aprEffectiveUnfixed: stats.aprEffectiveUnfixed,
            aprEffectivenessRate: parseFloat(stats.calculateAprEffectivenessRate()) || 0,
            aprMinimalChanges: stats.aprMinimalChanges,
            aprExcessiveChanges: stats.aprExcessiveChanges,
            aprMinimalChangeRate: parseFloat(stats.calculateAprMinimalChangeRate()) || 0,
            
            // 詳細統計
            matchedPairsCount: stats.matchedPairs.length,
            unmatchedEntriesCount: stats.unmatchedEntries.length,
            errorEntriesCount: stats.errorEntries.length,
            
            // LLMメタデータ統計
            llmStats: this.extractLLMStats(stats),
            
            // LLM評価結果統計
            llmEvaluationResults: this.extractLLMEvaluationResults(stats),
            
            // Intent Fulfillment評価統計
            intentFulfillmentStats: this.extractIntentFulfillmentStats(stats)
        };
    }

    /**
     * Intent Fulfillment評価統計の抽出
     * @param {Object} stats - ProcessingStats オブジェクト
     * @returns {Object} Intent Fulfillment統計
     */
    extractIntentFulfillmentStats(stats) {
        const intentStats = {
            totalEvaluated: 0,
            totalSkipped: 0,
            levelCounts: {
                INTENT_FULFILLED: 0,
                INTENT_PARTIALLY_FULFILLED: 0,
                INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED: 0,
                INTENT_NOT_FULFILLED: 0
            },
            evaluations: []
        };

        stats.matchedPairs.forEach(pair => {
            const intentEval = pair.finalModification?.intentFulfillmentEvaluation;
            if (!intentEval) return;

            const evalEntry = {
                entryId: pair.datasetEntry,
                level: null,
                reasoning: null,
                status: 'unknown'
            };

            if (intentEval.skipped) {
                intentStats.totalSkipped++;
                evalEntry.status = 'skipped';
                evalEntry.reasoning = intentEval.skipped;
            } else if (intentEval.error) {
                intentStats.totalSkipped++;
                evalEntry.status = 'error';
                evalEntry.reasoning = intentEval.error;
            } else if (intentEval.level) {
                intentStats.totalEvaluated++;
                intentStats.levelCounts[intentEval.level] =
                    (intentStats.levelCounts[intentEval.level] || 0) + 1;
                evalEntry.level = intentEval.level;
                evalEntry.reasoning = intentEval.reasoning;
                evalEntry.status = 'evaluated';
            }

            intentStats.evaluations.push(evalEntry);
        });

        return intentStats;
    }

    /**
     * 最終評価カテゴリの正規化
     * @param {string} level - 評価レベル
     * @returns {string|null} CORRECT/PLAUSIBLE/INCORRECT
     */
    normalizeFinalCategory(level) {
        switch (level) {
            case 'CORRECT':
            case 'IDENTICAL':
            case 'SEMANTICALLY_EQUIVALENT':
                return 'CORRECT';
            case 'PLAUSIBLE':
            case 'PLAUSIBLE_BUT_DIFFERENT':
                return 'PLAUSIBLE';
            case 'INCORRECT':
                return 'INCORRECT';
            default:
                return null;
        }
    }

    /**
     * LLMメタデータ統計の抽出
     * @param {Object} stats - ProcessingStats オブジェクト
     * @returns {Object} LLM使用統計
     */
    extractLLMStats(stats) {
        const llmUsage = new Map(); // provider/model -> count
        const llmDetails = new Map(); // provider/model -> details
        let totalInteractions = 0;
        let totalTokens = 0;
        let totalLogEntries = 0; // 処理されたログエントリー総数

        console.log('🔍 LLM統計抽出開始');
        console.log(`📊 matchedPairs数: ${stats.matchedPairs.length}`);

        // matchedPairsからLLMメタデータを収集
        stats.matchedPairs.forEach((pair, index) => {
            const aprLogData = pair.aprLogData;
            totalLogEntries++;
            
            console.log(`📝 [${index + 1}/${stats.matchedPairs.length}] ${pair.datasetEntry}`);
            
            if (aprLogData) {
                // 基本的な統計情報を収集（LLMメタデータがなくても）
                const tokens = aprLogData.totalTokens || 0;
                totalTokens += tokens;
                totalInteractions += aprLogData.turns?.length || 1;
                
                console.log(`   - totalTokens: ${tokens}`);
                console.log(`   - llmMetadata存在: ${aprLogData.llmMetadata ? 'はい' : 'いいえ'}`);
                
                if (aprLogData.llmMetadata) {
                    const { provider, model, config } = aprLogData.llmMetadata;
                    if (provider && model) {
                        const key = `${provider}/${model}`;
                        console.log(`   - LLMモデル: ${key}`);
                        
                        // 使用回数をカウント
                        llmUsage.set(key, (llmUsage.get(key) || 0) + 1);
                        
                        // 詳細情報を記録
                        if (!llmDetails.has(key)) {
                            llmDetails.set(key, {
                                provider,
                                model,
                                config: config || {},
                                firstSeen: aprLogData.llmMetadata.startTime,
                                totalTokens: 0,
                                interactionCount: 0
                            });
                        }
                        
                        const details = llmDetails.get(key);
                        details.interactionCount += 1;
                        details.totalTokens += tokens;
                    }
                } else {
                    // LLMメタデータがない場合、フォールバック情報を生成
                    const fallbackKey = 'unknown/unknown';
                    console.log(`   - フォールバックモデル: ${fallbackKey}`);
                    
                    llmUsage.set(fallbackKey, (llmUsage.get(fallbackKey) || 0) + 1);
                    
                    if (!llmDetails.has(fallbackKey)) {
                        llmDetails.set(fallbackKey, {
                            provider: 'Unknown',
                            model: 'Unknown',
                            firstSeen: null,
                            totalTokens: 0,
                            interactionCount: 0
                        });
                    }
                    
                    const details = llmDetails.get(fallbackKey);
                    details.interactionCount += 1;
                    details.totalTokens += tokens;
                }
            } else {
                console.log('   - aprLogData: なし');
            }
        });

        // 使用されたLLMのリストを生成
        const llmList = Array.from(llmDetails.entries()).map(([key, details]) => ({
            key,
            provider: details.provider,
            model: details.model,
            config: details.config || {},
            usage: llmUsage.get(key),
            totalTokens: details.totalTokens,
            averageTokens: details.interactionCount > 0 ? Math.round(details.totalTokens / details.interactionCount) : 0,
            firstSeen: details.firstSeen ? new Date(details.firstSeen).toLocaleString('ja-JP') : 'N/A'
        })).sort((a, b) => b.usage - a.usage); // 使用回数でソート

        const result = {
            totalLLMTypes: llmList.length,
            totalInteractions,
            totalTokens,
            averageTokensPerInteraction: totalInteractions > 0 ? Math.round(totalTokens / totalInteractions) : 0,
            totalLogEntries,
            llmList
        };

        console.log('📊 LLM統計抽出完了:', JSON.stringify(result, null, 2));
        return result;
    }

    /**
     * パフォーマンス統計の平均値を計算
     * @param {Object} stats - ProcessingStats オブジェクト
     * @returns {Object|null} 平均パフォーマンス統計
     */
    calculateAverageStats(stats) {
        if (!stats.matchedPairs || stats.matchedPairs.length === 0) {
            return null;
        }

        const totals = stats.matchedPairs.reduce((acc, pair) => {
            const aprLogData = pair.aprLogData || {};
            
            // 実際のデータ構造に基づいた計算
            const turns = Array.isArray(aprLogData.turns) ? aprLogData.turns.length : 0;
            const totalTokens = aprLogData.totalTokens || 0;
            
            // finalModificationから修正数を取得
            const modifications = pair.finalModification ? 1 : 0;
            
            // changedFilesから影響ファイル数を取得
            const affectedFiles = Array.isArray(pair.changedFiles) ? pair.changedFiles.length : 0;
            
            return {
                turns: acc.turns + turns,
                tokens: acc.tokens + totalTokens,
                modifications: acc.modifications + modifications,
                affectedFiles: acc.affectedFiles + affectedFiles
            };
        }, { turns: 0, tokens: 0, modifications: 0, affectedFiles: 0 });

        const count = stats.matchedPairs.length;
        
        return {
            turns: count > 0 ? Math.round(totals.turns / count * 10) / 10 : 0, // 小数点第1位まで
            tokens: count > 0 ? Math.round(totals.tokens / count) : 0,
            modifications: count > 0 ? Math.round(totals.modifications / count * 10) / 10 : 0,
            affectedFiles: count > 0 ? Math.round(totals.affectedFiles / count * 10) / 10 : 0
        };
    }

    /**
     * エラー分析
     * @param {Array} errorEntries - エラーエントリーリスト
     * @returns {Object} エラー分析結果
     */
    analyzeErrors(errorEntries) {
        const byType = {};
        const byFrequency = {};
        
        // errorEntriesの検証
        if (!Array.isArray(errorEntries)) {
            console.warn('⚠️ analyzeErrors - errorEntries is not an array:', typeof errorEntries);
            return { byType, byFrequency: [] };
        }
        
        errorEntries.forEach(entry => {
            // entryとentry.errorの検証
            if (!entry || typeof entry.error !== 'string') {
                console.warn('⚠️ analyzeErrors - Invalid entry or error:', entry);
                return;
            }
            
            // エラータイプ別集計
            const errorType = this.categorizeError(entry.error);
            byType[errorType] = (byType[errorType] || 0) + 1;
            
            // エラーメッセージ頻度別集計
            const errorMessage = entry.error.substring(0, 100); // 最初の100文字で集計
            byFrequency[errorMessage] = (byFrequency[errorMessage] || 0) + 1;
        });
        
        return {
            byType,
            byFrequency: Object.entries(byFrequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 20) // 上位20件
        };
    }

    /**
     * 意味的類似度スコアを分類
     * @param {number} score - 0.0-1.0のスコア
     * @returns {string} スコア分類
     */
    categorizeSemanticSimilarityScore(score) {
        if (score === 1.0) return 'perfect';
        if (score >= 0.9) return 'nearPerfect';
        if (score >= 0.7) return 'high';
        if (score >= 0.5) return 'medium';
        if (score >= 0.2) return 'low';
        return 'veryLow';
    }

    /**
     * 意味的類似度統計を処理
     * @param {Object} results - 結果オブジェクト
     * @param {number|null} score - 意味的類似度スコア
     */
    processSemanticSimilarityScore(results, score) {
        if (score !== null && score !== undefined && !isNaN(score)) {
            // スコアの有効性を確認
            const validScore = Math.max(0, Math.min(1, parseFloat(score)));
            
            results.semanticSimilarity.allScores.push(validScore);
            results.semanticSimilarity.totalWithScore++;
            
            // スコア分類別の統計
            const category = this.categorizeSemanticSimilarityScore(validScore);
            results.semanticSimilarity.scoreBreakdown[category]++;
        }
    }

    /**
     * 意味的類似度統計を最終化
     * @param {Object} results - 結果オブジェクト
     */
    finalizeSemanticSimilarityStats(results) {
        const scores = results.semanticSimilarity.allScores;
        if (scores.length > 0) {
            const sum = scores.reduce((acc, score) => acc + score, 0);
            results.semanticSimilarity.averageScore = parseFloat((sum / scores.length).toFixed(3));
        }
    }

    /**
     * エラーの分類
     * @param {string} errorMessage - エラーメッセージ
     * @returns {string} エラーカテゴリ
     */
    categorizeError(errorMessage) {
        // errorMessageの検証
        if (typeof errorMessage !== 'string') {
            console.warn('⚠️ categorizeError - errorMessage is not a string:', typeof errorMessage, errorMessage);
            return 'その他のエラー';
        }
        
        const message = errorMessage.toLowerCase();
        
        if (message.includes('json') || message.includes('parse')) {
            return 'JSON解析エラー';
        } else if (message.includes('file') || message.includes('directory')) {
            return 'ファイル/ディレクトリエラー';
        } else if (message.includes('diff') || message.includes('comparison')) {
            return '差分処理エラー';
        } else if (message.includes('llm') || message.includes('api')) {
            return 'LLM/API エラー';
        } else if (message.includes('permission') || message.includes('access')) {
            return 'アクセス権限エラー';
        } else {
            return 'その他のエラー';
        }
    }

    /**
     * LLM評価結果統計の抽出
     * @param {Object} stats - ProcessingStats オブジェクト
     * @returns {Object} LLM評価結果統計
     */
    extractLLMEvaluationResults(stats) {
        const results = {
            totalEvaluated: 0,
            skippedCount: 0,
            skippedRate: '0.0',
            finalCategories: {
                correctCount: 0,
                plausibleCount: 0,
                incorrectCount: 0,
                totalEvaluated: 0,
                correctRate: '0.0',
                plausibleRate: '0.0',
                incorrectRate: '0.0'
            },
            success: {
                successCount: 0,
                failureCount: 0,
                successRate: '0.0'
            },
            accuracyLevels: {
                IDENTICAL: 0,
                SEMANTICALLY_EQUIVALENT: 0,
                PARTIALLY_CORRECT: 0,
                WRONG_APPROACH: 0,
                NO_MATCH: 0,
                // 旧形式との互換性
                PERFECT_MATCH: 0,
                NEAR_PERFECT: 0,
                HIGH_SIMILARITY: 0,
                PARTIAL_MATCH: 0,
                CORRECT_LOCUS: 0
            },
            axisPass: {
                totalEvaluated: 0,
                decisionSoundnessPass: 0,
                directionalConsistencyPass: 0,
                validityPass: 0,
                decisionSoundnessRate: '0.0',
                directionalConsistencyRate: '0.0',
                validityRate: '0.0'
            },
            repairTypes: {},
            skipDetails: {
                totalSkipped: 0,
                noOpCount: 0,      // APR FINISHED + NO-OP（正常な修正不要判断）
                errorCount: 0,     // APR ERROR（失敗）
                reasonBreakdown: {},
                aprStatusBreakdown: { FINISHED: 0, ERROR: 0, UNKNOWN: 0 },
                detailedBreakdown: []
            }
        };

        stats.matchedPairs.forEach(pair => {
            if (pair.finalModification?.evaluationSkipped || pair.evaluationSkipReason) {
                results.skippedCount++;
                results.skipDetails.totalSkipped++;

                const skipReason = pair.evaluationSkipReason || pair.finalModification?.skipReason?.reason;
                if (skipReason) {
                    if (!results.skipDetails.reasonBreakdown[skipReason]) {
                        results.skipDetails.reasonBreakdown[skipReason] = 0;
                    }
                    results.skipDetails.reasonBreakdown[skipReason]++;

                    // APRステータスを取得してNO-OP vs ERRORを区別
                    const aprStatus = pair.aprStatus || pair.finalModification?.skipReason?.metadata?.experimentStatus || 'UNKNOWN';
                    
                    // APRステータス別カウント
                    if (aprStatus === 'FINISHED') {
                        results.skipDetails.noOpCount++;
                        results.skipDetails.aprStatusBreakdown.FINISHED++;
                    } else if (aprStatus === 'ERROR') {
                        results.skipDetails.errorCount++;
                        results.skipDetails.aprStatusBreakdown.ERROR++;
                    } else {
                        results.skipDetails.aprStatusBreakdown.UNKNOWN++;
                    }
                    
                    results.skipDetails.detailedBreakdown.push({
                        reason: skipReason,
                        datasetEntry: pair.datasetEntry || `${pair.project || 'Unknown'}/${pair.category || 'Unknown'}/${pair.pullRequest || 'Unknown'}`,
                        project: pair.project || this.extractProjectName(pair.datasetEntry),
                        aprStatus: aprStatus,
                        metadata: pair.finalModification?.skipReason?.metadata || null
                    });
                }
                return;
            }

            const evaluation = pair.finalModification?.llmEvaluation || pair.fourAxisEvaluation;
            if (evaluation && !evaluation.error) {
                results.totalEvaluated++;
                results.finalCategories.totalEvaluated++;
                results.axisPass.totalEvaluated++;

                // Final Category - 新形式のラベルにも対応
                const finalCategory = evaluation.final_category || evaluation.overall_assessment;
                if (finalCategory === 'CORRECT' || finalCategory === 'IDENTICAL' || finalCategory === 'SEMANTICALLY_EQUIVALENT') {
                    results.finalCategories.correctCount++;
                } else if (finalCategory === 'PLAUSIBLE' || finalCategory === 'PLAUSIBLE_BUT_DIFFERENT') {
                    results.finalCategories.plausibleCount++;
                } else if (finalCategory === 'INCORRECT') {
                    results.finalCategories.incorrectCount++;
                }

                // Success/Failure
                if (evaluation.is_success === true) results.success.successCount++;
                else if (evaluation.is_success === false) results.success.failureCount++;

                // Accuracy Level - ラベル形式に対応
                const accuracyLabel = typeof evaluation.accuracy === 'object'
                    ? (evaluation.accuracy.label || evaluation.accuracy.level)
                    : evaluation.accuracy;
                if (accuracyLabel) {
                    results.accuracyLevels[accuracyLabel] = (results.accuracyLevels[accuracyLabel] || 0) + 1;
                }

                // Axis pass rates - 新形式（*_score）と旧形式（*.score）の両方に対応
                const decisionScore = evaluation.decision_soundness_score !== undefined 
                    ? evaluation.decision_soundness_score 
                    : (evaluation.decision_soundness?.score ?? (evaluation.decision_soundness?.label === 'SOUND' ? 1.0 : 0));
                const directionalScore = evaluation.directional_consistency_score !== undefined 
                    ? evaluation.directional_consistency_score 
                    : (evaluation.directional_consistency?.score ?? (evaluation.directional_consistency?.label === 'CONSISTENT' ? 1.0 : 0));
                const validityScore = evaluation.validity_score !== undefined 
                    ? evaluation.validity_score 
                    : (evaluation.validity?.score ?? (evaluation.validity?.label === 'VALID' ? 1.0 : 0));

                if (decisionScore === 1.0) results.axisPass.decisionSoundnessPass++;
                if (directionalScore === 1.0) results.axisPass.directionalConsistencyPass++;
                if (validityScore === 1.0) results.axisPass.validityPass++;

                // Repair Types
                if (evaluation.analysis_labels?.repair_types) {
                    evaluation.analysis_labels.repair_types.forEach(type => {
                        results.repairTypes[type] = (results.repairTypes[type] || 0) + 1;
                    });
                }
                return;
            }

            // 旧形式の評価結果
            if (pair.evaluationResult && pair.evaluationResult.result) {
                results.totalEvaluated++;
                results.finalCategories.totalEvaluated++;

                const level = pair.evaluationResult.result;
                if (level === 'IDENTICAL' || level === 'SEMANTICALLY_EQUIVALENT') {
                    results.finalCategories.correctCount++;
                } else if (level === 'PLAUSIBLE_BUT_DIFFERENT') {
                    results.finalCategories.plausibleCount++;
                } else if (level === 'INCORRECT') {
                    results.finalCategories.incorrectCount++;
                }
                return;
            }

            results.skippedCount++;
        });

        const totalDatasetEntries = stats.totalDatasetEntries || 1;
        const totalEvaluated = results.finalCategories.totalEvaluated || 1;

        results.finalCategories.correctRate = ((results.finalCategories.correctCount / totalEvaluated) * 100).toFixed(1);
        results.finalCategories.plausibleRate = ((results.finalCategories.plausibleCount / totalEvaluated) * 100).toFixed(1);
        results.finalCategories.incorrectRate = ((results.finalCategories.incorrectCount / totalEvaluated) * 100).toFixed(1);

        const successTotal = results.success.successCount + results.success.failureCount || 1;
        results.success.successRate = ((results.success.successCount / successTotal) * 100).toFixed(1);

        results.axisPass.decisionSoundnessRate = ((results.axisPass.decisionSoundnessPass / totalEvaluated) * 100).toFixed(1);
        results.axisPass.directionalConsistencyRate = ((results.axisPass.directionalConsistencyPass / totalEvaluated) * 100).toFixed(1);
        results.axisPass.validityRate = ((results.axisPass.validityPass / totalEvaluated) * 100).toFixed(1);

        results.skippedRate = ((results.skippedCount / totalDatasetEntries) * 100).toFixed(1);

        results.finalCategoryStats = [
            { category: 'CORRECT', count: results.finalCategories.correctCount, rate: results.finalCategories.correctRate },
            { category: 'PLAUSIBLE', count: results.finalCategories.plausibleCount, rate: results.finalCategories.plausibleRate },
            { category: 'INCORRECT', count: results.finalCategories.incorrectCount, rate: results.finalCategories.incorrectRate }
        ];

        results.accuracyLevelStats = Object.entries(results.accuracyLevels).map(([level, count]) => ({
            level,
            count,
            rate: ((count / totalEvaluated) * 100).toFixed(1)
        }));

        if (results.skipDetails.totalSkipped > 0) {
            Object.keys(results.skipDetails.reasonBreakdown).forEach(reason => {
                const count = results.skipDetails.reasonBreakdown[reason];
                results.skipDetails.reasonBreakdown[reason] = {
                    count: count,
                    percentage: ((count / results.skipDetails.totalSkipped) * 100).toFixed(1),
                    description: this.getSkipReasonDescription(reason)
                };
            });

            results.skipDetails.sortedReasons = Object.entries(results.skipDetails.reasonBreakdown)
                .map(([reason, data]) => ({ reason, ...data }))
                .sort((a, b) => b.count - a.count);
        }

        results.calculationDetails = {
            totalDatasetEntries: totalDatasetEntries,
            totalEvaluated: totalEvaluated,
            calculations: {
                correctRate: `(${results.finalCategories.correctCount} ÷ ${totalEvaluated}) × 100 = ${results.finalCategories.correctRate}%`,
                plausibleRate: `(${results.finalCategories.plausibleCount} ÷ ${totalEvaluated}) × 100 = ${results.finalCategories.plausibleRate}%`,
                incorrectRate: `(${results.finalCategories.incorrectCount} ÷ ${totalEvaluated}) × 100 = ${results.finalCategories.incorrectRate}%`,
                skippedRate: `(${results.skippedCount} ÷ ${totalDatasetEntries}) × 100 = ${results.skippedRate}%`,
                successRate: `(${results.success.successCount} ÷ ${successTotal}) × 100 = ${results.success.successRate}%`
            }
        };

        results.evaluationBreakdown = this.analyzeEvaluationBreakdown(stats);

        console.log('🔍 LLM評価結果統計:', results);
        return results;
    }

    /**
     * Intent Fulfillment評価統計の抽出
     * @param {Object} stats - ProcessingStats オブジェクト
     * @returns {Object} Intent Fulfillment統計
     */
    extractIntentFulfillmentStats(stats) {
        const intentStats = {
            totalEvaluated: 0,
            totalSkipped: 0,
            levelCounts: {
                INTENT_FULFILLED: 0,
                INTENT_PARTIALLY_FULFILLED: 0,
                INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED: 0,
                INTENT_NOT_FULFILLED: 0
            },
            evaluations: []
        };

        stats.matchedPairs.forEach(pair => {
            const intentEval = pair.finalModification?.intentFulfillmentEvaluation;
            if (!intentEval) return;

            const evalEntry = {
                entryId: pair.datasetEntry,
                project: pair.project,
                category: pair.category,
                pullRequest: pair.pullRequest,
                level: null,
                reasoning: null,
                status: 'unknown'
            };

            if (intentEval.skipped === true) {
                intentStats.totalSkipped++;
                evalEntry.status = 'skipped';
                evalEntry.reasoning = intentEval.reason || 'unknown';
            } else if (intentEval.error) {
                intentStats.totalSkipped++;
                evalEntry.status = 'error';
                evalEntry.reasoning = intentEval.error;
            } else if (intentEval.level) {
                intentStats.totalEvaluated++;
                intentStats.levelCounts[intentEval.level] =
                    (intentStats.levelCounts[intentEval.level] || 0) + 1;
                evalEntry.level = intentEval.level;
                evalEntry.reasoning = intentEval.reasoning;
                evalEntry.status = 'evaluated';
                evalEntry.commitIntentSummary = intentEval.commit_intent_summary;
                evalEntry.agentOutputSummary = intentEval.agent_output_summary;
                evalEntry.alignmentAnalysis = intentEval.alignment_analysis;
            }

            intentStats.evaluations.push(evalEntry);
        });

        // 割合を計算
        if (intentStats.totalEvaluated > 0) {
            intentStats.intentFulfilledRate = ((intentStats.levelCounts.INTENT_FULFILLED / intentStats.totalEvaluated) * 100).toFixed(1);
            intentStats.intentPartiallyFulfilledRate = ((intentStats.levelCounts.INTENT_PARTIALLY_FULFILLED / intentStats.totalEvaluated) * 100).toFixed(1);
            intentStats.intentAcknowledgedButNotFulfilledRate = ((intentStats.levelCounts.INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED / intentStats.totalEvaluated) * 100).toFixed(1);
            intentStats.intentNotFulfilledRate = ((intentStats.levelCounts.INTENT_NOT_FULFILLED / intentStats.totalEvaluated) * 100).toFixed(1);
        }

        return intentStats;
    }

    /**
     * 詳細評価データの抽出（APRシステムの分析用）
     * @param {Object} stats - ProcessingStats オブジェクト
     * @returns {Object} 詳細評価データ
     */
    extractDetailedEvaluationData(stats) {
        console.log('🔍 詳細評価データの抽出開始');
        
        if (!stats.matchedPairs || stats.matchedPairs.length === 0) {
            console.log('⚠️ matchedPairsが空またはundefinedです');
            return {
                finalCategoryLevels: {
                    CORRECT: [],
                    PLAUSIBLE: [],
                    INCORRECT: [],
                    SKIPPED: []
                },
                summary: {
                    totalProcessed: 0,
                    avgModifiedLines: 0,
                    avgModifiedFiles: 0,
                    mostCommonProjects: [],
                    modificationPatterns: {}
                }
            };
        }
        
        const detailedData = {
            // 全マッチングペアデータ（HTMLレポート生成用）
            matched_pairs: [],
            // 最終カテゴリ別の詳細データ
            finalCategoryLevels: {
                CORRECT: [],
                PLAUSIBLE: [],
                INCORRECT: [],
                SKIPPED: []
            },
            // 統計サマリー
            summary: {
                totalProcessed: 0,
                avgModifiedLines: 0,
                avgModifiedFiles: 0,
                mostCommonProjects: [],
                modificationPatterns: {}
            }
        };

        // matchedPairsから詳細データを抽出
        console.log(`📋 ${stats.matchedPairs.length}件のmatchedPairsを処理中...`);
        stats.matchedPairs.forEach((pair, index) => {
            // デバッグ: pair構造を詳細確認
            console.log(`🔍 [${index}] Processing pair: ${pair.datasetEntry || pair.pullRequest}`);
            console.log(`   - finalModification exists: ${!!pair.finalModification}`);
            if (pair.finalModification) {
                console.log(`   - finalModification keys: ${Object.keys(pair.finalModification).join(', ')}`);
                console.log(`   - llmEvaluation exists: ${!!pair.finalModification.llmEvaluation}`);
                console.log(`   - llmEvaluation type: ${typeof pair.finalModification.llmEvaluation}`);
            }
            
            // evaluationSkippedフラグまたはevaluationSkipReasonがあればスキップケース
            if (pair.finalModification?.evaluationSkipped || pair.evaluationSkipReason) {
                // スキップされたケース
                console.log(`   -> SKIPPED (evaluationSkipped or evaluationSkipReason)`);
                const skipData = this.extractPairDetails(pair, 'SKIPPED');
                detailedData.matched_pairs.push(skipData);
                detailedData.finalCategoryLevels.SKIPPED.push(skipData);
                return;
            }

            // 評価結果の取得（新しい4軸構造と古い構造の両方に対応）
            let evaluation = null;
            let correctnessLevel = null;
            let accuracyScore = null;
            
            if (pair.finalModification && pair.finalModification.llmEvaluation) {
                console.log(`   -> Found llmEvaluation in finalModification`);
                evaluation = pair.finalModification.llmEvaluation;
                console.log(`   - llmEvaluation keys: ${Object.keys(evaluation).join(', ')}`);
                console.log(`   - evaluation.accuracy: ${evaluation.accuracy}`);
                console.log(`   - evaluation.error: ${evaluation.error}`);
                console.log(`   - evaluation.skipped: ${evaluation.skipped}`);
                if (evaluation.error) {
                    console.log(`   -> Has error: ${evaluation.error}`);
                    const errorData = this.extractPairDetails(pair, 'ERROR');
                    detailedData.matched_pairs.push(errorData);
                    detailedData.finalCategoryLevels.SKIPPED.push(errorData);
                    return;
                }
                
                // 4軸評価データをpairに追加（extractPairDetailsで使用できるように）
                if (evaluation.accuracy !== undefined) {
                    console.log(`   -> Building fourAxisEvaluation`);
                    correctnessLevel = evaluation.final_category || evaluation.overall_assessment || null;
                    // 4軸評価データを構築
                    pair.fourAxisEvaluation = {
                        accuracy: evaluation.accuracy,
                        decision_soundness: evaluation.decision_soundness,
                        directional_consistency: evaluation.directional_consistency,
                        validity: evaluation.validity,
                        analysis_labels: evaluation.analysis_labels,
                        overall_assessment: evaluation.overall_assessment
                    };
                    pair.finalCategory = correctnessLevel;
                }
                // 古い2軸評価
                else if (evaluation.correctness_evaluation) {
                    correctnessLevel = evaluation.correctness_evaluation.semantic_equivalence_level;
                }
            } else if (pair.evaluationResult) {
                // 新しい構造
                console.log(`   -> Found evaluationResult`);
                correctnessLevel = pair.evaluationResult.result;
            } else if (pair.finalModification && pair.finalModification.llmEvaluation === undefined) {
                // llmEvaluationが存在しないケース（修正なし/スキップケース）
                // これは正常な状態なのでSKIPPEDとして扱う
                console.log(`   -> SKIPPED (finalModification exists but llmEvaluation is undefined)`);
                const skipData = this.extractPairDetails(pair, 'SKIPPED');
                detailedData.matched_pairs.push(skipData);
                detailedData.finalCategoryLevels.SKIPPED.push(skipData);
                return;
            } else {
                // 評価結果なし（エラーケース）
                console.log(`   -> ERROR (no evaluation result found)`);
                console.log(`   - pair.finalModification: ${!!pair.finalModification}`);
                console.log(`   - pair.evaluationResult: ${!!pair.evaluationResult}`);
                const errorData = this.extractPairDetails(pair, 'ERROR');
                detailedData.matched_pairs.push(errorData);
                detailedData.finalCategoryLevels.SKIPPED.push(errorData);
                return;
            }

            const pairDetails = this.extractPairDetails(pair, 'EVALUATED');
            detailedData.matched_pairs.push(pairDetails);

            // 最終カテゴリによる分類
            if (correctnessLevel) {
                const normalizedCategory = this.normalizeFinalCategory(correctnessLevel);
                switch (normalizedCategory) {
                    case 'CORRECT':
                        detailedData.finalCategoryLevels.CORRECT.push({...pairDetails, finalCategory: 'CORRECT'});
                        break;
                    case 'PLAUSIBLE':
                        detailedData.finalCategoryLevels.PLAUSIBLE.push({...pairDetails, finalCategory: 'PLAUSIBLE'});
                        break;
                    case 'INCORRECT':
                        detailedData.finalCategoryLevels.INCORRECT.push({...pairDetails, finalCategory: 'INCORRECT'});
                        break;
                    default:
                        console.log(`⚠️ 不明な最終カテゴリ: ${correctnessLevel}`);
                        detailedData.finalCategoryLevels.SKIPPED.push({...pairDetails, finalCategory: correctnessLevel});
                }
            } else {
                // correctnessLevelがnullの場合もSKIPPEDとして分類（4軸評価未実施ケース）
                console.log(`⚠️ correctnessLevel未設定のため SKIPPED として分類: ${pair.datasetEntry || 'unknown'}`);
                detailedData.finalCategoryLevels.SKIPPED.push({...pairDetails, finalCategory: 'SKIPPED'});
            }
        });

        // 統計サマリーの計算
        detailedData.summary = this.calculateDetailedSummary(detailedData);

        console.log('📊 詳細評価データ抽出完了:', {
            correctCount: detailedData.finalCategoryLevels.CORRECT.length,
            plausibleCount: detailedData.finalCategoryLevels.PLAUSIBLE.length,
            incorrectCount: detailedData.finalCategoryLevels.INCORRECT.length,
            skippedCount: detailedData.finalCategoryLevels.SKIPPED.length
        });

        return detailedData;
    }

    /**
     * ペアから詳細情報を抽出
     * @param {Object} pair - matchedPairオブジェクト
     * @param {string} status - 評価ステータス
     * @returns {Object} 詳細情報
     */
    extractPairDetails(pair, status) {
        const details = {
            // 基本情報（datasetEntryが存在しない場合は個別フィールドから構築）
            datasetEntry: pair.datasetEntry || `${pair.project || 'Unknown'}/${pair.category || 'Unknown'}/${pair.pullRequest || 'Unknown'}`,
            pullRequestName: this.extractPullRequestName(pair.datasetEntry || pair.pullRequest),
            projectName: this.extractProjectName(pair.datasetEntry || pair.project),
            status: status,
            
            // 修正情報
            modifiedFiles: 0,
            modifiedLines: 0,
            modificationTypes: [],
            
            // APR情報
            aprProvider: 'Unknown',
            aprModel: 'Unknown',
            aprStatus: pair.aprStatus || null,  // APRログの終了ステータスを追加
            
            // 評価情報
            evaluationReasoning: '',
            evaluationDetails: null,
            
            // エラー/スキップ分類情報
            errorSource: null,  // 'APR' or 'LLM_EVALUATION' or null
            skipSource: null,   // 'APR' or 'LLM_EVALUATION' or null
            
            // タイムスタンプ
            processedAt: new Date().toISOString(),
            
            // 既存の4軸評価データを保持（既に抽出済みの場合）
            fourAxisEvaluation: pair.fourAxisEvaluation || null,
            finalCategory: pair.finalCategory || null
        };

        // APR側のスキップ理由を記録
        if (pair.finalModification?.evaluationSkipped && pair.finalModification?.skipReason) {
            details.skipSource = 'APR';
            details.aprSkipReason = pair.finalModification.skipReason;
            details.skipReasonSummary = pair.finalModification.skipReason.reason;
            details.skipReasonDetails = pair.finalModification.skipReason.details;
        }

        // APRログからの情報抽出（aprLogDataまたはaprLogをチェック）
        const aprLogData = pair.aprLogData || pair.aprLog;
        if (aprLogData) {
            console.log(`🔍 APRログ処理開始: ${pair.datasetEntry}`);
            console.log(`   - データ構造キー: [${Object.keys(aprLogData).join(', ')}]`);
            
            // 修正ファイル数とライン数の抽出（新しいturns構造に対応）
            if (aprLogData.turns && Array.isArray(aprLogData.turns)) {
                console.log(`✅ 新しい構造検出: ${aprLogData.turns.length}ターン`);
                const modStats = this.extractModificationStatsFromTurns(aprLogData.turns);
                details.modifiedFiles = modStats.files;
                details.modifiedLines = modStats.lines;
                details.modificationTypes = modStats.types;
                console.log(`🔧 修正統計取得: ${details.modifiedFiles}ファイル, ${details.modifiedLines}行 (${pair.datasetEntry})`);
            } else if (aprLogData.interaction_log && Array.isArray(aprLogData.interaction_log)) {
                console.log(`⚠️ 古い構造検出: ${aprLogData.interaction_log.length}エントリー`);
                // 旧式のinteraction_log構造のフォールバック
                const modStats = this.extractModificationStatsFromInteractionLog(aprLogData.interaction_log);
                details.modifiedFiles = modStats.files;
                details.modifiedLines = modStats.lines;
                details.modificationTypes = modStats.types;
                console.log(`🔧 修正統計取得（古い構造）: ${details.modifiedFiles}ファイル, ${details.modifiedLines}行 (${pair.datasetEntry})`);
            } else {
                console.log(`❌ 認識できない構造: ${pair.datasetEntry}`);
            }

            // APRメタデータの抽出（複数のソースを試行）
            if (aprLogData.llmMetadata) {
                details.aprProvider = aprLogData.llmMetadata.provider || 'Unknown';
                details.aprModel = aprLogData.llmMetadata.model || 'Unknown';
                console.log(`🔍 APRモデル情報取得: ${details.aprProvider}/${details.aprModel} (${pair.datasetEntry})`);
            } else if (aprLogData.experiment_metadata) {
                details.aprProvider = aprLogData.experiment_metadata.llm_provider || 'Unknown';
                details.aprModel = aprLogData.experiment_metadata.llm_model || 'Unknown';
                console.log(`🔍 APRモデル情報取得（experiment_metadata）: ${details.aprProvider}/${details.aprModel} (${pair.datasetEntry})`);
            } else {
                console.log(`⚠️ APRモデル情報なし: ${pair.datasetEntry}`);
            }
        }

        // LLM評価情報の抽出
        if (pair.finalModification && pair.finalModification.llmEvaluation) {
            const evaluation = pair.finalModification.llmEvaluation;
            
            // LLM評価エラーの記録
            if (evaluation.error) {
                details.errorSource = 'LLM_EVALUATION';
                details.llmEvaluationError = evaluation.error;
            }
            
            // 4軸評価形式（新形式）
            if (evaluation.accuracy !== undefined) {
                details.fourAxisEvaluation = {
                    accuracy: evaluation.accuracy,
                    decision_soundness: evaluation.decision_soundness,
                    directional_consistency: evaluation.directional_consistency,
                    validity: evaluation.validity,
                    analysis_labels: evaluation.analysis_labels,
                    overall_assessment: evaluation.overall_assessment
                };

                details.finalCategory = evaluation.final_category || evaluation.overall_assessment || null;
                details.accuracyLevel = typeof evaluation.accuracy === 'object'
                    ? evaluation.accuracy.level
                    : evaluation.accuracy;
                
                // 統合された推論を抽出
                details.evaluationReasoning = [
                    evaluation.accuracy?.reasoning,
                    evaluation.decision_soundness?.reasoning,
                    evaluation.directional_consistency?.reasoning,
                    evaluation.validity?.reasoning
                ].filter(Boolean).join(' | ');
                
                // Repair Types情報
                if (evaluation.analysis_labels?.repair_types) {
                    details.repairTypes = evaluation.analysis_labels.repair_types;
                }
            }
            
            // 後方互換性：古い2軸評価形式
            if (evaluation.correctness_evaluation) {
                details.evaluationReasoning = details.evaluationReasoning || evaluation.correctness_evaluation.reasoning || '';
                details.evaluationDetails = evaluation.correctness_evaluation;
            }
            
            if (evaluation.plausibility_evaluation) {
                details.plausibilityReasoning = evaluation.plausibility_evaluation.reasoning || '';
                details.plausibilityDetails = evaluation.plausibility_evaluation;
            }
        } else if (pair.evaluationResult) {
            // 直接evaluationResultから抽出する場合
            details.evaluationReasoning = pair.evaluationResult.explanation || pair.evaluationResult.reasoning || '';
            
            // 意味的類似度スコア情報を追加
            details.semanticSimilarityScore = pair.evaluationResult.semantic_similarity_score || null;
            details.similarityReasoning = pair.evaluationResult.similarity_reasoning || '';
            
            details.evaluationDetails = {
                is_correct: pair.evaluationResult.accuracy === 'correct' || pair.evaluationResult.result === 'IDENTICAL' || pair.evaluationResult.result === 'SEMANTICALLY_EQUIVALENT',
                semantic_equivalence_level: pair.evaluationResult.result,
                reasoning: details.evaluationReasoning,
                // 新しいフィールドを追加
                semantic_similarity_score: details.semanticSimilarityScore,
                similarity_reasoning: details.similarityReasoning
            };
            console.log(`📋 評価結果抽出: ${pair.evaluationResult.result} (スコア: ${details.semanticSimilarityScore}) (${pair.datasetEntry})`);
        }

        // Intent Fulfillment評価情報の抽出
        if (pair.finalModification && pair.finalModification.intentFulfillmentEvaluation) {
            const intentEval = pair.finalModification.intentFulfillmentEvaluation;
            
            if (intentEval.error) {
                // Intent評価エラーケース
                if (!details.errorSource) {
                    details.errorSource = 'LLM_EVALUATION';
                }
                details.intentFulfillmentEvaluation = {
                    status: 'error',
                    error: intentEval.error
                };
                details.intentEvaluationError = intentEval.error;
            } else if (intentEval.skipped) {
                // Intent評価スキップケース
                if (!details.skipSource) {
                    details.skipSource = 'LLM_EVALUATION';
                }
                details.intentFulfillmentEvaluation = {
                    status: 'skipped',
                    reason: intentEval.reason || 'no_commit_messages'
                };
            } else if (intentEval.level) {
                // 評価完了ケース
                details.intentFulfillmentEvaluation = {
                    status: 'evaluated',
                    level: intentEval.level,
                    reasoning: intentEval.reasoning,
                    commit_intent_summary: intentEval.commit_intent_summary,
                    agent_output_summary: intentEval.agent_output_summary,
                    alignment_analysis: intentEval.alignment_analysis
                };
            } else {
                // その他のケース
                details.intentFulfillmentEvaluation = {
                    status: 'unknown',
                    data: intentEval
                };
            }
            
            console.log(`🎯 Intent Fulfillment評価抽出: ${details.intentFulfillmentEvaluation.status} (${pair.datasetEntry})`);
        }

        // エラー情報の抽出
        if (pair.evaluationSkipReason) {
            details.skipReason = pair.evaluationSkipReason;
        }

        return details;
    }

    /**
     * プルリクエスト名を抽出
     * @param {string} datasetEntryOrPullRequest - データセットエントリーまたはプルリクエスト名
     * @returns {string} プルリクエスト名
     */
    extractPullRequestName(datasetEntryOrPullRequest) {
        if (!datasetEntryOrPullRequest) return 'Unknown';
        
        // スラッシュが含まれている場合はパスとして処理
        if (datasetEntryOrPullRequest.includes('/')) {
            const parts = datasetEntryOrPullRequest.split('/');
            if (parts.length >= 3) {
                return parts[parts.length - 1]; // PR番号
            }
        }
        
        // スラッシュが含まれていない場合はそのまま返す
        return datasetEntryOrPullRequest;
    }

    /**
     * プロジェクト名を抽出
     * @param {string} datasetEntryOrProject - データセットエントリーまたはプロジェクト名
     * @returns {string} プロジェクト名
     */
    extractProjectName(datasetEntryOrProject) {
        if (!datasetEntryOrProject) return 'Unknown';
        
        // スラッシュが含まれている場合はパスとして処理
        if (datasetEntryOrProject.includes('/')) {
            const parts = datasetEntryOrProject.split('/');
            if (parts.length >= 1) {
                return parts[0]; // プロジェクト名
            }
        }
        
        // スラッシュが含まれていない場合はそのまま返す
        return datasetEntryOrProject;
    }

    /**
     * 修正統計の抽出
     * @param {Array} interactionLog - インタラクションログ
     * @returns {Object} 修正統計
     */
    /**
     * APRログのturns構造から修正統計を抽出
     * @param {Array} turns - ターン配列
     * @returns {Object} 修正統計
     */
    extractModificationStatsFromTurns(turns) {
        const stats = {
            files: 0,
            lines: 0,
            types: []
        };

        if (!Array.isArray(turns)) return stats;

        const modifiedFiles = new Set();
        let totalLines = 0;
        const modTypes = new Set();

        turns.forEach((turn, index) => {
            // modified_diffまたはmodifiedDiffから修正内容を抽出
            const modifiedDiff = turn.modifiedDiff || turn.modified_diff;
            
            if (modifiedDiff && typeof modifiedDiff === 'string' && modifiedDiff.trim().length > 0) {
                console.log(`🔧 Turn ${index + 1}: 修正あり (${modifiedDiff.length}文字)`);
                
                // ファイル名の抽出（diff形式から）
                const files = this.extractFileNamesFromDiff(modifiedDiff);
                files.forEach(file => modifiedFiles.add(file));
                
                // 修正行数の計算
                const lines = this.countModifiedLines(modifiedDiff);
                totalLines += lines;
                
                // 修正タイプの推定（thoughtやplanから）
                if (turn.thought) {
                    const types = this.classifyModificationType(turn.thought);
                    types.forEach(type => modTypes.add(type));
                }
                
                if (turn.plan) {
                    const types = this.classifyModificationType(turn.plan);
                    types.forEach(type => modTypes.add(type));
                }
                
                // modifiedDiff自体からもタイプを推定
                const diffTypes = this.classifyModificationType(modifiedDiff);
                diffTypes.forEach(type => modTypes.add(type));
            } else {
                console.log(`🔧 Turn ${index + 1}: 修正なし`);
            }
        });

        stats.files = modifiedFiles.size;
        stats.lines = totalLines;
        stats.types = Array.from(modTypes);

        console.log(`📊 修正統計: ${stats.files}ファイル, ${stats.lines}行, タイプ: [${stats.types.join(', ')}]`);
        return stats;
    }

    /**
     * diffからファイル名を抽出
     * @param {string} diff - 差分文字列
     * @returns {Array} ファイル名の配列
     */
    extractFileNamesFromDiff(diff) {
        const files = new Set();
        
        if (!diff) return Array.from(files);
        
        const lines = diff.split('\n');
        
        lines.forEach(line => {
            // "--- a/filename" や "+++ b/filename" の形式
            if (line.startsWith('--- a/') || line.startsWith('+++ b/')) {
                const filename = line.substring(6); // "--- a/" または "+++ b/" を除去
                if (filename && filename !== '/dev/null') {
                    files.add(filename);
                }
            }
            // "diff --git a/filename b/filename" の形式
            else if (line.startsWith('diff --git ')) {
                const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
                if (match && match[1]) {
                    files.add(match[1]);
                }
            }
            // APR特有の "*** Update File: filename" 形式
            else if (line.startsWith('*** Update File: ')) {
                const filename = line.substring(17).trim(); // "*** Update File: " を除去
                if (filename) {
                    files.add(filename);
                }
            }
            // "@@ -line,count +line,count @@ filename" の形式
            else if (line.startsWith('@@') && line.includes('@@')) {
                const parts = line.split('@@');
                if (parts.length > 2 && parts[2].trim()) {
                    // ファイル名が含まれている場合
                    const filename = parts[2].trim();
                    if (filename && !filename.startsWith(' ')) {
                        files.add(filename);
                    }
                }
            }
        });
        
        return Array.from(files);
    }

    /**
     * 古いinteraction_log構造から修正統計を抽出
     * @param {Array} interactionLog - interaction_log配列
     * @returns {Object} 修正統計
     */
    extractModificationStatsFromInteractionLog(interactionLog) {
        const stats = {
            files: 0,
            lines: 0,
            types: []
        };

        if (!Array.isArray(interactionLog) || interactionLog.length === 0) {
            console.log('❌ interaction_log配列が空または無効');
            return stats;
        }

        let totalLines = 0;
        const modifiedFiles = new Set();
        const modificationTypes = new Set();

        interactionLog.forEach((entry, index) => {
            console.log(`🔧 interaction_log[${index}] を処理中...`);
            console.log(`   キー: [${Object.keys(entry).join(', ')}]`);
            
            // LLMレスポンスから生成されたコンテンツを抽出
            if (entry.llm_response && entry.llm_response.raw_content) {
                const content = entry.llm_response.raw_content;
                console.log(`📄 raw_content長: ${content.length}文字`);
                
                // %_Modified_%セクションを優先的に検索
                const modifiedMatch = content.match(/%_Modified_%\s*([\s\S]*?)(?=%_\w+_%|$)/);
                if (modifiedMatch) {
                    const modifiedContent = modifiedMatch[1].trim();
                    console.log('✅ %_Modified_%セクションを検出');
                    console.log(`📄 Modified内容長: ${modifiedContent.length}文字`);
                    
                    // ファイル名を抽出
                    const files = this.extractFileNamesFromDiff(modifiedContent);
                    console.log(`📁 ファイル検出: ${files.length}件`);
                    files.forEach(file => {
                        modifiedFiles.add(file);
                        console.log(`  - ${file}`);
                    });

                    // 行数を計算
                    const lines = this.countModifiedLines(modifiedContent);
                    console.log(`📊 変更行数: ${lines}行`);
                    totalLines += lines;

                    // 修正タイプを分類
                    const types = this.classifyModificationType(modifiedContent);
                    console.log(`🏷️ タイプ: [${types.join(', ')}]`);
                    types.forEach(type => modificationTypes.add(type));
                }
                // %_Modified_%が見つからない場合、diff形式のコンテンツを検索
                else if (content.includes('diff --git') || content.includes('---') || content.includes('+++')) {
                    console.log('✅ diff形式のコンテンツを検出');
                    
                    // ファイル名を抽出
                    const files = this.extractFileNamesFromDiff(content);
                    console.log(`📁 ファイル検出: ${files.length}件`);
                    files.forEach(file => {
                        modifiedFiles.add(file);
                        console.log(`  - ${file}`);
                    });

                    // 行数を計算
                    const lines = this.countModifiedLines(content);
                    console.log(`📊 変更行数: ${lines}行`);
                    totalLines += lines;

                    // 修正タイプを分類
                    const types = this.classifyModificationType(content);
                    console.log(`🏷️ タイプ: [${types.join(', ')}]`);
                    types.forEach(type => modificationTypes.add(type));
                } else {
                    console.log('⚠️ diff形式ではないコンテンツ');
                    
                    // %_Plan_%セクションからファイル情報を抽出
                    const planMatch = content.match(/%_Plan_%\s*([\s\S]*?)(?=%_\w+_%|$)/);
                    if (planMatch) {
                        const planContent = planMatch[1];
                        const fileMatches = planContent.match(/"filePath":\s*"([^"]+)"/g);
                        if (fileMatches) {
                            fileMatches.forEach(match => {
                                const fileMatch = match.match(/"filePath":\s*"([^"]+)"/);
                                if (fileMatch) {
                                    modifiedFiles.add(fileMatch[1]);
                                    console.log(`📁 Plan からファイル検出: ${fileMatch[1]}`);
                                }
                            });
                        }
                    }
                    
                    // Go言語のコードパターンを検索してファイル推定
                    const goPatterns = [
                        /package\s+\w+/,
                        /func\s+\w+/,
                        /import\s+/,
                        /\.go\b/
                    ];
                    
                    if (goPatterns.some(pattern => pattern.test(content))) {
                        console.log('✅ Go言語コードを検出');
                        if (modifiedFiles.size === 0) {
                            modifiedFiles.add('estimated_go_file.go');
                            console.log('📁 推定Go ファイルを追加');
                        }
                        
                        // 改行数をベースに行数を推定
                        const estimatedLines = Math.min((content.match(/\n/g) || []).length, 50);
                        totalLines += estimatedLines;
                        console.log(`📊 推定行数: ${estimatedLines}行`);
                        
                        const types = this.classifyModificationType(content);
                        types.forEach(type => modificationTypes.add(type));
                    }
                }
            } else {
                console.log('⚠️ llm_response.raw_content が見つかりません');
            }
        });

        stats.files = modifiedFiles.size;
        stats.lines = totalLines;
        stats.types = Array.from(modificationTypes);

        console.log(`✅ 古い構造からの統計抽出完了: ${stats.files}ファイル, ${stats.lines}行, [${stats.types.join(', ')}]`);
        return stats;
    }

    extractModificationStats(interactionLog) {
        const stats = {
            files: 0,
            lines: 0,
            types: []
        };

        if (!Array.isArray(interactionLog)) return stats;

        const modifiedFiles = new Set();
        let totalLines = 0;
        const modTypes = new Set();

        interactionLog.forEach(entry => {
            if (entry.type === 'modification' && entry.content) {
                // ファイル名の抽出
                if (entry.content.file_path) {
                    modifiedFiles.add(entry.content.file_path);
                }

                // 修正行数の推定（差分から）
                if (entry.content.diff) {
                    const lines = this.countModifiedLines(entry.content.diff);
                    totalLines += lines;
                }

                // 修正タイプの分類
                if (entry.content.description) {
                    const type = this.classifyModificationType(entry.content.description);
                    if (type) modTypes.add(type);
                }
            }
        });

        stats.files = modifiedFiles.size;
        stats.lines = totalLines;
        stats.types = Array.from(modTypes);

        return stats;
    }

    /**
     * 修正行数をカウント
     * @param {string} diff - 差分文字列
     * @returns {number} 修正行数
     */
    countModifiedLines(diff) {
        if (!diff) return 0;
        
        const lines = diff.split('\n');
        let modifiedCount = 0;
        
        lines.forEach(line => {
            if (line.startsWith('+') && !line.startsWith('+++')) {
                modifiedCount++;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                modifiedCount++;
            }
        });
        
        return modifiedCount;
    }

    /**
     * 修正タイプの分類（複数タイプ対応）
     * @param {string} content - 修正内容またはコード
     * @returns {Array} 修正タイプの配列
     */
    classifyModificationType(content) {
        if (!content || typeof content !== 'string') {
            return ['unknown'];
        }
        
        const types = new Set();
        const lowerContent = content.toLowerCase();

        // プログラミング関連キーワードの定義
        const keywords = {
            'conditional': ['if', 'else', 'switch', 'case', 'condition'],
            'loop': ['for', 'while', 'foreach', 'loop'],
            'function': ['function', 'func', 'def', 'method'],
            'variable': ['var', 'let', 'const', 'variable'],
            'class': ['class', 'struct', 'interface'],
            'import': ['import', 'include', 'require', 'use'],
            'error': ['error', 'exception', 'throw', 'catch'],
            'api': ['api', 'endpoint', 'route', 'handler'],
            'config': ['config', 'setting', 'parameter'],
            'test': ['test', 'spec', 'mock', 'assert'],
            'database': ['db', 'database', 'query', 'sql'],
            'network': ['http', 'https', 'request', 'response'],
            'security': ['auth', 'token', 'security', 'permission'],
            'logging': ['log', 'debug', 'info', 'warn'],
            'ui': ['ui', 'component', 'element', 'style']
        };

        // キーワードマッチング
        for (const [type, words] of Object.entries(keywords)) {
            if (words.some(word => lowerContent.includes(word))) {
                types.add(type);
            }
        }

        // Go言語特有のパターン
        if (lowerContent.includes('nil') || lowerContent.includes('null')) {
            types.add('null-check');
        }
        
        if (lowerContent.includes('return')) {
            types.add('return-value');
        }

        return types.size > 0 ? Array.from(types) : ['generic'];
        
        // 依存関係/インポート
        if (desc.includes('import') || desc.includes('dependency') || desc.includes('package') || desc.includes('library')) return 'dependency';
        
        // API関連
        if (desc.includes('api') || desc.includes('endpoint') || desc.includes('request') || desc.includes('response')) return 'api';
        
        // データ構造
        if (desc.includes('array') || desc.includes('list') || desc.includes('map') || desc.includes('object') || desc.includes('struct')) return 'data-structure';
        
        // 型関連
        if (desc.includes('type') || desc.includes('cast') || desc.includes('convert') || desc.includes('parse')) return 'type-conversion';
        
        // 設定/パラメータ
        if (desc.includes('config') || desc.includes('parameter') || desc.includes('option') || desc.includes('setting')) return 'configuration';
        
        // ログ/デバッグ
        if (desc.includes('log') || desc.includes('debug') || desc.includes('print') || desc.includes('trace')) return 'logging';
        
        // テスト関連
        if (desc.includes('test') || desc.includes('mock') || desc.includes('assert') || desc.includes('verify')) return 'testing';
        
        return 'general';
        
        return 'other';
    }

    /**
     * 詳細統計サマリーの計算
     * @param {Object} detailedData - 詳細データ
     * @returns {Object} 統計サマリー
     */
    calculateDetailedSummary(detailedData) {
        const allEntries = [
            ...detailedData.finalCategoryLevels.CORRECT,
            ...detailedData.finalCategoryLevels.PLAUSIBLE,
            ...detailedData.finalCategoryLevels.INCORRECT
        ];

        const summary = {
            totalProcessed: allEntries.length,
            avgModifiedLines: 0,
            avgModifiedFiles: 0,
            mostCommonProjects: [],
            modificationPatterns: {},
            difficultyAnalysis: {}
        };

        if (allEntries.length === 0) return summary;

        // 平均値計算
        const totalLines = allEntries.reduce((sum, entry) => sum + entry.modifiedLines, 0);
        const totalFiles = allEntries.reduce((sum, entry) => sum + entry.modifiedFiles, 0);
        
        summary.avgModifiedLines = (totalLines / allEntries.length).toFixed(1);
        summary.avgModifiedFiles = (totalFiles / allEntries.length).toFixed(1);

        // プロジェクト別集計
        const projectCounts = {};
        allEntries.forEach(entry => {
            projectCounts[entry.projectName] = (projectCounts[entry.projectName] || 0) + 1;
        });
        
        summary.mostCommonProjects = Object.entries(projectCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        // 修正パターン分析
        const modPatterns = {};
        allEntries.forEach(entry => {
            entry.modificationTypes.forEach(type => {
                modPatterns[type] = (modPatterns[type] || 0) + 1;
            });
        });
        
        summary.modificationPatterns = Object.entries(modPatterns)
            .sort(([,a], [,b]) => b - a)
            .reduce((obj, [type, count]) => {
                obj[type] = count;
                return obj;
            }, {});

        // 難易度分析
        summary.difficultyAnalysis = this.analyzeDifficulty(detailedData);

        return summary;
    }

    /**
     * 修正難易度の分析
     * @param {Object} detailedData - 詳細データ
     * @returns {Object} 難易度分析結果
     */
    analyzeDifficulty(detailedData) {
        const analysis = {
            byModifiedLines: { easy: [], medium: [], hard: [] },
            byModifiedFiles: { single: [], multiple: [], complex: [] },
            byModificationType: {},
            recommendations: []
        };

        // 全エントリーを統合
        const allEntries = [
            ...detailedData.finalCategoryLevels.CORRECT,
            ...detailedData.finalCategoryLevels.PLAUSIBLE,
            ...detailedData.finalCategoryLevels.INCORRECT
        ];

        // 修正行数による分析
        allEntries.forEach(entry => {
            if (entry.modifiedLines <= 5) {
                analysis.byModifiedLines.easy.push(entry);
            } else if (entry.modifiedLines <= 20) {
                analysis.byModifiedLines.medium.push(entry);
            } else {
                analysis.byModifiedLines.hard.push(entry);
            }
        });

        // 修正ファイル数による分析
        allEntries.forEach(entry => {
            if (entry.modifiedFiles === 1) {
                analysis.byModifiedFiles.single.push(entry);
            } else if (entry.modifiedFiles <= 3) {
                analysis.byModifiedFiles.multiple.push(entry);
            } else {
                analysis.byModifiedFiles.complex.push(entry);
            }
        });

        // 修正タイプ別の成功率分析
        const typeSuccessRates = {};
        allEntries.forEach(entry => {
            entry.modificationTypes.forEach(type => {
                if (!typeSuccessRates[type]) {
                    typeSuccessRates[type] = { total: 0, correct: 0 };
                }
                typeSuccessRates[type].total++;
                if (entry.correctnessLevel === 'IDENTICAL' || entry.correctnessLevel === 'SEMANTICALLY_EQUIVALENT') {
                    typeSuccessRates[type].correct++;
                }
            });
        });

        Object.entries(typeSuccessRates).forEach(([type, data]) => {
            analysis.byModificationType[type] = {
                successRate: ((data.correct / data.total) * 100).toFixed(1),
                total: data.total,
                correct: data.correct
            };
        });

        // 推奨事項の生成
        analysis.recommendations = this.generateRecommendations(analysis);

        return analysis;
    }

    /**
     * 改善推奨事項の生成
     * @param {Object} analysis - 難易度分析結果
     * @returns {Array} 推奨事項のリスト
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        // 修正行数に基づく推奨
        const easySuccess = analysis.byModifiedLines.easy.length;
        const mediumSuccess = analysis.byModifiedLines.medium.length;
        const hardSuccess = analysis.byModifiedLines.hard.length;

        if (hardSuccess < easySuccess * 0.5) {
            recommendations.push({
                type: 'complexity',
                priority: 'high',
                title: '複雑な修正への対応改善',
                description: '大規模な修正（20行以上）での成功率が低下しています。段階的な修正アプローチの導入を推奨します。'
            });
        }

        // 修正タイプに基づく推奨
        Object.entries(analysis.byModificationType).forEach(([type, data]) => {
            if (data.total >= 5 && parseFloat(data.successRate) < 50) {
                recommendations.push({
                    type: 'pattern',
                    priority: 'medium',
                    title: `${type}パターンの改善`,
                    description: `${type}タイプの修正で成功率が${data.successRate}%と低下しています。専用の学習データ拡充を検討してください。`
                });
            }
        });

        return recommendations;
    }

    /**
     * 評価内訳の詳細分析
     * @param {Object} stats - ProcessingStats オブジェクト
     * @returns {Object} 評価内訳詳細
     */
    analyzeEvaluationBreakdown(stats) {
        const breakdown = {
            byProject: {},
            bySkipReason: {},
            evaluationSamples: {
                correct: [],
                plausible: [],
                incorrect: [],
                skipped: []
            }
        };

        stats.matchedPairs.forEach(pair => {
            const projectName = pair.project || pair.datasetEntry?.split('/')[0] || 'Unknown';
            
            // プロジェクト別集計
            if (!breakdown.byProject[projectName]) {
                breakdown.byProject[projectName] = {
                    correct: 0,
                    plausible: 0,
                    incorrect: 0,
                    skipped: 0,
                    total: 0,
                    // 意味的類似度統計を追加
                    semanticSimilarity: {
                        averageScore: 0,
                        totalScores: [],
                        scoreBreakdown: {
                            perfect: 0,      // 1.0
                            nearPerfect: 0,  // 0.9-0.99
                            high: 0,         // 0.7-0.89
                            medium: 0,       // 0.5-0.69
                            low: 0,          // 0.2-0.49
                            veryLow: 0       // 0.0-0.19
                        }
                    }
                };
            }
            breakdown.byProject[projectName].total++;

            if (pair.evaluationSkipReason) {
                breakdown.byProject[projectName].skipped++;
                
                // スキップ理由別集計
                const reason = pair.evaluationSkipReason;
                breakdown.bySkipReason[reason] = (breakdown.bySkipReason[reason] || 0) + 1;
                
                // スキップサンプルを追加
                if (breakdown.evaluationSamples.skipped.length < 3) {
                    breakdown.evaluationSamples.skipped.push({
                        entry: pair.datasetEntry || `${pair.project}/${pair.category}/${pair.pullRequest}`,
                        reason: reason,
                        project: projectName
                    });
                }
            } else {
                // 評価結果の抽出（複数のデータ構造に対応）
                let correctnessLevel = null;
                let evaluation = null;
                let reasoning = 'N/A';
                let hasValidEvaluation = false;
                
                console.log(`🔍 [${projectName}] ${pair.datasetEntry || 'Unknown'} - 評価結果抽出開始`);
                
                // 1. 新しい評価システム（evaluationResult）
                if (pair.evaluationResult) {
                    if (pair.evaluationResult.correctnessLevel) {
                        correctnessLevel = pair.evaluationResult.correctnessLevel;
                        reasoning = pair.evaluationResult.reasoning || 'N/A';
                        hasValidEvaluation = true;
                    } else if (pair.evaluationResult.result) {
                        correctnessLevel = pair.evaluationResult.result;
                        reasoning = pair.evaluationResult.reasoning || 'N/A';
                        hasValidEvaluation = true;
                    }
                    
                    // 意味的類似度スコアを抽出
                    const score = pair.evaluationResult.semantic_similarity_score;
                    if (score !== null && score !== undefined && !isNaN(score)) {
                        const validScore = Math.max(0, Math.min(1, parseFloat(score)));
                        breakdown.byProject[projectName].semanticSimilarity.totalScores.push(validScore);
                        
                        // スコア分類別の統計
                        const category = this.categorizeSemanticSimilarityScore(validScore);
                        breakdown.byProject[projectName].semanticSimilarity.scoreBreakdown[category]++;
                    }
                }
                
                // 2. finalModification.llmEvaluation構造
                if (!hasValidEvaluation && pair.finalModification && pair.finalModification.llmEvaluation && !pair.finalModification.llmEvaluation.error) {
                    evaluation = pair.finalModification.llmEvaluation;
                    
                    // overall_assessmentまたはcorrectness_evaluation.semantic_equivalence_levelを使用
                    correctnessLevel = evaluation.overall_assessment || 
                                     evaluation.correctness_evaluation?.semantic_equivalence_level;
                    
                    reasoning = evaluation.reasoning || 
                              evaluation.correctness_evaluation?.reasoning || 'N/A';
                    
                    hasValidEvaluation = !!correctnessLevel;
                    
                    // 意味的類似度スコア抽出（複数の場所をチェック）
                    const score = evaluation.semantic_similarity_score || 
                                evaluation.correctness_evaluation?.semantic_similarity_score;
                    if (score !== null && score !== undefined && !isNaN(score)) {
                        const validScore = Math.max(0, Math.min(1, parseFloat(score)));
                        breakdown.byProject[projectName].semanticSimilarity.totalScores.push(validScore);
                        
                        // スコア分類別の統計
                        const category = this.categorizeSemanticSimilarityScore(validScore);
                        breakdown.byProject[projectName].semanticSimilarity.scoreBreakdown[category]++;
                    }
                }
                
                // 3. 評価結果がない場合
                if (!hasValidEvaluation) {
                    breakdown.byProject[projectName].skipped++;
                    
                    const reason = 'No evaluation result found';
                    breakdown.bySkipReason[reason] = (breakdown.bySkipReason[reason] || 0) + 1;
                    
                    if (breakdown.evaluationSamples.skipped.length < 3) {
                        breakdown.evaluationSamples.skipped.push({
                            entry: pair.datasetEntry || `${pair.project}/${pair.category}/${pair.pullRequest}`,
                            reason: reason,
                            project: projectName
                        });
                    }
                } else if (correctnessLevel) {
                    switch (correctnessLevel) {
                        case 'IDENTICAL':
                        case 'SEMANTICALLY_EQUIVALENT':
                        case 'CORRECT':  // 後方互換性
                            breakdown.byProject[projectName].correct++;
                            if (breakdown.evaluationSamples.correct.length < 3) {
                                breakdown.evaluationSamples.correct.push({
                                    entry: pair.datasetEntry || `${pair.project}/${pair.category}/${pair.pullRequest}`,
                                    project: projectName,
                                    reasoning: reasoning
                                });
                            }
                            break;
                        case 'PLAUSIBLE_BUT_DIFFERENT':
                            breakdown.byProject[projectName].plausible++;
                            if (breakdown.evaluationSamples.plausible.length < 3) {
                                breakdown.evaluationSamples.plausible.push({
                                    entry: pair.datasetEntry || `${pair.project}/${pair.category}/${pair.pullRequest}`,
                                    project: projectName,
                                    reasoning: reasoning
                                });
                            }
                            break;
                        case 'INCORRECT':
                            breakdown.byProject[projectName].incorrect++;
                            if (breakdown.evaluationSamples.incorrect.length < 3) {
                                breakdown.evaluationSamples.incorrect.push({
                                    entry: pair.datasetEntry || `${pair.project}/${pair.category}/${pair.pullRequest}`,
                                    project: projectName,
                                    reasoning: reasoning
                                });
                            }
                            break;
                        default:
                            console.log(`⚠️ 不明な正確性レベル: ${correctnessLevel} (${pair.datasetEntry})`);
                            breakdown.byProject[projectName].incorrect++;
                            break;
                    }
                } else {
                    console.log(`⚠️ 正確性レベルが取得できませんでした: ${pair.datasetEntry}`);
                    breakdown.byProject[projectName].skipped++;
                    
                    const reason = 'No correctness level found';
                    breakdown.bySkipReason[reason] = (breakdown.bySkipReason[reason] || 0) + 1;
                }
            }
        });

        // プロジェクト別の意味的類似度平均スコアを計算
        Object.keys(breakdown.byProject).forEach(projectName => {
            const project = breakdown.byProject[projectName];
            const scores = project.semanticSimilarity.totalScores;
            
            if (scores.length > 0) {
                const sum = scores.reduce((acc, score) => acc + score, 0);
                project.semanticSimilarity.averageScore = parseFloat((sum / scores.length).toFixed(3));
            }
        });

        return breakdown;
    }

    /**
     * 詳細分析レポートHTMLテンプレートの描画
     * @param {Object} data - テンプレートデータ
     * @returns {Promise<string>} 描画されたHTML
     */
    async renderDetailedAnalysisTemplate(data) {
        const templatePath = path.join(this.templateDir, 'detailed_analysis_report.html');
        try {
            const template = await fs.readFile(templatePath, 'utf-8');
            return this.processTemplate(template, data);
        } catch (error) {
            console.warn('詳細分析テンプレート読み込みエラー:', error.message);
            return this.getDefaultDetailedAnalysisTemplate(data);
        }
    }

    /**
     * 統計レポートHTMLテンプレートの描画
     * @param {Object} data - テンプレートデータ
     * @returns {Promise<string>} 描画されたHTML
     */
    async renderStatisticsTemplate(data) {
        const templatePath = path.join(this.templateDir, 'statistics_report.html');
        try {
            const template = await fs.readFile(templatePath, 'utf-8');
            return this.processTemplate(template, data);
        } catch (error) {
            console.warn('統計レポートテンプレートが見つかりません。デフォルトテンプレートを使用します。');
            return this.getDefaultStatisticsTemplate(data);
        }
    }

    /**
     * エントリー詳細HTMLテンプレートの描画
     * @param {Object} data - テンプレートデータ
     * @returns {Promise<string>} 描画されたHTML
     */
    async renderEntryDetailTemplate(data) {
        const templatePath = path.join(this.templateDir, 'entry_detail.html');
        try {
            const template = await fs.readFile(templatePath, 'utf-8');
            return this.processTemplate(template, data);
        } catch (error) {
            console.warn('エントリー詳細テンプレートが見つかりません。デフォルトテンプレートを使用します。');
            return this.getDefaultEntryDetailTemplate(data);
        }
    }

    /**
     * エラーレポートHTMLテンプレートの描画
     * @param {Object} data - テンプレートデータ
     * @returns {Promise<string>} 描画されたHTML
     */
    async renderErrorTemplate(data) {
        const templatePath = path.join(this.templateDir, 'error_report.html');
        try {
            const template = await fs.readFile(templatePath, 'utf-8');
            return this.processTemplate(template, data);
        } catch (error) {
            console.warn('エラーレポートテンプレートが見つかりません。デフォルトテンプレートを使用します。');
            return this.getDefaultErrorTemplate(data);
        }
    }

    /**
     * Handlebarsテンプレート処理エンジン
     * @param {string} template - HTMLテンプレート
     * @param {Object} data - テンプレートデータ
     * @returns {string} 処理されたHTML
     */
    processTemplate(template, data) {
        try {
            console.log('🔧 Handlebarsテンプレート処理開始');
            console.log('  - データキー:', Object.keys(data));
            console.log('  - stats.llmStats存在:', data.stats?.llmStats ? 'はい' : 'いいえ');
            if (data.stats?.llmStats) {
                console.log('  - llmStats.totalLLMTypes:', data.stats.llmStats.totalLLMTypes);
                console.log('  - llmStats.llmList.length:', data.stats.llmStats.llmList.length);
            }
            
            // Handlebarsテンプレートをコンパイル
            const compiledTemplate = Handlebars.compile(template);
            
            // データを渡してHTMLを生成
            const result = compiledTemplate(data);
            
            console.log('✅ Handlebarsテンプレート処理完了');
            console.log('  - 生成HTMLサイズ:', result.length);
            
            return result;
        } catch (error) {
            console.error('❌ Handlebarsテンプレート処理エラー:', error.message);
            console.error('テンプレート内容（最初の500文字）:', template.substring(0, 500));
            
            // フォールバックとして元のシンプルエンジンを使用
            console.log('📋 フォールバックのシンプルエンジンを使用');
            return this.processTemplateSimple(template, data);
        }
    }

    /**
     * シンプルなテンプレート処理エンジン（フォールバック用）
     * @param {string} template - HTMLテンプレート
     * @param {Object} data - テンプレートデータ
     * @returns {string} 処理されたHTML
     */
    processTemplateSimple(template, data) {
        let result = template;
        
        // {{#if condition}} ... {{/if}} 形式の条件付きブロック処理
        result = result.replace(/\{\{#if ([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, conditionKey, content) => {
            const conditionValue = this.getNestedValue(data, conditionKey);
            // 条件が真値（存在する、空でない、0でない、falseでない）の場合のみ内容を表示
            return conditionValue && conditionValue !== false && conditionValue !== 0 ? this.processTemplateSimple(content, data) : '';
        });
        
        // {{key}} や {{key.subkey}} 形式の変数を置換（ドット記法対応）
        result = result.replace(/\{\{([\w.]+)\}\}/g, (match, key) => {
            const value = this.getNestedValue(data, key);
            return value !== null && value !== undefined ? value : '';
        });
        
        // {{#each array}} ... {{/each}} 形式のループ処理
        result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayKey, loopContent) => {
            const array = this.getNestedValue(data, arrayKey) || [];
            return array.map(item => {
                return this.processTemplateSimple(loopContent, { ...data, this: item });
            }).join('');
        });
        
        return result;
    }

    /**
     * ネストされたオブジェクトから値を取得
     * @param {Object} obj - オブジェクト
     * @param {string} path - パス（ドット記法）
     * @returns {*} 取得された値
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    /**
     * デフォルトの統計レポートテンプレート
     * @param {Object} data - テンプレートデータ
     * @returns {string} HTMLテンプレート
     */
    getDefaultStatisticsTemplate(data) {
        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APRログ分析統計レポート</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; background-color: #f5f5f5; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); color: #333; }
        .header { text-align: center; border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #007acc; font-size: 2.5em; margin: 0; }
        .subtitle { color: #666; font-size: 1.1em; margin: 10px 0 0 0; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat-card { background: linear-gradient(135deg, #f8f9fa, #e9ecef); padding: 20px; border-radius: 8px; border-left: 4px solid #007acc; }
        .stat-value { font-size: 2.5em; font-weight: bold; color: #007acc; margin: 0; }
        .stat-label { color: #666; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
        .success-rate { color: #28a745; }
        .warning-rate { color: #ffc107; }
        .error-rate { color: #dc3545; }
        .quality-value { color: #27ae60; font-weight: bold; }
        .section { margin: 40px 0; }
        .section-title { color: #333; font-size: 1.5em; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
        .progress-bar { background: #e9ecef; border-radius: 10px; overflow: hidden; height: 20px; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #007acc, #28a745); transition: width 0.3s ease; }
        .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .data-table th, .data-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .data-table th { background-color: #f8f9fa; font-weight: 600; color: #333; }
        .data-table td { color: #333; }
        .data-table tr:hover { background-color: #f8f9fa; }
        .timestamp { color: #888; font-size: 0.9em; text-align: center; margin-top: 30px; }
        .emoji { font-size: 1.2em; margin-right: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">📊 APRログ分析統計レポート</h1>
            <p class="subtitle">自動プログラム修復ログとデータセットのマッチング分析結果</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${data.stats.totalDatasetEntries}</div>
                <div class="stat-label">📂 総データセットエントリー数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value success-rate">${data.stats.aprLogFound}</div>
                <div class="stat-label">✅ APRログ発見数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value warning-rate">${data.stats.aprLogNotFound}</div>
                <div class="stat-label">⚠️ APRログ未発見数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value error-rate">${data.stats.aprLogAccessError}</div>
                <div class="stat-label">❌ APRログアクセスエラー数</div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">🎯 処理成功率</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value success-rate">${data.stats.step1CompletionRate}%</div>
                    <div class="stat-label">ステップ1完了率（構造解析＋差分抽出）</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${data.stats.step1CompletionRate}%"></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-value success-rate">${data.stats.evaluationPipelineSuccessRate}%</div>
                    <div class="stat-label">評価パイプライン成功率（＋LLM評価）</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${data.stats.evaluationPipelineSuccessRate}%"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">📈 詳細統計</h2>
            <table class="data-table">
                <tr>
                    <th><span class="emoji">🟢</span>完全マッチング済み</th>
                    <td>${data.stats.matchedPairsCount} ペア</td>
                </tr>
                <tr>
                    <th><span class="emoji">🟡</span>未マッチング</th>
                    <td>${data.stats.unmatchedEntriesCount} エントリー</td>
                </tr>
                <tr>
                    <th><span class="emoji">🔴</span>エラー発生</th>
                    <td>${data.stats.errorEntriesCount} エントリー</td>
                </tr>
                <tr>
                    <th><span class="emoji">✅</span>ステップ1完了数</th>
                    <td>${data.stats.aprParseSuccess} エントリー</td>
                </tr>
                <tr>
                    <th><span class="emoji">🚀</span>評価パイプライン成功数</th>
                    <td>${data.stats.evaluationPipelineSuccess} エントリー</td>
                </tr>
            </table>
        </div>

        ${data.stats.llmStats && (data.stats.llmStats.totalLogEntries > 0 || data.stats.llmStats.llmList.length > 0) ? `
        <div class="section">
            <h2 class="section-title">🤖 LLM対話統計情報</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${data.stats.llmStats.totalLogEntries}</div>
                    <div class="stat-label">📊 処理済みログエントリー数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.stats.llmStats.totalLLMTypes}</div>
                    <div class="stat-label">🎯 使用LLMモデル種類数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value success-rate">${data.stats.llmStats.totalInteractions}</div>
                    <div class="stat-label">🔄 総LLM対話回数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.stats.llmStats.totalTokens.toLocaleString()}</div>
                    <div class="stat-label">📊 総トークン数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.stats.llmStats.averageTokensPerInteraction}</div>
                    <div class="stat-label">📈 平均トークン数/対話</div>
                </div>
            </div>
            
            ${data.stats.llmStats.llmList.length > 0 ? `
            <table class="data-table">
                <thead>
                    <tr>
                        <th><span class="emoji">🤖</span>LLMモデル</th>
                        <th><span class="emoji">🔄</span>使用回数</th>
                        <th><span class="emoji">📊</span>総トークン数</th>
                        <th><span class="emoji">📈</span>平均トークン数</th>
                        <th><span class="emoji">🕐</span>初回使用日時</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.stats.llmStats.llmList.map(llm => `
                    <tr>
                        <td><strong>${llm.provider}</strong>/${llm.model}</td>
                        <td>${llm.usage} 回</td>
                        <td>${llm.totalTokens.toLocaleString()}</td>
                        <td>${llm.averageTokens}</td>
                        <td>${llm.firstSeen}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : `
            <div class="stat-card">
                <div class="stat-value warning-rate">⚠️</div>
                <div class="stat-label">LLMメタデータが見つかりませんでした</div>
                <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    APRログファイルにLLMプロバイダー情報が含まれていない可能性があります。<br>
                    ログ解析機能の改善が必要です。
                </div>
            </div>
            `}
        </div>
        ` : `
        <div class="section">
            <h2 class="section-title">🤖 LLM情報</h2>
            <div class="stat-card">
                <div class="stat-value error-rate">❌</div>
                <div class="stat-label">LLMデータが利用できません</div>
                <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    マッチングされたAPRログが存在しないか、<br>
                    ログファイルの形式が期待されるものと異なります。
                </div>
            </div>
        </div>
        `}

        ${(data.stats.aprQualityGood + data.stats.aprQualityBad > 0) || 
          (data.stats.aprEffectiveFixed + data.stats.aprEffectiveUnfixed > 0) || 
          (data.stats.aprMinimalChanges + data.stats.aprExcessiveChanges > 0) ? `
        <div class="section">
            <h2 class="section-title">⭐ APR修正品質評価</h2>
            <div class="stats-grid">
                ${data.stats.aprQualityGood + data.stats.aprQualityBad > 0 ? `
                <div class="stat-card">
                    <div class="stat-value quality-value">${data.stats.aprQualitySuccessRate}%</div>
                    <div class="stat-label">🎯 APR品質成功率</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${data.stats.aprQualitySuccessRate}%"></div>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                        計算式: ${data.stats.aprQualityGood} ÷ ${data.stats.aprQualityGood + data.stats.aprQualityBad} × 100<br>
                        良い修正: ${data.stats.aprQualityGood}件、悪い修正: ${data.stats.aprQualityBad}件
                    </div>
                </div>
                ` : ''}
                
                ${data.stats.aprEffectiveFixed + data.stats.aprEffectiveUnfixed > 0 ? `
                <div class="stat-card">
                    <div class="stat-value quality-value">${data.stats.aprEffectivenessRate}%</div>
                    <div class="stat-label">🔧 修正効果率</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${data.stats.aprEffectivenessRate}%"></div>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                        計算式: ${data.stats.aprEffectiveFixed} ÷ ${data.stats.aprEffectiveFixed + data.stats.aprEffectiveUnfixed} × 100<br>
                        問題解決: ${data.stats.aprEffectiveFixed}件、未解決: ${data.stats.aprEffectiveUnfixed}件
                    </div>
                </div>
                ` : ''}
                
                ${data.stats.aprMinimalChanges + data.stats.aprExcessiveChanges > 0 ? `
                <div class="stat-card">
                    <div class="stat-value quality-value">${data.stats.aprMinimalChangeRate}%</div>
                    <div class="stat-label">✂️ 最小変更率</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${data.stats.aprMinimalChangeRate}%"></div>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                        計算式: ${data.stats.aprMinimalChanges} ÷ ${data.stats.aprMinimalChanges + data.stats.aprExcessiveChanges} × 100<br>
                        最小変更: ${data.stats.aprMinimalChanges}件、過剰変更: ${data.stats.aprExcessiveChanges}件
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}

        <div class="timestamp">
            レポート生成日時: ${data.timestamp}
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * デフォルトのエントリー詳細テンプレート
     * @param {Object} data - テンプレートデータ
     * @returns {string} HTMLテンプレート
     */
    getDefaultEntryDetailTemplate(data) {
        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>エントリー詳細: ${data.entryId}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; background-color: #f5f5f5; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); color: #333; }
        .header { border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #007acc; font-size: 2em; margin: 0; }
        .section { margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .section-title { color: #333; font-size: 1.3em; margin-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .info-item { background: white; padding: 15px; border-radius: 5px; border-left: 3px solid #007acc; }
        .info-label { font-weight: bold; color: #666; font-size: 0.9em; }
        .info-value { color: #333; margin-top: 5px; }
        .code-block { background: #2d3748; color: #e2e8f0; padding: 20px; border-radius: 8px; overflow-x: auto; font-family: 'Courier New', monospace; }
        .file-list { list-style: none; padding: 0; }
        .file-list li { background: white; margin: 5px 0; padding: 10px; border-radius: 5px; border-left: 3px solid #28a745; color: #333; }
        .timestamp { color: #888; font-size: 0.9em; text-align: center; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">📝 エントリー詳細レポート</h1>
            <p>ID: ${data.entryId}</p>
        </div>

        <div class="section">
            <h2 class="section-title">📊 基本情報</h2>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">データセットエントリー</div>
                    <div class="info-value">${data.datasetEntry}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">APRログパス</div>
                    <div class="info-value">${data.aprLogPath}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">ログファイル数</div>
                    <div class="info-value">${data.logFiles ? data.logFiles.length : 0}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">最新ログファイル</div>
                    <div class="info-value">${data.latestLogFile || 'N/A'}</div>
                </div>
            </div>
        </div>

        ${data.aprLogData ? `
        <div class="section">
            <h2 class="section-title">🔍 APRログ解析結果</h2>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">対話ターン数</div>
                    <div class="info-value">${data.aprLogData.turns}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">総トークン数</div>
                    <div class="info-value">${data.aprLogData.totalTokens}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">修正回数</div>
                    <div class="info-value">${data.aprLogData.modifications}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">影響ファイル数</div>
                    <div class="info-value">${data.aprLogData.affectedFiles}</div>
                </div>
                ${data.aprLogData.llmMetadata ? `
                <div class="info-item">
                    <div class="info-label">APRモデル</div>
                    <div class="info-value">${data.aprLogData.llmMetadata.provider}/${data.aprLogData.llmMetadata.model}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">APR実行日時</div>
                    <div class="info-value">${new Date(data.aprLogData.llmMetadata.firstInteractionTimestamp).toLocaleString('ja-JP')}</div>
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}

        ${data.changedFiles && data.changedFiles.length > 0 ? `
        <div class="section">
            <h2 class="section-title">📁 変更ファイル（データセット）</h2>
            <ul class="file-list">
                ${data.changedFiles.map(file => `<li>${file}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        ${data.aprDiffFiles && data.aprDiffFiles.length > 0 ? `
        <div class="section">
            <h2 class="section-title">🎯 APR差分ファイル</h2>
            <ul class="file-list">
                ${data.aprDiffFiles.map(file => `<li>${file}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        ${data.groundTruthDiff ? `
        <div class="section">
            <h2 class="section-title">📊 Ground Truth Diff</h2>
            <div class="code-block">${data.groundTruthDiff.substring(0, 2000)}${data.groundTruthDiff.length > 2000 ? '...\n[差分が長いため省略されました]' : ''}</div>
        </div>
        ` : ''}

        ${data.llmEvaluation ? `
        <div class="section">
            <h2 class="section-title">🤖 LLM評価結果</h2>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">総合評価</div>
                    <div class="info-value">${data.llmEvaluation.overall_assessment}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">正確性</div>
                    <div class="info-value">${data.llmEvaluation.is_correct ? '✅ 正しい' : '❌ 不正確'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">妥当性</div>
                    <div class="info-value">${data.llmEvaluation.is_plausible ? '✅ 妥当' : '❌ 妥当でない'}</div>
                </div>
                ${data.llmEvaluation.llmMetadata ? `
                <div class="info-item">
                    <div class="info-label">使用モデル</div>
                    <div class="info-value">${data.llmEvaluation.llmMetadata.provider}/${data.llmEvaluation.llmMetadata.model}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">評価日時</div>
                    <div class="info-value">${new Date(data.llmEvaluation.llmMetadata.timestamp).toLocaleString('ja-JP')}</div>
                </div>
                ${data.llmEvaluation.llmMetadata.usage ? `
                <div class="info-item">
                    <div class="info-label">トークン使用量</div>
                    <div class="info-value">${data.llmEvaluation.llmMetadata.usage.totalTokens || data.llmEvaluation.llmMetadata.usage.total_tokens || 'N/A'}</div>
                </div>
                ` : ''}
                ` : ''}
            </div>
        </div>
        ` : ''}

        <div class="timestamp">
            レポート生成日時: ${data.timestamp}
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * デフォルトのエラーレポートテンプレート
     * @param {Object} data - テンプレートデータ
     * @returns {string} HTMLテンプレート
     */
    getDefaultErrorTemplate(data) {
        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>エラーレポート</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; background-color: #f5f5f5; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); color: #333; }
        .header { border-bottom: 2px solid #dc3545; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #dc3545; font-size: 2.5em; margin: 0; }
        .section { margin: 30px 0; }
        .section-title { color: #333; font-size: 1.5em; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
        .error-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .error-card { background: #f8d7da; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545; }
        .error-type { font-weight: bold; color: #721c24; }
        .error-count { font-size: 1.5em; color: #dc3545; }
        .error-list { background: #fff5f5; padding: 20px; border-radius: 8px; max-height: 400px; overflow-y: auto; }
        .error-item { margin: 10px 0; padding: 15px; background: white; border-radius: 5px; border-left: 3px solid #dc3545; }
        .error-entry { font-weight: bold; color: #333; }
        .error-message { color: #666; margin-top: 5px; font-family: monospace; }
        .error-path { color: #888; font-size: 0.9em; margin-top: 5px; }
        .timestamp { color: #888; font-size: 0.9em; text-align: center; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">❌ エラーレポート</h1>
            <p>総エラー数: ${data.totalErrors}</p>
        </div>

        <div class="section">
            <h2 class="section-title">📊 エラータイプ別集計</h2>
            <div class="error-grid">
                ${Object.entries(data.errorsByType).map(([type, count]) => `
                <div class="error-card">
                    <div class="error-type">${type}</div>
                    <div class="error-count">${count} 件</div>
                </div>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">🔍 最近のエラー詳細</h2>
            <div class="error-list">
                ${data.recentErrors.map((error, index) => `
                <div class="error-item">
                    <div class="error-entry">[${index + 1}] ${error.datasetEntry}</div>
                    <div class="error-message">${error.error}</div>
                    <div class="error-path">パス: ${error.aprLogPath}</div>
                </div>
                `).join('')}
            </div>
        </div>

        <div class="timestamp">
            レポート生成日時: ${data.timestamp}
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * デフォルトの詳細分析テンプレート（フォールバック用）
     * @param {Object} data - レポートデータ
     * @returns {string} HTML文字列
     */
    getDefaultDetailedAnalysisTemplate(data) {
        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APRシステム詳細分析レポート</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; }
        .title { font-size: 2.5em; margin: 0; }
        .subtitle { font-size: 1.1em; margin: 10px 0 0 0; opacity: 0.9; }
        .section { margin: 40px 0; }
        .section-title { color: #333; font-size: 1.5em; margin-bottom: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #667eea; }
        .metric-value { font-size: 2em; font-weight: bold; color: #667eea; margin-bottom: 5px; }
        .metric-label { color: #666; font-size: 0.9em; }
        .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
        .data-table th { background: #667eea; color: white; padding: 12px; text-align: left; }
        .data-table td { padding: 12px; border-bottom: 1px solid #ddd; }
        .data-table tr:nth-child(even) { background: #f8f9fa; }
        .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; }
        .status-identical { background: #d4edda; color: #155724; }
        .status-semantically-equivalent { background: #cce5ff; color: #004085; }
        .status-plausible-but-different { background: #fff3cd; color: #856404; }
        .status-incorrect { background: #f8d7da; color: #721c24; }
        .tab-buttons { display: flex; gap: 5px; margin-bottom: 20px; }
        .tab-button { padding: 10px 20px; border: none; background: #e9ecef; cursor: pointer; border-radius: 5px; }
        .tab-button.active { background: #667eea; color: white; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .recommendation { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .recommendation.high { background: #f8d7da; border-color: #f5c6cb; }
        .timestamp { text-align: center; margin-top: 40px; color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">🔬 APRシステム詳細分析レポート</h1>
            <p class="subtitle">修正パフォーマンス・難易度・改善点の詳細分析</p>
        </div>

        <div class="section">
            <h2 class="section-title">📊 分析サマリー</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">${data.summary?.totalProcessed || 0}</div>
                    <div class="metric-label">分析対象総数</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${data.summary?.avgModifiedLines || 0}</div>
                    <div class="metric-label">平均修正行数</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${data.summary?.avgModifiedFiles || 0}</div>
                    <div class="metric-label">平均修正ファイル数</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${data.summary?.mostCommonProjects?.length || 0}</div>
                    <div class="metric-label">分析プロジェクト数</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">🎯 最終カテゴリ別詳細分析</h2>
            
            <div class="tab-buttons">
                <button class="tab-button active" onclick="showTab('correct')">🎯 CORRECT (${data.finalCategoryLevels?.correct?.length || 0})</button>
                <button class="tab-button" onclick="showTab('plausible')">🟡 PLAUSIBLE (${data.finalCategoryLevels?.plausible?.length || 0})</button>
                <button class="tab-button" onclick="showTab('incorrect')">❌ INCORRECT (${data.finalCategoryLevels?.incorrect?.length || 0})</button>
                <button class="tab-button" onclick="showTab('skipped')">⏭️ スキップ (${data.finalCategoryLevels?.skipped?.length || 0})</button>
            </div>

            <div id="correct" class="tab-content active">
                <h3>🎯 CORRECT</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>プロジェクト</th>
                            <th>PR名</th>
                            <th>修正ファイル数</th>
                            <th>修正行数</th>
                            <th>APRモデル</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.finalCategoryLevels?.correct?.map(item => `
                            <tr>
                                <td>${item.projectName || 'Unknown'}</td>
                                <td>${item.pullRequestName || 'Unknown'}</td>
                                <td>${item.modifiedFiles || 0}</td>
                                <td>${item.modifiedLines || 0}</td>
                                <td>${item.aprModel || 'Unknown'}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="5">データなし</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div id="plausible" class="tab-content">
                <h3>🟡 PLAUSIBLE</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>プロジェクト</th>
                            <th>PR名</th>
                            <th>修正ファイル数</th>
                            <th>修正行数</th>
                            <th>APRモデル</th>
                            <th>評価理由</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.finalCategoryLevels?.plausible?.map(item => `
                            <tr>
                                <td>${item.projectName || 'Unknown'}</td>
                                <td>${item.pullRequestName || 'Unknown'}</td>
                                <td>${item.modifiedFiles || 0}</td>
                                <td>${item.modifiedLines || 0}</td>
                                <td>${item.aprModel || 'Unknown'}</td>
                                <td title="${item.evaluationReasoning || ''}">${(item.evaluationReasoning || '').substring(0, 50)}${(item.evaluationReasoning || '').length > 50 ? '...' : ''}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="6">データなし</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div id="incorrect" class="tab-content">
                <h3>❌ INCORRECT</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>プロジェクト</th>
                            <th>PR名</th>
                            <th>修正ファイル数</th>
                            <th>修正行数</th>
                            <th>APRモデル</th>
                            <th>評価理由</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.finalCategoryLevels?.incorrect?.map(item => `
                            <tr>
                                <td>${item.projectName || 'Unknown'}</td>
                                <td>${item.pullRequestName || 'Unknown'}</td>
                                <td>${item.modifiedFiles || 0}</td>
                                <td>${item.modifiedLines || 0}</td>
                                <td>${item.aprModel || 'Unknown'}</td>
                                <td title="${item.evaluationReasoning || ''}">${(item.evaluationReasoning || '').substring(0, 50)}${(item.evaluationReasoning || '').length > 50 ? '...' : ''}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="6">データなし</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div id="skipped" class="tab-content">
                <h3>⏭️ スキップ（SKIPPED）</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>プロジェクト</th>
                            <th>PR名</th>
                            <th>APRモデル</th>
                            <th>スキップ理由</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.finalCategoryLevels?.skipped?.map(item => `
                            <tr>
                                <td>${item.projectName || 'Unknown'}</td>
                                <td>${item.pullRequestName || 'Unknown'}</td>
                                <td>${item.aprModel || 'Unknown'}</td>
                                <td>${item.skipReason || '理由不明'}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="4">データなし</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">💡 改善推奨事項</h2>
            ${data.summary?.difficultyAnalysis?.recommendations?.map(rec => `
                <div class="recommendation ${rec.priority}">
                    <h4>${rec.priority === 'high' ? '🚨' : rec.priority === 'medium' ? '⚠️' : '💡'} ${rec.title}</h4>
                    <p>${rec.description}</p>
                </div>
            `).join('') || '<p>推奨事項なし</p>'}
        </div>

        <div class="timestamp">
            レポート生成日時: ${data.timestamp}
        </div>
    </div>

    <script>
        function showTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.querySelectorAll('.tab-button').forEach(button => {
                button.classList.remove('active');
            });
            document.getElementById(tabName).classList.add('active');
            event.target.classList.add('active');
        }
    </script>
</body>
</html>`;
    }

    /**
     * スキップ理由の日本語説明を取得
     * @param {string} reason - スキップ理由コード
     * @returns {string} 日本語説明
     */
    getSkipReasonDescription(reason) {
        const descriptions = {
            'NO_INTERACTION_LOG': 'APRログにinteraction_logが存在しない',
            'EMPTY_INTERACTION_LOG': 'interaction_logが空',
            'NO_MODIFICATION_PROPERTY': '全ターンでmodified_diffプロパティが見つからない',
            'ALL_MODIFICATIONS_NULL': '全ターンでmodified_diffがnull（修正生成なし）',
            'INVESTIGATION_PHASE': '調査フェーズ中（reply_requiredあり、修正生成なし）',
            'FINAL_TURN_NO_MODIFICATION': '最終ターンに修正なし（途中ターンで修正あり）',
            'EXTRACTION_LOGIC_ERROR': '抽出ロジックエラー（予期しない状態）'
        };
        
        return descriptions[reason] || `未知の理由: ${reason}`;
    }
}
