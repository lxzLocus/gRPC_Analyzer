#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const MESSAGE = `No handwritten files found. Only auto-generated files were modified.

In this pull request, only .proto files and their auto-generated files (.pb.go, etc.) 
were modified. No handwritten code files were changed.
Therefore, no suspected handwritten files exist for analysis.

File categorization of changes:
- Proto files: .proto files
- Generated files: Files matching patterns like .pb.go, .pb.cc, .pb.h, etc.
- Handwritten files: None (excluding excluded files, test files, and auto-generated files)
`;

function findEmptyFiles(dir) {
    const emptyFiles = [];
    
    function walkDir(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const itemPath = path.join(currentDir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                walkDir(itemPath);
            } else if (item === '05_suspectedFiles.txt') {
                // ファイルサイズが0または空かチェック
                if (stat.size === 0) {
                    emptyFiles.push(itemPath);
                } else {
                    // 内容を読んで空文字列かチェック
                    const content = fs.readFileSync(itemPath, 'utf8').trim();
                    if (content === '') {
                        emptyFiles.push(itemPath);
                    }
                }
            }
        }
    }
    
    walkDir(dir);
    return emptyFiles;
}

function updateFiles() {
    const datasetDir = '/app/dataset/filtered_commit';
    console.log('空の05_suspectedFiles.txtファイルを検索中...');
    
    const emptyFiles = findEmptyFiles(datasetDir);
    
    console.log(`見つかった空ファイル数: ${emptyFiles.length}`);
    
    if (emptyFiles.length === 0) {
        console.log('空の05_suspectedFiles.txtファイルが見つかりませんでした。');
        return;
    }
    
    console.log('\n見つかった空ファイル:');
    emptyFiles.forEach((file, index) => {
        console.log(`${index + 1}. ${file}`);
    });
    
    console.log('\nファイルを更新中...');
    let updatedCount = 0;
    
    for (const filePath of emptyFiles) {
        try {
            fs.writeFileSync(filePath, MESSAGE, 'utf8');
            updatedCount++;
            console.log(`✓ 更新完了: ${filePath}`);
        } catch (error) {
            console.error(`✗ エラー: ${filePath} - ${error.message}`);
        }
    }
    
    console.log(`\n更新完了: ${updatedCount}/${emptyFiles.length} ファイル`);
}

// スクリプト実行
updateFiles();
