/**
 * 処理統計情報を管理するモデルクラス
 */
export class ProcessingStats {
    constructor() {
        this.totalDatasetEntries = 0;
        this.aprLogFound = 0;
        this.aprLogNotFound = 0;
        this.aprLogAccessError = 0;
        this.aprParseSuccess = 0;  // ステップ1完了数（旧: 解析成功）
        this.aprParseFailure = 0;
        this.evaluationPipelineSuccess = 0; // 評価パイプライン成功数（ステップ1+2完了）
        this.evaluationPipelineFailure = 0; // 評価パイプライン失敗数
        
        // 新評価軸（離散カテゴリベース）
        // 最終評価カテゴリ（CORRECT/PLAUSIBLE/INCORRECT）
        this.categoryCorrect = 0;      // 人間と同等またはそれ以上
        this.categoryPlausible = 0;     // 実用的だが人間と異なる
        this.categoryIncorrect = 0;     // 誤修正
        
        // Success/Failure判定
        this.successCount = 0;          // 成功ケース
        this.failureCount = 0;          // 失敗ケース
        
        // Intent Fulfillment（5段階enum）
        this.intentFullyFulfilled = 0;              // FULLY_FULFILLED
        this.intentSubstantiallyFulfilled = 0;      // SUBSTANTIALLY_FULFILLED
        this.intentPartiallyFulfilled = 0;          // PARTIALLY_FULFILLED
        this.intentMinimallyFulfilled = 0;          // MINIMALLY_FULFILLED
        this.intentNotFulfilled = 0;                // NOT_FULFILLED
        
        // Accuracy Level分布
        this.accuracyLevelCounts = new Map([
            ['PERFECT_MATCH', 0],
            ['NEAR_PERFECT', 0],
            ['HIGH_SIMILARITY', 0],
            ['PARTIAL_MATCH', 0],
            ['CORRECT_LOCUS', 0],
            ['NO_MATCH', 0]
        ]);
        
        // 旧評価指標（後方互換性のため残存）
        this.aprQualityGood = 0;        // LLMが「良い修正」と評価した数
        this.aprQualityBad = 0;         // LLMが「悪い修正」と評価した数
        this.aprEffectiveFixed = 0;     // 実際に問題を解決した修正数
        this.aprEffectiveUnfixed = 0;   // 問題を解決できなかった修正数
        this.aprMinimalChanges = 0;     // 最小変更で済んだ修正数
        this.aprExcessiveChanges = 0;   // 過剰な変更を含む修正数
        
        this.matchedPairs = [];
        this.unmatchedEntries = [];
        this.errorEntries = [];
        
        // LLM評価スキップ理由の統計
        this.evaluationSkipReasons = new Map();
    }

    /**
     * APRログが発見された際の統計更新
     */
    incrementAprLogFound() {
        this.aprLogFound++;
    }

    /**
     * APRログが見つからなかった際の統計更新
     */
    incrementAprLogNotFound() {
        this.aprLogNotFound++;
    }

    /**
     * APRログアクセスエラーの統計更新
     */
    incrementAprLogAccessError() {
        this.aprLogAccessError++;
    }

    /**
     * APRログ解析成功の統計更新
     */
    incrementAprParseSuccess() {
        this.aprParseSuccess++;
    }

    /**
     * APRログ解析失敗の統計更新
     */
    incrementAprParseFailure() {
        this.aprParseFailure++;
    }

    /**
     * 評価パイプライン成功の統計更新（ステップ1+2完了）
     */
    incrementEvaluationPipelineSuccess() {
        this.evaluationPipelineSuccess++;
    }

    /**
     * 評価パイプライン失敗の統計更新
     */
    incrementEvaluationPipelineFailure() {
        this.evaluationPipelineFailure++;
    }

    /**
     * データセットエントリー数をインクリメント
     */
    incrementTotalEntries() {
        this.totalDatasetEntries++;
    }

    /**
     * APR品質指標を更新
     */
    incrementAprQualityGood() {
        this.aprQualityGood++;
    }

    incrementAprQualityBad() {
        this.aprQualityBad++;
    }

    incrementAprEffectiveFixed() {
        this.aprEffectiveFixed++;
    }

    incrementAprEffectiveUnfixed() {
        this.aprEffectiveUnfixed++;
    }

    incrementAprMinimalChanges() {
        this.aprMinimalChanges++;
    }

    incrementAprExcessiveChanges() {
        this.aprExcessiveChanges++;
    }

    /**
     * 最終評価カテゴリの統計更新
     * @param {string} category - CORRECT/PLAUSIBLE/INCORRECT
     */
    incrementFinalCategory(category) {
        switch (category) {
            case 'CORRECT':
                this.categoryCorrect++;
                break;
            case 'PLAUSIBLE':
                this.categoryPlausible++;
                break;
            case 'INCORRECT':
                this.categoryIncorrect++;
                break;
            default:
                break;
        }
    }

    /**
     * Success/Failure判定の統計更新
     * @param {boolean} isSuccess - 成功判定
     */
    incrementSuccessCount(isSuccess) {
        if (isSuccess === true) {
            this.successCount++;
        } else if (isSuccess === false) {
            this.failureCount++;
        }
    }

    /**
     * Accuracy Level分布の統計更新
     * @param {string} level - Accuracy level
     */
    incrementAccuracyLevel(level) {
        if (!level) return;
        const current = this.accuracyLevelCounts.get(level) || 0;
        this.accuracyLevelCounts.set(level, current + 1);
    }

    /**
     * Intent Fulfillment分布の統計更新
     * @param {string} level - Intent Fulfillment level (新形式)
     */
    incrementIntentFulfillment(level) {
        switch (level) {
            case 'FULLY_FULFILLED':
                this.intentFullyFulfilled++;
                break;
            case 'SUBSTANTIALLY_FULFILLED':
                this.intentSubstantiallyFulfilled++;
                break;
            case 'PARTIALLY_FULFILLED':
                this.intentPartiallyFulfilled++;
                break;
            case 'MINIMALLY_FULFILLED':
                this.intentMinimallyFulfilled++;
                break;
            case 'NOT_FULFILLED':
                this.intentNotFulfilled++;
                break;
            // 旧形式との後方互換性
            case 'INTENT_FULFILLED':
                this.intentFullyFulfilled++;
                break;
            case 'INTENT_PARTIALLY_FULFILLED':
                this.intentPartiallyFulfilled++;
                break;
            case 'INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED':
                this.intentMinimallyFulfilled++;
                break;
            case 'INTENT_NOT_FULFILLED':
                this.intentNotFulfilled++;
                break;
            default:
                break;
        }
    }

    /**
     * 成功したマッチングペアを追加
     */
    addMatchedPair(pair) {
        // データの整合性を確認してから追加
        if (!pair) {
            console.warn('⚠️ ProcessingStats.addMatchedPair: pairがnullまたはundefined');
            return;
        }
        
        // aprLogDataが存在しない場合はデフォルト値で初期化
        if (!pair.aprLogData) {
            console.warn('⚠️ ProcessingStats.addMatchedPair: aprLogDataが存在しません。デフォルト値で初期化します。', {
                project: pair.project,
                category: pair.category,
                pullRequest: pair.pullRequest
            });
            pair.aprLogData = {
                turns: 0,
                totalTokens: 0,
                modifications: 0,
                affectedFiles: 0
            };
        }
        
        this.matchedPairs.push(pair);
        
        // LLM評価スキップ理由の記録
        if (pair.finalModification && pair.finalModification.evaluationSkipped && pair.finalModification.skipReason) {
            const reason = pair.finalModification.skipReason.reason;
            const currentCount = this.evaluationSkipReasons.get(reason) || 0;
            this.evaluationSkipReasons.set(reason, currentCount + 1);
        }
    }

    /**
     * 未マッチングエントリーを追加
     */
    addUnmatchedEntry(entry) {
        this.unmatchedEntries.push(entry);
    }

    /**
     * エラーエントリーを追加
     */
    addErrorEntry(entry) {
        this.errorEntries.push(entry);
    }

    /**
     * ステップ1完了率を計算（APRログ構造解析＋差分抽出）
     * APRログが品質評価を開始できる基準を満たしている割合
     */
    calculateStep1CompletionRate() {
        return this.totalDatasetEntries > 0 
            ? (this.aprParseSuccess / this.totalDatasetEntries * 100).toFixed(1) 
            : 0;
    }

    /**
     * 評価パイプライン成功率を計算（ステップ1＋LLM品質評価）
     * ステップ1・2を通じて評価システム全体が技術的エラーなく完了した割合
     */
    calculateEvaluationPipelineSuccessRate() {
        return this.totalDatasetEntries > 0 
            ? (this.evaluationPipelineSuccess / this.totalDatasetEntries * 100).toFixed(1) 
            : 0;
    }

    /**
     * 成功率を計算（後方互換性のため残存）
     */
    calculateSuccessRate() {
        return this.calculateStep1CompletionRate();
    }

    /**
     * APRログ発見率を計算
     */
    calculateAprFoundRate() {
        return this.totalDatasetEntries > 0 
            ? (this.aprLogFound / this.totalDatasetEntries * 100).toFixed(1) 
            : 0;
    }

    /**
     * 発見済みAPRログからの解析成功率を計算
     */
    calculateParseSuccessFromFound() {
        return this.aprLogFound > 0 
            ? (this.aprParseSuccess / this.aprLogFound * 100).toFixed(1) 
            : 0;
    }

    /**
     * APR品質成功率を計算
     */
    calculateAprQualitySuccessRate() {
        const total = this.aprQualityGood + this.aprQualityBad;
        return total > 0 
            ? (this.aprQualityGood / total * 100).toFixed(1) 
            : 0;
    }

    /**
     * 修正効果率を計算
     */
    calculateAprEffectivenessRate() {
        const total = this.aprEffectiveFixed + this.aprEffectiveUnfixed;
        return total > 0 
            ? (this.aprEffectiveFixed / total * 100).toFixed(1) 
            : 0;
    }

    /**
     * 最小変更率を計算
     */
    calculateAprMinimalChangeRate() {
        const total = this.aprMinimalChanges + this.aprExcessiveChanges;
        return total > 0 
            ? (this.aprMinimalChanges / total * 100).toFixed(1) 
            : 0;
    }

    /**
     * 詳細統計を計算
     */
    calculateDetailedStats() {
        if (this.matchedPairs.length === 0) return null;

        const totalTurns = this.matchedPairs.reduce((sum, pair) => {
            const turns = pair.aprLogData?.turns;
            if (Array.isArray(turns)) {
                return sum + turns.length;
            }
            return sum + (typeof turns === 'number' ? turns : 0);
        }, 0);
        const totalTokens = this.matchedPairs.reduce((sum, pair) => sum + (pair.aprLogData?.totalTokens || 0), 0);
        const totalMods = this.matchedPairs.reduce((sum, pair) => {
            const mods = pair.aprLogData?.modifications;
            if (Array.isArray(mods)) {
                return sum + mods.length;
            }
            return sum + (typeof mods === 'number' ? mods : 0);
        }, 0);
        const totalAffectedFiles = this.matchedPairs.reduce((sum, pair) => {
            const affected = pair.aprLogData?.affectedFiles;
            if (Array.isArray(affected)) {
                return sum + affected.length;
            }
            return sum + (typeof affected === 'number' ? affected : 0);
        }, 0);
        const totalChangedFiles = this.matchedPairs.reduce((sum, pair) => sum + (pair.changedFiles ? pair.changedFiles.length : 0), 0);
        const totalAprDiffFiles = this.matchedPairs.reduce((sum, pair) => sum + (pair.aprDiffFiles ? pair.aprDiffFiles.length : 0), 0);

        return {
            averages: {
                turns: totalTurns / this.matchedPairs.length,
                tokens: totalTokens / this.matchedPairs.length,
                modifications: totalMods / this.matchedPairs.length,
                affectedFiles: totalAffectedFiles / this.matchedPairs.length,
                changedFiles: totalChangedFiles / this.matchedPairs.length,
                aprDiffFiles: totalAprDiffFiles / this.matchedPairs.length
            },
            totals: {
                turns: totalTurns,
                tokens: totalTokens,
                modifications: totalMods,
                affectedFiles: totalAffectedFiles,
                changedFiles: totalChangedFiles,
                aprDiffFiles: totalAprDiffFiles
            }
        };
    }

    /**
     * LLM評価統計を計算
     */
    calculateLLMEvaluationStats() {
        const withFinalMod = this.matchedPairs.filter(pair => pair.finalModification !== null && pair.finalModification !== undefined).length;
        const withLLMEval = this.matchedPairs.filter(pair => 
            pair.finalModification && 
            pair.finalModification.llmEvaluation && 
            !pair.finalModification.llmEvaluation.error
        ).length;

        if (withLLMEval === 0) return null;

        const correctCount = this.matchedPairs.filter(pair => 
            pair.finalModification && 
            pair.finalModification.llmEvaluation && 
            pair.finalModification.llmEvaluation.is_correct
        ).length;

        const plausibleCount = this.matchedPairs.filter(pair => 
            pair.finalModification && 
            pair.finalModification.llmEvaluation && 
            pair.finalModification.llmEvaluation.is_plausible
        ).length;

        return {
            withFinalMod,
            withLLMEval,
            correctCount,
            plausibleCount,
            correctRate: (correctCount / withLLMEval * 100).toFixed(1),
            plausibleRate: (plausibleCount / withLLMEval * 100).toFixed(1)
        };
    }

    /**
     * LLM評価スキップ統計を計算
     */
    calculateEvaluationSkipStats() {
        const totalSkipped = this.matchedPairs.filter(pair => 
            pair.finalModification && 
            pair.finalModification.evaluationSkipped
        ).length;

        if (totalSkipped === 0) return null;

        // スキップ理由別の統計
        const reasonStats = [];
        for (const [reason, count] of this.evaluationSkipReasons.entries()) {
            reasonStats.push({
                reason,
                count,
                percentage: ((count / totalSkipped) * 100).toFixed(1)
            });
        }

        // 件数でソート（降順）
        reasonStats.sort((a, b) => b.count - a.count);

        return {
            totalSkipped,
            totalProcessed: this.matchedPairs.length,
            skipRate: ((totalSkipped / this.matchedPairs.length) * 100).toFixed(1),
            reasonStats
        };
    }
}
