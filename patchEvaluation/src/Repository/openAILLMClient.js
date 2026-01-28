/**
 * OpenAI LLM Client（JavaScript版）
 * OpenAI APIとの通信を担当
 */

import { config as dotenvConfig } from 'dotenv';
import { LLMClient, createLLMResponse } from './llmClient.js';

// 環境変数の読み込み
dotenvConfig({ path: '/app/.env' });

export class OpenAILLMClient extends LLMClient {
    constructor(config, apiKey) {
        super();
        this.config = config;
        this.client = null;
        this.isInitialized = false;
        
        // 環境変数から APIキーを取得
        const finalApiKey = apiKey || process.env.OPENAI_API_KEY || '';
        
        console.log(`🔑 OpenAILLMClient: Using API key length: ${finalApiKey.length}`);
        console.log(`🔑 Available env vars: OPENAI_API_KEY=${!!process.env.OPENAI_API_KEY}`);
        console.log(`🤖 OpenAILLMClient: Using model: ${this.config.get('llm.model', 'gpt-5')}`);
        
        // OpenAIクライアントの初期化を非同期で行う
        this.initPromise = this.initializeClient(finalApiKey);
    }

    async initializeClient(apiKey) {
        try {
            // 動的importを使用してES modules対応
            const { default: OpenAI } = await import('openai');
            
            // タイムアウト設定を統一：openai.timeout -> llm.timeout の順で取得
            const timeoutMs = this.config.get('openai.timeout', this.config.get('llm.timeout', 120000));
            console.log(`🕒 OpenAI client timeout set to: ${timeoutMs}ms`);
            
            this.client = new OpenAI({
                apiKey: apiKey,
                timeout: timeoutMs
            });
            
            this.isInitialized = true;
            console.log('✅ OpenAI client initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize OpenAI client:', error);
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
        return 'OpenAI';
    }

    async generateContent(request) {
        if (!this.isInitialized) {
            await this.waitForInitialization();
        }

        try {
            const model = request.model || this.config.get('llm.model', this.config.get('openai.model', 'gpt-5'));
            const maxTokens = request.maxTokens || this.config.get('llm.maxTokens', 4000);
            
            console.log(`🚀 OpenAI request: model=${model}, maxTokens=${maxTokens}`);

            // APIリクエストパラメータを準備
            const apiParams = {
                model: model,
                messages: request.messages
            };
            
            // gpt-5系モデルではmax_completion_tokensをスキップ
            const isGpt5Model = model.startsWith('gpt-5');
            if (!isGpt5Model && maxTokens) {
                apiParams.max_completion_tokens = maxTokens;
                console.log(`🔢 OpenAI max_completion_tokens: ${maxTokens}`);
            } else if (isGpt5Model) {
                console.log(`ℹ️  ${model}: max_completion_tokensパラメータはスキップされます`);
            }
            
            // gpt-5系モデルではtemperatureをスキップ（デフォルト値1のみサポート）
            if (!isGpt5Model && request.temperature !== undefined) {
                apiParams.temperature = request.temperature;
                console.log(`🌡️  OpenAI temperature: ${request.temperature}`);
            } else if (isGpt5Model) {
                console.log(`ℹ️  ${model}: temperatureパラメータはスキップされます（デフォルト1使用）`);
            }
            
            // response_formatパラメータ（JSON mode）
            if (request.responseFormat) {
                apiParams.response_format = request.responseFormat;
                console.log(`📋 OpenAI response_format: ${JSON.stringify(request.responseFormat)}`);
            }

            // タイムアウト付きのAPI呼び出し
            // 統一されたタイムアウト設定を使用
            const apiTimeout = this.config.get('openai.timeout', this.config.get('llm.timeout', 120000));
            console.log(`🕒 OpenAI API call timeout: ${apiTimeout}ms`);
            
            const apiCall = this.client.chat.completions.create(apiParams);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`OpenAI API timeout after ${apiTimeout}ms`)), apiTimeout)
            );

            const response = await Promise.race([apiCall, timeoutPromise]);

            const content = response.choices[0]?.message?.content || '';
            const usage = response.usage;

            console.log(`✅ OpenAI response: ${content.length} chars, usage: ${usage?.total_tokens || 0} tokens`);

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
            console.error('❌ OpenAI API error:', error);
            
            // エラー情報を標準化してスロー
            const standardError = new Error(error.message);
            standardError.originalError = error;
            standardError.status = error.status;
            standardError.provider = 'openai';
            throw standardError;
        }
    }
}

export default OpenAILLMClient;
