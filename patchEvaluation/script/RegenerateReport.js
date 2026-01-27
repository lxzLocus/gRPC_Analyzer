/**
 * statistics_dataからレポートを再生成するスクリプト
 */
import path from 'path';
import fs from 'fs/promises';
import { ProcessingStats } from '../src/Model/ProcessingStats.js';
import { HTMLReportController } from '../src/Controller/HTMLReportController.js';
import Config from '../src/Config/config.js';

async function regenerateReport() {
    const sessionId = '260113_200922';
    const statsDataFile = `/app/output/statistics_data_260113_200922.json`;
    
    console.log(`🔄 セッション ${sessionId} のレポートを再生成中...`);
    
    try {
        // statistics_dataファイルの読み込み
        const statsData = JSON.parse(await fs.readFile(statsDataFile, 'utf-8'));
        console.log(`✅ statistics_dataファイル読み込み完了`);
        
        // ProcessingStatsの再構築
        const stats = new ProcessingStats();
        
        // 基本統計をコピー
        Object.assign(stats, statsData.stats);
        
        // matchedPairs、errorEntriesを読み込み
        if (statsData.matchedPairs) {
            stats.matchedPairs = statsData.matchedPairs;
        }
        if (statsData.errorEntries) {
            stats.errorEntries = statsData.errorEntries;
        }
        if (statsData.unmatchedEntries) {
            stats.unmatchedEntries = statsData.unmatchedEntries;
        }
        
        console.log(`📊 統計情報:`);
        console.log(`   総エントリー数: ${stats.totalDatasetEntries}`);
        console.log(`   マッチングペア数: ${stats.matchedPairs.length}`);
        console.log(`   エラーエントリー数: ${stats.errorEntries.length}`);
        console.log(`   未マッチングエントリー数: ${stats.unmatchedEntries.length}`);
        
        // 設定の初期化
        const config = new Config();
        const htmlReportController = new HTMLReportController(config);
        
        // 詳細分析レポートの生成
        console.log(`📝 詳細分析レポート生成中...`);
        await htmlReportController.generateDetailedAnalysisReport(stats, sessionId);
        
        console.log(`✅ レポート再生成完了！`);
        console.log(`📄 /app/output/detailed_analysis_report_${sessionId}.html`);
        console.log(`📄 /app/output/detailed_analysis_report_${sessionId}.json`);
        
    } catch (error) {
        console.error(`❌ エラー:`, error);
        console.error(error.stack);
    }
}

regenerateReport();
