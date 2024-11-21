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

    const { protoPathMap, programFileList } = getProgramFilePaths(repositoryFolderPath);

    console.log("Proto Files Map:", protoPathMap);
    console.log("Program Files:", programFileList);
}

/*functions*/
function getProgramFilePaths(dirPath) {
    let protoPathMap = new Map();
    let programFileList = [];
    const list = fs.readdirSync(dirPath);

    // 許可される言語ファイルの拡張子のリスト
    const allowedExtensions = [
        '.proto',
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
                const { protoPathMap: nestedProtoPathMap, programFileList: nestedProgramFileList } = getProgramFilePaths(filePath);
                protoPathMap = new Map([...protoPathMap, ...nestedProtoPathMap]); // Merge maps
                programFileList = programFileList.concat(nestedProgramFileList);
            }
        } else if (file.endsWith('.proto')) {
            const protoDetails = parseProtoFile(filePath);
            if (protoDetails) {
                protoPathMap.set(filePath, protoDetails);
            }
        } else {
            // 許可されている拡張子のファイルのみをprogramFileListに追加
            const fileExt = path.extname(file);
            if (allowedExtensions.includes(fileExt)) {
                programFileList.push(filePath);
            }
        }
    });

    return { protoPathMap, programFileList };
}

/* Parses a .proto file to extract package and option details */
function parseProtoFile(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const packageMatch = fileContent.match(/package\s+([\w.]+);/);
        const optionsMatch = [...fileContent.matchAll(/option\s+([\w_]+)\s*=\s*["']?([\w./-]+)["']?;/g)];

        const packageName = packageMatch ? packageMatch[1] : null;
        const options = optionsMatch.map(match => ({
            key: match[1],
            value: match[2]
        }));

        return { package: packageName, options };
    } catch (err) {
        console.error(`Error reading proto file ${filePath}:`, err);
        return null;
    }
}

module.exports = { getProgramFilePaths };