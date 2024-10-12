/*
標準入力 + 関数呼び出し対応

*/
/*import module*/
import fs from 'fs';
import path from 'path';

/*__MAIN__*/
if (require.main === module) {
    let mergeStateFilePath: string = process.argv.slice(2)[0];
    initialize(mergeStateFilePath);
}

/*functions*/
export default function initialize(mergeStateFilePath: string): any {

    // inputDir の存在チェック
    if (!fs.existsSync(mergeStateFilePath)) {
        throw new Error(`Input directory ${mergeStateFilePath} does not exist`);
    }

    // `premerge`と`merge`ディレクトリを検出
    const premergeDir: string | undefined = fs.readdirSync(mergeStateFilePath).find(dir => dir.startsWith('premerge'));
    const mergeDir: string | undefined = fs.readdirSync(mergeStateFilePath).find(dir => dir.startsWith('merge'));

    if (premergeDir === undefined || mergeDir === undefined){
        return "No such file or directory";
    }

    getProtoFilesRecursive(premergeDir);

    console.log(mergeStateFilePath);

    return "";
}

function getProtoFilesRecursive(dirPath: string): any{
    let results = [];
    const list = fs.readdirSync(dirPath);

    list.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        // .protoファイルのみ取得し、.gitディレクトリは除外
        if (stat.isDirectory()) {
            if (file !== '.git') {
                results = results.concat(getProtoFilesRecursive(filePath));
            }
        } else if (file.endsWith('.proto')) {
            results.push(filePath);
        }
    });

    return results;
}