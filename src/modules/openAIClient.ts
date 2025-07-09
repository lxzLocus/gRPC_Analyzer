/**
 * OpenAI API クライアント
 * LLMとの通信を担当
 */

class OpenAIClient {
    client: any;
    private initPromise: Promise<void>;

    constructor(apiKey: string) {
        // OpenAIクライアントの初期化を非同期で行う
        this.initPromise = this.initializeClient(apiKey);
    }

    private async initializeClient(apiKey: string): Promise<void> {
        try {
            // 動的importを使用してES modules対応
            const { default: OpenAI } = await import('openai');
            this.client = new OpenAI({ apiKey });
        } catch (error) {
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

    async fetchOpenAPI(messages: Array<{ role: string, content: string }>): Promise<any> {
        // クライアントが初期化されるまで待機
        await this.initPromise;

        try {
            const completion = await this.client.chat.completions.create({
                model: 'gpt-4o',
                messages: messages
            });
            return completion;
        } catch (error) {
            console.error((error as any).message);
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
    setMockResponse(response: any): void {
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
