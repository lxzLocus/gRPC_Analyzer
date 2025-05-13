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


const  { getPullRequestPaths } = require('./module/getPullRequestPaths');

const { findFiles } = require('./module/generateFilePathContent');
const { getFilesDiff } = require('./module/generateContentDiff');
const { getChangedFiles } = require('./module/generateFileChanged');
const { getPathTree } = require('./module/generateDirPathLists');


/*config*/
const datasetDir = '/app/dataset/confirmed';





/* __MAIN__ */
if (require.main === module) {
    
    const projectDirs = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());

    projectDirs.forEach(projectName => {
        const projectPath = path.join(datasetDir, projectName);
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

            // 01_proto
            const protoContentList = findFiles(premergePath, '.proto');
            const protoFilePath = path.join(pullRequestPath, '01_proto.txt');

            // 既存のファイルがあれば削除
            if (fs.existsSync(protoFilePath)) {
                fs.unlinkSync(protoFilePath);
            }
            fs.writeFileSync(protoFilePath, JSON.stringify(protoContentList, null, 2), 'utf8');

            // 02_protoFileChanges
            (async () => {
                const diffResults = await getFilesDiff(premergePath, mergePath, 'proto');
                const protoFileChangesPath = path.join(pullRequestPath, '02_protoFileChanges.txt');
                if (diffResults.length > 0) {
                    // 既存のファイルがあれば削除
                    if (fs.existsSync(protoFileChangesPath)) {
                        fs.unlinkSync(protoFileChangesPath);
                    }
                    // 新しいファイルを作成
                    for (const result of diffResults) {
                        try {
                            fs.appendFileSync(protoFileChangesPath, result.diff + '\n', 'utf8');
                        } catch (error) {
                            console.error(`Error appending to file: ${protoFileChangesPath}`, error);
                        }
                    }
                } else {

                    // 既存のファイルがあれば削除
                    if (fs.existsSync(protoFileChangesPath)) {
                        fs.unlinkSync(protoFileChangesPath);
                    }
                    // 新しいファイルを作成
                    
                    try {
                        fs.appendFileSync(protoFileChangesPath, '', 'utf8'); // 空の文字列を渡す
                    } catch (error) {
                        console.error(`Error appending to file: ${protoFileChangesPath}`, error);
                    }
                    

                    console.log('No proto file changes detected, no file created.');
                }
            })();

            // 03_fileChanges
            (async () => {
                const changedFiles = await getChangedFiles(premergePath, mergePath, '');
                console.log('Changed Files:', changedFiles); // デバッグ用
                const fileChangesPath = path.join(pullRequestPath, '03_fileChanges.txt');

                // 既存のファイルがあれば削除
                if (fs.existsSync(fileChangesPath)) {
                    fs.unlinkSync(fileChangesPath);
                }
                fs.writeFileSync(fileChangesPath, JSON.stringify(changedFiles, null, 2), 'utf8');
            })();

            // 04_allFilePaths
            const allFilePaths = getPathTree(premergePath);
            const allFilePathsPath = path.join(pullRequestPath, '04_allFilePaths.txt');

            // 既存のファイルがあれば削除
            if (fs.existsSync(allFilePathsPath)) {
                fs.unlinkSync(allFilePathsPath);
            }
            fs.writeFileSync(allFilePathsPath, JSON.stringify(allFilePaths, null, 2), 'utf8');
        });
    });
}
