import fs from 'fs';
import path from 'path';
import { LLMFlowController } from './llmFlowController.js';


if (import.meta.url === `file://${process.argv[1]}`) {
    /*config*/
    const datasetDir = "/app/dataset/test";

    await runForAllDatasets(datasetDir);
    console.log("✅ Batch processing completed.");
}

/**
 * 指定したデータセットディレクトリ配下の全てのpullrequest/issueごとに
 * LLMFlowControllerのバグ修正フローを実行するバッチランナー
 * @param datasetDir 例: /app/dataset/filtered_commit や /app/dataset/test
 */
export async function runForAllDatasets(datasetDir: string) {
    const datasetDirs = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());

    for (const repositoryName of datasetDirs) {
        const savedRepositoryPath = path.join(datasetDir, repositoryName);
        let categoryDirs: string[] = [];
        try {
            categoryDirs = fs.readdirSync(savedRepositoryPath).filter(dir => fs.statSync(path.join(savedRepositoryPath, dir)).isDirectory());
        } catch (err) {
            console.error(`❌ Error reading category directories in ${savedRepositoryPath}:`, (err as Error).message);
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


