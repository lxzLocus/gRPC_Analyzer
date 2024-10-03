const fs = require('fs');
const path = require('path');

// 再帰的に指定したディレクトリ内の.protoファイルをカウントする関数
function countProtoFiles(directory) {
    let count = 0;

    // ディレクトリ内のすべてのファイルとフォルダを読み取る
    const items = fs.readdirSync(directory, { withFileTypes: true });

    items.forEach(item => {
        const fullPath = path.join(directory, item.name);

        // ディレクトリなら再帰的に探索
        if (item.isDirectory()) {
            count += countProtoFiles(fullPath);
        } else if (item.isFile() && path.extname(item.name) === '.proto') {
            // .protoファイルを見つけたらカウント
            console.log(item.name);
            count++;
        }
    });

    return count;
}

// 使用例: datasetFolderを指定
const datasetFolder = '/app/dataset/clone/rasa-sdk/pullrequest/-ATO-1652-_Add_unit_tests_for_GRPCActionServerWebhook/merge_1112'; // 探索したいディレクトリのパスを指定
const protoFileCount = countProtoFiles(datasetFolder);

console.log(`.protoファイルの数: ${protoFileCount}`);
