/*
標準入力 + 関数呼び出し対応

*/
/*import module*/
import fs from 'fs';
import path from 'path';

import get_program_file_paths from './module/findProgramFiles';
import get_file_modified_list from './module/findModified';

/*__MAIN__*/
if (require.main === module) {
    // let mergeStateFilePath = process.argv.slice(2)[0];
    let mergeStateFilePath = '/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/';
    initialize(mergeStateFilePath);
}

/*functions*/
export default function initialize(mergeStateFilePath) {

    // inputDir の存在チェック
    if (!fs.existsSync(mergeStateFilePath)) {
        throw new Error(`Input directory ${mergeStateFilePath} does not exist`);
    }

    // `premerge`と`merge`ディレクトリを検出
    const preMergeDirPath = fs.readdirSync(mergeStateFilePath).find(dir => dir.startsWith('premerge'));
    const mergeDirPath = fs.readdirSync(mergeStateFilePath).find(dir => dir.startsWith('merge'));

    if (preMergeDirPath === undefined || mergeDirPath === undefined){
        return "No such file or directory";
    }

    const { protoPathList, programFileList } = get_program_file_paths(preMergeDirPath);
    const { modifiedProtoList, modifiedProgramFileList} = get_file_modified_list(preMergeDirPath, mergeDirPath);




    return "";
}

