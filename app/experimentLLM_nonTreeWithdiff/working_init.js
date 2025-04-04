/*
自動応答対応
*/

/*
modules
*/
const OpenAI = require('openai');
const fs = require('fs');
const Handlebars = require('handlebars');
const dotenv = require('dotenv');
const path = require('path');
const { exec } = require('child_process');

// Load environment variables from .env file
dotenv.config();

//* configs
// premergeまで指定
const inputProjectDir = "app/dataset/modified_proto_reps/daos/pullrequest/DAOS-14214_control-_Fix_potential_missed_call_to_drpc_failure_handlers/premerge_12944/";
const outputDir = '/app/app/experimentLLM_nonTreeWithdiff/output';

const promptDir = '/app/app/experimentLLM_nonTreeWithdiff/prompt';
const promptTextfile = '00_prompt.txt';

const client = new OpenAI({
    apiKey: process.env.OPENAI_TOKEN,
});

let messagesTemplate = [
    {
        role: 'system',
        content: "Fix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections."
    }
];


//* main
if (require.main === module) {
    const tmp = fs.readFileSync("/app/tmp/response_2025-04-01T19-05-55-064Z.txt");

    analyzeMessages(tmp.toString());
}



//* functions
function readPromptFile() {
    const promptText = fs.readFileSync(path.join(promptDir, promptTextfile), 'utf-8')
    const protoFileContent = fs.readFileSync(path.join(promptDir, '01_proto.txt'), 'utf-8');
    const protoFileChanges = fs.readFileSync(path.join(promptDir, '02_protoFileChanges.txt'), 'utf-8');
    const fileChangesContent = fs.readFileSync(path.join(promptDir, '03_fileChanges.txt'), 'utf-8');
    const allFilePaths = fs.readFileSync(path.join(promptDir, '04_allFilePaths.txt'), 'utf-8');
    const suspectedFiles = fs.readFileSync(path.join(promptDir, '05_suspectedFiles.txt'), 'utf-8');

    const context = {
        protoFileContent: protoFileContent,
        protoFileChanges: protoFileChanges,
        fileChangesContent: fileChangesContent,
        allFilePaths: allFilePaths,
        suspectedFiles: suspectedFiles
    };
    const template = Handlebars.compile(promptText);
    const prompt = template(context);

    return prompt;
}

function splitMessages(messages) {
    const promptTokens = messages.usage.prompt;
}

function analyzeMessages(messages) {
    const requiredFilepaths = [];

    if (messages.includes("%_Reply Required_%")) {
        const regex = /"([^"]+)"/g;
        let match;
        while ((match = regex.exec(messages)) !== null) {
            requiredFilepaths.push(match[1]);
        }
        return requiredFilepaths;

    } else if (!messages.includes("%_Reply Required_%") && messages.includes("%_Modified_%")){

    }
}



async function fetchOpenAPI(messages){
    try {
        const completion = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: messages
        });

        return completion;
    } catch (error) {
        console.error(error.message);
    }
}


function attachMessages(messages) {
    return messages.map(message => ({
        role: message.role,
        content: message.content
    }));
}







