/**
 * LLMコスト計算ユーティリティ
 * トークン使用量から推定コストを計算
 * ログファイルには記録せず、コンソール出力のみ
 */

import * as fs from 'fs';
import * as path from 'path';

interface ModelPricing {
    name: string;
    description: string;
    input_per_1m: number;      // 入力トークン 100万あたりの価格
    output_per_1m: number;     // 出力トークン 100万あたりの価格
    cached_input_per_1m: number; // キャッシュ済み入力トークン 100万あたりの価格
    currency: string;
}

interface ProviderPricing {
    [modelName: string]: ModelPricing | any;
}

interface PricingConfig {
    [provider: string]: ProviderPricing;
}

interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    summaryTokens?: number;
}

interface CostBreakdown {
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    summaryTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    summaryCost: number;
    totalCost: number;
    currency: string;
    formattedCost: string;
}

export class CostCalculator {
    private pricing: PricingConfig;
    private provider: string;
    private model: string;
    private summaryModel: string;
    private enabled: boolean;

    constructor(provider: string, model: string, summaryModel?: string) {
        this.provider = provider.toLowerCase();
        this.model = model;
        this.summaryModel = summaryModel || model;
        
        // RESTAPIの場合は無効化
        this.enabled = this.provider !== 'restapi';
        
        if (!this.enabled) {
            console.log('💰 Cost calculation disabled for REST API provider');
            this.pricing = {};
            return;
        }

        // 料金設定を読み込み
        const pricingPath = path.join('/app/config/pricing.json');
        try {
            const pricingData = fs.readFileSync(pricingPath, 'utf-8');
            this.pricing = JSON.parse(pricingData);
            console.log(`💰 Cost calculator initialized for ${provider}/${model}`);
        } catch (error) {
            console.warn('⚠️ Could not load pricing.json, cost calculation disabled:', error);
            this.enabled = false;
            this.pricing = {};
        }
    }

    /**
     * トークン使用量からコストを計算
     */
    calculateCost(usage: TokenUsage): CostBreakdown | null {
        if (!this.enabled) {
            return null;
        }

        const modelPricing = this.getModelPricing(this.model);
        if (!modelPricing) {
            console.warn(`⚠️ Pricing not found for ${this.provider}/${this.model}`);
            return null;
        }

        const summaryModelPricing = usage.summaryTokens && usage.summaryTokens > 0
            ? this.getModelPricing(this.summaryModel)
            : null;

        // コスト計算（1Mトークンあたりの価格を使用）
        const inputCost = (usage.promptTokens / 1_000_000) * modelPricing.input_per_1m;
        const outputCost = (usage.completionTokens / 1_000_000) * modelPricing.output_per_1m;
        
        // 要約コスト（要約モデルの価格を使用）
        let summaryCost = 0;
        if (usage.summaryTokens && usage.summaryTokens > 0 && summaryModelPricing) {
            // 要約は入力と出力の両方を含むと仮定（実際の比率は不明なので半々とする）
            const summaryInput = usage.summaryTokens * 0.6; // 60%が入力と仮定
            const summaryOutput = usage.summaryTokens * 0.4; // 40%が出力と仮定
            summaryCost = 
                (summaryInput / 1_000_000) * summaryModelPricing.input_per_1m +
                (summaryOutput / 1_000_000) * summaryModelPricing.output_per_1m;
        }

        const totalCost = inputCost + outputCost + summaryCost;

        return {
            provider: this.provider,
            model: this.model,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            summaryTokens: usage.summaryTokens || 0,
            totalTokens: usage.totalTokens + (usage.summaryTokens || 0),
            inputCost,
            outputCost,
            summaryCost,
            totalCost,
            currency: modelPricing.currency,
            formattedCost: this.formatCost(totalCost, modelPricing.currency)
        };
    }

    /**
     * 現在のコストとデータセット完了までの予想コストを計算
     */
    calculateProjection(
        currentUsage: TokenUsage,
        completedCount: number,
        totalCount: number
    ): {
        current: CostBreakdown | null;
        projected: CostBreakdown | null;
        remaining: CostBreakdown | null;
    } {
        if (!this.enabled || completedCount === 0) {
            return { current: null, projected: null, remaining: null };
        }

        const current = this.calculateCost(currentUsage);
        if (!current) {
            return { current: null, projected: null, remaining: null };
        }

        // 平均トークン数を計算
        const avgPromptTokens = currentUsage.promptTokens / completedCount;
        const avgCompletionTokens = currentUsage.completionTokens / completedCount;
        const avgSummaryTokens = (currentUsage.summaryTokens || 0) / completedCount;

        // 残りのPRの推定トークン数
        const remainingCount = totalCount - completedCount;
        const projectedRemainingUsage: TokenUsage = {
            promptTokens: avgPromptTokens * remainingCount,
            completionTokens: avgCompletionTokens * remainingCount,
            totalTokens: (avgPromptTokens + avgCompletionTokens) * remainingCount,
            summaryTokens: avgSummaryTokens * remainingCount
        };

        const remaining = this.calculateCost(projectedRemainingUsage);

        // 全体の推定
        const projectedTotalUsage: TokenUsage = {
            promptTokens: avgPromptTokens * totalCount,
            completionTokens: avgCompletionTokens * totalCount,
            totalTokens: (avgPromptTokens + avgCompletionTokens) * totalCount,
            summaryTokens: avgSummaryTokens * totalCount
        };

        const projected = this.calculateCost(projectedTotalUsage);

        return { current, projected, remaining };
    }

    /**
     * コスト情報を表示
     */
    displayCostBreakdown(cost: CostBreakdown): void {
        console.log('\n💰 Cost Breakdown:');
        console.log('========================================');
        console.log(`   Provider: ${cost.provider}`);
        console.log(`   Model: ${cost.model}`);
        console.log(`   Prompt Tokens: ${this.formatNumber(cost.promptTokens)}`);
        console.log(`   Completion Tokens: ${this.formatNumber(cost.completionTokens)}`);
        if (cost.summaryTokens > 0) {
            console.log(`   Summary Tokens: ${this.formatNumber(cost.summaryTokens)}`);
        }
        console.log(`   Total Tokens: ${this.formatNumber(cost.totalTokens)}`);
        console.log(`   ---`);
        console.log(`   Input Cost: $${cost.inputCost.toFixed(4)}`);
        console.log(`   Output Cost: $${cost.outputCost.toFixed(4)}`);
        if (cost.summaryCost > 0) {
            console.log(`   Summary Cost: $${cost.summaryCost.toFixed(4)}`);
        }
        console.log(`   Total Cost: ${cost.formattedCost}`);
        console.log('========================================');
    }

    /**
     * プロジェクション情報を表示
     */
    displayProjection(
        current: CostBreakdown | null,
        projected: CostBreakdown | null,
        remaining: CostBreakdown | null,
        completedCount: number,
        totalCount: number
    ): void {
        if (!current || !projected || !remaining) {
            return;
        }

        console.log('\n💰 Cost Projection:');
        console.log('========================================');
        console.log(`   Progress: ${completedCount}/${totalCount} PRs (${Math.round((completedCount / totalCount) * 100)}%)`);
        console.log(`   ---`);
        console.log(`   Current Cost: ${current.formattedCost}`);
        console.log(`     - Input: $${current.inputCost.toFixed(4)}`);
        console.log(`     - Output: $${current.outputCost.toFixed(4)}`);
        if (current.summaryCost > 0) {
            console.log(`     - Summary: $${current.summaryCost.toFixed(4)}`);
        }
        console.log(`   ---`);
        console.log(`   Remaining Est.: ${remaining.formattedCost}`);
        console.log(`     - Input: $${remaining.inputCost.toFixed(4)}`);
        console.log(`     - Output: $${remaining.outputCost.toFixed(4)}`);
        if (remaining.summaryCost > 0) {
            console.log(`     - Summary: $${remaining.summaryCost.toFixed(4)}`);
        }
        console.log(`   ---`);
        console.log(`   Projected Total: ${projected.formattedCost}`);
        console.log(`     - Total Tokens: ${this.formatNumber(projected.totalTokens)}`);
        console.log(`     - Avg per PR: $${(projected.totalCost / totalCount).toFixed(4)}`);
        console.log('========================================');
    }

    /**
     * モデルの価格情報を取得
     */
    private getModelPricing(modelName: string): ModelPricing | null {
        const providerPricing = this.pricing[this.provider];
        if (!providerPricing) {
            return null;
        }

        // モデル名の正規化（小文字化、ハイフンとアンダースコアの統一）
        const normalizedModel = modelName.toLowerCase().replace(/_/g, '-');
        
        // 直接マッチ
        if (providerPricing[normalizedModel]) {
            return providerPricing[normalizedModel];
        }

        // 部分マッチ（例: "gpt-5-turbo-2024" -> "gpt-5"）
        for (const key in providerPricing) {
            if (normalizedModel.startsWith(key) || key.startsWith(normalizedModel)) {
                return providerPricing[key];
            }
        }

        return null;
    }

    /**
     * コストをフォーマット
     */
    private formatCost(cost: number, currency: string): string {
        if (cost < 0.01) {
            return `$${cost.toFixed(6)} ${currency}`;
        } else if (cost < 1) {
            return `$${cost.toFixed(4)} ${currency}`;
        } else {
            return `$${cost.toFixed(2)} ${currency}`;
        }
    }

    /**
     * 数値をフォーマット（カンマ区切り）
     */
    private formatNumber(num: number): string {
        return num.toLocaleString('en-US');
    }

    /**
     * コスト計算が有効かどうか
     */
    isEnabled(): boolean {
        return this.enabled;
    }
}

export default CostCalculator;
