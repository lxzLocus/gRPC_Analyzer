
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
import { consoleLogger } from '../dist/js/modules/ConsoleLogger.js';

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
    "/app/dataset/filtered_confirmed",      // 確認済み
    "/app/dataset/filtered_commit",         // コミット履歴
    "/app/dataset/filtered_protoChanged",   // プロトコル変更
    "/app/dataset/filtered_bugs",           // バグ修正（実データあり）
    "/app/dataset/incorrect_few"            // テスト用（空）
];

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG = {
    selectedDatasetIndex: 0,    // filtered_fewChanged をデフォルト選択（少数変更ファイル）
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
 * メイン実行関数
 */
async function main() {
    // コマンドライン引数の解析

    const config = DEFAULT_CONFIG;

    const args = process.argv.slice(2);
    let datasetIndex = config.selectedDatasetIndex;
    let outputDir = config.outputDir;
    let enablePreVerification = config.processingOptions.enablePreVerification;
    let resumeFrom = null;

    // コンソール出力の制御フラグ
    const hasNoConsoleLogArg = args.includes('--no-console-log');
    const hasForceConsoleLogArg = args.includes('--force-console-log');
    const forceTUI = args.length === 0;
    const quietMode = forceTUI || hasNoConsoleLogArg;  // TUI使用時または明示指定時は詳細ログを抑制
    const consoleLogEnabled = hasForceConsoleLogArg ? true : !quietMode;
    
    // Blessed TUI View の有効化フラグ（環境変数）
    const useBlessedView = process.env.USE_BLESSED_VIEW === 'true';
    
    // デバッグ: 環境変数の確認（quietModeに関わらず必ず出力）
    consoleLogger.forceLog(`🔍 Debug: USE_BLESSED_VIEW=${process.env.USE_BLESSED_VIEW}, useBlessedView=${useBlessedView}, forceTUI=${forceTUI}, quietMode=${quietMode}`);

    // Blessed TUI使用時は全てのコンソール出力を抑制
    if (useBlessedView) {
        // 動的インポートでloggerモジュールを読み込み
        const loggerModule = await import('../dist/js/utils/logger.js');
        
        // Blessed TUI初期化前の最小限の情報表示
        consoleLogger.forceLog('\n╔════════════════════════════════════════════════════════════╗');
        consoleLogger.forceLog('║         🔬 gRPC Analyzer - Blessed TUI Mode                ║');
        consoleLogger.forceLog('╚════════════════════════════════════════════════════════════╝');
        consoleLogger.forceLog('🎨 Initializing Blessed TUI...\n');
        
        // logger.jsのquietModeを有効化（console.logを完全に抑制）
        loggerModule.enableQuietMode();
        
        // ConsoleLoggerも完全に無効化（Blessed TUI以外の出力を防ぐ）
        consoleLogger.setEnabled(false);
        
        enablePreVerification = false;
    } 
    // quietMode有効化（Blessed以外のTUIモード）
    else if (quietMode) {
        // 動的インポートでloggerモジュールを読み込み
        const loggerModule = await import('../dist/js/utils/logger.js');
        
        // 重要な情報のみ表示
        consoleLogger.forceLog('\n╔════════════════════════════════════════════════════════════╗');
        consoleLogger.forceLog('║         🔬 gRPC Analyzer - Enhanced Display Mode           ║');
        consoleLogger.forceLog('╚════════════════════════════════════════════════════════════╝');
        consoleLogger.forceLog('');
        consoleLogger.forceLog('🎨 UI Mode: ANSI TUI (Standard)');
        consoleLogger.forceLog('📊 Dataset: filtered_bugs (実データあり)');
        consoleLogger.forceLog('🤖 LLM: Configuration will be loaded from config');
        consoleLogger.forceLog('🔇 Detailed logs suppressed - Progress will be shown below');
        consoleLogger.forceLog('');
        consoleLogger.forceLog('⏳ Initializing...\n');
        
        // logger.jsのquietModeを有効化（console.logを上書き）
        loggerModule.enableQuietMode();
        
        enablePreVerification = false;
    }
    
    // ログ出力クラスの設定（本ファイル全体で使用）
    consoleLogger.setEnabled(consoleLogEnabled);
    const log = (...messages) => consoleLogger.log(...messages);
    
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
        } else if (arg === '--resume') {
            // 次の3つの引数を取得: repository/category/pullRequestTitle
            const resumeRepo = args[++i];
            const resumeCat = args[++i];
            const resumePR = args[++i];
            
            if (!resumeRepo || !resumeCat || !resumePR) {
                consoleLogger.error('❌ --resume requires 3 arguments: repository category pullRequestTitle');
                consoleLogger.error('   Example: --resume boulder pullrequest "Switch_VA_RPCs_to_proto3"');
                process.exit(1);
            }
            
            resumeFrom = {
                repositoryName: resumeRepo,
                category: resumeCat,
                pullRequestTitle: resumePR
            };
        } else if (!isNaN(parseInt(arg)) && datasetIndex === DEFAULT_CONFIG.selectedDatasetIndex) {
            // 最初の数値引数をdatasetIndexとして使用
            datasetIndex = parseInt(arg);
        } else if (arg.startsWith('/') || arg.startsWith('./') || arg.startsWith('../')) {
            // パスっぽい引数をoutputDirとして使用
            outputDir = arg;
        }
    }
    
    // データセット選択の検証
    if (datasetIndex < 0 || datasetIndex >= AVAILABLE_DATASETS.length) {
        consoleLogger.error(`❌ Invalid dataset index: ${datasetIndex}`);
        log('📂 Available datasets:');
        AVAILABLE_DATASETS.forEach((dataset, index) => {
            log(`   ${index}: ${dataset}`);
        });
        process.exit(1);
    }
    
    const selectedDataset = AVAILABLE_DATASETS[datasetIndex];
    
    // 実行情報の表示
    log('🚀 MVC Batch Processing Starting...');
    log('========================================');
    log(`📂 Selected Dataset: ${selectedDataset} (index: ${datasetIndex})`);
    log(`📁 Output Directory: ${outputDir}`);
    log(`🐛 Process ID: ${process.pid}`);
    log(`📝 Node.js Version: ${process.version}`);
    log(`🗑️ Garbage Collection: ${global.gc ? 'Available' : 'Not Available (use --expose-gc)'}`);
    
    // LLM設定情報の表示（設定ファイルから取得）
    const configInstance = new Config();
    const provider = configInstance.get('llm.provider', process.env.LLM_PROVIDER || 'openai');
    
    log('\n🤖 LLM Configuration:');
    log(`   Provider: ${provider}`);
    log(`   Model: ${getLLMModel()}`);
    log(`   Temperature: ${getLLMTemperature()}`);
    log(`   Max Tokens: ${getLLMMaxTokens()}`);
    log(`   API Key Length: ${getLLMApiKeyLength()}`);
    log(`   Summary Threshold: ${configInstance.get('llm.summaryThreshold', 30000)} tokens`);
    
    // 再開オプションの表示
    if (resumeFrom) {
        log('\n🔄 Resume Mode:');
        log(`   Repository: ${resumeFrom.repositoryName}`);
        log(`   Category: ${resumeFrom.category}`);
        log(`   Starting from PR: ${resumeFrom.pullRequestTitle}`);
    }
    
    // 処理オプションの表示
    const options = {
        ...DEFAULT_CONFIG.processingOptions,
        baseOutputDir: outputDir,
        enablePreVerification: enablePreVerification,
        forceTUI: forceTUI,  // 引数なしの場合はTUIを強制有効化
        quietMode: quietMode,  // 引数なしの場合は詳細ログを抑制
        useBlessedView: useBlessedView,  // 環境変数 USE_BLESSED_VIEW=true で有効化
        resumeFrom: resumeFrom  // 再開オプション
    };
    
    log('\n⚙️ Processing Options:');
    log(`   Max Retries: ${options.maxRetries}`);
    log(`   Memory Cleanup Interval: ${options.memoryCleanupInterval}`);
    log(`   Timeout: ${options.timeoutMs / 1000}s`);
    log(`   Garbage Collection: ${options.enableGarbageCollection ? 'Enabled' : 'Disabled'}`);
    log(`   Pre-Verification: ${options.enablePreVerification ? 'Enabled' : 'Disabled'}`);
    log(`   Progress Display: ${options.forceTUI ? 'Enhanced (with stats)' : 'Standard'}`);
    if (useBlessedView) {
        log(`   UI Mode: Blessed TUI (Interactive)`);
    }
    // Discord Webhook設定の表示
    if (DISCORD_WEBHOOK_URL) {
        log('\n📢 Discord Webhook:');
        log(`   Status: Enabled`);
        log(`   Progress Interval: ${DISCORD_PROGRESS_INTERVAL / 1000 / 60} minutes`);
    } else {
        log('\n📢 Discord Webhook: Disabled (DISCORD_WEBHOOK_URL not set)');
    }

    log('========================================\n');

    let controller = null;
    let webhookClient = null;
    let progressInterval = null;

    // Discord Webhook初期化
    if (DISCORD_WEBHOOK_URL) {
        try {
            webhookClient = new DiscordWebhook(DISCORD_WEBHOOK_URL);
            log('✅ Discord Webhook client initialized');
            // Blessed TUIモード時も通知初期化を確実に記録
            if (useBlessedView) {
                consoleLogger.forceLog('📢 Discord Webhook: Initialized');
            }
        } catch (error) {
            consoleLogger.warn('⚠️  Discord Webhook initialization failed:', error.message);
            webhookClient = null;
        }
    } else if (useBlessedView) {
        consoleLogger.forceLog('📢 Discord Webhook: Disabled (DISCORD_WEBHOOK_URL not set)');
    }

    try {
        // 動的インポートでコントローラーを読み込み
        const { BatchProcessController } = await import('../dist/js/controllers/BatchProcessController.js');
        
        if (quietMode) {
            const loggerModule = await import('../dist/js/utils/logger.js');
            loggerModule.forceLog('🎮 Controller loaded, starting processing...');
        } else {
            log('🎮 Starting batch processing...');
        }
        
        // コントローラーの初期化
        controller = new BatchProcessController(options);
        
        // 2時間ごとに進捗を送信する定期処理を開始
        if (webhookClient) {
            progressInterval = setInterval(async () => {
                try {
                    const notifyMsg = '⏰ Sending periodic progress update to Discord...';
                    log('\n' + notifyMsg);
                    // Blessed TUIモード時も通知状態を記録
                    if (useBlessedView && controller && controller.progressTracker) {
                        controller.progressTracker.log(notifyMsg);
                    }
                    
                    // ProgressTrackerから実際の統計を取得
                    const currentStats = controller && controller.progressTracker 
                        ? controller.progressTracker.getStats() 
                        : {
                            total: 0,
                            processed: 0,
                            successful: 0,
                            failed: 0,
                            skipped: 0,
                            startTime: Date.now()
                        };
                    
                    // 進捗を送信
                    if (currentStats.total > 0) {
                        await webhookClient.sendProgress(currentStats, selectedDataset);
                        const successMsg = '✅ Progress update sent to Discord';
                        log(successMsg);
                        if (useBlessedView && controller && controller.progressTracker) {
                            controller.progressTracker.log(successMsg);
                        }
                    }
                } catch (webhookError) {
                    const errorMsg = `⚠️  Failed to send progress update: ${webhookError.message}`;
                    consoleLogger.warn(errorMsg);
                    if (useBlessedView && controller && controller.progressTracker) {
                        controller.progressTracker.log(errorMsg);
                    }
                }
            }, DISCORD_PROGRESS_INTERVAL);
            
            const timerMsg = `⏰ Progress update timer started (every ${DISCORD_PROGRESS_INTERVAL / 1000 / 60} minutes)`;
            log(timerMsg + '\n');
            if (useBlessedView) {
                consoleLogger.forceLog(timerMsg);
            }
        }
        
        // 処理の実行
        await controller.runBatchProcessing(selectedDataset);
        
        // 統計情報の取得
        const stats = controller.progressTracker ? controller.progressTracker.getStats() : {
            total: 0,
            completed: 0,
            successful: 0,
            failed: 0,
            skipped: 0
        };

        // 結果の表示
        log('\n🎉 MVC batch processing completed successfully!');
        log('========================================');
        log(`✅ Success: ${stats.successful || stats.completed}/${stats.total}`);
        
        if (stats.total > 0) {
            const successRate = ((stats.successful || stats.completed) / stats.total) * 100;
            log(`📊 Success Rate: ${successRate.toFixed(1)}%`);
        }
        
        log(`❌ Failed: ${stats.failed || 0}`);
        log(`⏭️ Skipped: ${stats.skipped || 0}`);
        
        if (stats.totalDuration) {
            log(`⏱️ Total Duration: ${formatDuration(stats.totalDuration)}`);
        } else if (stats.startTime) {
            const duration = Date.now() - stats.startTime;
            log(`⏱️ Total Duration: ${formatDuration(duration)}`);
        }
        
        log('========================================');
        
        // Discord通知: 正常終了
        if (webhookClient) {
            try {
                const notifyMsg = '📤 Sending final results to Discord...';
                log('\n' + notifyMsg);
                // Blessed TUIモード時も通知状態を記録
                if (useBlessedView && controller && controller.progressTracker) {
                    controller.progressTracker.log(notifyMsg);
                }
                const finalStats = {
                    total: stats.total,
                    processed: stats.completed || (stats.successful + stats.failed + stats.skipped),
                    successful: stats.successful || stats.completed,
                    failed: stats.failed || 0,
                    skipped: stats.skipped || 0,
                    startTime: stats.startTime || (Date.now() - (stats.totalDuration || 0))
                };
                await webhookClient.sendFinalResult(finalStats, selectedDataset, true);
                const successMsg = '✅ Final results sent to Discord';
                log(successMsg);
                // Blessed TUIモード時も成功を記録
                if (useBlessedView && controller && controller.progressTracker) {
                    controller.progressTracker.log(successMsg);
                }
            } catch (webhookError) {
                const errorMsg = `⚠️  Failed to send final results to Discord: ${webhookError.message}`;
                consoleLogger.warn(errorMsg);
                // Blessed TUIモード時もエラーを記録
                if (useBlessedView && controller && controller.progressTracker) {
                    controller.progressTracker.log(errorMsg);
                }
            }
        }
        
        // 定期送信タイマーをクリア
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        
        // 正常終了
        process.exit(0);

    } catch (error) {
        consoleLogger.error('\n❌ Critical error in MVC batch processing:');
        consoleLogger.error('========================================');
        consoleLogger.error(`Error Type: ${error.constructor.name}`);
        consoleLogger.error(`Error Message: ${error.message}`);
        if (error.stack) {
            consoleLogger.error(`Stack Trace:\n${error.stack}`);
        }
        consoleLogger.error('========================================');
        
        // Discord通知: エラー発生
        if (webhookClient) {
            try {
                const notifyMsg = '📤 Sending error notification to Discord...';
                log('\n' + notifyMsg);
                // Blessed TUIモード時も通知状態を記録
                if (useBlessedView && controller && controller.progressTracker) {
                    controller.progressTracker.log(notifyMsg);
                }
                await webhookClient.sendError(error, 'MVC Batch Processing');
                const successMsg = '✅ Error notification sent to Discord';
                log(successMsg);
                // Blessed TUIモード時も成功を記録
                if (useBlessedView && controller && controller.progressTracker) {
                    controller.progressTracker.log(successMsg);
                }
            } catch (webhookError) {
                consoleLogger.warn('⚠️  Failed to send error notification to Discord:', webhookError.message);
            }
        }
        
        // 定期送信タイマーをクリア
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        
        if (controller) {
            try {
                log('🔄 Attempting graceful shutdown...');
                await controller.shutdown();
                log('✅ Graceful shutdown completed');
            } catch (shutdownError) {
                consoleLogger.error('❌ Error during shutdown:', shutdownError.message);
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
    consoleLogger.forceLog('📖 Usage: node scripts/MainScript.js [dataset_index] [output_dir] [options]');
    consoleLogger.forceLog('\n📂 Available datasets:');
    AVAILABLE_DATASETS.forEach((dataset, index) => {
        consoleLogger.forceLog(`   ${index}: ${dataset}`);
    });
    consoleLogger.forceLog('\n📁 Default output directory: /app/output');
    consoleLogger.forceLog('\n🔧 Options:');
    consoleLogger.forceLog('   --enable-pre-verification   Enable Devil\'s Advocate pre-verification step');
    consoleLogger.forceLog('   --no-pre-verification       Disable pre-verification step (default for no args)');
    consoleLogger.forceLog('   --no-console-log            Suppress console.log output for TUI mode');
    consoleLogger.forceLog('   --force-console-log         Force console.log output even in TUI mode');
    consoleLogger.forceLog('   --resume <repo> <cat> <pr>  Resume from specified Pull Request');
    consoleLogger.forceLog('   --help, -h                  Show this help message');
    consoleLogger.forceLog('\n⚠️  Dataset 4 (incorrect_few) uses large prompt files and has 15-minute timeout');
    consoleLogger.forceLog('\n🚀 Examples:');
    consoleLogger.forceLog('   node scripts/MainScript.js                              # Use defaults, no pre-verification');
    consoleLogger.forceLog('   node scripts/MainScript.js --enable-pre-verification    # Use defaults with pre-verification');
    consoleLogger.forceLog('   node scripts/MainScript.js 0                            # Use filtered_fewChanged, no pre-verification');
    consoleLogger.forceLog('   node scripts/MainScript.js 0 --enable-pre-verification  # Use filtered_fewChanged with pre-verification');
    consoleLogger.forceLog('   node scripts/MainScript.js 4 /tmp/output                # Use test dataset with custom output');
    consoleLogger.forceLog('\n🔄 Resume Examples:');
    consoleLogger.forceLog('   # Resume from the next PR after "Switch_VA_RPCs_to_proto3"');
    consoleLogger.forceLog('   node scripts/MainScript.js 0 --resume boulder pullrequest "Switch_VA_RPCs_to_proto3"');
    consoleLogger.forceLog('\n   # Get resume info from last error report:');
    consoleLogger.forceLog('   tail -20 /app/output/error_report_*.json | grep -A1 repositoryName | tail -4');
}

// ヘルプオプションの処理は main() 関数内で行うため、ここでは削除

// 直接実行された場合のみメイン関数を実行
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        consoleLogger.error('💥 Unhandled error in main:', error);
        process.exit(1);
    });
}

export { main, AVAILABLE_DATASETS, DEFAULT_CONFIG };
