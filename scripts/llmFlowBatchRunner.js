import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import LLMFlowController from '../src/modules/llmFlowController.js';
// 既存の環境変数をクリア（他の設定が残っている場合）
delete process.env.OPENAI_TOKEN;
delete process.env.OPENAI_API_KEY;
// .envファイルを読み込み
config({ path: path.join(process.cwd(), '.env') });
// グレースフルシャットダウンの実装
let isShuttingDown = false;
const gracefulShutdown = (signal) => {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    console.log(`📡 Received ${signal}. Starting graceful shutdown...`);
    // リソースのクリーンアップ
    console.log('🧹 Cleaning up resources...');
    // ガベージコレクション強制実行
    if (global.gc) {
        console.log('🗑️ Running garbage collection...');
        global.gc();
    }
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
};
// シグナルハンドラーの設定
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
// 異常終了のキャッチ
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    console.error('Stack:', error.stack);
    gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});

if (import.meta.url === `file://${process.argv[1]}`) {
    /*config*/
    const datasetDir = "/app/dataset/test";
    try {
        await runForAllDatasets(datasetDir);
        console.log("✅ Batch processing completed.");
        // 明示的なクリーンアップ
        if (global.gc) {
            console.log('🗑️ Final garbage collection...');
            global.gc();
        }
        // 正常終了
        process.exit(0);
    }
    
    catch (error) {
        console.error("❌ Error in batch processing:", error);
        gracefulShutdown('error');
    }
}
/**
 * 指定したデータセットディレクトリ配下の全てのpullrequest/issueごとに
 * LLMFlowControllerのバグ修正フローを実行するバッチランナー
 * @param datasetDir 例: /app/dataset/filtered_commit や /app/dataset/test
 */
export async function runForAllDatasets(datasetDir) {
    const datasetDirs = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());
    for (const repositoryName of datasetDirs) {
        const savedRepositoryPath = path.join(datasetDir, repositoryName);
        let categoryDirs = [];
        try {
            categoryDirs = fs.readdirSync(savedRepositoryPath).filter(dir => fs.statSync(path.join(savedRepositoryPath, dir)).isDirectory());
        }
        catch (err) {
            console.error(`❌ Error reading category directories in ${savedRepositoryPath}:`, err.message);
            continue;
        }
        for (const category of categoryDirs) {
            const categoryPath = path.join(savedRepositoryPath, category);
            const titleDirs = fs.readdirSync(categoryPath).filter(dir => fs.statSync(path.join(categoryPath, dir)).isDirectory());
            for (const pullRequestTitle of titleDirs) {
                const pullRequestPath = path.join(categoryPath, pullRequestTitle);
                // premerge_で始まるサブディレクトリを取得
                const premergeDir = fs.readdirSync(pullRequestPath)
                    .map(dir => path.join(pullRequestPath, dir))
                    .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('premerge'));
                if (!premergeDir) {
                    console.warn(`No premerge directory found in ${pullRequestPath}`);
                    continue;
                }
                // 各プルリクエストの premerge ディレクトリを引数に渡して
                // LLMFlowControllerのインスタンスを生成する
                console.log(`🔄 Processing ${pullRequestPath}...`);
                const controller = new LLMFlowController(premergeDir);
                // run()を実行
                await controller.run();
                // %Fin%で次のデータセットへ（run()内で自動判定される想定）
            }
        }
    }
}
//# sourceMappingURL=llmFlowBatchRunner.js.map