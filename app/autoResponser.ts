/*
Docs

LLMに自律的に思考させるソースコード
自動レスポンスに対応
*/

import OpenAI from 'openai';
import fs from 'fs';
import Handlebars from 'handlebars';
import dotenv from 'dotenv';
import path from 'path';

/*
modules
*/
import logInteraction from "/app/app/module/logger.js";
import RestoreDiff from '/app/app/module/restoreDiff.js';

//実行ファイルが置かれているパス
const appDirRoot = "/app/app/";

dotenv.config();

class Config {
    inputProjectDir: string;
    outputDir: string;
    inputDir: string;
    promptDir: string;
    promptTextfile: string;
    promptRefineTextfile: string;
    tmpDiffRestorePath: string;
    maxTokens: number;

    constructor() {
        //premergeまで指定
        this.inputProjectDir = "/app/dataset/confirmed/pravega/Issue_3758-_Fix_typo_in_controller_API_call_name/premerge_3759";
        this.outputDir = path.join(appDirRoot, 'output');
        this.inputDir = path.join(appDirRoot, 'input');
        this.promptDir = path.join(appDirRoot, 'prompt');
        this.promptTextfile = '00_prompt.txt';
        this.promptRefineTextfile = '00_promptRefine.txt';
        this.tmpDiffRestorePath = path.join(this.outputDir + 'tmpDiffRestore.txt');
        this.maxTokens = 128000;

        // 一時ファイルを削除
        if (fs.existsSync(this.tmpDiffRestorePath)) fs.unlinkSync(this.tmpDiffRestorePath);
    analyzeMessages(messages: string): { requiredFilepaths: string[], modifiedDiff: string, commentText: string, has_fin_tag: boolean } {
        const sections = {
            requiredFilepaths: [] as string[],
            modifiedDiff: '',
            commentText: '',
            has_fin_tag: false
        };

        const lines = messages.split('\n');
        let currentTag: string | null = null;
        let modifiedBuffer: string[] = [];
        let commentBuffer: string[] = [];

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
            } else if (trimmed === '%%_Fin_%%') {
                sections.has_fin_tag = true;
                break;
            }

            if (currentTag === 'required' && trimmed !== '') {
                const match = trimmed.match(/"(.+?)"/);
                if (match) {
                    sections.requiredFilepaths.push(match[1]);
                } else if (!trimmed.startsWith('[') && !trimmed.startsWith(']')) {
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
}

    readPromptReplyFile(filesRequested: string, modifiedDiff: string, commentText: string): string {
        const promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptReply.txt'), 'utf-8');

        const context = {
            filesToReview: filesRequested, // required section from previous message
            previousModifications: modifiedDiff, // diff from previous step
        };
        const template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    }

    readPromptModifiedFile(modifiedFiles: string): string {
        const promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptModified.txt'), 'utf-8');

        const context = {
            modifiedFiles: modifiedFiles // diff that was just applied or restored
        };
        const template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    }
}

class MessageHandler {
    messagesTemplate: Array<{ role: string, content: string }>;

    constructor() {
        this.messagesTemplate = [
            {
                role: 'system',
                content: "Fix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections."
            }
    ];
    }

    attachMessages(role: string, messages: string): Array<{ role: string, content: string }> {
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

}

class FileManager {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    readFirstPromptFile(): string {
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
    client: any;

    constructor(apiKey: string) {
        this.client = new OpenAI({ apiKey });
    }

    async fetchOpenAPI(messages: Array<{ role: string, content: string }>): Promise<any> {
        try {
            const completion = await this.client.chat.completions.create({
                model: 'gpt-4o',
                messages: messages
            });
            return completion;
        } catch (error) {
            console.error((error as any).message);
        }
    }
}


async function main() {
    const config = new Config();
    const fileManager = new FileManager(config);
    const messageHandler = new MessageHandler();
    const openAIClient = new OpenAIClient(process.env.OPENAI_TOKEN || '');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFilePath = path.join(`${config.outputDir}/log`, `${timestamp}_log.txt`);

    // LLM 分析・思考・計画
    const initPrompt = fileManager.readFirstPromptFile();
    let initMessages = messageHandler.attachMessages("user", initPrompt);

    // 対話ループの開始
    let conversation_active = true
    const max_turns = 10 // 無限ループを防ぐためのカウンター
    let turn_count = 0

    while (conversation_active && turn_count < max_turns) {
        turn_count += 1;
        console.log(`--- Turn ${turn_count} ---`);

        // 4. LLMへリクエスト送信
        const llm_response = await openAIClient.fetchOpenAPI(initMessages);
        const llm_content = llm_response.choices[0].message.content;

        // 5. 対話のログを記録
        logInteraction(initMessages, llm_content, logFilePath);

        // 6. LLMの応答を解析
        // MessageHandler.analyzeMessages() に相当
        // ここで `%_Thought_%`, `%_Plan_%` なども解析してログに残すと良い
        const parsed_response = messageHandler.analyzeMessages(llm_content);
        // -> parsed_response = { has_fin_tag: bool, required_info: [], modified_diff: string, ... }
        
        // ==================================================
        // ここからがフロー図の分岐ロジック
        // ==================================================
        let next_prompt_content = null;

        // 分岐①: 終了タグ (%%_Fin_%%) があるか？
        if (parsed_response.has_fin_tag) {
            console.log("終了タグを検出。処理を完了します。");
            conversation_active = false
            // ループを抜ける

        // 分岐②: 追加情報要求タグ (%_Reply Required_%) があるか？ (フロー図: J)
        else if (parsed_response.requiredFilepaths.length > 0) {
            console.log("情報要求タグを検出。追加情報を準備します。");
            
            // 要求されたファイルの内容を取得
            // (`fetchAndProcessMessages`内のファイル読み込みロジックに相当)
            // requested_data_content = getRequestedFileContents(parsed_response.required_info, config.inputProjectDir)
            
            // 次のプロンプトを準備 (Template 2: 追加情報提供プロンプト)
            // next_prompt_content = prepareAdditionalInfoPrompt(
            //     template_path = "01_prompt_reply.txt", 
            //     requested_data = requested_data_content,
            //     previous_thought = parsed_response.thought, // 思考や計画も渡すと文脈が保たれる
            //     previous_plan = parsed_response.plan
            // )

        // 分岐③: 修正提案タグ (%_Modified_%) があるか？ (フロー図: O or Q)
        else if (parsed_response.modifiedDiff) {
            console.log("修正提案タグを検出。修正を適用・検証します。");

            // 修正diffを仮想的に適用
            // (`RestoreDiff`クラスの処理に相当)
            try {
                // applyDiffResult = applyDiff(parsed_response.modified_diff, config.inputProjectDir)
                
                // 成功した場合 (フロー図: O)
                console.log("修正の適用に成功しました。");
                
                // 次のプロンプトを準備 (Template 3: 修正後再チェックプロンプト)
                // next_prompt_content = preparePostModificationPrompt(
                //     template_path = "02_prompt_modified.txt",
                //     applied_diff = parsed_response.modified_diff,
                //     content_after_modification = applyDiffResult.content
                // )
            } catch (error: any) {
                // 失敗した場合 (フロー図: Q)
                console.log(`修正の適用に失敗しました: ${error.message}`);
            }

                // 次のプロンプトを準備 (Template 4: エラーフィードバックプロンプト)
                // next_prompt_content = prepareErrorFeedbackPrompt(
                //     template_path = "03_prompt_error.txt",
                //     failed_diff = parsed_response.modified_diff,
                //     error_message = error.message
                // )

        // 分岐④: どのタグにも当てはまらない、または処理を続行できない場合
        } else {
            console.log("明確な次のアクションが検出されませんでした。処理を終了します。");
            conversation_active = false

        // 次のターンのメッセージを準備
        if (conversation_active && next_prompt_content !== null) {
            initMessages = messageHandler.attachMessages("user", next_prompt_content);
        }
}
    }

    // 4. ループ終了後の後処理
    // cleanupTemporaryFiles(config.outputDir);
    console.log("すべての処理が完了しました。");



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
async function fetchAndProcessMessages(
    messages: Array<{ role: string, content: string }>,
    logFilePath: string,
    openAIClient: OpenAIClient,
    messageHandler: MessageHandler,
    config: Config,
    continueFetching: boolean = true
): Promise<void> {
    if (!continueFetching) return;

    try {
        const response = await openAIClient.fetchOpenAPI(messages);

        logInteraction(messages[1].content, response.choices[0].message.content, logFilePath);

        const splitContents = messageHandler.analyzeMessages(response.choices[0].message.content);
        const availableTokens = config.maxTokens - (response.usage?.total_tokens || 0);

        // `modified`タグのdiff結果を保存
        if (splitContents.modifiedDiff) {
            const restoreDiff = new RestoreDiff(config.inputProjectDir);
            const restoredContent = restoreDiff.applyDiff(splitContents.modifiedDiff);
            fs.writeFileSync(path.join(config.outputDir, 'tmp_restoredDiff.txt'), restoredContent, 'utf-8');
        }

        // reply required部分を使って再帰的に問い合わせ
        if (splitContents.requiredFilepaths.length > 0) {
            const requiredFileContents: string[] = [];

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
splitContents.commentText
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
            } else {
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

    } catch (error: any) {
        console.error('Error in fetchAndProcessMessages:', error);
        throw error; // エラーを再スローして呼び出し元で処理できるようにする
    }
}


main();
