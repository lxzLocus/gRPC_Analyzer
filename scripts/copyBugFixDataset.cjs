#!/usr/bin/env node
/**
 * バグ修正データセットコピースクリプト
 * filtered_fewChanged から filtered_bugs へバグ修正のみをコピー
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 設定
const SOURCE_DIR = '/app/dataset/filtered_fewChanged';
const TARGET_DIR = '/app/dataset/filtered_bugs';
const BUG_FIX_JSON = '/app/output/bug_fix_only_JST_2025-12-07T16-32-48-587+09-00.json';

console.log('🐛 バグ修正データセットコピーツール');
console.log('━'.repeat(80));

// 1. バグ修正リスト読み込み
console.log('\n📂 バグ修正リスト読み込み...');
const bugFixData = JSON.parse(fs.readFileSync(BUG_FIX_JSON, 'utf-8'));
console.log(`  ✅ ${bugFixData.metadata.totalBugFixes}件のバグ修正を読み込み`);

// 2. プロジェクト・PR情報の整理
const prsByProject = {};
bugFixData.bugFixes.forEach(fix => {
    if (!prsByProject[fix.project]) {
        prsByProject[fix.project] = [];
    }
    prsByProject[fix.project].push(fix.pullRequestName);
});

console.log('\n📊 プロジェクト別内訳:');
Object.entries(prsByProject).sort((a, b) => b[1].length - a[1].length).forEach(([proj, prs]) => {
    console.log(`  ${proj.padEnd(20)} ${prs.length}件`);
});

// 3. ターゲットディレクトリの準備
console.log(`\n📁 ターゲットディレクトリ準備: ${TARGET_DIR}`);
if (fs.existsSync(TARGET_DIR)) {
    console.log('  ℹ️  既存のディレクトリが存在します（スキップして続行）');
} else {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    console.log('  ✅ ディレクトリを作成');
}

// 4. コピー処理
console.log('\n📦 バグ修正PRをコピー中...');
let successCount = 0;
let failCount = 0;
const failedPRs = [];

for (const [project, prList] of Object.entries(prsByProject)) {
    console.log(`\n  [${project}] ${prList.length}件を処理中...`);
    
    // プロジェクトディレクトリを作成
    const projectTargetDir = path.join(TARGET_DIR, project);
    fs.mkdirSync(projectTargetDir, { recursive: true });
    
    for (const prName of prList) {
        try {
            // ソースディレクトリを探索
            const projectSourceDir = path.join(SOURCE_DIR, project);
            
            // issue/pullrequest サブディレクトリを探索
            const subDirs = fs.readdirSync(projectSourceDir);
            let found = false;
            
            for (const subDir of subDirs) {
                const subDirPath = path.join(projectSourceDir, subDir);
                if (!fs.statSync(subDirPath).isDirectory()) continue;
                
                const prPath = path.join(subDirPath, prName);
                if (fs.existsSync(prPath)) {
                    // PRディレクトリをコピー
                    const targetSubDir = path.join(projectTargetDir, subDir);
                    fs.mkdirSync(targetSubDir, { recursive: true });
                    
                    const targetPrPath = path.join(targetSubDir, prName);
                    
                    // cp -r でコピー
                    execSync(`cp -r "${prPath}" "${targetPrPath}"`, { stdio: 'pipe' });
                    
                    successCount++;
                    found = true;
                    process.stdout.write(`    ✓ ${prName}\n`);
                    break;
                }
            }
            
            if (!found) {
                failCount++;
                failedPRs.push({ project, prName });
                process.stdout.write(`    ✗ ${prName} (not found)\n`);
            }
            
        } catch (error) {
            failCount++;
            failedPRs.push({ project, prName, error: error.message });
            process.stdout.write(`    ✗ ${prName} (error: ${error.message})\n`);
        }
    }
}

// 5. 結果サマリー
console.log('\n━'.repeat(80));
console.log('✅ コピー完了\n');

console.log('📊 結果サマリー:');
console.log(`  成功: ${successCount}件`);
console.log(`  失敗: ${failCount}件`);
console.log(`  成功率: ${(successCount / (successCount + failCount) * 100).toFixed(1)}%`);

if (failedPRs.length > 0) {
    console.log('\n⚠️  失敗したPR:');
    failedPRs.forEach(({ project, prName, error }) => {
        console.log(`  - ${project}/${prName}${error ? ` (${error})` : ''}`);
    });
}

// 6. ディレクトリサイズ確認
console.log('\n💾 ディレクトリサイズ:');
try {
    const result = execSync(`du -sh ${TARGET_DIR}`, { encoding: 'utf-8' });
    console.log(`  ${result.trim()}`);
} catch (error) {
    console.log('  (サイズ取得失敗)');
}

// 7. 統計ファイル作成
const statsFile = path.join(TARGET_DIR, 'FILTERING_STATS.json');
const stats = {
    timestamp: new Date().toISOString(),
    source: SOURCE_DIR,
    bugFixJsonSource: BUG_FIX_JSON,
    totalBugFixes: bugFixData.metadata.totalBugFixes,
    copiedSuccessfully: successCount,
    copyFailed: failCount,
    confidenceDistribution: bugFixData.metadata.confidenceDistribution,
    projectDistribution: Object.fromEntries(
        Object.entries(prsByProject).map(([proj, prs]) => [proj, prs.length])
    ),
    failedPRs: failedPRs
};

fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2), 'utf-8');
console.log(`\n📄 統計ファイル作成: ${statsFile}`);

console.log('\n━'.repeat(80));
console.log('🎉 すべての処理が完了しました！');
console.log(`\nバグ修正データセット: ${TARGET_DIR}`);
