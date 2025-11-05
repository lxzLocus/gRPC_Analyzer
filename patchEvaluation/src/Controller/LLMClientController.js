/**
 * LLM Client Factory（JavaScript版）
 * 設定に基づいて適切なLLMクライアントを生成
 */

import Config from '../Config/config.js';
import OpenAILLMClient from '../Repository/openAILLMClient.js';
import GeminiLLMClient from '../Repository/geminiLLMClient.js';

export const LLMProvider = {
    OPENAI: 'openai',
    GEMINI: 'gemini'
};

export class LLMClientController {
    static create(config, provider) {
        // プロバイダーの決定（優先順位: 引数 > 設定 > デフォルト）
        const selectedProvider = provider || 
                                config.get('llm.provider', 'openai');

        console.log(`🏭 LLMClientController: Creating ${selectedProvider} client`);

        switch (selectedProvider) {
            case LLMProvider.OPENAI:
                return new OpenAILLMClient(config);
            
            case LLMProvider.GEMINI:
                return new GeminiLLMClient(config);
            
            default:
                console.warn(`⚠️  Unknown LLM provider: ${selectedProvider}, falling back to OpenAI`);
                return new OpenAILLMClient(config);
        }
    }

    /**
     * 利用可能なプロバイダーの一覧を取得
     */
    static getAvailableProviders() {
        return [LLMProvider.OPENAI, LLMProvider.GEMINI];
    }

    /**
     * プロバイダーの自動選択（APIキーの有無で判定）
     */
    static autoSelectProvider(config) {
        const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
        const hasGeminiKey = !!process.env.GEMINI_API_KEY;

        console.log(`🔍 Auto-selecting provider: OpenAI=${hasOpenAIKey}, Gemini=${hasGeminiKey}`);

        // 設定で明示的に指定されている場合はそれを優先
        const configuredProvider = config.get('llm.provider');
        if (configuredProvider) {
            console.log(`📋 Using configured provider: ${configuredProvider}`);
            return configuredProvider;
        }

        // APIキーの有無で自動選択
        if (hasGeminiKey && !hasOpenAIKey) {
            return LLMProvider.GEMINI;
        }
        
        // デフォルトはOpenAI
        return LLMProvider.OPENAI;
    }
}

export default LLMClientController;
