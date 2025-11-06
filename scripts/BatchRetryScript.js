#!/usr/bin/env node

/**
 * リトライリストを基にバッチ処理を実行するスクリプト
 * Usage: node scripts/BatchRetryScript.js <retry_list_path> [options]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * リトライリストを読み込む
 */
function loadRetryList(listPath) {
    try {
        const absolutePath = path.isAbsolute(listPath) 
            ? listPath 
            : path.join(PROJECT_ROOT, listPath);
        
        if (!fs.existsSync(absolutePath)) {
            console.error(`❌ Retry list not found: ${absolutePath}`);
            return null;
        }

        const content = fs.readFileSync(absolutePath, 'utf-8');
        const retryList = JSON.parse(content);
        
        if (!Array.isArray(retryList)) {
            console.error('❌ Retry list is not an array');
            return null;
        }

        return retryList;
    } catch (error) {
        console.error(`❌ Failed to load retry list: ${error.message}`);
        return null;
    }
}

/**
 * 単一のPRを処理
 */
function processItem(item, configPath, enablePreVerification) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔄 Processing: ${item.title}`);
        console.log(`📦 Repository: ${item.repository}`);
        console.log(`📁 Category: ${item.category}`);
        console.log(`📂 Path: ${item.premergeDir}`);
        console.log(`${'='.repeat(60)}\n`);

        const args = [
            '--expose-gc',
            path.join(PROJECT_ROOT, 'scripts', 'MainScript.js')
        ];

        // premerge ディレクトリを引数として追加
        if (item.premergeDir) {
            args.push(item.premergeDir);
        }

        // Pre-verification オプション
        if (enablePreVerification) {
            args.push('--enable-pre-verification');
        }

        // 環境変数の設定
        const env = { ...process.env };
        if (configPath) {
            env.CONFIG_PATH = configPath;
        }

        const child = spawn('node', args, {
            cwd: PROJECT_ROOT,
            env: env,
            stdio: 'inherit'
        });

        child.on('close', (code) => {
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            if (code === 0) {
                console.log(`\n✅ Success: ${item.title} (${duration}s)`);
                resolve({ success: true, item, duration, code });
            } else {
                console.log(`\n❌ Failed: ${item.title} (${duration}s, exit code: ${code})`);
                resolve({ success: false, item, duration, code });
            }
        });

        child.on('error', (error) => {
            const duration = Math.round((Date.now() - startTime) / 1000);
            console.error(`\n❌ Error: ${item.title}`, error);
            resolve({ success: false, item, duration, error: error.message });
        });
    });
}

/**
 * バッチ処理を実行
 */
async function processBatch(retryList, options) {
    const results = [];
    const startTime = Date.now();

    console.log(`\n🚀 Starting batch retry of ${retryList.length} PRs...`);
    console.log(`⚙️  Config: ${options.configPath || 'default'}`);
    console.log(`🔍 Pre-verification: ${options.enablePreVerification ? 'enabled' : 'disabled'}`);
    console.log(`🔢 Max parallel: ${options.maxParallel}`);
    console.log(`⏸️  Delay between PRs: ${options.delayMs}ms\n`);

    // 並列処理の設定
    const maxParallel = options.maxParallel || 1;
    const queue = [...retryList];
    const running = new Set();

    while (queue.length > 0 || running.size > 0) {
        // 並列数に達していない場合、新しいタスクを開始
        while (running.size < maxParallel && queue.length > 0) {
            const item = queue.shift();
            
            const promise = processItem(
                item,
                options.configPath,
                options.enablePreVerification
            ).then(result => {
                running.delete(promise);
                results.push(result);
                return result;
            });

            running.add(promise);

            // 次のタスクを開始する前に遅延
            if (options.delayMs > 0 && queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, options.delayMs));
            }
        }

        // 少なくとも1つのタスクが完了するまで待機
        if (running.size > 0) {
            await Promise.race(running);
        }
    }

    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    
    // 結果をサマリー
    return summarizeResults(results, totalDuration);
}

/**
 * 結果をサマリーして表示
 */
function summarizeResults(results, totalDuration) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 BATCH RETRY SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    console.log(`📈 Success Rate: ${Math.round((successful.length / results.length) * 100)}%`);
    console.log(`⏱️  Total Duration: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);
    console.log(`${'='.repeat(60)}\n`);

    if (failed.length > 0) {
        console.log('❌ Failed PRs:');
        failed.forEach(result => {
            console.log(`   - ${result.item.title}`);
            console.log(`     Repository: ${result.item.repository}`);
            console.log(`     Path: ${result.item.premergeDir}`);
            if (result.code !== undefined) {
                console.log(`     Exit Code: ${result.code}`);
            }
            if (result.error) {
                console.log(`     Error: ${result.error}`);
            }
        });
        console.log('');
    }

    return {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        successRate: (successful.length / results.length) * 100,
        totalDuration,
        results
    };
}

/**
 * 結果をファイルに保存
 */
function saveResults(summary, outputPath) {
    const timestamp = new Date().toISOString();
    const report = {
        timestamp,
        summary: {
            total: summary.total,
            successful: summary.successful,
            failed: summary.failed,
            successRate: summary.successRate,
            totalDuration: summary.totalDuration
        },
        results: summary.results.map(r => ({
            repository: r.item.repository,
            category: r.item.category,
            title: r.item.title,
            premergeDir: r.item.premergeDir,
            success: r.success,
            duration: r.duration,
            exitCode: r.code,
            error: r.error
        }))
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`📄 Results saved to: ${outputPath}`);
}

/**
 * 使用方法を表示
 */
function showUsage() {
    console.log('\n📖 Batch Retry Script');
    console.log('================================');
    console.log('Usage: node scripts/BatchRetryScript.js <retry_list_path> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  retry_list_path      Path to retry list JSON file (required)');
    console.log('');
    console.log('Options:');
    console.log('  --config <path>              Path to config JSON file');
    console.log('  --enable-pre-verification    Enable pre-verification phase');
    console.log('  --max-parallel <n>           Max parallel processes (default: 1)');
    console.log('  --delay <ms>                 Delay between PRs in ms (default: 0)');
    console.log('  --output <path>              Output path for results');
    console.log('  --help                       Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/BatchRetryScript.js output/retry/retry_list_2025-11-04.json');
    console.log('  node scripts/BatchRetryScript.js output/retry/retry_list_2025-11-04.json --config config/config_baseline.json');
    console.log('  node scripts/BatchRetryScript.js output/retry/retry_list_2025-11-04.json --enable-pre-verification');
    console.log('  node scripts/BatchRetryScript.js output/retry/retry_list_2025-11-04.json --max-parallel 2 --delay 1000');
    console.log('================================\n');
}

/**
 * メイン処理
 */
async function main() {
    const args = process.argv.slice(2);

    // ヘルプ表示
    if (args.includes('--help') || args.includes('-h')) {
        showUsage();
        process.exit(0);
    }

    // 引数の解析
    const listPath = args.find(arg => !arg.startsWith('--'));
    
    if (!listPath) {
        console.error('❌ Retry list path is required');
        showUsage();
        process.exit(1);
    }

    // オプションの解析
    const options = {
        configPath: null,
        enablePreVerification: args.includes('--enable-pre-verification'),
        maxParallel: 1,
        delayMs: 0,
        outputPath: null
    };

    // --config オプション
    const configIndex = args.indexOf('--config');
    if (configIndex !== -1 && args[configIndex + 1]) {
        options.configPath = args[configIndex + 1];
    }

    // --max-parallel オプション
    const parallelIndex = args.indexOf('--max-parallel');
    if (parallelIndex !== -1 && args[parallelIndex + 1]) {
        options.maxParallel = parseInt(args[parallelIndex + 1], 10);
        if (isNaN(options.maxParallel) || options.maxParallel < 1) {
            console.error('❌ Invalid --max-parallel value');
            process.exit(1);
        }
    }

    // --delay オプション
    const delayIndex = args.indexOf('--delay');
    if (delayIndex !== -1 && args[delayIndex + 1]) {
        options.delayMs = parseInt(args[delayIndex + 1], 10);
        if (isNaN(options.delayMs) || options.delayMs < 0) {
            console.error('❌ Invalid --delay value');
            process.exit(1);
        }
    }

    // --output オプション
    const outputIndex = args.indexOf('--output');
    if (outputIndex !== -1 && args[outputIndex + 1]) {
        options.outputPath = args[outputIndex + 1];
    } else {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        options.outputPath = path.join(PROJECT_ROOT, 'output', 'retry', `retry_results_${timestamp}.json`);
    }

    // リトライリストを読み込む
    const retryList = loadRetryList(listPath);
    
    if (!retryList) {
        process.exit(1);
    }

    if (retryList.length === 0) {
        console.log('✅ Retry list is empty. Nothing to process!');
        process.exit(0);
    }

    // 出力ディレクトリを作成
    const outputDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // バッチ処理を実行
    try {
        const summary = await processBatch(retryList, options);
        
        // 結果を保存
        saveResults(summary, options.outputPath);

        // 終了コードを設定
        process.exit(summary.failed > 0 ? 1 : 0);
    } catch (error) {
        console.error('❌ Batch processing failed:', error);
        process.exit(1);
    }
}

// スクリプト実行
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
