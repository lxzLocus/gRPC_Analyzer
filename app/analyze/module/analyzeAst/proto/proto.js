/*import module*/
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/*__MAIN__*/
if (require.main === module) {
    let sourcefilePath = "/app/dataset/modified_proto_reps/WAII/pullrequest/gRPC_update_with_token_handle_support/premerge_81/protobuf/VISSv2messages.proto";

    analyzeProtoService(sourcefilePath).then(result => console.log(result));
}

async function analyzeProtoService(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');

        const servicePattern = /service\s+(\w+)\s*{([^}]*)}/g;
        const rpcPattern = /rpc\s+(\w+)\s*\([\w]+\s*\)\s+returns\s+\(stream\s+[\w]+\s*\);|rpc\s+(\w+)\s*\([\w]+\s*\)\s+returns\s+\([\w]+\s*\);/g;
        const messagePattern = /message\s+(\w+)\s*{([^}]*)}/g;
        const enumPattern = /enum\s+(\w+)\s*{([^}]*)}/g;

        const services = [];
        const messages = [];
        const enums = [];
        let serviceMatch, messageMatch, enumMatch;

        // Loop through each service found in the proto file
        while ((serviceMatch = servicePattern.exec(fileContent)) !== null) {
            const serviceName = serviceMatch[1];
            const serviceBody = serviceMatch[2];
            const rpcs = [];
            let rpcMatch;

            // Loop through each RPC method in the current service
            while ((rpcMatch = rpcPattern.exec(serviceBody)) !== null) {
                const rpcName = rpcMatch[1] || rpcMatch[2];
                rpcs.push(rpcName);
            }

            services.push({ serviceName, rpcs });
        }

        // Loop through each message found in the proto file
        while ((messageMatch = messagePattern.exec(fileContent)) !== null) {
            const messageName = messageMatch[1];
            const messageBody = messageMatch[2];
            messages.push({ messageName, messageBody });
        }

        // Loop through each enum found in the proto file
        while ((enumMatch = enumPattern.exec(fileContent)) !== null) {
            const enumName = enumMatch[1];
            const enumBody = enumMatch[2];
            enums.push({ enumName, enumBody });
        }

        return { services, messages, enums };
    } catch (error) {
        console.error("Error reading the file:", error);
        return { services: [], messages: [], enums: [] };
    }
}


module.exports = { analyzeProtoService };