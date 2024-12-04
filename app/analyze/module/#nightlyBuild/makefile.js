/*import module*/
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { exec } = require('child_process');


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

    let progPath = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fortune/main.go";
    main(progPath);
}

function main(progPath) {
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