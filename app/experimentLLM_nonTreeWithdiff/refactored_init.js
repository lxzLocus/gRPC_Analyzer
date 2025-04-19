const OpenAI = require('openai');
const fs = require('fs');
const Handlebars = require('handlebars');
const dotenv = require('dotenv');
const path = require('path');
const logInteraction = require("/app/app/experimentLLM_nonTreeWithdiff/module/logger.js");
const RestoreDiff = require('/app/app/experimentLLM_nonTreeWithdiff/module/restoreDiff.js');


//実行ファイルが置かれているパス
const appDirRoot = "/app/app/experimentLLM_nonTreeWithdiff";


dotenv.config();

class Config {
    constructor() {
        this.inputProjectDir = "/app/app/dataset/modified_proto_reps/daos/pullrequest/DAOS-14214_control-_Fix_potential_missed_call_to_drpc_failure_handlers/premerge_12944/";
        this.outputDir = path.join(appDirRoot, 'output');
        this.inputDir = path.join(appDirRoot, 'input');
        this.promptDir = path.join(appDirRoot, 'prompt');
        this.promptTextfile = '00_prompt.txt';
        this.promptRefineTextfile = '00_promptRefine.txt';
        this.tmpDiffRestorePath = path.join(this.outputDir + 'tmpDiffRestore.txt');
        this.maxTokens = 128000;

        // 一時ファイルを削除
        if (fs.existsSync(this.tmpDiffRestorePath)) fs.unlinkSync(this.tmpDiffRestorePath);
    }

    readPromptReplyFile(filesRequested, modifiedDiff, commentText) {
        const promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptReply.txt'), 'utf-8');

        const context = {
            filesToReview: filesRequested, // required section from previous message
            previousModifications: modifiedDiff, // diff from previous step
        };
        const template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    }

    readPromptModifiedFile(modifiedFiles) {
        const promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptModified.txt'), 'utf-8');

        const context = {
            modifiedFiles: modifiedFiles // diff that was just applied or restored
        };
        const template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    }
}

class MessageHandler {
    constructor() {
        this.messagesTemplate = [
            {
                role: 'system',
                content: "Fix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections."
            }
        ];
    }

    attachMessages(role, messages) {
        // 新しいテンプレートのみをセットし、過去のメッセージをリセット
        this.messagesTemplate = [
            {
                role: 'system',
                content: "Fix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections."
            },
            {
                role: role,
                content: messages
            }
        ];
        return this.messagesTemplate;
    }

    analyzeMessages(messages) {
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
                const match = trimmed.match(/"(.+?)"/);
                if (match) {
                    sections.requiredFilepaths.push(match[1]);
                } else if (!trimmed.startsWith('[') && !trimmed.startsWith(']')) {
                    sections.requiredFilepaths.push(trimmed);
                }[]
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
}

class FileManager {
    constructor(config) {
        this.config = config;
    }

    readFirstPromptFile() {
        const promptText = fs.readFileSync(path.join(this.config.promptDir, this.config.promptTextfile), 'utf-8');
        const protoFileContent = fs.readFileSync(path.join(this.config.promptDir, '01_proto.txt'), 'utf-8');
        const protoFileChanges = fs.readFileSync(path.join(this.config.promptDir, '02_protoFileChanges.txt'), 'utf-8');
        const fileChangesContent = fs.readFileSync(path.join(this.config.promptDir, '03_fileChanges.txt'), 'utf-8');
        const allFilePaths = fs.readFileSync(path.join(this.config.promptDir, '04_allFilePaths.txt'), 'utf-8');
        const suspectedFiles = fs.readFileSync(path.join(this.config.promptDir, '05_suspectedFiles.txt'), 'utf-8');

        const context = {
            protoFile: protoFileContent,
            protoFileChanges: protoFileChanges,
            fileChanges: fileChangesContent,
            allFilePaths: allFilePaths,
            suspectedFiles: suspectedFiles
        };
        const template = Handlebars.compile(promptText, { noEscape: true });
        return template(context);
    }
}

class OpenAIClient {
    constructor(apiKey) {
        this.client = new OpenAI({ apiKey });
    }

    async fetchOpenAPI(messages) {
        try {
            const completion = await this.client.chat.completions.create({
                model: 'gpt-4o',
                messages: messages
            });
            return completion;
        } catch (error) {
            console.error(error.message);
        }
    }
}



if (require.main === module) {
    main();
}



async function main() {
    const config = new Config();
    const fileManager = new FileManager(config);
    const messageHandler = new MessageHandler();
    const openAIClient = new OpenAIClient(process.env.OPENAI_TOKEN);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFilePath = path.join(`${config.outputDir}/log`, `${timestamp}_log.txt`);

    const initMessages = messageHandler.attachMessages("user", fileManager.readFirstPromptFile());

    try {
        await fetchAndProcessMessages(initMessages, logFilePath, openAIClient, messageHandler, config);

        // 一時ファイルを削除
        const diffFilePath = path.join(config.outputDir, 'tmp_restoredDiff.txt');
        if (fs.existsSync(diffFilePath)) fs.unlinkSync(diffFilePath);

        console.log('処理が完了しました');
    } catch (error) {
        console.error('処理中にエラーが発生しました:', error);
    }
}
/**
 * OpenAI APIを使用してメッセージを処理し、必要に応じて再帰的に処理を続行します。
 * また、`modified`タグのdiff結果を一時スペースに保存します。
 *
 * @param {Array<Object>} messages - OpenAI APIに送信するメッセージの配列。
 * @param {string} logFilePath - ログファイルのパス。
 * @param {OpenAIClient} openAIClient - OpenAI APIクライアントのインスタンス。
 * @param {MessageHandler} messageHandler - メッセージを解析および操作するためのハンドラー。
 * @param {Config} config - 設定情報を格納したオブジェクト。
 * @param {boolean} [continueFetching=true] - 処理を続行するかどうかを示すフラグ。
 * @returns {Promise<void>} - 非同期処理の完了を示すPromise。
 *
 * @throws {Error} - OpenAI APIリクエスト中のエラーやファイル操作エラーが発生した場合。
 *
 * @example
 * const messages = [
 *     { role: 'user', content: 'What is the weather today?' }
 * ];
 * const logFilePath = '/path/to/log.txt';
 * const openAIClient = new OpenAIClient('your-api-key');
 * const messageHandler = new MessageHandler();
 * const config = new Config();
 *
 * await fetchAndProcessMessages(messages, logFilePath, openAIClient, messageHandler, config);
 */
async function fetchAndProcessMessages(messages, logFilePath, openAIClient, messageHandler, config, continueFetching = true) {
    if (!continueFetching) return;

    try {
        const response = await openAIClient.fetchOpenAPI(messages);

        logInteraction(messages[1].content, response.choices[0].message.content, logFilePath);

        const splitContents = messageHandler.analyzeMessages(response.choices[0].message.content);
        const availableTokens = config.maxTokens - Number(response.usage.total_tokens);

        // `modified`タグのdiff結果を保存
        if (splitContents.modifiedDiff) {
            const restoreDiff = new RestoreDiff(config.inputProjectDir);
            const restoredContent = restoreDiff.applyDiff(splitContents.modifiedDiff);
            fs.writeFileSync(path.join(config.outputDir, 'tmp_restoredDiff.txt'), restoredContent, 'utf-8');
        }


        // reply required部分を使って再帰的に問い合わせ
        if (splitContents.requiredFilepaths.length > 0) {
            const requiredFileContents = [];

            for (const filePath of splitContents.requiredFilepaths) {
                const fullPath = path.join(config.inputProjectDir, filePath);

                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    requiredFileContents.push(`--- ${filePath}\n${content}`);
                } else {
                    console.warn(`ファイルが見つかりません: ${filePath}`);
                }
            }

            const promptReply = config.readPromptReplyFile(
                requiredFileContents.join('\n\n'),
                splitContents.modifiedDiff,
            );

            await fetchAndProcessMessages(
                messageHandler.attachMessages("user", promptReply),
                logFilePath,
                openAIClient,
                messageHandler,
                config,
                continueFetching
            );
        }

        // diff部分が存在すれば、それを適用し次の問い合わせ
        if (splitContents.modifiedDiff) {

            const tmpDiffRestorePath = path.join(config.outputDir, 'tmp_restoredDiff.txt');

            //すでにdiffを適用したファイルが存在するかどうか
            if (fs.existsSync(tmpDiffRestorePath)) {
                const restoredDiffContent = fs.readFileSync(tmpDiffRestorePath, 'utf-8');
                splitContents.modifiedDiff = restoredDiffContent;
            }else{
                const restoreDiff = new RestoreDiff(config.inputProjectDir);
                const restoredContent = restoreDiff.applyDiff(splitContents.modifiedDiff);
                fs.writeFileSync(tmpDiffRestorePath, restoredContent, 'utf-8');
            }

            const promptModified = config.readPromptModifiedFile(splitContents.modifiedDiff);

            await fetchAndProcessMessages(
                messageHandler.attachMessages("user", promptModified),
                logFilePath,
                openAIClient,
                messageHandler,
                config,
                continueFetching
            );
        }

        // 処理を終了する
        const isFinTag =
            response.choices[0].message.content.trim() === '%%_Fin_%%' ||
            response.choices[0].message.content.split('\n').pop().trim() === '%%_Fin_%%';
 
        if (isFinTag) {
            console.log('終了タグ(%%_Fin_%%)が返されたため処理を終了します。');
            return;
        }

    } catch (error) {
        console.error('Error in fetchAndProcessMessages:', error);
        throw error; // エラーを再スローして呼び出し元で処理できるようにする
    }
}

module.exports = {
    main,
};
