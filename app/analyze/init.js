/*
標準入力 + 関数呼び出し対応

*/
/*import module*/
import fs from 'fs';
import path from 'path';

import get_proto_file_paths from './module/findProto';

/*__MAIN__*/
if (require.main === module) {
    let mergeStateFilePath = process.argv.slice(2)[0];
    initialize(mergeStateFilePath);
}

/*functions*/
export default function initialize(mergeStateFilePath) {

    // inputDir の存在チェック
    if (!fs.existsSync(mergeStateFilePath)) {
        throw new Error(`Input directory ${mergeStateFilePath} does not exist`);
    }

    // `premerge`と`merge`ディレクトリを検出
    const premergeDir = fs.readdirSync(mergeStateFilePath).find(dir => dir.startsWith('premerge'));
    const mergeDir = fs.readdirSync(mergeStateFilePath).find(dir => dir.startsWith('merge'));

    if (premergeDir === undefined || mergeDir === undefined){
        return "No such file or directory";
    }

    get_proto_file_paths(premergeDir);

    console.log(mergeStateFilePath);

    return "";
}

