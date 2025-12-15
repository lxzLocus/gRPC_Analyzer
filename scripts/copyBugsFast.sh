#!/bin/sh
# 簡易バグ修正データセットコピー（vendorディレクトリ除外版）

echo "🐛 バグ修正データセットコピー（高速版）"
echo ""

# ターゲットディレクトリ作成
mkdir -p /app/dataset/filtered_bugs

# バグ修正JSONから情報を取得してコピー
node << 'NODESCRIPT'
const fs = require('fs');
const { execSync } = require('child_process');

const bugFixData = JSON.parse(fs.readFileSync('/app/output/bug_fix_only_JST_2025-12-07T16-32-48-587+09-00.json', 'utf-8'));
const SOURCE_DIR = '/app/dataset/filtered_fewChanged';
const TARGET_DIR = '/app/dataset/filtered_bugs';

let total = 0;
let errors = 0;

console.log(`総数: ${bugFixData.metadata.totalBugFixes}件\n`);

for (const fix of bugFixData.bugFixes) {
    const project = fix.project;
    const prName = fix.pullRequestName;
    
    // ソースパスを探索
    const projectPath = `${SOURCE_DIR}/${project}`;
    const subDirs = fs.readdirSync(projectPath);
    
    let found = false;
    for (const subDir of subDirs) {
        const sourcePath = `${projectPath}/${subDir}/${prName}`;
        if (fs.existsSync(sourcePath)) {
            const targetPath = `${TARGET_DIR}/${project}/${subDir}/${prName}`;
            execSync(`mkdir -p "${TARGET_DIR}/${project}/${subDir}"`);
            
            try {
                // tar + pipe で vendor除外してコピー
                execSync(`mkdir -p "${targetPath}"`);
                execSync(`(cd "${sourcePath}" && tar cf - --exclude=vendor --exclude=node_modules --exclude=.git .) | (cd "${targetPath}" && tar xf -)`);
                total++;
                process.stdout.write(`\r✅ ${total}/${bugFixData.metadata.totalBugFixes}`);
                found = true;
                break;
            } catch (e) {
                errors++;
            }
        }
    }
    
    if (!found) errors++;
}

console.log(`\n\n成功: ${total}件, エラー: ${errors}件`);
NODESCRIPT

echo ""
echo "✅ 完了"
echo ""
echo "📊 結果:"
find /app/dataset/filtered_bugs -mindepth 3 -maxdepth 3 -type d | wc -l
echo "件のPRをコピー"
