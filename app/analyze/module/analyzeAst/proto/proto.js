/*import module*/
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/*__MAIN__*/
if (require.main === module) {
    let sourcefilePath = "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/proto/Emoji.proto";

    console.log(analyzeProtoService(sourcefilePath));
}

async function analyzeProtoService(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');

        const servicePattern = /service\s+\w+\s*{([^}]*)}/g;
        const rpcPattern = /rpc\s+(\w+)\s*\([\w]+\s*\)\s+returns\s+\([\w]+\s*\);/g;

        const rpcs = [];
        let serviceMatch;

        // Loop through each service found in the proto file
        while ((serviceMatch = servicePattern.exec(fileContent)) !== null) {
            const serviceBody = serviceMatch[1];
            let rpcMatch;

            // Loop through each RPC method in the current service
            while ((rpcMatch = rpcPattern.exec(serviceBody)) !== null) {
                const rpcName = rpcMatch[1];
                rpcs.push(rpcName);
            }
        }

        return rpcs;
    } catch (error) {
        console.error("Error reading the file:", error);
        return [];
    }
}


module.exports = { analyzeProtoService };