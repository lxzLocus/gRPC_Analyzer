/**
 * Phase 3 LLM Classifier
 * LLMを使用した高度な分類（曖昧なケースのみ）
 */

import { LLMClient, LLMRequest } from '../modules/llmClient.js';
import { APREvaluation, ClassificationResult } from './datasetFilterClassifier.js';

export class Phase3LLMClassifier {
    private llmClient: LLMClient;
    private model: string;
    private temperature: number;

    constructor(llmClient: LLMClient, model: string = 'gpt-5', temperature: number = 0.1) {
        this.llmClient = llmClient;
        this.model = model;
        this.temperature = temperature;
    }

    async classify(evaluation: APREvaluation): Promise<ClassificationResult> {
        const prompt = this.buildPrompt(evaluation);

        try {
            const request: LLMRequest = {
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'あなたはソフトウェアリポジトリのPull Requestを分類する専門家です。APR評価結果を基に、PRの性質を正確に判断してください。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: this.temperature,
                maxTokens: 1000
            };

            const response = await this.llmClient.generateContent(request);
            
            // JSON解析
            const result = this.parseResponse(response.content, evaluation);
            
            return {
                ...result,
                phase: 3,
                processedBy: 'LLM'
            };

        } catch (error) {
            console.error('❌ LLM classification failed:', error);
            return this.getFallbackResult(evaluation);
        }
    }

    private buildPrompt(evaluation: APREvaluation): string {
        return `
あなたはソフトウェアリポジトリのPull Requestを分類する専門家です。
以下のAPR（Automatic Program Repair）評価結果を基に、このPRが
「バグ修正」「新機能追加」「リファクタリング」のどれに該当するか判定してください。

【重要な判断基準】
1. evaluationReasoningを最優先で読み取る
   - 「fixes bug」「corrects error」「addresses issue」→ バグ修正の可能性高
   - 「adds functionality」「implements feature」「enhances」→ 新機能の可能性高
   - 「refactors」「renames」「improves structure」→ リファクタリングの可能性高

2. 新規追加が「バグ修正のため」か「機能拡張のため」かを区別
   例: 「adds null check to prevent crash」→ バグ修正
   例: 「adds new API endpoint for users」→ 新機能

3. modificationTypesとの整合性を確認
   - error, null-check, security → バグ修正の強いシグナル
   - api, database, ui → 文脈次第（評価理由で判断）

【分類対象のPR】
- PR名: ${evaluation.pullRequestName}
- 正確性レベル: ${evaluation.correctnessLevel}
- 類似度スコア: ${evaluation.semanticSimilarityScore}

【APR評価理由】
${evaluation.evaluationReasoning}

【修正タイプ】
${evaluation.modificationTypes.join(', ')}

${evaluation.plausibilityReasoning ? `【妥当性評価】\n${evaluation.plausibilityReasoning}\n` : ''}

【出力形式】
以下のJSON形式で回答してください:
{
  "category": "BUG_FIX" | "FEATURE" | "REFACTORING" | "UNCLEAR",
  "confidence": 0.0-1.0,
  "reasoning": "判断の根拠を2-3文で説明",
  "keyEvidence": ["判断の決め手となった証拠1", "証拠2", "証拠3"]
}

【回答例】
{
  "category": "BUG_FIX",
  "confidence": 0.85,
  "reasoning": "evaluationReasoningに'prevents null pointer crash'と記載されており、null-checkとerrorのmodificationTypesがある。新規コード追加だが、既存のクラッシュバグを修正する目的が明確。",
  "keyEvidence": ["prevents crash", "null-check added", "error handling"]
}

それでは、上記のPRを分類してください。JSON形式のみで回答してください。
`.trim();
    }

    private parseResponse(content: string, evaluation: APREvaluation): ClassificationResult {
        try {
            // JSON部分を抽出（コードブロックで囲まれている場合に対応）
            let jsonStr = content.trim();
            if (jsonStr.includes('```json')) {
                const match = jsonStr.match(/```json\s*(\{[\s\S]*?\})\s*```/);
                if (match) {
                    jsonStr = match[1];
                }
            } else if (jsonStr.includes('```')) {
                const match = jsonStr.match(/```\s*(\{[\s\S]*?\})\s*```/);
                if (match) {
                    jsonStr = match[1];
                }
            }

            const parsed = JSON.parse(jsonStr);

            // バリデーション
            const validCategories = ['BUG_FIX', 'FEATURE', 'REFACTORING', 'UNCLEAR'];
            if (!validCategories.includes(parsed.category)) {
                throw new Error(`Invalid category: ${parsed.category}`);
            }

            if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
                throw new Error(`Invalid confidence: ${parsed.confidence}`);
            }

            const result: ClassificationResult = {
                category: parsed.category,
                confidence: parsed.confidence,
                reasoning: parsed.reasoning || 'LLM分類結果',
                keyEvidence: Array.isArray(parsed.keyEvidence) ? parsed.keyEvidence : [],
                phase: 3,
                processedBy: 'LLM'
            };

            // 低信頼度の場合は人間レビューフラグ
            if (result.confidence < 0.6) {
                result.requiresManualReview = true;
            }

            return result;

        } catch (error) {
            console.error('❌ Failed to parse LLM response:', error);
            console.error('Response content:', content);
            return this.getFallbackResult(evaluation);
        }
    }

    private getFallbackResult(evaluation: APREvaluation): ClassificationResult {
        return {
            category: 'UNCLEAR',
            confidence: 0.0,
            reasoning: 'LLM分類に失敗したため、人間によるレビューが必要です',
            keyEvidence: ['LLM processing failed'],
            phase: 3,
            processedBy: 'LLM',
            requiresManualReview: true
        };
    }
}
