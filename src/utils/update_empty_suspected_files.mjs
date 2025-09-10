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
    console.log('Searching for empty 05_suspectedFiles.txt files...');
    
    try {
        const emptyFiles = findEmptyFiles(datasetDir);
        
        console.log(`Found ${emptyFiles.length} empty files`);
        
        if (emptyFiles.length === 0) {
            console.log('No empty 05_suspectedFiles.txt files found.');
            return;
        }
        
        console.log('\nFound empty files:');
        emptyFiles.slice(0, 10).forEach((file, index) => {
            console.log(`${index + 1}. ${file}`);
        });
        if (emptyFiles.length > 10) {
            console.log(`... and ${emptyFiles.length - 10} more files`);
        }
        
        console.log('\nUpdating files...');
        let updatedCount = 0;
        
        for (const filePath of emptyFiles) {
            try {
                fs.writeFileSync(filePath, MESSAGE, 'utf8');
                updatedCount++;
                if (updatedCount <= 5) {
                    console.log(`✓ Updated: ${filePath}`);
                }
            } catch (error) {
                console.error(`✗ Error: ${filePath} - ${error.message}`);
            }
        }
        
        console.log(`\nUpdate completed: ${updatedCount}/${emptyFiles.length} files`);
    } catch (error) {
        console.error('Error during execution:', error.message);
    }
}

// Execute script
updateFiles();
