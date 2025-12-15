/**
 * Commit Message Based Filter (Dry-run)
 * premerge → commit_snapshot間のコミットメッセージを分析してバグ修正を判定
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

export interface CommitInfo {
    hash: string;
    message: string;
    author: string;
    date: string;
}

export interface PRCommitAnalysis {
    projectName: string;
    prName: string;
    prPath: string;
    commits: CommitInfo[];
    hasBugFixSignals: boolean;
    bugFixEvidence: string[];
    reasoning: string;
}

/**
 * PR名からGitHub情報を抽出
 * 例: "ratelimits-_Exempt_renewals_from_NewOrdersPerAccount" 
 *     → issue番号や説明を解析
 */
export class PRNameParser {
    /**
     * PR名から潜在的なissue番号を抽出
     */
    static extractIssueNumbers(prName: string): number[] {
        const patterns = [
            /#(\d+)/g,              // #123形式
            /issue[-_]?(\d+)/gi,    // issue-123, issue_123形式
            /fix[-_]?(\d+)/gi,      // fix-123形式
            /\b(\d{2,5})\b/g        // 2-5桁の数字(潜在的なissue番号)
        ];

        const numbers = new Set<number>();
        for (const pattern of patterns) {
            const matches = prName.matchAll(pattern);
            for (const match of matches) {
                const num = parseInt(match[1], 10);
                if (num > 0 && num < 99999) {
                    numbers.add(num);
                }
            }
        }

        return Array.from(numbers);
    }

    /**
     * PR名からバグ修正関連キーワードを検出
     */
    static hasBugFixKeywords(prName: string): boolean {
        const bugKeywords = [
            'fix', 'fixes', 'fixed', 'fixing',
            'bug', 'bugfix', 'bug-fix',
            'issue', 'issues',
            'patch', 'patched',
            'correct', 'corrected', 'correction',
            'repair', 'repaired',
            'resolve', 'resolved', 'resolution',
            'hotfix', 'hot-fix'
        ];

        const lowerName = prName.toLowerCase();
        return bugKeywords.some(keyword => lowerName.includes(keyword));
    }
}

/**
 * ローカルGitリポジトリからコミット履歴を取得
 */
export class LocalGitCommitFetcher {
    /**
     * premerge/.gitを使ってcommit_snapshot..HEADの範囲のコミットを取得
     * @param premergePath premergeディレクトリのパス
     * @param snapshotHash commit_snapshotのハッシュ
     */
    static async getCommitsBetween(premergePath: string, snapshotHash: string): Promise<CommitInfo[]> {
        try {
            // git log でコミット情報を取得
            // フォーマット: hash|subject|body
            const cmd = `cd "${premergePath}" && git log --format="%H|%s|%b|||" ${snapshotHash}..HEAD`;
            const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

            if (!output.trim()) {
                // commit_snapshot == HEAD の場合、コミットが1つだけ
                const singleCmd = `cd "${premergePath}" && git log --format="%H|%s|%b|||" -1 ${snapshotHash}`;
                const singleOutput = execSync(singleCmd, { encoding: 'utf8' });
                
                if (!singleOutput.trim()) {
                    return [];
                }
                
                return this.parseGitLog(singleOutput);
            }

            return this.parseGitLog(output);

        } catch (error) {
            console.error(`Error fetching commits from local git: ${error}`);
            return [];
        }
    }

    /**
     * git logの出力をパース
     */
    private static parseGitLog(output: string): CommitInfo[] {
        const commits: CommitInfo[] = [];
        const entries = output.split('|||').filter(e => e.trim());

        for (const entry of entries) {
            const parts = entry.trim().split('|');
            if (parts.length >= 2) {
                const hash = parts[0].trim();
                const subject = parts[1].trim();
                const body = parts.slice(2).join('|').trim();

                commits.push({
                    hash,
                    message: body ? `${subject}\n\n${body}` : subject,
                    author: '', // git logでauthorも取得可能だが省略
                    date: ''
                });
            }
        }

        return commits;
    }
}

/**
 * コミットメッセージ分析器
 */
export class CommitMessageAnalyzer {
    /**
     * コミットメッセージ群からバグ修正の証拠を検出
     */
    static analyzeBugFixSignals(commits: CommitInfo[]): {
        hasBugFix: boolean;
        evidence: string[];
    } {
        const evidence: string[] = [];
        const bugKeywords = [
            'fix', 'fixes', 'fixed', 'fixing',
            'bug', 'bugfix',
            'issue', 'issues',
            'patch', 'correct', 'repair', 'resolve',
            'hotfix', 'crash', 'error', 'fault'
        ];

        const issuePattern = /#(\d+)/g;
        const partOfPattern = /part of #(\d+)/gi;

        for (const commit of commits) {
            const message = commit.message.toLowerCase();
            const shortHash = commit.hash.substring(0, 7);
            
            // issue番号参照をチェック (本文も含む)
            const issueMatches = commit.message.match(issuePattern);
            if (issueMatches && issueMatches.length > 0) {
                evidence.push(`${shortHash}: issue参照 ${issueMatches.join(', ')}`);
            }

            // "Part of #123" パターンをチェック
            const partOfMatches = commit.message.match(partOfPattern);
            if (partOfMatches && partOfMatches.length > 0) {
                evidence.push(`${shortHash}: ${partOfMatches.join(', ')}`);
            }

            // バグ修正キーワードをチェック
            const foundKeywords = bugKeywords.filter(kw => message.includes(kw));
            if (foundKeywords.length > 0) {
                evidence.push(`${shortHash}: キーワード [${foundKeywords.join(', ')}]`);
            }

            // 修正パターンをチェック
            if (/fix(es|ed|ing)?\s+(bug|issue|#\d+)/i.test(commit.message)) {
                evidence.push(`${shortHash}: 明確な修正パターン`);
            }

            // セキュリティ修正パターン
            if (/security|vulnerability|cve/i.test(commit.message)) {
                evidence.push(`${shortHash}: セキュリティ修正`);
            }

            // エラー処理追加パターン
            if (/prevent(s)?\s+(crash|panic|error)/i.test(commit.message)) {
                evidence.push(`${shortHash}: クラッシュ/エラー防止`);
            }
        }

        return {
            hasBugFix: evidence.length > 0,
            evidence
        };
    }
}

/**
 * Commit-based filtering dry-run
 */
export async function dryRunCommitMessageFilter(
    filteredFewChangedPath: string = '/app/dataset/filtered_fewChanged',
    maxPRsToCheck: number = 10
): Promise<PRCommitAnalysis[]> {
    const results: PRCommitAnalysis[] = [];

    // プロジェクトディレクトリを取得
    const projects = await fs.readdir(filteredFewChangedPath);
    
    let checkedCount = 0;

    for (const projectName of projects) {
        if (checkedCount >= maxPRsToCheck) break;

        const projectPath = path.join(filteredFewChangedPath, projectName);
        const stat = await fs.stat(projectPath);
        if (!stat.isDirectory()) continue;

        console.log(`\n=== Project: ${projectName} ===`);

        // issue/pullrequest サブディレクトリを探索
        const categories = await fs.readdir(projectPath);
        for (const category of categories) {
            if (checkedCount >= maxPRsToCheck) break;
            if (!['issue', 'pullrequest'].includes(category)) continue;

            const categoryPath = path.join(projectPath, category);
            const prs = await fs.readdir(categoryPath);

            for (const prName of prs) {
                if (checkedCount >= maxPRsToCheck) break;

                const prPath = path.join(categoryPath, prName);
                const prStat = await fs.stat(prPath);
                if (!prStat.isDirectory()) continue;

                console.log(`  Processing: ${category}/${prName}`);

                // premergeとcommit_snapshotを探す
                const prContents = await fs.readdir(prPath);
                const premergeDir = prContents.find(d => d.startsWith('premerge'));
                const snapshotDir = prContents.find(d => d.startsWith('commit_snapshot_'));

                if (!premergeDir || !snapshotDir) {
                    console.log(`    ⚠️  premerge or snapshot not found, skipping`);
                    continue;
                }

                // commit_snapshot_からハッシュを抽出
                const commitHash = snapshotDir.replace('commit_snapshot_', '');
                console.log(`    📌 Snapshot commit: ${commitHash}`);

                // PR名からissue番号を抽出
                const issueNumbers = PRNameParser.extractIssueNumbers(prName);
                const hasBugKeywords = PRNameParser.hasBugFixKeywords(prName);

                console.log(`    🔍 Issue numbers in PR name: ${issueNumbers.join(', ') || 'None'}`);
                console.log(`    🔍 Bug keywords in PR name: ${hasBugKeywords}`);

                // premerge/.gitからコミットメッセージを取得
                const premergePath = path.join(prPath, premergeDir);
                const commits = await LocalGitCommitFetcher.getCommitsBetween(premergePath, commitHash);
                
                console.log(`    📜 Commits found: ${commits.length}`);
                
                // コミットメッセージを分析
                const commitAnalysis = CommitMessageAnalyzer.analyzeBugFixSignals(commits);
                
                // 統合判定: PR名 OR コミットメッセージにバグ修正の証拠がある
                const allEvidence: string[] = [
                    ...(issueNumbers.length > 0 ? [`PR名にissue番号: ${issueNumbers.join(', ')}`] : []),
                    ...(hasBugKeywords ? ['PR名にバグ修正キーワード検出'] : []),
                    ...commitAnalysis.evidence
                ];

                const analysis: PRCommitAnalysis = {
                    projectName,
                    prName,
                    prPath,
                    commits,
                    hasBugFixSignals: hasBugKeywords || issueNumbers.length > 0 || commitAnalysis.hasBugFix,
                    bugFixEvidence: allEvidence,
                    reasoning: allEvidence.length > 0 
                        ? `バグ修正の証拠: ${allEvidence.length}件検出`
                        : 'バグ修正の証拠なし（機能追加またはリファクタリングの可能性）'
                };

                results.push(analysis);
                checkedCount++;
            }
        }
    }

    return results;
}

/**
 * 結果をサマリー表示
 */
export function printAnalysisSummary(results: PRCommitAnalysis[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 Commit Message Filter Analysis Summary');
    console.log('='.repeat(80));

    const bugFixCount = results.filter(r => r.hasBugFixSignals).length;
    const noBugFixCount = results.length - bugFixCount;

    console.log(`\nTotal PRs analyzed: ${results.length}`);
    console.log(`  ✅ Bug fix signals detected: ${bugFixCount} (${(bugFixCount / results.length * 100).toFixed(1)}%)`);
    console.log(`  ❌ No bug fix signals: ${noBugFixCount} (${(noBugFixCount / results.length * 100).toFixed(1)}%)`);

    console.log('\n--- Bug Fix PRs ---');
    results
        .filter(r => r.hasBugFixSignals)
        .forEach(r => {
            console.log(`\n${r.projectName}/${r.prName}`);
            r.bugFixEvidence.forEach(ev => console.log(`  • ${ev}`));
        });

    console.log('\n--- Non-Bug Fix PRs ---');
    results
        .filter(r => !r.hasBugFixSignals)
        .forEach(r => {
            console.log(`  ${r.projectName}/${r.prName}`);
        });
}
