/*
dataset内のプロジェクトからgRPCのプロジェクトを探す
'.proto'を見つけたらgRPCと判定
*/

const fs = require('fs');
const path = require('path');
// データセットフォルダのパスを指定
const datasetFolder = path.join(__dirname, '../../dataset/reps');

// 移動先のディレクトリのパスを指定
const moveToFolder = path.join(__dirname, '../../gRPC');

let directoryDepth = 0;
const stack = [];

// 拡張子が '.proto' のファイルを探す関数
function findProtoFiles(dirPath, currentDepth) {
    const files = fs.readdirSync(dirPath);
    let foundProtoFile = false;

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        let stat;

        try {
            stat = fs.lstatSync(filePath);
        } catch (err) {
            console.error(`Error reading file stats for ${filePath}: ${err.message}`);
            continue;
        }

        if (stat.isDirectory()) {
            // サブディレクトリの場合、再帰的に探索する
            stack.push({ dirPath: filePath, depth: currentDepth + 1 });

        } else if (stat.isFile() && path.extname(file) === '.proto') {
            //protoファイルを見つけた場合

            //現在の探索フォルダパスからプロジェクトフォルダパスを抜き出す
            let projectPath = dirPath.split('/').slice(0, -(currentDepth-1)).join('/');
            //repsフォルダ追加により変更
            let projectName = projectPath.split('/').slice(4, 5).join('');

            //移動先パス作成
            const projectMovePath = path.join(moveToFolder, projectName);

            console.log(`Moving project '${projectPath}' to ${projectMovePath}`);

            // 移動先ディレクトリが存在しない場合は作成
            if (!fs.existsSync(projectMovePath)) {
               fs.mkdirSync(projectMovePath, { recursive: true });
            }

            // プロジェクトフォルダを移動する
            fs.renameSync(projectPath, projectMovePath);

            console.log(`Project '${projectName}' moved successfully.`);

            foundProtoFile = true;
            break; // .proto ファイルが見つかったのでループを抜ける
        }
    }

    if (foundProtoFile && currentDepth > 0) {
        // depth=0 のディレクトリに戻る
        while (stack.length > 0) {
            const { dirPath, depth } = stack.pop();
            if (depth === 0) {
                findProtoFiles(dirPath, depth);
                break;
            }
        }
    } else if (!foundProtoFile) {
        // スタックに残っているディレクトリを探索する
        while (stack.length > 0) {
            const { dirPath, depth } = stack.pop();
            findProtoFiles(dirPath, depth);
        }
    }
}
// データセットフォルダから探索を開始する
findProtoFiles(datasetFolder, directoryDepth);

console.log('Search and move process completed.');