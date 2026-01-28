// statsデータをデバッグするスクリプト

import fs from 'fs';

// テスト用: 生成されたレポートからstatsを復元
const reportPath = process.argv[2] || '/app/output/detailed_analysis_report_260128_142910.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

console.log('=== extractDetailedEvaluationData への入力データ確認 ===\n');

// extractDetailedEvaluationDataが期待するstats.matchedPairs構造を確認
// 問題: matched_pairsの各pairにfinalModification.llmEvaluationがあるかどうか

console.log('レポートのmatched_pairs構造:');
for (const pair of report.matched_pairs) {
    console.log(`\nPR: ${pair.pullRequestName}`);
    console.log(`  datasetEntry: ${pair.datasetEntry}`);
    console.log(`  status: ${pair.status}`);
    
    // finalModificationの存在確認
    if (pair.finalModification) {
        console.log(`  finalModification: あり`);
        console.log(`    keys: ${Object.keys(pair.finalModification).join(', ')}`);
        console.log(`    llmEvaluation: ${pair.finalModification.llmEvaluation ? 'あり' : 'なし'}`);
    } else {
        console.log(`  finalModification: なし`);
    }
    
    // 4軸評価の存在確認
    console.log(`  fourAxisEvaluation: ${pair.fourAxisEvaluation ? 'あり' : 'なし'}`);
    console.log(`  finalCategory: ${pair.finalCategory || 'null'}`);
    
    // intentFulfillmentEvaluationの存在確認
    console.log(`  intentFulfillmentEvaluation: ${pair.intentFulfillmentEvaluation ? 'あり' : 'なし'}`);
}
