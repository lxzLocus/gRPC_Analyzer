#!/usr/bin/env node
/**
 * 即時実行版: filtered_confirmed内のProto/Stubファイル更新
 * ターミナル問題を回避して直接実行
 */

const fs = require('fs');
const path = require('path');

const TARGET_DIR = '/app/dataset/filtered_confirmed';

let totalPRs = 0;
let processedPRs = 0;
let totalFilesUpdated = 0;
const errors = [];

console.log('='.repeat(80));
console.log('🔧 Proto/Stub Update Tool (Immediate Execution)');
console.log('='.repeat(80));
console.log();

function processDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        
        if (!stat.isDirectory()) continue;
        
        const fileChangesPath = path.join(itemPath, '03_fileChanges.txt');
        if (fs.existsSync(fileChangesPath)) {
            totalPRs++;
            const relPath = itemPath.replace(TARGET_DIR + '/', '');
            console.log(`\n📦 [${totalPRs}] ${relPath}`);
            
            try {
                // 03_fileChanges.txtを読み取り
                const content = fs.readFileSync(fileChangesPath, 'utf-8');
                const files = JSON.parse(content);
                
                const protoFiles = files.filter(f => f.endsWith('.proto'));
                const stubFiles = files.filter(f => f.match(/\.pb\.(go|cc|h|java|py|rb|cs|php|js|ts)$/));
                
                if (protoFiles.length === 0 && stubFiles.length === 0) {
                    console.log(`  ℹ️  更新対象なし`);
                    continue;
                }
                
                // merge/commit_snapshotディレクトリを探す
                const subdirs = fs.readdirSync(itemPath);
                let mergeDir = subdirs.find(d => d.startsWith('merge') && fs.statSync(path.join(itemPath, d)).isDirectory());
                if (!mergeDir) {
                    mergeDir = subdirs.find(d => d.startsWith('commit_snapshot_') && fs.statSync(path.join(itemPath, d)).isDirectory());
                }
                
                if (!mergeDir) {
                    console.log(`  ⚠️  merge/commit_snapshotディレクトリが見つかりません`);
                    errors.push(`${relPath}: merge/commit_snapshot not found`);
                    continue;
                }
                
                // premergeディレクトリを探す
                const premergeDir = subdirs.find(d => d.startsWith('premerge') && fs.statSync(path.join(itemPath, d)).isDirectory());
                if (!premergeDir) {
                    console.log(`  ⚠️  premergeディレクトリが見つかりません`);
                    errors.push(`${relPath}: premerge not found`);
                    continue;
                }
                
                const mergePath = path.join(itemPath, mergeDir);
                const premergePath = path.join(itemPath, premergeDir);
                
                console.log(`  📁 ソース: ${mergeDir}`);
                console.log(`  📁 ターゲット: ${premergeDir}`);
                console.log(`  📄 Proto: ${protoFiles.length}件, Stub: ${stubFiles.length}件`);
                
                let updatedCount = 0;
                const allFiles = [...protoFiles, ...stubFiles];
                
                for (const file of allFiles) {
                    const sourcePath = path.join(mergePath, file);
                    const targetPath = path.join(premergePath, file);
                    
                    if (!fs.existsSync(sourcePath)) {
                        console.log(`    ⚠️  ソース不在: ${file}`);
                        continue;
                    }
                    
                    // ディレクトリ作成
                    const targetDir = path.dirname(targetPath);
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }
                    
                    fs.copyFileSync(sourcePath, targetPath);
                    updatedCount++;
                    console.log(`    ✅ ${file}`);
                }
                
                totalFilesUpdated += updatedCount;
                processedPRs++;
                console.log(`  🎉 ${updatedCount}/${allFiles.length} ファイル更新完了`);
                
            } catch (error) {
                console.error(`  ❌ エラー:`, error.message);
                errors.push(`${relPath}: ${error.message}`);
            }
        } else {
            processDirectory(itemPath);
        }
    }
}

processDirectory(TARGET_DIR);

console.log();
console.log('='.repeat(80));
console.log('📊 処理結果サマリー');
console.log('='.repeat(80));
console.log(`総PR数:              ${totalPRs}`);
console.log(`処理成功PR数:        ${processedPRs}`);
console.log(`更新ファイル総数:    ${totalFilesUpdated}`);
console.log(`エラー数:            ${errors.length}`);
console.log();

if (errors.length > 0) {
    console.log('⚠️  エラー詳細:');
    errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
    });
}

console.log();
console.log('✅ 完了！');
