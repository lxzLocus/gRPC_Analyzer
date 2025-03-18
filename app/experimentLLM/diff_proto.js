/*
protoファイルの差分取得
再帰的に探索，全てのdiffを取得
*/
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const outputDir = '/app/analyze/experimentLLM/output';

/* __MAIN__ */
if (require.main === module) {
    const inputDir = '/app/dataset/clone/loop/pullrequest/update_api_for_loop_in';

    (async () => {
        try {
            const results = await compareProtoFiles(inputDir);
            console.log(results);
        } catch (error) {
            console.error(error.message);
        }
    });

}


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

// premerge と merge ディレクトリ内で同名の .proto ファイルを diff
function diffFiles(file1, file2) {
    return new Promise((resolve, reject) => {
        console.log(`Running diff between: ${file1} and ${file2}`); // デバッグ用
        exec(`diff -u "${file1}" "${file2}"`, (err, stdout, stderr) => {
            if (err && err.code === 1) {
                // 差分が見つかる場合
                resolve({
                    relativePath: path.relative(path.dirname(file1), file1),
                    diff: stdout
                });
            } else if (err) {
                // 予期しないエラー
                reject(new Error(`Error comparing ${file1} and ${file2}: ${err.message}`));
            } else if (stderr) {
                // スタンダードエラー出力
                reject(new Error(`Stderr: ${stderr}`));
            } else {
                resolve(null); // 差分なし
            }
        });
    });
}

// メインの比較関数
async function compareProtoFiles(inputDir) {
    try {
        // inputDir の存在チェック
        if (!fs.existsSync(inputDir)) {
            throw new Error(`Input directory ${inputDir} does not exist`);
        }

        // `premerge`と`merge`ディレクトリを検出
        const premergeDir = fs.readdirSync(inputDir).find(dir => dir.startsWith('premerge'));
        const mergeDir = fs.readdirSync(inputDir).find(dir => dir.startsWith('merge'));

        if (!premergeDir || !mergeDir) {
            throw new Error('premerge または merge ディレクトリが見つかりません');
        }

        // フルパスの生成
        const premergePath = path.join(inputDir, premergeDir);
        const mergePath = path.join(inputDir, mergeDir);

        // 2つのディレクトリから.protoファイルリストを取得（.gitディレクトリを除外）
        const premergeProtoFiles = getProtoFilesRecursive(premergePath);

        console.log('Premerge Proto Files:', premergeProtoFiles); // デバッグ用

        const diffResults = [];

        // premerge と merge ディレクトリ内で同名の .proto ファイルを diff
        for (const file1 of premergeProtoFiles) {
            const relativePath = path.relative(premergePath, file1);
            const file2 = path.join(mergePath, relativePath);

            if (fs.existsSync(file2)) {
                try {
                const diffResult = await diffFiles(file1, file2);
                if (diffResult) {
                    diffResults.push(diffResult);
                    }
                } catch (err) {
                    console.error(`Error comparing files: ${err.message}`);
                }
            } else {
                console.log(`No corresponding file for ${file1} in merge directory`);
            }
        }

        console.log('Diff Results:', diffResults); // デバッグ用
        return diffResults;
    } catch (error) {
        console.error(error.message);
        throw error;
    }
}

module.exports = { compareProtoFiles };
