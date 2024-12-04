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

    const goModList = findGoModFiles(progPath);
    if (goModList.length != 0) {

        goModList.forEach(goModPath => {
            const content = fs.readFileSync(goModPath, 'utf8');
            const moduleMatch = content.match(/^module\s+([\w.\/-]+)\s*$/m);
            if (moduleMatch) {

                //FLAG
                //一致する場合の探索を付け加える
                const modulePath = moduleMatch[1];
                console.log(`Found module path: ${modulePath}`);
            }
        });

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