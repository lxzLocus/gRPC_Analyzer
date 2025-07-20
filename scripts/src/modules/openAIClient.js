/**
 * OpenAI API クライアント
 * LLMとの通信を担当
 */
class OpenAIClient {
    constructor(apiKey) {
        // 環境変数から APIキーを取得（優先順位: 引数 > OPENAI_TOKEN > OPENAI_API_KEY）
        const finalApiKey = apiKey || process.env.OPENAI_TOKEN || process.env.OPENAI_API_KEY || '';
        console.log(`🔑 OpenAIClient: Using API key length: ${finalApiKey.length}`);
        console.log(`🔑 Available env vars: OPENAI_TOKEN=${!!process.env.OPENAI_TOKEN}, OPENAI_API_KEY=${!!process.env.OPENAI_API_KEY}`);
        // OpenAIクライアントの初期化を非同期で行う
        this.initPromise = this.initializeClient(finalApiKey);
    }
    async initializeClient(apiKey) {
        try {
            // 動的importを使用してES modules対応
            const { default: OpenAI } = await import('openai');
            this.client = new OpenAI({ apiKey });
        }
        catch (error) {
            console.error('Failed to initialize OpenAI client:', error);
            // フォールバック: モック用の最小実装
            this.client = {
                chat: {
                    completions: {
                        create: async () => ({
                            id: 'mock',
                            choices: [{ message: { content: 'Mock response' } }],
                            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
                        })
                    }
                }
            };
        }
    }
    async fetchOpenAPI(messages) {
        // クライアントが初期化されるまで待機
        await this.initPromise;
        try {
            const completion = await this.client.chat.completions.create({
                model: 'gpt-4o',
                messages: messages
            });
            return completion;
        }
        catch (error) {
            console.error(error.message);
            // エラー時はモックレスポンスを返す
            return {
                id: 'error-mock',
                choices: [{ message: { content: 'Error occurred, returning mock response' } }],
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
            };
        }
    }
    /**
     * モック用メソッド: レスポンスを直接設定
     */
    setMockResponse(response) {
        this.client = {
            chat: {
                completions: {
                    create: async () => response
                }
            }
        };
    }
}
export default OpenAIClient;
