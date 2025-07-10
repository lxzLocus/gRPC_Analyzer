#!/usr/bin/env node

/*
テスト: プロンプト変数ファイルの読み込みテスト
リファクタリング後にデータセットディレクトリからプロンプト変数ファイルが正しく読み込めるかテスト
*/

// Import modules from the compiled JS files
import { Config, FileManager } from './dist/js/utils/autoResponser.js';

async function testPromptLoading() {
    console.log('=== プロンプト変数ファイル読み込みテスト ===');
    
    try {
        // データセットディレクトリを指定
        const datasetDir = '/app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml';
        console.log(`Dataset directory: ${datasetDir}`);
        
        // Configとファイルマネージャーを初期化
        const config = new Config(datasetDir);
        const fileManager = new FileManager(config);
        
        console.log(`Prompt template directory: ${config.promptDir}`);
        console.log(`Prompt variable directory: ${config.promptVariableDir}`);
        
        // プロンプトファイルを読み込み
        console.log('\n--- プロンプトファイル読み込み開始 ---');
        const promptContent = fileManager.readFirstPromptFile();
        
        console.log('\n--- 読み込み成功 ---');
        console.log(`Prompt content length: ${promptContent.length} characters`);
        console.log('First 200 characters:');
        console.log(promptContent.substring(0, 200) + '...');
        
        return true;
        
    } catch (error) {
        console.error('\n--- エラー発生 ---');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

testPromptLoading()
    .then(success => {
        if (success) {
            console.log('\n✅ テスト成功: プロンプト変数ファイルが正しく読み込まれました');
            process.exit(0);
        } else {
            console.log('\n❌ テスト失敗');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('\n❌ テスト実行エラー:', error);
        process.exit(1);
    });
