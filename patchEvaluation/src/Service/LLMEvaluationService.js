import fs from 'fs/promises';
import { TemplateRenderer } from './TemplateCompiler.js';
import { CodeContextExtractor } from './CodeContextExtractor.js';

/**
 * LLM評価処理を担当するサービスクラス
 */
export class LLMEvaluationService {
    constructor() {
        this.templateRenderer = null;
        this.llmClient = null;
        this.codeContextExtractor = new CodeContextExtractor();
    }

    /**
     * テンプレートの初期化
     * @param {string} templatePath - テンプレートファイルのパス
     */
    async initializeTemplate(templatePath) {
        try {
            const templateString = await fs.readFile(templatePath, 'utf-8');
            this.templateRenderer = new TemplateRenderer(templateString);
        } catch (error) {
            throw new Error(`テンプレート初期化エラー: ${error.message}`);
        }
    }

    /**
     * LLMクライアントの初期化
     * @param {string} clientType - 'openai' または 'gemini'
     */
    async initializeLLMClient(clientType = 'openai') {
        try {
            const { LLMClientFactory } = await import('../llmClientFactory.js');
            this.llmClient = LLMClientFactory.createClient(clientType);
        } catch (error) {
            throw new Error(`LLMクライアント初期化エラー: ${error.message}`);
        }
    }

    /**
     * コードコンテキストの生成（差分周辺のコードスニペット）
     * @param {string} groundTruthDiff - ground truth diff文字列
     * @param {string} premergePath - premergeディレクトリのパス
     * @returns {Promise<string>} 生成されたコードコンテキスト
     */
    async generateCodeContext(groundTruthDiff, premergePath) {
        return await this.codeContextExtractor.extractCodeContext(groundTruthDiff, premergePath);
    }

    /**
     * LLM評価レスポンスの解析
     * @param {string} responseContent - LLMからのレスポンス内容
     * @returns {Object} 解析された評価結果
     */
    parseEvaluationResponse(responseContent) {
        try {
            // JSON形式の場合
            if (responseContent.trim().startsWith('{')) {
                return JSON.parse(responseContent);
            }
            
            // テキスト形式の場合の簡易パース
            const result = {
                overall_assessment: "解析中",
                is_correct: false,
                is_plausible: false,
                semantic_equivalence_level: "unknown"
            };
            
            // 正確性判定
            if (responseContent.toLowerCase().includes('correct') || 
                responseContent.includes('正しい') || 
                responseContent.includes('適切')) {
                result.is_correct = true;
            }
            
            // 妥当性判定
            if (responseContent.toLowerCase().includes('plausible') || 
                responseContent.includes('妥当') || 
                responseContent.includes('合理的')) {
                result.is_plausible = true;
            }
            
            return result;
        } catch (error) {
            return {
                overall_assessment: "解析エラー",
                is_correct: false,
                is_plausible: false,
                parse_error: error.message
            };
        }
    }

    /**
     * TemplateCompilerを使用したLLM評価の実行
     * @param {Object} evaluationContext - 評価コンテキスト
     * @returns {Promise<Object>} 評価結果
     */
    async evaluateWithTemplate(evaluationContext) {
        const {
            premergePath,
            mergePath,
            groundTruthDiff,
            agentGeneratedDiff,
            agentThoughtProcess
        } = evaluationContext;

        if (!agentGeneratedDiff || agentGeneratedDiff.trim().length === 0) {
            return {
                success: false,
                error: "修正内容なし",
                result: { skipped: "no_modifications" }
            };
        }

        try {
            // テンプレートとLLMクライアントの初期化確認
            if (!this.templateRenderer) {
                await this.initializeTemplate("/app/prompt/00_evaluationPrompt.txt");
            }
            if (!this.llmClient) {
                await this.initializeLLMClient('openai');
            }

            // テンプレートに渡すコンテキストデータの準備
            const templateContext = {
                code_context: await this.generateCodeContext(groundTruthDiff, premergePath),
                ground_truth_diff: groundTruthDiff || "差分情報が利用できません",
                agent_generated_diff: agentGeneratedDiff,
                agent_thought_process: agentThoughtProcess
            };
            
            // テンプレートレンダリング
            const renderedPrompt = this.templateRenderer.render(templateContext);
            
            // LLMクライアントでの評価実行
            const llmResponse = await this.llmClient.generateResponse(renderedPrompt, {
                temperature: 0.1,
                max_tokens: 2000
            });
            
            if (llmResponse && llmResponse.success) {
                // LLM応答の解析
                const evaluationResult = this.parseEvaluationResponse(llmResponse.content);
                
                return {
                    success: true,
                    error: null,
                    result: {
                        ...evaluationResult,
                        templateUsed: true,
                        promptLength: renderedPrompt.length
                    }
                };
            } else {
                return {
                    success: false,
                    error: "LLM response failed",
                    result: { error: "LLM response failed" }
                };
            }
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                result: { error: error.message, templateUsed: false }
            };
        }
    }

    /**
     * 従来のLLM評価との互換性を保つためのメソッド
     * @param {string} codeContext - コードコンテキスト
     * @param {string} groundTruthDiff - 正解diff
     * @param {string} agentGeneratedDiff - エージェント生成diff
     * @param {string} agentThoughtProcess - エージェントの思考過程
     * @returns {Promise<Object>} 評価結果
     */
    async evaluateWithLLM(codeContext, groundTruthDiff, agentGeneratedDiff, agentThoughtProcess) {
        // 古いインターフェースから新しいコンテキスト形式に変換
        const evaluationContext = {
            premergePath: "",
            mergePath: "",
            aprDiffFiles: [],
            groundTruthDiff,
            agentGeneratedDiff,
            agentThoughtProcess
        };

        const result = await this.evaluateWithTemplate(evaluationContext);
        
        // 従来の形式に変換して返す
        if (result.success) {
            return {
                success: true,
                summary: result.result
            };
        } else {
            return {
                success: false,
                error: result.error
            };
        }
    }
}
