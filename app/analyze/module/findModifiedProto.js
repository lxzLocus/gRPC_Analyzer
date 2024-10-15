/*
2つのディレクトリを比較し，変更のあった Protoファイル（ファイルが異なるか、削除された場合）のパスをリストで返す
*/
/*import module*/
import fs from 'fs';
import path from 'path';

/*__MAIN__*/
// premerge or merged file path 
const premergeDir = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112";
const mergeDir = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112";

console.log(get_proto_modified_list(premergeDir, mergeDir));

/*functions*/
// ファイルを比較して、変更のあったファイルを特定
export default function get_proto_modified_list(preDirPath, afterDirPath) {
    const preFiles = get_all_proto_file_paths(preDirPath);
    const afterFiles = get_all_proto_file_paths(afterDirPath);

    const modifiedFilePaths = [];

    preFiles.forEach((preFilePath) => {
        const relativePath = path.relative(preDirPath, preFilePath);
        const afterFilePath = path.join(afterDirPath, relativePath);

        if (fs.existsSync(afterFilePath)) {
            const preFileContent = fs.readFileSync(preFilePath);
            const afterFileContent = fs.readFileSync(afterFilePath);

            // ファイルの内容が一致しない場合
            if (!preFileContent.equals(afterFileContent)) {
                modifiedFilePaths.push(afterFilePath);
            }
        } else {
            // ファイルが削除された場合
            modifiedFilePaths.push(preFilePath);
        }
    });

    return modifiedFilePaths;
}

// ディレクトリを再帰的に探索して、拡張子が .proto のファイルのパスを取得
function get_all_proto_file_paths(dirPath, fileList = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);

        // .git ディレクトリをスキップ
        if (file === '.git') {
            return;
        }

        if (fs.statSync(fullPath).isDirectory()) {
            get_all_proto_file_paths(fullPath, fileList);
        } else if (path.extname(file) === '.proto') {
            fileList.push(fullPath);
        }
    });

    return fileList;
}
