/*
protoファイルの差分取得
再帰的に探索，全てのdiffを取得
*/
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * inputDirにある`premerge`と`merge`ディレクトリの同名.protoファイルを比較する
 * @param {string} inputDir - プロジェクトのルートディレクトリ
 */
function compareProtoFiles(inputDir) {
    // `premerge`と`merge`ディレクトリを検出
    const premergeDir = fs.readdirSync(inputDir).find(dir => dir.startsWith('premerge'));
    const mergeDir = fs.readdirSync(inputDir).find(dir => dir.startsWith('merge'));

    if (!premergeDir || !mergeDir) {
        console.error('premerge または merge ディレクトリが見つかりません');
        process.exit(1);

        return 0;
    }

    // フルパスの生成
    const premergePath = path.join(inputDir, premergeDir);
    const mergePath = path.join(inputDir, mergeDir);

    // .protoファイルを再帰的に探索する関数
    function getProtoFilesRecursive(dir) {
        let results = [];
        const list = fs.readdirSync(dir);

        list.forEach(file => {
            const filePath = path.join(dir, file);
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

    // 2つのディレクトリから.protoファイルリストを取得（.gitディレクトリを除外）
    const premergeProtoFiles = getProtoFilesRecursive(premergePath);
    const mergeProtoFiles = getProtoFilesRecursive(mergePath);

    // premerge と merge ディレクトリ内で同名の .proto ファイルを diff
    premergeProtoFiles.forEach(file1 => {
        const relativePath = path.relative(premergePath, file1);
        const file2 = path.join(mergePath, relativePath);

        if (fs.existsSync(file2)) {
            // 同名ファイルが見つかったら、diffコマンドを実行（パスをクォーテーションで囲む）
            exec(`diff "${file1}" "${file2}"`, (err, stdout, stderr) => {
                if (err) {
                    // 差分が見つかると終了コード1になる
                    if (err.code === 1) {
                        console.log(`Differences in ${relativePath}:`);
                        console.log(stdout); // 差分を出力

                        return stdout;
                    } else {
                        console.error(`Error comparing ${file1} and ${file2}: ${err.message}`);

                        return 0;
                    }
                }

                if (stderr) {
                    console.error(`Stderr: ${stderr}`);

                    return 0;
                }
            });
        }
    });
}

// モジュールとしてエクスポート
module.exports = {
    compareProtoFiles
};

