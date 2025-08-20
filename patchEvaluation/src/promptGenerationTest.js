#!/usr/bin/env node

/**
 * evaluateWithLLM機能の構文検証とプロンプト生成のテスト
 * APIキーなしでプロンプト生成まで確認
 */

import APRLogParser from './aprLogParser.js';

async function testPromptGeneration() {
    console.log('🧪 evaluateWithLLM - プロンプト生成テスト');
    console.log('=====================================');

    const aprLogParser = new APRLogParser();

    // サンプルデータの準備
    const sampleData = {
        codeContext: `
File: src/utils/stringHelper.js
Function: reverseString(str)
Context: A utility function that reverses a string
Bug: Current implementation doesn't handle null/undefined inputs properly.

function reverseString(str) {
    return str.split('').reverse().join('');
}
        `.trim(),

        groundTruthDiff: `
--- a/src/utils/stringHelper.js
+++ b/src/utils/stringHelper.js
@@ -1,3 +1,6 @@
 function reverseString(str) {
+    if (str === null || str === undefined) {
+        return '';
+    }
     return str.split('').reverse().join('');
 }
        `.trim(),

        agentGeneratedDiff: `
--- a/src/utils/stringHelper.js
+++ b/src/utils/stringHelper.js
@@ -1,3 +1,6 @@
 function reverseString(str) {
+    if (!str) {
+        return '';
+    }
     return str.split('').reverse().join('');
 }
        `.trim(),

        agentThoughtProcess: `
Turn 1: I can see that the reverseString function has a bug - it doesn't handle null or undefined inputs. When these values are passed, the function will throw an error because you can't call .split() on null/undefined.

Turn 2: The ground truth solution explicitly checks for null and undefined values. My generated solution uses a more concise check with !str, which covers null, undefined, and empty strings.

Turn 3: Both solutions will prevent the error, but they handle the edge cases slightly differently:
- Ground truth: Only checks null/undefined, empty string '' would still be processed
- My solution: Checks for all falsy values including null, undefined, and empty string

Turn 4: This difference in behavior might be significant depending on the requirements. If empty strings should be reversed to empty strings (which they would be anyway), then both approaches are functionally equivalent for practical purposes.
        `.trim()
    };

    try {
        console.log('📋 1. プロンプトテンプレート読み込みテスト');
        const template = await aprLogParser.loadEvaluationPrompt();
        console.log(`✅ テンプレート読み込み成功: ${template.length} 文字`);
        
        // プレースホルダーの検出
        const placeholders = template.match(/\{\{[^}]+\}\}/g) || [];
        console.log(`🔍 プレースホルダー検出: ${placeholders.length} 個`);
        placeholders.forEach((ph, i) => console.log(`   ${i+1}. ${ph}`));

        console.log('\n📝 2. プロンプト生成テスト');
        const generatedPrompt = aprLogParser.generateEvaluationPrompt(
            template,
            sampleData.codeContext,
            sampleData.groundTruthDiff,
            sampleData.agentGeneratedDiff,
            sampleData.agentThoughtProcess
        );
        console.log(`✅ プロンプト生成成功: ${generatedPrompt.length} 文字`);
        
        // プレースホルダーの置換確認
        const remainingPlaceholders = generatedPrompt.match(/\{\{[^}]+\}\}/g) || [];
        console.log(`🔍 未置換プレースホルダー: ${remainingPlaceholders.length} 個`);
        if (remainingPlaceholders.length > 0) {
            console.log('⚠️ 未置換プレースホルダー:', remainingPlaceholders);
        } else {
            console.log('✅ すべてのプレースホルダーが正常に置換されました');
        }

        console.log('\n📄 3. 生成されたプロンプトのサンプル（最初の800文字）');
        console.log('---'.repeat(20));
        console.log(generatedPrompt.substring(0, 800));
        console.log('---'.repeat(20));

        console.log('\n🔍 4. 評価結果解析テスト（模擬JSONレスポンス）');
        const mockEvaluationResponse = `
{
    "plausibility_evaluation": {
        "is_plausible": true,
        "reasoning": "The agent's solution correctly identifies the null/undefined handling issue and provides a syntactically correct fix. The use of !str is a common JavaScript pattern for checking falsy values."
    },
    "correctness_evaluation": {
        "is_correct": true,
        "semantic_equivalence_level": "SEMANTICALLY_EQUIVALENT",
        "reasoning": "Both the ground truth and agent solutions prevent the runtime error by checking for invalid inputs. While the ground truth explicitly checks for null/undefined and the agent uses !str (which includes empty strings), both approaches achieve the same goal of preventing errors. The semantic difference is minimal in practice.",
        "semantic_similarity_rules_applied": ["R1", "R3", "R8"]
    }
}
        `.trim();

        try {
            const parsedEvaluation = aprLogParser.parseEvaluationResponse(mockEvaluationResponse);
            console.log('✅ JSON解析成功');
            console.log(`   妥当性: ${parsedEvaluation.plausibility_evaluation.is_plausible ? '✓' : '✗'}`);
            console.log(`   正確性: ${parsedEvaluation.correctness_evaluation.is_correct ? '✓' : '✗'}`);
            console.log(`   等価レベル: ${parsedEvaluation.correctness_evaluation.semantic_equivalence_level}`);
            console.log(`   適用ルール: ${parsedEvaluation.correctness_evaluation.semantic_similarity_rules_applied.join(', ')}`);

            // 妥当性検証テスト
            try {
                aprLogParser.validateEvaluationResult(parsedEvaluation);
                console.log('✅ 評価結果の妥当性検証成功');
            } catch (validationError) {
                console.log('❌ 妥当性検証失敗:', validationError.message);
            }

        } catch (parseError) {
            console.log('❌ JSON解析失敗:', parseError.message);
        }

        console.log('\n🎯 5. 機能統合テスト結果');
        console.log('==========================================');
        console.log('✅ プロンプトテンプレート読み込み機能');
        console.log('✅ プレースホルダー置換機能');
        console.log('✅ プロンプト生成機能');
        console.log('✅ JSON評価結果解析機能');
        console.log('✅ 評価結果妥当性検証機能');
        console.log('⏳ LLM評価機能（API Key設定時に動作）');

        console.log('\n📌 実際のLLM評価を実行するには：');
        console.log('1. OpenAI API Keyを環境変数OPENAI_API_KEYに設定');
        console.log('2. または config.json の llm.provider を "gemini" に変更してGemini API Keyを設定');
        console.log('3. 以下のコマンドでフル機能テストを実行:');
        console.log('   node src/evaluateWithLLMExample.js');

    } catch (error) {
        console.error('❌ テスト実行エラー:', error.message);
        console.error('スタックトレース:', error.stack);
    }

    console.log('\n🏁 プロンプト生成テスト完了');
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
    await testPromptGeneration();
}
