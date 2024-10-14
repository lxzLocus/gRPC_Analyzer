import fs from 'fs';
import path from 'path';

export default function get_proto_file_paths(dirPath) {
    let results = [];
    const list = fs.readdirSync(dirPath);

    list.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        // .protoファイルのみ取得し、.gitディレクトリは除外
        if (stat.isDirectory()) {
            if (file !== '.git') {
                results = results.concat(get_proto_file_paths(filePath));
            }
        } else if (file.endsWith('.proto')) {
            results.push(filePath);
        }
    });

    return results;
}


/*__MAIN__*/
//premerge or merged file path
let repositoryFolderPath = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112";

console.log(get_proto_file_paths(repositoryFolderPath));