#!/bin/sh
# シンボリックリンクで高速にバグ修正データセット作成

bugFixJson="/app/output/$(ls -t /app/output/bug_fix_only_JST_*.json | head -1 | xargs basename)"

echo "🔗 バグ修正データセットリンク作成"
echo "入力: $bugFixJson"
echo ""

rm -rf /app/dataset/filtered_bugs
mkdir -p /app/dataset/filtered_bugs

node --input-type=module <<'NODESCRIPT'
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const bugFixData = JSON.parse(readFileSync(process.argv[1], 'utf-8'));
const basePath = '/app/dataset/filtered_fewChanged';
let total = 0, errors = 0;

for (const fix of bugFixData.bugFixes) {
    const prName = fix.prName;
    const project = fix.project;
    
    for (const type of ['issues', 'pullrequests']) {
        const sourcePath = `${basePath}/${project}/${type}/${prName}`;
        try {
            execSync(`test -d "${sourcePath}"`);
            const targetDir = `/app/dataset/filtered_bugs/${project}/${type}`;
            execSync(`mkdir -p "${targetDir}"`);
            execSync(`ln -s "${sourcePath}" "${targetDir}/${prName}"`);
            total++;
            process.stdout.write(`\r🔗 ${total}/${bugFixData.metadata.totalBugFixes}`);
            break;
        } catch (e) {
            errors++;
        }
    }
}

console.log(`\n\n✅ 成功: ${total}件`);
console.log(`❌ エラー: ${errors}件`);
NODESCRIPT "$bugFixJson"

echo ""
echo "📊 結果確認:"
find /app/dataset/filtered_bugs -mindepth 3 -maxdepth 3 -type l | wc -l
