/*
Docs

`premerge` ディレクトリからprotoファイルの path と content を取得し、
JSON ファイルとして保存する

ファイルの内容差分を出力するものではない

#01_proto.txt
*/


import fs from 'fs';
import path from 'path';


if(require.main === module) {
    const premergePath = '/app/dataset/confirmed/pravega/Issue_4334-_Fix_auth_and_related_exception_handling/premerge_4336';
    const protoContentList = findFiles(premergePath, '.proto');

    console.log(protoContentList);
}



/**
 * 指定されたディレクトリから再帰的にファイルを探索し、指定された拡張子のファイルをJSON形式で返す
 * @param {string} folderDirPath - 検索を開始するディレクトリのパス
 * @param {string} fileExtension - 対象とするファイルの拡張子（例: '.proto'）
 * @param {string} originalDirPath - 初期ディレクトリのパス（再帰呼び出しで使用）
 * @returns {Object} - ファイルのパスと内容を含むJSONオブジェクト
 */
export default function findFiles(folderDirPath, fileExtension, originalDirPath = folderDirPath) {
    const results = [];
    const list = fs.readdirSync(folderDirPath);

    list.forEach(file => {
        const filePath = path.join(folderDirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // findFiles の戻り値から適切なキーを指定して配列を取得
            results.push(...findFiles(filePath, fileExtension, originalDirPath)[fileExtension === '.proto' ? 'proto_files' : 'files']);
        } else if (file.endsWith(fileExtension)) {
            const content = fs.readFileSync(filePath, 'utf8');
            const relativePath = path.relative(originalDirPath, filePath);
            results.push({ path: relativePath, content });
        }
    });

    const key = fileExtension === '.proto' ? 'proto_files' : 'files';
    return { [key]: results };
}

