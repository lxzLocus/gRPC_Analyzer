/**
 * 未処理PRのみを処理するスクリプト
 * 11月13-14日のログが存在しないPRだけを処理
 * 
 * 使用方法:
 *   node scripts/ProcessUnprocessedOnly.js
 */

import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

// ES module環境での __dirname の取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数の設定
config({ path: path.join(__dirname, '..', '.env') });

const DATASET_DIR = "/app/dataset/filtered_fewChanged";
const LOG_DIR = "/app/log";

/**
 * ディレクトリ一覧の取得（アルファベット順）
 */
function getDirectories(dirPath) {
    try {
        return fs.readdirSync(dirPath)
            .filter(item => fs.statSync(path.join(dirPath, item)).isDirectory())
            .sort();
    } catch (error) {
        return [];
    }
}

/**
 * 11月13-14日のログが存在するかチェック
 */
function hasRecentLog(project, category, pr) {
    const logPath = path.join(LOG_DIR, project, category, pr);
    
    if (!fs.existsSync(logPath)) {
        return false;
    }

    try {
        const files = fs.readdirSync(logPath);
        const recentLogs = files.filter(f => 
            f.startsWith('2025-11-13') || f.startsWith('2025-11-14')
        );
        return recentLogs.length > 0;
    } catch (error) {
        return false;
    }
}

/**
 * 未処理PRのリストを取得
 */
function getUnprocessedPRs() {
    const unprocessed = [];
    const projects = getDirectories(DATASET_DIR);

    projects.forEach(project => {
        const projectPath = path.join(DATASET_DIR, project);
        const categories = getDirectories(projectPath);

        categories.forEach(category => {
            const categoryPath = path.join(projectPath, category);
            const prs = getDirectories(categoryPath);

            prs.forEach(pr => {
                if (!hasRecentLog(project, category, pr)) {
                    unprocessed.push({
                        project,
                        category,
                        pr,
                        path: path.join(categoryPath, pr)
                    });
                }
            });
        });
    });

    return unprocessed;
}

/**
 * メイン処理
 */
async function main() {
    console.log('🔍 Checking for unprocessed PRs (Nov 13-14)...');
    console.log('=' .repeat(80));

    const unprocessedPRs = getUnprocessedPRs();
    const totalPRs = 86; // 既知の総数

    console.log(`\n📊 Status:`);
    console.log(`   Total PRs:      ${totalPRs}`);
    console.log(`   Processed:      ${totalPRs - unprocessedPRs.length}`);
    console.log(`   Unprocessed:    ${unprocessedPRs.length}`);
    console.log('');

    if (unprocessedPRs.length === 0) {
        console.log('✅ All PRs have been processed!');
        process.exit(0);
    }

    console.log('📝 Unprocessed PRs:');
    console.log('-'.repeat(80));
    
    // プロジェクト別にグループ化
    const byProject = {};
    unprocessedPRs.forEach(item => {
        if (!byProject[item.project]) {
            byProject[item.project] = [];
        }
        byProject[item.project].push(item);
    });

    Object.keys(byProject).sort().forEach(project => {
        console.log(`\n${project} (${byProject[project].length} PRs):`);
        byProject[project].forEach(item => {
            console.log(`   - ${item.category}/${item.pr}`);
        });
    });

    console.log('\n' + '='.repeat(80));
    console.log('🚀 Starting processing of unprocessed PRs...\n');

    // コントローラーを動的インポート
    const controllerModule = await import('../src/Controller/Controller.js');
    const { datasetLoop } = controllerModule;

    // 処理オプション
    const processingOptions = {
        baseOutputDir: "/app/output",
        maxRetries: 3,
        memoryCleanupInterval: 5,
        timeoutMs: 15 * 60 * 1000,
        enableGarbageCollection: true,
        enablePreVerification: false,
        forceTUI: true,
        // 未処理PRリストをフィルタとして渡す
        unprocessedOnly: {
            enabled: true,
            list: unprocessedPRs.map(item => ({
                repositoryName: item.project,
                category: item.category,
                pullRequestTitle: item.pr
            }))
        }
    };

    try {
        await datasetLoop(DATASET_DIR, "/app/output", {
            generateReport: true,
            generateErrorReport: true,
            processingOptions: processingOptions
        });
        console.log('\n✅ Processing completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Processing failed:', error.message);
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
