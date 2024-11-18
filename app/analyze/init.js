/*
標準入力 + 関数呼び出し対応

*/
/*import module*/
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');


const { getProgramFilePaths } = require('./module/findProgramFiles');
const { getFileModifiedList } = require('./module/findModified');

const { checkFileImportModule } = require('./module/brokerAst');



/*config*/
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
    // let filePaths = process.argv.slice(2)[0];
    let mergeStateFilePath = '/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/';
    initialize(mergeStateFilePath);
}

/*functions*/
function initialize(filePaths) {

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
    const { protoPathList, programFileList } = getProgramFilePaths(preMergeDirPath);
    const { modifiedProtoList, modifiedFileList} = getFileModifiedList(preMergeDirPath, mergeDirPath);

    checkFileImportModule(protoPathList, programFileList, modifiedProtoList, modifiedFileList);

    return "";
}




