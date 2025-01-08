/*
AST Broker


FLAG : 要確認，デバッグ必要箇所

実際のパスの生成

*/
/*import module*/
const fs = require('fs');
const path = require('path');

const { analyzeProtoService } = require('./analyzeAst/proto/proto');
const { analyzeGoAst } = require('./analyzeAst/Go/go');



/*config*/


/*__MAIN__*/
if (require.main === module) {

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
    ]);

    let programFileList = [
        "/app/dataset/premerge_project/go.mod",
        "/app/dataset/premerge_project/cmd/main.go",
        "/app/dataset/premerge_project/pkg/utils/math.go",
        "/app/dataset/premerge_project/pkg/utils/strings.go",
        "/app/dataset/premerge_project/pkg/services/calculator.go",
        "/app/dataset/premerge_project/pkg/services/greeter.go",
        "/app/dataset/premerge_project/pkg/services/logger.go",
        "/app/dataset/premerge_project/pkg/config/loader.go",
        "/app/dataset/premerge_project/tests/calculator_test.go",
        "/app/dataset/premerge_project/tests/greeter_test.go",
        "/app/dataset/premerge_project/tests/loader_test.go"
    ];



    let modifiedProtoList = [
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/proto/Emoji.proto",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/proto/Voting.proto"
    ];

    let modifiedProgList = [
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-emoji-svc/api/api.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-voting-svc/api/api.go"
    ];


    checkFileImportModule(protoPathMap, programFileList, modifiedProtoList, modifiedProgList);

}

/*functions*/
async function checkFileImportModule(protoPathMap, programFileList, modifiedProtoList, modifiedProgList) {
    const pre_dependencies = await pre_Analyzedependencies(protoPathMap, programFileList);


    console.log();
}


async function pre_Analyzedependencies(protoPathMap, programPaths) {
    const protoToPrograms = {};
    const programToPrograms = {};

    /*general*/
    let makefilePaths = [];
    let dockerfilePaths = [];

    /*Go*/
    let goPathMode;
    let goModList;
    let goPathSrc;



    /*
    プログラムからimportの取得 + どのprotoをimportしているか + どのプログラムをimportしているか]


    一回目のループがここに入る

    */
 


    /*programToProgramsの取得*/
    for (const progPath of programPaths) {
        const importedModules = await getImportedPrograms(progPath, "imports");
        if (importedModules === null) continue;

        const extension = await path.extname(progPath);

        switch (extension) {
            case '.go':

                /*

                共通項目取得
                
                */
                if (goPathMode === undefined) {
                    //初回ループ
                    goPathMode = checkGoPathMode(progPath);
                    //go.modがある場合
                    if (goPathMode === false) {
                        goModList = findGoModFiles(progPath);
                        goModModuleList = goModList.map(goModPath => {
                            const content = fs.readFileSync(goModPath, 'utf8');
                            const moduleLine = content.split('\n').find(line => line.startsWith('module'));
                            return moduleLine.split(' ')[1].trim();
                        });
                    }

                } else if (goPathMode === false) {
                    //go.modがある場合
                    goModList = findGoModFiles(progPath);
                    goModModuleList = goModList.map(goModPath => {
                        const content = fs.readFileSync(goModPath, 'utf8');
                        const moduleLine = content.split('\n').find(line => line.startsWith('module'));
                        return moduleLine.split(' ')[1].trim();
                    });

                } else {
                    //go.modがない場合 goPATHモードである場合
                    goPathSrc = progPath.split('/').slice(progPath.split('/').findIndex(segment => segment.includes('premerge_') || segment.includes('merge_'))).join('/');
                }
                /*

                ↑処理の削除

                */



                // プログラムがimportしている関数の取得
                const goProgFunctions = await analyzeGoAst(progPath, "functions");


                /*
                関数化すべき項目
                */
                for (const importingProgPath of programPaths) {
                    //同じプログラムの場合スキップ
                    if (importingProgPath === progPath) continue;

                    // プログラムからimportの取得
                    const importedProgModules = await getImportedPrograms(importingProgPath, "imports");
                    const ext = await path.extname(importingProgPath);

                    switch (ext) {
                        case '.go':

                            // プログラムがimportしている関数の取得
                            const goImportingProgFunctions = await analyzeGoAst(importingProgPath, "functions");
                            // プログラムのpackage pathの取得
                            const packagePath = getPackagePath(importingProgPath);






                            /*Go.modの参照********************************************************************/

                            /*
                            go.modが存在する場合
                            */
                            if (goPathMode === false) {
                                /*
                                Go Modulesを使用している場合、go.modファイル内のmoduleディレクティブで定義されたモジュール名がimportパスの基準になります。


                                プログラム内のimport文に記載されているモジュール名と、go.mod内のmodule名を比較
                                protoのpackage pathと一致するmoduleがあるかを確認
        
                                あいまい条件
                                厳格な一致ではない
                                */
                                importedModules.forEach((importedModule) => {
                                    goModModuleList.forEach((module) => {
                                        if (importedModule.includes(module) && importedModule.includes(packagePath)) {
                                            //関数利用の確認
                                            if (checkFunctionUsage(goImportingProgFunctions, goProgFunctions, programToPrograms, importingProgPath, progPath)) {
                                                return;
                                            }
                                           
                                        }
                                    });
                                });





                            } else {
                                /*
                                GOPATHモードの場合、importパスは $GOPATH/src 以下のディレクトリ構造に基づきます。
                                */



                                /*Dockerfile, Makefile 他のファイルを参照する場合*****************************************************************/

                                /*
                                Dockerfileの参照
                                */



                                /*
                                Makefileの参照
                                */


                            }



                            break;

                        default:
                            console.log(`Not Supported lang: ${importingProgPath}`);
                            break;
                    }
                }
                /*
                ↑ここまで関数化
                */

                break;

            default:
                console.log(`Not Supported lang: ${progPath}`);
                break;
        }
    }

    return { protoToPrograms, programToPrograms };
}


//プログラムファイルから import or 関数 を取得
async function getImportedPrograms(filePath, mode) {
    const extension = path.extname(filePath);
    let imports = [];

    switch (extension) {

        case '.go':
            try {
                imports = await analyzeGoAst(filePath, mode);
            } catch (err) {
                console.error("Error generating Go AST:", err);
                throw err;
            }

            break;

        default:
            break;
    }

    return imports;
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

//protoファイルの関数利用の確認を行う関数
function checkProtoFunctionUsage(protoServices, goProgFunctions, protoToPrograms, protoPath, progPath) {
    for (const service of protoServices) {
        // サービスのRPCをすべて確認
        for (const rpc of service.rpcs) {


            if (goProgFunctions.functions && goProgFunctions.functions.includes(rpc)) {
                //関数で解決
                if (!protoToPrograms[protoPath]) {
                    protoToPrograms[protoPath] = [];
                }
                protoToPrograms[protoPath].push(progPath);
                return true; // RPCが見つかった場合、早期リターン

            } else {
                //メソッドで解決
                for (const funcCalls of Object.values(goProgFunctions.functionCalls)) {
                    if (funcCalls?.some(funcCall => funcCall.includes(rpc))) {
                        if (!protoToPrograms[protoPath]) {
                            protoToPrograms[protoPath] = [];
                        }
                        protoToPrograms[protoPath].push(progPath);
                        return true; // RPCが見つかった場合、早期リターン 
                    }
                }
            }


        }
    }
    return false;
}

//パッケージパスの取得
function getPackagePath(filePath) {
    const filePathSegments = filePath.split('/');
    const filePathIndex = filePathSegments.findIndex(segment => segment.includes('premerge_') || segment.includes('merge_'));
    const filePathSubDir = filePathSegments.slice(filePathIndex + 1).slice(0, -1).join('/');
    const repositoryName = getrepositoryName(filePath);
    const fullPath = path.join(repositoryName, filePathSubDir);

    //変更
    return filePathSubDir;
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

//Makefile Dockerfileリストの取得
function findMakeAndDockerFiles(progPath) {
    const makefilePaths = [];
    const dockerfilePaths = [];

    // premerge_ または merge_ を含む部分を探す正規表現
    const regex = /(.*\/(premerge_|merge_)[^/]+)/;
    const match = progPath.match(regex);

    // repositoryPath を取得
    const repositoryPath = match ? match[1] : path.dirname(progPath);

    // ディレクトリを再帰的に探索する関数
    function traverseDirectory(directory) {
        const entries = fs.readdirSync(directory, { withFileTypes: true });

        for (const entry of entries) {
            const entryPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                // サブディレクトリを再帰的に探索
                traverseDirectory(entryPath);
            } else if (entry.isFile()) {
                // Makefile または Dockerfile のパスを保存
                if (entry.name === 'Makefile') {
                    makefilePaths.push(entryPath);
                } else if (entry.name === 'Dockerfile') {
                    dockerfilePaths.push(entryPath);
                }
            }
        }
    }

    // repositoryPath から探索を開始
    traverseDirectory(repositoryPath);

    return { makefilePaths, dockerfilePaths };
}

//dockerfileの解析
function getDockerfileCommands(dockerfilePath) {
    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
    const lines = dockerfileContent.split('\n');
    const commands = [];

    let currentCommand = '';
    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (
            (trimmedLine.startsWith('RUN') || trimmedLine.startsWith('CMD') || trimmedLine.startsWith('ADD') || trimmedLine.startsWith('ENTRYPOINT')) &&
            (trimmedLine.includes('protoc') || trimmedLine.includes('grpc') || trimmedLine.includes('protoc-gen-') ||
                trimmedLine.includes('go') || trimmedLine.includes('make') || trimmedLine.includes('cmake') ||
                trimmedLine.includes('bash') || trimmedLine.includes('sh'))
        ) {

            if (currentCommand) {
                commands.push(currentCommand);
                currentCommand = '';
            }
            currentCommand = trimmedLine;
        } else if (currentCommand) {
            currentCommand += ' ' + trimmedLine;
        }
    });
    if (currentCommand) {
        commands.push(currentCommand);
    }

    return commands;
}

//makefileの解析
function getMakefileCommands(makefilePath) {
    const makefileContent = fs.readFileSync(makefilePath, 'utf8');
    const lines = makefileContent.split('\n');
    const commands = [];

    let currentCommand = '';
    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('protoc')) {
            if (currentCommand) {
                commands.push(currentCommand);
                currentCommand = '';
            }
            currentCommand = trimmedLine;
        } else if (currentCommand) {
            currentCommand += ' ' + trimmedLine;
        }
    });
    if (currentCommand) {
        commands.push(currentCommand);
    }

    return commands;
}

//goファイルにおいて関数利用の確認を行う関数
function checkFunctionUsage(importedProgModules, importingProgFunctions, programToPrograms, importingProgPath, progPath) {
    // importedProgModulesの中の関数がimportingProgFunctionsで使われているかを調べる
 
    for (const funcCalls of Object.values(importingProgFunctions.functionCalls)) {
        if (funcCalls?.some(funcCall => funcCall.includes(importedProgModules.functions))) {
            if (!programToPrograms[progPath]) {
                programToPrograms[progPath] = [];
            }
            programToPrograms[progPath].push(importingProgPath);
            return true; // 関数が見つかった場合、早期リターン
        }
    }
        
    
    return false;
}


module.exports = { checkFileImportModule };
