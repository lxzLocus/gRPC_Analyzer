/**
 * LLM Client Interface（JavaScript版）
 * OpenAI、Gemini等の異なるLLMプロバイダーの統一インターフェース
 */

/**
 * LLMリクエストオブジェクトを作成するヘルパー関数
 * @param {Array} messages - メッセージ配列
 * @param {object} options - オプション設定
 * @returns {object} LLMRequestオブジェクト
 */
export function createLLMRequest(messages, options = {}) {
    return {
        model: options.model || undefined,
        messages: messages.map(msg => ({
            role: msg.role, // 'system' | 'user' | 'assistant'
            content: msg.content
        })),
        maxTokens: options.maxTokens || undefined,
        temperature: options.temperature || undefined,
        timeout: options.timeout || undefined,
        responseFormat: options.responseFormat || undefined, // JSON mode support
        // Gemini思考制御パラメータ
        reasoningEffort: options.reasoningEffort || undefined,
        thinkingBudget: options.thinkingBudget || undefined,
        includeThoughts: options.includeThoughts || undefined
    };
}

/**
 * LLMレスポンスオブジェクトを作成するヘルパー関数
 * @param {string} content - レスポンス内容
 * @param {object} options - オプション設定
 * @returns {object} LLMResponseオブジェクト
 */
export function createLLMResponse(content, options = {}) {
    return {
        content,
        usage: options.usage ? {
            promptTokens: options.usage.promptTokens || 0,
            completionTokens: options.usage.completionTokens || 0,
            totalTokens: options.usage.totalTokens || 0
        } : undefined,
        model: options.model || undefined,
        finishReason: options.finishReason || undefined
    };
}

/**
 * LLMクライアントの基底クラス
 * すべてのLLMクライアントが実装すべきメソッドを定義
 */
export class LLMClient {
    constructor() {
        if (this.constructor === LLMClient) {
            throw new Error('LLMClient は抽象クラスです。直接インスタンス化できません。');
        }
    }

    /**
     * LLMにリクエストを送信
     * @param {object} request - LLMRequest
     * @returns {Promise<object>} LLMResponse
     */
    async generateContent(request) {
        throw new Error('generateContent method must be implemented');
    }
    
    /**
     * クライアントの初期化完了を待機
     * @returns {Promise<void>}
     */
    async waitForInitialization() {
        throw new Error('waitForInitialization method must be implemented');
    }
    
    /**
     * 使用可能かどうかをチェック
     * @returns {boolean}
     */
    isReady() {
        throw new Error('isReady method must be implemented');
    }
    
    /**
     * プロバイダー名を取得
     * @returns {string}
     */
    getProviderName() {
        throw new Error('getProviderName method must be implemented');
    }
}
