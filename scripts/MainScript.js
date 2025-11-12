
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
import { DiscordWebhook } from '../src/utils/DiscordWebhook.js';
import Config from '../dist/js/modules/config.js';

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
    selectedDatasetIndex: 0,    // filtered_fewChanged をデフォルト選択（より小さなファイル）
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
 * Discord Webhook設定
 * 環境変数 DISCORD_WEBHOOK_URL が設定されている場合に有効化
 */
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || null;
const DISCORD_PROGRESS_INTERVAL = 2 * 60 * 60 * 1000; // 2時間（ミリ秒）

/**
 * 初期プロンプト+PRタイトル入力
 * 
 */
const WITH_PR_TITLE = {
    selectedDatasetIndex: 0,    // filtered_fewChanged をデフォルト選択（より小さなファイル）
    outputDir: "/app/output",
    processingOptions: {
        generateReport: true,
        generateErrorReport: true,
        processingOptions: {
            baseOutputDir: "/app/output",
            maxRetries: 3,
            memoryCleanupInterval: 5,
            timeoutMs: 10 * 60 * 1000,              // 10分
            enableGarbageCollection: true,
            enablePreVerification: false    // 無効
        }
    }
}



/**
 * メイン実行関数
 */
async function main() {
    // コマンドライン引数の解析

    const config = DEFAULT_CONFIG;

    const args = process.argv.slice(2);
    let datasetIndex = config.selectedDatasetIndex;
    let outputDir = config.outputDir;
    let enablePreVerification = config.processingOptions.enablePreVerification;
    
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
    
    // 引数無しの場合の特別処理（TUIを強制有効化）
    const forceTUI = args.length === 0;
    if (forceTUI) {
        console.log('🔧 No arguments provided - using defaults with TUI enabled and pre-verification disabled');
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
    
    // LLM設定情報の表示（設定ファイルから取得）
    const configInstance = new Config();
    const provider = configInstance.get('llm.provider', process.env.LLM_PROVIDER || 'openai');
    
    console.log('\n🤖 LLM Configuration:');
    console.log(`   Provider: ${provider}`);
    console.log(`   Model: ${getLLMModel()}`);
    console.log(`   Temperature: ${getLLMTemperature()}`);
    console.log(`   Max Tokens: ${getLLMMaxTokens()}`);
    console.log(`   API Key Length: ${getLLMApiKeyLength()}`);
    console.log(`   Summary Threshold: ${configInstance.get('llm.summaryThreshold', 30000)} tokens`);
    // 処理オプションの表示
    const options = {
        ...DEFAULT_CONFIG.processingOptions,
        baseOutputDir: outputDir,
        enablePreVerification: enablePreVerification,
        forceTUI: forceTUI  // 引数なしの場合はTUIを強制有効化
    };
    
    console.log('\n⚙️ Processing Options:');
    console.log(`   Max Retries: ${options.maxRetries}`);
    console.log(`   Memory Cleanup Interval: ${options.memoryCleanupInterval}`);
    console.log(`   Timeout: ${options.timeoutMs / 1000}s`);
    console.log(`   Garbage Collection: ${options.enableGarbageCollection ? 'Enabled' : 'Disabled'}`);
    console.log(`   Pre-Verification: ${options.enablePreVerification ? 'Enabled' : 'Disabled'}`);
    console.log(`   Force TUI: ${options.forceTUI ? 'Enabled' : 'Disabled'}`);
    
    // Discord Webhook設定の表示
    if (DISCORD_WEBHOOK_URL) {
        console.log('\n📢 Discord Webhook:');
        console.log(`   Status: Enabled`);
        console.log(`   Progress Interval: ${DISCORD_PROGRESS_INTERVAL / 1000 / 60} minutes`);
    } else {
        console.log('\n📢 Discord Webhook: Disabled (DISCORD_WEBHOOK_URL not set)');
    }
    
    console.log('========================================\n');

    let controller = null;
    let webhookClient = null;
    let progressInterval = null;

    // Discord Webhook初期化
    if (DISCORD_WEBHOOK_URL) {
        try {
            webhookClient = new DiscordWebhook(DISCORD_WEBHOOK_URL);
            console.log('✅ Discord Webhook client initialized');
        } catch (error) {
            console.warn('⚠️  Discord Webhook initialization failed:', error.message);
            webhookClient = null;
        }
    }

    try {
        // 動的インポートでコントローラーを読み込み
        const controllerModule = await import('../src/Controller/Controller.js');
        const { datasetLoop } = controllerModule;
        
        // 2時間ごとに進捗を送信する定期処理を開始
        if (webhookClient) {
            progressInterval = setInterval(async () => {
                try {
                    console.log('\n⏰ Sending periodic progress update to Discord...');
                    // ProgressTrackerから統計を取得する必要があるため、
                    // ここでは仮の統計を送信（実際の統計は後で追加）
                    const currentStats = {
                        total: 0,
                        processed: 0,
                        successful: 0,
                        failed: 0,
                        skipped: 0,
                        startTime: Date.now()
                    };
                    
                    // TODO: 実際のProgressTrackerの統計を取得
                    // await webhookClient.sendProgress(currentStats, selectedDataset);
                    console.log('⏰ Progress update scheduled (implementation pending)');
                } catch (webhookError) {
                    console.warn('⚠️  Failed to send progress update:', webhookError.message);
                }
            }, DISCORD_PROGRESS_INTERVAL);
            
            console.log(`⏰ Progress update timer started (every ${DISCORD_PROGRESS_INTERVAL / 1000 / 60} minutes)\n`);
        }
        
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
        
        // Discord通知: 正常終了
        if (webhookClient) {
            try {
                console.log('\n📤 Sending final results to Discord...');
                const finalStats = {
                    total: stats.totalPullRequests,
                    processed: stats.successfulPullRequests + stats.failedPullRequests + stats.skippedPullRequests,
                    successful: stats.successfulPullRequests,
                    failed: stats.failedPullRequests,
                    skipped: stats.skippedPullRequests,
                    startTime: Date.now() - (stats.totalDuration || 0)
                };
                await webhookClient.sendFinalResult(finalStats, selectedDataset, true);
                console.log('✅ Final results sent to Discord');
            } catch (webhookError) {
                console.warn('⚠️  Failed to send final results to Discord:', webhookError.message);
            }
        }
        
        // 定期送信タイマーをクリア
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        
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
        
        // Discord通知: エラー発生
        if (webhookClient) {
            try {
                console.log('\n📤 Sending error notification to Discord...');
                await webhookClient.sendError(error, 'MVC Batch Processing');
                console.log('✅ Error notification sent to Discord');
            } catch (webhookError) {
                console.warn('⚠️  Failed to send error notification to Discord:', webhookError.message);
            }
        }
        
        // 定期送信タイマーをクリア
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        
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
 * LLMモデル名を取得（設定ファイルから）
 */
function getLLMModel() {
    try {
        const configInstance = new Config();
        const provider = configInstance.get('llm.provider', process.env.LLM_PROVIDER || 'openai');
        
        if (provider === 'openai') {
            return configInstance.get('llm.model', process.env.OPENAI_MODEL || 'gpt-4');
        } else if (provider === 'gemini') {
            return configInstance.get('llm.model', process.env.GEMINI_MODEL || 'gemini-1.5-pro');
        } else {
            return configInstance.get('llm.model', 'unknown');
        }
    } catch (error) {
        // フォールバック: 環境変数から取得
        const provider = process.env.LLM_PROVIDER || 'openai';
        if (provider === 'openai') {
            return process.env.OPENAI_MODEL || 'gpt-4';
        } else if (provider === 'gemini') {
            return process.env.GEMINI_MODEL || 'gemini-1.5-pro';
        }
        return 'unknown';
    }
}

/**
 * LLM温度設定を取得（設定ファイルから）
 */
function getLLMTemperature() {
    try {
        const configInstance = new Config();
        return configInstance.get('llm.temperature', parseFloat(process.env.LLM_TEMPERATURE) || 0.7);
    } catch (error) {
        return parseFloat(process.env.LLM_TEMPERATURE) || 0.7;
    }
}

/**
 * LLM最大トークン数を取得（設定ファイルから）
 */
function getLLMMaxTokens() {
    try {
        const configInstance = new Config();
        return configInstance.get('llm.maxTokens', parseInt(process.env.LLM_MAX_TOKENS) || 4000);
    } catch (error) {
        const provider = process.env.LLM_PROVIDER || 'openai';
        if (provider === 'openai') {
            return parseInt(process.env.OPENAI_MAX_TOKENS) || 4000;
        } else if (provider === 'gemini') {
            return parseInt(process.env.GEMINI_MAX_TOKENS) || 4000;
        }
        return 4000;
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
