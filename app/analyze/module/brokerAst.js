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
    
                for (const [protoPath, protoMeta] of protoPathMap) {
                    
                    const protoServices = analyzeProtoService(protoPath);
 
                    protoServices.forEach(service => {
                        if (importedModules.includes(service)) {
                            if (!protoToPrograms[protoPath]) {
                                protoToPrograms[protoPath] = [];
                            }
                            protoToPrograms[protoPath].push(progPath);
                        }
                    });




                    
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


// プログラムファイルからimportしている他のプログラムファイルを特定
async function getImportedPrograms(filePath) {
    const extension = path.extname(filePath);
    let imports = [];

    switch (extension) {
        case '.go':
            try {
                imports = await analyzeGoAst(filePath, "functions"); // Promise が解決されるまで待機
               
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


module.exports = { checkFileImportModule };
