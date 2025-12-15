/**
 * Commit Message Filter with Merge commits
 * filtered_fewChangedに含まれるPRのみを対象に、raw_clonedのmergeディレクトリからコミットを取得
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { CommitInfo } from './commitMessageFilter.js';
import { CommitMessageBugFixClassifier, BugFixClassification } from './commitMessageBugFixClassifier.js';

export interface PRCommitAnalysisWithMerge {
    projectName: string;
    prName: string;
    prPath: string;
    commits: CommitInfo[];
    hasBugFixSignals: boolean;
    bugFixEvidence: string[];
    reasoning: string;
    classification: BugFixClassification;
}

/**
 * raw_clonedからpremerge HEAD → merge HEADの差分コミットを取得
 */
export class MergeCommitFetcher {
    /**
     * premerge HEADからmerge HEADまでの差分コミットを取得
     * @param rawPrPath raw_clonedのPRディレクトリパス（premerge_XXXとmerge_XXXを含む）
     */
    static async getCommitsFromPremergeToMerge(rawPrPath: string): Promise<CommitInfo[]> {
        try {
            const contents = await fs.readdir(rawPrPath);
            const premergeDir = contents.find(d => d.startsWith('premerge_'));
            const mergeDir = contents.find(d => d.startsWith('merge_'));

            if (!premergeDir || !mergeDir) {
                console.log(`    ⚠️  premerge or merge directory not found`);
                return [];
            }

            const premergePath = path.join(rawPrPath, premergeDir);
            const mergePath = path.join(rawPrPath, mergeDir);

            // premerge HEADを取得
            const premergeHeadCmd = `cd "${premergePath}" && git rev-parse HEAD`;
            const premergeHead = execSync(premergeHeadCmd, { encoding: 'utf8' }).trim();

            // merge HEADを取得
            const mergeHeadCmd = `cd "${mergePath}" && git rev-parse HEAD`;
            const mergeHead = execSync(mergeHeadCmd, { encoding: 'utf8' }).trim();

            console.log(`    🔍 premerge HEAD: ${premergeHead.substring(0, 7)}, merge HEAD: ${mergeHead.substring(0, 7)}`);

            // merge側のリポジトリでpremerge..mergeの差分を取得
            const cmd = `cd "${mergePath}" && git log --format="%H|%s|%b|||" ${premergeHead}..${mergeHead}`;
            const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

            if (!output.trim()) {
                // 差分がない場合（premerge HEAD == merge HEAD）
                console.log(`    ℹ️  premerge and merge are the same (no additional commits)`);
                return [];
            }

            const commits = this.parseGitLog(output);
            console.log(`    ✅ Found ${commits.length} commit(s) between premerge and merge`);
            
            return commits;

        } catch (error) {
            console.error(`    ❌ Error fetching commits: ${error}`);
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
                    author: '',
                    date: ''
                });
            }
        }

        return commits;
    }
}

/**
 * filtered_fewChangedのPRリストを取得し、raw_clonedからmergeコミットを含めて分析
 */
export async function dryRunWithMergeCommits(
    filteredFewChangedPath: string = '/app/dataset/filtered_fewChanged',
    rawClonedPath: string = '/app/dataset/raw_cloned',
    maxPRsToCheck: number = 86
): Promise<PRCommitAnalysisWithMerge[]> {
    const results: PRCommitAnalysisWithMerge[] = [];

    // filtered_fewChangedからPRリストを取得
    const projects = await fs.readdir(filteredFewChangedPath);
    
    let checkedCount = 0;

    for (const projectName of projects) {
        if (checkedCount >= maxPRsToCheck) break;

        const filteredProjectPath = path.join(filteredFewChangedPath, projectName);
        const stat = await fs.stat(filteredProjectPath);
        if (!stat.isDirectory()) continue;

        console.log(`\n=== Project: ${projectName} ===`);

        // issue/pullrequest サブディレクトリを探索
        const categories = await fs.readdir(filteredProjectPath);
        for (const category of categories) {
            if (checkedCount >= maxPRsToCheck) break;
            if (!['issue', 'pullrequest'].includes(category)) continue;

            const categoryPath = path.join(filteredProjectPath, category);
            const prs = await fs.readdir(categoryPath);

            for (const prName of prs) {
                if (checkedCount >= maxPRsToCheck) break;

                const filteredPrPath = path.join(categoryPath, prName);
                const prStat = await fs.stat(filteredPrPath);
                if (!prStat.isDirectory()) continue;

                console.log(`  Processing: ${category}/${prName}`);

                // filtered_fewChangedからcommit_snapshotハッシュを取得
                const prContents = await fs.readdir(filteredPrPath);
                const snapshotDir = prContents.find(d => d.startsWith('commit_snapshot_'));

                if (!snapshotDir) {
                    console.log(`    ⚠️  commit_snapshot not found, skipping`);
                    continue;
                }

                const commitHash = snapshotDir.replace('commit_snapshot_', '');
                console.log(`    📌 Snapshot commit: ${commitHash}`);

                // raw_clonedの対応するPRディレクトリを探す
                const rawProjectPath = path.join(rawClonedPath, projectName, category);
                
                let rawPrPath: string | null = null;
                try {
                    const rawPrs = await fs.readdir(rawProjectPath);
                    const matchingPr = rawPrs.find(p => p === prName);
                    if (matchingPr) {
                        rawPrPath = path.join(rawProjectPath, matchingPr);
                    }
                } catch (error) {
                    console.log(`    ⚠️  raw_cloned directory not found for ${projectName}/${category}`);
                }

                if (!rawPrPath) {
                    console.log(`    ⚠️  PR not found in raw_cloned, skipping`);
                    continue;
                }

                // raw_clonedからpremerge HEAD → merge HEADの差分コミットを取得
                const commits = await MergeCommitFetcher.getCommitsFromPremergeToMerge(rawPrPath);
                
                console.log(`    📜 Commits found (premerge→merge diff): ${commits.length}`);
                
                // コミットメッセージを分類
                const classification = CommitMessageBugFixClassifier.classify(commits, prName);

                const analysis: PRCommitAnalysisWithMerge = {
                    projectName,
                    prName,
                    prPath: filteredPrPath,
                    commits,
                    hasBugFixSignals: classification.isBugFix,
                    bugFixEvidence: classification.evidence,
                    reasoning: classification.reasoning,
                    classification
                };

                results.push(analysis);
                checkedCount++;
            }
        }
    }

    return results;
}

/**
 * Main execution
 */
async function main() {
    console.log('🚀 Starting Bug Fix Filter with Merge Commits Dry-run...\n');
    console.log('【重要】filtered_fewChangedのPRを対象に、raw_clonedのpremerge→merge全体のコミットを参照します');
    console.log('  - filtered_fewChanged: commit_snapshotまで（一部のコミット）');
    console.log('  - raw_cloned: premerge→merge全体（PR全コミット）\n');

    const maxPRs = parseInt(process.argv[2] || '86', 10);
    console.log(`検証するPR数: ${maxPRs}\n`);

    try {
        const results = await dryRunWithMergeCommits(
            '/app/dataset/filtered_fewChanged',
            '/app/dataset/raw_cloned',
            maxPRs
        );

        // 統計情報
        const bugFixes = results.filter(pr => pr.classification?.isBugFix);
        const features = results.filter(pr => pr.classification?.category === 'FEATURE');
        const refactorings = results.filter(pr => pr.classification?.category === 'REFACTORING');
        const unclear = results.filter(pr => pr.classification?.category === 'UNCLEAR');

        console.log('\n' + '='.repeat(80));
        console.log('📊 Bug Fix Classification Results (with Merge Commits)');
        console.log('='.repeat(80));
        console.log(`\nTotal PRs analyzed: ${results.length}`);
        console.log(`  🐛 Bug Fixes: ${bugFixes.length} (${(bugFixes.length / results.length * 100).toFixed(1)}%)`);
        console.log(`  ✨ Features: ${features.length} (${(features.length / results.length * 100).toFixed(1)}%)`);
        console.log(`  🔧 Refactorings: ${refactorings.length} (${(refactorings.length / results.length * 100).toFixed(1)}%)`);
        console.log(`  ❓ Unclear: ${unclear.length} (${(unclear.length / results.length * 100).toFixed(1)}%)`);

        // バグ修正のみ表示
        console.log('\n' + '='.repeat(80));
        console.log('🐛 Bug Fix PRs (詳細)');
        console.log('='.repeat(80) + '\n');

        for (const pr of bugFixes) {
            console.log(`${pr.projectName}/${pr.prName}`);
            console.log(`  Confidence: ${Math.round((pr.classification?.confidence || 0) * 100)}%`);
            console.log(`  Reasoning: ${pr.classification?.reasoning}`);
            console.log(`  Evidence:`);
            for (const evidence of pr.classification?.evidence || []) {
                console.log(`    • ${evidence}`);
            }
            console.log('');
        }

        // Feature追加の例を表示
        if (features.length > 0) {
            console.log('='.repeat(80));
            console.log('✨ Feature Addition Examples (機能追加の例)');
            console.log('='.repeat(80) + '\n');

            for (const pr of features.slice(0, 5)) {
                console.log(`${pr.projectName}/${pr.prName}`);
                console.log(`  機能追加スコア: ${pr.classification?.reasoning}\n`);
            }
        }

        // Refactoringの例を表示
        if (refactorings.length > 0) {
            console.log('='.repeat(80));
            console.log('🔧 Refactoring Examples (リファクタリングの例)');
            console.log('='.repeat(80) + '\n');

            for (const pr of refactorings.slice(0, 5)) {
                console.log(`${pr.projectName}/${pr.prName}`);
                console.log(`  リファクタリングスコア: ${pr.classification?.reasoning}\n`);
            }
        }

        // 結果をJSON保存
        const outputPath = '/app/output/bug_fix_with_merge_results.json';
        await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
        console.log(`✅ 詳細結果を保存: ${outputPath}`);

        console.log('\n' + '='.repeat(80));
        console.log('📈 Comparison with commit_snapshot approach:');
        console.log('='.repeat(80));
        console.log('1. premerge→commit_snapshot (一部): 23件検出 (26.7%)');
        console.log(`2. premerge→merge (全体・今回):      ${bugFixes.length}件検出 (${(bugFixes.length / results.length * 100).toFixed(1)}%)`);
        console.log(`   増加数: ${bugFixes.length - 23}件 (${bugFixes.length > 23 ? '+' : ''}${((bugFixes.length - 23) / 23 * 100).toFixed(1)}%)`);
        console.log(`\n💡 PR全体のコミットを解析することで、より多くのバグ修正を検出できる可能性があります`);

    } catch (error) {
        console.error('Error during dry-run:', error);
        process.exit(1);
    }
}

main();
