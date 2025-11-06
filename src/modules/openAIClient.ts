/**
 * OpenAI API クライアント (レガシー互換性)
 * 新しいLLMクライアントシステムと既存コードの橋渡し
 */

import Config from './config.js';
import { LLMClientFactory } from './llmClientFactory.js';
import { LLMClient } from './llmClient.js';

class OpenAIClient {
    private llmClient: LLMClient;
    private config: Config;
    public initPromise: Promise<void>;

    constructor(config: Config, apiKey?: string) {
        this.config = config;
        
        console.log(`🔑 OPENAI_API_KEY length: ${(process.env.OPENAI_API_KEY || '').length}`);
        console.log(`🔑 OPENAI_API_KEY length: ${(process.env.OPENAI_API_KEY || '').length}`);
        console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
        console.log(`� DEBUG_MODE: ${process.env.DEBUG_MODE || 'undefined'}`);
        
        // プロバイダーの自動選択または設定に基づく選択
        const provider = LLMClientFactory.autoSelectProvider(config);
        console.log(`🤖 Selected LLM provider: ${provider}`);
        
        this.llmClient = LLMClientFactory.create(config, provider);
        this.initPromise = this.llmClient.waitForInitialization();
    }

    async fetchOpenAPI(messages: Array<{ role: string, content: string }>): Promise<any> {
        // 新しいLLMクライアントを使用してレスポンスを取得
        await this.initPromise;

        try {
            const response = await this.llmClient.generateContent({
                messages: messages.map(msg => ({
                    role: msg.role as 'system' | 'user' | 'assistant',
                    content: msg.content
                }))
            });

            // 既存のコードとの互換性のため、OpenAI形式のレスポンスを模倣
            return {
                choices: [{
                    message: {
                        content: response.content,
                        role: 'assistant'
                    },
                    finish_reason: response.finishReason || 'stop'
                }],
                usage: response.usage ? {
                    prompt_tokens: response.usage.promptTokens,
                    completion_tokens: response.usage.completionTokens,
                    total_tokens: response.usage.totalTokens
                } : {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                },
                model: response.model || 'unknown'
            };

        } catch (error) {
            console.error('❌ LLM API error:', error);
            throw error;
        }
    }

    /**
     * 使用中のLLMプロバイダー名を取得
     */
    getProviderName(): string {
        return this.llmClient.getProviderName();
    }

    /**
     * LLMクライアントが準備完了かチェック
     */
    isReady(): boolean {
        return this.llmClient.isReady();
    }

    /**
     * モック用メソッド: レスポンスを直接設定（互換性のため残す）
     */
    setMockResponse(response: any): void {
        // 新しいシステムではモック機能は各クライアントで処理
        console.warn('⚠️  setMockResponse is deprecated in new LLM system');
    }
}

export default OpenAIClient;
