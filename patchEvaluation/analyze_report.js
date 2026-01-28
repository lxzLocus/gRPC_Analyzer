#!/usr/bin/env node

const fs = require('fs');

// JSONファイルを読み込み
const filePath = '/app/output/detailed_analysis_report_260128_134135.json';
let data;
try {
    const content = fs.readFileSync(filePath, 'utf-8');
    data = JSON.parse(content);
} catch (error) {
    console.error('ファイル読み込みエラー:', error.message);
    process.exit(1);
}

console.log('📊 実際の統計データ分析');
console.log('='.repeat(60));

// マッチングペア数
console.log(`📦 総マッチングペア数: ${data.matched_pairs ? data.matched_pairs.length : 0}件`);

// Intent Fulfillment統計
const intentStats = {
    totalEvaluated: 0,
    INTENT_FULFILLED: 0,
    INTENT_PARTIALLY_FULFILLED: 0,
    INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED: 0,
    INTENT_NOT_FULFILLED: 0,
    UNKNOWN: 0,
    scores: []
};

// 4軸評価統計
const fourAxisStats = {
    totalEvaluated: 0,
    accuracy: { FULL_MATCH: 0, PARTIAL_MATCH: 0, NO_MATCH: 0, UNKNOWN: 0 },
    overall_assessment: { CORRECT: 0, PLAUSIBLE: 0, INCORRECT: 0, UNKNOWN: 0 }
};

// APRステータス統計
const aprStats = {
    FINISHED: 0,
    ERROR: 0,
    NO_CHANGES_NEEDED: 0,
    SKIPPED: 0
};

// データ分析
if (data.matched_pairs) {
    data.matched_pairs.forEach((pair, index) => {
        // Intent Fulfillment統計
        if (pair.intentFulfillmentEvaluation && pair.intentFulfillmentEvaluation.data) {
            const intentData = pair.intentFulfillmentEvaluation.data;
            if (intentData.label) {
                intentStats.totalEvaluated++;
                if (intentStats[intentData.label] !== undefined) {
                    intentStats[intentData.label]++;
                } else {
                    intentStats.UNKNOWN++;
                }
                
                if (typeof intentData.score === 'number') {
                    intentStats.scores.push(intentData.score);
                }
            }
        }
        
        // 4軸評価統計
        if (pair.fourAxisEvaluation && pair.fourAxisEvaluation.accuracy) {
            fourAxisStats.totalEvaluated++;
            
            // accuracy
            if (pair.fourAxisEvaluation.accuracy.label) {
                const accLabel = pair.fourAxisEvaluation.accuracy.label.toUpperCase();
                if (fourAxisStats.accuracy[accLabel] !== undefined) {
                    fourAxisStats.accuracy[accLabel]++;
                } else {
                    fourAxisStats.accuracy.UNKNOWN++;
                }
            }
            
            // overall assessment
            if (pair.fourAxisEvaluation.overall_assessment) {
                const overallLabel = pair.fourAxisEvaluation.overall_assessment.toUpperCase();
                if (fourAxisStats.overall_assessment[overallLabel] !== undefined) {
                    fourAxisStats.overall_assessment[overallLabel]++;
                } else {
                    fourAxisStats.overall_assessment.UNKNOWN++;
                }
            }
        }
        
        // APRステータス統計
        if (pair.aprStatus) {
            if (aprStats[pair.aprStatus] !== undefined) {
                aprStats[pair.aprStatus]++;
            } else {
                aprStats.SKIPPED++;
            }
        }
        
        // デバッグ: 最初の5件を詳細表示
        if (index < 5) {
            console.log(`\n📝 エントリ ${index + 1}: ${pair.pullRequestName}`);
            console.log(`   - APRステータス: ${pair.aprStatus}`);
            console.log(`   - Intent評価: ${pair.intentFulfillmentEvaluation?.data?.label || 'なし'}`);
            console.log(`   - 4軸評価: ${pair.fourAxisEvaluation ? 'あり' : 'なし'}`);
        }
    });
}

console.log('\n📊 Intent Fulfillment統計（LLM_C）:');
console.log(`   評価実行数: ${intentStats.totalEvaluated}件`);
console.log(`   - INTENT_FULFILLED: ${intentStats.INTENT_FULFILLED}件`);
console.log(`   - INTENT_PARTIALLY_FULFILLED: ${intentStats.INTENT_PARTIALLY_FULFILLED}件`);
console.log(`   - INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED: ${intentStats.INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED}件`);
console.log(`   - INTENT_NOT_FULFILLED: ${intentStats.INTENT_NOT_FULFILLED}件`);
console.log(`   - UNKNOWN: ${intentStats.UNKNOWN}件`);

if (intentStats.scores.length > 0) {
    const avgScore = intentStats.scores.reduce((a, b) => a + b, 0) / intentStats.scores.length;
    console.log(`   平均スコア: ${avgScore.toFixed(3)} (${(avgScore * 100).toFixed(1)}%)`);
}

console.log('\n📊 4軸評価統計（LLM_B）:');
console.log(`   評価実行数: ${fourAxisStats.totalEvaluated}件`);
if (fourAxisStats.totalEvaluated > 0) {
    console.log(`   - Accuracy: FULL_MATCH=${fourAxisStats.accuracy.FULL_MATCH}, PARTIAL_MATCH=${fourAxisStats.accuracy.PARTIAL_MATCH}, NO_MATCH=${fourAxisStats.accuracy.NO_MATCH}`);
    console.log(`   - Overall: CORRECT=${fourAxisStats.overall_assessment.CORRECT}, PLAUSIBLE=${fourAxisStats.overall_assessment.PLAUSIBLE}, INCORRECT=${fourAxisStats.overall_assessment.INCORRECT}`);
}

console.log('\n📊 APRステータス分布:');
console.log(`   - FINISHED: ${aprStats.FINISHED}件`);
console.log(`   - ERROR: ${aprStats.ERROR}件`);
console.log(`   - NO_CHANGES_NEEDED: ${aprStats.NO_CHANGES_NEEDED}件`);
console.log(`   - その他/SKIPPED: ${aprStats.SKIPPED}件`);