/**
 * 単一PRスクリプト - 指定した1つのPRのみを実行
 * 
 * 責任:
 * - ハードコーディングされたPR情報で単一PR処理を実行
 * - 環境設定とコントローラーの初期化
 * - 結果の表示
 */

import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

// ES module環境での __dirname の取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数の設定
config({ path: path.join(__dirname, '..', '.env') });

/**
 * ============================================
 * ここでPR情報をハードコーディング指定
 * ============================================
 */
const TARGET_PR_CONFIG = {
    // データセットのベースディレクトリ
    // 注意: 実際に存在するデータセットを指定してください
    datasetDir: "/app/dataset/filtered_fewChanged",
    
    // PR情報（データセットディレクトリ構造に合わせて指定）
    // 例: /app/dataset/filtered_fewChanged/repository_name/category_name/pr_title/
    // 以下はサンプルです。実際のデータに合わせて変更してください
    repositoryName: "example_repo",           // リポジトリ名（例: "etcd-io_etcd"）
    category: "example_category",             // カテゴリ名（例: "breaking_changes"）
    pullRequestTitle: "Pull_XXXXX",           // PRタイトル（例: "Pull_13207"）
    
    // 出力ディレクトリ
    outputDir: "/app/output/single_pr"
};

/**
 * 処理オプション
 */
const PROCESSING_OPTIONS = {
    baseOutputDir: TARGET_PR_CONFIG.outputDir,
    maxRetries: 3,
    memoryCleanupInterval: 5,
    timeoutMs: 15 * 60 * 1000,      // 15分
    enableGarbageCollection: true,
    enablePreVerification: false,
    
    // 単一PR実行モード用のフィルター
    targetPullRequest: {
        repositoryName: TARGET_PR_CONFIG.repositoryName,
        category: TARGET_PR_CONFIG.category,
        pullRequestTitle: TARGET_PR_CONFIG.pullRequestTitle
    }
};

/**
 * メイン実行関数
 */
async function main() {
    // 実行情報の表示
    console.log('🎯 Single PR Processing Mode');
    console.log('========================================');
    console.log(`📂 Dataset Directory: ${TARGET_PR_CONFIG.datasetDir}`);
    console.log(`🏷️  Repository: ${TARGET_PR_CONFIG.repositoryName}`);
    console.log(`📁 Category: ${TARGET_PR_CONFIG.category}`);
    console.log(`📋 Pull Request: ${TARGET_PR_CONFIG.pullRequestTitle}`);
    console.log(`📁 Output Directory: ${TARGET_PR_CONFIG.outputDir}`);
    console.log(`🐛 Process ID: ${process.pid}`);
    console.log(`📝 Node.js Version: ${process.version}`);
    console.log(`🗑️ Garbage Collection: ${global.gc ? 'Available' : 'Not Available (use --expose-gc)'}`);
    
    // LLM設定情報の表示
    console.log('\n🤖 LLM Configuration:');
    console.log(`   Provider: ${process.env.LLM_PROVIDER || 'openai'}`);
    console.log(`   Model: ${getLLMModel()}`);
    console.log(`   Temperature: ${getLLMTemperature()}`);
    console.log(`   Max Tokens: ${getLLMMaxTokens()}`);
    console.log(`   API Key Length: ${getLLMApiKeyLength()}`);
    
    // 処理オプションの表示
    console.log('\n⚙️ Processing Options:');
    console.log(`   Max Retries: ${PROCESSING_OPTIONS.maxRetries}`);
    console.log(`   Memory Cleanup Interval: ${PROCESSING_OPTIONS.memoryCleanupInterval}`);
    console.log(`   Timeout: ${PROCESSING_OPTIONS.timeoutMs / 1000}s`);
    console.log(`   Garbage Collection: ${PROCESSING_OPTIONS.enableGarbageCollection ? 'Enabled' : 'Disabled'}`);
    console.log(`   Pre-Verification: ${PROCESSING_OPTIONS.enablePreVerification ? 'Enabled' : 'Disabled'}`);
    console.log('========================================\n');

    // PRパスの存在確認
    const prPath = path.join(
        TARGET_PR_CONFIG.datasetDir,
        TARGET_PR_CONFIG.repositoryName,
        TARGET_PR_CONFIG.category,
        TARGET_PR_CONFIG.pullRequestTitle
    );
    
    console.log(`🔍 Checking PR path: ${prPath}`);
    
    const fs = await import('fs');
    if (!fs.existsSync(prPath)) {
        console.error(`❌ PR path does not exist: ${prPath}`);
        console.error('\n💡 Please check:');
        console.error(`   - Dataset directory exists: ${TARGET_PR_CONFIG.datasetDir}`);
        console.error(`   - Repository name is correct: ${TARGET_PR_CONFIG.repositoryName}`);
        console.error(`   - Category name is correct: ${TARGET_PR_CONFIG.category}`);
        console.error(`   - Pull request title is correct: ${TARGET_PR_CONFIG.pullRequestTitle}`);
        process.exit(1);
    }
    
    console.log('✅ PR path verified\n');

    try {
        // 動的インポートでコントローラーを読み込み
        const controllerModule = await import('../src/Controller/Controller.js');
        const { datasetLoop } = controllerModule;
        
        console.log('🚀 Starting single PR processing...\n');
        
        // 処理の実行
        const stats = await datasetLoop(
            TARGET_PR_CONFIG.datasetDir, 
            TARGET_PR_CONFIG.outputDir, 
            {
                generateReport: true,
                generateErrorReport: true,
                processingOptions: PROCESSING_OPTIONS
            }
        );

        // 結果の表示
        console.log('\n🎉 Single PR processing completed successfully!');
        console.log('========================================');
        console.log(`✅ Success: ${stats.successfulPullRequests}/${stats.totalPullRequests}`);
        
        if (stats.totalPullRequests > 0) {
            console.log(`📊 Success Rate: ${((stats.successfulPullRequests / stats.totalPullRequests) * 100).toFixed(1)}%`);
        }
        
        console.log(`❌ Failed: ${stats.failedPullRequests}`);
        console.log(`⏭️ Skipped: ${stats.skippedPullRequests}`);
        
        if (stats.totalDuration) {
            console.log(`⏱️ Total Duration: ${formatDuration(stats.totalDuration)}`);
        }
        
        console.log('========================================');
        console.log(`\n📄 Check output files in: ${TARGET_PR_CONFIG.outputDir}`);
        
        // 正常終了
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Critical error in single PR processing:');
        console.error('========================================');
        console.error(`Error Type: ${error.constructor.name}`);
        console.error(`Error Message: ${error.message}`);
        if (error.stack) {
            console.error(`Stack Trace:\n${error.stack}`);
        }
        console.error('========================================');
        
        process.exit(1);
    }
}

/**
 * 継続時間のフォーマット
 */
function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * LLMモデル名を取得
 */
function getLLMModel() {
    const provider = process.env.LLM_PROVIDER || 'openai';
    
    if (provider === 'openai') {
        return process.env.OPENAI_MODEL || 'gpt-4';
    } else if (provider === 'gemini') {
        return process.env.GEMINI_MODEL || 'gemini-1.5-pro';
    } else {
        return 'unknown';
    }
}

/**
 * LLM温度設定を取得
 */
function getLLMTemperature() {
    const provider = process.env.LLM_PROVIDER || 'openai';
    
    if (provider === 'openai') {
        return process.env.OPENAI_TEMPERATURE || '0.7';
    } else if (provider === 'gemini') {
        return process.env.GEMINI_TEMPERATURE || '0.7';
    } else {
        return 'unknown';
    }
}

/**
 * LLM最大トークン数を取得
 */
function getLLMMaxTokens() {
    const provider = process.env.LLM_PROVIDER || 'openai';
    
    if (provider === 'openai') {
        return process.env.OPENAI_MAX_TOKENS || '4000';
    } else if (provider === 'gemini') {
        return process.env.GEMINI_MAX_TOKENS || '4000';
    } else {
        return 'unknown';
    }
}

/**
 * LLM APIキーの長さを取得（セキュリティのため長さのみ表示）
 */
function getLLMApiKeyLength() {
    const provider = process.env.LLM_PROVIDER || 'openai';
    
    if (provider === 'openai') {
        return (process.env.OPENAI_API_KEY || '').length;
    } else if (provider === 'gemini') {
        return (process.env.GEMINI_API_KEY || '').length;
    } else {
        return 0;
    }
}

// 直接実行された場合のみメイン関数を実行
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('💥 Unhandled error in main:', error);
        process.exit(1);
    });
}

export { main, TARGET_PR_CONFIG, PROCESSING_OPTIONS };
