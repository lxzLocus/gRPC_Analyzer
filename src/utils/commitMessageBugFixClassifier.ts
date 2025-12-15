/**
 * Commit Message Based Bug Fix Classifier
 * コミットメッセージを分析してバグ修正のみを抽出
 */

import { CommitInfo } from './commitMessageFilter.js';

export interface BugFixClassification {
    isBugFix: boolean;
    confidence: number;
    reasoning: string;
    evidence: string[];
    category: 'BUG_FIX' | 'FEATURE' | 'REFACTORING' | 'UNCLEAR';
}

/**
 * コミットメッセージベースのバグ修正分類器
 */
export class CommitMessageBugFixClassifier {
    /**
     * コミットメッセージ群を分析してバグ修正かどうか判定
     */
    static classify(commits: CommitInfo[], prName: string): BugFixClassification {
        const allMessages = commits.map(c => c.message).join('\n\n');
        const lowerMessages = allMessages.toLowerCase();
        const lowerPrName = prName.toLowerCase();

        const evidence: string[] = [];
        let bugFixScore = 0;
        let featureScore = 0;
        let refactorScore = 0;

        // === バグ修正の強力なシグナル ===
        
        // 1. fix系キーワード (hotfix, bugfix含む) (+5点)
        const fixBugPattern = /fix(es|ed|ing)?\s+(bug|issue|problem|error|crash(es)?)/i;
        const fixIssueNumberPattern = /fix(es|ed|ing)?\s+#\d+/i;
        const hotfixPattern = /hotfix|bugfix|quickfix/i;
        if (fixBugPattern.test(allMessages) || fixIssueNumberPattern.test(allMessages) || hotfixPattern.test(allMessages)) {
            bugFixScore += 5;
            evidence.push('明確な修正パターン: fix/hotfix/bugfix');
        }

        // 2. "bug in/with", "problem with", "issue with" パターン (+4点)
        const bugContextPattern = /(bug|problem|issue)\s+(in|with)/i;
        if (bugContextPattern.test(allMessages)) {
            bugFixScore += 4;
            evidence.push('問題の文脈指摘: "bug/issue/problem in/with ..."');
        }

        // 3. regression対応 (+4点)
        if (/regression/i.test(allMessages)) {
            bugFixScore += 4;
            evidence.push('regression修正');
        }

        // 4. 不正な動作・値の修正 (+4点)
        const incorrectBehaviorPattern = /incorrect|unexpected|wrong\s+(behavior|behaviour|result|value|output)/i;
        if (incorrectBehaviorPattern.test(allMessages)) {
            bugFixScore += 4;
            evidence.push('不正な動作の修正: incorrect/unexpected/wrong');
        }

        // 5. エラーハンドリング・例外処理 (+3点)
        const errorHandlingPattern = /handle(s|d)?\s+(error|exception)|catch(es)?\s+exception|recover(s|ed|ing)?\s+from\s+(crash|panic|error)|avoid(s)?\s+failure/i;
        if (errorHandlingPattern.test(allMessages)) {
            bugFixScore += 3;
            evidence.push('エラーハンドリング追加: handle/catch/recover');
        }

        // 6. null pointer/NPE対応 (+3点)
        const nullPointerPattern = /null[\s_-]*(pointer|ref(erence)?|check|error)|npe/i;
        if (nullPointerPattern.test(allMessages)) {
            bugFixScore += 3;
            evidence.push('Null pointer/NPE対応');
        }

        // 7. type error/mismatch (+3点)
        const typeErrorPattern = /type\s+(error|mismatch|bug)/i;
        if (typeErrorPattern.test(allMessages)) {
            bugFixScore += 3;
            evidence.push('Type error修正');
        }

        // 8. memory leak (+4点)
        if (/memory\s+leak/i.test(allMessages)) {
            bugFixScore += 4;
            evidence.push('Memory leak修正');
        }

        // 9. edge case対応 (+2点)
        if (/edge\s+case/i.test(allMessages)) {
            bugFixScore += 2;
            evidence.push('Edge case対応');
        }

        // 10. "when ..." パターン (状況依存バグ) (+2点)
        const whenPattern = /(crash|error|fail|bug|panic)\s+when/i;
        if (whenPattern.test(allMessages)) {
            bugFixScore += 2;
            evidence.push('状況依存バグ: "X when Y" パターン');
        }

        // 11. missing check/validation (+3点)
        const missingCheckPattern = /missing\s+(check|validation|test|guard)/i;
        if (missingCheckPattern.test(allMessages)) {
            bugFixScore += 3;
            evidence.push('欠落チェック追加: missing check/validation');
        }

        // 12. workaround (+2点)
        if (/workaround/i.test(allMessages)) {
            bugFixScore += 2;
            evidence.push('Workaround実装');
        }

        // 13. "bug" キーワード出現回数 (+1～3点)
        const bugMatches = (allMessages.match(/\bbug\b/gi) || []).length;
        if (bugMatches >= 2) {
            bugFixScore += 3;
            evidence.push(`'bug'キーワードが${bugMatches}回出現`);
        } else if (bugMatches === 1) {
            bugFixScore += 1;
            evidence.push("'bug'キーワード検出");
        }

        // 14. セキュリティ修正 (+4点)
        if (/security\s+(fix|patch|vulnerability|issue)|cve-\d+/i.test(allMessages)) {
            bugFixScore += 4;
            evidence.push('セキュリティ修正');
        }

        // 15. クラッシュ・エラー防止（複数形対応） (+4点)
        const preventPattern = /prevent(s)?\s+(crash(es)?|panic(s)?|error(s)?)|avoid(s)?\s+(crash(es)?|panic(s)?|failure)/i;
        if (preventPattern.test(allMessages)) {
            bugFixScore += 4;
            evidence.push('クラッシュ/エラー防止');
        }

        // 16. PR名に "fix" がある (+2点)
        if (/\bfix\b/.test(lowerPrName)) {
            bugFixScore += 2;
            evidence.push('PR名にfixキーワード');
        }

        // 17. "correct" "repair" "resolve" などの修正系動詞 (+1点/キーワード)
        const correctionKeywords = ['correct', 'repair', 'resolve problem', 'address issue', 'patch', 'repair logic'];
        const foundCorrections = correctionKeywords.filter(kw => lowerMessages.includes(kw));
        if (foundCorrections.length > 0) {
            bugFixScore += foundCorrections.length;
            evidence.push(`修正系キーワード: ${foundCorrections.join(', ')}`);
        }

        // 18. GitHub標準のissue解決パターン (URL形式含む) (+4点)
        const resolveIssuePattern = /(resolves?|closes?)\s+#\d+/i;
        const resolveIssueUrlPattern = /(fix(es|ed|ing)?|close(s|d)?|resolve(s|d)?)[^\r\n]*issues?\/\d+/i;
        if (resolveIssuePattern.test(allMessages) || resolveIssueUrlPattern.test(allMessages)) {
            bugFixScore += 4;
            evidence.push('GitHubのissue解決パターン (Resolves/Closes/Fixes #番号 or URL)');
        }

        // === 機能追加のシグナル ===
        
        // 1. PRタイトルが"Add"/"Implement"で始まる (+2点)
        if (/^(add|implement)\b/i.test(prName)) {
            featureScore += 2;
            evidence.push('PRタイトルがAdd/Implementで開始');
        }

        // 2. 本文に "Adds new" があれば機能追加 (+3点、タイトル開始に関係なく)
        if (/adds?\s+new\s+(feature|field|method|function|support|capability)/i.test(allMessages)) {
            featureScore += 3;
            evidence.push('本文に「Adds new X」パターン');
        }

        // 3. "new feature", "new field" など (+3点)
        if (/\bnew\s+(feature|field|method|function|support|capability)\b/i.test(lowerMessages)) {
            featureScore += 3;
            evidence.push('新規機能キーワード');
        }

        // 4. "enhancement" (+2点)
        if (lowerMessages.includes('enhancement')) {
            featureScore += 2;
            evidence.push('エンハンスメントキーワード');
        }

        // === リファクタリングのシグナル ===
        
        // 1. "Refactor" "Rename" "Cleanup"
        if (/refactor|rename|cleanup|reorganize/i.test(allMessages)) {
            refactorScore += 3;
            evidence.push('リファクタリングキーワード検出');
        }

        // 2. "Remove deprecated" "Update to proto3"
        if (/remove\s+deprecated|update.*to\s+proto3|migrate.*to/i.test(allMessages)) {
            refactorScore += 2;
            evidence.push('非推奨削除/移行');
        }

        // === 判定ロジック ===
        
        const maxScore = Math.max(bugFixScore, featureScore, refactorScore);
        
        // バグ修正判定の閾値: スコア3以上
        if (bugFixScore >= 3 && bugFixScore === maxScore) {
            return {
                isBugFix: true,
                confidence: Math.min(bugFixScore / 10, 0.95),
                reasoning: `バグ修正スコア: ${bugFixScore} > 機能: ${featureScore}, リファクタ: ${refactorScore}`,
                evidence,
                category: 'BUG_FIX'
            };
        }

        // 機能追加判定
        if (featureScore === maxScore && featureScore > bugFixScore) {
            return {
                isBugFix: false,
                confidence: Math.min(featureScore / 10, 0.85),
                reasoning: `機能追加スコア: ${featureScore} > バグ: ${bugFixScore}, リファクタ: ${refactorScore}`,
                evidence,
                category: 'FEATURE'
            };
        }

        // リファクタリング判定
        if (refactorScore === maxScore && refactorScore > bugFixScore) {
            return {
                isBugFix: false,
                confidence: Math.min(refactorScore / 10, 0.80),
                reasoning: `リファクタリングスコア: ${refactorScore} > バグ: ${bugFixScore}, 機能: ${featureScore}`,
                evidence,
                category: 'REFACTORING'
            };
        }

        // 判定不能
        return {
            isBugFix: false,
            confidence: 0.3,
            reasoning: `判定不能（バグ: ${bugFixScore}, 機能: ${featureScore}, リファクタ: ${refactorScore}）`,
            evidence: evidence.length > 0 ? evidence : ['明確な証拠なし'],
            category: 'UNCLEAR'
        };
    }
}
