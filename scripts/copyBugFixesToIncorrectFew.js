#!/usr/bin/env node
/**
 * キーワード検出バグ修正PRを raw_cloned から incorrect_few へコピー
 * 同期的にコピー（Node.js標準のfs使用）
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('🐛 バグ修正PRコピーツール - raw_cloned → incorrect_few');
console.log('='.repeat(70));
console.log();

// 1. キーワード検出結果を読み込み
const resultsFile = '/app/output/bug_fix_with_merge_results.json';
console.log(`📂 キーワード検出結果読み込み: ${resultsFile}`);

if (!fs.existsSync(resultsFile)) {
    console.error('❌ 結果ファイルが見つかりません');
    process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
const bugFixes = results.filter(pr => pr.hasBugFixSignals);

console.log(`  ✅ ${bugFixes.length}/${results.length}件のバグ修正を検出`);
console.log();

// 2. コピー統計
const stats = {
    timestamp: new Date().toISOString(),
    source: '/app/dataset/raw_cloned',
    destination: '/app/dataset/incorrect_few',
    totalBugFixes: bugFixes.length,
    copiedSuccessfully: 0,
    sourceNotFound: 0,
    copyFailed: 0,
    failedPRs: []
};

// 3. 出力ディレクトリをクリア
const outputDir = '/app/dataset/incorrect_few';
console.log('🗑️  出力ディレクトリをクリア中...');

function removeDir(dir) {
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(file => {
            const curPath = path.join(dir, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                removeDir(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(dir);
    }
}

try {
    removeDir(outputDir);
} catch (error) {
    console.log(`  ⚠️  クリア時の警告: ${error.message}`);
}

fs.mkdirSync(outputDir, { recursive: true });
console.log();

// 4. 各PRをコピー
console.log('📦 コピー開始...');
console.log();

for (let i = 0; i < bugFixes.length; i++) {
    const pr = bugFixes[i];
    const category = pr.prPath.includes('/issue/') ? 'issue' : 'pullrequest';
    const project = pr.projectName;
    const name = pr.prName;
    
    console.log(`[${i + 1}/${bugFixes.length}] ${project}/${category}/${name}`);
    
    try {
        const sourceDir = path.join('/app/dataset/raw_cloned', project, category, name);
        const destDir = path.join(outputDir, project, category, name);
        
        // ソースの存在確認
        if (!fs.existsSync(sourceDir)) {
            console.log(`  ⚠️  送信元が見つかりません`);
            stats.sourceNotFound++;
            stats.failedPRs.push({
                project,
                category,
                name,
                reason: 'Source not found'
            });
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
        stats.copiedSuccessfully++;
        
    } catch (error) {
        console.log(`  ❌ コピー失敗: ${error.message}`);
        stats.copyFailed++;
        stats.failedPRs.push({
            project,
            category,
            name,
            reason: error.message
        });
    }
}

// 5. 結果サマリー
console.log();
console.log('='.repeat(70));
console.log('✅ 処理完了');
console.log('='.repeat(70));
console.log(`対象PR数: ${stats.totalBugFixes}`);
console.log(`コピー成功: ${stats.copiedSuccessfully}`);
console.log(`送信元なし: ${stats.sourceNotFound}`);
console.log(`コピー失敗: ${stats.copyFailed}`);
console.log(`出力先: ${stats.destination}`);
console.log('='.repeat(70));

// 6. 統計を保存
const statsFile = '/app/output/copy_bug_fixes_stats.json';
fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2), 'utf-8');
console.log();
console.log(`📊 統計ファイル: ${statsFile}`);
