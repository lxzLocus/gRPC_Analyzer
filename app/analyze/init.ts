/*
標準入力 + 関数呼び出し対応
*/
/*import module*/
import fs from 'fs';
import path from 'path';
import readline from 'readline';

import { getProgramFilePaths } from './module/findProgramFiles';
import { getFileModifiedList } from './module/findModified';
import { checkFileImportModule } from './module/brokerAst';

/*__MAIN__*/
if (require.main === module) {
    // let filePaths = process.argv.slice(2)[0];
    const mergeStateFilePath = '/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci';
    initialize(mergeStateFilePath);
}

/*functions*/
export function initialize(filePaths: string): void {

    // inputDir の存在チェック
    if (!fs.existsSync(filePaths)) {
        throw new Error(`Input directory ${filePaths} does not exist`);
    }

    // `premerge`と`merge`ディレクトリを検出
    let preMergeDirPath = fs.readdirSync(filePaths).find(dir => fs.statSync(path.join(filePaths, dir)).isDirectory() && dir.startsWith('premerge'));
    let mergeDirPath = fs.readdirSync(filePaths).find(dir => fs.statSync(path.join(filePaths, dir)).isDirectory() && dir.startsWith('merge'));

    if (!preMergeDirPath || !mergeDirPath) {
        throw new Error("Premerge or merge directory not found");
    }
    //ディレクトリパスを結合
    preMergeDirPath = path.join(filePaths, preMergeDirPath);
    mergeDirPath = path.join(filePaths, mergeDirPath);

    /*並列処理必須*/
    Promise.all([
        getProgramFilePaths(preMergeDirPath),
        getFileModifiedList(preMergeDirPath, mergeDirPath)
    ])
    .then(([programPaths, modifiedFiles]) => {
        const { protoPathMap, programFileList } = programPaths;
        const { modifiedProtoList, modifiedFileList } = modifiedFiles;

        //console.log(protoPathMap, programFileList);
        //console.log(modifiedProtoList, modifiedFileList);

        checkFileImportModule(protoPathMap, programFileList, modifiedProtoList, modifiedFileList);
    })
    .catch((error) => {
        console.error('An error occurred:', error);
    });

    return;
}
