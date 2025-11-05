#!/usr/bin/env node

/**
 * エラーレポートを基に失敗したPRのみをリトライするスクリプト
 * Usage: node scripts/RetryFailedScript.js <error_report_path> [options]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトルートディレクトリ
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * エラーレポートを読み込む
 */
function loadErrorReport(reportPath) {
    try {
        const absolutePath = path.isAbsolute(reportPath) 
            ? reportPath 
            : path.join(PROJECT_ROOT, reportPath);
        
        if (!fs.existsSync(absolutePath)) {
            console.error(`❌ Error report not found: ${absolutePath}`);
            return null;
        }

        const content = fs.readFileSync(absolutePath, 'utf-8');
        const errors = JSON.parse(content);
        
        if (!Array.isArray(errors)) {
            console.error('❌ Error report is not an array');
            return null;
        }

        return errors;
    } catch (error) {
        console.error(`❌ Failed to load error report: ${error.message}`);
        return null;
    }
}

/**
 * 最新のエラーレポートを自動検出
 */
function findLatestErrorReport() {
    const outputDir = path.join(PROJECT_ROOT, 'output');
    
    if (!fs.existsSync(outputDir)) {
        console.error(`❌ Output directory not found: ${outputDir}`);
        return null;
    }

    const files = fs.readdirSync(outputDir)
        .filter(f => f.startsWith('error_report_') && f.endsWith('.json'))
        .map(f => ({
            name: f,
            path: path.join(outputDir, f),
            mtime: fs.statSync(path.join(outputDir, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
        console.error('❌ No error reports found in output directory');
        return null;
    }

    return files[0].path;
}

/**
 * エラーをリポジトリとカテゴリごとにグループ化
 */
function groupErrorsByRepoAndCategory(errors) {
    const grouped = {};

    for (const error of errors) {
        const repo = error.repositoryName || 'unknown';
        const category = error.category || 'unknown';
        const prPath = error.pullRequestPath || error.premergeDir;

        if (!prPath) {
            console.warn(`⚠️  Skipping error without path: ${error.pullRequestTitle}`);
            continue;
        }

        if (!grouped[repo]) {
            grouped[repo] = {};
        }

        if (!grouped[repo][category]) {
            grouped[repo][category] = [];
        }

        grouped[repo][category].push({
            title: error.pullRequestTitle,
            path: prPath,
            premergeDir: error.premergeDir,
            errorType: error.errorType,
            errorMessage: error.errorMessage,
            timestamp: error.timestamp
        });
    }

    return grouped;
}

/**
 * リトライ用の設定ファイルを生成
 */
function generateRetryConfig(groupedErrors, outputPath) {
    const config = {
        repositories: {}
    };

    for (const [repo, categories] of Object.entries(groupedErrors)) {
        config.repositories[repo] = {
            categories: {}
        };

        for (const [category, prs] of Object.entries(categories)) {
            config.repositories[repo].categories[category] = prs.map(pr => ({
                title: pr.title,
                path: pr.path,
                premergeDir: pr.premergeDir
            }));
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`📝 Retry configuration saved to: ${outputPath}`);
    
    return config;
}

/**
 * リトライ統計を表示
 */
function displayRetryStats(groupedErrors) {
    console.log('\n📊 RETRY STATISTICS');
    console.log('================================');
    
    let totalPRs = 0;
    const repoStats = [];

    for (const [repo, categories] of Object.entries(groupedErrors)) {
        let repoTotal = 0;
        const categoryStats = [];

        for (const [category, prs] of Object.entries(categories)) {
            repoTotal += prs.length;
            categoryStats.push(`  📁 ${category}: ${prs.length} PRs`);
        }

        totalPRs += repoTotal;
        repoStats.push(`📦 ${repo}: ${repoTotal} PRs total`);
        repoStats.push(...categoryStats);
    }

    console.log(`🔄 Total PRs to retry: ${totalPRs}`);
    console.log(`📦 Repositories: ${Object.keys(groupedErrors).length}`);
    console.log('\nBreakdown:');
    repoStats.forEach(stat => console.log(stat));
    console.log('================================\n');
}

/**
 * リトライ用のバッチ処理リストを生成
 */
function generateRetryList(groupedErrors, outputPath) {
    const retryList = [];

    for (const [repo, categories] of Object.entries(groupedErrors)) {
        for (const [category, prs] of Object.entries(categories)) {
            for (const pr of prs) {
                retryList.push({
                    repository: repo,
                    category: category,
                    title: pr.title,
                    premergeDir: pr.premergeDir,
                    path: pr.path,
                    originalError: {
                        type: pr.errorType,
                        message: pr.errorMessage,
                        timestamp: pr.timestamp
                    }
                });
            }
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(retryList, null, 2), 'utf-8');
    console.log(`📋 Retry list saved to: ${outputPath}`);
    
    return retryList;
}

/**
 * 使用方法を表示
 */
function showUsage() {
    console.log('\n📖 Retry Failed PRs Script');
    console.log('================================');
    console.log('Usage: node scripts/RetryFailedScript.js [error_report_path] [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  error_report_path    Path to error report JSON file (optional)');
    console.log('                       If not provided, uses the latest error report');
    console.log('');
    console.log('Options:');
    console.log('  --config-only        Only generate retry config without executing');
    console.log('  --list-only          Only display statistics without generating files');
    console.log('  --output-dir <dir>   Custom output directory for retry files');
    console.log('  --help               Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/RetryFailedScript.js');
    console.log('  node scripts/RetryFailedScript.js /app/output/error_report_2025-11-04T16-27-08-069+09-00.json');
    console.log('  node scripts/RetryFailedScript.js --config-only');
    console.log('  node scripts/RetryFailedScript.js --list-only');
    console.log('  node scripts/RetryFailedScript.js --output-dir /tmp/retry');
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

    // オプション解析
    const configOnly = args.includes('--config-only');
    const listOnly = args.includes('--list-only');
    const outputDirIndex = args.indexOf('--output-dir');
    const customOutputDir = outputDirIndex !== -1 && args[outputDirIndex + 1]
        ? args[outputDirIndex + 1]
        : path.join(PROJECT_ROOT, 'output', 'retry');

    // エラーレポートパスの取得
    let errorReportPath = args.find(arg => !arg.startsWith('--') && arg !== args[outputDirIndex + 1]);

    if (!errorReportPath) {
        console.log('🔍 No error report specified, searching for latest...');
        errorReportPath = findLatestErrorReport();
        
        if (!errorReportPath) {
            console.error('❌ Could not find any error reports');
            showUsage();
            process.exit(1);
        }
    }

    console.log(`📂 Using error report: ${errorReportPath}`);

    // エラーレポートを読み込む
    const errors = loadErrorReport(errorReportPath);
    
    if (!errors) {
        process.exit(1);
    }

    if (errors.length === 0) {
        console.log('✅ No errors found in the report. Nothing to retry!');
        process.exit(0);
    }

    console.log(`📊 Found ${errors.length} errors in the report`);

    // エラーをグループ化
    const groupedErrors = groupErrorsByRepoAndCategory(errors);

    // 統計を表示
    displayRetryStats(groupedErrors);

    // list-only モードの場合はここで終了
    if (listOnly) {
        console.log('ℹ️  List-only mode: exiting without generating files');
        process.exit(0);
    }

    // 出力ディレクトリを作成
    if (!fs.existsSync(customOutputDir)) {
        fs.mkdirSync(customOutputDir, { recursive: true });
        console.log(`📁 Created output directory: ${customOutputDir}`);
    }

    // リトライ設定を生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const configPath = path.join(customOutputDir, `retry_config_${timestamp}.json`);
    const listPath = path.join(customOutputDir, `retry_list_${timestamp}.json`);

    generateRetryConfig(groupedErrors, configPath);
    generateRetryList(groupedErrors, listPath);

    // config-only モードの場合はここで終了
    if (configOnly) {
        console.log('ℹ️  Config-only mode: files generated, exiting without execution');
        console.log('\n📝 To retry these PRs, use:');
        console.log(`   node scripts/BatchRetryScript.js ${listPath}`);
        process.exit(0);
    }

    // リトライ実行の指示
    console.log('\n🚀 NEXT STEPS');
    console.log('================================');
    console.log('To retry the failed PRs, run:');
    console.log(`   node scripts/BatchRetryScript.js ${listPath}`);
    console.log('');
    console.log('Or manually process individual PRs using:');
    console.log('   node scripts/MainScript.js <premerge_dir>');
    console.log('================================\n');
}

// スクリプト実行
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
