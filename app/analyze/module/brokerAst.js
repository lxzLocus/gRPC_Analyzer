/*
AST Broker
*/
/*import module*/
const fs = require('fs');
const path = require('path');


/*__MAIN__*/
if (require.main === module) {
    // let mergeStateFilePath = process.argv.slice(2)[0];
    let protoPathList;
    let programFileList;

    ast(protoPathList, programFileList);
}

/*functions*/
function ast(progFileList, protoFileList) {
    const importedFiles = []; // インポートされたファイルを格納する配列

    // プログラムファイルリストをループ
    for (let i = 0; i < progFileList.length; i++) {
        const progFile = progFileList[i];

        // ASTの生成
        const ast = make_AST(progFile); // ここに実装: ASTを生成する関数

        // protoファイルリストをループ
        for (let j = 0; j < protoFileList.length; j++) {
            const protoFile = protoFileList[j];

            // ASTとの比較
            if (isProtoFileImported(ast, protoFile)) { // ここに実装: protoファイルがASTにインポートされているかを確認する関数
                importedFiles.push(protoFile); // インポートされているならリストに追加
            }
        }
    }

    return importedFiles; // インポートされたファイルのリストを返す
}

// ASTを生成する関数 (実装はここに追加)
function make_AST(progFile) {
    // ここに実装: プログラムファイルからASTを生成して返す
}

// protoファイルがASTにインポートされているかを確認する関数 (実装はここに追加)
function isProtoFileImported(ast, protoFile) {
    // ここに実装: ASTを参照し、指定されたprotoファイルがインポートされているかどうかを確認
}


module.exports = { ast };