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

const { analyzeProtoService } = require('./analyzeAst/proto/proto');
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
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-emoji-svc/api/api_test.go",
        "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-voting-svc/api/api_test.go",
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

    let repositoryName;

    /*Go*/
    let goPathMode;
    let goModList;


    // プログラムからimportの取得 + どのprotoをimportしているか + どのプログラムをimportしているか
    for (const progPath of programPaths) {
        // プログラムからimportの取得
        const importedModules = await getImportedPrograms(progPath, "functions");
        const extension = await path.extname(progPath);

        switch (extension) {
            case '.go':

                /*共通項目取得*/
                if (goPathMode === undefined) {
                    //初回ループ
                    goPathMode = checkGoPathMode(progPath);

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
                    













                    // 関数利用の確認
                    if (checkFunctionUsage(protoServices, goProgFunctions, protoToPrograms, protoPath, progPath)) {
                        break; // protoPathMapのループを抜ける
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

//protoファイルの関数利用の確認を行う関数
function checkFunctionUsage(protoServices, goProgFunctions, protoToPrograms, protoPath, progPath) {
    for (const service of protoServices) {
        // サービスのRPCをすべて確認
        for (const rpc of service.rpcs) {

            
            if (goProgFunctions.functions.includes(rpc)) {
                //関数で解決
                if (!protoToPrograms[protoPath]) {
                    protoToPrograms[protoPath] = [];
                }
                protoToPrograms[protoPath].push(progPath);
                return true; // RPCが見つかった場合、早期リターン

            }else {
                //メソッドで解決
                for (const funcCalls of Object.values(goProgFunctions.functionCalls)) {
                    if (funcCalls.some(funcCall => funcCall.includes(rpc))) {
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


module.exports = { checkFileImportModule };
