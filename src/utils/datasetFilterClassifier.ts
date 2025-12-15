/**
 * Dataset Filter Classifier
 * APR評価データを基に、PRをバグ修正/機能追加/リファクタリングに分類
 * 3段階フィルタリング: Phase 1 (ルール) → Phase 2 (スコアリング) → Phase 3 (LLM)
 */

export interface APREvaluation {
    pullRequestName: string;
    evaluationReasoning: string;
    plausibilityReasoning?: string;
    modificationTypes: string[];
    correctnessLevel: string;
    semanticSimilarityScore: number;
}

export interface ClassificationResult {
    category: 'BUG_FIX' | 'FEATURE' | 'REFACTORING' | 'UNCLEAR';
    confidence: number;
    reasoning: string;
    keyEvidence: string[];
    phase: 1 | 2 | 3;
    processedBy: 'RULE' | 'SCORING' | 'LLM';
    requiresManualReview?: boolean;
}

/**
 * Phase 1: ルールベース分類器
 * 超明確なシグナルを持つケースを即座に判定
 */
export class Phase1RuleClassifier {
    classify(evaluation: APREvaluation): ClassificationResult | null {
        const reasoning = evaluation.evaluationReasoning.toLowerCase();
        const modTypes = evaluation.modificationTypes;
        const prName = evaluation.pullRequestName.toLowerCase();

        // 超強力なバグ修正シグナル
        const veryStrongBugSignals = [
            modTypes.includes('error') && modTypes.includes('null-check'),
            modTypes.includes('security') && reasoning.includes('fix'),
            reasoning.includes('fixes bug') || reasoning.includes('corrects error'),
            reasoning.includes('prevents crash') || reasoning.includes('prevents panic'),
            prName.includes('fix_') && reasoning.includes('error'),
            reasoning.includes('addresses cve') || reasoning.includes('security vulnerability')
        ].filter(x => x).length;

        if (veryStrongBugSignals >= 2) {
            return {
                category: 'BUG_FIX',
                confidence: 0.95,
                reasoning: '複数の強力なバグ修正シグナルを検出',
                keyEvidence: this.extractBugEvidences(reasoning, modTypes, prName),
                phase: 1,
                processedBy: 'RULE'
            };
        }

        // 超強力な機能追加シグナル
        const veryStrongFeatureSignals = [
            reasoning.includes('implements new') || reasoning.includes('adds new'),
            reasoning.includes('new feature') || reasoning.includes('new functionality'),
            modTypes.includes('api') && (reasoning.includes('endpoint') || reasoning.includes('method')),
            prName.includes('feature_') || prName.includes('add_'),
            reasoning.includes('enhancement') && !reasoning.includes('fix')
        ].filter(x => x).length;

        if (veryStrongFeatureSignals >= 2 && veryStrongBugSignals === 0) {
            return {
                category: 'FEATURE',
                confidence: 0.90,
                reasoning: '複数の強力な機能追加シグナルを検出、バグ修正の証拠なし',
                keyEvidence: this.extractFeatureEvidences(reasoning, modTypes, prName),
                phase: 1,
                processedBy: 'RULE'
            };
        }

        // 超明確なリファクタリングシグナル
        const veryStrongRefactorSignals = [
            reasoning.includes('refactor') && !reasoning.includes('fix'),
            reasoning.includes('renames') || reasoning.includes('rename'),
            prName.includes('refactor_') || prName.includes('rename_'),
            reasoning.includes('improves code structure') || reasoning.includes('code cleanup')
        ].filter(x => x).length;

        if (veryStrongRefactorSignals >= 2 && veryStrongBugSignals === 0) {
            return {
                category: 'REFACTORING',
                confidence: 0.85,
                reasoning: '明確なリファクタリングシグナルを検出、バグ修正の証拠なし',
                keyEvidence: this.extractRefactorEvidences(reasoning, modTypes, prName),
                phase: 1,
                processedBy: 'RULE'
            };
        }

        // Phase 1で判定できない
        return null;
    }

    private extractBugEvidences(reasoning: string, modTypes: string[], prName: string): string[] {
        const evidences: string[] = [];
        if (reasoning.includes('fix')) evidences.push('evaluationReasoningに"fix"を含む');
        if (reasoning.includes('error')) evidences.push('evaluationReasoningに"error"を含む');
        if (reasoning.includes('crash')) evidences.push('クラッシュ防止の言及');
        if (modTypes.includes('error')) evidences.push('modificationTypes: error');
        if (modTypes.includes('null-check')) evidences.push('modificationTypes: null-check');
        if (modTypes.includes('security')) evidences.push('modificationTypes: security');
        if (prName.includes('fix')) evidences.push('PR名に"fix"を含む');
        return evidences;
    }

    private extractFeatureEvidences(reasoning: string, modTypes: string[], prName: string): string[] {
        const evidences: string[] = [];
        if (reasoning.includes('new')) evidences.push('evaluationReasoningに"new"を含む');
        if (reasoning.includes('add')) evidences.push('evaluationReasoningに"add"を含む');
        if (reasoning.includes('implements')) evidences.push('新規実装の言及');
        if (modTypes.includes('api')) evidences.push('modificationTypes: api');
        if (prName.includes('add')) evidences.push('PR名に"add"を含む');
        return evidences;
    }

    private extractRefactorEvidences(reasoning: string, modTypes: string[], prName: string): string[] {
        const evidences: string[] = [];
        if (reasoning.includes('refactor')) evidences.push('evaluationReasoningに"refactor"を含む');
        if (reasoning.includes('rename')) evidences.push('リネームの言及');
        if (prName.includes('refactor')) evidences.push('PR名に"refactor"を含む');
        return evidences;
    }
}

/**
 * Phase 2: スコアリングベース分類器
 * 複数のシグナルを統合して判定
 */
export class Phase2ScoringClassifier {
    classify(evaluation: APREvaluation): ClassificationResult | null {
        const reasoning = evaluation.evaluationReasoning.toLowerCase();
        const modTypes = evaluation.modificationTypes;
        const prName = evaluation.pullRequestName.toLowerCase();

        // バグ修正スコア
        let bugScore = 0;
        if (modTypes.includes('error')) bugScore += 3;
        if (modTypes.includes('null-check')) bugScore += 3;
        if (modTypes.includes('security')) bugScore += 2;
        if (reasoning.includes('fix')) bugScore += 2;
        if (reasoning.includes('incorrect')) bugScore += 2;
        if (reasoning.includes('correct')) bugScore += 1;
        if (prName.includes('fix')) bugScore += 1;
        if (reasoning.includes('bug')) bugScore += 2;
        if (reasoning.includes('crash') || reasoning.includes('panic')) bugScore += 3;

        // 機能追加スコア
        let featureScore = 0;
        if (modTypes.includes('api')) featureScore += 2;
        if (modTypes.includes('database')) featureScore += 1;
        if (modTypes.includes('ui')) featureScore += 1;
        if (reasoning.includes('add')) featureScore += 2;
        if (reasoning.includes('new')) featureScore += 2;
        if (reasoning.includes('implements')) featureScore += 2;
        if (reasoning.includes('feature')) featureScore += 3;
        if (prName.includes('add')) featureScore += 1;
        if (reasoning.includes('enhancement')) featureScore += 2;

        // リファクタリングスコア
        let refactorScore = 0;
        if (reasoning.includes('refactor')) refactorScore += 3;
        if (reasoning.includes('rename')) refactorScore += 2;
        if (reasoning.includes('cleanup')) refactorScore += 2;
        if (prName.includes('refactor')) refactorScore += 1;

        // スコアに基づく判定
        const maxScore = Math.max(bugScore, featureScore, refactorScore);

        // 中程度の確信閾値
        if (maxScore >= 5) {
            if (bugScore === maxScore) {
                return {
                    category: 'BUG_FIX',
                    confidence: Math.min(0.6 + (bugScore / 20), 0.85),
                    reasoning: `バグ修正スコア: ${bugScore} (機能: ${featureScore}, リファクタ: ${refactorScore})`,
                    keyEvidence: [`bugScore=${bugScore}`, `主要シグナル: ${this.getTopSignals(evaluation, 'bug')}`],
                    phase: 2,
                    processedBy: 'SCORING'
                };
            } else if (featureScore === maxScore) {
                return {
                    category: 'FEATURE',
                    confidence: Math.min(0.6 + (featureScore / 20), 0.80),
                    reasoning: `機能追加スコア: ${featureScore} (バグ: ${bugScore}, リファクタ: ${refactorScore})`,
                    keyEvidence: [`featureScore=${featureScore}`, `主要シグナル: ${this.getTopSignals(evaluation, 'feature')}`],
                    phase: 2,
                    processedBy: 'SCORING'
                };
            } else if (refactorScore === maxScore) {
                return {
                    category: 'REFACTORING',
                    confidence: Math.min(0.6 + (refactorScore / 20), 0.75),
                    reasoning: `リファクタリングスコア: ${refactorScore} (バグ: ${bugScore}, 機能: ${featureScore})`,
                    keyEvidence: [`refactorScore=${refactorScore}`, `主要シグナル: ${this.getTopSignals(evaluation, 'refactor')}`],
                    phase: 2,
                    processedBy: 'SCORING'
                };
            }
        }

        // Phase 2でも判定できない
        return null;
    }

    private getTopSignals(evaluation: APREvaluation, type: 'bug' | 'feature' | 'refactor'): string {
        const signals: string[] = [];
        const reasoning = evaluation.evaluationReasoning.toLowerCase();
        const modTypes = evaluation.modificationTypes;

        if (type === 'bug') {
            if (modTypes.includes('error')) signals.push('error');
            if (modTypes.includes('null-check')) signals.push('null-check');
            if (reasoning.includes('fix')) signals.push('fix');
        } else if (type === 'feature') {
            if (modTypes.includes('api')) signals.push('api');
            if (reasoning.includes('add')) signals.push('add');
            if (reasoning.includes('new')) signals.push('new');
        } else {
            if (reasoning.includes('refactor')) signals.push('refactor');
            if (reasoning.includes('rename')) signals.push('rename');
        }

        return signals.slice(0, 3).join(', ');
    }
}
