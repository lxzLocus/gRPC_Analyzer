const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 2つのディレクトリ
const dir1 = '/app/dataset/clone/go-micro-services/pullrequest/Add_go_output_directory_for_protos/merge_38'
const dir2 = '/app/dataset/clone/go-micro-services/pullrequest/Add_go_output_directory_for_protos/premerge_38';

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
const files1 = getFilesRecursive(dir1);
const files2 = getFilesRecursive(dir2);

// 同名ファイルがある場合にdiffを取る
files1.forEach(file1 => {
    const relativePath = path.relative(dir1, file1);
    const file2 = path.join(dir2, relativePath);

    if (fs.existsSync(file2)) {
        // 同名ファイルが見つかったら、diffコマンドを実行
        exec(`diff ${file1} ${file2}`, (err, stdout, stderr) => {
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
