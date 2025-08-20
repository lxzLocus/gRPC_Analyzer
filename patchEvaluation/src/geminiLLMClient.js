/**
 * Gemini LLM Client（JavaScript版）
 * Google Gemini APIとの通信を担当
 */

import { LLMClient, createLLMResponse } from './llmClient.js';

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
        
        // Geminiクライアントの初期化を非同期で行う
        this.initPromise = this.initializeClient(finalApiKey);
    }

    async initializeClient(apiKey) {
        try {
            // 動的importを使用してES modules対応
            const { GoogleGenAI } = await import('@google/genai');
            
            this.client = new GoogleGenAI({ 
                apiKey: apiKey 
            });
            
            this.isInitialized = true;
            console.log('✅ Gemini client initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Gemini client:', error);
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
            const maxTokens = request.maxTokens || this.config.get('gemini.maxTokens', 4000);
            const temperature = request.temperature || this.config.get('gemini.temperature', 0.1);
            
            console.log(`🚀 Gemini request: model=${model}, maxTokens=${maxTokens}, temperature=${temperature}`);

            // Gemini APIの呼び出し
            const genModel = this.client.getGenerativeModel({ model: model });
            
            // メッセージを Gemini 形式に変換
            const prompt = request.messages.map(msg => 
                `${msg.role === 'system' ? 'System' : msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
            ).join('\n\n');

            const result = await genModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: maxTokens,
                    temperature: temperature
                }
            });

            const response = await result.response;
            const content = response.text() || '';

            console.log(`✅ Gemini response: ${content.length} chars`);

            return createLLMResponse(content, {
                usage: {
                    promptTokens: 0, // Gemini APIではトークン情報が詳細に提供されない場合がある
                    completionTokens: 0,
                    totalTokens: 0
                },
                model: model,
                finishReason: 'stop'
            });
        } catch (error) {
            console.error('❌ Gemini API error:', error);
            throw error;
        }
    }
}

export default GeminiLLMClient;
