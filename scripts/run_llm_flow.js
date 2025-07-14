#!/usr/bin/env node

/*
LLMFlowController実行スクリプト

使用方法:
  node run_llm_flow.js [dataset_directory]
  
引数:
  dataset_directory: プロンプト変数ファイルが格納されているデータセットディレクトリ
                     デフォルト: /app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml

例:
  node run_llm_flow.js
  node run_llm_flow.js /app/dataset/test/another_project/pullrequest/feature_xyz
*/

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

// .envファイルを読み込み（プロジェクトルートから）
const envPath = path.resolve(path.dirname(process.argv[1]), '../.env');
const envResult = dotenv.config({ path: envPath });

// .envファイルの読み込み状況をデバッグ表示
if (process.argv.includes('--debug')) {
    console.log('🔧 デバッグ情報:');
    console.log(`   .envファイル: ${fs.existsSync(envPath) ? '✅ 存在' : '❌ 見つかりません'} (${envPath})`);
    if (envResult.error) {
        console.log(`   .env読み込みエラー: ${envResult.error.message}`);
    } else {
        console.log('   .env読み込み: ✅ 成功');
    }
}

const execAsync = promisify(exec);

function showUsage() {
    console.log(`
LLMFlowController実行スクリプト

使用方法:
  node run_llm_flow.js [dataset_directory] [--test]
  
引数:
  dataset_directory: プロンプト変数ファイルが格納されているデータセットディレクトリ
                     デフォルト: /app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml

オプション:
  --test: テストモード（OPENAI_TOKEN環境変数のチェックをスキップ）
  --debug: デバッグモード（.envファイルの読み込み状況を表示）

例:
  node run_llm_flow.js
  node run_llm_flow.js --test
  node run_llm_flow.js --debug
  node run_llm_flow.js /app/dataset/test/another_project/pullrequest/feature_xyz
  node run_llm_flow.js /path/to/dataset --test --debug

必要なファイル（データセットディレクトリ内）:
  - 01_proto.txt
  - 02_protoFileChanges.txt  
  - 03_fileChanges.txt
  - 04_surroundedFilePath.txt
  - 05_suspectedFiles.txt

環境変数:
  OPENAI_TOKEN: OpenAI APIキー（通常実行時は必須、--testフラグ時はスキップ可能）
  
環境変数の設定方法:
  1. .envファイルを作成: OPENAI_TOKEN=your_api_key_here
  2. 直接export: export OPENAI_TOKEN=your_api_key_here
`);
}

async function validateEnvironment(skipEnvCheck = false) {
    // --test フラグがある場合は環境変数チェックをスキップ
    if (skipEnvCheck) {
        console.log('⚠️  テストモード: 環境変数チェックをスキップしています');
        return true;
    }
    
    // OpenAI APIキーの確認
    if (!process.env.OPENAI_TOKEN) {
        console.error('❌ エラー: OPENAI_TOKEN環境変数が設定されていません');
        console.error('   .envファイル例: OPENAI_TOKEN=your_api_key_here');
        console.error('   または直接export: export OPENAI_TOKEN=your_api_key_here');
        console.error('   テスト実行の場合: --test フラグを追加してください');
        return false;
    }
    
    return true;
}

async function validateDatasetDirectory(datasetDir) {
    // ディレクトリの存在確認
    if (!fs.existsSync(datasetDir)) {
        console.error(`❌ エラー: データセットディレクトリが存在しません: ${datasetDir}`);
        return false;
    }
    
    // 必要なプロンプト変数ファイルの確認
    const requiredFiles = [
        '01_proto.txt',
        '02_protoFileChanges.txt',
        '03_fileChanges.txt', 
        '04_surroundedFilePath.txt',
        '05_suspectedFiles.txt'
    ];
    
    for (const filename of requiredFiles) {
        const filePath = path.join(datasetDir, filename);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ エラー: 必要なファイルが見つかりません: ${filePath}`);
            return false;
        }
    }
    
    console.log(`✅ データセットディレクトリの検証完了: ${datasetDir}`);
    return true;
}

async function buildProject() {
    try {
        console.log('🔨 TypeScriptコンパイル中...');
        await execAsync('npm run build');
        console.log('✅ TypeScriptコンパイル完了');
        return true;
    } catch (error) {
        console.error('❌ TypeScriptコンパイルエラー:', error.message);
        return false;
    }
}

async function runLLMFlow(datasetDir) {
    try {
        console.log('🚀 LLMFlowController実行中...');
        console.log(`   データセットディレクトリ: ${datasetDir}`);
        
        const command = `node dist/js/utils/autoResponser.js "${datasetDir}"`;
        const { stdout, stderr } = await execAsync(command);
        
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        
        console.log('✅ LLMFlowController実行完了');
        return true;
    } catch (error) {
        console.error('❌ LLMFlowController実行エラー:', error.message);
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(error.stderr);
        return false;
    }
}

async function main() {
    // Help表示
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        showUsage();
        process.exit(0);
    }
    
    // データセットディレクトリの決定（--testと--debugフラグを除外）
    const args = process.argv.filter(arg => arg !== '--test' && arg !== '--debug');
    const datasetDir = args[2] || '/app/dataset/test';
    
    // テストモード判定
    const isTestMode = process.argv.includes('--test');
    
    console.log('=== LLMFlowController 実行 ===\n');
    
    // 1. 環境変数の検証
    if (!(await validateEnvironment(isTestMode))) {
        process.exit(1);
    }
    
    // 2. データセットディレクトリの検証
    if (!(await validateDatasetDirectory(datasetDir))) {
        process.exit(1);
    }
    
    // 3. プロジェクトのビルド
    if (!(await buildProject())) {
        process.exit(1);
    }
    
    // 4. LLMFlow実行
    if (!(await runLLMFlow(datasetDir))) {
        process.exit(1);
    }
    
    console.log('\n🎉 すべての処理が正常に完了しました');
}

main().catch(error => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
});
