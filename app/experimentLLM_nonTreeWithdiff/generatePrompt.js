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
    
    const pullRequestDirPaths = getPullRequestPaths(datasetDir);

    let dirCount = 0;

    pullRequestDirPaths.forEach((dirPath) => {

        dirCount++;
        console.log(`Processing : ${dirCount} / ${pullRequestDirPaths.length} \n`);

        //"premerge_"と"merge_"で始まるサブディレクトリを取得
        const premergePath = fs.readdirSync(dirPath)
            .map(dir => path.join(dirPath, dir))  // フルパスに変換
            .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('premerge_'));

        const mergePath = fs.readdirSync(dirPath)
            .map(dir => path.join(dirPath, dir))  // フルパスに変換
            .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('merge_'));
        
        
            // 01_proto
        const protoContentList = findFiles(premergePath, '.proto');
        const protoFilePath = path.join(dirPath, '01_proto.txt');

        // 既存のファイルがあれば削除
        if (fs.existsSync(protoFilePath)) {
            fs.unlinkSync(protoFilePath);
        }
        fs.writeFileSync(protoFilePath, JSON.stringify(protoContentList, null, 2), 'utf8');
        

        // 02_protoFileChanges
        (async () => {
            const diffResults = await getFilesDiff(premergePath, mergePath, 'proto');
            const protoFileChangesPath = path.join(dirPath, '02_protoFileChanges.txt');
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
                console.log('No proto file changes detected, no file created.');
            }
        })();

        // 03_fileChanges
        (async () => {
            const changedFiles = await getChangedFiles(premergePath, mergePath, '');
            console.log('Changed Files:', changedFiles); // デバッグ用
            const fileChangesPath = path.join(dirPath, '03_fileChanges.txt');

            // 既存のファイルがあれば削除
            if (fs.existsSync(fileChangesPath)) {
                fs.unlinkSync(fileChangesPath);
            }
            fs.writeFileSync(fileChangesPath, JSON.stringify(changedFiles, null, 2), 'utf8');
        })();

        // 04_allFilePaths
        const allFilePaths = getPathTree(premergePath);
        const allFilePathsPath = path.join(dirPath, '04_allFilePaths.txt');

        // 既存のファイルがあれば削除
        if (fs.existsSync(allFilePathsPath)) {
            fs.unlinkSync(allFilePathsPath);
        }
        fs.writeFileSync(allFilePathsPath, JSON.stringify(allFilePaths, null, 2), 'utf8');
        
        
    });
}
