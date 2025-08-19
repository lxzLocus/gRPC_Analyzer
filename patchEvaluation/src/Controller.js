import fs from 'fs/promises';
import path from 'path';

async function datasetLoop(datasetDir, aprOutputPath) {
    const projectDirs = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());

    // forEach を for...of に変更
    for (const projectName of projectDirs) {
        const projectPath = path.join(datasetDir, projectName);
        let categoryDirs = [];
        try {
            categoryDirs = fs.readdirSync(projectPath).filter(dir => fs.statSync(path.join(projectPath, dir)).isDirectory());
        } catch (err) {
            console.error(`❌ Error reading category directories in ${projectPath}:`, err.message);
            continue; // 次のプロジェクトへ
        }

        // forEach を for...of に変更
        for (const category of categoryDirs) {
            const categoryPath = path.join(projectPath, category);

            const titleDirs = fs.readdirSync(categoryPath).filter(dir => fs.statSync(path.join(categoryPath, dir)).isDirectory());

            // forEach を for...of に変更
            for (const pullRequestTitle of titleDirs) {
                const pullRequestPath = path.join(categoryPath, pullRequestTitle);

                console.log(`Processing: ${projectName}/${pullRequestTitle}`);

                //"premerge_"で始まるサブディレクトリを取得
                const premergePath = fs.readdirSync(pullRequestPath)
                    .map(dir => path.join(pullRequestPath, dir))  // フルパスに変換
                    .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('premerge'));

                // "merge_"で始まるサブディレクトリを取得
                let mergePath = fs.readdirSync(pullRequestPath)
                    .map(dir => path.join(pullRequestPath, dir))
                    .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('merge'));
                // "merge_"がなければ"commit_snapshot_"を探す
                if (!mergePath) {
                    mergePath = fs.readdirSync(pullRequestPath)
                        .map(dir => path.join(pullRequestPath, dir))
                        .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('commit_snapshot_'));
                }


                //APRログのパスの組み立て
                const aprLogRelativePath = path.join(aprOutputPath, path.relative(datasetDir, pullRequestPath));


                //ログの取得と，修正パッチの対象の取得
                
            }
        }
    }
}


//個別テスト
if (import.meta.url === `file://${process.argv[1]}`) {
    const datasetPath = "/app/dataset/filtered_fewChanged";
    const aprOutputPath = "/app/apr-logs";

    datasetLoop(datasetPath, aprOutputPath)
        .then(() => console.log("Patch evaluation successfully."))
        .catch(err => console.error("Error during patch evaluation:", err));
}