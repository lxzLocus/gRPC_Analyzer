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
    repositoryName: "boulder",           // リポジトリ名（例: "etcd-io_etcd"）
    category: "pullrequest",             // カテゴリ名（例: "breaking_changes"）
    pullRequestTitle: "Add_certificateProfileName_to_RA-_SA-_and_Core_order_protos",           // PRタイトル（例: "Pull_13207"）
    
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
    forceTUI: true,  // TUI進捗表示を強制有効化
    quietMode: false, // 詳細ログ出力を有効化（プロンプト/レスポンス確認用）
    
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
    // Configクラスを読み込んで設定を取得
    const configModule = await import('../dist/js/modules/config.js');
    const Config = configModule.default;
    const dummyPRPath = '/app/dataset'; // ダミーパス（Configインスタンス作成に必要）
    const configInstance = new Config(dummyPRPath);
    
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
    
    // LLM設定情報の表示（Configクラスから取得）
    const provider = configInstance.get('llm.provider', 'openai');
    console.log('\n🤖 LLM Configuration:');
    console.log(`   Provider: ${provider}`);
    console.log(`   Model: ${getLLMModelFromConfig(configInstance, provider)}`);
    console.log(`   Temperature: ${getLLMTemperatureFromConfig(configInstance, provider)}`);
    console.log(`   Max Tokens: ${getLLMMaxTokensFromConfig(configInstance, provider)}`);
    
    // API Key情報（環境変数から取得）
    console.log(`   API Key Length: ${getLLMApiKeyLength()}`);
    
    // REST API設定の表示（providerがrestapiの場合）
    if (provider === 'restapi') {
        const baseUrl = configInstance.get('llm.restApi.baseUrl', 'http://localhost:1234');
        const endpoint = configInstance.get('llm.restApi.endpoint', '/v1/chat/completions');
        const model = configInstance.get('llm.restApi.model', 'default');
        console.log(`   REST API URL: ${baseUrl}${endpoint}`);
        console.log(`   REST API Model: ${model}`);
    }
    
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
        const { BatchProcessController } = await import('../dist/js/controllers/BatchProcessController.js');
        
        console.log('🚀 Starting single PR processing...\n');
        
        // コントローラーのインスタンス化
        const controller = new BatchProcessController({
            generateReport: true,
            generateErrorReport: true,
            ...PROCESSING_OPTIONS
        });
        
        // 単一PR処理の実行
        await controller.runBatchProcessing(TARGET_PR_CONFIG.datasetDir);

        console.log('\n🎉 Single PR processing completed!');
        console.log(`📄 Check output files in: ${TARGET_PR_CONFIG.outputDir}`);
        
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
 * LLMモデル名を取得（Configクラスから）
 */
function getLLMModelFromConfig(configInstance, provider) {
    if (provider === 'openai') {
        return configInstance.get('llm.model', process.env.OPENAI_MODEL || 'gpt-4');
    } else if (provider === 'gemini') {
        return configInstance.get('gemini.model', process.env.GEMINI_MODEL || 'gemini-1.5-pro');
    } else if (provider === 'restapi') {
        return configInstance.get('llm.restApi.model', 'default');
    } else {
        return 'unknown';
    }
}

/**
 * LLM温度設定を取得（Configクラスから）
 */
function getLLMTemperatureFromConfig(configInstance, provider) {
    if (provider === 'openai') {
        return configInstance.get('llm.temperature', process.env.OPENAI_TEMPERATURE || '0.7');
    } else if (provider === 'gemini') {
        return configInstance.get('gemini.temperature', process.env.GEMINI_TEMPERATURE || '0.7');
    } else if (provider === 'restapi') {
        return configInstance.get('llm.restApi.temperature', '0.7');
    } else {
        return 'unknown';
    }
}

/**
 * LLM最大トークン数を取得（Configクラスから）
 */
function getLLMMaxTokensFromConfig(configInstance, provider) {
    if (provider === 'openai') {
        return configInstance.get('llm.maxTokens', process.env.OPENAI_MAX_TOKENS || '4000');
    } else if (provider === 'gemini') {
        return configInstance.get('gemini.maxTokens', process.env.GEMINI_MAX_TOKENS || '4000');
    } else if (provider === 'restapi') {
        return configInstance.get('llm.restApi.maxTokens', '4000');
    } else {
        return 'unknown';
    }
}

/**
 * LLMモデル名を取得（環境変数から・レガシー）
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

export { 
    main, 
    TARGET_PR_CONFIG, 
    PROCESSING_OPTIONS,
    getLLMModelFromConfig,
    getLLMTemperatureFromConfig,
    getLLMMaxTokensFromConfig
};
