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

const maxTokens = 128000;
const maxCharacters = 1048576;

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
    //timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tmpOutputPath = path.join(outputDir, `response_${timestamp}.txt`);

    //初期メッセージ作成
    const initMessages = attachMessages("user", readPromptFile());

    fetchOpenAPI(initMessages)
        .then((response) => {
            let responseMessages = response.choices[0].message.content;
            let splitContents = analyzeMessages(responseMessages);

            let availableTokens = maxTokens - Number(response.usage.total_tokens);
            if (splitContents.requiredFilepaths.length != 0 && (maxTokens *0.08 < availableTokens) ){

                splitContents.requiredFilepaths.forEach((filePath) => {
                    const filePathWithInputDir = path.join(inputProjectDir, filePath);

                    if (fs.existsSync(filePathWithInputDir)) {
                        let fileContent = fs.readFileSync(filePathWithInputDir, 'utf-8');
                        fileContent = `--- ${filePath}\n` + fileContent;

                        messagesTemplate = attachMessages("user", fileContent);
                        fetchOpenAPI(messagesTemplate)
                            .then((response) => {
                                responseMessages = response.choices[0].message.content;
                                fs.writeFileSync(tmpOutputPath, responseMessages);
                                console.log('修正されたコードがtxtに保存されました');
                            })
                            .catch((error) => {
                                console.error('OpenAIリクエスト中のエラー:', error);
                            });
                    } else {
                        console.log(`ファイルが見つかりません: ${filePath}`);
                    }
                });
            }

            fs.writeFileSync(path.join(outputDir, 'response.txt'), response.choices[0].message.content);
            console.log('修正されたコードがtxtに保存されました');
        
        })
        .catch((error) => {
            console.error('OpenAIリクエスト中のエラー:', error);
        });
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
    const sections = {
        requiredFilepaths: [],
        modifiedDiff: '',
        commentText: ''
    };

    const lines = messages.split('\n');
    let currentTag = null;
    let modifiedBuffer = [];
    let commentBuffer = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === '%_Reply Required_%') {
            currentTag = 'required';
            continue;
        } else if (trimmed === '%_Modified_%') {
            currentTag = 'modified';
            continue;
        } else if (trimmed === '%_Comment_%') {
            currentTag = 'comment';
            continue;
        }

        if (currentTag === 'required' && trimmed !== '') {
            // JSON風の配列形式に対応
            const match = trimmed.match(/"(.+?)"/);
            if (match) {
                sections.requiredFilepaths.push(match[1]);
            } else if (!trimmed.startsWith('[') && !trimmed.startsWith(']')) {
                // 通常の行形式にも対応
                sections.requiredFilepaths.push(trimmed);
            }
        } else if (currentTag === 'modified') {
            modifiedBuffer.push(line);
        } else if (currentTag === 'comment') {
            commentBuffer.push(line);
        }
    }

    sections.modifiedDiff = modifiedBuffer.join('\n').trim();
    sections.commentText = commentBuffer.join('\n').trim();

    return sections;
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

function attachMessages(role, messages) {
    messagesTemplate.push({
        role: role,
        content: messages
    });

    return messagesTemplate;
}







