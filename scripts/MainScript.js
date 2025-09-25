
/**
 * メインスクリプト - MVCアーキテクチャバッチ処理エントリーポイント
 * /app/patchEvaluation/script/MainScript.jsのパターンに基づく
 * 
 * 責任:
 * - 環境設定とコマンドライン引数の処理
 * - コントローラーの初期化と実行
 * - 最上位でのエラーハンドリング
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
 * 利用可能なデータセット設定
 */
const AVAILABLE_DATASETS = [
    "/app/dataset/filtered_fewChanged",     // 少数変更ファイル
    "/app/dataset/filtered_confirmed",     // 確認済み
    "/app/dataset/filtered_commit",        // コミット履歴
    "/app/dataset/filtered_protoChanged",   // プロトコル変更
    "/app/dataset/incorrect"                     // テスト用
];

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG = {
    selectedDatasetIndex: 0,    // filtered_confirmed をデフォルト選択（より小さなファイル）
    outputDir: "/app/output",
    processingOptions: {
        baseOutputDir: "/app/output",
        maxRetries: 3,
        memoryCleanupInterval: 5,
        timeoutMs: 15 * 60 * 1000,      // 15分 (900秒) - 巨大プロンプト対応
        enableGarbageCollection: true,
        enablePreVerification: false    // 引数無しの場合は事前検証を無効化
    }
};

/**
 * メイン実行関数
 */
async function main() {
    // コマンドライン引数の解析
    const args = process.argv.slice(2);
    let datasetIndex = DEFAULT_CONFIG.selectedDatasetIndex;
    let outputDir = DEFAULT_CONFIG.outputDir;
    let enablePreVerification = DEFAULT_CONFIG.processingOptions.enablePreVerification;
    
    // 引数の処理
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--help' || arg === '-h') {
            showUsage();
            process.exit(0);
        } else if (arg === '--enable-pre-verification') {
            enablePreVerification = true;
        } else if (arg === '--no-pre-verification') {
            enablePreVerification = false;
        } else if (!isNaN(parseInt(arg)) && datasetIndex === DEFAULT_CONFIG.selectedDatasetIndex) {
            // 最初の数値引数をdatasetIndexとして使用
            datasetIndex = parseInt(arg);
        } else if (arg.startsWith('/') || arg.startsWith('./') || arg.startsWith('../')) {
            // パスっぽい引数をoutputDirとして使用
            outputDir = arg;
        }
    }
    
    // 引数無しの場合の特別処理
    if (args.length === 0) {
        console.log('🔧 No arguments provided - using defaults with pre-verification disabled');
        enablePreVerification = false;
    }
    
    // データセット選択の検証
    if (datasetIndex < 0 || datasetIndex >= AVAILABLE_DATASETS.length) {
        console.error(`❌ Invalid dataset index: ${datasetIndex}`);
        console.log('📂 Available datasets:');
        AVAILABLE_DATASETS.forEach((dataset, index) => {
            console.log(`   ${index}: ${dataset}`);
        });
        process.exit(1);
    }
    
    const selectedDataset = AVAILABLE_DATASETS[datasetIndex];
    
    // 実行情報の表示
    console.log('🚀 MVC Batch Processing Starting...');
    console.log('========================================');
    console.log(`📂 Selected Dataset: ${selectedDataset} (index: ${datasetIndex})`);
    console.log(`📁 Output Directory: ${outputDir}`);
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
    const options = {
        ...DEFAULT_CONFIG.processingOptions,
        baseOutputDir: outputDir,
        enablePreVerification: enablePreVerification
    };
    
    console.log('\n⚙️ Processing Options:');
    console.log(`   Max Retries: ${options.maxRetries}`);
    console.log(`   Memory Cleanup Interval: ${options.memoryCleanupInterval}`);
    console.log(`   Timeout: ${options.timeoutMs / 1000}s`);
    console.log(`   Garbage Collection: ${options.enableGarbageCollection ? 'Enabled' : 'Disabled'}`);
    console.log(`   Pre-Verification: ${options.enablePreVerification ? 'Enabled' : 'Disabled'}`);
    console.log('========================================\n');

    let controller = null;

    try {
        // 動的インポートでコントローラーを読み込み
        const controllerModule = await import('../src/Controller/Controller.js');
        const { datasetLoop } = controllerModule;
        
        // 処理の実行（patchEvaluationパターンを踏襲）
        const stats = await datasetLoop(selectedDataset, outputDir, {
            generateReport: true,
            generateErrorReport: true,
            processingOptions: options
        });

        // 結果の表示
        console.log('\n🎉 MVC batch processing completed successfully!');
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
        
        // 正常終了
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Critical error in MVC batch processing:');
        console.error('========================================');
        console.error(`Error Type: ${error.constructor.name}`);
        console.error(`Error Message: ${error.message}`);
        if (error.stack) {
            console.error(`Stack Trace:\n${error.stack}`);
        }
        console.error('========================================');
        
        if (controller) {
            try {
                console.log('🔄 Attempting graceful shutdown...');
                await controller.shutdown();
                console.log('✅ Graceful shutdown completed');
            } catch (shutdownError) {
                console.error('❌ Error during shutdown:', shutdownError.message);
            }
        }
        
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

/**
 * 使用方法の表示
 */
function showUsage() {
    console.log('📖 Usage: node scripts/MainScript.js [dataset_index] [output_dir] [options]');
    console.log('\n📂 Available datasets:');
    AVAILABLE_DATASETS.forEach((dataset, index) => {
        console.log(`   ${index}: ${dataset}`);
    });
    console.log('\n📁 Default output directory: /app/output');
    console.log('\n🔧 Options:');
    console.log('   --enable-pre-verification   Enable Devil\'s Advocate pre-verification step');
    console.log('   --no-pre-verification       Disable pre-verification step (default for no args)');
    console.log('   --help, -h                  Show this help message');
    console.log('\n⚠️  Dataset 4 (incorrect_few) uses large prompt files and has 15-minute timeout');
    console.log('\n🚀 Examples:');
    console.log('   node scripts/MainScript.js                              # Use defaults, no pre-verification');
    console.log('   node scripts/MainScript.js --enable-pre-verification    # Use defaults with pre-verification');
    console.log('   node scripts/MainScript.js 0                            # Use filtered_fewChanged, no pre-verification');
    console.log('   node scripts/MainScript.js 0 --enable-pre-verification  # Use filtered_fewChanged with pre-verification');
    console.log('   node scripts/MainScript.js 4 /tmp/output                # Use test dataset with custom output');
}

// ヘルプオプションの処理は main() 関数内で行うため、ここでは削除

// 直接実行された場合のみメイン関数を実行
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('💥 Unhandled error in main:', error);
        process.exit(1);
    });
}

export { main, AVAILABLE_DATASETS, DEFAULT_CONFIG };
