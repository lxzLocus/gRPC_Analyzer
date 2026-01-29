#!/usr/bin/env node
/**
 * 特定のケースの05_suspectedFiles.txtを再生成するスクリプト
 */

import fs from 'fs';
import path from 'path';

// 再生成対象のケース
const casesToRegenerate = [
    '/app/dataset/filtered_confirmed/boulder/pullrequest/Remove_CertDER_from_GenerateOCSPRequest_proto',
    '/app/dataset/filtered_confirmed/boulder/pullrequest/Update_interceptors_test_to_proto3-'
];

// ファイル判定関数
const GRPC_GEN_PATTERNS = ['.pb.', '_pb2.', '.pb2.', '.pb.go', '.pb.cc', '.pb.h', '.pb.rb', '.pb.swift', '.pb.m', '.pb-c.', '.pb-c.h', '.pb-c.c'];
const EXCLUDED_PATTERNS = ['.md', '.markdown', '.log', '.lock', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 'Dockerfile', 'docker-compose.yml', '.dockerignore', 'LICENSE', '.github/', '.circleci/', '.vscode/', 'docs/'];

const isGeneratedFile = (filePath) => GRPC_GEN_PATTERNS.some(pat => filePath.includes(pat));
const isTestFile = (filePath) => filePath.toLowerCase().includes('test');
const isExcludedFile = (filePath) => EXCLUDED_PATTERNS.some(pat => filePath.includes(pat));

function regenerateCase(pullRequestPath) {
    console.log(`\n=== Processing: ${path.basename(pullRequestPath)} ===`);

    // 03_fileChanges.txt を読み込み
    const fileChangesPath = path.join(pullRequestPath, '03_fileChanges.txt');
    if (!fs.existsSync(fileChangesPath)) {
        console.error(`03_fileChanges.txt not found at: ${fileChangesPath}`);
        return;
    }

    const fileChangesContent = fs.readFileSync(fileChangesPath, 'utf8');
    // マークダウンのコードブロックを取り除く
    const cleanedContent = fileChangesContent.replace(/```plaintext\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('Cleaned content:', cleanedContent);
    
    let changedFiles;
    try {
        changedFiles = JSON.parse(cleanedContent);
    } catch (e) {
        console.error('Failed to parse JSON:', e.message);
        return;
    }
    console.log('Changed files:', changedFiles);

    // ファイルを分類
    const protoFiles = [];
    const generatedFiles = [];
    const handwrittenFiles = [];
    const testFiles = [];

    changedFiles.forEach((file) => {
        console.log(`  Checking file: ${file}`);
        console.log(`    isProto: ${file.endsWith('.proto')}`);
        console.log(`    isGenerated: ${isGeneratedFile(file)}`);
        console.log(`    isTest: ${isTestFile(file)}`);
        console.log(`    isExcluded: ${isExcludedFile(file)}`);
        
        if (file.endsWith('.proto')) {
            protoFiles.push(file);
        } else if (isGeneratedFile(file)) {
            generatedFiles.push(file);
        } else if (!isExcludedFile(file)) {
            // テストファイルも手書きコードとして含める
            if (isTestFile(file)) {
                console.log(`    -> Adding to testFiles AND handwrittenFiles`);
                testFiles.push(file);
                handwrittenFiles.push(file);
            } else {
                console.log(`    -> Adding to handwrittenFiles only`);
                handwrittenFiles.push(file);
            }
        } else {
            console.log(`    -> Excluded`);
        }
    });

    console.log('\nClassification results:');
    console.log('Proto files:', protoFiles);
    console.log('Generated files:', generatedFiles);
    console.log('Handwritten files:', handwrittenFiles);
    console.log('Test files:', testFiles);

    // premergeパスを確認
    const premergePath = path.join(pullRequestPath, 'premerge');
    if (!fs.existsSync(premergePath)) {
        console.error(`premerge directory not found at: ${premergePath}`);
        return;
    }

    // handwrittenFilesが空の場合
    if (handwrittenFiles.length === 0) {
        const outputText = `No handwritten files found. Only auto-generated files were modified.

In this pull request, only .proto files and their auto-generated files (.pb.go, etc.) 
were modified. No handwritten code files were changed.
Therefore, no suspected handwritten files exist for analysis.

File categorization of changes:
- Proto files: .proto files
- Generated files: Files matching patterns like .pb.go, .pb.cc, .pb.h, etc.
- Handwritten files: None (test files are included if they exist in changed files)`;

        const outputPath = path.join(pullRequestPath, '05_suspectedFiles.txt');
        fs.writeFileSync(outputPath, outputText, 'utf8');
        console.log(`Generated (no handwritten files): ${outputPath}`);
        return;
    }

    // handwrittenFilesの内容を出力
    const outputLines = [];

    // 上位3件のファイルの内容を出力
    for (let i = 0; i < Math.min(3, handwrittenFiles.length); i++) {
        const file = handwrittenFiles[i];
        const fullPath = path.join(premergePath, file);
        
        console.log(`Looking for file at: ${fullPath}`);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            outputLines.push(`=== ${file} ===`);
            outputLines.push(content);
            console.log(`  Found and added: ${file} (${content.length} bytes)`);
        } else {
            outputLines.push(`=== ${file} ===`);
            outputLines.push(`<< File not found >>`);
            console.log(`  NOT FOUND: ${file}`);
        }
    }

    const outputText = outputLines.join('\n');
    const outputPath = path.join(pullRequestPath, '05_suspectedFiles.txt');
    fs.writeFileSync(outputPath, outputText, 'utf8');
    console.log(`\nGenerated 05_suspectedFiles.txt at: ${outputPath}`);
    console.log(`Content preview (first 200 chars):\n${outputText.substring(0, 200)}...`);
}

console.log('Starting regeneration of 05_suspectedFiles.txt for affected cases...');

for (const casePath of casesToRegenerate) {
    regenerateCase(casePath);
}

console.log('\n=== Regeneration complete ===');
