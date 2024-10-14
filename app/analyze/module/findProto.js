/*
protoファイルを探索して，リストで返す
*/
/*import module*/
import fs from 'fs';
import path from 'path';

/*__MAIN__*/
// premerge or merged file path 
const repositoryFolderPath = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112";

console.log(getProtoFilePaths(repositoryFolderPath));

/*functions*/
export default function getProtoFilePaths(dirPath) {
    let results = [];
    const list = fs.readdirSync(dirPath);

    list.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        // .protoファイルのみ取得し、.gitディレクトリは除外 
        if (stat.isDirectory()) {
            if (file !== '.git') {
                results = results.concat(getProtoFilePaths(filePath));
            }
        } else if (file.endsWith('.proto')) {
            results.push(filePath);
        }
    });

    return results;
}

