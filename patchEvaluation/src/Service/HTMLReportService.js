/**
 * HTMLレポート生成サービス
 * ログデータを視覚的に分かりやすいHTMLレポートに変換
 */
import fs from 'fs/promises';
import path from 'path';

export class HTMLReportService {
    constructor(config) {
        this.config = config;
        this.reportsDir = path.join(config.outputDir, 'reports');
        this.templateDir = path.join('/app', 'templates');
        this.assetsDir = path.join(this.reportsDir, 'assets');
        
        this.initializeDirectories();
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
     * 統計レポートのHTML生成
     * @param {Object} stats - ProcessingStats オブジェクト
     * @param {string} timestamp - レポート生成時刻
     * @returns {Promise<string>} 生成されたHTMLファイルのパス
     */
    async generateStatisticsReport(stats, timestamp = new Date().toISOString()) {
        const reportData = {
            timestamp,
            stats: this.extractStatsData(stats),
            successfulMatches: stats.matchedPairs.slice(0, 10), // 最初の10件を表示
            errorEntries: stats.errorEntries.slice(0, 20), // 最初の20件を表示
            unmatchedEntries: stats.unmatchedEntries.slice(0, 15) // 最初の15件を表示
        };

        const htmlContent = await this.renderStatisticsTemplate(reportData);
        const fileName = `statistics_report_${timestamp.replace(/[:.]/g, '-')}.html`;
        const filePath = path.join(this.reportsDir, fileName);
        
        await fs.writeFile(filePath, htmlContent, 'utf-8');
        
        // JSON版も同時に出力
        const jsonFileName = `statistics_data_${timestamp.replace(/[:.]/g, '-')}.json`;
        const jsonFilePath = path.join(this.reportsDir, jsonFileName);
        await fs.writeFile(jsonFilePath, JSON.stringify(reportData, null, 2), 'utf-8');
        
        console.log(`📊 HTMLレポート生成完了: ${filePath}`);
        console.log(`📊 JSONデータ出力完了: ${jsonFilePath}`);
        
        return filePath;
    }

    /**
     * 個別エントリーの詳細レポート生成
     * @param {Object} matchedPair - マッチングペアデータ
     * @param {string} timestamp - レポート生成時刻
     * @returns {Promise<string>} 生成されたHTMLファイルのパス
     */
    async generateEntryDetailReport(matchedPair, timestamp = new Date().toISOString()) {
        const reportData = {
            timestamp,
            entryId: matchedPair.datasetEntry,
            ...matchedPair
        };

        const htmlContent = await this.renderEntryDetailTemplate(reportData);
        const fileName = `entry_detail_${matchedPair.datasetEntry.replace(/[/\\:*?"<>|]/g, '_')}_${timestamp.replace(/[:.]/g, '-')}.html`;
        const filePath = path.join(this.reportsDir, fileName);
        
        await fs.writeFile(filePath, htmlContent, 'utf-8');
        
        // JSON版も同時に出力
        const jsonFileName = `entry_data_${matchedPair.datasetEntry.replace(/[/\\:*?"<>|]/g, '_')}_${timestamp.replace(/[:.]/g, '-')}.json`;
        const jsonFilePath = path.join(this.reportsDir, jsonFileName);
        await fs.writeFile(jsonFilePath, JSON.stringify(reportData, null, 2), 'utf-8');
        
        console.log(`📝 エントリー詳細レポート生成完了: ${filePath}`);
        
        return filePath;
    }

    /**
     * エラーレポートの生成
     * @param {Array} errorEntries - エラーエントリーリスト
     * @param {string} timestamp - レポート生成時刻
     * @returns {Promise<string>} 生成されたHTMLファイルのパス
     */
    async generateErrorReport(errorEntries, timestamp = new Date().toISOString()) {
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
            
            // 成功率計算
            aprFoundRate: stats.calculateAprFoundRate(),
            step1CompletionRate: stats.calculateStep1CompletionRate(),
            evaluationPipelineSuccessRate: stats.calculateEvaluationPipelineSuccessRate(),
            parseSuccessFromFound: stats.calculateParseSuccessFromFound(),
            
            // 詳細統計
            matchedPairsCount: stats.matchedPairs.length,
            unmatchedEntriesCount: stats.unmatchedEntries.length,
            errorEntriesCount: stats.errorEntries.length
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
     * シンプルなテンプレート処理エンジン
     * @param {string} template - HTMLテンプレート
     * @param {Object} data - テンプレートデータ
     * @returns {string} 処理されたHTML
     */
    processTemplate(template, data) {
        let result = template;
        
        // {{key}} 形式の変数を置換
        result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return this.getNestedValue(data, key) || '';
        });
        
        // {{#each array}} ... {{/each}} 形式のループ処理
        result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayKey, loopContent) => {
            const array = this.getNestedValue(data, arrayKey) || [];
            return array.map(item => {
                return this.processTemplate(loopContent, { ...data, this: item });
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
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
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
        .section { margin: 40px 0; }
        .section-title { color: #333; font-size: 1.5em; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
        .progress-bar { background: #e9ecef; border-radius: 10px; overflow: hidden; height: 20px; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #007acc, #28a745); transition: width 0.3s ease; }
        .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .data-table th, .data-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .data-table th { background-color: #f8f9fa; font-weight: 600; color: #333; }
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
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
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
        .file-list li { background: white; margin: 5px 0; padding: 10px; border-radius: 5px; border-left: 3px solid #28a745; }
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
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
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
