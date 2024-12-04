/*import module*/
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { exec } = require('child_process');
/*
/usr/local/bin/node ./app/analyze/module/#nightlyBuild/docker.js
Found go get or protoc command: RUN wget https://github.com/google/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-linux-x86_64.zip && \
docker.js:49
Found go get or protoc command: RUN go get github.com/golang/protobuf/protoc-gen-go
docker.js:49
Found Dockerfile: /app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fortune/Dockerfile
docker.js:52
Found go get or protoc command: RUN wget https://github.com/google/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-linux-x86_64.zip && \
docker.js:49
Found go get or protoc command: RUN go get github.com/golang/protobuf/protoc-gen-go
docker.js:49
Found Dockerfile: /app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fortune/Dockerfile.dc
docker.js:52
Found Dockerfile: /app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/Dockerfile.js.base

*


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

function main(progPath){
    //Dockerfile
    const dockerfileList = findDockerfiles(progPath);
    if (dockerfileList.length != 0) {
        dockerfileList.forEach(dockerfilePath => {
            findGoGetAndProtocCommands(dockerfilePath).forEach(command => {
                //FLAG
                // Dockerfileの解析

                console.log(`Found go get or protoc command: ${command}`);
            });

            console.log(`Found Dockerfile: ${dockerfilePath}`);
        });
    }

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
