/*
Docs

プロンプトに埋め込むための，txtファイルを出力するプログラム

対象
- 01_proto.txt
- 02_protoFileChanges.txt
- 03_fileChanges.txt
- 04_allFilePaths.txt

コードスメルは自分で作成する
- 05_suspectedFiles.txt


リストとその内容
- 01_proto.txt

Diff
- 02_protoFileChanges.txt

変更されたファイルのリストと，その内容（premerge）
- 03_fileChanges.txt

ファイルパスのリスト
- 04_allFilePaths.txt

*/

/*modules*/
const fs = require('fs');
const path = require('path');

const { getChangedFiles } = require('./module/generateFileChanged');


/*config*/
const inputDatasetDir = '/app/dataset/import';

const outputDir = '/app/dataset/filtered';

const filter = [".proto"];

/* __MAIN__ */
if (require.main === module) {
    
    const projectDirs = fs.readdirSync(inputDatasetDir).filter(dir => fs.statSync(path.join(inputDatasetDir, dir)).isDirectory());

    projectDirs.forEach(projectName => {
        const projectPath = path.join(inputDatasetDir, projectName);
        const pullRequestDirs = fs.readdirSync(projectPath).filter(dir => fs.statSync(path.join(projectPath, dir)).isDirectory());

        pullRequestDirs.forEach(pullRequestTitle => {
            const pullRequestPath = path.join(projectPath, pullRequestTitle);

            console.log(`Processing: ${projectName}/${pullRequestTitle}`);

            //"premerge_"と"merge_"で始まるサブディレクトリを取得
            const premergePath = fs.readdirSync(pullRequestPath)
                .map(dir => path.join(pullRequestPath, dir))  // フルパスに変換
                .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('premerge_'));

            const mergePath = fs.readdirSync(pullRequestPath)
                .map(dir => path.join(pullRequestPath, dir))  // フルパスに変換
                .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('merge_'));

            // premerge_ と merge_ ディレクトリが存在しない場合はスキップ
            if (!premergePath || !mergePath) {
                console.log(`No premerge or merge directory found in ${pullRequestTitle}`);
                return;
            }

            // 変更されたファイルがfilterに該当するか確認
            (async () => {
                const changedFiles = await getChangedFiles(premergePath, mergePath, '');
                const filteredChangedFiles = changedFiles.filter(file => filter.some(f => file.includes(f)));

                if (filteredChangedFiles.length > 0) {
                    const outputPremergePath = path.join(outputDir, projectName, pullRequestTitle);
                    const outputMergePath = path.join(outputDir, projectName, pullRequestTitle);
                    
                    // コピー先のディレクトリを作成
                    fs.mkdirSync(outputPremergePath, { recursive: true });
                    fs.mkdirSync(outputMergePath, { recursive: true });

                    // premerge_ と merge_ ディレクトリをコピー
                    if (premergePath) {
                        fs.cpSync(premergePath, path.join(outputPremergePath, path.basename(premergePath)), { recursive: true });
                    }
                    if (mergePath) {
                        fs.cpSync(mergePath, path.join(outputMergePath, path.basename(mergePath)), { recursive: true });
                    }
                }
            })();

        



        });
    });
}
