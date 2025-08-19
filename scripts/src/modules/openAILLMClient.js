/**
 * OpenAI LLM Client with Rate Limit Handling
 * OpenAI APIとの通信を担当（レートリミット対応）
 */
export class OpenAILLMClient {
    constructor(config, apiKey) {
        this.isInitialized = false;
        this.config = config;
        
        // LLM_PROVIDERがopenaiの場合のみレートリミット機能を有効化
        this.rateLimitEnabled = process.env.LLM_PROVIDER === 'openai';
        
        if (this.rateLimitEnabled) {
            // レートリミット管理
            this.rateLimitState = {
                tokensPerMinute: 0,
                requestsPerMinute: 0,
                tokensPerDay: 0,
                lastResetTime: Date.now(),
                lastDayResetTime: Date.now(),
                retryDelay: 1000, // 初期リトライ遅延: 1秒
                maxRetryDelay: 60000 // 最大リトライ遅延: 60秒
            };
            
            // モデル別の制限値
            this.modelLimits = {
                'gpt-5': {
                    tpm: 40_000_000,     // 40M tokens per minute (Tier 5)
                    rpm: 15_000,         // 15K requests per minute (Tier 5)
                    tpd: 15_000_000_000  // 15B tokens per day (Batch queue limit)
                },
                'gpt-4.1': {
                    tpm: 30_000_000,     // 30M tokens per minute
                    rpm: 10_000,         // 10K requests per minute
                    tpd: 15_000_000_000  // 15B tokens per day
                },
                'gpt-4o': {
                    tpm: 30_000_000,     // 30M tokens per minute
                    rpm: 10_000,         // 10K requests per minute
                    tpd: 15_000_000_000  // 15B tokens per day
                },
                'gpt-4.1-mini': {
                    tpm: 150_000_000,    // 150M tokens per minute
                    rpm: 30_000,         // 30K requests per minute
                    tpd: 15_000_000_000  // 15B tokens per day
                },
                'gpt-4.1-nano': {
                    tpm: 150_000_000,    // 150M tokens per minute
                    rpm: 30_000,         // 30K requests per minute
                    tpd: 15_000_000_000  // 15B tokens per day
                }
            };
            
            console.log('🛡️  Rate limiting enabled for OpenAI provider');
        } else {
            console.log('⚡ Rate limiting disabled (LLM_PROVIDER is not openai)');
        }
        
        // 環境変数から APIキーを取得
        const finalApiKey = apiKey || process.env.OPENAI_TOKEN || process.env.OPENAI_API_KEY || '';
        console.log(`🔑 OpenAILLMClient: Using API key length: ${finalApiKey.length}`);
        console.log(`🔑 Available env vars: OPENAI_TOKEN=${!!process.env.OPENAI_TOKEN}, OPENAI_API_KEY=${!!process.env.OPENAI_API_KEY}`);
        console.log(`🤖 OpenAILLMClient: Using model: ${this.config.get('llm.model', 'gpt-4.1')}`);
        console.log(`📋 LLM_PROVIDER: ${process.env.LLM_PROVIDER || 'undefined'}`);
        
        // OpenAIクライアントの初期化を非同期で行う
        this.initPromise = this.initializeClient(finalApiKey);
    }
    async initializeClient(apiKey) {
        try {
            // 動的importを使用してES modules対応
            const { default: OpenAI } = await import('openai');
            this.client = new OpenAI({
                apiKey: apiKey,
                timeout: this.config.get('llm.timeout', 120000), // 2分に延長
                maxRetries: this.rateLimitEnabled ? 0 : 3  // レートリミット有効時は自前のリトライ、無効時はOpenAI標準リトライ
            });
            this.isInitialized = true;
            console.log('✅ OpenAI client initialized successfully');
            if (this.rateLimitEnabled) {
                console.log('🛡️  Rate limiting enabled for gpt-4.1 and gpt-4o models');
            }
        }
        catch (error) {
            console.error('❌ Failed to initialize OpenAI client:', error);
            throw error;
        }
    }
    
    /**
     * レートリミット状態をリセット
     */
    resetRateLimitCounters() {
        if (!this.rateLimitEnabled) return;
        
        const now = Date.now();
        
        // 1分ごとのリセット
        if (now - this.rateLimitState.lastResetTime >= 60000) {
            this.rateLimitState.tokensPerMinute = 0;
            this.rateLimitState.requestsPerMinute = 0;
            this.rateLimitState.lastResetTime = now;
            console.log('🔄 Rate limit counters reset (1 minute)');
        }
        
        // 1日ごとのリセット
        if (now - this.rateLimitState.lastDayResetTime >= 86400000) {
            this.rateLimitState.tokensPerDay = 0;
            this.rateLimitState.lastDayResetTime = now;
            console.log('🔄 Daily rate limit counters reset');
        }
    }
    
    /**
     * レートリミットをチェック
     */
    checkRateLimit(model, estimatedTokens) {
        if (!this.rateLimitEnabled) {
            return { shouldWait: false, waitTime: 0 };
        }
        
        this.resetRateLimitCounters();
        
        const limits = this.modelLimits[model] || this.modelLimits['gpt-4.1'];
        
        // リクエスト数制限チェック
        if (this.rateLimitState.requestsPerMinute >= limits.rpm) {
            const waitTime = 60000 - (Date.now() - this.rateLimitState.lastResetTime);
            console.warn(`⚠️  Request rate limit reached for ${model}. Waiting ${Math.ceil(waitTime/1000)}s`);
            return { shouldWait: true, waitTime: Math.max(waitTime, 1000) };
        }
        
        // トークン数制限チェック（分）
        if (this.rateLimitState.tokensPerMinute + estimatedTokens > limits.tpm) {
            const waitTime = 60000 - (Date.now() - this.rateLimitState.lastResetTime);
            console.warn(`⚠️  Token rate limit (TPM) reached for ${model}. Waiting ${Math.ceil(waitTime/1000)}s`);
            return { shouldWait: true, waitTime: Math.max(waitTime, 1000) };
        }
        
        // トークン数制限チェック（日）
        if (this.rateLimitState.tokensPerDay + estimatedTokens > limits.tpd) {
            console.error(`❌ Daily token limit (TPD) reached for ${model}. Cannot proceed.`);
            throw new Error(`Daily token limit exceeded for model ${model}`);
        }
        
        return { shouldWait: false, waitTime: 0 };
    }
    
    /**
     * レートリミット使用量を更新
     */
    updateRateLimitUsage(tokens) {
        if (!this.rateLimitEnabled) return;
        
        this.rateLimitState.tokensPerMinute += tokens;
        this.rateLimitState.tokensPerDay += tokens;
        this.rateLimitState.requestsPerMinute += 1;
    }
    
    /**
     * 指数バックオフによる遅延計算
     */
    calculateBackoffDelay(retryCount) {
        if (!this.rateLimitEnabled) {
            // レートリミット無効時は単純な線形遅延
            return Math.min(2000 * (retryCount + 1), 10000);
        }
        
        const baseDelay = this.rateLimitState.retryDelay;
        const backoffDelay = Math.min(
            baseDelay * Math.pow(2, retryCount),
            this.rateLimitState.maxRetryDelay
        );
        
        // ジッターを追加（25%のランダム変動）
        const jitter = backoffDelay * 0.25 * Math.random();
        return Math.floor(backoffDelay + jitter);
    }
    
    /**
     * 遅延実行
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
        
        const model = request.model || this.config.get('llm.model', 'gpt-4.1');
        const maxTokens = request.maxTokens || this.config.get('llm.maxTokens', 4000);
        const temperature = request.temperature || this.config.get('llm.temperature', 0.1);
        
        console.log(`🚀 OpenAI request: model=${model}, maxTokens=${maxTokens}, temperature=${temperature}, rateLimitEnabled=${this.rateLimitEnabled}`);
        
        // レートリミット有効時の高度な処理
        if (this.rateLimitEnabled) {
            return await this.generateContentWithRateLimit(request, model, maxTokens, temperature);
        }
        
        // レートリミット無効時の従来処理（シンプルなリトライのみ）
        return await this.generateContentSimple(request, model, maxTokens, temperature);
    }
    
    /**
     * レートリミット対応の生成処理
     */
    async generateContentWithRateLimit(request, model, maxTokens, temperature) {
        // トークン数を推定（簡易計算: 1トークン ≈ 4文字）
        const messageText = request.messages.map(m => m.content).join(' ');
        const estimatedInputTokens = Math.ceil(messageText.length / 4);
        const estimatedTotalTokens = estimatedInputTokens + maxTokens;
        
        let retryCount = 0;
        const maxRetries = 5;
        
        while (retryCount <= maxRetries) {
            try {
                // レートリミットチェック
                const rateLimitCheck = this.checkRateLimit(model, estimatedTotalTokens);
                if (rateLimitCheck.shouldWait) {
                    console.log(`⏳ Waiting ${Math.ceil(rateLimitCheck.waitTime/1000)}s due to rate limit...`);
                    await this.delay(rateLimitCheck.waitTime);
                    continue; // レートリミット回避後に再試行
                }
                
                // API呼び出し実行
                const response = await this.client.chat.completions.create({
                    model: model,
                    messages: request.messages,
                    max_tokens: maxTokens,
                    temperature: temperature
                });
                
                const content = response.choices[0]?.message?.content || '';
                const usage = response.usage;
                
                // レートリミット使用量を更新
                if (usage) {
                    this.updateRateLimitUsage(usage.total_tokens);
                }
                
                // リトライ遅延をリセット（成功時）
                this.rateLimitState.retryDelay = 1000;
                
                console.log(`✅ OpenAI response: ${content.length} chars, usage: ${usage?.total_tokens || 0} tokens`);
                console.log(`📊 Rate limit usage: ${this.rateLimitState.requestsPerMinute} RPM, ${this.rateLimitState.tokensPerMinute} TPM, ${this.rateLimitState.tokensPerDay} TPD`);
                
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
                
            } catch (error) {
                retryCount++;
                
                // レートリミットエラーの処理
                if (error.status === 429) {
                    const retryAfter = error.headers?.['retry-after'];
                    let waitTime;
                    
                    if (retryAfter) {
                        waitTime = parseInt(retryAfter) * 1000; // 秒をミリ秒に変換
                        console.warn(`🚫 Rate limit hit (429). Retry-After: ${retryAfter}s`);
                    } else {
                        waitTime = this.calculateBackoffDelay(retryCount - 1);
                        console.warn(`🚫 Rate limit hit (429). Using exponential backoff: ${Math.ceil(waitTime/1000)}s`);
                    }
                    
                    if (retryCount <= maxRetries) {
                        console.log(`⏳ Waiting ${Math.ceil(waitTime/1000)}s before retry ${retryCount}/${maxRetries}...`);
                        await this.delay(waitTime);
                        
                        // リトライ遅延を増加
                        this.rateLimitState.retryDelay = Math.min(
                            this.rateLimitState.retryDelay * 1.5,
                            this.rateLimitState.maxRetryDelay
                        );
                        continue;
                    }
                }
                
                // タイムアウトエラーの処理
                if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                    console.error(`⏰ Request timeout for model ${model} (attempt ${retryCount}/${maxRetries})`);
                    
                    if (retryCount <= maxRetries) {
                        const waitTime = this.calculateBackoffDelay(retryCount - 1);
                        console.log(`⏳ Retrying after ${Math.ceil(waitTime/1000)}s...`);
                        await this.delay(waitTime);
                        continue;
                    }
                }
                
                // その他のエラーまたは最大リトライ回数に達した場合
                console.error(`❌ OpenAI API error (attempt ${retryCount}/${maxRetries + 1}):`, error.message || error);
                
                if (retryCount > maxRetries) {
                    console.error(`❌ Max retries (${maxRetries}) exceeded for OpenAI API`);
                    throw error;
                }
                
                // 一般的なエラーの場合は短い遅延後にリトライ
                if (retryCount <= maxRetries) {
                    const waitTime = Math.min(2000 * retryCount, 10000); // 2秒, 4秒, 6秒, 8秒, 10秒
                    console.log(`⏳ Retrying after ${waitTime/1000}s...`);
                    await this.delay(waitTime);
                }
            }
        }
    }
    
    /**
     * シンプルな生成処理（レートリミット無効時）
     */
    async generateContentSimple(request, model, maxTokens, temperature) {
        try {
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
            
        } catch (error) {
            console.error('❌ OpenAI API error:', error.message || error);
            throw error;
        }
    }
}
export default OpenAILLMClient;
//# sourceMappingURL=openAILLMClient.js.map