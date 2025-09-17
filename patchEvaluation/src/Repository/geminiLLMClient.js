/**
 * Gemini LLM Client（JavaScript版）
 * Google Gemini API（OpenAI互換モード）との通信を担当
 */

import { config as dotenvConfig } from 'dotenv';
import { LLMClient, createLLMResponse } from './llmClient.js';

// 環境変数の読み込み
dotenvConfig({ path: '/app/.env' });

export class GeminiLLMClient extends LLMClient {
    constructor(config, apiKey) {
        super();
        this.config = config;
        this.client = null;
        this.isInitialized = false;
        
        // 環境変数から APIキーを取得
        const finalApiKey = apiKey || process.env.GEMINI_API_KEY || '';
        
        console.log(`🔑 GeminiLLMClient: Using API key length: ${finalApiKey.length}`);
        console.log(`🔑 Available env vars: GEMINI_API_KEY=${!!process.env.GEMINI_API_KEY}`);
        console.log(`🤖 GeminiLLMClient: Using model: ${this.config.get('gemini.model', 'gemini-2.5-pro')}`);
        
        // OpenAI互換モードでGeminiクライアントの初期化を非同期で行う
        this.initPromise = this.initializeClient(finalApiKey);
    }

    async initializeClient(apiKey) {
        try {
            // 動的importを使用してES modules対応（OpenAIライブラリを使用）
            const { default: OpenAI } = await import('openai');
            
            // タイムアウト設定を統一：gemini.timeout -> llm.timeout の順で取得
            const timeoutMs = this.config.get('gemini.timeout', this.config.get('llm.timeout', 120000));
            console.log(`🕒 Gemini (OpenAI互換) client timeout set to: ${timeoutMs}ms`);
            
            // OpenAI互換モードでGemini APIに接続
            this.client = new OpenAI({
                apiKey: apiKey,
                baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
                timeout: timeoutMs
            });
            
            this.isInitialized = true;
            console.log('✅ Gemini (OpenAI互換) client initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Gemini (OpenAI互換) client:', error);
            throw error;
        }
    }

    async waitForInitialization() {
        return this.initPromise;
    }

    isReady() {
        return this.isInitialized;
    }

    getProviderName() {
        return 'Gemini';
    }

    async generateContent(request) {
        if (!this.isInitialized) {
            await this.waitForInitialization();
        }

        try {
            const model = request.model || this.config.get('gemini.model', 'gemini-2.5-pro');
            const maxTokens = request.maxTokens || this.config.get('llm.maxTokens', 4000);
            
            console.log(`🚀 Gemini (OpenAI互換) request: model=${model}, maxTokens=${maxTokens}`);

            // APIリクエストパラメータを準備
            const apiParams = {
                model: model,
                messages: request.messages
            };
            
            // max_completion_tokensを設定
            if (maxTokens) {
                apiParams.max_completion_tokens = maxTokens;
                console.log(`🔢 Gemini max_completion_tokens: ${maxTokens}`);
            }
            
            // temperatureを設定
            if (request.temperature !== undefined) {
                apiParams.temperature = request.temperature;
                console.log(`🌡️  Gemini temperature: ${request.temperature}`);
            }

            // Gemini思考制御機能の設定
            this.configureReasoningParameters(apiParams, request);

            // タイムアウト付きのAPI呼び出し
            // 統一されたタイムアウト設定を使用
            const apiTimeout = this.config.get('gemini.timeout', this.config.get('llm.timeout', 120000));
            console.log(`🕒 Gemini API call timeout: ${apiTimeout}ms`);
            
            const apiCall = this.client.chat.completions.create(apiParams);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Gemini API timeout after ${apiTimeout}ms`)), apiTimeout)
            );

            const response = await Promise.race([apiCall, timeoutPromise]);

            const content = response.choices[0]?.message?.content || '';
            const usage = response.usage;

            console.log(`✅ Gemini response: ${content.length} chars, usage: ${usage?.total_tokens || 0} tokens`);

            return createLLMResponse(content, {
                usage: {
                    promptTokens: usage?.prompt_tokens || 0,
                    completionTokens: usage?.completion_tokens || 0,
                    totalTokens: usage?.total_tokens || 0
                },
                model: response.model,
                finishReason: response.choices[0]?.finish_reason || 'unknown'
            });
        } catch (error) {
            console.error('❌ Gemini API error:', error);
            
            // エラー情報を標準化してスロー
            const standardError = new Error(error.message);
            standardError.originalError = error;
            standardError.status = error.status;
            standardError.provider = 'gemini';
            throw standardError;
        }
    }

    /**
     * Gemini思考制御パラメータを設定
     * @param {Object} apiParams - APIリクエストパラメータ
     * @param {Object} request - 元のリクエストオブジェクト
     */
    configureReasoningParameters(apiParams, request) {
        // 設定からreasoningパラメータを取得
        const reasoningEffort = request.reasoningEffort || 
                               this.config.get('gemini.reasoningEffort') || 
                               this.config.get('llm.reasoningEffort');
        
        const thinkingBudget = request.thinkingBudget || 
                              this.config.get('gemini.thinkingBudget') || 
                              this.config.get('llm.thinkingBudget');
        
        const includeThoughts = request.includeThoughts !== undefined ? 
                               request.includeThoughts : 
                               (this.config.get('gemini.includeThoughts') || 
                                this.config.get('llm.includeThoughts', false));

        // reasoning_effort パラメータの設定
        if (reasoningEffort) {
            const validEfforts = ['none', 'low', 'medium', 'high'];
            if (validEfforts.includes(reasoningEffort)) {
                apiParams.reasoning_effort = reasoningEffort;
                console.log(`🧠 Gemini reasoning_effort: ${reasoningEffort}`);
                
                // reasoning_effortとthinking_budgetは同時使用不可
                if (thinkingBudget) {
                    console.warn('⚠️  reasoning_effortとthinking_budgetは同時に設定できません。reasoning_effortを優先します。');
                }
                return;
            } else {
                console.warn(`⚠️  無効なreasoning_effort値: ${reasoningEffort}. 有効値: ${validEfforts.join(', ')}`);
            }
        }

        // thinking_budget パラメータの設定（reasoning_effortが設定されていない場合のみ）
        if (thinkingBudget && typeof thinkingBudget === 'number' && thinkingBudget > 0) {
            const thinkingConfig = {
                thinking_budget: thinkingBudget
            };

            if (includeThoughts) {
                thinkingConfig.include_thoughts = true;
                console.log(`🧠 Gemini thinking_budget: ${thinkingBudget}, include_thoughts: true`);
            } else {
                console.log(`🧠 Gemini thinking_budget: ${thinkingBudget}`);
            }

            // extra_bodyフィールドに思考設定を追加
            apiParams.extra_body = {
                google: {
                    thinking_config: thinkingConfig
                }
            };
        } else if (includeThoughts && !thinkingBudget && !reasoningEffort) {
            // thinking_budgetが未設定でもinclude_thoughtsがtrueの場合
            console.log(`🧠 Gemini include_thoughts: true (デフォルト予算使用)`);
            apiParams.extra_body = {
                google: {
                    thinking_config: {
                        include_thoughts: true
                    }
                }
            };
        }
    }

    /**
     * reasoning_effort レベルに対応するトークン数を取得
     * @param {string} effort - reasoning_effort レベル
     * @returns {number} 対応するトークン数
     */
    getReasoningTokenBudget(effort) {
        const budgetMap = {
            'none': 0,
            'low': 1024,
            'medium': 8192,
            'high': 24576
        };
        return budgetMap[effort] || 0;
    }
}

export default GeminiLLMClient;
