/*
AST Broker


FLAG : 要確認，デバッグ必要箇所

*/
/*import module*/
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { exec } = require('child_process');

const { analyzeGoAst } = require('./analyzeAst/Go/go');


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
    '.proto': 'proto',  //Proto
};


/*__MAIN__*/
if (require.main === module) {
    // let mergeStateFilePath = process.argv.slice(2)[0];
    let protoPathMap = new Map([
        [
            "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fortune/api/fortune.proto",
            {
                package: "api",
                imports: [
                ],
                options: [
                    {
                        key: "go_package",
                        value: "github.com/golang/protobuf/ptypes/any",
                    }
                ],
            },
        ]
    ])
    let programFileList = [
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/plugin/pkg/client/auth/exec/exec.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fortune/main.go"
    ];
    let modifiedProtoList = [
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112/fortune/api/fortune.proto",
    ]
    let modifiedProgList = [
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112/doggos/main.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112/emoji/main.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112/fortune/main.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_p…ufs_and_improve_ci/merge_112/sidecar/src/main.rs",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112/vigoda/main.go"
    ]


    main_f(protoPathMap, programFileList, modifiedProtoList, modifiedProgList);

    //checkFileImportModule(protoPathList, programFileList, modifiedProtoList, modifiedProgList);
}

/*functions*/
async function main_f(protoPathMap, programFileList, modifiedProtoList, modifiedProgList){
    const pre_dependencies = await pre_Analyzedependencies(protoPathMap, programFileList);


    //const dependencies = await analyzeDependencies(protoPathMap, programFileList);
    //const affectedPrograms = findAffectedPrograms(modifiedProtoList, dependencies);
    //console.log("Affected programs:", Array.from(affectedPrograms));
}




async function pre_Analyzedependencies(protoPathMap, programPaths) {
    const protoToPrograms = {};
    const programToPrograms = {};

    // プログラムからimportの取得 + どのprotoをimportしているか + どのプログラムをimportしているか
    for (const progPath of programPaths) {
        // プログラムからimportの取得
        const importedModules = await getImportedPrograms(progPath);

        // どのprotoをimportしているか
        for (const [protoPath, protoMeta] of protoPathMap) {

            /*bool package名一致*/
            var isPackageImported = importedModules.some(
                function(module) {
                return module === protoMeta.package;
                }
            );

            //package名でimportされている場合，ほかの条件を確認しない
            if (isPackageImported) {
                // protoToProgramsへの登録
                if (!protoToPrograms[protoPath]) {
                    protoToPrograms[protoPath] = [];
                }
                protoToPrograms[protoPath].push(progPath);

                continue;
            }



            /*proto内optionsの確認*/
            if (protoMeta.options.length != 0){
                //言語ごとのpackage取得
                const optionPackagePath = getPackageNameOption(progPath, protoMeta, importedModules);
                //属する言語がない場合 or option定義されていない場合
                if (optionPackagePath.isOptionImported === true){
                    //optionsで一致する場合の探索   FLAG
                    var isOptionImported = importedModules.some(
                        function(module) {
                            return module === optionPackagePath.packageNamePath;
                        }
                    );

                    // FLAG
                    if (isOptionImported) {
                        // protoToProgramsへの登録
                        if (!protoToPrograms[protoPath]) {
                            protoToPrograms[protoPath] = [];
                        }
                        protoToPrograms[protoPath].push(progPath);

                        continue;
                    }
                }
            }


            /*package名と他の情報を組み合わせる探索*/
            //package
            const packageName = protoMeta.package;

            //依存ファイル
            //go.mod
            const goModList = findGoModFiles(progPath);
            if(goModList.length != 0){

                console.log();
            
            }

            //Makefile
            const makefileList = findMakefileFiles(progPath);
            if(makefileList.length != 0){
                console.log();
            }

            //Dockerfile
            const dockerfileList = findDockerfiles(progPath);
            if(dockerfileList.length != 0){
                console.log();
            }
 
            //逆引き



            var isOptionImported = protoMeta.options.some(
                function(option) {
                    return importedModules.includes(option.value);
                }
            );

            if (isPackageImported || isOptionImported) { 
                if (!protoToPrograms[protoPath]) { 
                    protoToPrograms[protoPath] = []; 
                } 
                protoToPrograms[protoPath].push(progPath); 
            } 
        }
    }

    return { protoToPrograms, programToPrograms };
}


//proto optionからpackage名の取得
function getPackageNameOption(filePath, protoMeta, importedModules){
    const extension = path.extname(filePath);
    let isOptionImported = false;
    let packageName;
    let packageNamePath = null;

    switch (extension) {
        case '.go':
            packageName = protoMeta.options.find(option => option.key === 'go_package');
            if (packageName && importedModules.includes(packageName.value)) {
                isOptionImported = true;
                packageNamePath = packageName.value;

                return { isOptionImported, packageNamePath };  
            }

            return { isOptionImported, packageNamePath };

        case '.js':

            break;
        case '.py':

            break;
        // 他の言語の追加
        default:

            //どれにも属さない為，falseを返す
            return { isOptionImported, packageNamePath };
    }
}


//Array go.modファイルパスの取得
function findGoModFiles(progPath) {
    const goModFiles = [];
    let currentPath = path.resolve(progPath);

    while (true) {
        // Check if the current directory contains a go.mod file
        const goModPath = path.join(currentPath, 'go.mod');
        if (fs.existsSync(goModPath)) {
            goModFiles.push(goModPath);
        }

        // Check if the current path contains "merge_" or "premerge_"
        const baseName = path.basename(currentPath);
        if (baseName.includes('merge_') || baseName.includes('premerge_')) {
            break;
        }

        // Move up one directory
        const parentPath = path.dirname(currentPath);
        if (parentPath === currentPath) {
            // Reached the file system root
            break;
        }
        currentPath = parentPath;
    }

    return goModFiles;
}

//Array makefileのリストを取得
function findMakefileFiles(progPath) {
    const makefileFiles = [];
    let currentPath = path.resolve(progPath);

    while (true) {
        // Check if the current directory contains a Makefile
        const makefilePath = path.join(currentPath, 'Makefile');
        if (fs.existsSync(makefilePath)) {
            makefileFiles.push(makefilePath);
        }

        // Check if the current path contains "merge_" or "premerge_"
        const baseName = path.basename(currentPath);
        if (baseName.includes('merge_') || baseName.includes('premerge_')) {
            break;
        }

        // Move up one directory
        const parentPath = path.dirname(currentPath);
        if (parentPath === currentPath) {
            // Reached the file system root
            break;
        }
        currentPath = parentPath;
    }

    return makefileFiles;
}


//Array dockerfileのリストを取得
function findDockerfiles(progPath) {
    const dockerfiles = [];
    let currentPath = path.resolve(progPath);

    while (true) {
        // Read all files in the current directory
        const files = fs.readdirSync(currentPath);

        // Filter files to find Dockerfile or files containing "dockerfile"
        files.forEach((file) => {
            if (
                !path.extname(file) && // No extension
                file.toLowerCase().includes('dockerfile') // Contains "dockerfile" (case-insensitive)
            ) {
                dockerfiles.push(path.join(currentPath, file));
            }
        });

        // Check if the current path contains "merge_" or "premerge_"
        const baseName = path.basename(currentPath);
        if (baseName.includes('merge_') || baseName.includes('premerge_')) {
            break;
        }

        // Move up one directory
        const parentPath = path.dirname(currentPath);
        if (parentPath === currentPath) {
            // Reached the file system root
            break;
        }
        currentPath = parentPath;
    }

    return dockerfiles;
}




/*****/


// プロジェクト全体の依存関係を解析
async function analyzeDependencies(protoPathMap, programPaths) {
    //const protoPackages = protoPathMap.map(getProtoPackageName);
    //const protoPackages = Array.from(protoPathMap.values()).map(getProtoPackageName);
    const protoToPrograms = {};
    const programToPrograms = {};

    for (const progPath of programPaths) {
        const importedProtos = getImportedProtos(progPath, protoPathMap);
        importedProtos.forEach(proto => {
            if (!protoToPrograms[proto]) {
                protoToPrograms[proto] = [];
            }
            protoToPrograms[proto].push(progPath);
        });

        // importしているものを取得
        const importedPrograms = await getImportedPrograms(progPath); // 非同期処理
        programToPrograms[progPath] = importedPrograms;
    }

    return { protoToPrograms, programToPrograms };
}

// 影響を受けるプログラムファイルを再帰的に探索
function findAffectedPrograms(modifiedProtos, dependencies) {
    const { protoToPrograms, programToPrograms } = dependencies;
    const affectedPrograms = new Set();

    function dfs(program) {
        if (affectedPrograms.has(program)) return;
        affectedPrograms.add(program);
        (programToPrograms[program] || []).forEach(dfs);
    }

    modifiedProtos.forEach(modProto => {
        const affected = protoToPrograms[getProtoPackageName(modProto)] || [];
        affected.forEach(dfs);
    });

    return affectedPrograms;
}

// プログラムファイルからimportしているprotoファイルを特定
//文字列一致
//proto違い packageは同じ
//相対パスか
function getImportedProtos(filePath, protoPaths) {
    const content = fs.readFileSync(filePath, 'utf8');
    const importedProtos = [];

    protoPaths.forEach(protoPath => {
        // protoファイルからpackage名を取得
        const protoPackageName = getProtoPackageName(protoPath);
        // より厳密にパッケージ名を特定するために正規表現を使う
        const importRegex = new RegExp(`import\\s+["'].*${path.basename(protoPath)}["'];`);
        if (importRegex.test(content)) {
            importedProtos.push(protoPackageName);   
        }
    });

    return importedProtos;
}

async function getImportedProtos_Go(filePath, protoPaths) {
    const extension = path.extname(filePath);
    let imports = [];

    switch (extension) {
        case '.go':
            try {
                imports = await analyzeGoAst(filePath); // Promise が解決されるまで待機
                console.log(imports);
            } catch (err) {
                console.error("Error generating Go AST:", err);
                throw err; // エラーを呼び出し元に伝搬
            }
            break;

        case '.js':
            //imports = getJsImportsWithAST(filePath);
            break;
        case '.py':
            //imports = getPythonImportsWithAST(filePath);
            break;
        // 他の言語用のAST解析をここに追加
    }

    return imports;
}


// プログラムファイルからimportしている他のプログラムファイルを特定
async function getImportedPrograms(filePath) {
    const extension = path.extname(filePath);
    let imports = [];

    switch (extension) {
        case '.go':
            try {
                imports = await analyzeGoAst(filePath); // Promise が解決されるまで待機
                console.log(imports);
            } catch (err) {
                console.error("Error generating Go AST:", err);
                throw err; // エラーを呼び出し元に伝搬
            }
            break; 

        case '.js':
            //imports = getJsImportsWithAST(filePath);
            break;
        case '.py':
            //imports = getPythonImportsWithAST(filePath);
            break;
        // 他の言語用のAST解析をここに追加
    }

    return imports;
}

// protoファイルからpackage名を取得
function getProtoPackageName(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const packageMatch = content.match(/package\s+([\w.]+);/);
    return packageMatch ? packageMatch[1] : null;
}




/****************** */
function getGoImportsWithAST(filePath) {

}

//esprima
// JavaScriptファイルのimportをASTで解析
function getJsImportsWithAST(filePath) {
    // const content = readFile(filePath);
    // // const ast = esprima.parseModule(content);
    // const imports = [];

    // ast.body.forEach(node => {
    //     if (node.type === 'ImportDeclaration') {
    //         imports.push(node.source.value);
    //     }
    // });

    // return imports;
}





/************************/
async function checkFileImportModule(protoFileList, progFileList, modifiedProtoList, modifiedProgList) {
    const importedFiles = []; // インポートされたファイルを格納する配列

    const protoPackages = extractPackageNames(modifiedProtoList);

    // プログラムファイルリストをループ
    for (let i = 0; i < progFileList.length; i++) {
        const progFile = progFileList[i];
        //const packageName = protoPackages[i]

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

//proto packageの取得
function extractPackageNames(protoFiles) {
    const packageNames = protoFiles.map(filePath => {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const packageMatch = fileContent.match(/^\s*package\s+([\w\.]+)\s*;/m);
            if (packageMatch) {
                return packageMatch[1];
            } else {
                console.warn(`No package name found in file: ${filePath}`);
                return null;
            }
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            return null;
        }
    });

    // Filter out null values (files without a package name or read errors)
    return packageNames.filter(name => name !== null);
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
                        analyzeGoAst(filePath)
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
                        goFetcher(filePath)
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
module.exports = { main_f };

