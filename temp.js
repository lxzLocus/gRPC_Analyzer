/*
AST Broker


FLAG : 要確認，デバッグ必要箇所

実際のパスの生成

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
            "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/proto/Emoji.proto",
            {
                package: "emojivoto.v1",
                imports: [
                ],
                options: [
                    {
                        key: "go_package",
                        value: "proto/",
                    },
                ],
            },
        ],
        [
            "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/proto/Voting.proto",
            {
                package: "emojivoto.v1",
                imports: [
                ],
                options: [
                    {
                        key: "go_package",
                        value: "proto/",
                    },
                ],
            },
        ]
    ])
    let programFileList = [
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-emoji-svc/api/api.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-voting-svc/api/api.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-emoji-svc/cmd/server.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-voting-svc/cmd/server.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-web/web/web.go"
    ];
    let modifiedProtoList = [
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/proto/Emoji.proto",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/proto/Voting.proto"
    ]
    let modifiedProgList = [
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-emoji-svc/api/api.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-voting-svc/api/api.go"
    ]

    checkFileImportModule(protoPathMap, programFileList, modifiedProtoList, modifiedProgList);

}

/*functions*/
async function checkFileImportModule(protoPathMap, programFileList, modifiedProtoList, modifiedProgList) {
    const pre_dependencies = await pre_Analyzedependencies(protoPathMap, programFileList);


    console.log();

    const dependencies = await analyzeDependencies(protoPathMap, programFileList);
    const affectedPrograms = findAffectedPrograms(modifiedProtoList, dependencies);
    console.log("Affected programs:", Array.from(affectedPrograms));
}


async function pre_Analyzedependencies(protoPathMap, programPaths) {
    const protoToPrograms = {};
    const programToPrograms = {};

    let repositoryName;

    /*Go*/
    let goPathMode;
    let goVersion;

    let goModList;
    let goModModuleList;
    let goPathSrc;


    // プログラムからimportの取得 + どのprotoをimportしているか + どのプログラムをimportしているか
    for (const progPath of programPaths) {
        // プログラムからimportの取得
        const importedModules = await getImportedPrograms(progPath);
        const extension = await path.extname(progPath);

        switch (extension) {
            case '.go':


                /*共通項目取得*/
                if (!repositoryName) {
                    repositoryName = getrepositoryName(progPath);
                }

                if (goPathMode === undefined) {
                    goPathMode = checkGoPathMode(progPath);
                }

                if (goPathMode === true) {
                    goPathSrc = progPath.split('/').slice(progPath.split('/').findIndex(segment => segment.includes('premerge_') || segment.includes('merge_'))).join('/');
                } else {
                    //go.modの取得
                    goModList = findGoModFiles(progPath);
                    goModModuleList = goModList.map(goModPath => {
                        const content = fs.readFileSync(goModPath, 'utf8');
                        const moduleLine = content.split('\n').find(line => line.startsWith('module'));
                        return moduleLine.split(' ')[1].trim();
                    });
                }





                for (const [protoPath, protoMeta] of protoPathMap) {
                    const packagePath = getPackagePath(protoPath);

                    /*protoの参照********************************************************************/

                    /*
                    protoファイルのoptionからpackage名を取得
                    package名がimportされているかを確認
                    */
                    if (protoMeta.options.length != 0) {
                        //言語ごとのpackage取得
                        const optionPackagePath = getPackageNameOption(progPath, protoMeta, importedModules);
                        //属する言語がない場合 or option定義されていない場合
                        if (optionPackagePath.isOptionImported === true) {

                            // protoToProgramsへの登録
                            if (!protoToPrograms[protoPath]) {
                                protoToPrograms[protoPath] = [];
                            }
                            protoToPrograms[protoPath].push(progPath);

                            continue;
                        }
                    }


                    /*
                    package Pathで一致する場合
                    importedModulesのうちのいずれかとpackagePathが
                    完全一致する場合
                    */
                    var isPackagePathImported = importedModules.some(
                        function (module) {
                            return module === packagePath;
                        }
                    );

                    if (isPackagePathImported) {
                        // protoToProgramsへの登録
                        if (!protoToPrograms[protoPath]) {
                            protoToPrograms[protoPath] = [];
                        }
                        protoToPrograms[protoPath].push(progPath);

                        continue;
                    }



                    /*Go.modの参照********************************************************************/

                    /*
                    go.modが存在する場合
                    go.mod内に記載されている module が存在する & packagePath が含まれている & 指し示すmoduleが同じものである
                    */
                    if (goPathMode === false) {
                        /*
                        プログラム内のimport文に記載されているモジュール名と、go.mod内のmodule名を比較
                        protoのpackage pathと一致するmoduleがあるかを確認

                        あいまい条件
                        厳格な一致ではない
                        */
                        importedModules.forEach((importedModule) => {
                            goModModuleList.forEach((module) => {
                                if (importedModule.includes(module)) {
                                    if (importedModule.includes(packagePath)) {
                                        console.log(`Found ${packagePath} in ${importedModule}`);

                                        // protoToProgramsへの登録
                                        if (!protoToPrograms[protoPath]) {
                                            protoToPrograms[protoPath] = [];
                                        }
                                        protoToPrograms[protoPath].push(progPath);

                                        return;
                                    }
                                }
                            });
                        });

                    } else {

                        /*Dockerfile, Makefile 他のファイルを参照する場合*****************************************************************/




                        console.log(`Not Imported: ${progPath} in ${protoPath}`);



                    }
                }

                break;

            default:
                console.log(`Not Supported lang: ${progPath}`);
                break;
        }
    }


    /*programToProgramsの取得*/


    return { protoToPrograms, programToPrograms };
}


//string プロジェクト名の取得
function getrepositoryName(progPath) {
    const pathSegments = progPath.split('/');

    for (let i = 0; i < pathSegments.length; i++) {
        if (pathSegments[i].includes('premerge_') || pathSegments[i].includes('merge_')) {
            if (i >= 3) {
                return pathSegments[i - 3];
            }
            break;
        }
    }
}


//bool GOPATHモードであるかを確認
function checkGoPathMode(progPath) {
    let currentPath = path.resolve(progPath);

    while (true) {
        // Read all files in the current directory
        let files = [];
        if (fs.statSync(currentPath).isDirectory()) {
            files = fs.readdirSync(currentPath);
        }

        // Check if go.mod file exists in the current directory
        if (files.some(file => file.toLowerCase() === 'go.mod')) {
            return false;
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

    return true;
}


function getPackagePath(protoPath) {
    const protoPathSegments = protoPath.split('/');
    const protoPathIndex = protoPathSegments.findIndex(segment => segment.includes('premerge_') || segment.includes('merge_'));
    const protoPathSubDir = protoPathSegments.slice(protoPathIndex + 1).slice(0, -1).join('/');
    const repositoryName = getrepositoryName(protoPath);
    const fullPath = path.join(repositoryName, protoPathSubDir);

    //変更
    return protoPathSubDir;
}


function checkModuleUsed(moduleName, importedModules) {

}



//proto optionからpackage名の取得
function getPackageNameOption(filePath, protoMeta, importedModules) {
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
            // Move up one directory before breaking
            const parentPath = path.dirname(currentPath);
            if (parentPath !== currentPath) {
                currentPath = parentPath;
            }
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


//Array dockerfileのリストを取得
function findDockerfiles(progPath) {
    const dockerfiles = [];
    let currentPath = path.resolve(progPath);

    while (true) {
        // Read all files in the current directory
        let files = [];
        if (fs.statSync(currentPath).isDirectory()) {
            files = fs.readdirSync(currentPath);
        }

        // Filter files to find Dockerfile or files containing "dockerfile"
        files.forEach((file) => {
            if (
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


function findGoGetAndProtocCommands(dockerfilePath) {
    try {
        // Dockerfileを読み込む 
        const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');

        // 各行を解析する 
        const lines = dockerfileContent.split('\n');

        // RUNまたはCMDコマンドで`go get`または`protoc`を含む行、またはENTRYPOINTコマンドでフォルダパスを指定している行をフィルタリング 
        const targetLines = lines.filter(line => {
            const parts = line.split(' ');
            return (line.startsWith('RUN') || line.startsWith('CMD') || line.startsWith('ENTRYPOINT')) &&
                (line.includes('go get') || (parts.length > 0 && parts[0].startsWith('protoc'))) ||
                (line.startsWith('ADD') && parts.length === 3) ||
                line.startsWith('ENTRYPOINT'); // ENTRYPOINTもチェック 
        });

        // ENTRYPOINT行を解析 
        const entrypointCommands = targetLines
            .filter(line => line.startsWith('ENTRYPOINT'))
            .map(line => {
                // ENTRYPOINTに続く部分を取得 
                const match = line.match(/^ENTRYPOINT\s+(.+)$/);
                return match ? match[1].trim() : null;
            })
            .filter(Boolean); // nullを除外

        console.log('Found ENTRYPOINT commands:', entrypointCommands);

        return targetLines;
    } catch (error) {
        console.error('Error reading the Dockerfile:', error);
        return [];
    }
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


//Array makefileからprotocコマンドの行を取得
function findProtocCommands(makefilePath) {
    try {
        // Makefileを読み込む
        const makefileContent = fs.readFileSync(makefilePath, 'utf8');

        // 各行を解析する
        const lines = makefileContent.split('\n');
        //FLAG
        const protocLines = lines.filter(line => line.includes('protoc') && line.includes('.proto'));

        return protocLines;
    } catch (error) {
        console.error('Error reading the Makefile:', error);
        return [];
    }
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






module.exports = { checkFileImportModule };

























/*Dockerfile, Makefile 他のファイルを参照する場合*****************************************************************/

if (goPathMode === false) {
    /*package名と他の情報を組み合わせる探索*/
    //package
    const packageName = protoMeta.package;

    //依存ファイル
    //go.mod
    const goModList = findGoModFiles(progPath);
    let moduleLines = [];

    goModList.forEach(goModPath => {
        const content = fs.readFileSync(goModPath, 'utf8');
        moduleLines = moduleLines.concat(content.split('\n').filter(line => line.startsWith('module')));
    });

    if (moduleLines.length != 0) {
        for (const line of moduleLines) {
            const moduleName = line.split(' ')[1].trim();
            const fullPath = moduleName + "/" + packageName;
            if (importedModules.some(module => module === fullPath)) {
                if (!protoToPrograms[protoPath]) {
                    protoToPrograms[protoPath] = [];
                }
                protoToPrograms[protoPath].push(progPath);
                break; // 一致した場合、ループを抜ける
            }
        }
    }



} else {


    //Makefile
    const makefileList = findMakefileFiles(progPath);
    if (makefileList.length != 0) {

        makefileList.forEach(makefilePath => {
            findProtocCommands(makefilePath).forEach(command => {
                //FLAG
                // protocコマンドの解析

                console.log(`Found protoc command: ${command}`);
            });

        });
    }

    //Dockerfile
    const dockerfileList = findDockerfiles(progPath);
    if (dockerfileList.length != 0) {
        dockerfileList.forEach(dockerfilePath => {
            findGoGetAndProtocCommands(dockerfilePath).forEach(command => {
                //FLAG
                // Dockerfileの解析

                console.log(`Found go get or protoc command: ${command}`);
            });

            //console.log(`Found Dockerfile: ${dockerfilePath}`);
        });
    }

    //逆引き

}

// var isOptionImported = protoMeta.options.some(
//     function (option) {
//         return importedModules.some(
//             function (module) {
//                 return module === option.value;
//             }
//         );
//     }
// );

// if (isPackageImported || isOptionImported) {
//     if (!protoToPrograms[protoPath]) {
//         protoToPrograms[protoPath] = [];
//     }
//     protoToPrograms[protoPath].push(progPath);
// }