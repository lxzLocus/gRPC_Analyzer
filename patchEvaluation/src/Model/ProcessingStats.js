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
        
        // APR品質指標
        this.aprQualityGood = 0;        // LLMが「良い修正」と評価した数
        this.aprQualityBad = 0;         // LLMが「悪い修正」と評価した数
        this.aprEffectiveFixed = 0;     // 実際に問題を解決した修正数
        this.aprEffectiveUnfixed = 0;   // 問題を解決できなかった修正数
        this.aprMinimalChanges = 0;     // 最小変更で済んだ修正数
        this.aprExcessiveChanges = 0;   // 過剰な変更を含む修正数
        
        this.matchedPairs = [];
        this.unmatchedEntries = [];
        this.errorEntries = [];
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
     * 成功したマッチングペアを追加
     */
    addMatchedPair(pair) {
        this.matchedPairs.push(pair);
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

        const totalTurns = this.matchedPairs.reduce((sum, pair) => sum + pair.aprLogData.turns, 0);
        const totalTokens = this.matchedPairs.reduce((sum, pair) => sum + pair.aprLogData.totalTokens, 0);
        const totalMods = this.matchedPairs.reduce((sum, pair) => sum + pair.aprLogData.modifications, 0);
        const totalAffectedFiles = this.matchedPairs.reduce((sum, pair) => sum + pair.aprLogData.affectedFiles, 0);
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
        const withFinalMod = this.matchedPairs.filter(pair => pair.finalModification !== null).length;
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
}
