/**
 * unix diff ぽい形式で，ファイルの内容を出力するスクリプト
 * 
 * #05_suspectedFiles.txt
 * 
 * @module generateFileContent
 * @description ファイルの内容を出力する
 * @example
 * // 使用例
 * const results = await copyFiles(filePaths);
 */

import fs from 'fs';
import path from 'path';

/* __MAIN__ */
if (import.meta.url === `file://${process.argv[1]}`) {
    const outputDir = '/app/app/experimentLLM/output';
    const outputFilePath = path.join(outputDir, 'copied_files.txt');
    const filePaths = [
        '/app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml/merge_54/Dockerfile.js.base'
    ]; // ここにファイルパスを配列で指定

    // 出力ファイルを初期化
    //fs.writeFileSync(outputFilePath, '', 'utf8');  // 初期化して空にする

    (async () => {
        try {
            const results = await copyFiles(filePaths);
            console.log(results);
        } catch (error) {
            console.error(error.message);
        }
    })();
}

// メインのコピー関数
export default async function copyFiles(filePaths, outputFilePath) {
    try {
        const copiedResults = [];

        for (const filePath of filePaths) {
            if (fs.existsSync(filePath)) {
                try {
                    const copyResult = await copyFile(filePath, outputFilePath);
                    if (copyResult) {
                        copiedResults.push(copyResult);
                    }
                } catch (err) {
                    console.error(`Error copying file: ${err.message}`);
                }
            } else {
                console.log(`No such file: ${filePath}`);
            }
        }

        console.log('Copied Results:', copiedResults); // デバッグ用
        return copiedResults;
    } catch (error) {
        console.error(error.message);
        throw error;
    }
}

/**
 * ファイルをコピーする関数
 * @param {string} filePath - コピーするファイルのパス
 * @returns {Object} - コピー結果
 */
function copyFile(filePath, outputFilePath) {
    return new Promise((resolve, reject) => {
        console.log(`Copying file: ${filePath}`); // デバッグ用

        try {
            const data = fs.readFileSync(filePath, 'utf8');  // ファイル内容を読み込む
            fs.appendFileSync(outputFilePath, `--- ${filePath}\n`);  // コピー元ファイル名を書き込む
            fs.appendFileSync(outputFilePath, data);  // ファイル内容を追記
            fs.appendFileSync(outputFilePath, `\n\n`);  // 2ファイル分けるために改行

            resolve({
                relativePath: path.relative(path.dirname(filePath), filePath),
                copied: true
            });
        } catch (err) {
            reject(new Error(`Error copying file from ${filePath}: ${err.message}`));
        }
    });
}
