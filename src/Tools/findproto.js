/*
dataset内のプロジェクトからgRPCのプロジェクトを探す
'.proto'を見つけたらgRPCと判定
*/

const fs = require('fs');
const path = require('path');
// データセットフォルダのパスを指定
const datasetFolder = path.join(__dirname, '../../dataset');

// 移動先のディレクトリのパスを指定
const moveToFolder = path.join(__dirname, '../../dataset/gRPC');

// 拡張子が '.proto' のファイルを探す関数
function findProtoFiles(dirPath) {
    fs.readdirSync(dirPath).forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // サブディレクトリの場合、再帰的に探索する
            findProtoFiles(filePath);
        } else if (path.extname(file) === '.proto') {
            // .proto ファイルを見つけた場合、移動先ディレクトリに移動する
            const relativePath = path.relative(datasetFolder, dirPath);
            const projectMovePath = path.join(moveToFolder, relativePath);

            console.log(`Moving project '${relativePath}' to ${projectMovePath}`);

            // 移動先ディレクトリが存在しない場合は作成
            if (!fs.existsSync(projectMovePath)) {
                fs.mkdirSync(projectMovePath, { recursive: true });
            }

            // プロジェクトフォルダを移動する
            fs.renameSync(dirPath, path.join(projectMovePath, file));

            console.log(`Project '${relativePath}' moved successfully.`);
        }
    });
}

// データセットフォルダから探索を開始する
findProtoFiles(datasetFolder);

console.log('Search and move process completed.');