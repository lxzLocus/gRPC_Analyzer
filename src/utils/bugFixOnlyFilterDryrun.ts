/**
 * Bug Fix Only Filter Dry-run
 * より厳格な基準でバグ修正のみを抽出
 */

import { dryRunCommitMessageFilter, printAnalysisSummary, PRCommitAnalysis } from './commitMessageFilter.js';
import { CommitMessageBugFixClassifier, BugFixClassification } from './commitMessageBugFixClassifier.js';

async function main() {
    console.log('🚀 Starting Bug Fix Only Filter Dry-run...\n');
    console.log('このツールは厳格な基準でバグ修正のみを抽出します:');
    console.log('  ✅ fix/bug/error キーワード');
    console.log('  ✅ セキュリティ修正');
    console.log('  ✅ クラッシュ/エラー防止');
    console.log('  ❌ 単純なissue参照のみは除外');
    console.log('  ❌ 機能追加・リファクタリングは除外\n');

    const maxPRs = parseInt(process.argv[2] || '50', 10);
    console.log(`検証するPR数: ${maxPRs}\n`);

    try {
        const results = await dryRunCommitMessageFilter('/app/dataset/filtered_fewChanged', maxPRs);
        
        // 各PRに対してバグ修正判定を実施
        const classified = results.map(pr => {
            const classification = CommitMessageBugFixClassifier.classify(pr.commits, pr.prName);
            return {
                ...pr,
                classification
            };
        });

        // 統計情報
        const bugFixes = classified.filter(pr => pr.classification.isBugFix);
        const features = classified.filter(pr => pr.classification.category === 'FEATURE');
        const refactorings = classified.filter(pr => pr.classification.category === 'REFACTORING');
        const unclear = classified.filter(pr => pr.classification.category === 'UNCLEAR');

        console.log('\n' + '='.repeat(80));
        console.log('📊 Bug Fix Classification Results');
        console.log('='.repeat(80));
        console.log(`\nTotal PRs analyzed: ${classified.length}`);
        console.log(`  🐛 Bug Fixes: ${bugFixes.length} (${(bugFixes.length / classified.length * 100).toFixed(1)}%)`);
        console.log(`  ✨ Features: ${features.length} (${(features.length / classified.length * 100).toFixed(1)}%)`);
        console.log(`  🔧 Refactorings: ${refactorings.length} (${(refactorings.length / classified.length * 100).toFixed(1)}%)`);
        console.log(`  ❓ Unclear: ${unclear.length} (${(unclear.length / classified.length * 100).toFixed(1)}%)`);

        // バグ修正のみ表示
        console.log('\n' + '='.repeat(80));
        console.log('🐛 Bug Fix PRs (詳細)');
        console.log('='.repeat(80));
        bugFixes.forEach(pr => {
            console.log(`\n${pr.projectName}/${pr.prName}`);
            console.log(`  Confidence: ${(pr.classification.confidence * 100).toFixed(0)}%`);
            console.log(`  Reasoning: ${pr.classification.reasoning}`);
            console.log(`  Evidence:`);
            pr.classification.evidence.forEach(ev => console.log(`    • ${ev}`));
        });

        // 機能追加の例
        console.log('\n' + '='.repeat(80));
        console.log('✨ Feature Addition Examples (機能追加の例)');
        console.log('='.repeat(80));
        features.slice(0, 5).forEach(pr => {
            console.log(`\n${pr.projectName}/${pr.prName}`);
            console.log(`  ${pr.classification.reasoning}`);
        });

        // リファクタリングの例
        console.log('\n' + '='.repeat(80));
        console.log('🔧 Refactoring Examples (リファクタリングの例)');
        console.log('='.repeat(80));
        refactorings.slice(0, 5).forEach(pr => {
            console.log(`\n${pr.projectName}/${pr.prName}`);
            console.log(`  ${pr.classification.reasoning}`);
        });

        // 詳細結果をJSON保存
        const outputPath = '/app/output/bug_fix_only_filter_results.json';
        const fs = await import('fs/promises');
        await fs.writeFile(outputPath, JSON.stringify(classified, null, 2));
        console.log(`\n✅ 詳細結果を保存: ${outputPath}`);

        // 次のステップ
        console.log('\n' + '='.repeat(80));
        console.log('📈 Next Steps:');
        console.log('='.repeat(80));
        console.log(`1. バグ修正 ${bugFixes.length}件 をfiltered_bugsにコピー`);
        console.log(`2. APR評価データと照合して精度を検証`);
        console.log(`3. datasetFilterClassifier.tsに統合`);
        console.log(`4. 全データセット（filtered_fewChanged全体）に適用`);

    } catch (error) {
        console.error('❌ Error during dry-run:', error);
        process.exit(1);
    }
}

main();
