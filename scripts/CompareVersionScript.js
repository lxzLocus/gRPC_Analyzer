#!/usr/bin/env node

/**
 * バージョン間比較スクリプト
 * 
 * 2つのコミット間でSinglePR処理を実行し、出力を比較する
 * 
 * 使用例:
 *   node scripts/CompareVersionScript.js <commit-hash-1> <commit-hash-2>
 *   node scripts/CompareVersionScript.js abc1234 HEAD
 *   node scripts/CompareVersionScript.js v1.0.0 master
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * PR設定（SinglePRScript.jsと同じ形式）
 */
const TARGET_PR_CONFIG = {
    datasetDir: "/app/dataset/filtered_fewChanged",
    repositoryName: "example_repo",
    category: "example_category",
    pullRequestTitle: "Pull_XXXXX",
};

/**
 * コマンドライン引数チェック
 */
if (process.argv.length < 4) {
    console.error('❌ Usage: node CompareVersionScript.js <commit-1> <commit-2>');
    console.error('   Example: node CompareVersionScript.js abc1234 HEAD');
    process.exit(1);
}

const commit1 = process.argv[2];
const commit2 = process.argv[3];

/**
 * コマンド実行ヘルパー
 */
function run(command, description) {
    console.log(`\n🔧 ${description}...`);
    console.log(`   Command: ${command}`);
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(`❌ Failed: ${description}`);
        throw error;
    }
}

/**
 * バージョン実行関数
 */
async function runVersion(commitHash, outputSuffix) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Processing Version: ${commitHash}`);
    console.log(`${'='.repeat(60)}`);
    
    // チェックアウト
    run(`git checkout ${commitHash}`, `Checkout ${commitHash}`);
    
    // ビルド
    run('npm run build', 'Build TypeScript');
    
    // SinglePRScriptを動的に読み込んで実行
    const outputDir = `/app/output/compare_${outputSuffix}`;
    
    // 一時的な実行スクリプトを作成
    const tempScript = `/tmp/temp_single_pr_${outputSuffix}.js`;
    const scriptContent = `
import path from 'path';

const TARGET_PR_CONFIG = {
    datasetDir: "${TARGET_PR_CONFIG.datasetDir}",
    repositoryName: "${TARGET_PR_CONFIG.repositoryName}",
    category: "${TARGET_PR_CONFIG.category}",
    pullRequestTitle: "${TARGET_PR_CONFIG.pullRequestTitle}",
    outputDir: "${outputDir}"
};

const PROCESSING_OPTIONS = {
    baseOutputDir: TARGET_PR_CONFIG.outputDir,
    maxRetries: 3,
    memoryCleanupInterval: 5,
    timeoutMs: 15 * 60 * 1000,
    enableGarbageCollection: true,
    enablePreVerification: false,
    targetPullRequest: {
        repositoryName: TARGET_PR_CONFIG.repositoryName,
        category: TARGET_PR_CONFIG.category,
        pullRequestTitle: TARGET_PR_CONFIG.pullRequestTitle
    }
};

async function main() {
    console.log('🎯 Version Comparison Mode: ${outputSuffix}');
    console.log('Output Directory: ${outputDir}');
    
    const controllerModule = await import('/app/dist/js/Controller/Controller.js');
    const { datasetLoop } = controllerModule;
    
    await datasetLoop(
        TARGET_PR_CONFIG.datasetDir,
        PROCESSING_OPTIONS
    );
}

main().catch(console.error);
`;
    
    fs.writeFileSync(tempScript, scriptContent);
    
    try {
        // 実行
        run(`node ${tempScript}`, `Execute ${commitHash}`);
    } finally {
        // 一時ファイル削除
        fs.unlinkSync(tempScript);
    }
    
    console.log(`✅ Version ${commitHash} completed`);
    console.log(`   Output: ${outputDir}`);
}

/**
 * メイン実行
 */
async function main() {
    console.log('🔬 Version Comparison Tool');
    console.log('========================================');
    console.log(`📦 Target PR: ${TARGET_PR_CONFIG.repositoryName}/${TARGET_PR_CONFIG.category}/${TARGET_PR_CONFIG.pullRequestTitle}`);
    console.log(`🔀 Commit 1: ${commit1}`);
    console.log(`🔀 Commit 2: ${commit2}`);
    
    // 現在のブランチを保存
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    console.log(`💾 Current branch: ${currentBranch} (will restore later)`);
    
    try {
        // バージョン1を実行
        await runVersion(commit1, 'v1');
        
        // バージョン2を実行
        await runVersion(commit2, 'v2');
        
        // 比較
        console.log(`\n${'='.repeat(60)}`);
        console.log('📈 Comparison Results');
        console.log(`${'='.repeat(60)}`);
        
        const output1 = '/app/output/compare_v1';
        const output2 = '/app/output/compare_v2';
        
        console.log(`\n📂 Version 1 (${commit1}) outputs:`);
        run(`ls -lh ${output1}`, 'List v1 files');
        
        console.log(`\n📂 Version 2 (${commit2}) outputs:`);
        run(`ls -lh ${output2}`, 'List v2 files');
        
        console.log(`\n🔍 Diff summary:`);
        try {
            run(`diff -r ${output1} ${output2}`, 'Compare directories');
        } catch (error) {
            console.log('   (Differences found - see above)');
        }
        
        console.log(`\n✅ Comparison completed!`);
        console.log(`   Version 1 output: ${output1}`);
        console.log(`   Version 2 output: ${output2}`);
        console.log(`\n💡 To analyze differences:`);
        console.log(`   diff ${output1}/processing_summary_*.json ${output2}/processing_summary_*.json`);
        console.log(`   diff ${output1}/error_report_*.json ${output2}/error_report_*.json`);
        
    } finally {
        // 元のブランチに戻す
        console.log(`\n🔙 Restoring original branch: ${currentBranch}`);
        run(`git checkout ${currentBranch}`, 'Restore branch');
        run('npm run build', 'Rebuild current version');
    }
}

main().catch((error) => {
    console.error('❌ Comparison failed:', error);
    process.exit(1);
});
