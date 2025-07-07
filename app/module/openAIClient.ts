/**
 * OpenAI API クライアント
 * LLMとの通信を担当
 */

class OpenAIClient {
    client: any;

    constructor(apiKey: string) {
        // OpenAIクライアントの初期化
        // ここではautoResponser.tsのimport OpenAI from 'openai';に依存
        // ただしllmFlowController.tsでOpenAIがimportされている必要あり
        this.client = new (require('openai'))({ apiKey });
    }

    async fetchOpenAPI(messages: Array<{ role: string, content: string }>): Promise<any> {
        try {
            const completion = await this.client.chat.completions.create({
                model: 'gpt-4o',
                messages: messages
            });
            return completion;
        } catch (error) {
            console.error((error as any).message);
        }
    }
}

export default OpenAIClient;
