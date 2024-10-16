/*
protoファイル or プログラム言語ファイルを探索して，リストで返す
*/
/*import module*/
import fs from 'fs';
import path from 'path';

/*__MAIN__*/
// premerge or merged file path 
const repositoryFolderPath = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112";

const { protoFiles, programFiles } = get_program_file_paths(repositoryFolderPath);

console.log("Proto Files:", protoFiles);
console.log("ProgramFiles:", programFiles);

/*functions*/
export default function get_program_file_paths(dirPath) {
    let protoFiles = [];
    let programFiles = [];
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
                const { protoFiles: nestedProtoFiles, programFiles: nestedprogramFiles } = get_program_file_paths(filePath);
                protoFiles = protoFiles.concat(nestedProtoFiles);
                programFiles = programFiles.concat(nestedprogramFiles);
            }
        } else if (file.endsWith('.proto')) {
            protoFiles.push(filePath);
        } else {
            // 許可されている拡張子のファイルのみをprogramFilesに追加
            const fileExt = path.extname(file);
            if (allowedExtensions.includes(fileExt)) {
                programFiles.push(filePath);
            }
        }
    });

    return { protoFiles, programFiles };
}
