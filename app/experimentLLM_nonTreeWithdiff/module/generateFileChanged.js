/**
 * `premerge` ディレクトリと `merge` ディレクトリ内のファイルを比較し、
 * 変更のあったファイルを検出して結果を JSON ファイルとして保存するモジュール
 * 
 * #03_fileChanges.txt
 * 
 * @module generateFileChanged
 * @description ファイルの内容差分を出力するものではない
 * @example
 * // 使用例
 * const results = await getChangedFiles(inputDir, '');
 */


const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');


// 無視するフォルダや拡張子を定義
const ignore = {
    folders: ['.git', 'node_modules', '.git_disabled'], // 無視するフォルダ
    extensions: ['.log', '.tmp'], // 無視する拡張子
};

/* __MAIN__ */
if (require.main === module) {
    const outputDir = '/app/app/experimentLLM_nonTreeWithdiff/output';
    const outputFilePath = path.join(outputDir, 'changed_files.json');
    const premergePath = '/app/dataset/confirmed/pravega/Issue_850-_Fix_for_intermittent_end_to_end_test_failures/premerge_853';
    const mergePath = '/app/dataset/confirmed/pravega/Issue_850-_Fix_for_intermittent_end_to_end_test_failures/merge_853';
    const fileExtension = ''; // 必要に応じて変更可能

    // 出力ファイルを初期化
    fs.writeFileSync(outputFilePath, '', 'utf8');

    (async () => {
        try {
            const results = await getChangedFiles(premergePath, mergePath,fileExtension);
            fs.writeFileSync(outputFilePath, JSON.stringify(results, null, 2), 'utf8');
            console.log(`変更のあったファイルが ${outputFilePath} に保存されました。`);
        } catch (error) {
            console.error(error.message);
        }
    })();
}

// メインの比較関数
async function getChangedFiles(premergePath, mergePath, extension) {
    try {
        // 2つのディレクトリから対象ファイルリストを取得（無視リストを考慮）
        const premergeFiles = getFilesRecursive(premergePath, extension, ignore);

        const diffResults = [];

        // premerge と merge ディレクトリ内で同名のファイルを diff
        for (const file1 of premergeFiles) {
            const relativePath = path.relative(premergePath, file1);
            const file2 = path.join(mergePath, relativePath);

            if (fs.existsSync(file2)) {
                try {
                    const diffResult = await diffFiles(file1, file2);
                    if (diffResult) {
                        const content = fs.readFileSync(file1, 'utf8');
                        diffResults.push({
                            path: relativePath,
                            content: content
                        });
                    }
                } catch (err) {
                    console.error(`Error comparing files: ${err.message}`);
                }
            } else {
                console.log(`No corresponding file for ${file1} in merge directory`);
            }
        }

        console.log('Diff Results:', diffResults); // デバッグ用
        return { changed_files: diffResults };
    } catch (error) {
        console.error(error.message);
        throw error;
    }
}


/**
 * 指定されたディレクトリから再帰的にファイルを探索する関数
 * @param {string} dir - 検索を開始するディレクトリのパス
 * @param {string} extension - 対象とするファイルの拡張子（例: '.proto'）
 * @param {Object} ignore - 無視するフォルダや拡張子の設定
 * @returns {string[]} - 対象ファイルのパスの配列
 */
function getFilesRecursive(dir, extension, ignore) {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // 無視するフォルダをスキップ
        if (stat.isDirectory()) {
            if (!ignore.folders.includes(file)) {
                results = results.concat(getFilesRecursive(filePath, extension, ignore));
            }
        } else {
            // 無視する拡張子をスキップ
            const fileExt = path.extname(file);
            if (!ignore.extensions.includes(fileExt) && (!extension || file.endsWith(extension))) {
            results.push(filePath);
            }
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
                resolve(true);
            } else if (err) {
                // 予期しないエラー
                reject(new Error(`Error comparing ${file1} and ${file2}: ${err.message}`));
            } else if (stderr) {
                // スタンダードエラー出力
                reject(new Error(`Stderr: ${stderr}`));
            } else {
                resolve(false); // 差分なし
            }
        });
    });
}

module.exports = { getChangedFiles };