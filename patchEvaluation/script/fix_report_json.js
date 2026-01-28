#!/usr/bin/env node
/**
 * 既存のdetailed_analysis_report_*.jsonを修正するスクリプト
 * matched_pairsからfinalCategoryLevelsを再構築し、統計データも再計算
 * 
 * 使用方法:
 *   node script/fix_report_json.js                           # 最新のレポートを修正
 *   node script/fix_report_json.js 260128_111733             # 特定セッションIDを修正
 *   node script/fix_report_json.js --all                     # 全レポートを修正
 */

import fs from 'fs/promises';
import path from 'path';

const OUTPUT_DIR = '/app/output';

/**
 * セッションIDからファイルパスを取得
 */
function getReportPath(sessionId) {
    return path.join(OUTPUT_DIR, `detailed_analysis_report_${sessionId}.json`);
}

/**
 * 利用可能なレポート一覧を取得
 */
async function getAvailableReports() {
    const files = await fs.readdir(OUTPUT_DIR);
    return files
        .filter(f => f.startsWith('detailed_analysis_report_') && f.endsWith('.json'))
        .map(f => {
            const match = f.match(/detailed_analysis_report_(\d+_\d+)\.json/);
            return match ? match[1] : null;
        })
        .filter(Boolean)
        .sort()
        .reverse(); // 最新順
}

/**
 * Intent FulfillmentのラベルをintentFulfillmentEvaluationから抽出
 * 構造が {status, data: {label, ...}} の場合と {label, ...} の場合に対応
 */
function extractIntentLabel(intentEval) {
    if (!intentEval) return null;
    
    // data.label を優先
    if (intentEval.data && intentEval.data.label) {
        return intentEval.data.label;
    }
    // 直接 label がある場合
    if (intentEval.label) {
        return intentEval.label;
    }
    // level がある場合
    if (intentEval.level) {
        return intentEval.level;
    }
    return null;
}

/**
 * intentFulfillmentEvaluationを正規化（labelを直接アクセスできるようにする）
 */
function normalizeIntentFulfillmentEvaluation(intentEval) {
    if (!intentEval) return null;
    
    const label = extractIntentLabel(intentEval);
    
    // 既に正規化されている場合
    if (intentEval.label && !intentEval.data) {
        return intentEval;
    }
    
    // data構造から平坦化
    if (intentEval.data) {
        return {
            status: label ? 'evaluated' : intentEval.status,
            label: label,
            reasoning: intentEval.data.reasoning || '',
            commit_intent_summary: intentEval.data.commit_intent_summary || '',
            agent_output_summary: intentEval.data.agent_output_summary || '',
            alignment_analysis: intentEval.data.alignment_analysis || '',
            score: intentEval.data.score,
            llmMetadata: intentEval.data.llmMetadata
        };
    }
    
    return intentEval;
}

/**
 * matched_pairsからfinalCategoryLevelsを再構築
 */
function rebuildFinalCategoryLevels(matchedPairs) {
    const finalCategoryLevels = {
        CORRECT: [],
        PLAUSIBLE: [],
        INCORRECT: [],
        SKIPPED: []
    };

    matchedPairs.forEach(pair => {
        // intentFulfillmentEvaluationを正規化
        if (pair.intentFulfillmentEvaluation) {
            pair.intentFulfillmentEvaluation = normalizeIntentFulfillmentEvaluation(pair.intentFulfillmentEvaluation);
        }
        
        const status = pair.status || 'SKIPPED';
        const finalCategory = pair.finalCategory || status.toUpperCase();
        
        // statusに基づいて分類
        switch (finalCategory) {
            case 'CORRECT':
                finalCategoryLevels.CORRECT.push({ ...pair, finalCategory: 'CORRECT' });
                break;
            case 'PLAUSIBLE':
                finalCategoryLevels.PLAUSIBLE.push({ ...pair, finalCategory: 'PLAUSIBLE' });
                break;
            case 'INCORRECT':
                finalCategoryLevels.INCORRECT.push({ ...pair, finalCategory: 'INCORRECT' });
                break;
            case 'EVALUATED':
            case 'SKIPPED':
            case 'ERROR':
            default:
                // EVALUATEDだが4軸評価がないケース、SKIPPEDケース、ERRORケースはすべてSKIPPED扱い
                finalCategoryLevels.SKIPPED.push({ ...pair, finalCategory: 'SKIPPED' });
                break;
        }
    });

    return finalCategoryLevels;
}

/**
 * 統計サマリーを再計算
 */
function recalculateSummary(matchedPairs, finalCategoryLevels) {
    const summary = {
        totalProcessed: matchedPairs.length,
        avgModifiedLines: 0,
        avgModifiedFiles: 0,
        mostCommonProjects: [],
        modificationPatterns: {},
        // パッチ生成統計
        patchGenerated: 0,
        noPatchGenerated: 0,
        // APRステータス分布
        aprStatusDistribution: {},
        // Intent Fulfillment統計
        intentFulfillment: {
            totalEvaluated: 0,
            levelCounts: {
                INTENT_FULFILLED: 0,
                INTENT_PARTIALLY_FULFILLED: 0,
                INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED: 0,
                INTENT_NOT_FULFILLED: 0
            }
        },
        // LLM_B 4軸評価統計
        fourAxisEvaluation: {
            totalEvaluated: 0,
            accuracy: { FULL_MATCH: 0, PARTIAL_MATCH: 0, NO_MATCH: 0, UNKNOWN: 0 },
            decision_soundness: { SOUND: 0, MOSTLY_SOUND: 0, UNSOUND: 0, UNKNOWN: 0 },
            directional_consistency: { ALIGNED: 0, PARTIALLY_ALIGNED: 0, CONTRADICTORY: 0, UNKNOWN: 0 },
            validity: { VALID: 0, MOSTLY_VALID: 0, INVALID: 0, UNKNOWN: 0 },
            overall_assessment: { CORRECT: 0, PLAUSIBLE: 0, INCORRECT: 0, UNKNOWN: 0 }
        },
        // APRプロバイダー・モデル統計
        aprProviders: {},
        aprModels: {}
    };

    let totalLines = 0;
    let totalFiles = 0;
    const projectCounts = {};

    // 旧5段階→新4段階マッピング
    const labelMapping = {
        'FULLY_FULFILLED': 'INTENT_FULFILLED',
        'SUBSTANTIALLY_FULFILLED': 'INTENT_FULFILLED',
        'PARTIALLY_FULFILLED': 'INTENT_PARTIALLY_FULFILLED',
        'MINIMALLY_FULFILLED': 'INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED',
        'NOT_FULFILLED': 'INTENT_NOT_FULFILLED'
    };

    matchedPairs.forEach(pair => {
        // 変更統計
        if (pair.modifiedLines != null) {
            totalLines += pair.modifiedLines;
        }
        if (pair.modifiedFiles != null) {
            totalFiles += pair.modifiedFiles;
        }

        // パッチ生成判定
        if (pair.modifiedLines > 0 || pair.modifiedFiles > 0) {
            summary.patchGenerated++;
        } else {
            summary.noPatchGenerated++;
        }

        // プロジェクト統計
        if (pair.projectName) {
            projectCounts[pair.projectName] = (projectCounts[pair.projectName] || 0) + 1;
        }

        // 修正タイプ統計
        if (pair.modificationTypes && Array.isArray(pair.modificationTypes)) {
            pair.modificationTypes.forEach(type => {
                summary.modificationPatterns[type] = (summary.modificationPatterns[type] || 0) + 1;
            });
        }

        // APRステータス統計
        if (pair.aprStatus) {
            summary.aprStatusDistribution[pair.aprStatus] = (summary.aprStatusDistribution[pair.aprStatus] || 0) + 1;
        }

        // APRプロバイダー・モデル統計
        if (pair.aprProvider) {
            summary.aprProviders[pair.aprProvider] = (summary.aprProviders[pair.aprProvider] || 0) + 1;
        }
        if (pair.aprModel) {
            summary.aprModels[pair.aprModel] = (summary.aprModels[pair.aprModel] || 0) + 1;
        }

        // Intent Fulfillment統計
        if (pair.intentFulfillmentEvaluation) {
            const label = extractIntentLabel(pair.intentFulfillmentEvaluation);
            if (label) {
                summary.intentFulfillment.totalEvaluated++;
                
                // 新4段階enumに直接マッチ
                if (summary.intentFulfillment.levelCounts[label] !== undefined) {
                    summary.intentFulfillment.levelCounts[label]++;
                } 
                // 旧5段階からマッピング
                else if (labelMapping[label]) {
                    summary.intentFulfillment.levelCounts[labelMapping[label]]++;
                }
            }
        }

        // LLM_B 4軸評価統計
        if (pair.fourAxisEvaluation) {
            const fourAxis = pair.fourAxisEvaluation;
            summary.fourAxisEvaluation.totalEvaluated++;
            
            // accuracy
            if (fourAxis.accuracy?.label) {
                const label = fourAxis.accuracy.label.toUpperCase();
                if (summary.fourAxisEvaluation.accuracy[label] !== undefined) {
                    summary.fourAxisEvaluation.accuracy[label]++;
                } else {
                    summary.fourAxisEvaluation.accuracy.UNKNOWN++;
                }
            }
            
            // decision_soundness
            if (fourAxis.decision_soundness?.label) {
                const label = fourAxis.decision_soundness.label.toUpperCase();
                if (summary.fourAxisEvaluation.decision_soundness[label] !== undefined) {
                    summary.fourAxisEvaluation.decision_soundness[label]++;
                } else {
                    summary.fourAxisEvaluation.decision_soundness.UNKNOWN++;
                }
            }
            
            // directional_consistency
            if (fourAxis.directional_consistency?.label) {
                const label = fourAxis.directional_consistency.label.toUpperCase();
                if (summary.fourAxisEvaluation.directional_consistency[label] !== undefined) {
                    summary.fourAxisEvaluation.directional_consistency[label]++;
                } else {
                    summary.fourAxisEvaluation.directional_consistency.UNKNOWN++;
                }
            }
            
            // validity
            if (fourAxis.validity?.label) {
                const label = fourAxis.validity.label.toUpperCase();
                if (summary.fourAxisEvaluation.validity[label] !== undefined) {
                    summary.fourAxisEvaluation.validity[label]++;
                } else {
                    summary.fourAxisEvaluation.validity.UNKNOWN++;
                }
            }
            
            // overall_assessment
            if (fourAxis.overall_assessment) {
                const label = fourAxis.overall_assessment.toUpperCase();
                if (summary.fourAxisEvaluation.overall_assessment[label] !== undefined) {
                    summary.fourAxisEvaluation.overall_assessment[label]++;
                } else {
                    summary.fourAxisEvaluation.overall_assessment.UNKNOWN++;
                }
            }
        }
    });

    // 平均計算
    if (matchedPairs.length > 0) {
        summary.avgModifiedLines = (totalLines / matchedPairs.length).toFixed(1);
        summary.avgModifiedFiles = (totalFiles / matchedPairs.length).toFixed(1);
    }

    // 上位プロジェクト
    summary.mostCommonProjects = Object.entries(projectCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    return summary;
}

/**
 * 単一のレポートJSONを修正
 */
async function fixReportJson(sessionId) {
    const filePath = getReportPath(sessionId);
    
    console.log(`\n📄 処理中: ${sessionId}`);
    console.log(`   ファイル: ${filePath}`);

    try {
        // JSONを読み込み
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        // 修正前の状態を表示
        const beforeCounts = {
            CORRECT: data.finalCategoryLevels?.CORRECT?.length || 0,
            PLAUSIBLE: data.finalCategoryLevels?.PLAUSIBLE?.length || 0,
            INCORRECT: data.finalCategoryLevels?.INCORRECT?.length || 0,
            SKIPPED: data.finalCategoryLevels?.SKIPPED?.length || 0
        };
        const beforeTotal = Object.values(beforeCounts).reduce((a, b) => a + b, 0);
        const matchedPairsCount = data.matched_pairs?.length || 0;

        console.log(`   修正前: finalCategoryLevels合計=${beforeTotal}件, matched_pairs=${matchedPairsCount}件`);
        console.log(`   内訳: CORRECT=${beforeCounts.CORRECT}, PLAUSIBLE=${beforeCounts.PLAUSIBLE}, INCORRECT=${beforeCounts.INCORRECT}, SKIPPED=${beforeCounts.SKIPPED}`);

        if (!data.matched_pairs || data.matched_pairs.length === 0) {
            console.log(`   ⚠️ matched_pairsが空です`);
            return { sessionId, status: 'error', reason: 'no_matched_pairs' };
        }

        // matched_pairsを正規化（intentFulfillmentEvaluationを平坦化）
        data.matched_pairs = data.matched_pairs.map(pair => {
            if (pair.intentFulfillmentEvaluation) {
                pair.intentFulfillmentEvaluation = normalizeIntentFulfillmentEvaluation(pair.intentFulfillmentEvaluation);
            }
            return pair;
        });

        // finalCategoryLevelsを再構築
        data.finalCategoryLevels = rebuildFinalCategoryLevels(data.matched_pairs);

        // 統計サマリーを再計算
        data.summary = recalculateSummary(data.matched_pairs, data.finalCategoryLevels);

        // 修正後の状態を表示
        const afterCounts = {
            CORRECT: data.finalCategoryLevels.CORRECT.length,
            PLAUSIBLE: data.finalCategoryLevels.PLAUSIBLE.length,
            INCORRECT: data.finalCategoryLevels.INCORRECT.length,
            SKIPPED: data.finalCategoryLevels.SKIPPED.length
        };
        const afterTotal = Object.values(afterCounts).reduce((a, b) => a + b, 0);

        console.log(`   修正後: finalCategoryLevels合計=${afterTotal}件`);
        console.log(`   内訳: CORRECT=${afterCounts.CORRECT}, PLAUSIBLE=${afterCounts.PLAUSIBLE}, INCORRECT=${afterCounts.INCORRECT}, SKIPPED=${afterCounts.SKIPPED}`);
        console.log(`   Intent評価: ${data.summary.intentFulfillment.totalEvaluated}件評価済み`);
        console.log(`   パッチ生成: ${data.summary.patchGenerated}件 / No-op: ${data.summary.noPatchGenerated}件`);
        
        // LLM_B 4軸評価統計を表示
        const fourAxis = data.summary.fourAxisEvaluation;
        console.log(`\n   📊 LLM_B 4軸評価統計 (${fourAxis.totalEvaluated}件評価済み):`);
        if (fourAxis.totalEvaluated > 0) {
            console.log(`     - Accuracy: FULL_MATCH=${fourAxis.accuracy.FULL_MATCH}, PARTIAL_MATCH=${fourAxis.accuracy.PARTIAL_MATCH}, NO_MATCH=${fourAxis.accuracy.NO_MATCH}`);
            console.log(`     - Decision Soundness: SOUND=${fourAxis.decision_soundness.SOUND}, MOSTLY_SOUND=${fourAxis.decision_soundness.MOSTLY_SOUND}, UNSOUND=${fourAxis.decision_soundness.UNSOUND}`);
            console.log(`     - Directional Consistency: ALIGNED=${fourAxis.directional_consistency.ALIGNED}, PARTIALLY_ALIGNED=${fourAxis.directional_consistency.PARTIALLY_ALIGNED}, CONTRADICTORY=${fourAxis.directional_consistency.CONTRADICTORY}`);
            console.log(`     - Validity: VALID=${fourAxis.validity.VALID}, MOSTLY_VALID=${fourAxis.validity.MOSTLY_VALID}, INVALID=${fourAxis.validity.INVALID}`);
            console.log(`     - Overall Assessment: CORRECT=${fourAxis.overall_assessment.CORRECT}, PLAUSIBLE=${fourAxis.overall_assessment.PLAUSIBLE}, INCORRECT=${fourAxis.overall_assessment.INCORRECT}`);
        } else {
            console.log(`     ⚠️ 4軸評価データなし（LLM_Bが実行されていないか、データが保存されていません）`);
        }

        // バックアップを作成（初回のみ）
        const backupPath = filePath.replace('.json', '_backup.json');
        try {
            await fs.access(backupPath);
            console.log(`   💾 バックアップ既存: ${path.basename(backupPath)}`);
        } catch {
            await fs.writeFile(backupPath, content, 'utf-8');
            console.log(`   💾 バックアップ作成: ${path.basename(backupPath)}`);
        }

        // 修正したJSONを保存
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`   ✅ 修正完了`);

        return { 
            sessionId, 
            status: 'fixed',
            before: beforeCounts,
            after: afterCounts,
            intentEvaluated: data.summary.intentFulfillment.totalEvaluated,
            patchGenerated: data.summary.patchGenerated,
            fourAxisEvaluated: data.summary.fourAxisEvaluation.totalEvaluated,
            fourAxisOverall: data.summary.fourAxisEvaluation.overall_assessment
        };

    } catch (error) {
        console.error(`   ❌ エラー: ${error.message}`);
        return { sessionId, status: 'error', reason: error.message };
    }
}

/**
 * メイン処理
 */
async function main() {
    const args = process.argv.slice(2);
    
    console.log('🔧 レポートJSON修正ツール（統計再計算対応）');
    console.log('=' .repeat(60));

    let sessionsToFix = [];

    if (args.includes('--all')) {
        // 全レポートを修正
        sessionsToFix = await getAvailableReports();
        console.log(`📋 全${sessionsToFix.length}件のレポートを処理します`);
    } else if (args.length > 0 && !args[0].startsWith('-')) {
        // 特定のセッションIDを修正
        sessionsToFix = [args[0]];
    } else {
        // 最新のレポートを修正
        const reports = await getAvailableReports();
        if (reports.length === 0) {
            console.log('❌ レポートが見つかりません');
            process.exit(1);
        }
        sessionsToFix = [reports[0]];
        console.log(`📋 最新のレポート (${reports[0]}) を処理します`);
    }

    const results = [];
    for (const sessionId of sessionsToFix) {
        const result = await fixReportJson(sessionId);
        results.push(result);
    }

    // サマリー表示
    console.log('\n' + '='.repeat(60));
    console.log('📊 処理結果サマリー');
    console.log(`   修正完了: ${results.filter(r => r.status === 'fixed').length}件`);
    console.log(`   エラー: ${results.filter(r => r.status === 'error').length}件`);

    // 修正されたファイルの詳細
    const fixed = results.filter(r => r.status === 'fixed');
    if (fixed.length > 0) {
        console.log('\n📝 修正されたレポート:');
        fixed.forEach(r => {
            console.log(`   ${r.sessionId}:`);
            console.log(`     - finalCategoryLevels: ${Object.values(r.before).reduce((a,b)=>a+b,0)} → ${Object.values(r.after).reduce((a,b)=>a+b,0)}件`);
            console.log(`     - Intent評価: ${r.intentEvaluated}件`);
            console.log(`     - パッチ生成: ${r.patchGenerated}件`);
        });
    }
}

main().catch(err => {
    console.error('❌ 実行エラー:', err);
    process.exit(1);
});
