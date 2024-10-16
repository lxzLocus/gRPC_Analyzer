/*
標準入力 + 関数呼び出し対応

*/
/*import module*/
const fs = require('fs');
const path = require('path');

const { get_program_file_paths } = require('./module/findProgramFiles');
const { get_file_modified_list } = require('./module/findModified');


/*__MAIN__*/
if (require.main === module) {
    // let mergeStateFilePath = process.argv.slice(2)[0];
    let mergeStateFilePath = '/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/';
    initialize(mergeStateFilePath);
}

/*functions*/
function initialize(mergeStateFilePath) {

    // inputDir の存在チェック
    if (!fs.existsSync(mergeStateFilePath)) {
        throw new Error(`Input directory ${mergeStateFilePath} does not exist`);
    }

    // `premerge`と`merge`ディレクトリを検出
    let preMergeDirPath = fs.readdirSync(mergeStateFilePath).find(dir => fs.statSync(path.join(mergeStateFilePath, dir)).isDirectory() && dir.startsWith('premerge'));
    let mergeDirPath = fs.readdirSync(mergeStateFilePath).find(dir => fs.statSync(path.join(mergeStateFilePath, dir)).isDirectory() && dir.startsWith('merge'));

    if (!preMergeDirPath || !mergeDirPath) {
        throw new Error("Premerge or merge directory not found");
    }
    //ディレクトリパスを結合
    preMergeDirPath = path.join(mergeStateFilePath, preMergeDirPath);
    mergeDirPath = path.join(mergeStateFilePath, mergeDirPath);


    const { protoPathList, programFileList } = get_program_file_paths(preMergeDirPath);
    const { modifiedProtoList, modifiedFileList} = get_file_modified_list(preMergeDirPath, mergeDirPath);


    return "";
}

module.exports = { initialize };