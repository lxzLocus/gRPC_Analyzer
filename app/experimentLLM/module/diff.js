const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const outputDir = '/app/app/experimentLLM/output';
const outputFilePath = path.join(outputDir, 'diff_results.txt');

/* __MAIN__ */
if (require.main === module) {
    const inputDir = '/app/dataset/modified_proto_reps/daos/pullrequest/DAOS-14214_control-_Fix_potential_missed_call_to_drpc_failure_handlers';
    const fileExtension = 'proto'; // 必要に応じて変更可能

    // 出力ファイルを初期化
    fs.writeFileSync(outputFilePath, '', 'utf8');

    (async () => {
        try {
            const results = await compareFiles(inputDir, fileExtension);
            console.log(results);
        } catch (error) {
            console.error(error.message);
        }
    })();
}

// メインの比較関数
async function compareFiles(inputDir, extension) {
    try {
        // 拡張子が指定されていない場合の警告
        if (!extension) {
            console.warn('Warning: No file extension specified. All files will be processed.');
        }

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

        // 2つのディレクトリから対象ファイルリストを取得（.gitディレクトリを除外）
        const premergeFiles = getFilesRecursive(premergePath, extension);

        console.log('Premerge Files:', premergeFiles); // デバッグ用

        const diffResults = [];

        // premerge と merge ディレクトリ内で同名のファイルを diff
        for (const file1 of premergeFiles) {
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


/**
 * 指定されたディレクトリから再帰的にファイルを探索する関数
 * @param {string} dir - 検索を開始するディレクトリのパス
 * @param {string} extension - 対象とするファイルの拡張子（例: '.proto'）
 * @returns {string[]} - 対象ファイルのパスの配列
 */
function getFilesRecursive(dir, extension) {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // 指定された拡張子のファイルのみ取得し、.gitディレクトリは除外
        if (stat.isDirectory()) {
            if (file !== '.git') {
                results = results.concat(getFilesRecursive(filePath, extension));
            }
        } else if (!extension || file.endsWith(extension)) {
            // 拡張子が指定されていない場合、すべてのファイルを対象にする
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
                fs.appendFileSync(outputFilePath, stdout); // 差分を追記
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

