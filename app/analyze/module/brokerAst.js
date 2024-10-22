/*
AST Broker
*/
/*import module*/
const fs = require('fs');
const path = require('path');

const { exec } = require('child_process');

const { generateGoAst } = require('./genarateAst/goAst');

/*__MAIN__*/
if (require.main === module) {
    // let mergeStateFilePath = process.argv.slice(2)[0];
    let protoPathList;
    let programFileList;

    checkFileImportModule(protoPathList, programFileList);
}

/*functions*/
function checkFileImportModule(protoFileList, progFileList) {
    const importedFiles = []; // インポートされたファイルを格納する配列

    // プログラムファイルリストをループ
    for (let i = 0; i < progFileList.length; i++) {
        const progFile = progFileList[i];

        // ASTの生成
        const ast = generateAstBasedOnExtension(progFile); // ここに実装: ASTを生成する関数

        // protoファイルリストをループ
        if(ast != null){
            for (let j = 0; j < protoFileList.length; j++) {
                const protoFile = protoFileList[j];

                // ASTとの比較
                if (isProtoFileImported(ast, protoFile)) { // ここに実装: protoファイルがASTにインポートされているかを確認する関数
                    importedFiles.push(protoFile); // インポートされているならリストに追加
                }
            }
        }
    }

    return importedFiles; // インポートされたファイルのリストを返す
}



//拡張子の判別
function generateAstBasedOnExtension(filePath) {
    
    const allowedExtensions = {
        '.go': 'go',         // Go
        // '.cs': 'csharp',     // C#
        // '.java': 'java',     // Java
        // '.scala': 'scala',   // Scala
        // '.ts': 'typescript', // TypeScript
        // '.py': 'python',     // Python
        // '.c': 'c',           // C
        // '.js': 'javascript', // JavaScript
        // '.sh': 'shell',      // Shell
        // '.html': 'html',     // HTML
        // '.htm': 'html',      // HTML (alternative extension)
        // '.css': 'css',       // CSS
        // '.pl': 'perl',       // Perl
        // '.pm': 'perl',       // Perl module
        // '.cpp': 'cpp',       // C++
        // '.cc': 'cpp',        // C++
        // '.cx': 'cpp',        // C++
        // '.rs': 'rust',       // Rust
    };

    const ext = filePath.slice(filePath.lastIndexOf('.'));
    const lang = allowedExtensions[ext];

    if (!lang) {
        console.log('Unsupported language');
        return null;
    }

    switch (lang) {
        // case 'python':
        //     return generatePythonAst(filePath);
        case 'go':
            generateGoAst(filePath)
                .then(ast => {
                    return ast;
                })
                .catch(err => {
                    console.error("Error:", err);
                });
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
            return null;
    }
}

function isProtoFileImported(ast, protoFile) {

}


module.exports = { checkFileImportModule };