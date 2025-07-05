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
    const projectDirs = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());

    for (const projectName of projectDirs) {
        const projectPath = path.join(datasetDir, projectName);
        let categoryDirs: string[] = [];
        try {
            categoryDirs = fs.readdirSync(projectPath).filter(dir => fs.statSync(path.join(projectPath, dir)).isDirectory());
        } catch (err) {
            console.error(`❌ Error reading category directories in ${projectPath}:`, (err as Error).message);
            continue;
        }

        for (const category of categoryDirs) {
            const categoryPath = path.join(projectPath, category);
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

                // LLMFlowControllerのConfig.inputProjectDirをpremergeDirにセットして実行
                const controller = new LLMFlowController();
                // ConfigのinputProjectDirを動的にセット
                (controller as any).config = undefined; // 強制再初期化
                (controller as any).fileManager = undefined;
                (controller as any).messageHandler = undefined;
                (controller as any).openAIClient = undefined;
                (controller as any).logger = undefined;
                (controller as any).currentMessages = [];
                (controller as any).prompt_template_name = '';
                (controller as any).next_prompt_content = null;

                // run()内でprepareInitialContext()が呼ばれるので、そこでConfigが初期化される
                // ただしConfigのinputProjectDirをpremergeDirに差し替える必要があるため、Configの設計を修正するのが理想
                // ここでは暫定的にグローバル変数で渡すか、prepareInitialContextを修正する必要あり
                // コメントで仮対応
                (controller as any).__overrideInputProjectDir = premergeDir;

                // run()を実行
                await controller.run();

                // %Fin%で次のデータセットへ（run()内で自動判定される想定）
            }
        }
    }
}


