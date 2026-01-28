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
     * 4軸評価用ヘルパーメソッド：accuracyラベルからレガシースコアへのマッピング（後方互換性）
     * @param {string} accuracyLabel - Accuracy label
     * @returns {number} Legacy score (0.0-1.0)
     */
    _mapLabelToScore(accuracyLabel) {
        const labelToScore = {
            'IDENTICAL': 1.0,
            'SEMANTICALLY_EQUIVALENT': 0.85,
            'PARTIALLY_CORRECT': 0.5,
            'WRONG_APPROACH': 0.25,
            'NO_MATCH': 0.0
        };
        return labelToScore[accuracyLabel] || 0.0;
    }

    /**
     * 4軸評価用ヘルパーメソッド：accuracyラベルからsemantic_equivalence_levelへのマッピング
     * @param {string} accuracyLabel - Accuracy label
     * @returns {string} Semantic equivalence level
     */
    _mapLabelToSemanticLevel(accuracyLabel) {
        const labelMapping = {
            'IDENTICAL': 'IDENTICAL',
            'SEMANTICALLY_EQUIVALENT': 'SEMANTICALLY_EQUIVALENT',
            'PARTIALLY_CORRECT': 'PLAUSIBLE_BUT_DIFFERENT',
            'WRONG_APPROACH': 'INCORRECT',
            'NO_MATCH': 'INCORRECT'
        };
        return labelMapping[accuracyLabel] || 'INCORRECT';
    }

    /**
     * 4軸評価から統合評価を導出
     * @param {Object} evaluation - 4軸評価結果
     * @returns {string} Overall assessment
     */
    _deriveOverallAssessment(evaluation) {
        const accuracyLabel = evaluation.accuracy?.label || 'NO_MATCH';
        const validityLabel = evaluation.validity?.label || 'INVALID';
        
        // Validityが無効なら常にINCORRECT
        if (validityLabel === 'INVALID') {
            return 'INCORRECT';
        }
        
        // Accuracyラベルに基づいて評価
        return this._mapLabelToSemanticLevel(accuracyLabel);
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
                
                // 4軸評価形式（新ラベルベース形式）
                if (parsed.accuracy?.label !== undefined) {
                    const accuracyLabel = parsed.accuracy.label;
                    const validityLabel = parsed.validity?.label || 'VALID';
                    
                    return {
                        // 4軸評価（ラベル形式）
                        accuracy: parsed.accuracy,
                        decision_soundness: parsed.decision_soundness,
                        directional_consistency: parsed.directional_consistency,
                        validity: parsed.validity,
                        
                        // 分析ラベル
                        analysis_labels: parsed.analysis_labels,
                        
                        // 統合評価
                        overall_assessment: parsed.overall_assessment || this._deriveOverallAssessment(parsed),
                        
                        // 後方互換性のための変換（レガシーシステム用）
                        is_correct: ['IDENTICAL', 'SEMANTICALLY_EQUIVALENT'].includes(accuracyLabel),
                        is_plausible: validityLabel === 'VALID',
                        semantic_equivalence_level: this._mapLabelToSemanticLevel(accuracyLabel),
                        
                        // スコア形式への変換（統計・グラフ用）
                        accuracy_score: this._mapLabelToScore(accuracyLabel),
                        decision_soundness_score: parsed.decision_soundness?.label === 'SOUND' ? 1.0 : 0.0,
                        directional_consistency_score: parsed.directional_consistency?.label === 'CONSISTENT' ? 1.0 : 0.0,
                        validity_score: validityLabel === 'VALID' ? 1.0 : 0.0
                    };
                }
                
                // 旧スコア形式（後方互換性）
                if (parsed.accuracy?.score !== undefined) {
                    console.log('🔍 parseEvaluationResponse: 旧スコア形式を使用');
                    const accuracyScore = parsed.accuracy.score;
                    
                    return {
                        // 旧形式のスコアをラベルに変換
                        accuracy: {
                            label: this._scoreToLabel(accuracyScore),
                            reasoning: parsed.accuracy.reasoning,
                            score: accuracyScore // 保持
                        },
                        decision_soundness: {
                            label: parsed.decision_soundness?.score === 1.0 ? 'SOUND' : 'UNSOUND',
                            reasoning: parsed.decision_soundness?.reasoning || ''
                        },
                        directional_consistency: {
                            label: parsed.directional_consistency?.score === 1.0 ? 'CONSISTENT' : 'CONTRADICTORY',
                            reasoning: parsed.directional_consistency?.reasoning || ''
                        },
                        validity: {
                            label: parsed.validity?.score === 1.0 ? 'VALID' : 'INVALID',
                            reasoning: parsed.validity?.reasoning || ''
                        },
                        analysis_labels: parsed.analysis_labels,
                        overall_assessment: this._deriveOverallAssessment({
                            accuracy: { label: this._scoreToLabel(accuracyScore) },
                            validity: { label: parsed.validity?.score === 1.0 ? 'VALID' : 'INVALID' }
                        }),
                        is_correct: accuracyScore >= 0.7,
                        is_plausible: (parsed.validity?.score || 0) === 1.0,
                        semantic_equivalence_level: this._mapAccuracyToLevel(accuracyScore),
                        accuracy_score: accuracyScore,
                        decision_soundness_score: parsed.decision_soundness?.score || 0,
                        directional_consistency_score: parsed.directional_consistency?.score || 0,
                        validity_score: parsed.validity?.score || 0
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
                console.log('⚠️ parseEvaluationResponse: どの形式にも一致しません。パースされたデータをそのまま返します。');
                console.log('   - parsed keys:', Object.keys(parsed).join(', '));
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
     * スコアからラベルへの変換（旧形式の後方互換性用）
     * @param {number} score - Accuracy score (0.0-1.0)
     * @returns {string} Accuracy label
     */
    _scoreToLabel(score) {
        if (score >= 0.95) return 'IDENTICAL';
        if (score >= 0.7) return 'SEMANTICALLY_EQUIVALENT';
        if (score >= 0.4) return 'PARTIALLY_CORRECT';
        if (score >= 0.15) return 'WRONG_APPROACH';
        return 'NO_MATCH';
    }

    /**
     * レガシー用：スコアからレベルへのマッピング
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
                // JSON形式の応答を強制
                responseFormat: { type: "json_object" },
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
                maxTokens: config.getConfigValue('llm.maxTokens', 2000),
                responseFormat: { type: 'json_object' } // JSON mode を強制
            });

            // LLMクライアントでの評価実行
            const llmResponse = await this.llmClient.generateContent(llmRequest);

            if (llmResponse && llmResponse.content) {
                // デバッグ: 生レスポンスをログ出力
                console.log('🔍 Intent Fulfillment 生レスポンス:');
                console.log(llmResponse.content.substring(0, 500) + (llmResponse.content.length > 500 ? '...' : ''));
                
                // レスポンスのパース
                const intentEvaluation = this.parseIntentFulfillmentResponse(llmResponse.content);
                
                // デバッグ: パース結果をログ出力
                console.log('🔍 Intent Fulfillment パース結果:');
                console.log(JSON.stringify(intentEvaluation, null, 2));

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
     * Intent Fulfillmentレスポンスのパース
     * @param {string} responseContent - LLMからのレスポンス内容
     * @returns {Object} パースされた評価結果
     */
    parseIntentFulfillmentResponse(responseContent) {
        try {
            // JSON形式の場合
            if (responseContent.trim().startsWith('{')) {
                const parsed = JSON.parse(responseContent);

                // intent_fulfillmentネストがある場合
                if (parsed.intent_fulfillment) {
                    const intentFulfillment = parsed.intent_fulfillment;
                    
                    // ラベルベース形式（新形式）
                    if (intentFulfillment.label !== undefined) {
                        return {
                            label: intentFulfillment.label,
                            reasoning: intentFulfillment.reasoning || intentFulfillment.explanation || '',
                            commit_intent_summary: intentFulfillment.commit_intent_summary || '',
                            agent_output_summary: intentFulfillment.agent_output_summary || '',
                            alignment_analysis: intentFulfillment.alignment_analysis || intentFulfillment.reasoning || '',
                            // 統計用にスコアも生成
                            score: this._intentLabelToScore(intentFulfillment.label)
                        };
                    }
                    
                    // スコアベース形式（旧形式・後方互換性）
                    if (intentFulfillment.score !== undefined) {
                        return {
                            label: this._intentScoreToLabel(intentFulfillment.score),
                            score: intentFulfillment.score,
                            reasoning: intentFulfillment.reasoning || intentFulfillment.explanation || '',
                            commit_intent_summary: intentFulfillment.commit_intent_summary || '',
                            agent_output_summary: intentFulfillment.agent_output_summary || '',
                            alignment_analysis: intentFulfillment.alignment_analysis || intentFulfillment.reasoning || ''
                        };
                    }
                    
                    // explanation/reasoning フィールドのみの場合（LLMが他のフィールドを省略した場合）
                    if (intentFulfillment.reasoning || intentFulfillment.explanation) {
                        console.warn('⚠️ Intent Fulfillment: label/scoreがない（reasoningのみ）', intentFulfillment);
                        return {
                            label: 'UNKNOWN',
                            reasoning: intentFulfillment.reasoning || intentFulfillment.explanation || '',
                            commit_intent_summary: intentFulfillment.commit_intent_summary || '',
                            agent_output_summary: intentFulfillment.agent_output_summary || '',
                            alignment_analysis: intentFulfillment.alignment_analysis || '',
                            score: 0.0,
                            error: 'Missing label or score field in intent_fulfillment'
                        };
                    }
                }

                // フラット構造でラベルがある場合
                if (parsed.label !== undefined) {
                    return {
                        label: parsed.label,
                        reasoning: parsed.reasoning || parsed.explanation || '',
                        commit_intent_summary: parsed.commit_intent_summary || '',
                        agent_output_summary: parsed.agent_output_summary || '',
                        alignment_analysis: parsed.alignment_analysis || parsed.reasoning || '',
                        score: this._intentLabelToScore(parsed.label)
                    };
                }

                // フラット構造でスコアがある場合（旧形式）
                if (parsed.score !== undefined) {
                    return {
                        label: this._intentScoreToLabel(parsed.score),
                        score: parsed.score,
                        reasoning: parsed.reasoning || parsed.explanation || '',
                        commit_intent_summary: parsed.commit_intent_summary || '',
                        agent_output_summary: parsed.agent_output_summary || '',
                        alignment_analysis: parsed.alignment_analysis || parsed.reasoning || ''
                    };
                }

                // reasoning/explanationフィールドのみがある場合
                if (parsed.reasoning || parsed.explanation) {
                    console.warn('⚠️ Intent Fulfillment: フラット構造でlabel/scoreがない', parsed);
                    
                    // reasoningテキストから推測を試みる
                    const reasoningText = (parsed.reasoning || parsed.explanation || '').toLowerCase();
                    let inferredLabel = 'UNKNOWN';
                    
                    if (reasoningText.includes('not fulfill') || reasoningText.includes('does not') || reasoningText.includes('no alignment')) {
                        inferredLabel = 'NOT_FULFILLED';
                    } else if (reasoningText.includes('fully') || reasoningText.includes('completely')) {
                        inferredLabel = 'FULLY_FULFILLED';
                    } else if (reasoningText.includes('substantially')) {
                        inferredLabel = 'SUBSTANTIALLY_FULFILLED';
                    } else if (reasoningText.includes('partially')) {
                        inferredLabel = 'PARTIALLY_FULFILLED';
                    } else if (reasoningText.includes('minimally')) {
                        inferredLabel = 'MINIMALLY_FULFILLED';
                    }
                    
                    console.log(`  🔍 推測されたラベル: ${inferredLabel}`);
                    
                    return {
                        label: inferredLabel,
                        reasoning: parsed.reasoning || parsed.explanation || '',
                        commit_intent_summary: parsed.commit_intent_summary || '',
                        agent_output_summary: parsed.agent_output_summary || '',
                        alignment_analysis: parsed.alignment_analysis || '',
                        score: this._intentLabelToScore(inferredLabel),
                        inferred: true
                    };
                }

                // その他の形式: 想定外の構造の場合、エラーとして扱う
                console.warn('⚠️ Intent Fulfillment: 想定外のJSON構造:', JSON.stringify(parsed, null, 2));
                return {
                    error: "Unexpected response structure",
                    parse_error: "Response does not match expected format (missing label or score)",
                    raw_response: parsed
                };
            }

            // テキスト形式の場合のエラー
            console.warn('⚠️ Intent Fulfillment: JSON形式ではないレスポンス');
            return {
                error: "Response parsing failed",
                parse_error: "Expected JSON format",
                raw_text_preview: responseContent.substring(0, 200)
            };
        } catch (error) {
            console.error('❌ Intent Fulfillment: JSONパースエラー:', error.message);
            return {
                error: "Response parsing error",
                parse_error: error.message,
                raw_text_preview: responseContent.substring(0, 200)
            };
        }
    }

    /**
     * Intent Fulfillmentラベルをスコアに変換
     * @param {string} label - Intent fulfillment label
     * @returns {number} Score (0.0-1.0)
     */
    _intentLabelToScore(label) {
        const labelToScore = {
            'INTENT_FULFILLED': 1.0,
            'INTENT_PARTIALLY_FULFILLED': 0.5,
            'INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED': 0.2,
            'INTENT_NOT_FULFILLED': 0.0,
            // 旧形式との後方互換性
            'FULLY_FULFILLED': 1.0,
            'SUBSTANTIALLY_FULFILLED': 0.8,
            'PARTIALLY_FULFILLED': 0.5,
            'MINIMALLY_FULFILLED': 0.2,
            'NOT_FULFILLED': 0.0
        };
        return labelToScore[label] ?? 0.0;
    }

    /**
     * Intent Fulfillmentスコアをラベルに変換（旧形式の後方互換性用）
     * @param {number} score - Intent fulfillment score (0.0-1.0)
     * @returns {string} Intent fulfillment label
     */
    _intentScoreToLabel(score) {
        if (score >= 0.9) return 'INTENT_FULFILLED';
        if (score >= 0.4) return 'INTENT_PARTIALLY_FULFILLED';
        if (score >= 0.1) return 'INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED';
        return 'INTENT_NOT_FULFILLED';
    }
}

export default LLMEvaluationService;
