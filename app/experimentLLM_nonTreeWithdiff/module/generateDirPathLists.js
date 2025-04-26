/**
 * 入力パスより、指定されたフォルダを再帰的に探索し、ファイルパスを収集するモジュール
 * 
 * #04_allFilePaths
 * 
 * @module generateDirPathLists
 * @description 指定されたフォルダを再帰的に探索し、ファイルパスを収集する
 * @example
 * // 使用例
 * const filePaths = getPathTree(targetDir, ignore);
 */

const fs = require('fs');
const path = require('path');

const ignore = ['.git', 'node_modules', 'output', '.git_disabled'];

// メイン処理
if (require.main === module) {
    const targetDir = '/app/dataset/modified_proto_reps/daos/pullrequest/DAOS-14214_control-_Fix_potential_missed_call_to_drpc_failure_handlers/premerge_12944/';
    const outputPath = '/app/app/experimentLLM_nonTreeWithdiff/output';
    const outputFilePath = path.join(outputPath, 'filePaths.json');
    

    try {
        const tree = getPathTree(targetDir);

        writePathsToJson(outputFilePath, tree);
    } catch (error) {
        console.error('エラー:', error);
    }
}

/**
 * 指定フォルダを再帰的に探索し、ファイルパスを収集
 * @param {string} dir - 探索フォルダ
 * @returns {string[]} - ファイルパスリスト
 */
function getPathTree(dir) {
    let fileList = [];
    fs.readdirSync(dir).forEach((file) => {
        const fullPath = path.join(dir, file);
        if (ignore.some((ignored) => fullPath.includes(ignored))) return;
        fs.statSync(fullPath).isDirectory()
            ? fileList.push(...getPathTree(fullPath, ignore))
            : fileList.push(fullPath);
    });

    const tree = buildPathTree(fileList, dir);

    return tree;
}

/**
 * ファイルパスのリストをツリー構造のオブジェクトに変換
 * @param {string[]} filePaths - ファイルパスリスト
 * @param {string} baseDir - ベースディレクトリ
 * @returns {object} - ツリー構造のオブジェクト
 */
function buildPathTree(filePaths, baseDir) {
    const tree = {};

    filePaths.forEach((filePath) => {
        const relativePath = path.relative(baseDir, filePath);
        const parts = relativePath.split(path.sep);
        let current = tree;

        parts.forEach((part, index) => {
            if (!current[part]) {
                current[part] = index === parts.length - 1 ? null : {};
            }
            current = current[part];
        });
    });

    return tree;
}

/**
 * ファイルパスをJSON形式で書き出し
 * @param {string} outputFilePath - 出力先
 * @param {object} data - 階層構造データ
 */
function writePathsToJson(outputFilePath, data) {
    fs.writeFileSync(outputFilePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`ファイルパスが ${outputFilePath} にJSON形式で保存されました。`);
}

module.exports = { getPathTree };