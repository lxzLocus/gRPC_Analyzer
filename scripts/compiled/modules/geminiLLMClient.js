/**
 * Gemini LLM Client
 * Google Gemini APIとの通信を担当
 */
export class GeminiLLMClient {
    constructor(config, apiKey) {
        this.isInitialized = false;
        this.config = config;
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
        }
        catch (error) {
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
    formatMessagesForGemini(messages) {
        // Geminiは単一のプロンプトを期待するため、メッセージを統合
        return messages.map(msg => {
            switch (msg.role) {
                case 'system':
                    return `System: ${msg.content}`;
                case 'user':
                    return `User: ${msg.content}`;
                case 'assistant':
                    return `Assistant: ${msg.content}`;
                default:
                    return msg.content;
            }
        }).join('\n\n');
    }
    async generateContent(request) {
        if (!this.isInitialized) {
            await this.waitForInitialization();
        }
        try {
            const model = request.model || this.config.get('gemini.model', 'gemini-2.5-pro');
            const temperature = request.temperature || this.config.get('gemini.temperature', 0.1);
            console.log(`🚀 Gemini request: model=${model}, temperature=${temperature}`);
            // メッセージをGemini形式に変換
            const prompt = this.formatMessagesForGemini(request.messages);
            const response = await this.client.models.generateContent({
                model: model,
                contents: prompt,
                generationConfig: {
                    temperature: temperature,
                    maxOutputTokens: request.maxTokens || this.config.get('gemini.maxTokens', 4000)
                }
            });
            const content = response.text || '';
            console.log(`✅ Gemini response: ${content.length} chars`);
            return {
                content,
                usage: {
                    promptTokens: 0, // Gemini APIはトークン数を提供しない場合がある
                    completionTokens: 0,
                    totalTokens: 0
                },
                model: model,
                finishReason: 'stop'
            };
        }
        catch (error) {
            console.error('❌ Gemini API error:', error);
            throw error;
        }
    }
}
export default GeminiLLMClient;
//# sourceMappingURL=geminiLLMClient.js.map