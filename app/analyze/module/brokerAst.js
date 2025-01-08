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
    // let mergeStateFilePath = process.argv.slice(2)[0];
    let dockerfilePath = [
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/.circleci/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/doggos/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/emoji/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fortune/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/hypothesizer/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/secrets/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/sidecar/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/sleeper/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/snack/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/spoonerisms/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/vigoda/Dockerfile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/words/Dockerfile",
    ];

    let makefilePath = [
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/Makefile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/Makefile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/Makefile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/Makefile",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fortune/Makefile",
    ];


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
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-emoji-svc/api/api.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-voting-svc/api/api.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-emoji-svc/api/api_test.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-voting-svc/api/api_test.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-emoji-svc/cmd/server.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-voting-svc/cmd/server.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-web/web/web.go"
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



    // for (const dockerfile of dockerfilePath) {
    //     const commands = getDockerfileCommands(dockerfile);
    //     console.log(commands);
    // }

}

/*functions*/
async function checkFileImportModule(protoPathMap, programFileList, modifiedProtoList, modifiedProgList){
    const pre_dependencies = await pre_Analyzedependencies(protoPathMap, programFileList);


    console.log();

    const dependencies = await analyzeDependencies(protoPathMap, programFileList);
    const affectedPrograms = findAffectedPrograms(modifiedProtoList, dependencies);
    console.log("Affected programs:", Array.from(affectedPrograms));
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
    プログラムからimportの取得 + どのprotoをimportしているか + どのプログラムをimportしているか
    */
    for (const progPath of programPaths) {
        // プログラムからimportの取得
        const importedModules = await getImportedPrograms(progPath, "imports");
        if (importedModules === null) continue;

        const extension = await path.extname(progPath);

        /*共通項目取得*/
        if (makefilePaths.length === 0 || dockerfilePaths.length === 0) {
            const { makefilePaths: makefiles, dockerfilePaths: dockers } = findMakeAndDockerFiles(progPath);
            makefilePaths = makefiles;
            dockerfilePaths = dockers;
        }


        switch (extension) {
            case '.go':

                /*共通項目取得*/
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

                }else if (goPathMode === false) {
                    //go.modがある場合
                    goModList = findGoModFiles(progPath);
                    goModModuleList = goModList.map(goModPath => {
                        const content = fs.readFileSync(goModPath, 'utf8');
                        const moduleLine = content.split('\n').find(line => line.startsWith('module'));
                        return moduleLine.split(' ')[1].trim();
                    });
                    
                }else {
                    //go.modがない場合 goPATHモードである場合
                    goPathSrc = progPath.split('/').slice(progPath.split('/').findIndex(segment => segment.includes('premerge_') || segment.includes('merge_'))).join('/');
                }

                // プログラムがimportしている関数の取得
               const goProgFunctions = await analyzeGoAst(progPath, "functions");


                for (const [protoPath, protoMeta] of protoPathMap) {
                    
                    // protoのサービスを取得
                    const { services: protoServices, messages: protoMessages, enums: protoEnums } = await analyzeProtoService(protoPath);
                    // protoのpackage pathを取得
                    const packagePath = getPackagePath(protoPath);
                    

                    /*
                    protoファイルのoptionからpackage名を取得
                    package名がimportされているかを確認
                    */
                    if (protoMeta.options.length != 0) {
                        //言語ごとのpackage取得
                        const optionPackagePath = getPackageNameOption(progPath, protoMeta, importedModules);
                        //属する言語がない場合 or option定義されていない場合
                        if (optionPackagePath.isOptionImported === true) {
                            // 関数利用の確認
                            if (checkProtoFunctionUsage(protoServices, goProgFunctions, protoToPrograms, protoPath, progPath)) {
                                break; // protoPathMapのループを抜ける
                            }                            
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
                        // 関数利用の確認
                        if (checkProtoFunctionUsage(protoServices, goProgFunctions, protoToPrograms, protoPath, progPath)) {
                            break; // protoPathMapのループを抜ける
                        }        
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
                                        //関数利用の確認
                                        if (checkProtoFunctionUsage(protoServices, goProgFunctions, protoToPrograms, protoPath, progPath)) {
                                            return;
                                        }
                                    }
                                }
                            });
                        });



                    }else {
                        /*Dockerfile, Makefile 他のファイルを参照する場合*****************************************************************/

                        /*
                        Dockerfileの参照
                        */
                        dockerfilePaths.forEach((dockerfilePath) => {
                             
                                    
                            if(importedModules){

                            }
                        });


                        /*
                        Makefileの参照
                        */
                        makefilePaths.forEach((makefilePath) => {

                        });

                    }
                    //関数利用の確認
                    // if (checkProtoFunctionUsage(protoServices, goProgFunctions, protoToPrograms, protoPath, progPath)) {
                    //     break; // protoPathMapのループを抜ける
                    // }
                }

                break;

            default:
                console.log(`Not Supported lang: ${progPath}`);
              break;
        }
    }


    /*programToProgramsの取得*/
    for (const progPath of programPaths) {
        const importedModules = await getImportedPrograms(progPath, "imports");
        if (importedModules === null) continue;

        const extension = await path.extname(progPath);

        switch (extension) {
            case '.go':

                /*共通項目取得*/
                //おそらく取得済みである

                // プログラムがimportしている関数の取得
                const goProgFunctions = await analyzeGoAst(progPath, "functions");


                /*
                関数化すべき項目
                */
                for (const importingProgPath of programPaths) {
                    //同じプログラムの場合スキップ
                    if(importingProgPath === progPath) continue;

                    // プログラムからimportの取得
                    const importedProgModules = await getImportedPrograms(importingProgPath, "imports");
                    const ext = await path.extname(importedProgModules);

                    switch (ext) {
                        case '.go':

                            // プログラムがimportしている関数の取得
                            const goImportingProgFunctions = await analyzeGoAst(importingProgPath, "functions");





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
                imports = null;
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

            }else {
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
function getPackagePath(protoPath) {
    const protoPathSegments = protoPath.split('/');
    const protoPathIndex = protoPathSegments.findIndex(segment => segment.includes('premerge_') || segment.includes('merge_'));
    const protoPathSubDir = protoPathSegments.slice(protoPathIndex + 1).slice(0, -1).join('/');
    const repositoryName = getrepositoryName(protoPath);
    const fullPath = path.join(repositoryName, protoPathSubDir);

    //変更
    return protoPathSubDir;
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

module.exports = { checkFileImportModule };
