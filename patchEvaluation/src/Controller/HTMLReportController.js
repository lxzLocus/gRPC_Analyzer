/**
 * HTMLレポート生成コントローラー
 * 統計データとエラー情報をHTMLレポートとして出力
 */
import path from 'path';
import { HTMLReportService } from '../Service/HTMLReportService.js';

export class HTMLReportController {
    constructor(config) {
        this.config = config;
        this.htmlReportService = new HTMLReportService(config);
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
     * 統計レポートの生成と出力
     * @param {Object} stats - ProcessingStats オブジェクト
     * @param {string} sessionId - セッションID（オプション）
     * @returns {Promise<Object>} 生成されたレポートの情報
     */
    async generateStatisticsReport(stats, sessionId = null) {
        const timestamp = this.getJSTTimestamp();
        const reportId = sessionId || this.generateReportId();
        
        try {
            const htmlPath = await this.htmlReportService.generateStatisticsReport(stats, timestamp);
            
            // インデックスファイルの更新
            await this.updateReportIndex({
                type: 'statistics',
                reportId,
                timestamp,
                htmlPath,
                stats: {
                    totalEntries: stats.totalDatasetEntries,
                    successRate: stats.calculateStep1CompletionRate(),
                    evaluationSuccessRate: stats.calculateEvaluationPipelineSuccessRate()
                }
            });
            
            console.log(`📊 統計レポート生成完了:`);
            console.log(`   📄 HTML: ${htmlPath}`);
            console.log(`   🔗 ブラウザで開く: file://${htmlPath}`);
            
            return {
                success: true,
                reportId,
                htmlPath,
                timestamp,
                type: 'statistics'
            };
            
        } catch (error) {
            console.error(`❌ 統計レポート生成エラー: ${error.message}`);
            return {
                success: false,
                error: error.message,
                reportId,
                timestamp,
                type: 'statistics'
            };
        }
    }

    /**
     * エラーレポートの生成と出力
     * @param {Array} errorEntries - エラーエントリーリスト
     * @param {string} sessionId - セッションID（オプション）
     * @returns {Promise<Object>} 生成されたレポートの情報
     */
    async generateErrorReport(errorEntries, sessionId = null) {
        const timestamp = this.getJSTTimestamp();
        const reportId = sessionId || this.generateReportId();
        
        // デバッグ情報の追加
        console.log('🔍 generateErrorReport - errorEntries type:', typeof errorEntries);
        console.log('🔍 generateErrorReport - errorEntries isArray:', Array.isArray(errorEntries));
        console.log('🔍 generateErrorReport - errorEntries length:', errorEntries?.length);
        
        // errorEntriesの検証
        if (!Array.isArray(errorEntries)) {
            const error = new Error(`Invalid errorEntries: expected array, got ${typeof errorEntries}`);
            console.error(`❌ エラーレポート生成エラー: ${error.message}`);
            return {
                success: false,
                error: error.message,
                reportId,
                timestamp,
                type: 'error'
            };
        }
        
        try {
            const htmlPath = await this.htmlReportService.generateErrorReport(errorEntries, timestamp);
            
            // インデックスファイルの更新
            await this.updateReportIndex({
                type: 'error',
                reportId,
                timestamp,
                htmlPath,
                stats: {
                    totalErrors: errorEntries.length,
                    errorTypes: this.getErrorTypeCount(errorEntries)
                }
            });
            
            console.log(`❌ エラーレポート生成完了:`);
            console.log(`   📄 HTML: ${htmlPath}`);
            console.log(`   🔗 ブラウザで開く: file://${htmlPath}`);
            
            return {
                success: true,
                reportId,
                htmlPath,
                timestamp,
                type: 'error'
            };
            
        } catch (error) {
            console.error(`❌ エラーレポート生成エラー: ${error.message}`);
            return {
                success: false,
                error: error.message,
                reportId,
                timestamp,
                type: 'error'
            };
        }
    }

    /**
     * 個別エントリー詳細レポートの生成
     * @param {Object} matchedPair - マッチングペアデータ
     * @param {string} sessionId - セッションID（オプション）
     * @returns {Promise<Object>} 生成されたレポートの情報
     */
    async generateEntryDetailReport(matchedPair, sessionId = null) {
        const timestamp = this.getJSTTimestamp();
        const reportId = sessionId || this.generateReportId();
        
        try {
            const htmlPath = await this.htmlReportService.generateEntryDetailReport(matchedPair, timestamp);
            
            console.log(`📝 エントリー詳細レポート生成完了:`);
            console.log(`   📄 HTML: ${htmlPath}`);
            console.log(`   🔗 ブラウザで開く: file://${htmlPath}`);
            
            return {
                success: true,
                reportId,
                htmlPath,
                timestamp,
                type: 'entry-detail',
                entryId: matchedPair.datasetEntry
            };
            
        } catch (error) {
            console.error(`❌ エントリー詳細レポート生成エラー: ${error.message}`);
            return {
                success: false,
                error: error.message,
                reportId,
                timestamp,
                type: 'entry-detail',
                entryId: matchedPair.datasetEntry
            };
        }
    }

    /**
     * 包括的レポート生成（統計＋エラー）
     * @param {Object} stats - ProcessingStats オブジェクト
     * @param {string} sessionId - セッションID（オプション）
     * @returns {Promise<Object>} 生成されたレポートの情報
     */
    async generateComprehensiveReport(stats, sessionId = null) {
        const reportId = sessionId || this.generateReportId();
        const results = {
            sessionId: reportId,
            timestamp: this.getJSTTimestamp(),
            reports: []
        };
        
        try {
            // 統計レポート生成
            const statsReport = await this.generateStatisticsReport(stats, reportId);
            results.reports.push(statsReport);
            
            // エラーレポート生成（エラーがある場合のみ）
            if (stats.errorEntries && stats.errorEntries.length > 0) {
                const errorReport = await this.generateErrorReport(stats.errorEntries, reportId);
                results.reports.push(errorReport);
            }
            
            // 成功したマッチングペアの詳細レポート生成（最初の5件）
            if (stats.matchedPairs && stats.matchedPairs.length > 0) {
                const detailReports = await Promise.all(
                    stats.matchedPairs.slice(0, 5).map(pair => 
                        this.generateEntryDetailReport(pair, reportId)
                    )
                );
                results.reports.push(...detailReports);
            }
            
            // レポートサマリーの生成
            await this.generateReportSummary(results);
            
            console.log(`🎉 包括的レポート生成完了:`);
            console.log(`   📂 セッションID: ${reportId}`);
            console.log(`   📊 生成されたレポート数: ${results.reports.length}`);
            
            return results;
            
        } catch (error) {
            console.error(`❌ 包括的レポート生成エラー: ${error.message}`);
            results.error = error.message;
            return results;
        }
    }

    /**
     * レポートサマリーHTML生成（/output 直下に出力）
     * @param {Array} reportResults - レポート生成結果の配列
     * @returns {Promise<string>} サマリーHTMLファイルのパス
     */
    async generateReportSummary(reportResults) {
        // sessionIdを最初の結果から取得（存在する場合）
        const sessionId = Array.isArray(reportResults) && reportResults.length > 0 && reportResults[0].reportId 
            ? reportResults[0].reportId 
            : 'unknown-session';
            
        const summaryHTML = this.buildSummaryHTML(reportResults);
        // 全体サマリーは /output 直下に出力
        const summaryPath = path.join(this.htmlReportService.outputBaseDir, `report_summary_${sessionId.replace(/[:.]/g, '-')}.html`);
        
        // /output ディレクトリが存在することを確認
        await import('fs/promises').then(fs => fs.mkdir(this.htmlReportService.outputBaseDir, { recursive: true }));
        await import('fs/promises').then(fs => fs.writeFile(summaryPath, summaryHTML, 'utf-8'));
        
        console.log(`📋 レポートサマリー生成完了: ${summaryPath}`);
        return { filePath: summaryPath };
    }

    /**
     * サマリーHTML構築
     * @param {Array} reportResults - レポート生成結果の配列
     * @returns {string} サマリーHTML
     */
    buildSummaryHTML(reportResults) {
        // reportResultsが配列でない場合や未定義の場合の安全な処理
        if (!Array.isArray(reportResults)) {
            console.warn('⚠️ buildSummaryHTML - reportResults is not an array:', typeof reportResults);
            const emptyResults = [];
            return this.generateSummaryTemplate(emptyResults, emptyResults, 'unknown-session');
        }
        
        const successfulReports = reportResults.filter(r => r && r.success === true);
        const failedReports = reportResults.filter(r => r && r.success === false);
        
        // sessionIdを最初の結果から取得（存在する場合）
        const sessionId = reportResults.length > 0 && reportResults[0].reportId 
            ? reportResults[0].reportId 
            : 'unknown-session';
        
        return this.generateSummaryTemplate(successfulReports, failedReports, sessionId);
    }

    /**
     * サマリーHTMLテンプレート生成
     * @param {Array} successfulReports - 成功したレポート
     * @param {Array} failedReports - 失敗したレポート
     * @param {string} sessionId - セッションID
     * @returns {string} サマリーHTML
     */
    generateSummaryTemplate(successfulReports, failedReports, sessionId) {
        const totalReports = successfulReports.length + failedReports.length;
        
        // ラベル変換用の関数
        const getTypeLabel = (type) => {
            const labels = {
                'statistics': '📊 統計レポート',
                'error': '❌ エラーレポート',
                'entry-detail': '📝 エントリー詳細'
            };
            return labels[type] || type;
        };
        
        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>レポートサマリー - ${sessionId}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #007acc; font-size: 2.5em; margin: 0; }
        .session-id { color: #666; font-family: monospace; background: #f8f9fa; padding: 8px 12px; border-radius: 4px; margin: 10px 0; }
        .section { margin: 30px 0; }
        .section-title { color: #333; font-size: 1.5em; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
        .report-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .report-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007acc; }
        .report-type { font-weight: bold; color: #007acc; text-transform: uppercase; }
        .report-link { color: #007acc; text-decoration: none; font-size: 0.9em; margin-top: 10px; display: block; }
        .report-link:hover { text-decoration: underline; }
        .stats { background: #e8f5e8; border-left-color: #28a745; }
        .error { background: #ffeaea; border-left-color: #dc3545; }
        .detail { background: #e6f3ff; border-left-color: #17a2b8; }
        .timestamp { color: #888; font-size: 0.9em; text-align: center; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">📋 レポートサマリー</h1>
            <div class="session-id">セッション: ${sessionId}</div>
        </div>

        <div class="section">
            <h2 class="section-title">📊 生成されたレポート (${successfulReports.length}/${totalReports})</h2>
            <div class="report-grid">
                ${successfulReports.map(report => `
                <div class="report-card ${report.type === 'statistics' ? 'stats' : report.type === 'error' ? 'error' : 'detail'}">
                    <div class="report-type">${getTypeLabel(report.type)}</div>
                    <div>${report.entryId || '全体統計'}</div>
                    <a href="file://${report.htmlPath}" class="report-link" target="_blank">📄 レポートを開く</a>
                </div>
                `).join('')}
            </div>
        </div>

        ${failedReports.length > 0 ? `
        <div class="section">
            <h2 class="section-title">❌ 生成失敗レポート (${failedReports.length})</h2>
            <div class="report-grid">
                ${failedReports.map(report => `
                <div class="report-card error">
                    <div class="report-type">${getTypeLabel(report.type)}</div>
                    <div>エラー: ${report.error}</div>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <div class="timestamp">
            生成日時: ${new Date().toLocaleString('ja-JP')}
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * レポートタイプのラベル取得
     * @param {string} type - レポートタイプ
     * @returns {string} 表示用ラベル
     */
    getReportTypeLabel(type) {
        const labels = {
            'statistics': '📊 統計レポート',
            'error': '❌ エラーレポート',
            'entry-detail': '📝 エントリー詳細'
        };
        return labels[type] || type;
    }

    /**
     * エラータイプの件数集計
     * @param {Array} errorEntries - エラーエントリーリスト
     * @returns {number} エラータイプ数
     */
    getErrorTypeCount(errorEntries) {
        // デバッグ情報の追加
        console.log('🔍 getErrorTypeCount - errorEntries type:', typeof errorEntries);
        console.log('🔍 getErrorTypeCount - errorEntries isArray:', Array.isArray(errorEntries));
        console.log('🔍 getErrorTypeCount - errorEntries length:', errorEntries?.length);
        console.log('🔍 getErrorTypeCount - errorEntries sample:', errorEntries?.[0]);
        
        // errorEntriesが配列でない場合や未定義の場合の安全な処理
        if (!Array.isArray(errorEntries)) {
            console.warn('⚠️ getErrorTypeCount - errorEntries is not an array, returning 0');
            return 0;
        }
        
        const types = new Set();
        errorEntries.forEach(entry => {
            if (entry && entry.error) {
                types.add(this.htmlReportService.categorizeError(entry.error));
            } else {
                console.warn('⚠️ getErrorTypeCount - Invalid error entry:', entry);
            }
        });
        return types.size;
    }

    /**
     * レポートインデックスファイルの更新
     * @param {Object} reportInfo - レポート情報
     * @returns {Promise<void>}
     */
    async updateReportIndex(reportInfo) {
        const indexPath = `${this.htmlReportService.reportsDir}/index.json`;
        let index = [];
        
        try {
            const fs = await import('fs/promises');
            const existingIndex = await fs.readFile(indexPath, 'utf-8');
            index = JSON.parse(existingIndex);
        } catch (error) {
            // インデックスファイルが存在しない場合は新規作成
        }
        
        index.unshift(reportInfo); // 最新を先頭に追加
        
        // 最新50件のみ保持
        if (index.length > 50) {
            index = index.slice(0, 50);
        }
        
        const fs = await import('fs/promises');
        await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    }

    /**
     * 詳細分析レポートの生成と出力
     * @param {Object} stats - ProcessingStats オブジェクト
     * @param {string} sessionId - セッションID（オプション）
     * @returns {Promise<Object>} 生成されたレポートの情報
     */
    async generateDetailedAnalysisReport(stats, sessionId = null) {
        const timestamp = this.getJSTTimestamp();
        const reportId = sessionId || this.generateReportId();
        
        try {
            const htmlPath = await this.htmlReportService.generateDetailedAnalysisReport(stats, timestamp);
            
            // インデックスファイルの更新
            await this.updateReportIndex({
                type: 'detailed_analysis',
                id: reportId,
                timestamp: timestamp,
                path: htmlPath,
                description: `詳細分析レポート (${stats.matchedPairs.length}件のマッチングペア)`
            });
            
            return {
                type: 'detailed_analysis',
                id: reportId,
                timestamp: timestamp,
                path: htmlPath,
                success: true,
                description: '詳細分析レポート'
            };
            
        } catch (error) {
            console.error(`❌ 詳細分析レポート生成エラー: ${error.message}`);
            throw error;
        }
    }

    /**
     * レポートID生成
     * @returns {string} ユニークなレポートID
     */
    generateReportId() {
        const timestamp = this.getJSTTimestamp().replace(/[:.]/g, '-');
        const random = Math.random().toString(36).substring(2, 8);
        return `${timestamp}_${random}`;
    }
}
