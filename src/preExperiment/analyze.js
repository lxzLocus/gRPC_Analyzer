const fs = require('fs');
const path = require('path');

// プロジェクトフォルダのパスを指定
const projectFolder = path.join(__dirname, '../../dataset/grpc_openai');

// ファイルパターンを定義
const filePatterns = ['_grpc.pb.go', '.pb.go', '.proto'];

// 再帰的にディレクトリを探索する関数
function findFiles(dir) {
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
                findFiles(fullPath);
            } else if (stat.isFile()) {
                // ファイルが指定されたパターンに一致するかチェック
                for (const pattern of filePatterns) {
                    if (fullPath.endsWith(pattern)) {
                        console.log(`Found ${pattern} file: ${fullPath}`);
                        break; // 一つのパターンに一致したら他のパターンはチェックしない
                    }
                }
            }
        } catch (err) {
            console.error(`Error accessing ${fullPath}: ${err.message}`);
        }
    }
}

// プロジェクトフォルダを探索
findFiles(projectFolder);
