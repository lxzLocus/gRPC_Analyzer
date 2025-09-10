/**
 * OpenAI LLM Client
 * OpenAI APIとの通信を担当
 */

import Config from './config.js';
import { LLMClient, LLMRequest, LLMResponse } from './llmClient.js';

export class OpenAILLMClient implements LLMClient {
    private client: any;
    private initPromise: Promise<void>;
    private config: Config;
    private isInitialized: boolean = false;

    constructor(config: Config, apiKey?: string) {
        this.config = config;
        
        // 環境変数から APIキーを取得
        const finalApiKey = apiKey || process.env.OPENAI_API_KEY || '';
        
        console.log(`🔑 OpenAILLMClient: Using API key length: ${finalApiKey.length}`);
        console.log(`🔑 Available env vars: OPENAI_API_KEY=${!!process.env.OPENAI_API_KEY}`);
        console.log(`🤖 OpenAILLMClient: Using model: ${this.config.get('openai.model', process.env.OPENAI_MODEL || 'gpt-4.1')}`);
        
        // OpenAIクライアントの初期化を非同期で行う
        this.initPromise = this.initializeClient(finalApiKey);
    }

    private async initializeClient(apiKey: string): Promise<void> {
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

    async waitForInitialization(): Promise<void> {
        return this.initPromise;
    }

    isReady(): boolean {
        return this.isInitialized;
    }

    getProviderName(): string {
        return 'OpenAI';
    }

    async generateContent(request: LLMRequest): Promise<LLMResponse> {
        if (!this.isInitialized) {
            await this.waitForInitialization();
        }

        try {
            const model = request.model || this.config.get('openai.model', process.env.OPENAI_MODEL || 'gpt-4.1');
            const maxTokens = request.maxTokens || this.config.get('llm.maxTokens', 4000);
            
            console.log(`🚀 OpenAI request: model=${model}, maxTokens=${maxTokens}`);

            // APIリクエストパラメータを準備
            const apiParams: any = {
                model: model,
                messages: request.messages
            };
            
            // gpt-5以外の場合のみmax_completion_tokensを設定
            if (model !== 'gpt-5' && maxTokens) {
                apiParams.max_completion_tokens = maxTokens;
                console.log(`🔢 OpenAI max_completion_tokens: ${maxTokens}`);
            } else if (model === 'gpt-5') {
                console.log(`ℹ️  gpt-5: max_completion_tokensパラメータはスキップされます`);
            }

            // gpt-5以外の場合のみtemperatureを設定
            if (model !== 'gpt-5' && request.temperature !== undefined) {
                apiParams.temperature = request.temperature;
                console.log(`🌡️  OpenAI temperature: ${request.temperature}`);
            } else if (model === 'gpt-5') {
                console.log(`ℹ️  gpt-5: temperatureパラメータはスキップされます`);
            }

            // タイムアウト付きのAPI呼び出し
            // クライアント初期化時と同じタイムアウト値を使用
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

            return {
                content: content,
                usage: {
                    promptTokens: usage?.prompt_tokens || 0,
                    completionTokens: usage?.completion_tokens || 0,
                    totalTokens: usage?.total_tokens || 0
                }
            };
        } catch (error) {
            console.error('❌ OpenAI API error:', error);
            throw error;
        }
    }
}

export default OpenAILLMClient;
