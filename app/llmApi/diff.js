const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1つの入力ディレクトリ
const inputDir = '/app/dataset/clone/alibabacloud-microservice-demo/pullrequest/feat-_multiple_framework_go_http_demo';

// `premerge`と`merge`ディレクトリを検出
const premergeDir = fs.readdirSync(inputDir).find(dir => dir.startsWith('premerge'));
const mergeDir = fs.readdirSync(inputDir).find(dir => dir.startsWith('merge'));

if (!premergeDir || !mergeDir) {
    console.error('premerge または merge ディレクトリが見つかりません');
    process.exit(1);
}

// フルパスの生成
const premergePath = path.join(inputDir, premergeDir);
const mergePath = path.join(inputDir, mergeDir);

// ファイルを再帰的に探索する関数（.gitディレクトリを除外）
function getFilesRecursive(dir) {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // .gitディレクトリを除外し、再帰的にファイルを取得
        if (stat.isDirectory()) {
            if (file !== '.git') {
                results = results.concat(getFilesRecursive(filePath));
            }
        } else {
            results.push(filePath);
        }
    });

    return results;
}

// 2つのディレクトリから全ファイルリストを取得（.gitディレクトリを除外）
const premergeFiles = getFilesRecursive(premergePath);
const mergeFiles = getFilesRecursive(mergePath);

// 同名ファイルがある場合にdiffを取る
premergeFiles.forEach(file1 => {
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
                } else {
                    console.error(`Error comparing ${file1} and ${file2}: ${err.message}`);
                }
            }

            if (stderr) {
                console.error(`Stderr: ${stderr}`);
            }
        });
    }
});
