#!/usr/bin/env node
/**
 * NO_INTERACTION_LOG問題の調査スクリプト
 */

import fs from 'fs/promises';

async function main() {
    const statsPath = '/app/output/statistics_data_260113_223614.json';
    
    console.log('📊 statistics_dataを読み込み中...');
    const statsData = JSON.parse(await fs.readFile(statsPath, 'utf-8'));
    
    console.log(`\n✅ matchedPairs総数: ${statsData.matchedPairs.length}`);
    
    // 評価状況の分類
    let evaluated = 0;
    let skipped = 0;
    let skipReasons = {};
    
    for (const pair of statsData.matchedPairs) {
        const intent = pair.finalModification?.intentFulfillmentEvaluation;
        
        if (intent?.evaluationSkipped) {
            skipped++;
            const reason = intent.skipReason?.reason || 'UNKNOWN';
            skipReasons[reason] = (skipReasons[reason] || 0) + 1;
        } else if (intent) {
            evaluated++;
        }
    }
    
    console.log(`\n📈 Intent評価状況:`);
    console.log(`  - 評価完了: ${evaluated}件`);
    console.log(`  - スキップ: ${skipped}件`);
    console.log(`\n⚠️ スキップ理由:`);
    for (const [reason, count] of Object.entries(skipReasons)) {
        console.log(`  - ${reason}: ${count}件`);
    }
    
    // NO_INTERACTION_LOGケースの詳細調査
    console.log(`\n🔍 NO_INTERACTION_LOGケースの詳細（最初の3件）:\n`);
    
    let noInteractionCount = 0;
    for (const pair of statsData.matchedPairs) {
        const intent = pair.finalModification?.intentFulfillmentEvaluation;
        
        if (intent?.evaluationSkipped && intent.skipReason?.reason === 'NO_INTERACTION_LOG') {
            if (noInteractionCount < 3) {
                console.log(`--- ケース ${noInteractionCount + 1} ---`);
                console.log(`Project: ${pair.projectName}`);
                console.log(`Issue: ${pair.pullRequestName || 'N/A'}`);
                console.log(`APR Log Path: ${pair.aprLogPath || 'N/A'}`);
                console.log(`Metadata:`);
                console.log(JSON.stringify(intent.skipReason.metadata, null, 2));
                console.log('');
            }
            noInteractionCount++;
        }
    }
    
    console.log(`合計 ${noInteractionCount}件のNO_INTERACTION_LOGケース\n`);
    
    // 評価成功ケースのメタデータも確認
    console.log(`\n✅ 評価成功ケースの例（最初の2件）:\n`);
    
    let successCount = 0;
    for (const pair of statsData.matchedPairs) {
        const intent = pair.finalModification?.intentFulfillmentEvaluation;
        
        if (intent && !intent.evaluationSkipped) {
            if (successCount < 2) {
                console.log(`--- 成功ケース ${successCount + 1} ---`);
                console.log(`Project: ${pair.projectName}`);
                console.log(`Issue: ${pair.pullRequestName || 'N/A'}`);
                console.log(`Score: ${intent.score}`);
                console.log(`Metadata (if available):`);
                console.log(JSON.stringify(pair.finalModification?.metadata, null, 2));
                console.log('');
            }
            successCount++;
        }
    }
}

main().catch(console.error);
