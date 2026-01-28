#!/usr/bin/env node
/**
 * 既存のdetailed_analysis_report_*.jsonから
 * LLM_B（4軸評価）とLLM_C（Intent Fulfillment）の統計を抽出・表示するスクリプト
 */

import fs from 'fs/promises';
import path from 'path';

const OUTPUT_DIR = '/app/output';

async function analyzeReport(sessionId) {
    // ファイルパス決定
    let filePath;
    if (sessionId) {
        filePath = path.join(OUTPUT_DIR, `detailed_analysis_report_${sessionId}.json`);
    } else {
        // 最新ファイルを取得
        const files = await fs.readdir(OUTPUT_DIR);
        const reportFiles = files
            .filter(f => f.startsWith('detailed_analysis_report_') && f.endsWith('.json') && !f.includes('backup'))
            .sort()
            .reverse();
        if (reportFiles.length === 0) {
            console.error('レポートが見つかりません');
            process.exit(1);
        }
        filePath = path.join(OUTPUT_DIR, reportFiles[0]);
        sessionId = reportFiles[0].replace('detailed_analysis_report_', '').replace('.json', '');
    }

    console.log('📊 LLM評価統計分析ツール');
    console.log('='.repeat(70));
    console.log(`📄 ファイル: ${filePath}`);
    console.log(`🆔 セッションID: ${sessionId}`);

    // JSONを読み込み
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    console.log(`📦 総マッチングペア数: ${data.matched_pairs?.length || 0}件\n`);

    // Intent Fulfillment統計（LLM_C）
    const intentStats = {
        totalEvaluated: 0,
        INTENT_FULFILLED: 0,
        INTENT_PARTIALLY_FULFILLED: 0,
        INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED: 0,
        INTENT_NOT_FULFILLED: 0,
        scores: []
    };

    // 4軸評価統計（LLM_B）
    const fourAxisStats = {
        totalEvaluated: 0,
        accuracy: { FULL_MATCH: 0, PARTIAL_MATCH: 0, PARTIALLY_CORRECT: 0, NO_MATCH: 0, UNKNOWN: 0 },
        decision_soundness: { SOUND: 0, MOSTLY_SOUND: 0, UNSOUND: 0, UNKNOWN: 0 },
        directional_consistency: { ALIGNED: 0, CONSISTENT: 0, PARTIALLY_ALIGNED: 0, CONTRADICTORY: 0, UNKNOWN: 0 },
        validity: { VALID: 0, MOSTLY_VALID: 0, INVALID: 0, UNKNOWN: 0 },
        overall_assessment: { CORRECT: 0, PLAUSIBLE: 0, PLAUSIBLE_BUT_DIFFERENT: 0, INCORRECT: 0, UNKNOWN: 0 }
    };

    // 最終カテゴリー統計
    const finalCategoryStats = {
        CORRECT: 0,
        PLAUSIBLE: 0,
        INCORRECT: 0,
        SKIPPED: 0
    };

    // 詳細データ
    const intentDetails = [];
    const fourAxisDetails = [];

    // データ分析
    if (data.matched_pairs) {
        data.matched_pairs.forEach((pair) => {
            // Intent Fulfillment統計（LLM_C）
            if (pair.intentFulfillmentEvaluation && pair.intentFulfillmentEvaluation.data) {
                const intentData = pair.intentFulfillmentEvaluation.data;
                if (intentData.label) {
                    intentStats.totalEvaluated++;
                    if (intentStats[intentData.label] !== undefined) {
                        intentStats[intentData.label]++;
                    }
                    
                    if (typeof intentData.score === 'number') {
                        intentStats.scores.push(intentData.score);
                    }
                    
                    intentDetails.push({
                        name: pair.pullRequestName,
                        label: intentData.label,
                        score: intentData.score
                    });
                }
            }

            // 4軸評価統計（LLM_B）
            if (pair.fourAxisEvaluation && pair.fourAxisEvaluation.accuracy) {
                fourAxisStats.totalEvaluated++;

                // accuracy
                if (pair.fourAxisEvaluation.accuracy?.label) {
                    const label = pair.fourAxisEvaluation.accuracy.label.toUpperCase();
                    if (fourAxisStats.accuracy[label] !== undefined) {
                        fourAxisStats.accuracy[label]++;
                    } else {
                        fourAxisStats.accuracy.UNKNOWN++;
                    }
                }

                // decision_soundness
                if (pair.fourAxisEvaluation.decision_soundness?.label) {
                    const label = pair.fourAxisEvaluation.decision_soundness.label.toUpperCase();
                    if (fourAxisStats.decision_soundness[label] !== undefined) {
                        fourAxisStats.decision_soundness[label]++;
                    } else {
                        fourAxisStats.decision_soundness.UNKNOWN++;
                    }
                }

                // directional_consistency
                if (pair.fourAxisEvaluation.directional_consistency?.label) {
                    const label = pair.fourAxisEvaluation.directional_consistency.label.toUpperCase();
                    if (fourAxisStats.directional_consistency[label] !== undefined) {
                        fourAxisStats.directional_consistency[label]++;
                    } else {
                        fourAxisStats.directional_consistency.UNKNOWN++;
                    }
                }

                // validity
                if (pair.fourAxisEvaluation.validity?.label) {
                    const label = pair.fourAxisEvaluation.validity.label.toUpperCase();
                    if (fourAxisStats.validity[label] !== undefined) {
                        fourAxisStats.validity[label]++;
                    } else {
                        fourAxisStats.validity.UNKNOWN++;
                    }
                }

                // overall_assessment
                if (pair.fourAxisEvaluation.overall_assessment) {
                    const label = pair.fourAxisEvaluation.overall_assessment.toUpperCase();
                    if (fourAxisStats.overall_assessment[label] !== undefined) {
                        fourAxisStats.overall_assessment[label]++;
                    } else {
                        fourAxisStats.overall_assessment.UNKNOWN++;
                    }
                }

                fourAxisDetails.push({
                    name: pair.pullRequestName,
                    accuracy: pair.fourAxisEvaluation.accuracy?.label,
                    decision_soundness: pair.fourAxisEvaluation.decision_soundness?.label,
                    directional_consistency: pair.fourAxisEvaluation.directional_consistency?.label,
                    validity: pair.fourAxisEvaluation.validity?.label,
                    overall: pair.fourAxisEvaluation.overall_assessment
                });
            }

            // 最終カテゴリー統計
            if (pair.finalCategory) {
                const category = pair.finalCategory.toUpperCase();
                if (finalCategoryStats[category] !== undefined) {
                    finalCategoryStats[category]++;
                } else {
                    finalCategoryStats.SKIPPED++;
                }
            } else {
                finalCategoryStats.SKIPPED++;
            }
        });
    }

    // 結果表示
    console.log('═'.repeat(70));
    console.log('🎯 LLM_C: Intent Fulfillment評価統計');
    console.log('═'.repeat(70));
    console.log(`📊 評価実行数: ${intentStats.totalEvaluated}件 / ${data.matched_pairs?.length || 0}件`);
    console.log();
    console.log('📈 4段階ラベル分布:');
    console.log(`   ✅ INTENT_FULFILLED:                       ${intentStats.INTENT_FULFILLED}件 (${((intentStats.INTENT_FULFILLED / intentStats.totalEvaluated) * 100 || 0).toFixed(1)}%)`);
    console.log(`   ⚠️  INTENT_PARTIALLY_FULFILLED:             ${intentStats.INTENT_PARTIALLY_FULFILLED}件 (${((intentStats.INTENT_PARTIALLY_FULFILLED / intentStats.totalEvaluated) * 100 || 0).toFixed(1)}%)`);
    console.log(`   🔸 INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED:   ${intentStats.INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED}件 (${((intentStats.INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED / intentStats.totalEvaluated) * 100 || 0).toFixed(1)}%)`);
    console.log(`   ❌ INTENT_NOT_FULFILLED:                    ${intentStats.INTENT_NOT_FULFILLED}件 (${((intentStats.INTENT_NOT_FULFILLED / intentStats.totalEvaluated) * 100 || 0).toFixed(1)}%)`);

    if (intentStats.scores.length > 0) {
        const avgScore = intentStats.scores.reduce((a, b) => a + b, 0) / intentStats.scores.length;
        console.log();
        console.log(`📊 平均スコア: ${avgScore.toFixed(3)} (${(avgScore * 100).toFixed(1)}%)`);
    }

    console.log();
    console.log('═'.repeat(70));
    console.log('🤖 LLM_B: 4軸評価統計');
    console.log('═'.repeat(70));
    console.log(`📊 評価実行数: ${fourAxisStats.totalEvaluated}件 / ${data.matched_pairs?.length || 0}件`);
    
    if (fourAxisStats.totalEvaluated > 0) {
        console.log();
        console.log('📈 Accuracy（正確性）:');
        Object.entries(fourAxisStats.accuracy).forEach(([label, count]) => {
            if (count > 0) {
                console.log(`   - ${label}: ${count}件 (${((count / fourAxisStats.totalEvaluated) * 100).toFixed(1)}%)`);
            }
        });

        console.log();
        console.log('📈 Decision Soundness（判断妥当性）:');
        Object.entries(fourAxisStats.decision_soundness).forEach(([label, count]) => {
            if (count > 0) {
                console.log(`   - ${label}: ${count}件 (${((count / fourAxisStats.totalEvaluated) * 100).toFixed(1)}%)`);
            }
        });

        console.log();
        console.log('📈 Directional Consistency（方向性一貫性）:');
        Object.entries(fourAxisStats.directional_consistency).forEach(([label, count]) => {
            if (count > 0) {
                console.log(`   - ${label}: ${count}件 (${((count / fourAxisStats.totalEvaluated) * 100).toFixed(1)}%)`);
            }
        });

        console.log();
        console.log('📈 Validity（有効性）:');
        Object.entries(fourAxisStats.validity).forEach(([label, count]) => {
            if (count > 0) {
                console.log(`   - ${label}: ${count}件 (${((count / fourAxisStats.totalEvaluated) * 100).toFixed(1)}%)`);
            }
        });

        console.log();
        console.log('📈 Overall Assessment（総合評価）:');
        Object.entries(fourAxisStats.overall_assessment).forEach(([label, count]) => {
            if (count > 0) {
                console.log(`   - ${label}: ${count}件 (${((count / fourAxisStats.totalEvaluated) * 100).toFixed(1)}%)`);
            }
        });

        console.log();
        console.log('📝 4軸評価の詳細:');
        fourAxisDetails.forEach((detail, i) => {
            console.log(`   ${i + 1}. ${detail.name}`);
            console.log(`      Accuracy: ${detail.accuracy}, Decision: ${detail.decision_soundness}, Direction: ${detail.directional_consistency}, Validity: ${detail.validity}`);
            console.log(`      → Overall: ${detail.overall}`);
        });
    } else {
        console.log();
        console.log('⚠️ 4軸評価データが見つかりません');
        console.log('   LLM_Bは実行されたが、結果がレポートに保存されていない可能性があります');
    }

    console.log();
    console.log('═'.repeat(70));
    console.log('📊 最終カテゴリー分布');
    console.log('═'.repeat(70));
    const total = Object.values(finalCategoryStats).reduce((a, b) => a + b, 0);
    console.log(`   ✅ CORRECT:   ${finalCategoryStats.CORRECT}件 (${((finalCategoryStats.CORRECT / total) * 100).toFixed(1)}%)`);
    console.log(`   ⚠️  PLAUSIBLE: ${finalCategoryStats.PLAUSIBLE}件 (${((finalCategoryStats.PLAUSIBLE / total) * 100).toFixed(1)}%)`);
    console.log(`   ❌ INCORRECT: ${finalCategoryStats.INCORRECT}件 (${((finalCategoryStats.INCORRECT / total) * 100).toFixed(1)}%)`);
    console.log(`   ⏭️  SKIPPED:   ${finalCategoryStats.SKIPPED}件 (${((finalCategoryStats.SKIPPED / total) * 100).toFixed(1)}%)`);

    // 問題分析
    console.log();
    console.log('═'.repeat(70));
    console.log('🔍 問題分析');
    console.log('═'.repeat(70));
    
    if (fourAxisStats.totalEvaluated < intentStats.totalEvaluated) {
        console.log(`⚠️ 4軸評価（${fourAxisStats.totalEvaluated}件）がIntent評価（${intentStats.totalEvaluated}件）より少ない`);
        console.log('   原因: HTMLReportService.jsで4軸評価結果がpairオブジェクトに保存されていなかった');
        console.log('   対策: HTMLReportService.jsを修正済み。新規実行では正しく保存されます');
    }

    if (finalCategoryStats.SKIPPED > fourAxisStats.totalEvaluated) {
        console.log(`⚠️ SKIPPEDが${finalCategoryStats.SKIPPED}件と多い`);
        console.log('   原因: 4軸評価結果（correctnessLevel）が保存されていないエントリ');
    }

    return {
        intentStats,
        fourAxisStats,
        finalCategoryStats
    };
}

// メイン実行
const sessionId = process.argv[2];
analyzeReport(sessionId).catch(err => {
    console.error('エラー:', err);
    process.exit(1);
});
