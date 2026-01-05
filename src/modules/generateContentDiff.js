/**
 * ファイル差分の出力を行うモジュール
 * 
 * #02_protoFileChanges.txt
 * 
 * @module generateContentDiff
 * @description fileExtensionで拡張子による分岐可能
 * @example
 * // 使用例
 * const diffResults = await getFilesDiff(inputDir, 'proto');
 */
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

/* __MAIN__ */
if (import.meta.url === `file://${process.argv[1]}`) {
    const premergePath = '/app/dataset/confirmed/pravega/Issue_2460-_When_sending_no_credentials-_exception_returned_has_UNKNOWN_status/premerge_2475';
    const mergePath = '/app/dataset/confirmed/pravega/Issue_2460-_When_sending_no_credentials-_exception_returned_has_UNKNOWN_status/merge_2475';
    const fileExtension = 'proto'; // 必要に応じて変更可能

    (async () => {
        try {
            const results = await getFilesDiff(premergePath, mergePath, fileExtension);
            console.log(results);
        } catch (error) {
            console.error(error.message);
        }
    })();
}

// メインの比較関数
async function getFilesDiff(premergePath, mergePath, extension) {
    try {

        if (!premergePath || !mergePath) {
            throw new Error('premerge または merge ディレクトリが見つかりません');
        }

        // 2つのディレクトリから対象ファイルリストを取得（特定のディレクトリを除外）
        const premergeFiles = getFilesRecursive(premergePath, extension);

        const diffResults = [];

        // premerge と merge ディレクトリ内で同名のファイルを diff
        for (const file1 of premergeFiles) {
            const relativePath = path.relative(premergePath, file1);
            const file2 = path.join(mergePath, relativePath);

            if (fs.existsSync(file2)) {
                try {
                    const diffResult = await diffFiles(file1, file2, premergePath, mergePath);
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

        // 指定された拡張子のファイルのみ取得し、特定のディレクトリは除外
        if (stat.isDirectory()) {
            if (file !== '.git' && file !== 'vendor' && file !== 'node_modules') {
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
function diffFiles(file1, file2, premergePath, mergePath) {
    return new Promise((resolve, reject) => {
        exec(`diff -u "${file1}" "${file2}"`, (err, stdout, stderr) => {
            if (err && err.code === 1) {
                // 差分が見つかる場合
                // 絶対パスを相対パスに置換（開発環境のパスを隠蔽）
                let sanitizedDiff = stdout;
                
                // premerge/merge/commit_snapshotディレクトリからの相対パスを取得
                const relPath1 = premergePath ? path.relative(premergePath, file1) : path.basename(file1);
                const relPath2 = mergePath ? path.relative(mergePath, file2) : path.basename(file2);
                
                // diff出力を行ごとに分割して処理
                const lines = sanitizedDiff.split('\n');
                const processedLines = lines.map(line => {
                    // --- で始まる行を処理
                    if (line.startsWith('--- ')) {
                        return `--- ${relPath1}`;
                    }
                    // +++ で始まる行を処理
                    if (line.startsWith('+++ ')) {
                        return `+++ ${relPath2}`;
                    }
                    return line;
                });
                sanitizedDiff = processedLines.join('\n');
                
                resolve({
                    relativePath: relPath1,
                    diff: sanitizedDiff
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

/**
 * 指定されたファイルパスのリストに基づいて、premergeとmerge間の差分を取得します。
 * @param {string[]} fileList - 差分を取得したいファイルの相対パスのリスト。
 * @param {string} premergePath - 変更前のファイルが存在するベースディレクトリ。
 * @param {string} mergePath - 変更後のファイルが存在するベースディレクトリ。
 * @returns {Promise<Array<{relativePath: string, diff: string}>>} - 差分結果の配列。
 */
async function getDiffsForSpecificFiles(fileList, premergePath, mergePath) {
    if (!premergePath || !mergePath) {
        throw new Error('premerge または merge ディレクトリが見つかりません');
    }

    const diffResults = [];
    for (const relativePath of fileList) {
        const file1 = path.join(premergePath, relativePath);
        const file2 = path.join(mergePath, relativePath);

        if (fs.existsSync(file1) && fs.existsSync(file2)) {
            try {
                const diffResult = await diffFiles(file1, file2, premergePath, mergePath);
                if (diffResult) {
                    // diffFilesは相対パスを返すので、入力の相対パスで上書きして一貫性を保つ
                    diffResults.push({ relativePath: relativePath, diff: diffResult.diff });
                }
            } catch (err) {
                console.error(`Error comparing files: ${err.message}`);
            }
        }
    }
    return diffResults;
}

export { getFilesDiff, getDiffsForSpecificFiles };