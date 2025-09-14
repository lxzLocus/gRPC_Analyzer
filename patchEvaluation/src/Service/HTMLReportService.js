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
        const reportData = {
            timestamp,
            stats: this.extractStatsData(stats),
            averageStats: this.calculateAverageStats(stats), // パフォーマンス統計を追加
            successfulMatches: stats.matchedPairs.slice(0, 10), // 最初の10件を表示
            errorEntries: stats.errorEntries.slice(0, 20), // 最初の20件を表示
            unmatchedEntries: stats.unmatchedEntries.slice(0, 15) // 最初の15件を表示
        };

        const htmlContent = await this.renderStatisticsTemplate(reportData);
        const fileName = `statistics_report_${timestamp.replace(/[:.]/g, '-')}.html`;
        // 全体評価結果は /output 直下に出力
        const filePath = path.join(this.outputBaseDir, fileName);
        
        // /output ディレクトリが存在することを確認
        await fs.mkdir(this.outputBaseDir, { recursive: true });
        await fs.writeFile(filePath, htmlContent, 'utf-8');
        
        // JSON版も同時に出力（/output 直下）
        const jsonFileName = `statistics_data_${timestamp.replace(/[:.]/g, '-')}.json`;
        const jsonFilePath = path.join(this.outputBaseDir, jsonFileName);
        await fs.writeFile(jsonFilePath, JSON.stringify(reportData, null, 2), 'utf-8');
        
        console.log(`📊 HTMLレポート生成完了: ${filePath}`);
        console.log(`📊 JSONデータ出力完了: ${jsonFilePath}`);
        
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
            llmStats: this.extractLLMStats(stats)
        };
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
            return {
                turns: acc.turns + (aprLogData.turns || 0),
                tokens: acc.tokens + (aprLogData.totalTokens || 0),
                modifications: acc.modifications + (aprLogData.modifications || 0),
                affectedFiles: acc.affectedFiles + (aprLogData.affectedFiles || 0)
            };
        }, { turns: 0, tokens: 0, modifications: 0, affectedFiles: 0 });

        const count = stats.matchedPairs.length;
        
        return {
            turns: Math.round(totals.turns / count * 10) / 10, // 小数点第1位まで
            tokens: Math.round(totals.tokens / count),
            modifications: Math.round(totals.modifications / count * 10) / 10,
            affectedFiles: Math.round(totals.affectedFiles / count * 10) / 10
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
        
        errorEntries.forEach(entry => {
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
     * エラーの分類
     * @param {string} errorMessage - エラーメッセージ
     * @returns {string} エラーカテゴリ
     */
    categorizeError(errorMessage) {
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
}
