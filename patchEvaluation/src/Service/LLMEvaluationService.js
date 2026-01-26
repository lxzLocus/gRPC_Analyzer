import fs from 'fs/promises';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { TemplateRenderer } from './TemplateCompiler.js';
import { CodeContextExtractor } from './CodeContextExtractor.js';
import { LLMClientController } from '../Controller/LLMClientController.js';
import LLMErrorHandler from './LLMErrorHandler.js';
import { createLLMRequest } from '../Repository/llmClient.js';
import Config from '../Config/config.js';

// 環境変数の読み込み
dotenvConfig({ path: '/app/.env' });

/**
 * LLM評価処理を担当するサービスクラス
 */
export class LLMEvaluationService {
    constructor(llmClient, templateRenderer) {
        this.llmClient = llmClient;
        this.templateRenderer = templateRenderer;
        this.errorHandler = new LLMErrorHandler();
        this.codeContextExtractor = new CodeContextExtractor();
    }

    /**
     * 4軸評価用ヘルパーメソッド：accuracyスコアからsemantic_equivalence_levelへのマッピング
     * @param {number} accuracyScore - Accuracy score (0.0-1.0)
     * @returns {string} Semantic equivalence level
     */
    _mapAccuracyToLevel(accuracyScore) {
        if (accuracyScore >= 0.95) return 'IDENTICAL';
        if (accuracyScore >= 0.7) return 'SEMANTICALLY_EQUIVALENT';
        if (accuracyScore >= 0.3) return 'PLAUSIBLE_BUT_DIFFERENT';
        return 'INCORRECT';
    }

    /**
     * 4軸評価から統合評価を導出
     * @param {Object} evaluation - 4軸評価結果
     * @returns {string} Overall assessment
     */
    _deriveOverallAssessment(evaluation) {
        const accuracy = evaluation.accuracy?.score || 0;
        const decisionSoundness = evaluation.decision_soundness?.score || 0;
        const directionalConsistency = evaluation.directional_consistency?.score || 0;
        const validity = evaluation.validity?.score || 0;
        
        // 全て合格なら最高評価
        if (accuracy >= 0.95 && decisionSoundness === 1.0 && directionalConsistency === 1.0 && validity === 1.0) {
            return 'IDENTICAL';
        }
        
        // Accuracyベースの評価
        if (accuracy >= 0.7 && validity === 1.0) {
            return 'SEMANTICALLY_EQUIVALENT';
        }
        
        if (accuracy >= 0.3 && validity === 1.0) {
            return 'PLAUSIBLE_BUT_DIFFERENT';
        }
        
        return 'INCORRECT';
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
     * @param {Config} config - Config インスタンス
     */
    async initializeLLMClient(config) {
        try {
            this.llmClient = LLMClientController.create(config);
            await this.llmClient.waitForInitialization();
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
                const parsed = JSON.parse(responseContent);
                
                // 4軸評価形式（新形式）
                if (parsed.accuracy !== undefined) {
                    return {
                        // 4軸評価スコア
                        accuracy: parsed.accuracy,
                        decision_soundness: parsed.decision_soundness,
                        directional_consistency: parsed.directional_consistency,
                        validity: parsed.validity,
                        
                        // 分析ラベル
                        analysis_labels: parsed.analysis_labels,
                        
                        // 統合評価
                        overall_assessment: parsed.overall_assessment || this._deriveOverallAssessment(parsed),
                        
                        // 後方互換性のための変換
                        is_correct: (parsed.accuracy?.score || 0) >= 0.7,
                        is_plausible: (parsed.validity?.score || 0) === 1.0,
                        semantic_equivalence_level: this._mapAccuracyToLevel(parsed.accuracy?.score || 0)
                    };
                }
                
                // 2軸評価形式（旧形式・後方互換性）
                if (parsed.plausibility_evaluation && parsed.correctness_evaluation) {
                    return {
                        overall_assessment: parsed.correctness_evaluation.semantic_equivalence_level || "UNKNOWN",
                        is_correct: parsed.correctness_evaluation.is_correct || false,
                        is_plausible: parsed.plausibility_evaluation.is_plausible || false,
                        semantic_equivalence_level: parsed.correctness_evaluation.semantic_equivalence_level || "UNKNOWN",
                        // 元の詳細情報も保持
                        plausibility_evaluation: parsed.plausibility_evaluation,
                        correctness_evaluation: parsed.correctness_evaluation
                    };
                }
                
                // その他の形式はそのまま返す
                return parsed;
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
                // プロジェクトルートのpromptディレクトリを参照
                const projectRoot = '/app';
                await this.initializeTemplate(path.join(projectRoot, "prompt", "00_evaluationPrompt.txt"));
            }
            if (!this.llmClient) {
                const config = new Config();
                await this.initializeLLMClient(config);
            }

            // Configインスタンスを取得（設定値の統一化）
            const config = new Config();

            // テンプレートに渡すコンテキストデータの準備
            const templateContext = {
                code_context: await this.generateCodeContext(groundTruthDiff, premergePath),
                ground_truth_diff: groundTruthDiff || "No ground truth diff available",
                agent_generated_diff: agentGeneratedDiff,
                agent_thought_process: agentThoughtProcess
            };
            
            // テンプレートレンダリング
            const renderedPrompt = this.templateRenderer.render(templateContext);
            
            // LLMリクエストを作成（Configから設定を取得）
            const llmRequest = createLLMRequest([
                { role: 'user', content: renderedPrompt }
            ], {
                temperature: config.getConfigValue('llm.temperature', 0.1),
                maxTokens: config.getConfigValue('llm.maxTokens', 4000),
                // Gemini思考制御パラメータ
                reasoningEffort: config.getConfigValue('gemini.reasoningEffort') || config.getConfigValue('llm.reasoningEffort'),
                thinkingBudget: config.getConfigValue('gemini.thinkingBudget') || config.getConfigValue('llm.thinkingBudget'),
                includeThoughts: config.getConfigValue('gemini.includeThoughts', false) || config.getConfigValue('llm.includeThoughts', false)
            });
            
            // LLMクライアントでの評価実行
            const llmResponse = await this.llmClient.generateContent(llmRequest);
            
            if (llmResponse && llmResponse.content) {
                // LLM応答の解析
                const evaluationResult = this.parseEvaluationResponse(llmResponse.content);
                
                return {
                    success: true,
                    error: null,
                    result: {
                        ...evaluationResult,
                        templateUsed: true,
                        promptLength: renderedPrompt.length,
                        llmMetadata: {
                            provider: this.llmClient.getProviderName(),
                            model: llmResponse.model || 'unknown',
                            usage: llmResponse.usage || null,
                            timestamp: new Date().toISOString()
                        }
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
            // 共通エラーハンドラーでエラーを解析
            const errorAnalysis = this.errorHandler.analyzeLLMError(error);
            
            // エラー詳細をログ出力
            this.errorHandler.logErrorDetails(errorAnalysis);
            
            return {
                success: false,
                error: errorAnalysis.message,
                result: { 
                    error: errorAnalysis.message, 
                    templateUsed: false,
                    errorAnalysis: errorAnalysis
                }
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

    /**
     * Intent Fulfillment評価（LLM_C）
     * コミットメッセージに記載された意図をエージェントが満たしているかを評価
     * @param {Object} context - 評価コンテキスト
     * @param {Object} context.commitMessage - コミットメッセージ情報
     * @param {string} context.agentGeneratedDiff - エージェント生成diff
     * @param {string} context.agentThoughtProcess - エージェントの思考過程
     * @param {boolean} context.agentMadeChanges - エージェントが変更を行ったか
     * @returns {Promise<Object>} Intent Fulfillment評価結果
     */
    async evaluateIntentFulfillment(context) {
        const {
            commitMessage,
            agentGeneratedDiff,
            agentThoughtProcess,
            agentMadeChanges = true
        } = context;

        if (!commitMessage) {
            return {
                success: false,
                error: "コミットメッセージが提供されていません",
                result: { skipped: "no_commit_message" }
            };
        }

        try {
            // Intent Fulfillmentテンプレートの初期化
            const projectRoot = '/app';
            const intentTemplatePath = path.join(projectRoot, "prompt", "01_intentFulfillmentPrompt.txt");
            const templateString = await fs.readFile(intentTemplatePath, 'utf-8');
            
            // テンプレート文字列を直接渡してインスタンス化
            const intentTemplateRenderer = new TemplateRenderer(templateString);

            // LLMクライアントの初期化確認
            if (!this.llmClient) {
                const config = new Config();
                await this.initializeLLMClient(config);
            }

            // テンプレートコンテキストの準備
            const templateContext = {
                commit_subject: commitMessage.subject || '',
                commit_body: commitMessage.body || '',
                agent_made_changes: agentMadeChanges,
                agent_generated_diff: agentGeneratedDiff || '',
                agent_reasoning: agentMadeChanges ? '' : 'No changes were made by the agent',
                agent_thought_process: agentThoughtProcess || ''
            };

            // テンプレートレンダリング
            const renderedPrompt = intentTemplateRenderer.render(templateContext);

            // LLMリクエストを作成
            const config = new Config();
            const llmRequest = createLLMRequest([
                { role: 'user', content: renderedPrompt }
            ], {
                temperature: config.getConfigValue('llm.temperature', 0.1),
                maxTokens: config.getConfigValue('llm.maxTokens', 2000)
            });

            // LLMクライアントでの評価実行
            const llmResponse = await this.llmClient.generateContent(llmRequest);

            if (llmResponse && llmResponse.content) {
                // レスポンスのパース
                const intentEvaluation = this.parseIntentFulfillmentResponse(llmResponse.content);

                return {
                    success: true,
                    error: null,
                    result: {
                        ...intentEvaluation,
                        templateUsed: true,
                        promptLength: renderedPrompt.length,
                        llmMetadata: {
                            provider: this.llmClient.getProviderName(),
                            model: llmResponse.model || 'unknown',
                            usage: llmResponse.usage || null,
                            timestamp: new Date().toISOString()
                        }
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
            const errorAnalysis = this.errorHandler.analyzeLLMError(error);
            this.errorHandler.logErrorDetails(errorAnalysis);

            return {
                success: false,
                error: errorAnalysis.message,
                result: {
                    error: errorAnalysis.message,
                    templateUsed: false,
                    errorAnalysis: errorAnalysis
                }
            };
        }
    }

    /**
     * Intent Fulfillment levelを数値スコアにマッピング
     * @param {string} level - IntentFulfillmentLevel
     * @returns {number} 数値スコア (0.0-1.0)
     */
    _mapIntentFulfillmentLevelToScore(level) {
        const mapping = {
            'FULLY_IMPLEMENTED': 1.0,
            'SUBSTANTIALLY_IMPLEMENTED': 0.8,
            'PARTIALLY_IMPLEMENTED': 0.5,
            'DIRECTIONALLY_CORRECT': 0.3,
            'NOT_ADDRESSED': 0.0
        };
        return mapping[level] ?? null;
    }

    /**
     * Intent Fulfillmentレスポンスのパース
     * @param {string} responseContent - LLMからのレスポンス内容
     * @returns {Object} パースされた評価結果
     */
    parseIntentFulfillmentResponse(responseContent) {
        try {
            // JSON形式の場合
            if (responseContent.trim().startsWith('{')) {
                const parsed = JSON.parse(responseContent);

                // intent_fulfillmentネストがある場合は展開
                if (parsed.intent_fulfillment) {
                    const intentData = parsed.intent_fulfillment;
                    
                    // 新形式（level）の場合は数値スコアに変換
                    let score = intentData.score;
                    if (intentData.level !== undefined) {
                        score = this._mapIntentFulfillmentLevelToScore(intentData.level);
                    }
                    
                    return {
                        score: score,
                        level: intentData.level,
                        reasoning: intentData.reasoning,
                        commit_intent_summary: intentData.commit_intent_summary,
                        agent_output_summary: intentData.agent_output_summary,
                        alignment_analysis: intentData.alignment_analysis
                    };
                }

                // 既にフラット構造の場合
                let score = parsed.score;
                if (parsed.level !== undefined) {
                    score = this._mapIntentFulfillmentLevelToScore(parsed.level);
                }
                
                return {
                    score: score,
                    level: parsed.level,
                    reasoning: parsed.reasoning,
                    commit_intent_summary: parsed.commit_intent_summary,
                    agent_output_summary: parsed.agent_output_summary,
                    alignment_analysis: parsed.alignment_analysis
                };
            }

            // テキスト形式の場合のエラー
            return {
                error: "Response parsing failed",
                parse_error: "Expected JSON format"
            };
        } catch (error) {
            return {
                error: "Response parsing error",
                parse_error: error.message
            };
        }
    }
}

export default LLMEvaluationService;
