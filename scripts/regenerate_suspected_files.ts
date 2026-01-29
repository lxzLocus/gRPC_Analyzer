/**
 * 特定のケースの05_suspectedFiles.txtを再生成するスクリプト
 * テストファイルがhandwrittenFilesから除外されていた問題を修正するため
 */

import fs from 'fs';
import path from 'path';

// @ts-ignore
import { getDiffsForSpecificFiles } from '../src/modules/generateContentDiff.js';

// 再生成対象のケース
const casesToRegenerate = [
    '/app/dataset/filtered_confirmed/boulder/pullrequest/Remove_CertDER_from_GenerateOCSPRequest_proto',
    '/app/dataset/filtered_confirmed/boulder/pullrequest/Update_interceptors_test_to_proto3-'
];

// ファイル判定関数
const GRPC_GEN_PATTERNS = ['.pb.', '_pb2.', '.pb2.', '.pb.go', '.pb.cc', '.pb.h', '.pb.rb', '.pb.swift', '.pb.m', '.pb-c.', '.pb-c.h', '.pb-c.c'];
const EXCLUDED_PATTERNS = ['.md', '.markdown', '.log', '.lock', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 'Dockerfile', 'docker-compose.yml', '.dockerignore', 'LICENSE', '.github/', '.circleci/', '.vscode/', 'docs/'];

const isGeneratedFile = (filePath: string) => GRPC_GEN_PATTERNS.some(pat => filePath.includes(pat));
const isTestFile = (filePath: string) => filePath.toLowerCase().includes('test');
const isExcludedFile = (filePath: string) => EXCLUDED_PATTERNS.some(pat => filePath.includes(pat));

async function regenerateCase(pullRequestPath: string) {
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
    const changedFiles: string[] = JSON.parse(cleanedContent);
    console.log('Changed files:', changedFiles);

    // ファイルを分類
    const protoFiles: string[] = [];
    const generatedFiles: string[] = [];
    const handwrittenFiles: string[] = [];
    const testFiles: string[] = [];

    changedFiles.forEach((file) => {
        if (file.endsWith('.proto')) {
            protoFiles.push(file);
        } else if (isGeneratedFile(file)) {
            generatedFiles.push(file);
        } else if (!isExcludedFile(file)) {
            // テストファイルも手書きコードとして含める
            if (isTestFile(file)) {
                testFiles.push(file);
                handwrittenFiles.push(file);
            } else {
                handwrittenFiles.push(file);
            }
        }
    });

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
    const outputLines: string[] = [];

    // 上位3件のファイルの内容を出力
    for (let i = 0; i < Math.min(3, handwrittenFiles.length); i++) {
        const file = handwrittenFiles[i];
        const fullPath = path.join(premergePath, file);
        
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            outputLines.push(`=== ${file} ===`);
            outputLines.push(content);
        } else {
            outputLines.push(`=== ${file} ===`);
            outputLines.push(`<< File not found >>`);
        }
    }

    const outputText = outputLines.join('\n');
    const outputPath = path.join(pullRequestPath, '05_suspectedFiles.txt');
    fs.writeFileSync(outputPath, outputText, 'utf8');
    console.log(`Generated 05_suspectedFiles.txt at: ${outputPath}`);
}

async function main() {
    console.log('Starting regeneration of 05_suspectedFiles.txt for affected cases...');
    
    for (const casePath of casesToRegenerate) {
        await regenerateCase(casePath);
    }

    console.log('\n=== Regeneration complete ===');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
