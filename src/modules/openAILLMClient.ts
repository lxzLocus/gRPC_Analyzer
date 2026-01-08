/**
 * OpenAI LLM Client
 * OpenAI APIとの通信を担当
 */

import Config from './Config.js';
import { LLMClient, LLMRequest, LLMResponse } from './llmClient.js';

export class OpenAILLMClient implements LLMClient {
    private client: any;
    private initPromise: Promise<void>;
    private config: Config;
    private isInitialized: boolean = false;
    private httpAgent: any = null;
    private restHttpAgent: any = null;
    private agentRecycleInterval: NodeJS.Timeout | null = null;
    private readonly AGENT_LIFETIME_MS = 30 * 60 * 1000; // 30分

    constructor(config: Config, apiKey?: string) {
        this.config = config;
        
        // 環境変数から APIキーを取得
        const finalApiKey = apiKey || process.env.OPENAI_API_KEY || '';
        
        console.log(`🔑 OpenAILLMClient: Using API key length: ${finalApiKey.length}`);
        console.log(`🔑 Available env vars: OPENAI_API_KEY=${!!process.env.OPENAI_API_KEY}`);
        console.log(`🤖 OpenAILLMClient: Using model: ${this.config.get('llm.model', this.config.get('openai.model', 'gpt-4o'))}`);
        
        // OpenAIクライアントの初期化を非同期で行う
        this.initPromise = this.initializeClient(finalApiKey);
        
        // HTTP Agent 自動リサイクルタイマーを開始
        this.startAgentRecycling();
    }

    /**
     * HTTP Agent自動リサイクル機能
     * 30分ごとにAgentを破棄して新規作成することで、ソケット枯渇とNATタイムアウトを回避
     */
    private startAgentRecycling(): void {
        // 初回Agent作成
        this.recycleAgents();
        
        // 30分ごとに自動リサイクル
        this.agentRecycleInterval = setInterval(() => {
            console.log('🔄 [Agent Recycle] 30分経過: HTTP Agentを再作成します');
            this.recycleAgents();
        }, this.AGENT_LIFETIME_MS);
        
        console.log(`♻️  HTTP Agent auto-recycle enabled (interval: 30 minutes)`);
    }

    /**
     * HTTP Agentの破棄と再作成
     */
    private async recycleAgents(): Promise<void> {
        try {
            const https = await import('https');
            
            // 既存のAgentがあれば破棄
            if (this.httpAgent) {
                this.httpAgent.destroy();
                console.log('🗑️  Old OpenAI SDK Agent destroyed');
            }
            if (this.restHttpAgent) {
                this.restHttpAgent.destroy();
                console.log('🗑️  Old REST API Agent destroyed');
            }
            
            // 新規Agentを作成
            this.httpAgent = new https.default.Agent({
                keepAlive: true,        // 30分以内は再利用
                keepAliveMsecs: 1000,   // keep-aliveソケットの初期遅延
                maxSockets: 10,         // 並列接続数上限
                maxFreeSockets: 5,      // プールに保持するソケット数
                timeout: 60000,         // ソケットタイムアウト
            });
            
            this.restHttpAgent = new https.default.Agent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 10,
                maxFreeSockets: 5,
                timeout: 60000,
            });
            
            console.log('✨ New HTTP Agents created (lifetime: 30 minutes)');
            
        } catch (error) {
            console.error('❌ Failed to recycle HTTP Agents:', error);
        }
    }

    private async initializeClient(apiKey: string): Promise<void> {
        try {
            // 動的importを使用してES modules対応
            const { default: OpenAI } = await import('openai');
            
            // タイムアウト設定を統一：openai.timeout -> llm.timeout の順で取得
            const timeoutMs = this.config.get('openai.timeout', this.config.get('llm.timeout', 120000));
            console.log(`🕒 OpenAI client timeout set to: ${timeoutMs}ms`);
            
            // Agentが未作成の場合は作成
            if (!this.httpAgent) {
                await this.recycleAgents();
            }
            
            this.client = new OpenAI({
                apiKey: apiKey,
                timeout: timeoutMs,
                // ソケット接続の安定性向上設定
                maxRetries: 0,  // ライブラリ側のリトライは無効化（アプリ側で制御）
                httpAgent: this.httpAgent,  // 30分ごとに再作成されるAgent
            });
            
            this.isInitialized = true;
            console.log('✅ OpenAI client initialized successfully with managed HTTP Agent');
        } catch (error) {
            console.error('❌ Failed to initialize OpenAI client:', error);
            throw error;
        }
    }

    async waitForInitialization(): Promise<void> {
        return this.initPromise;
    }

    isReady(): boolean {
        return this.isInitialized;
    }

    getProviderName(): string {
        return 'OpenAI';
    }

    async generateContent(request: LLMRequest): Promise<LLMResponse> {
        if (!this.isInitialized) {
            await this.waitForInitialization();
        }

        // REST APIフォールバックが指定されている場合
        if (process.env.USE_OPENAI_REST_FALLBACK === 'true') {
            console.log('🔄 Using OpenAI REST API fallback (direct HTTP request)...');
            return this.generateContentViaRestApi(request);
        }

        // モデル名を事前に取得（エラーハンドリングでも使用）
        const model = request.model || this.config.get('llm.model', this.config.get('openai.model', 'gpt-4o'));
        const maxTokens = request.maxTokens || this.config.get('llm.maxTokens', 4000);
        
        try {
            console.log(`🚀 OpenAI request: model=${model}, maxTokens=${maxTokens}`);

            // APIリクエストパラメータを準備
            const apiParams: any = {
                model: model,
                messages: request.messages
            };
            
            // gpt-5系モデル以外の場合のみmax_completion_tokensを設定
            const isGpt5Series = model.startsWith('gpt-5');
            if (!isGpt5Series && maxTokens) {
                apiParams.max_completion_tokens = maxTokens;
                console.log(`🔢 OpenAI max_completion_tokens: ${maxTokens}`);
            } else if (isGpt5Series) {
                console.log(`ℹ️  ${model}: max_completion_tokensパラメータはスキップされます`);
            }

            // gpt-5系モデル以外の場合のみtemperatureを設定
            if (!isGpt5Series && request.temperature !== undefined) {
                apiParams.temperature = request.temperature;
                console.log(`🌡️  OpenAI temperature: ${request.temperature}`);
            } else if (isGpt5Series) {
                console.log(`ℹ️  ${model}: temperatureパラメータはスキップされます`);
            }

            // タイムアウト付きのAPI呼び出し
            // クライアント初期化時と同じタイムアウト値を使用
            const apiTimeout = this.config.get('openai.timeout', this.config.get('llm.timeout', 120000));
            console.log(`🕒 OpenAI API call timeout: ${apiTimeout}ms`);
            
            // ソケット接続エラー対策：リクエスト前に短い遅延を入れる
            // 連続リクエストによるソケット枯渇を防ぐ
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const apiCall = this.client.chat.completions.create(apiParams);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`OpenAI API timeout after ${apiTimeout}ms`)), apiTimeout)
            );

            const response = await Promise.race([apiCall, timeoutPromise]);

            const content = response.choices[0]?.message?.content || '';
            const usage = response.usage;

            console.log(`✅ OpenAI response: ${content.length} chars, usage: ${usage?.total_tokens || 0} tokens`);

            return {
                content: content,
                usage: {
                    promptTokens: usage?.prompt_tokens || 0,
                    completionTokens: usage?.completion_tokens || 0,
                    totalTokens: usage?.total_tokens || 0
                }
            };
        } catch (error: any) {
            // OpenAI専用エラークラスによる詳細ハンドリング
            const errorName = error?.constructor?.name || error?.name || 'UnknownError';
            
            console.error('❌ OpenAI API error:', {
                type: errorName,
                message: error.message,
                status: error.status,
                code: error.code,
                type_detail: error.type
            });
            
            // 1. APIConnectionError - 接続エラー
            if (errorName === 'APIConnectionError' || 
                error.code === 'ECONNREFUSED' || 
                error.code === 'ENOTFOUND' || 
                error.code === 'ETIMEDOUT') {
                
                console.error('\n🔥 API CONNECTION ERROR 🔥');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('Cannot connect to OpenAI API server.');
                console.error('\n📋 Error Details:');
                console.error(`  Message: ${error.message}`);
                console.error(`  Code: ${error.code || 'N/A'}`);
                console.error('\n🔍 Possible Causes:');
                console.error('  1. 🌐 No internet connection');
                console.error('  2. 🔒 Firewall/proxy blocking api.openai.com');
                console.error('  3. 🐳 Docker network misconfiguration');
                console.error('  4. 🚫 OpenAI service temporarily unavailable');
                console.error('\n💡 Solutions:');
                console.error('  • Test connection: curl -I https://api.openai.com/v1/models');
                console.error('  • Run diagnostics: sh /app/scripts/diagnose_connection.sh');
                console.error('  • Switch to Gemini: Set GEMINI_API_KEY, provider=gemini');
                console.error('  • Use local LLM: sh /app/scripts/switch_to_local_llm.sh');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                
                throw new Error(`API Connection Error: ${error.message}. Check network settings.`);
            }
            
            // 2. UnauthorizedError (401) - 認証エラー
            if (errorName === 'UnauthorizedError' || error.status === 401) {
                console.error('\n🔑 AUTHENTICATION ERROR 🔑');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('OpenAI API authentication failed.');
                console.error('\n🔍 Possible Causes:');
                console.error('  1. ❌ Invalid or expired API key');
                console.error('  2. ❌ API key not set in environment variables');
                console.error('  3. ❌ Wrong API key format');
                console.error('\n💡 Solutions:');
                console.error('  • Check OPENAI_API_KEY in .env file');
                console.error('  • Verify key at: https://platform.openai.com/api-keys');
                console.error('  • Regenerate API key if expired');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                
                throw new Error(`Authentication failed: Invalid or missing API key.`);
            }
            
            // 3. RateLimitError (429) - レート制限
            if (errorName === 'RateLimitError' || error.status === 429) {
                console.error('\n⏱️  RATE LIMIT EXCEEDED ⏱️');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('OpenAI API rate limit exceeded.');
                console.error('\n💡 This is automatically retried by the system.');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                
                throw new Error(`Rate limit exceeded. Retrying with backoff...`);
            }
            
            // 4. APITimeoutError (408) - タイムアウト
            if (errorName === 'APITimeoutError' || error.status === 408 || error.code === 'ETIMEDOUT') {
                console.error('\n⏰ API TIMEOUT ⏰');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('OpenAI API request timed out.');
                console.error(`  Timeout setting: ${this.config.get('llm.timeout', 120000)}ms`);
                console.error('\n💡 This is automatically retried by the system.');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                
                throw new Error(`API timeout. Retrying...`);
            }
            
            // 5. BadRequestError (400) - トークン超過、コンテンツフィルター
            if (errorName === 'BadRequestError' || error.status === 400) {
                console.error('\n⚠️  BAD REQUEST ⚠️');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('Invalid request to OpenAI API.');
                console.error(`  Message: ${error.message}`);
                
                // トークン超過の可能性をチェック
                if (error.message?.includes('token') || error.message?.includes('context_length')) {
                    console.error('\n🔍 Likely Cause: Token limit exceeded');
                    console.error('💡 The system will automatically summarize and retry.');
                } else if (error.message?.includes('content_filter')) {
                    console.error('\n🔍 Likely Cause: Content filtered by safety system');
                    console.error('💡 Request contains inappropriate content.');
                }
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                
                throw new Error(`Bad request: ${error.message}`);
            }
            
            // 6. NotFoundError (404) - モデル見つからず
            if (errorName === 'NotFoundError' || error.status === 404) {
                console.error('\n🔍 MODEL NOT FOUND 🔍');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('The specified model was not found.');
                console.error(`  Model: ${model}`);
                console.error('\n💡 Solutions:');
                console.error('  • Check model name in config_openai.json');
                console.error('  • Verify model availability in your OpenAI account');
                console.error('  • Use standard model: gpt-4o, gpt-4-turbo, gpt-3.5-turbo');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                
                throw new Error(`Model not found: ${model}`);
            }
            
            // 7. InternalServerError (500) - サーバーエラー
            if (errorName === 'InternalServerError' || error.status === 500) {
                console.error('\n🔥 OPENAI SERVER ERROR 🔥');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('OpenAI service is experiencing issues.');
                console.error('\n💡 This is automatically retried by the system.');
                console.error('  Check status: https://status.openai.com/');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                
                throw new Error(`OpenAI server error. Retrying...`);
            }
            
            // 8. その他のエラー
            console.error('\n❌ UNEXPECTED ERROR ❌');
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error(`  Type: ${errorName}`);
            console.error(`  Message: ${error.message}`);
            console.error(`  Status: ${error.status || 'N/A'}`);
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            throw error;
        }
    }

    /**
     * REST API直接呼び出しによるフォールバック実装
     */
    private async generateContentViaRestApi(request: LLMRequest): Promise<LLMResponse> {
        try {
            const axios = await import('axios');
            const axiosInstance = axios.default;
            
            const model = request.model || this.config.get('llm.model', this.config.get('openai.model', 'gpt-4o'));
            const maxTokens = request.maxTokens || this.config.get('llm.maxTokens', 4000);
            const apiKey = process.env.OPENAI_API_KEY || '';
            
            if (!apiKey) {
                throw new Error('OPENAI_API_KEY is not set');
            }
            
            console.log(`🌐 REST API request: model=${model}, maxTokens=${maxTokens}`);
            
            // リクエストボディの構築
            const requestBody: any = {
                model: model,
                messages: request.messages
            };
            
            // gpt-5系モデル以外の場合のみmax_tokensを設定
            const isGpt5Series = model.startsWith('gpt-5');
            if (!isGpt5Series && maxTokens) {
                requestBody.max_completion_tokens = maxTokens;
            }
            
            // gpt-5系モデル以外の場合のみtemperatureを設定
            if (!isGpt5Series && request.temperature !== undefined) {
                requestBody.temperature = request.temperature;
            }
            
            const timeout = this.config.get('llm.timeout', 120000);
            
            // ソケット接続エラー対策：リクエスト前に短い遅延を入れる
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // OpenAI APIへのHTTPリクエスト（接続設定を改善）
            const response = await axiosInstance.post(
                'https://api.openai.com/v1/chat/completions',
                requestBody,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    timeout: timeout,
                    // 30分ごとに再作成されるAgentを使用
                    httpsAgent: this.restHttpAgent,
                    maxRedirects: 5,
                    validateStatus: (status) => status >= 200 && status < 300
                }
            );
            
            if (!response.data || !response.data.choices || response.data.choices.length === 0) {
                throw new Error('Invalid response from OpenAI API');
            }
            
            const content = response.data.choices[0].message?.content || '';
            const usage = response.data.usage;
            
            console.log(`✅ REST API response: ${content.length} chars, usage: ${usage?.total_tokens || 0} tokens`);
            
            return {
                content: content,
                usage: {
                    promptTokens: usage?.prompt_tokens || 0,
                    completionTokens: usage?.completion_tokens || 0,
                    totalTokens: usage?.total_tokens || 0
                }
            };
            
        } catch (error: any) {
            console.error('❌ REST API fallback error:', error.message);
            
            // Axiosエラーの詳細処理
            if (error.response) {
                const status = error.response.status;
                const errorData = error.response.data?.error;
                
                console.error(`❌ HTTP ${status}: ${errorData?.message || error.message}`);
                
                // エラーメッセージを統一形式で返す
                throw new Error(`REST API Error (${status}): ${errorData?.message || error.message}`);
            }
            
            throw error;
        }
    }

    /**
     * クリーンアップ処理（デストラクタ代替）
     */
    public destroy(): void {
        // タイマーを停止
        if (this.agentRecycleInterval) {
            clearInterval(this.agentRecycleInterval);
            this.agentRecycleInterval = null;
            console.log('⏹️  Agent recycle timer stopped');
        }
        
        // HTTP Agentを破棄
        if (this.httpAgent) {
            this.httpAgent.destroy();
            this.httpAgent = null;
            console.log('🗑️  OpenAI SDK Agent destroyed (final cleanup)');
        }
        if (this.restHttpAgent) {
            this.restHttpAgent.destroy();
            this.restHttpAgent = null;
            console.log('🗑️  REST API Agent destroyed (final cleanup)');
        }
    }
}

export default OpenAILLMClient;
