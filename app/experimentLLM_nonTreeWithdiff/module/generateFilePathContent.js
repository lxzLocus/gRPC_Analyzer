/*
Docs

`premerge` ディレクトリからprotoファイルの path と content を取得し、
JSON ファイルとして保存する

ファイルの内容差分を出力するものではない

#01_proto.txt
*/


const fs = require('fs');
const path = require('path');

/**
 * 指定されたディレクトリから再帰的にファイルを探索し、指定された拡張子のファイルをJSON形式で返す
 * @param {string} folderDirPath - 検索を開始するディレクトリのパス
 * @param {string} fileExtension - 対象とするファイルの拡張子（例: '.proto'）
 * @returns {Object} - ファイルのパスと内容を含むJSONオブジェクト
 */
function findFiles(folderDirPath, fileExtension) {
    const results = [];
    const list = fs.readdirSync(folderDirPath);

    list.forEach(file => {
        const filePath = path.join(folderDirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // findFiles の戻り値から適切なキーを指定して配列を取得
            results.push(...findFiles(filePath, fileExtension)[fileExtension === '.proto' ? 'proto_files' : 'files']);
        } else if (file.endsWith(fileExtension)) {
            const content = fs.readFileSync(filePath, 'utf8');
            results.push({ path: filePath, content });
        }
    });

    const key = fileExtension === '.proto' ? 'proto_files' : 'files';
    return { [key]: results };
}

module.exports = { findFiles };
