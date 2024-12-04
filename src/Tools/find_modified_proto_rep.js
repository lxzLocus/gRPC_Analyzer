/*
データセット　リポジトリフォルダからprotoが変更されたものを探す
*/
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

/*__CONFIG__*/
const outputPath = '/app/dataset/modified_proto_reps'; // コピー先のディレクトリパス

/*__MAIN__*/
if (require.main === module) {
    const datasetPath = '/app/dataset/pre_filter/temp'; // 適切なパスに置き換えてください
    main(datasetPath);
}

/**
 * 指定されたディレクトリ内のサブディレクトリをリストアップする
 * @param {string} srcPath - ソースディレクトリのパス
 * @returns {string[]} - サブディレクトリのリスト
 */
function listDirectories(srcPath) {
    return fs.readdirSync(srcPath).filter(file => fs.statSync(path.join(srcPath, file)).isDirectory());
}

/**
 * 指定されたディレクトリ内の.protoファイルをリストアップする
 * @param {string} directory - ディレクトリのパス
 * @returns {string[]} - .protoファイルのリスト
 */
function listProtoFiles(directory) {
    let protoFiles = [];
    const files = fs.readdirSync(directory);

    files.forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            protoFiles = protoFiles.concat(listProtoFiles(fullPath));
        } else if (path.extname(file) === '.proto') {
            protoFiles.push(fullPath);
        }
    });

    return protoFiles;
}

/**
 * premergePathとmergePathのディレクトリ内の.protoファイルを比較し、変更があればdestinationにコピーする
 * @param {string} premergePath - 変更前のディレクトリパス
 * @param {string} mergePath - 変更後のディレクトリパス
 * @param {string} destination - コピー先のディレクトリパス
 */
async function copyIfProtoChanged(premergePath, mergePath, destination) {
    const premergeProtos = listProtoFiles(premergePath);
    const mergeProtos = listProtoFiles(mergePath);

    // 変更された.protoファイルをフィルタリング
    const changedProtos = mergeProtos.filter(proto => !premergeProtos.includes(proto));

    if (changedProtos.length > 0) {
        await fse.ensureDir(destination); // コピー先ディレクトリを作成
        await fse.copy(premergePath, path.join(destination, path.basename(premergePath))); // 変更前のディレクトリをコピー
        await fse.copy(mergePath, path.join(destination, path.basename(mergePath))); // 変更後のディレクトリをコピー
    }
}

/**
 * 指定されたリポジトリパス内の 'pullrequest' および 'issue' ディレクトリを処理します。
 * 各ディレクトリ内のアイテムをチェックし、'premerge' および 'merge' ディレクトリが存在する場合、
 * プロトコルバッファが変更されたかどうかを確認し、変更があれば指定された出力パスにコピーします。
 *
 * @param {string} repoPath - 処理するリポジトリのパス
 * @returns {Promise<void>} - 非同期処理の完了を示す Promise
 */
async function processRepository(repoPath) {
    const types = ['pullrequest', 'issue'];

    for (const type of types) {
        const typePath = path.join(repoPath, type);
        if (!fs.existsSync(typePath)) continue;

        const items = listDirectories(typePath);

        for (const item of items) {
            const itemPath = path.join(typePath, item);
            const subItems = listDirectories(itemPath);
            const issueNumberMatch = subItems.find(subItem => subItem.match(/_(\d+)$/)); // premerge_123, merge_123 から番号部分だけを取得

            if (!issueNumberMatch) continue;  // issueNumberが取得できない場合はスキップ
            const issueNumber = parseInt(issueNumberMatch.match(/_(\d+)$/)[1], 10); // 数字部分だけを取得

            const premergePath = path.join(itemPath, `premerge_${issueNumber}`);
            const mergePath = path.join(itemPath, `merge_${issueNumber}`);

            if (fs.existsSync(premergePath) && fs.existsSync(mergePath)) {
                const destinationPath = path.join(outputPath, path.basename(repoPath), type, item);
                await copyIfProtoChanged(premergePath, mergePath, destinationPath);
            }
        }
    }
}

function main(datasetPath) {
    const repos = listDirectories(datasetPath);

    repos.forEach(async repo => {
        const repoPath = path.join(datasetPath, repo);
        await processRepository(repoPath);
    });
}

