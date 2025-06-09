/*
指定したディレクトリを再帰的に探索し、空フォルダを削除します。
ご要望の「commitSnapshot」や「merge」配下の空ディレクトリの削除も、
この汎用的なロジックで対応可能です。
*/

const fs = require('fs');
const path = require('path');

/**
 * 指定したディレクトリを再帰的に探索し、空のフォルダを削除します。
 * この関数は、ディレクトリ内にファイルや空でないサブディレクトリが
 * なくなった場合に、そのディレクトリ自身を削除します。
 *
 * @param {string} dirPath 探索対象のディレクトリパス
 * @returns {boolean} ディレクトリが空で削除された場合はtrue、そうでなければfalse
 */
function deleteEmptyFolders(dirPath) {
    try {
        // パスの存在と、それがディレクトリであることを確認
        const stat = fs.statSync(dirPath);
        if (!stat.isDirectory()) {
            return false; // ディレクトリでなければ何もしない
        }
    } catch (e) {
        // statSyncが失敗した場合（例：アクセス権限なし、パスが存在しない）
        console.error(`パス情報の取得に失敗しました: ${dirPath}`, e.message);
        return false;
    }

    let isDirEmpty = true;
    let entries;
    try {
        entries = fs.readdirSync(dirPath);
    } catch (e) {
        console.error(`ディレクトリの読み取りに失敗しました: ${dirPath}`, e.message);
        return false; // 読み取れなければ処理中断
    }


    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                // サブディレクトリを再帰的に処理します。
                // サブディレクトリがこの処理の結果、削除されなかった場合（= 空ではなかった場合）、
                // 現在のディレクトリも空ではないと判断します。
                if (!deleteEmptyFolders(fullPath)) {
                    isDirEmpty = false;
                }
            } else {
                // ファイルが存在する場合、ディレクトリは空ではありません。
                isDirEmpty = false;
            }
        } catch (e) {
            console.error(`エントリ情報の取得に失敗しました: ${fullPath}`, e.message);
            isDirEmpty = false; // エラーが発生したエントリがある場合、安全のため空ではないとみなす
        }
    }

    // isDirEmptyがtrueのままなら、ディレクトリは空です。
    // ご要望の「commitSnapshot」や「merge」配下のディレクトリも、
    // この時点で空であれば削除対象となります。
    if (isDirEmpty) {
        try {
            console.log(`空のディレクトリを削除します: ${dirPath}`);
            fs.rmdirSync(dirPath);
            return true; // 削除成功
        } catch (e) {
            console.error(`ディレクトリの削除に失敗しました: ${dirPath}`, e.message);
            return false; // 削除失敗
        }
    }

    return false; // 空ではなかったので削除しない
}


// --- メイン処理 ---
// このスクリプトが直接実行された場合にのみ以下の処理を実行します。
if (require.main === module) {
    // 削除対象のルートディレクトリをコマンドライン引数から取得、なければ固定値を参照
    // 使用法: node your_script_name.js /path/to/your/dir
    const targetDir = process.argv[2] || "/app/dataset/filtered_commit";

    if (!fs.existsSync(targetDir)) {
        console.error(`指定されたディレクトリが存在しません: ${targetDir}`);
        process.exit(1);
    }

    console.log(`処理を開始します。対象ディレクトリ: ${targetDir}`);
    deleteEmptyFolders(targetDir);
    console.log('処理が完了しました。');
}