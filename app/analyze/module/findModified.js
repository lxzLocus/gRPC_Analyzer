/*
2つのディレクトリを比較し，変更のあったファイル（ファイルが異なるか、削除された場合）のパスをリストで返す
*/
/*import module*/
const fs = require('fs');
const path = require('path');


/*config*/
// 許可される言語ファイルの拡張子のリスト
const allowedExtensions = [
    '.go',     // Go 
    '.cs',     // C# 
    '.java',   // Java 
    '.scala',  // Scala 
    '.ts',     // TypeScript 
    '.py',     // Python 
    '.c',      // C 
    '.js',     // JavaScript 
    '.sh',     // Shell 
    '.html',   // HTML 
    '.htm',    // HTML (alternative extension) 
    '.css',    // CSS 
    '.pl',     // Perl 
    '.pm',     // Perl module 
    '.cpp',    // C++ 
    '.cc',     // C++ 
    '.cx',     // C++ 
    '.rs',     // Rust 
]; 

 
/*__MAIN__*/
if (require.main === module) {
    // premerge or merged file path 
    const premergeDir = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112";
    const mergeDir = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112";

    const { modifiedProtoList, modifiedFileList } = getFileModifiedList(premergeDir, mergeDir);

    console.log("Modified Proto Files:", modifiedProtoList);
    console.log("Modified Other Files:", modifiedFileList);
}

/*functions*/
// ファイルを比較して、変更のあったファイルを特定
function getFileModifiedList(preDirPath, afterDirPath) {
    const preFiles = getAllFilePaths(preDirPath);
    const afterFiles = getAllFilePaths(afterDirPath);

    const modifiedProtoList = [];
    const modifiedFileList = [];

    preFiles.forEach((preFilePath) => {
        const relativePath = path.relative(preDirPath, preFilePath);
        const afterFilePath = path.join(afterDirPath, relativePath);

        // 拡張子が許可されていない場合はスキップ
        if (!isAllowedExtension(preFilePath)) {
            return;
        }

        if (fs.existsSync(afterFilePath)) {
            const preFileContent = fs.readFileSync(preFilePath);
            const afterFileContent = fs.readFileSync(afterFilePath);

            // ファイルの内容が一致しない場合
            if (!preFileContent.equals(afterFileContent)) {
                if (path.extname(preFilePath) === '.proto') {
                    modifiedProtoList.push(afterFilePath);
                } else {
                    modifiedFileList.push(afterFilePath);
                }
            }
        }
    });

    return { modifiedProtoList, modifiedFileList };
} 

// ファイルの拡張子が許可されているか確認
function isAllowedExtension(filePath) {
    const extname = path.extname(filePath);
    return allowedExtensions.includes(extname);
}

// ディレクトリを再帰的に探索して、すべてのファイルのパスを取得
function getAllFilePaths(dirPath, fileList = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);

        // .git ディレクトリをスキップ
        if (file === '.git') {
            return;
        }

        if (fs.statSync(fullPath).isDirectory()) {
            getAllFilePaths(fullPath, fileList);
        } else {
            fileList.push(fullPath);
        }
    });

    return fileList;
}


module.exports = { getFileModifiedList };