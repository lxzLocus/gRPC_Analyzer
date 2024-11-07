/*
Go用　動作確認
*/
/*import module*/
const fs = require('fs');
const path = require('path');
const readline = require('readline');


const { generateGoAst } = require('/app/app/analyze/module/generateAst/goAst');
const { fetchGoAst } = require('/app/app/analyze/module/fetchAst/fetchGoAst');

/*config*/
const allowedExtensions = {
    '.go': 'go',         // Go
    '.cs': 'csharp',     // C#
    '.java': 'java',     // Java
    '.scala': 'scala',   // Scala
    '.ts': 'typescript', // TypeScript
    '.py': 'python',     // Python
    '.c': 'c',           // C
    '.js': 'javascript', // JavaScript
    '.sh': 'shell',      // Shell
    '.html': 'html',     // HTML
    '.htm': 'html',      // HTML (alternative extension)
    '.css': 'css',       // CSS
    '.pl': 'perl',       // Perl
    '.pm': 'perl',       // Perl module
    '.cpp': 'cpp',       // C++
    '.cc': 'cpp',        // C++
    '.cx': 'cpp',        // C++
    '.rs': 'rust',       // Rust
};


/*__MAIN__*/
if (require.main === module) {
    // let mergeStateFilePath = process.argv.slice(2)[0];
    let protoPathList = '';
    let programFileList = ['/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112/doggos/main.go'];

    checkFileImportModule(protoPathList, programFileList);
}

/*functions*/
async function checkFileImportModule(protoFileList, progFileList) {
    const importedFiles = []; // インポートされたファイルを格納する配列

    // プログラムファイルリストをループ
    for (let i = 0; i < progFileList.length; i++) {
        const progFile = progFileList[i];

        try {
            // AST生成を非同期に待機
            const ast = await generateAstBasedOnExtension(progFile);
            let protoFile

            isProtoFileImported(ast, progFile, protoFile);

            if (ast !== null) {
                for (let j = 0; j < protoFileList.length; j++) {
                    const protoFile = protoFileList[j];

                    // ASTが生成された場合にprotoファイルがインポートされているかを確認
                    if (isProtoFileImported(ast, progFile, protoFile)) {
                        importedFiles.push(protoFile);
                    }
                }
            }
        } catch (err) {
            console.error(`Error processing ${progFile}:`, err);
        }
    }

    return importedFiles; // インポートされたファイルのリストを返す
}

//ファイルの行数確認
function shouldSkipAstGeneration(filePath, callback) {
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
    });

    let lineCount = 0;
    let hasExceeded = false;  // フラグを追加

    rl.on('line', () => {
        lineCount++;
        // 8000行を超えたらチェックをやめてスキップ指示を返す
        if (lineCount > 8000) {
            hasExceeded = true;
            rl.close();  // `close` イベントをトリガー
        }
    });

    rl.on('close', () => {
        // 8000行を超えたらtrueを返す
        if (hasExceeded) {
            callback(true);
        } else {
            callback(false);
        }
    });
}


//拡張子の判別
function generateAstBasedOnExtension(filePath) {

    const ext = filePath.slice(filePath.lastIndexOf('.'));
    const lang = allowedExtensions[ext];

    if (!lang) {
        console.log('Unsupported language');
        return Promise.resolve(null);  // Promiseとしてnullを返す
    }

    // PromiseでAST生成を非同期に処理
    return new Promise((resolve, reject) => {
        shouldSkipAstGeneration(filePath, (shouldSkip) => {
            if (shouldSkip) {
                console.log('File too large, skipping AST generation.');
                resolve(null);  // ファイルが大きすぎる場合はnullを返す
            } else {
                switch (lang) {
                    case 'go':
                        generateGoAst(filePath)
                            .then(ast => resolve(ast))  // 成功時にASTを返す
                            .catch(err => {
                                console.error("Error generating Go AST:", err);
                                reject(err);  // エラー時はエラーを返す
                            });
                        break;
                    default:
                        console.log('Unsupported language');
                        resolve(null);  // サポートされていない言語の場合
                }
            }
        });
    });
}

//AST解析を行う
function isProtoFileImported(ast, programFile, protoFile) {

    return new Promise((resolve, reject) => {
        fetchGoAst(ast)
            .then(ast => resolve(ast))  // 成功時にASTを返す
            .catch(err => {
                console.error("Error generating Go AST:", err);
                reject(err);  // エラー時はエラーを返す
            });

    });
}


module.exports = { checkFileImportModule };