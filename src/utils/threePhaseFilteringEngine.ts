/**
 * 3段階フィルタリング統合クラス
 * Phase 1 (ルール) → Phase 2 (スコアリング) → Phase 3 (LLM) を統合管理
 */

import { LLMClient } from '../modules/llmClient.js';
import { 
    APREvaluation, 
    ClassificationResult, 
    Phase1RuleClassifier, 
    Phase2ScoringClassifier 
} from './datasetFilterClassifier.js';
import { Phase3LLMClassifier } from './phase3LLMClassifier.js';

export interface FilteringStats {
    total: number;
    phase1: number;
    phase2: number;
    phase3: number;
    bugFix: number;
    feature: number;
    refactoring: number;
    unclear: number;
    manualReviewNeeded: number;
}

export class ThreePhaseFilteringEngine {
    private phase1Classifier: Phase1RuleClassifier;
    private phase2Classifier: Phase2ScoringClassifier;
    private phase3Classifier: Phase3LLMClassifier;
    private stats: FilteringStats;

    constructor(llmClient: LLMClient, model: string = 'gpt-5', temperature: number = 0.1) {
        this.phase1Classifier = new Phase1RuleClassifier();
        this.phase2Classifier = new Phase2ScoringClassifier();
        this.phase3Classifier = new Phase3LLMClassifier(llmClient, model, temperature);
        
        this.stats = {
            total: 0,
            phase1: 0,
            phase2: 0,
            phase3: 0,
            bugFix: 0,
            feature: 0,
            refactoring: 0,
            unclear: 0,
            manualReviewNeeded: 0
        };
    }

    /**
     * 単一のAPR評価データを分類
     */
    async classify(evaluation: APREvaluation): Promise<ClassificationResult> {
        this.stats.total++;

        // Phase 1: ルールベース判定
        const phase1Result = this.phase1Classifier.classify(evaluation);
        if (phase1Result) {
            this.stats.phase1++;
            this.updateCategoryStats(phase1Result);
            console.log(`✅ Phase 1 判定: ${evaluation.pullRequestName} → ${phase1Result.category} (信頼度: ${phase1Result.confidence.toFixed(2)})`);
            return phase1Result;
        }

        // Phase 2: スコアリングベース判定
        const phase2Result = this.phase2Classifier.classify(evaluation);
        if (phase2Result) {
            this.stats.phase2++;
            this.updateCategoryStats(phase2Result);
            console.log(`⚖️  Phase 2 判定: ${evaluation.pullRequestName} → ${phase2Result.category} (信頼度: ${phase2Result.confidence.toFixed(2)})`);
            return phase2Result;
        }

        // Phase 3: LLMベース判定
        console.log(`🤖 Phase 3 LLM分類開始: ${evaluation.pullRequestName}`);
        const phase3Result = await this.phase3Classifier.classify(evaluation);
        this.stats.phase3++;
        this.updateCategoryStats(phase3Result);
        console.log(`🤖 Phase 3 判定: ${evaluation.pullRequestName} → ${phase3Result.category} (信頼度: ${phase3Result.confidence.toFixed(2)})`);
        
        return phase3Result;
    }

    /**
     * 複数のAPR評価データを一括分類
     */
    async classifyBatch(evaluations: APREvaluation[]): Promise<ClassificationResult[]> {
        console.log(`\n📊 3段階フィルタリング開始: ${evaluations.length}件のPRを処理`);
        console.log('━'.repeat(80));

        const results: ClassificationResult[] = [];

        for (let i = 0; i < evaluations.length; i++) {
            const evaluation = evaluations[i];
            console.log(`\n[${i + 1}/${evaluations.length}] 処理中: ${evaluation.pullRequestName}`);
            
            try {
                const result = await this.classify(evaluation);
                results.push(result);

                // Phase 3の場合は少し待機（レート制限対策）
                if (result.phase === 3 && i < evaluations.length - 1) {
                    await this.sleep(500);
                }
            } catch (error) {
                console.error(`❌ エラー発生: ${evaluation.pullRequestName}`, error);
                results.push({
                    category: 'UNCLEAR',
                    confidence: 0.0,
                    reasoning: `処理中にエラーが発生: ${error}`,
                    keyEvidence: ['processing error'],
                    phase: 3,
                    processedBy: 'LLM',
                    requiresManualReview: true
                });
            }
        }

        console.log('\n━'.repeat(80));
        console.log('✅ 3段階フィルタリング完了');
        this.printStats();

        return results;
    }

    /**
     * 統計情報を取得
     */
    getStats(): FilteringStats {
        return { ...this.stats };
    }

    /**
     * 統計情報を表示
     */
    printStats(): void {
        console.log('\n📊 フィルタリング統計:');
        console.log(`  総処理件数: ${this.stats.total}件`);
        console.log(`  Phase 1 (ルール): ${this.stats.phase1}件 (${(this.stats.phase1 / this.stats.total * 100).toFixed(1)}%)`);
        console.log(`  Phase 2 (スコア): ${this.stats.phase2}件 (${(this.stats.phase2 / this.stats.total * 100).toFixed(1)}%)`);
        console.log(`  Phase 3 (LLM):   ${this.stats.phase3}件 (${(this.stats.phase3 / this.stats.total * 100).toFixed(1)}%)`);
        console.log('\n📁 分類結果:');
        console.log(`  🐛 バグ修正:        ${this.stats.bugFix}件`);
        console.log(`  ✨ 機能追加:        ${this.stats.feature}件`);
        console.log(`  🔧 リファクタリング: ${this.stats.refactoring}件`);
        console.log(`  ❓ 不明確:          ${this.stats.unclear}件`);
        console.log(`  👁️  要レビュー:      ${this.stats.manualReviewNeeded}件`);
    }

    /**
     * 統計情報を更新
     */
    private updateCategoryStats(result: ClassificationResult): void {
        switch (result.category) {
            case 'BUG_FIX':
                this.stats.bugFix++;
                break;
            case 'FEATURE':
                this.stats.feature++;
                break;
            case 'REFACTORING':
                this.stats.refactoring++;
                break;
            case 'UNCLEAR':
                this.stats.unclear++;
                break;
        }

        if (result.requiresManualReview) {
            this.stats.manualReviewNeeded++;
        }
    }

    /**
     * スリープユーティリティ
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 統計情報をリセット
     */
    resetStats(): void {
        this.stats = {
            total: 0,
            phase1: 0,
            phase2: 0,
            phase3: 0,
            bugFix: 0,
            feature: 0,
            refactoring: 0,
            unclear: 0,
            manualReviewNeeded: 0
        };
    }
}
