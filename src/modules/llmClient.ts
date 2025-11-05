/**
 * LLM Client Interface
 * OpenAI、Gemini等の異なるLLMプロバイダーの統一インターフェース
 */

export interface LLMRequest {
    model?: string;
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
}

export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model?: string;
    finishReason?: string;
}

export interface LLMClient {
    /**
     * LLMにリクエストを送信
     */
    generateContent(request: LLMRequest): Promise<LLMResponse>;
    
    /**
     * クライアントの初期化完了を待機
     */
    waitForInitialization(): Promise<void>;
    
    /**
     * 使用可能かどうかをチェック
     */
    isReady(): boolean;
    
    /**
     * プロバイダー名を取得
     */
    getProviderName(): string;
}
