/*
dataset内のプロジェクトからgRPCのプロジェクトを探す
'.proto'を見つけたらgRPCと判定
*/

const fs = require('fs');
const path = require('path');
// データセットフォルダのパスを指定
const datasetFolder = path.join(__dirname, '../../dataset/reps');

// 移動先のディレクトリのパスを指定
const moveToFolder = path.join(__dirname, '../../dataset/gRPC');

// 再帰的にディレクトリを探索する関数
function findProtoFiles(dir, projectPath) {
    // ディレクトリの内容を読み取る
    const files = fs.readdirSync(dir);

    // 各ファイル/ディレクトリを処理
    for (const file of files) {
        const fullPath = path.join(dir, file);

        // ファイルの状態を取得
        try {
            const stat = fs.lstatSync(fullPath);

            if (stat.isDirectory()) {
                // ディレクトリの場合、再帰的に探索
                const found = findProtoFiles(fullPath, projectPath);
                if (found) {
                    return true; // .protoファイルが見つかった場合、再帰探索を終了
                }
            } else if (stat.isFile() && path.extname(fullPath) === '.proto') {
                // .protoファイルを発見した場合
                console.log(`Found .proto file in project: ${projectPath}`);

                let projectName = projectPath.split('/').slice(4, 5).join('');
                let projectMovePath = path.join(moveToFolder, projectName);

                console.log(`Moving project '${projectPath}' to ${projectMovePath}`);

                if (!fs.existsSync(projectMovePath)) {
                    fs.mkdirSync(projectMovePath, { recursive: true });
                }

                fs.renameSync(projectPath, projectMovePath);

                console.log(`Project '${projectName}' moved successfully.`);


                // プロジェクトを終了し、次のプロジェクトに移動
                return true;
            }
        } catch (err) {
            console.error(`Error accessing ${fullPath}: ${err.message}`);
        }
    }
    return false;
}

// datasetFolder内の各ディレクトリを探索
const projects = fs.readdirSync(datasetFolder);
for (const project of projects) {
    const projectPath = path.join(datasetFolder, project);
    try {
        if (fs.lstatSync(projectPath).isDirectory()) {
            console.log(`Searching in project: ${projectPath}`);
            const found = findProtoFiles(projectPath, projectPath);
            if (found) {
                continue;
            }
        }
    } catch (err) {
        console.error(`Error accessing project ${projectPath}: ${err.message}`);
    }
}


