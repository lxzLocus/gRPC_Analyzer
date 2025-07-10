#!/usr/bin/env node

/*
05_suspectedFiles.txt生成テスト
*/

import fs from 'fs';
import path from 'path';

// テストデータセットディレクトリ
const testDatasetDir = '/app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml';

console.log('=== 05_suspectedFiles.txt 生成テスト ===');
console.log(`テストディレクトリ: ${testDatasetDir}`);

// 必要なファイルの存在確認
const requiredFiles = [
    '01_proto.txt',
    '02_protoFileChanges.txt',
    '03_fileChanges.txt', 
    '04_surroundedFilePath.txt'
];

let allFilesExist = true;
for (const filename of requiredFiles) {
    const filePath = path.join(testDatasetDir, filename);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${filename} 存在`);
    } else {
        console.log(`❌ ${filename} 存在しない`);
        allFilesExist = false;
    }
}

if (!allFilesExist) {
    console.log('\n❌ 必要なファイルが不足しています。先にgeneratePrompt.jsを実行してください。');
    process.exit(1);
}

// 05_suspectedFiles.txtの内容を確認
const suspectedFilesPath = path.join(testDatasetDir, '05_suspectedFiles.txt');
if (fs.existsSync(suspectedFilesPath)) {
    const content = fs.readFileSync(suspectedFilesPath, 'utf8');
    console.log(`\n✅ 05_suspectedFiles.txt 存在 (${content.length} 文字)`);
    console.log('最初の200文字:');
    console.log(content.substring(0, 200) + '...');
} else {
    console.log('\n❌ 05_suspectedFiles.txt が存在しません');
}

console.log('\n=== テスト完了 ===');
