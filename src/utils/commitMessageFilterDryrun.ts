/**
 * Commit Message Filter Dry-run Entry Point
 * コミットメッセージベースのフィルタリングのテスト実行
 */

import { dryRunCommitMessageFilter, printAnalysisSummary } from './commitMessageFilter.js';

async function main() {
    console.log('🚀 Starting Commit Message Filter Dry-run...\n');
    console.log('このツールは以下を検証します:');
    console.log('  1. filtered_fewChangedのPR構造を読み取れるか');
    console.log('  2. PR名からissue番号やバグ修正キーワードを抽出できるか');
    console.log('  3. commit_snapshotのハッシュを取得できるか\n');

    const maxPRs = parseInt(process.argv[2] || '10', 10);
    console.log(`検証するPR数: ${maxPRs}\n`);

    try {
        const results = await dryRunCommitMessageFilter('/app/dataset/filtered_fewChanged', maxPRs);
        
        printAnalysisSummary(results);

        // 詳細結果をJSONで保存
        const outputPath = '/app/output/commit_filter_dryrun_results.json';
        const fs = await import('fs/promises');
        await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
        console.log(`\n✅ 詳細結果を保存: ${outputPath}`);

        // 統計情報
        const bugFixCount = results.filter(r => r.hasBugFixSignals).length;
        console.log('\n' + '='.repeat(80));
        console.log('📈 Next Steps:');
        console.log('='.repeat(80));
        console.log('1. GitHub APIを使ってコミットメッセージを実際に取得する実装を追加');
        console.log('2. コミットメッセージ内のissue番号、fixキーワードをチェック');
        console.log(`3. 現在のPR名ベース分類では ${bugFixCount}/${results.length} がバグ修正候補`);
        console.log('4. datasetFilterClassifier.tsに移行する際の設計を検討');

    } catch (error) {
        console.error('❌ Error during dry-run:', error);
        process.exit(1);
    }
}

main();
