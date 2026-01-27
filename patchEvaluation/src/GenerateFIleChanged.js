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


import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';


// 無視するフォルダや拡張子を定義
const ignore = {
    folders: ['.git', 'node_modules', '.git_disabled'], // 無視するフォルダ
    extensions: ['.log', '.tmp'], // 無視する拡張子
};


// メインの比較関数
export default async function getChangedFiles(premergePath, mergePath, extension) {
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
                        //const content = fs.readFileSync(file1, 'utf8');
                        // diffResults.push({
                        //     path: relativePath,
                        //     content: content
                        // });
                        diffResults.push(relativePath);
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
 * @param {Object} ignore - 無視するフォルダや拡張子の設定
 * @returns {string[]} - 対象ファイルのパスの配列
 */
function getFilesRecursive(dir, extension, ignore) {
    let results = [];
    let list;
    
    try {
        list = fs.readdirSync(dir);
    } catch (error) {
        if (error.code === 'ENAMETOOLONG') {
            console.warn(`⚠️ パス名が長すぎてスキップ: ${dir}`);
            return results; // 空の結果を返す
        }
        throw error; // その他のエラーは再スロー
    }

    list.forEach(file => {
        const filePath = path.join(dir, file);
        let stat;
        
        try {
            stat = fs.statSync(filePath);
        } catch (error) {
            if (error.code === 'ENAMETOOLONG') {
                console.warn(`⚠️ ファイルパス名が長すぎてスキップ: ${filePath}`);
                return; // このファイルをスキップ
            }
            throw error;
        }

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

// premerge と merge ディレクトリ内で同名のファイルを diff（boolean返却版）
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

/**
 * 2つのファイル間の詳細なdiffを取得（diff文字列返却版）
 * @param {string} file1 - 比較元ファイルのパス
 * @param {string} file2 - 比較先ファイルのパス
 * @param {string} relativePath - 相対パス（diff表示用）
 * @returns {Promise<string|null>} diff文字列（差分がない場合はnull）
 */
function generateFileDiff(file1, file2, relativePath) {
    return new Promise((resolve, reject) => {
        exec(`diff -u "${file1}" "${file2}"`, (err, stdout, stderr) => {
            if (err && err.code === 1) {
                // 差分が見つかる場合
                // diffヘッダーを統一フォーマットに変更
                const formattedDiff = stdout
                    .replace(/^--- (.+)$/gm, `--- a/${relativePath}`)
                    .replace(/^\+\+\+ (.+)$/gm, `+++ b/${relativePath}`);
                
                resolve(`diff --git a/${relativePath} b/${relativePath}\n${formattedDiff}`);
            } else if (err) {
                // 予期しないエラー
                reject(new Error(`Error generating diff for ${file1} and ${file2}: ${err.message}`));
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
 * 変更されたファイルパスリストから統合されたdiff文字列を生成
 * @param {string} premergePath - premergeディレクトリのパス
 * @param {string} mergePath - mergeディレクトリのパス
 * @param {string[]} changedFilePaths - 変更されたファイルの相対パスリスト
 * @returns {Promise<string>} 統合されたdiff文字列
 */
export async function generateGroundTruthDiff(premergePath, mergePath, changedFilePaths) {
    if (!changedFilePaths || changedFilePaths.length === 0) {
        return '';
    }

    const diffParts = [];

    for (const relativePath of changedFilePaths) {
        try {
            const file1 = path.join(premergePath, relativePath);
            const file2 = path.join(mergePath, relativePath);

            // ファイルの存在確認
            const file1Exists = fs.existsSync(file1);
            const file2Exists = fs.existsSync(file2);

            if (file1Exists && file2Exists) {
                // 両方のファイルが存在する場合、通常のdiffを生成
                const diffResult = await generateFileDiff(file1, file2, relativePath);
                if (diffResult) {
                    diffParts.push(diffResult);
                }
            } else if (!file1Exists && file2Exists) {
                // ファイルが新規追加された場合
                const content = fs.readFileSync(file2, 'utf8');
                const lines = content.split('\n');
                let newFileDiff = `diff --git a/${relativePath} b/${relativePath}\n`;
                newFileDiff += `new file mode 100644\n`;
                newFileDiff += `index 0000000..1234567\n`;
                newFileDiff += `--- /dev/null\n`;
                newFileDiff += `+++ b/${relativePath}\n`;
                newFileDiff += `@@ -0,0 +1,${lines.length} @@\n`;
                lines.forEach(line => {
                    newFileDiff += `+${line}\n`;
                });
                diffParts.push(newFileDiff);
            } else if (file1Exists && !file2Exists) {
                // ファイルが削除された場合
                const content = fs.readFileSync(file1, 'utf8');
                const lines = content.split('\n');
                let deletedFileDiff = `diff --git a/${relativePath} b/${relativePath}\n`;
                deletedFileDiff += `deleted file mode 100644\n`;
                deletedFileDiff += `index 1234567..0000000\n`;
                deletedFileDiff += `--- a/${relativePath}\n`;
                deletedFileDiff += `+++ /dev/null\n`;
                deletedFileDiff += `@@ -1,${lines.length} +0,0 @@\n`;
                lines.forEach(line => {
                    deletedFileDiff += `-${line}\n`;
                });
                diffParts.push(deletedFileDiff);
            }
        } catch (error) {
            console.error(`⚠️ ファイル差分生成エラー (${relativePath}): ${error.message}`);
            // 個別ファイルのエラーは継続
        }
    }

    return diffParts.join('\n');
}

/**
 * 変更されたファイルパスとdiffの両方を取得する統合関数
 * @param {string} premergePath - premergeディレクトリのパス
 * @param {string} mergePath - mergeディレクトリのパス
 * @param {string} extension - 対象ファイル拡張子（オプション）
 * @returns {Promise<Object>} { changedFiles: string[], groundTruthDiff: string }
 */
export async function getChangedFilesWithDiff(premergePath, mergePath, extension = null) {
    try {
        // 変更されたファイルパスを取得
        const changedFiles = await getChangedFiles(premergePath, mergePath, extension);
        
        // 統合されたdiffを生成
        const groundTruthDiff = await generateGroundTruthDiff(premergePath, mergePath, changedFiles);
        
        return {
            changedFiles,
            groundTruthDiff
        };
    } catch (error) {
        console.error(`変更ファイル・diff取得エラー: ${error.message}`);
        return {
            changedFiles: [],
            groundTruthDiff: ''
        };
    }
}

