#!/usr/bin/env node
/**
 * キーワード検出23件全てを filtered_fewChanged から incorrect_few へコピー
 * 既存のものはスキップし、不足分のみを追加コピー
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('🐛 キーワード検出バグ修正PR (23件) 完全コピーツール');
console.log('='.repeat(70));
console.log();

// 1. キーワード検出結果を読み込み
const resultsFile = '/app/output/bug_fix_with_merge_results.json';
console.log(`📂 キーワード検出結果読み込み: ${resultsFile}`);

const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
const bugFixes = results.filter(pr => pr.hasBugFixSignals);

console.log(`  ✅ キーワード検出バグ修正: ${bugFixes.length}件`);
console.log();

// 2. 既存のコピー済みPRを確認
const outputDir = '/app/dataset/incorrect_few';
console.log('📋 既存のコピー済みPRを確認中...');

const existingPRs = new Set();

function scanExisting(dir) {
    if (!fs.existsSync(dir)) {
        return;
    }
    
    const projects = fs.readdirSync(dir);
    for (const project of projects) {
        const projectPath = path.join(dir, project);
        if (!fs.statSync(projectPath).isDirectory()) continue;
        
        const categories = fs.readdirSync(projectPath);
        for (const category of categories) {
            if (!['issue', 'pullrequest'].includes(category)) continue;
            
            const categoryPath = path.join(projectPath, category);
            if (!fs.existsSync(categoryPath)) continue;
            
            const prs = fs.readdirSync(categoryPath);
            for (const pr of prs) {
                const key = `${project}/${category}/${pr}`;
                existingPRs.add(key);
            }
        }
    }
}

scanExisting(outputDir);
console.log(`  ✅ 既存PR: ${existingPRs.size}件`);
console.log();

// 3. コピー統計
const stats = {
    total: bugFixes.length,
    existing: 0,
    copied: 0,
    sourceNotFound: 0,
    failed: 0,
    failedPRs: []
};

// 4. 各PRをチェック＆コピー
console.log('📦 コピー処理開始...');
console.log();

for (let i = 0; i < bugFixes.length; i++) {
    const pr = bugFixes[i];
    const category = pr.prPath.includes('/issue/') ? 'issue' : 'pullrequest';
    const project = pr.projectName;
    const name = pr.prName;
    
    const key = `${project}/${category}/${name}`;
    
    console.log(`[${i + 1}/${bugFixes.length}] ${key}`);
    
    // 既存チェック
    if (existingPRs.has(key)) {
        console.log(`  ⏭️  既にコピー済み - スキップ`);
        stats.existing++;
        continue;
    }
    
    try {
        const sourceDir = path.join('/app/dataset/filtered_fewChanged', project, category, name);
        const destDir = path.join(outputDir, project, category, name);
        
        // ソースの存在確認
        if (!fs.existsSync(sourceDir)) {
            console.log(`  ⚠️  送信元が見つかりません`);
            stats.sourceNotFound++;
            stats.failedPRs.push({ project, category, name, reason: 'Source not found' });
            continue;
        }
        
        // 送信先ディレクトリを作成
        fs.mkdirSync(path.dirname(destDir), { recursive: true });
        
        // コピー実行（再帰的）
        function copyRecursive(src, dest) {
            const stat = fs.statSync(src);
            
            if (stat.isDirectory()) {
                fs.mkdirSync(dest, { recursive: true });
                const files = fs.readdirSync(src);
                
                for (const file of files) {
                    copyRecursive(
                        path.join(src, file),
                        path.join(dest, file)
                    );
                }
            } else {
                fs.copyFileSync(src, dest);
            }
        }
        
        copyRecursive(sourceDir, destDir);
        console.log(`  ✅ コピー成功`);
        stats.copied++;
        
    } catch (error) {
        console.log(`  ❌ コピー失敗: ${error.message}`);
        stats.failed++;
        stats.failedPRs.push({ project, category, name, reason: error.message });
    }
}

// 5. 結果サマリー
console.log();
console.log('='.repeat(70));
console.log('✅ 処理完了');
console.log('='.repeat(70));
console.log(`対象PR数: ${stats.total}`);
console.log(`既存スキップ: ${stats.existing}`);
console.log(`新規コピー: ${stats.copied}`);
console.log(`送信元なし: ${stats.sourceNotFound}`);
console.log(`コピー失敗: ${stats.failed}`);
console.log(`最終合計: ${stats.existing + stats.copied}/${stats.total}`);
console.log('='.repeat(70));

if (stats.failedPRs.length > 0) {
    console.log();
    console.log('⚠️  失敗したPR:');
    stats.failedPRs.forEach(pr => {
        console.log(`   - ${pr.project}/${pr.category}/${pr.name}: ${pr.reason}`);
    });
}

// 6. 統計を保存
const statsFile = '/app/output/copy_keyword_bugs_stats.json';
fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2), 'utf-8');
console.log();
console.log(`📊 統計ファイル: ${statsFile}`);
