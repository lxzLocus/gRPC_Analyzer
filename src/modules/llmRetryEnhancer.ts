/**
 * LLM応答品質チェック付きリトライ機能
 * modified: 0 lines などの不完全な応答を検出してリトライする
 */

export interface LLMRetryOptions {
    maxRetries: number;
    enableQualityCheck: boolean;
    requireModifiedContent: boolean;
    minModifiedLines: number;
    retryDelayMs: number;
    exponentialBackoff: boolean;
}

export interface LLMQualityMetrics {
    hasModifiedContent: boolean;
    modifiedLineCount: number;
    hasPlan: boolean;
    planLineCount: number;
    hasFinTag: boolean;
    hasFileRequests: boolean;
    completionScore: number; // 0-100
}

export class LLMRetryEnhancer {
    private defaultOptions: LLMRetryOptions = {
        maxRetries: 3,
        enableQualityCheck: true,
        requireModifiedContent: true,
        minModifiedLines: 1,
        retryDelayMs: 1000,
        exponentialBackoff: true
    };

    constructor(private options: Partial<LLMRetryOptions> = {}) {
        this.options = { ...this.defaultOptions, ...options };
    }

    /**
     * LLM応答の品質をチェック
     */
    public checkResponseQuality(llmParsed: any, usage?: any): LLMQualityMetrics {
        const metrics: LLMQualityMetrics = {
            hasModifiedContent: false,
            modifiedLineCount: 0,
            hasPlan: false,
            planLineCount: 0,
            hasFinTag: false,
            hasFileRequests: false,
            completionScore: 0
        };

        // トークン制限によるカットオフの検出
        if (usage && usage.completion_tokens) {
            const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '4000');
            if (usage.completion_tokens >= maxTokens * 0.98) {
                console.log(`⚠️  Token cutoff detected: ${usage.completion_tokens}/${maxTokens} tokens used`);
                metrics.completionScore = Math.max(0, metrics.completionScore - 50); // 大幅減点
            }
        }

        // Modified コンテンツのチェック
        if (llmParsed.modifiedDiff && llmParsed.modifiedDiff.trim().length > 0) {
            metrics.hasModifiedContent = true;
            metrics.modifiedLineCount = llmParsed.modifiedDiff.split('\n').length;
        }

        // Plan のチェック
        if (llmParsed.plan && llmParsed.plan.trim().length > 0) {
            metrics.hasPlan = true;
            metrics.planLineCount = llmParsed.plan.split('\n').length;
        }

        // %%_Fin_%% タグのチェック
        metrics.hasFinTag = llmParsed.has_fin_tag || false;

        // ファイルリクエストのチェック
        metrics.hasFileRequests = (llmParsed.requiredFileInfos && llmParsed.requiredFileInfos.length > 0) ||
                                  (llmParsed.requiredFilepaths && llmParsed.requiredFilepaths.length > 0);

        // 完成度スコアの計算
        let score = 0;
        if (metrics.hasFinTag) score += 25;
        if (metrics.hasPlan) score += 25;
        if (metrics.hasModifiedContent) score += 30;
        if (metrics.hasFileRequests) score += 20;

        metrics.completionScore = score;

        return metrics;
    }

    /**
     * 応答品質に基づいてリトライが必要かを判定
     */
    public shouldRetry(metrics: LLMQualityMetrics, attempt: number): boolean {
        if (!this.options.enableQualityCheck) {
            return false;
        }

        if (attempt >= (this.options.maxRetries || 3)) {
            return false;
        }

        // GPT-5対応：必須条件チェックを調整
        if (this.options.requireModifiedContent && !metrics.hasModifiedContent) {
            console.log(`🔄 Quality check failed: No modified content (attempt ${attempt + 1})`);
            return true;
        }

        if (metrics.modifiedLineCount < (this.options.minModifiedLines || 1)) {
            console.log(`🔄 Quality check failed: Insufficient modified lines (${metrics.modifiedLineCount} < ${this.options.minModifiedLines})`);
            return true;
        }

        // GPT-5では完成度スコアの基準を下げる（50% → 30%）
        if (metrics.completionScore < 30) {
            console.log(`🔄 Quality check failed: Low completion score (${metrics.completionScore}%)`);
            return true;
        }

        return false;
    }

    /**
     * リトライ用のプロンプト強化
     */
    public enhancePromptForRetry(originalPrompt: string, attempt: number, metrics: LLMQualityMetrics): string {
        let enhancement = originalPrompt;

        // リトライ回数に応じた強化
        const retryInstructions = [
            "\n\n=== RETRY INSTRUCTIONS ===",
            `This is retry attempt ${attempt + 1}. Previous response was incomplete.`,
            ""
        ];

        // 具体的な問題を指摘
        if (!metrics.hasModifiedContent) {
            retryInstructions.push(
                "❌ ISSUE: No modified content was provided in the previous response.",
                "✅ REQUIRED: You MUST provide actual code changes in the %_Modified_% section.",
                "✅ FORMAT: Use proper diff format with file paths and changes.",
                ""
            );
        }

        if (metrics.modifiedLineCount < (this.options.minModifiedLines || 1)) {
            retryInstructions.push(
                `❌ ISSUE: Previous response had only ${metrics.modifiedLineCount} modified lines.`,
                `✅ REQUIRED: Provide at least ${this.options.minModifiedLines} lines of meaningful changes.`,
                ""
            );
        }

        // 強化された指示（GPT-5対応）
        retryInstructions.push(
            "📋 MANDATORY REQUIREMENTS for GPT-5:",
            "1. Analyze the provided files and changes thoroughly",
            "2. Create a detailed plan in %_Plan_% section",
            "3. Provide actual code modifications in %_Modified_% section",
            "4. End with %%_Fin_%% tag only after providing complete solution",
            "5. Do not skip the implementation - provide working code",
            "6. IMPORTANT: Ensure response fits within token limit - prioritize implementation over explanation",
            "7. If you need to truncate, keep the %_Modified_% and %%_Fin_%% sections",
            "",
            "💡 GPT-5 SPECIFIC HINTS:",
            "- Use concise language while maintaining accuracy",
            "- Focus on the actual code changes needed",
            "- Always end with the completion marker: %%_Fin_%%",
            "- If response is long, prioritize: Analysis → Plan → Implementation → Completion marker",
            "=========================="
        );

        enhancement += retryInstructions.join('\n');

        return enhancement;
    }

    /**
     * リトライ待機時間の計算
     */
    public calculateRetryDelay(attempt: number): number {
        const baseDelay = this.options.retryDelayMs || 1000;
        
        if (this.options.exponentialBackoff) {
            return baseDelay * Math.pow(2, attempt);
        } else {
            return baseDelay;
        }
    }

    /**
     * 品質メトリクスのログ出力
     */
    public logQualityMetrics(metrics: LLMQualityMetrics): void {
        console.log('📊 LLM Response Quality Metrics:');
        console.log(`   Modified Content: ${metrics.hasModifiedContent ? '✅' : '❌'} (${metrics.modifiedLineCount} lines)`);
        console.log(`   Plan Content: ${metrics.hasPlan ? '✅' : '❌'} (${metrics.planLineCount} lines)`);
        console.log(`   Completion Tag: ${metrics.hasFinTag ? '✅' : '❌'}`);
        console.log(`   File Requests: ${metrics.hasFileRequests ? '✅' : '❌'}`);
        console.log(`   Overall Score: ${metrics.completionScore}%`);
    }
}

export default LLMRetryEnhancer;
