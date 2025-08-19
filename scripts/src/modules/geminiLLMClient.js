/**
 * Gemini LLM Client with Rate Limit Handling
 * Google Gemini APIとの通信を担当（レートリミット対応）
 */
export class GeminiLLMClient {
    constructor(config, apiKey) {
        this.isInitialized = false;
        this.config = config;
        
        // LLM_PROVIDERがgeminiの場合のみレートリミット機能を有効化
        this.rateLimitEnabled = process.env.LLM_PROVIDER === 'gemini';
        
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
            
            // Geminiモデル別の制限値（公開されている制限に基づく推定値）
            this.modelLimits = {
                'gemini-2.5-pro': {
                    tpm: 1_000_000,      // 1M tokens per minute (推定)
                    rpm: 1000,           // 1K requests per minute (推定)
                    tpd: 50_000_000      // 50M tokens per day (推定)
                },
                'gemini-2.5-flash': {
                    tpm: 2_000_000,      // 2M tokens per minute (推定)
                    rpm: 2000,           // 2K requests per minute (推定)
                    tpd: 100_000_000     // 100M tokens per day (推定)
                },
                'gemini-2.5-flash-preview-05-20': {
                    tpm: 2_000_000,      // 2M tokens per minute (推定)
                    rpm: 2000,           // 2K requests per minute (推定)
                    tpd: 100_000_000     // 100M tokens per day (推定)
                },
                'models/gemini-2.5-flash': {
                    tpm: 2_000_000,      // 2M tokens per minute (推定)
                    rpm: 2000,           // 2K requests per minute (推定)
                    tpd: 100_000_000     // 100M tokens per day (推定)
                }
            };
            
            console.log('🛡️  Rate limiting enabled for Gemini provider');
        } else {
            console.log('⚡ Rate limiting disabled (LLM_PROVIDER is not gemini)');
        }
        
        // 環境変数から APIキーを取得
        const finalApiKey = apiKey || process.env.GEMINI_API_KEY || '';
        console.log(`🔑 GeminiLLMClient: Using API key length: ${finalApiKey.length}`);
        console.log(`🔑 Available env vars: GEMINI_API_KEY=${!!process.env.GEMINI_API_KEY}`);
        console.log(`🤖 GeminiLLMClient: Using model: ${this.config.get('gemini.model', 'gemini-2.5-pro')}`);
        console.log(`📋 LLM_PROVIDER: ${process.env.LLM_PROVIDER || 'undefined'}`);
        
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
            if (this.rateLimitEnabled) {
                console.log('🛡️  Rate limiting enabled for Gemini 2.5 Pro/Flash models');
            }
        }
        catch (error) {
            console.error('❌ Failed to initialize Gemini client:', error);
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
            console.log('🔄 Gemini rate limit counters reset (1 minute)');
        }
        
        // 1日ごとのリセット
        if (now - this.rateLimitState.lastDayResetTime >= 86400000) {
            this.rateLimitState.tokensPerDay = 0;
            this.rateLimitState.lastDayResetTime = now;
            console.log('🔄 Gemini daily rate limit counters reset');
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
        
        const limits = this.modelLimits[model] || this.modelLimits['gemini-2.5-pro'];
        
        // リクエスト数制限チェック
        if (this.rateLimitState.requestsPerMinute >= limits.rpm) {
            const waitTime = 60000 - (Date.now() - this.rateLimitState.lastResetTime);
            console.warn(`⚠️  Gemini request rate limit reached for ${model}. Waiting ${Math.ceil(waitTime/1000)}s`);
            return { shouldWait: true, waitTime: Math.max(waitTime, 1000) };
        }
        
        // トークン数制限チェック（分）
        if (this.rateLimitState.tokensPerMinute + estimatedTokens > limits.tpm) {
            const waitTime = 60000 - (Date.now() - this.rateLimitState.lastResetTime);
            console.warn(`⚠️  Gemini token rate limit (TPM) reached for ${model}. Waiting ${Math.ceil(waitTime/1000)}s`);
            return { shouldWait: true, waitTime: Math.max(waitTime, 1000) };
        }
        
        // トークン数制限チェック（日）
        if (this.rateLimitState.tokensPerDay + estimatedTokens > limits.tpd) {
            console.error(`❌ Gemini daily token limit (TPD) reached for ${model}. Cannot proceed.`);
            throw new Error(`Daily token limit exceeded for Gemini model ${model}`);
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
            return Math.min(1000 * (retryCount + 1), 5000);
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
    
    /**
     * トークン数を推定（Gemini用簡易計算）
     */
    estimateTokens(text) {
        // Geminiのトークン化は複雑なので、簡易推定（1トークン ≈ 3文字）
        return Math.ceil(text.length / 3);
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
        
        const model = request.model || this.config.get('gemini.model', 'gemini-2.5-pro');
        const temperature = request.temperature || this.config.get('gemini.temperature', 0.1);
        const maxTokens = request.maxTokens || this.config.get('gemini.maxTokens', 4000);
        
        console.log(`🚀 Gemini request: model=${model}, maxTokens=${maxTokens}, temperature=${temperature}, rateLimitEnabled=${this.rateLimitEnabled}`);
        
        // レートリミット有効時の高度な処理
        if (this.rateLimitEnabled) {
            return await this.generateContentWithRateLimit(request, model, maxTokens, temperature);
        }
        
        // レートリミット無効時の従来処理
        return await this.generateContentSimple(request, model, maxTokens, temperature);
    }
    
    /**
     * レートリミット対応の生成処理
     */
    async generateContentWithRateLimit(request, model, maxTokens, temperature) {
        // メッセージをGemini形式に変換
        const prompt = this.formatMessagesForGemini(request.messages);
        
        // トークン数を推定
        const estimatedInputTokens = this.estimateTokens(prompt);
        const estimatedTotalTokens = estimatedInputTokens + maxTokens;
        
        let retryCount = 0;
        const maxRetries = 3; // Geminiは比較的制限が緩いので少なめ
        
        while (retryCount <= maxRetries) {
            try {
                // レートリミットチェック
                const rateLimitCheck = this.checkRateLimit(model, estimatedTotalTokens);
                if (rateLimitCheck.shouldWait) {
                    console.log(`⏳ Waiting ${Math.ceil(rateLimitCheck.waitTime/1000)}s due to Gemini rate limit...`);
                    await this.delay(rateLimitCheck.waitTime);
                    continue; // レートリミット回避後に再試行
                }
                
                // API呼び出し実行
                const response = await this.client.models.generateContent({
                    model: model,
                    contents: prompt,
                    generationConfig: {
                        temperature: temperature,
                        maxOutputTokens: maxTokens
                    }
                });
                
                const content = response.text || '';
                
                // レートリミット使用量を更新（推定値）
                const actualTokens = this.estimateTokens(prompt + content);
                this.updateRateLimitUsage(actualTokens);
                
                // リトライ遅延をリセット（成功時）
                this.rateLimitState.retryDelay = 1000;
                
                console.log(`✅ Gemini response: ${content.length} chars, estimated tokens: ${actualTokens}`);
                console.log(`📊 Gemini rate limit usage: ${this.rateLimitState.requestsPerMinute} RPM, ${this.rateLimitState.tokensPerMinute} TPM, ${this.rateLimitState.tokensPerDay} TPD`);
                
                return {
                    content,
                    usage: {
                        promptTokens: estimatedInputTokens,
                        completionTokens: this.estimateTokens(content),
                        totalTokens: actualTokens
                    },
                    model: model,
                    finishReason: 'stop'
                };
                
            } catch (error) {
                retryCount++;
                
                // Gemini APIのレートリミットエラー処理
                if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('quota')) {
                    console.warn(`🚫 Gemini rate limit hit. Using exponential backoff: ${Math.ceil(this.calculateBackoffDelay(retryCount - 1)/1000)}s`);
                    
                    if (retryCount <= maxRetries) {
                        const waitTime = this.calculateBackoffDelay(retryCount - 1);
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
                
                // その他のエラー処理
                console.error(`❌ Gemini API error (attempt ${retryCount}/${maxRetries + 1}):`, error.message || error);
                
                if (retryCount > maxRetries) {
                    console.error(`❌ Max retries (${maxRetries}) exceeded for Gemini API`);
                    throw error;
                }
                
                // 一般的なエラーの場合は短い遅延後にリトライ
                if (retryCount <= maxRetries) {
                    const waitTime = Math.min(1000 * retryCount, 5000); // 1秒, 2秒, 3秒
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
            // メッセージをGemini形式に変換
            const prompt = this.formatMessagesForGemini(request.messages);
            
            const response = await this.client.models.generateContent({
                model: model,
                contents: prompt,
                generationConfig: {
                    temperature: temperature,
                    maxOutputTokens: maxTokens
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
            
        } catch (error) {
            console.error('❌ Gemini API error:', error.message || error);
            throw error;
        }
    }
}
export default GeminiLLMClient;
//# sourceMappingURL=geminiLLMClient.js.map