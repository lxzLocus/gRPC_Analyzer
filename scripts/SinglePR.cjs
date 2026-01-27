#!/usr/bin/env node

/**
 * Single PR Test Script
 * 
 * 単一のPRに対してLLMフローを実行するテストスクリプト
 * ハードコードされたテストケースを使用し、引数なしで実行可能
 * 
 * Usage:
 *   node scripts/testSinglePR.cjs
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// .envファイルを読み込み
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// テストケース設定（ハードコード）
const TEST_CASES = [
    {
        name: "Boulder - Implement RA method for unpausing accounts",
        datasetPath: "/app/dataset/filtered_confirmed/boulder/issue/Implement_RA_method_for_unpausing_accounts",
        description: "Proto + Stub context test case with existing 02a_stubFileChanges.txt"
    }
];

// 出力ディレクトリ
const OUTPUT_BASE_DIR = "/app/output/test_single_pr";

/**
 * メイン実行関数
 */
async function main() {
    console.log("=".repeat(80));
    console.log("🧪 Single PR Test Runner");
    console.log("=".repeat(80));
    console.log();

    // 出力ディレクトリの作成
    if (!fs.existsSync(OUTPUT_BASE_DIR)) {
        fs.mkdirSync(OUTPUT_BASE_DIR, { recursive: true });
        console.log(`📁 Created output directory: ${OUTPUT_BASE_DIR}`);
    }

    // 各テストケースを実行
    for (let i = 0; i < TEST_CASES.length; i++) {
        const testCase = TEST_CASES[i];
        console.log(`\n${"=".repeat(80)}`);
        console.log(`📝 Test Case ${i + 1}/${TEST_CASES.length}: ${testCase.name}`);
        console.log(`${"=".repeat(80)}`);
        console.log(`📂 Dataset: ${testCase.datasetPath}`);
        console.log(`📄 Description: ${testCase.description}`);
        console.log();

        // データセットの存在確認
        if (!fs.existsSync(testCase.datasetPath)) {
            console.error(`❌ Error: Dataset not found at ${testCase.datasetPath}`);
            continue;
        }

        // 必須ファイルの確認
        const requiredFiles = [
            '01_proto.txt',
            '02_protoFileChanges.txt',
            '02a_stubFileChanges.txt',
            '03_fileChanges.txt',
            '04_surroundedFilePath.txt',
            '05_suspectedFiles.txt'
        ];

        let allFilesExist = true;
        for (const file of requiredFiles) {
            const filePath = path.join(testCase.datasetPath, file);
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️  Warning: ${file} not found`);
                if (file !== '02a_stubFileChanges.txt') { // stubFileChangesは必須ではない
                    allFilesExist = false;
                }
            } else {
                const stats = fs.statSync(filePath);
                console.log(`✅ ${file} (${stats.size} bytes)`);
            }
        }

        if (!allFilesExist) {
            console.error(`❌ Error: Required files missing, skipping test case`);
            continue;
        }

        console.log();
        console.log("🚀 Starting LLM flow processing...");
        console.log(`📝 Expected log output: /app/log/${testCase.datasetPath.split('/dataset/')[1].split('/').slice(1).join('/')}/`);
        console.log();

        try {
            // autoResponser.tsをインポートして実行
            // ESMモジュールなので、動的インポートを使用
            const { execSync } = require('child_process');
            
            // npx tsx を使ってTypeScriptファイルを直接実行
            const command = `npx tsx /app/src/utils/autoResponser.ts "${testCase.datasetPath}"`;
            
            const startTime = Date.now();
            const output = execSync(command, {
                cwd: '/app',
                env: {
                    ...process.env,
                    NODE_TLS_REJECT_UNAUTHORIZED: '0' // TLSエラー回避
                },
                stdio: 'inherit',
                maxBuffer: 10 * 1024 * 1024 // 10MB
            });
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log();
            console.log(`✅ Test case completed successfully in ${duration}s`);
            
        } catch (error) {
            console.error(`❌ Test case failed:`, error.message);
            if (error.stdout) console.log('STDOUT:', error.stdout.toString());
            if (error.stderr) console.log('STDERR:', error.stderr.toString());
        }
    }

    console.log();
    console.log("=".repeat(80));
    console.log("🎉 Single PR Test Runner Completed");
    console.log("=".repeat(80));
    console.log();
    console.log(`📊 Logs are saved to: /app/log/<repository>/<category>/<pr_name>/`);
}

// スクリプト実行
main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});
