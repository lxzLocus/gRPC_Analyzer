/**
 * OpenAI LLM Client
 * OpenAI APIとの通信を担当
 */
export class OpenAILLMClient {
    constructor(config, apiKey) {
        this.isInitialized = false;
        this.config = config;
        // 環境変数から APIキーを取得
        const finalApiKey = apiKey || process.env.OPENAI_TOKEN || process.env.OPENAI_API_KEY || '';
        console.log(`🔑 OpenAILLMClient: Using API key length: ${finalApiKey.length}`);
        console.log(`🔑 Available env vars: OPENAI_TOKEN=${!!process.env.OPENAI_TOKEN}, OPENAI_API_KEY=${!!process.env.OPENAI_API_KEY}`);
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
        }
        catch (error) {
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
            const model = request.model || this.config.get('llm.model', 'gpt-4.1');
            const maxTokens = request.maxTokens || this.config.get('llm.maxTokens', 4000);
            const temperature = request.temperature || this.config.get('llm.temperature', 0.1);
            console.log(`🚀 OpenAI request: model=${model}, maxTokens=${maxTokens}, temperature=${temperature}`);
            const response = await this.client.chat.completions.create({
                model: model,
                messages: request.messages,
                max_tokens: maxTokens,
                temperature: temperature
            });
            const content = response.choices[0]?.message?.content || '';
            const usage = response.usage;
            console.log(`✅ OpenAI response: ${content.length} chars, usage: ${usage?.total_tokens || 0} tokens`);
            return {
                content,
                usage: usage ? {
                    promptTokens: usage.prompt_tokens,
                    completionTokens: usage.completion_tokens,
                    totalTokens: usage.total_tokens
                } : undefined,
                model: response.model,
                finishReason: response.choices[0]?.finish_reason || 'unknown'
            };
        }
        catch (error) {
            console.error('❌ OpenAI API error:', error);
            throw error;
        }
    }
}
export default OpenAILLMClient;
//# sourceMappingURL=openAILLMClient.js.map