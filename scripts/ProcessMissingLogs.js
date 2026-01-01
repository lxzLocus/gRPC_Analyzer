/**
 * 未処理ログ生成スクリプト - ログが存在しないプルリクエストのみを処理
 * 
 * 責任:
 * - データセット内の全プルリクエストをスキャン
 * - ログディレクトリに対応するログファイルが存在しないものを抽出
 * - 存在しないもののみを処理対象として実行
 * 
 * 
 * 
 * 
 * # デフォルト設定で実行（filtered_fewChanged）
node scripts/ProcessMissingLogs.js

# データセットを指定して実行
node scripts/ProcessMissingLogs.js --dataset 0  # filtered_fewChanged
node scripts/ProcessMissingLogs.js --dataset 4  # filtered_bugs

# プロジェクトを絞り込み（boulderのみ）
node scripts/ProcessMissingLogs.js --project boulder

# タイプを絞り込み（pullrequestのみ）
node scripts/ProcessMissingLogs.js --type pullrequest

# 処理数を制限
node scripts/ProcessMissingLogs.js --limit 10

# 組み合わせ例
node scripts/ProcessMissingLogs.js --project boulder --type pullrequest --limit 5
 * 
 * 
 */

import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { DiscordWebhook } from '../src/utils/DiscordWebhook.js';
import Config from '../dist/js/modules/config.js';
import { consoleLogger } from '../dist/js/modules/consoleLogger.js';

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
    "/app/dataset/filtered_bugs",           // バグ修正
    "/app/dataset/incorrect_few"            // テスト用
];

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG = {
    selectedDatasetIndex: 0,    // filtered_fewChanged をデフォルト選択
    outputDir: "/app/output",
    logDir: "/app/log",
    processingOptions: {
        baseOutputDir: "/app/output",
        maxRetries: 3,
        memoryCleanupInterval: 5,
        timeoutMs: 15 * 60 * 1000,      // 15分
        enableGarbageCollection: true,
        enablePreVerification: false
    }
};

/**
 * Discord Webhook設定
 */
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || null;
const DISCORD_PROGRESS_INTERVAL = 2 * 60 * 60 * 1000; // 2時間

/**
 * データセット内の全プルリクエストをスキャンし、ログが存在しないものを抽出
 */
function findMissingLogPullRequests(datasetDir, logDir) {
    const missingLogs = [];
    
    consoleLogger.forceLog(`\n📂 Scanning dataset: ${datasetDir}`);
    consoleLogger.forceLog(`📂 Checking logs in: ${logDir}`);
    
    // データセット内のプロジェクトをスキャン
    const projects = fs.readdirSync(datasetDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    
    for (const project of projects) {
        const projectPath = path.join(datasetDir, project);
        
        // プルリクエストディレクトリをチェック
        const pullrequestPath = path.join(projectPath, 'pullrequest');
        if (!fs.existsSync(pullrequestPath)) {
            continue;
        }
        
        const pullRequests = fs.readdirSync(pullrequestPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        for (const pr of pullRequests) {
            const prDataPath = path.join(pullrequestPath, pr);
            const prLogPath = path.join(logDir, project, 'pullrequest', pr);
            
            // ログディレクトリが存在するかチェック
            let hasLogs = false;
            if (fs.existsSync(prLogPath)) {
                const logFiles = fs.readdirSync(prLogPath)
                    .filter(file => file.endsWith('.log'));
                hasLogs = logFiles.length > 0;
            }
            
            if (!hasLogs) {
                missingLogs.push({
                    project,
                    type: 'pullrequest',
                    name: pr,
                    dataPath: prDataPath,
                    logPath: prLogPath
                });
            }
        }
        
        // Issueディレクトリもチェック
        const issuePath = path.join(projectPath, 'issue');
        if (fs.existsSync(issuePath)) {
            const issues = fs.readdirSync(issuePath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            
            for (const issue of issues) {
                const issueDataPath = path.join(issuePath, issue);
                const issueLogPath = path.join(logDir, project, 'issue', issue);
                
                let hasLogs = false;
                if (fs.existsSync(issueLogPath)) {
                    const logFiles = fs.readdirSync(issueLogPath)
                        .filter(file => file.endsWith('.log'));
                    hasLogs = logFiles.length > 0;
                }
                
                if (!hasLogs) {
                    missingLogs.push({
                        project,
                        type: 'issue',
                        name: issue,
                        dataPath: issueDataPath,
                        logPath: issueLogPath
                    });
                }
            }
        }
    }
    
    return missingLogs;
}

/**
 * 特定のプロジェクト/タイプのみに絞り込み
 */
function filterByProjectAndType(items, projectFilter = null, typeFilter = null) {
    return items.filter(item => {
        if (projectFilter && item.project !== projectFilter) {
            return false;
        }
        if (typeFilter && item.type !== typeFilter) {
            return false;
        }
        return true;
    });
}

/**
 * メイン実行関数
 */
async function main() {
    const args = process.argv.slice(2);
    
    // コマンドライン引数の解析
    let datasetIndex = DEFAULT_CONFIG.selectedDatasetIndex;
    let outputDir = DEFAULT_CONFIG.outputDir;
    let logDir = DEFAULT_CONFIG.logDir;
    let projectFilter = null;
    let typeFilter = null;
    let limit = null;
    
    // 引数パース
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--dataset' && i + 1 < args.length) {
            datasetIndex = parseInt(args[++i], 10);
        } else if (arg === '--output' && i + 1 < args.length) {
            outputDir = args[++i];
        } else if (arg === '--log' && i + 1 < args.length) {
            logDir = args[++i];
        } else if (arg === '--project' && i + 1 < args.length) {
            projectFilter = args[++i];
        } else if (arg === '--type' && i + 1 < args.length) {
            typeFilter = args[++i];
        } else if (arg === '--limit' && i + 1 < args.length) {
            limit = parseInt(args[++i], 10);
        }
    }
    
    // データセットパスの取得
    if (datasetIndex < 0 || datasetIndex >= AVAILABLE_DATASETS.length) {
        consoleLogger.forceLog(`❌ Invalid dataset index: ${datasetIndex}`);
        consoleLogger.forceLog(`Available datasets: ${AVAILABLE_DATASETS.map((d, i) => `${i}: ${d}`).join(', ')}`);
        process.exit(1);
    }
    
    const datasetDir = AVAILABLE_DATASETS[datasetIndex];
    
    consoleLogger.forceLog('\n╔════════════════════════════════════════════════════════════╗');
    consoleLogger.forceLog('║    🔍 Missing Log Processor - gRPC Analyzer                ║');
    consoleLogger.forceLog('╚════════════════════════════════════════════════════════════╝');
    consoleLogger.forceLog('');
    consoleLogger.forceLog(`📊 Dataset: ${datasetDir}`);
    consoleLogger.forceLog(`📁 Output: ${outputDir}`);
    consoleLogger.forceLog(`📝 Log Dir: ${logDir}`);
    if (projectFilter) consoleLogger.forceLog(`🔎 Project Filter: ${projectFilter}`);
    if (typeFilter) consoleLogger.forceLog(`🔎 Type Filter: ${typeFilter}`);
    if (limit) consoleLogger.forceLog(`🔢 Limit: ${limit}`);
    consoleLogger.forceLog('');
    
    // ログが存在しないプルリクエストを検索
    const missingLogs = findMissingLogPullRequests(datasetDir, logDir);
    
    // フィルタリング
    let filteredItems = filterByProjectAndType(missingLogs, projectFilter, typeFilter);
    
    // 制限適用
    if (limit && limit > 0) {
        filteredItems = filteredItems.slice(0, limit);
    }
    
    consoleLogger.forceLog(`\n📊 Summary:`);
    consoleLogger.forceLog(`   Total items without logs: ${missingLogs.length}`);
    consoleLogger.forceLog(`   After filtering: ${filteredItems.length}`);
    consoleLogger.forceLog('');
    
    if (filteredItems.length === 0) {
        consoleLogger.forceLog('✅ No missing logs found or all filtered out.');
        return;
    }
    
    // プロジェクト別の統計
    const projectStats = {};
    for (const item of filteredItems) {
        if (!projectStats[item.project]) {
            projectStats[item.project] = { pullrequest: 0, issue: 0 };
        }
        projectStats[item.project][item.type]++;
    }
    
    consoleLogger.forceLog('📋 Missing logs by project:');
    for (const [project, stats] of Object.entries(projectStats)) {
        consoleLogger.forceLog(`   ${project}: PR=${stats.pullrequest}, Issue=${stats.issue}`);
    }
    consoleLogger.forceLog('');
    
    // 処理対象リストの表示
    consoleLogger.forceLog('🎯 Items to process:');
    for (const [index, item] of filteredItems.entries()) {
        consoleLogger.forceLog(`   ${index + 1}. ${item.project}/${item.type}/${item.name}`);
    }
    consoleLogger.forceLog('');
    
    // LLM Flow Controller を使用した処理
    consoleLogger.forceLog('🚀 Starting batch processing...\n');
    
    try {
        // Discord Webhook の初期化
        let webhook = null;
        if (DISCORD_WEBHOOK_URL) {
            webhook = new DiscordWebhook(DISCORD_WEBHOOK_URL);
            await webhook.sendMessage(
                `🚀 **Missing Log Processor Started**\n` +
                `📊 Dataset: \`${path.basename(datasetDir)}\`\n` +
                `📝 Items to process: ${filteredItems.length}\n` +
                `🔎 Filters: Project=${projectFilter || 'all'}, Type=${typeFilter || 'all'}`
            );
        }
        
        // LLMFlowController の動的インポート
        const LLMFlowControllerModule = await import('../dist/js/modules/llmFlowController.js');
        const LLMFlowController = LLMFlowControllerModule.default;
        
        // 各アイテムを順次処理
        let processedCount = 0;
        let errorCount = 0;
        const startTime = Date.now();
        let lastReportTime = startTime;
        const REPORT_INTERVAL = 10 * 60 * 1000; // 10分ごとに報告
        
        for (const [index, item] of filteredItems.entries()) {
            consoleLogger.forceLog(`\n[${index + 1}/${filteredItems.length}] Processing: ${item.project}/${item.type}/${item.name}`);
            
            try {
                // プロジェクトパスを設定（premerge と merge/commit_snapshot ディレクトリを探す）
                const projectPath = item.dataPath;
                
                const entries = fs.readdirSync(projectPath);
                
                // premerge, premerge_xxx のいずれかを探す
                const premergeDirName = entries.find(name => {
                    const fullPath = path.join(projectPath, name);
                    return fs.statSync(fullPath).isDirectory() && 
                           (name === 'premerge' || name.startsWith('premerge_'));
                });
                
                // merge_xxx または commit_snapshot_xxx を探す
                let mergeDirName = entries.find(name => {
                    const fullPath = path.join(projectPath, name);
                    return fs.statSync(fullPath).isDirectory() && name.startsWith('merge_');
                });
                
                // merge_がなければcommit_snapshot_を探す
                if (!mergeDirName) {
                    mergeDirName = entries.find(name => {
                        const fullPath = path.join(projectPath, name);
                        return fs.statSync(fullPath).isDirectory() && name.startsWith('commit_snapshot_');
                    });
                }
                
                if (!premergeDirName) {
                    throw new Error(`No premerge directory found in ${projectPath}`);
                }
                
                const premergeFullPath = path.join(projectPath, premergeDirName);
                consoleLogger.forceLog(`   Using premerge: ${premergeDirName}`);
                
                if (mergeDirName) {
                    consoleLogger.forceLog(`   Found merge: ${mergeDirName}`);
                }
                
                // LLMFlowController を実行（TUI設定を含むオプションを渡す）
                const controller = new LLMFlowController(
                    premergeFullPath,
                    item.name,  // pullRequestTitle
                    {
                        enablePreVerification: false,
                        // TUI設定は環境変数で制御（USE_BLESSED_VIEW=true）
                        // LLMFlowControllerは内部でProgressTrackerを初期化しないため、
                        // BatchProcessControllerとは異なり、TUIは表示されない
                    }
                );
                await controller.run();
                
                processedCount++;
                consoleLogger.forceLog(`✅ Completed: ${item.name}`);
                
                // 進捗を定期的にDiscordに送信（時間ベース + 5件ごと）
                const now = Date.now();
                const shouldReportByTime = (now - lastReportTime) >= REPORT_INTERVAL;
                const shouldReportByCount = (index + 1) % 5 === 0;
                
                if (webhook && (shouldReportByTime || shouldReportByCount)) {
                    const elapsed = now - startTime;
                    const elapsedMin = Math.floor(elapsed / 60000);
                    const avgTimePerItem = processedCount > 0 ? elapsed / processedCount : 0;
                    const remaining = (filteredItems.length - processedCount) * avgTimePerItem;
                    const remainingMin = Math.floor(remaining / 60000);
                    const successRate = processedCount > 0 ? Math.floor(((processedCount - errorCount) / processedCount) * 100) : 0;
                    
                    await webhook.sendMessage(
                        `📊 **Progress Update**\n` +
                        `Processed: ${processedCount}/${filteredItems.length} (${Math.floor((processedCount / filteredItems.length) * 100)}%)\n` +
                        `✅ Success: ${processedCount - errorCount} (${successRate}%)\n` +
                        `❌ Errors: ${errorCount}\n` +
                        `⏱️ Elapsed: ${elapsedMin}min\n` +
                        `⏳ ETA: ${remainingMin}min\n` +
                        `📝 Last: ${item.project}/${item.name}`
                    );
                    lastReportTime = now;
                }
                
            } catch (error) {
                errorCount++;
                consoleLogger.forceLog(`❌ Error processing ${item.name}: ${error.message}`);
                console.error(error);
                
                // エラーが多すぎる場合は中断
                if (errorCount > 10) {
                    consoleLogger.forceLog('\n❌ Too many errors. Stopping...');
                    break;
                }
            }
        }
        
        const totalTime = Date.now() - startTime;
        const totalMin = Math.floor(totalTime / 60000);
        const avgTime = processedCount > 0 ? Math.floor(totalTime / processedCount / 1000) : 0;
        const successRate = processedCount > 0 ? Math.floor(((processedCount - errorCount) / processedCount) * 100) : 0;
        
        consoleLogger.forceLog('\n✅ Processing completed!');
        consoleLogger.forceLog(`   Processed: ${processedCount}/${filteredItems.length}`);
        consoleLogger.forceLog(`   Errors: ${errorCount}`);
        consoleLogger.forceLog(`   Total Time: ${totalMin}min`);
        
        if (webhook) {
            await webhook.sendMessage(
                `✅ **Missing Log Processor Completed**\n` +
                `📝 Processed: ${processedCount}/${filteredItems.length}\n` +
                `✅ Success: ${processedCount - errorCount} (${successRate}%)\n` +
                `❌ Errors: ${errorCount}\n` +
                `⏱️ Total Time: ${totalMin}min\n` +
                `⏱️ Avg Time: ${avgTime}s per item`
            );
        }
        
    } catch (error) {
        consoleLogger.forceLog(`\n❌ Error during processing: ${error.message}`);
        console.error(error);
        
        if (DISCORD_WEBHOOK_URL) {
            const webhook = new DiscordWebhook(DISCORD_WEBHOOK_URL);
            await webhook.sendMessage(
                `❌ **Missing Log Processor Failed**\n` +
                `Error: \`${error.message}\``
            );
        }
        
        process.exit(1);
    }
}

// エラーハンドリング
process.on('unhandledRejection', (reason, promise) => {
    consoleLogger.forceLog('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    consoleLogger.forceLog('❌ Uncaught Exception:', error);
    process.exit(1);
});

// 実行
main().catch((error) => {
    consoleLogger.forceLog('❌ Fatal error:', error);
    process.exit(1);
});
