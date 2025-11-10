/**
 * REST API LLM Client
 * 汎用REST API経由でLLMを呼び出すクライアント
 */

import axios, { AxiosInstance } from 'axios';
import Config from './config.js';
import { LLMClient, LLMRequest, LLMResponse } from './llmClient.js';

export interface RestApiConfig {
    baseUrl: string;
    endpoint?: string;
    model: string;
    timeout?: number;
    headers?: Record<string, string>;
    reasoningEffort?: 'low' | 'medium' | 'high';
}

export class RestApiLLMClient implements LLMClient {
    private config: Config;
    private apiConfig: RestApiConfig;
    private axiosInstance: AxiosInstance;
    private ready: boolean = false;

    constructor(config: Config) {
        this.config = config;
        
        // 設定から REST API の設定を取得
        this.apiConfig = {
            baseUrl: config.get('llm.restApi.baseUrl', 'localhost:1234'),
            endpoint: config.get('llm.restApi.endpoint', '/v1/chat/completions'),
            model: config.get('llm.restApi.model', 'openai/gpt-oss-120b'),
            timeout: config.get('llm.restApi.timeout', 120000),
            headers: config.get('llm.restApi.headers', {}),
            reasoningEffort: config.get('llm.restApi.reasoningEffort', 'low')
        };

        console.log(`🌐 Initializing REST API LLM Client`);
        console.log(`   Base URL: ${this.apiConfig.baseUrl}`);
        console.log(`   Endpoint: ${this.apiConfig.endpoint}`);
        console.log(`   Model: ${this.apiConfig.model}`);

        // Axios インスタンスの作成
        this.axiosInstance = axios.create({
            baseURL: this.apiConfig.baseUrl,
            timeout: this.apiConfig.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...this.apiConfig.headers
            }
        });

        this.ready = true;
    }

    async generateContent(request: LLMRequest): Promise<LLMResponse> {
        if (!this.ready) {
            throw new Error('REST API LLM Client is not ready');
        }

        try {
            const requestBody = {
                model: this.apiConfig.model,
                messages: request.messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                stream: false,
                reasoning: {
                    effort: this.apiConfig.reasoningEffort
                }
            };

            console.log(`🔄 Sending request to REST API: ${this.apiConfig.baseUrl}${this.apiConfig.endpoint}`);
            console.log(`   Model: ${this.apiConfig.model}`);
            console.log(`   Messages count: ${request.messages.length}`);

            const response = await this.axiosInstance.post(
                this.apiConfig.endpoint!,
                requestBody
            );

            // レスポンスの検証
            if (!response.data) {
                throw new Error('Empty response from REST API');
            }

            // OpenAI互換のレスポンス形式を想定
            const choice = response.data.choices?.[0];
            if (!choice) {
                throw new Error('Invalid response format: missing choices');
            }

            const content = choice.message?.content || choice.text || '';
            const usage = response.data.usage;

            console.log(`✅ REST API response received`);
            console.log(`   Content length: ${content.length} chars`);
            if (usage) {
                console.log(`   Tokens - Prompt: ${usage.prompt_tokens}, Completion: ${usage.completion_tokens}, Total: ${usage.total_tokens}`);
            }

            return {
                content,
                usage: usage ? {
                    promptTokens: usage.prompt_tokens || 0,
                    completionTokens: usage.completion_tokens || 0,
                    totalTokens: usage.total_tokens || 0
                } : undefined,
                model: response.data.model || this.apiConfig.model,
                finishReason: choice.finish_reason || 'stop'
            };

        } catch (error) {
            if (axios.isAxiosError(error)) {
                // 接続エラーの場合
                if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
                    console.error(`❌ REST API Connection Error:`);
                    console.error(`   Cannot connect to: ${this.apiConfig.baseUrl}`);
                    console.error(`   Error code: ${error.code}`);
                    console.error(`   Error message: ${error.message}`);
                    console.error(`\n💡 Troubleshooting:`);
                    console.error(`   1. Check if the REST API server is running at ${this.apiConfig.baseUrl}`);
                    console.error(`   2. Verify the baseUrl in config_restapi.json is correct`);
                    console.error(`   3. Ensure the server is accessible from this container/machine`);
                    console.error(`   4. Check firewall settings if using a remote server\n`);
                    
                    throw new Error(`Cannot connect to REST API server at ${this.apiConfig.baseUrl}. Error: ${error.code} - ${error.message}`);
                }
                
                // HTTPエラーレスポンスがある場合
                if (error.response) {
                    console.error(`❌ REST API HTTP Error:`, {
                        status: error.response.status,
                        statusText: error.response.statusText,
                        data: error.response.data,
                        url: `${this.apiConfig.baseUrl}${this.apiConfig.endpoint}`
                    });

                    const errorMessage = error.response.data?.error?.message 
                        || error.response.data?.message 
                        || `HTTP ${error.response.status}: ${error.response.statusText}`;

                    throw new Error(`REST API request failed: ${errorMessage}`);
                }
                
                // その他のAxiosエラー
                console.error(`❌ REST API Request Error:`, {
                    code: error.code,
                    message: error.message
                });

                throw new Error(`REST API request failed: ${error.message}`);
            }

            console.error('❌ Unexpected error in REST API client:', error);
            throw error;
        }
    }

    async waitForInitialization(): Promise<void> {
        // REST API クライアントは即座に利用可能
        return Promise.resolve();
    }

    isReady(): boolean {
        return this.ready;
    }

    getProviderName(): string {
        return 'restapi';
    }

    /**
     * ヘルスチェック（オプション）
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.axiosInstance.get('/health', {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            console.warn('⚠️  REST API health check failed:', error);
            return false;
        }
    }
}

export default RestApiLLMClient;
