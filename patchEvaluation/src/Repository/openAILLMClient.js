/**
 * OpenAI LLM Client（JavaScript版）
 * OpenAI APIとの通信を担当
 */

import { LLMClient, createLLMResponse } from './llmClient.js';

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
        console.log(`🤖 OpenAILLMClient: Using model: ${this.config.get('llm.model', 'gpt-4.1')}`);
        
        // OpenAIクライアントの初期化を非同期で行う
        this.initPromise = this.initializeClient(finalApiKey);
    }

    async initializeClient(apiKey) {
        try {
            // 動的importを使用してES modules対応
            const { default: OpenAI } = await import('openai');
            
            this.client = new OpenAI({
                apiKey: apiKey,
                timeout: this.config.get('llm.timeout', 30000)
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
            const model = request.model || this.config.get('openai.model', 'gpt-5');
            const maxTokens = request.maxTokens || this.config.get('llm.maxTokens', 4000);
            
            console.log(`🚀 OpenAI request: model=${model}, maxTokens=${maxTokens}`);

            // APIリクエストパラメータを準備
            const apiParams = {
                model: model,
                messages: request.messages,
                max_completion_tokens: maxTokens
            };
            
            // gpt-5以外の場合のみtemperatureを設定
            if (model !== 'gpt-5' && request.temperature !== undefined) {
                apiParams.temperature = request.temperature;
                console.log(`🌡️  OpenAI temperature: ${request.temperature}`);
            } else if (model === 'gpt-5') {
                console.log(`ℹ️  gpt-5: temperatureパラメータはスキップされます`);
            }

            // タイムアウト付きのAPI呼び出し
            const apiTimeout = this.config.get('llm.timeout', 30000);
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
            throw error;
        }
    }
}

export default OpenAILLMClient;
