/*
入力したパスから再帰的にファイルを検索するツール
".proto"ファイルを検索し、そのパスを返す
*/
const fs = require('fs');
const path = require('path');

/**
 * 指定されたディレクトリから再帰的に".proto"ファイルを検索し、そのパスを返す
 * @param {string} dir - 検索を開始するディレクトリのパス
 * @returns {Object[]} - ".proto"ファイルのパスと内容の配列
 */
function findProtoFiles(dir) {
    let results = [];

    function searchDirectory(directory) {
        const files = fs.readdirSync(directory);

        files.forEach(file => {
            const fullPath = path.join(directory, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                searchDirectory(fullPath);
            } else if (path.extname(fullPath) === '.proto') {
                const content = fs.readFileSync(fullPath, 'utf8');
                results.push({
                    path: path.relative(dir, fullPath),
                    content: content
                });
            }
        });
    }

    searchDirectory(dir);
    return results;
}

// 使用例
const searchDir = '/app/dataset/modified_proto_reps/daos/pullrequest/DAOS-14334_control-_Fix_PoolCreateResp-leader/premerge_13850';
const protoFiles = findProtoFiles(searchDir);
console.log(protoFiles);

// 結果をファイルに出力
const outputFilePath = path.join("/app", 'proto_files_list.json');
fs.writeFileSync(outputFilePath, JSON.stringify({ proto_files: protoFiles }, null, 2), 'utf8');
console.log(`結果が ${outputFilePath} に保存されました。`);
