/*
protoファイル or プログラム言語ファイルを探索して，リストで返す
*/
/*import module*/
const fs = require('fs');
const path = require('path');

/*__MAIN__*/
if (require.main === module) {
    // premerge or merged file path 
    const repositoryFolderPath = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112";

    const { protoPathList, programFileList } = get_program_file_paths(repositoryFolderPath);

    console.log("Proto Files:", protoPathList);
    console.log("programFiles:", programFileList);
}

/*functions*/
function get_program_file_paths(dirPath) {
    let protoPathList = [];
    let programFileList = [];
    const list = fs.readdirSync(dirPath);

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

    list.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        // .protoファイルのみ取得し、.gitディレクトリは除外
        if (stat.isDirectory()) {
            if (file !== '.git') {
                const { protoPathList: nestedprotoPathList, programFileList: nestedprogramFileList } = get_program_file_paths(filePath);
                protoPathList = protoPathList.concat(nestedprotoPathList);
                programFileList = programFileList.concat(nestedprogramFileList);
            }
        } else if (file.endsWith('.proto')) {
            protoPathList.push(filePath);
        } else {
            // 許可されている拡張子のファイルのみをprogramFileListに追加
            const fileExt = path.extname(file);
            if (allowedExtensions.includes(fileExt)) {
                programFileList.push(filePath);
            }
        }
    });

    return { protoPathList, programFileList };
}

module.exports = { get_program_file_paths };