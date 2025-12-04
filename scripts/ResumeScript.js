/**
 * レジューム専用スクリプト
 * 指定したリポジトリ/カテゴリ/PRから処理を再開する
 * 
 * 使用方法:
 *   node scripts/ResumeScript.js <repo> <category> <pr-title>
 * 
 * 例:
 *   node scripts/ResumeScript.js boulder pullrequest "Update_VA_RPCs_to_proto3"
 */

import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES module環境での __dirname の取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数の設定
config({ path: path.join(__dirname, '..', '.env') });

/**
 * データセット設定
 */
const DATASET_DIR = "/app/dataset/filtered_fewChanged";

/**
 * デフォルト処理オプション
 */
const DEFAULT_PROCESSING_OPTIONS = {
    baseOutputDir: "/app/output",
    maxRetries: 3,
    memoryCleanupInterval: 5,
    timeoutMs: 15 * 60 * 1000,
    enableGarbageCollection: true,
    enablePreVerification: false,
    forceTUI: true
};

/**
 * 使用方法の表示
 */
function showUsage() {
    console.log(`
🔄 Resume Script - Continue processing from a specific PR

Usage:
  node scripts/ResumeScript.js <repo> <category> <pr-title> [options]

Arguments:
  repo         Repository name (e.g., boulder)
  category     Category name (e.g., pullrequest)
  pr-title     Pull request title (e.g., "Update_VA_RPCs_to_proto3")

Options:
  --skip       Skip the specified PR and start from the next one
  --list       List all PRs in the specified category and exit

Examples:
  # Resume from a specific PR
  node scripts/ResumeScript.js boulder pullrequest "Update_VA_RPCs_to_proto3"

  # Skip the specified PR and continue from the next
  node scripts/ResumeScript.js boulder pullrequest "Update_VA_RPCs_to_proto3" --skip

  # List all PRs in a category
  node scripts/ResumeScript.js boulder pullrequest --list
`);
}

/**
 * ディレクトリ一覧の取得（アルファベット順）
 */
function getDirectories(dirPath) {
    try {
        return fs.readdirSync(dirPath)
            .filter(item => fs.statSync(path.join(dirPath, item)).isDirectory())
            .sort(); // アルファベット順にソート
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error.message);
        return [];
    }
}

/**
 * PRリストの表示
 */
function listPullRequests(repo, category) {
    const categoryPath = path.join(DATASET_DIR, repo, category);
    
    if (!fs.existsSync(categoryPath)) {
        console.error(`❌ Category not found: ${categoryPath}`);
        return;
    }

    const prs = getDirectories(categoryPath);
    
    console.log(`\n📋 Pull Requests in ${repo}/${category}:`);
    console.log(`   Total: ${prs.length}\n`);
    
    prs.forEach((pr, index) => {
        console.log(`   ${String(index + 1).padStart(3, ' ')}. ${pr}`);
    });
    
    console.log('');
}

/**
 * 処理開始位置の計算
 */
function calculateStartPosition(repo, category, prTitle, skipTarget = false) {
    // リポジトリ一覧を取得
    const allRepos = getDirectories(DATASET_DIR);
    const repoIndex = allRepos.indexOf(repo);
    
    if (repoIndex === -1) {
        throw new Error(`Repository not found: ${repo}`);
    }

    // カテゴリ一覧を取得
    const categoryPath = path.join(DATASET_DIR, repo);
    const allCategories = getDirectories(categoryPath);
    const categoryIndex = allCategories.indexOf(category);
    
    if (categoryIndex === -1) {
        throw new Error(`Category not found: ${category}`);
    }

    // PR一覧を取得
    const prPath = path.join(DATASET_DIR, repo, category);
    const allPRs = getDirectories(prPath);
    let prIndex = allPRs.indexOf(prTitle);
    
    if (prIndex === -1) {
        throw new Error(`Pull Request not found: ${prTitle}`);
    }

    // --skipオプションが指定されている場合は次のPRから開始
    if (skipTarget) {
        prIndex++;
        if (prIndex >= allPRs.length) {
            console.log(`⚠️  No more PRs after ${prTitle} in ${repo}/${category}`);
            console.log(`   Moving to next category or repository...`);
            prIndex = 0;
            // 次のカテゴリまたはリポジトリに移動する処理は後で実装
        }
    }

    return {
        repoIndex,
        categoryIndex,
        prIndex,
        allRepos,
        allCategories,
        allPRs,
        startRepo: repo,
        startCategory: category,
        startPR: skipTarget && prIndex < allPRs.length ? allPRs[prIndex] : prTitle
    };
}

/**
 * メイン実行関数
 */
async function main() {
    const args = process.argv.slice(2);

    // 引数チェック
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        showUsage();
        process.exit(0);
    }

    const repo = args[0];
    const category = args[1];
    const prTitle = args[2];
    const skipTarget = args.includes('--skip');
    const listMode = args.includes('--list');

    // リストモード
    if (listMode) {
        if (!repo || !category) {
            console.error('❌ Repository and category required for --list mode');
            showUsage();
            process.exit(1);
        }
        listPullRequests(repo, category);
        process.exit(0);
    }

    // 通常モード - 引数検証
    if (!repo || !category || !prTitle) {
        console.error('❌ Missing required arguments');
        showUsage();
        process.exit(1);
    }

    try {
        // 開始位置を計算
        const position = calculateStartPosition(repo, category, prTitle, skipTarget);

        console.log('🔄 Resume Script Starting...');
        console.log('========================================');
        console.log(`📂 Dataset: ${DATASET_DIR}`);
        console.log(`📍 Resume from:`);
        console.log(`   Repository: ${position.startRepo} (${position.repoIndex + 1}/${position.allRepos.length})`);
        console.log(`   Category: ${position.startCategory} (${position.categoryIndex + 1}/${position.allCategories.length})`);
        console.log(`   Pull Request: ${position.startPR} (${position.prIndex + 1}/${position.allPRs.length})`);
        
        if (skipTarget) {
            console.log(`   ⏭️  Skipping: ${prTitle}`);
        }
        
        console.log('========================================\n');

        // コントローラーを動的インポート
        const controllerModule = await import('../src/Controller/Controller.js');
        const { datasetLoop } = controllerModule;

        // 処理オプションに再開位置を追加
        const processingOptions = {
            ...DEFAULT_PROCESSING_OPTIONS,
            resumeFrom: {
                repositoryName: position.startRepo,
                category: position.startCategory,
                pullRequestTitle: position.startPR
            }
        };

        console.log('🚀 Starting batch processing from resume point...\n');

        // バッチ処理を実行
        await datasetLoop(DATASET_DIR, processingOptions);

        console.log('\n✅ Resume processing completed successfully');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Resume processing failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// エラーハンドラー
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// 実行
main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
