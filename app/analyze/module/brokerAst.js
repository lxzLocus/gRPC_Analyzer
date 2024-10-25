/*
AST Broker
*/
/*import module*/
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { exec } = require('child_process');

const { generateGoAst } = require('./genarateAst/goAst');

const { generateGoAst } = require('./genarateAst/goAst');

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
    let programFileList = ['/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/tables.go'];

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
                    // case 'python':
                    //     return generatePythonAst(filePath);
                    case 'go':
                        generateGoAst(filePath)
                        .then(ast => resolve(ast))  // 成功時にASTを返す
                        .catch(err => {
                            console.error("Error generating Go AST:", err);
                            reject(err);  // エラー時はエラーを返す
                        });
                        break;
                    // case 'java':
                    //     return generateJavaAst(filePath);  
                    // case 'csharp':
                    //     return generateCSharpAst(filePath);
                    // case 'scala':
                    //     return generateScalaAst(filePath); 
                    // case 'typescript':
                    //     return generateTypeScriptAst(filePath);
                    // case 'cpp':
                    //     return generateCppAst(filePath);   
                    // case 'javascript':
                    //     return generateJavaScriptAst(filePath);
                    // case 'rust':
                    //     return generateRustAst(filePath);  
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
    const ext = filePath.slice(filePath.lastIndexOf('.'));
    const lang = allowedExtensions[ext];

    return new Promise((resolve, reject) => {
        shouldSkipAstGeneration(filePath, (shouldSkip) => {
            if (shouldSkip) {
                console.log('File too large, skipping AST generation.');
                resolve(null);  // ファイルが大きすぎる場合はnullを返す
            } else {
                switch (lang) {
                    // case 'python':
                    //     return generatePythonAst(filePath);
                    case 'go':
                        generateGoAst(filePath)
                            .then(ast => resolve(ast))  // 成功時にASTを返す
                            .catch(err => {
                                console.error("Error generating Go AST:", err);
                                reject(err);  // エラー時はエラーを返す
                            });
                        break;
                    // case 'java':
                    //     return generateJavaAst(filePath);  
                    // case 'csharp':
                    //     return generateCSharpAst(filePath);
                    // case 'scala':
                    //     return generateScalaAst(filePath); 
                    // case 'typescript':
                    //     return generateTypeScriptAst(filePath);
                    // case 'cpp':
                    //     return generateCppAst(filePath);   
                    // case 'javascript':
                    //     return generateJavaScriptAst(filePath);
                    // case 'rust':
                    //     return generateRustAst(filePath);  
                    default:
                        console.log('Unsupported language');
                        resolve(null);  // サポートされていない言語の場合
                }
            }
        });
    });
}


module.exports = { checkFileImportModule };