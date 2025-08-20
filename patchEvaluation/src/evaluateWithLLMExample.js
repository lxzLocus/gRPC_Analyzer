#!/usr/bin/env node

/**
 * evaluateWithLLM機能の使用例
 * プロンプトテンプレートを使用したLLMベースのパッチ評価のデモンストレーション
 */

import APRLogParser from './aprLogParser.js';
import Config from './config.js';

async function demonstrateEvaluateWithLLM() {
    console.log('🚀 evaluateWithLLM機能のデモンストレーションを開始');
    console.log('==========================================');

    const aprLogParser = new APRLogParser();

    // サンプルデータの準備
    const sampleData = {
        codeContext: `
File: src/calculator.js
Function: calculateSum(a, b)
Context: A simple calculator function that adds two numbers
Current implementation has a bug where it returns incorrect results for negative numbers.

class Calculator {
    calculateSum(a, b) {
        // 現在のバグがある実装
        return Math.abs(a) + Math.abs(b);
    }
}
        `.trim(),

        groundTruthDiff: `
--- a/src/calculator.js
+++ b/src/calculator.js
@@ -2,7 +2,7 @@
 class Calculator {
     calculateSum(a, b) {
-        // 現在のバグがある実装
-        return Math.abs(a) + Math.abs(b);
+        // 修正: 負の数も正しく加算
+        return a + b;
     }
 }
        `.trim(),

        agentGeneratedDiff: `
--- a/src/calculator.js
+++ b/src/calculator.js
@@ -2,7 +2,7 @@
 class Calculator {
     calculateSum(a, b) {
-        // 現在のバグがある実装
-        return Math.abs(a) + Math.abs(b);
+        // 修正: シンプルな加算に変更
+        return a + b;
     }
 }
        `.trim(),

        agentThoughtProcess: `
Turn 1: Looking at the calculateSum function, I notice it's using Math.abs() which converts negative numbers to positive values before addition. This is incorrect behavior for a sum function.

Turn 2: The issue is clear - when calculating sum of negative numbers like (-5) + (-3), the current implementation returns abs(-5) + abs(-3) = 5 + 3 = 8, but the correct result should be (-5) + (-3) = -8.

Turn 3: I need to remove the Math.abs() calls and implement simple addition. The fix is straightforward: return a + b instead of Math.abs(a) + Math.abs(b).

Turn 4: Let me verify this fix handles all cases:
- Positive numbers: 5 + 3 = 8 ✓
- Negative numbers: (-5) + (-3) = -8 ✓  
- Mixed: 5 + (-3) = 2 ✓
- Zero: 0 + 5 = 5 ✓

The solution is correct and handles all edge cases properly.
        `.trim()
    };

    try {
        console.log('📝 テストデータを準備中...');
        console.log(`  - コードコンテキスト: ${sampleData.codeContext.length} 文字`);
        console.log(`  - 正解diff: ${sampleData.groundTruthDiff.length} 文字`);
        console.log(`  - エージェント生成diff: ${sampleData.agentGeneratedDiff.length} 文字`);
        console.log(`  - 思考プロセス: ${sampleData.agentThoughtProcess.length} 文字`);
        
        console.log('\n🤖 LLM評価を実行中...');
        
        // LLM評価の実行
        const evaluationResult = await aprLogParser.evaluateWithLLM(
            sampleData.codeContext,
            sampleData.groundTruthDiff,
            sampleData.agentGeneratedDiff,
            sampleData.agentThoughtProcess
        );

        console.log('\n📊 評価結果:');
        console.log('==========================================');

        if (evaluationResult.success) {
            // 評価サマリーの生成と表示
            const summary = aprLogParser.generateEvaluationSummary(evaluationResult);
            
            console.log('✅ LLM評価が正常に完了しました');
            console.log('\n🔍 評価サマリー:');
            console.log(`  📈 総合評価: ${summary.summary.overall_assessment}`);
            console.log(`  ✅ 妥当性: ${summary.summary.is_plausible ? '✓ 妥当' : '✗ 不適切'}`);
            console.log(`  🎯 正確性: ${summary.summary.is_correct ? '✓ 正確' : '✗ 不正確'}`);
            console.log(`  📋 等価レベル: ${summary.summary.semantic_equivalence_level}`);
            console.log(`  🏷️ 適用ルール数: ${summary.summary.rules_count}`);
            console.log(`  🔍 適用ルール: ${summary.summary.rules_applied.join(', ') || 'なし'}`);

            console.log('\n💭 詳細評価:');
            
            // 妥当性評価の詳細
            const plausibility = evaluationResult.evaluation.plausibility_evaluation;
            if (plausibility) {
                console.log(`  📝 妥当性判断: ${plausibility.is_plausible ? '妥当' : '不適切'}`);
                if (plausibility.reasoning) {
                    console.log(`  💡 妥当性理由: ${plausibility.reasoning.substring(0, 200)}${plausibility.reasoning.length > 200 ? '...' : ''}`);
                }
            }

            // 正確性評価の詳細
            const correctness = evaluationResult.evaluation.correctness_evaluation;
            if (correctness) {
                console.log(`  ✅ 正確性判断: ${correctness.is_correct ? '正確' : '不正確'}`);
                console.log(`  🔗 等価レベル: ${correctness.semantic_equivalence_level}`);
                if (correctness.reasoning) {
                    console.log(`  💡 正確性理由: ${correctness.reasoning.substring(0, 200)}${correctness.reasoning.length > 200 ? '...' : ''}`);
                }
                if (correctness.semantic_similarity_rules_applied && correctness.semantic_similarity_rules_applied.length > 0) {
                    console.log(`  📋 適用ルール: ${correctness.semantic_similarity_rules_applied.join(', ')}`);
                }
            }

            console.log('\n📈 信頼度指標:');
            console.log(`  📝 詳細推論: ${summary.summary.confidence_indicators.has_detailed_reasoning ? '✓' : '✗'}`);
            console.log(`  🎯 ルール適用: ${summary.summary.confidence_indicators.rules_properly_applied ? '✓' : '✗'}`);
            console.log(`  🔄 評価一貫性: ${summary.summary.confidence_indicators.evaluation_consistent ? '✓' : '✗'}`);

            console.log('\n🔧 メタデータ:');
            if (evaluationResult.metadata) {
                console.log(`  🤖 使用モデル: ${evaluationResult.metadata.model || 'unknown'}`);
                console.log(`  ⏱️ 評価時刻: ${evaluationResult.metadata.timestamp}`);
                console.log(`  📏 プロンプト長: ${evaluationResult.metadata.promptLength || 0} 文字`);
                if (evaluationResult.metadata.usage) {
                    console.log(`  🔢 使用トークン: ${evaluationResult.metadata.usage.totalTokens || 0}`);
                }
            }

        } else {
            console.log('❌ LLM評価に失敗しました');
            console.log(`エラー: ${evaluationResult.error}`);
            
            if (evaluationResult.evaluation) {
                console.log('\n📝 フォールバック評価結果:');
                if (evaluationResult.evaluation.parse_error) {
                    console.log(`解析エラー: ${evaluationResult.evaluation.parse_error.error}`);
                    console.log(`生レスポンス (抜粋): ${evaluationResult.evaluation.parse_error.raw_response.substring(0, 200)}...`);
                }
            }
        }

    } catch (error) {
        console.error('❌ デモンストレーション実行エラー:', error.message);
        console.error('スタックトレース:', error.stack);
    }

    console.log('\n🏁 デモンストレーション完了');
}

// プロンプトテンプレートの内容表示
async function showPromptTemplate() {
    console.log('\n📋 使用プロンプトテンプレートの確認');
    console.log('==========================================');
    
    try {
        const aprLogParser = new APRLogParser();
        const template = await aprLogParser.loadEvaluationPrompt();
        
        console.log(`テンプレート長: ${template.length} 文字`);
        console.log('テンプレート内容 (最初の500文字):');
        console.log('------------------------------------------');
        console.log(template.substring(0, 500));
        console.log('------------------------------------------');
        
        // プレースホルダーの確認
        const placeholders = template.match(/\{\{[^}]+\}\}/g) || [];
        console.log(`\n🔍 検出されたプレースホルダー: ${placeholders.length} 個`);
        placeholders.forEach(ph => console.log(`  - ${ph}`));
        
    } catch (error) {
        console.error('❌ プロンプトテンプレート読み込みエラー:', error.message);
    }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🎯 evaluateWithLLM機能デモンストレーション');
    console.log('============================================\n');
    
    // プロンプトテンプレートの表示
    await showPromptTemplate();
    
    // 評価機能のデモンストレーション
    await demonstrateEvaluateWithLLM();
}
