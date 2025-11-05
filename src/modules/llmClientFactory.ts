/**
 * LLM Client Factory
 * 設定に基づいて適切なLLMクライアントを生成
 */

import Config from './config.js';
import { LLMClient } from './llmClient.js';
import OpenAILLMClient from './openAILLMClient.js';
import GeminiLLMClient from './geminiLLMClient.js';

export type LLMProvider = 'openai' | 'gemini';

export class LLMClientFactory {
    static create(config: Config, provider?: LLMProvider): LLMClient {
        // プロバイダーの決定（優先順位: 引数 > 設定 > デフォルト）
        const selectedProvider = provider || 
                                config.get('llm.provider', 'openai') as LLMProvider;

        console.log(`🏭 LLMClientFactory: Creating ${selectedProvider} client`);

        switch (selectedProvider) {
            case 'openai':
                return new OpenAILLMClient(config);
            
            case 'gemini':
                return new GeminiLLMClient(config);
            
            default:
                console.warn(`⚠️  Unknown LLM provider: ${selectedProvider}, falling back to OpenAI`);
                return new OpenAILLMClient(config);
        }
    }

    /**
     * 利用可能なプロバイダーの一覧を取得
     */
    static getAvailableProviders(): LLMProvider[] {
        return ['openai', 'gemini'];
    }

    /**
     * プロバイダーの自動選択（APIキーの有無で判定）
     */
    static autoSelectProvider(config: Config): LLMProvider {
        const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
        const hasGeminiKey = !!process.env.GEMINI_API_KEY;

        console.log(`🔍 Auto-selecting provider: OpenAI=${hasOpenAIKey}, Gemini=${hasGeminiKey}`);

        // 設定で明示的に指定されている場合はそれを優先
        const configuredProvider = config.get('llm.provider');
        if (configuredProvider) {
            console.log(`📋 Using configured provider: ${configuredProvider}`);
            return configuredProvider as LLMProvider;
        }

        // APIキーの有無で自動選択
        if (hasGeminiKey && !hasOpenAIKey) {
            return 'gemini';
        }
        
        // デフォルトはOpenAI
        return 'openai';
    }
}

export default LLMClientFactory;
