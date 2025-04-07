/*
入力パスより、指定されたフォルダを再帰的に探索し、ファイルパスを収集する
*/

const fs = require('fs');
const path = require('path');


// メイン処理
if (require.main === module) {
    const targetDir = '/app'; // 探索するフォルダのパス
    const outputFilePath = path.join(__dirname, 'filePaths.txt'); // 出力先のファイルパス
    const ignore = ['.git', 'node_modules', 'output']; // 無視するフォルダやファイル

    try {
        const filePaths = getFilePaths(targetDir, ignore);
        writePathsToFile(outputFilePath, filePaths);
    } catch (error) {
        console.error('エラーが発生しました:', error);
    }
}

/**
 * 指定されたフォルダを再帰的に探索し、ファイルパスを収集します。
 * @param {string} dir - 探索するフォルダのパス。
 * @param {string[]} ignore - 無視するフォルダやファイルのリスト。
 * @param {string[]} fileList - 収集したファイルパスのリスト。
 * @returns {string[]} - 収集したファイルパスのリスト。
 */
function getFilePaths(dir, ignore = [], fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const fullPath = path.join(dir, file);

        // 無視リストに含まれる場合はスキップ
        if (ignore.some((ignored) => fullPath.includes(ignored))) {
            return;
        }

        if (fs.statSync(fullPath).isDirectory()) {
            // ディレクトリの場合は再帰的に探索
            getFilePaths(fullPath, ignore, fileList);
        } else {
            // ファイルの場合はリストに追加
            fileList.push(fullPath);
        }
    });

    return fileList;
}

/**
 * ファイルパスを指定されたテキストファイルに書き出します。
 * @param {string} outputFilePath - 出力先のテキストファイルパス。
 * @param {string[]} filePaths - 書き出すファイルパスのリスト。
 */
function writePathsToFile(outputFilePath, filePaths) {
    fs.writeFileSync(outputFilePath, filePaths.join('\n'), 'utf-8');
    console.log(`ファイルパスが ${outputFilePath} に書き出されました。`);
}

