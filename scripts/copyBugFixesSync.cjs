#!/usr/bin/env node
/**
 * APR評価 ∩ キーワード検出 のバグ修正PRを filtered_fewChanged から incorrect_few へコピー
 * 両方の手法で「バグ修正」と判定されたPRのみをコピー
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('🐛 バグ修正PRコピーツール - APR ∩ キーワード検出');
console.log('='.repeat(70));
console.log();

// 1. APR評価結果を読み込み
const aprFile = '/app/output/bug_fix_only_JST_2025-12-07T16-32-48-587+09-00.json';
console.log(`📂 APR評価結果読み込み: ${aprFile}`);

if (!fs.existsSync(aprFile)) {
    console.error('❌ APR評価結果ファイルが見つかりません');
    process.exit(1);
}

const aprData = JSON.parse(fs.readFileSync(aprFile, 'utf-8'));
const aprBugFixes = aprData.bugFixes;

console.log(`  ✅ APR評価: ${aprBugFixes.length}件のバグ修正`);

// 2. キーワード検出結果を読み込み
const keywordFile = '/app/output/bug_fix_with_merge_results.json';
console.log(`📂 キーワード検出結果読み込み: ${keywordFile}`);

if (!fs.existsSync(keywordFile)) {
    console.error('❌ キーワード検出結果ファイルが見つかりません');
    process.exit(1);
}

const keywordData = JSON.parse(fs.readFileSync(keywordFile, 'utf-8'));
const keywordBugFixes = keywordData.filter(pr => pr.hasBugFixSignals);

console.log(`  ✅ キーワード検出: ${keywordBugFixes.length}件のバグ修正`);

// 3. 積集合を計算
console.log();
console.log('🔍 積集合を計算中...');

// APR評価結果をSetに変換（高速検索用）
const aprSet = new Set(
    aprBugFixes.map(fix => `${fix.project}/${fix.pullRequestName}`)
);

// キーワード検出結果から、APR評価にも含まれるものだけをフィルタ
const intersection = keywordBugFixes.filter(pr => {
    const key = `${pr.projectName}/${pr.prName}`;
    return aprSet.has(key);
});

console.log(`  ✅ 積集合: ${intersection.length}件`);
console.log();

// 積集合の内訳を表示
if (intersection.length > 0) {
    console.log('📋 積集合の内訳:');
    const projectCounts = {};
    intersection.forEach(pr => {
        projectCounts[pr.projectName] = (projectCounts[pr.projectName] || 0) + 1;
    });
    Object.entries(projectCounts).forEach(([project, count]) => {
        console.log(`  ${project}: ${count}件`);
    });
    console.log();
}

const bugFixes = intersection;

// 2. コピー統計
const stats = {
    timestamp: new Date().toISOString(),
    source: '/app/dataset/filtered_fewChanged',
    destination: '/app/dataset/incorrect_few',
    aprBugFixes: aprBugFixes.length,
    keywordBugFixes: keywordBugFixes.length,
    intersection: intersection.length,
    copiedSuccessfully: 0,
    alreadyExists: 0,
    copyFailed: 0,
    failedPRs: []
};

// 3. 各PRをコピー
console.log('📦 コピー開始...\n');

for (let i = 0; i < bugFixes.length; i++) {
    const pr = bugFixes[i];
    const prName = pr.prName;
    const project = pr.projectName;
    
    console.log(`[${i + 1}/${bugFixes.length}] ${project}/${prName}`);
    
    try {
        // ソースディレクトリを探す（issue または pullrequest）
        const basePath = `/app/dataset/filtered_fewChanged/${project}`;
        let sourceDir = null;
        
        // issue ディレクトリを確認
        const issueDir = path.join(basePath, 'issue', prName);
        if (fs.existsSync(issueDir)) {
            sourceDir = issueDir;
        }
        
        // pullrequest ディレクトリを確認
        const prDir = path.join(basePath, 'pullrequest', prName);
        if (fs.existsSync(prDir)) {
            sourceDir = prDir;
        }
        
        if (!sourceDir) {
            throw new Error(`ソースディレクトリが見つかりません: ${basePath}/[issue|pullrequest]/${prName}`);
        }
        
        // ソースディレクトリの親を取得（issue or pullrequest）
        const subDir = path.basename(path.dirname(sourceDir));
        
        // 出力先ディレクトリ
        const destDir = `/app/dataset/incorrect_few/${project}/${subDir}/${prName}`;
        
        // 既に存在する場合はスキップ
        if (fs.existsSync(destDir)) {
            console.log(`  ⏭️  スキップ（既存）`);
            stats.alreadyExists++;
            continue;
        }
        
        // 親ディレクトリを作成
        const destParent = path.dirname(destDir);
        if (!fs.existsSync(destParent)) {
            fs.mkdirSync(destParent, { recursive: true });
        }
        
        // ディレクトリをコピー（Node.js 16.7.0+のfs.cpSync使用）
        fs.cpSync(sourceDir, destDir, {
            recursive: true,
            force: false,
            errorOnExist: false
        });
        
        console.log(`  ✅ コピー成功`);
        stats.copiedSuccessfully++;
        
    } catch (error) {
        console.log(`  ❌ エラー: ${error.message}`);
        stats.copyFailed++;
        stats.failedPRs.push({
            project: project,
            prName: prName,
            error: error.message
        });
    }
}

// 4. 統計を保存
const statsFile = '/app/dataset/filtered_bugs/FILTERING_STATS.json';
fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2), 'utf-8');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ コピー完了\n');
console.log('📊 統計:');
console.log(`  総バグ修正数: ${stats.totalBugFixes}件`);
console.log(`  コピー成功: ${stats.copiedSuccessfully}件`);
console.log(`  既存（スキップ）: ${stats.alreadyExists}件`);
console.log(`  コピー失敗: ${stats.copyFailed}件`);

if (stats.failedPRs.length > 0) {
    console.log('\n⚠️  失敗したPR:');
    stats.failedPRs.forEach(f => {
        console.log(`  - ${f.project}/${f.prName}`);
        console.log(`    理由: ${f.error}`);
    });
}

console.log(`\n💾 統計ファイル: ${statsFile}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
