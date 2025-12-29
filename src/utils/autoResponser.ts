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
import { getJSTTimestamp, getJSTFileTimestamp } from './timeUtils.js';

/*
modules
*/
import Logger from "../modules/Logger.js";
import RestoreDiff from '../modules/RestoreDiff.js';
import LLMFlowController from '../modules/llmFlowController.js';

//実行ファイルが置かれているパス
const appDirRoot = "/app/src/";

dotenv.config();


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
        // 新しいメッセージをテンプレートに追加
        this.messagesTemplate.push({
            role: role,
            content: messages
        });
        return this.messagesTemplate;
    }


    analyzeMessages(messages: string): {
        thought: string | null,
        plan: string | null,
        requiredFilepaths: string[],
        modifiedDiff: string,
        commentText: string,
        has_fin_tag: boolean
    } {
        const sections = {
            thought: null as string | null,
            plan: null as string | null,
            requiredFilepaths: [] as string[],
            modifiedDiff: '',
            commentText: '',
            has_fin_tag: false
        };

        const lines = messages.split('\n');
        let currentTag: string | null = null;
        const buffers: { [key: string]: string[] } = {
            thought: [],
            plan: [],
            modified: [],
            comment: []
        };

        for (const line of lines) {
            const trimmed = line.trim();
            const tagMatch = trimmed.match(/^%_(.+?)_%$/);

            if (tagMatch) {
                currentTag = tagMatch[1].toLowerCase().replace(/ /g, '_'); // e.g., "Reply Required" -> "reply_required"
                if (currentTag === 'modified' || currentTag === 'comment' || currentTag === 'thought' || currentTag === 'plan') {
                    // バッファを使用するタグ
                } else {
                    currentTag = 'required' // 'Reply Required'
                }
                continue;
            } else if (trimmed === '%%_Fin_%%') {
                sections.has_fin_tag = true;
                break;
            }

            if (currentTag) {
                if (currentTag === 'required') {
                    const match = trimmed.match(/"(.+?)"/);
                    if (match) {
                        sections.requiredFilepaths.push(match[1]);
                    } else if (trimmed && !trimmed.startsWith('[') && !trimmed.startsWith(']')) {
                        sections.requiredFilepaths.push(trimmed);
                    }
                } else if (buffers[currentTag]) {
                    buffers[currentTag].push(line);
                }
            }
        }

        sections.thought = buffers.thought.join('\n').trim() || null;
        sections.plan = buffers.plan.join('\n').trim() || null;
        sections.modifiedDiff = buffers.modified.join('\n').trim();
        sections.commentText = buffers.comment.join('\n').trim();

        return sections;
    }


}

class Config {
    inputProjectDir: string;
    outputDir: string;
    inputDir: string;
    promptDir: string;
    promptVariableDir: string;
    promptTextfile: string;
    promptRefineTextfile: string;
    tmpDiffRestorePath: string;
    maxTokens: number;

    constructor(datasetDir: string) {
        //premergeまで指定
        this.inputProjectDir = datasetDir;
        this.outputDir = path.join(appDirRoot, 'output');
        this.inputDir = path.join(appDirRoot, 'input');
        this.promptDir = path.join(appDirRoot, 'prompts');
        // プロンプト変数ファイルは入力データセットディレクトリから読み込む
        this.promptVariableDir = datasetDir;
        this.promptTextfile = '00_prompt_gem.txt';
        this.promptRefineTextfile = '00_promptRefine.txt';
        this.tmpDiffRestorePath = path.join(this.outputDir + 'tmpDiffRestore.txt');
        this.maxTokens = 128000;

        // 一時ファイルを削除
        if (fs.existsSync(this.tmpDiffRestorePath)) fs.unlinkSync(this.tmpDiffRestorePath);
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

class FileManager {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    readFirstPromptFile(): string {
        // プロンプトテンプレートはpromptsディレクトリから読み込み
        const promptTemplatePath = path.join(this.config.promptDir, this.config.promptTextfile);
        if (!fs.existsSync(promptTemplatePath)) {
            throw new Error(`Prompt template file not found: ${promptTemplatePath}`);
        }
        const promptText = fs.readFileSync(promptTemplatePath, 'utf-8');
        
        // プロンプト変数ファイルは入力データセットディレクトリから読み込み
        const promptVariableFiles = [
            '01_proto.txt',
            '02_protoFileChanges.txt', 
            '03_fileChanges.txt',
            '04_surroundedFilePath.txt',
            '05_suspectedFiles.txt'
        ];
        
        // ファイルの存在確認
        for (const filename of promptVariableFiles) {
            const filePath = path.join(this.config.promptVariableDir, filename);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Prompt variable file not found: ${filePath}`);
            }
        }
        
        const protoFileContent = fs.readFileSync(path.join(this.config.promptVariableDir, '01_proto.txt'), 'utf-8');
        const protoFileChanges = fs.readFileSync(path.join(this.config.promptVariableDir, '02_protoFileChanges.txt'), 'utf-8');
        const fileChangesContent = fs.readFileSync(path.join(this.config.promptVariableDir, '03_fileChanges.txt'), 'utf-8');
        const allFilePaths = fs.readFileSync(path.join(this.config.promptVariableDir, '04_surroundedFilePath.txt'), 'utf-8');
        const suspectedFiles = fs.readFileSync(path.join(this.config.promptVariableDir, '05_suspectedFiles.txt'), 'utf-8');

        // プルリクエストタイトルを抽出
        const inputDir = this.config.inputProjectDir;
        const parts = inputDir.split(path.sep);
        const prName = parts[parts.length - 2] || 'unknown_pr';
        const pullRequestTitle = prName.replace(/_/g, ' '); // アンダーバーをスペースに置換

        const context = {
            pullRequestTitle: pullRequestTitle,
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
        // OpenAIクライアントを直接作成
        this.client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
    }

    async fetchOpenAPI(messages: Array<{ role: string, content: string }>): Promise<any> {
        try {
            // 注意: このユーティリティは環境変数を使用（独立したツール）
            const model = process.env.OPENAI_MODEL || 'gpt-4o';
            const completion = await this.client.chat.completions.create({
                model: model,
                messages: messages
            });
            return completion;
        } catch (error) {
            console.error((error as any).message);
            throw error;
        }
    }

    getProviderName(): string {
        return 'openai';
    }
}



async function main() {
    // --- 1. 初期設定 ---
    // コマンドライン引数またはデフォルトのデータセットディレクトリを使用
    const datasetDir = process.argv[2];
    
    console.log(`Using dataset directory: ${datasetDir}`);
    
    // データセットディレクトリの存在を確認
    if (!fs.existsSync(datasetDir)) {
        console.error(`Dataset directory does not exist: ${datasetDir}`);
        process.exit(1);
    }

    const config = new Config(datasetDir);
    const fileManager = new FileManager(config);
    const messageHandler = new MessageHandler();
    const openAIClient = new OpenAIClient(process.env.OPENAI_API_KEY || '');
    const logger = new Logger();

    const startTime = getJSTTimestamp();
    // experiment_idを "pravega/Issue_3758-..." の形式で取得
    const pathParts = config.inputProjectDir.split(path.sep);
    const experimentId = path.join(pathParts[pathParts.length - 2], pathParts[pathParts.length - 1]);

    const logFileTimestamp = getJSTFileTimestamp();
    const logFilePath = path.join(config.outputDir, 'log', `${logFileTimestamp}_log.json`);
    if (!fs.existsSync(path.dirname(logFilePath))) {
        fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    }

    // --- 2. 対話ループの準備 ---
    let conversation_active = true;
    const max_turns = 15;
    let turn_count = 0;
    let status = "Max turns reached"; // デフォルトの終了ステータス

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    let next_prompt_content: string | null = fileManager.readFirstPromptFile();
    let prompt_template_name: string = config.promptTextfile;
    let currentMessages = messageHandler.attachMessages("user", next_prompt_content);

    // --- 3. 対話ループ開始 ---
    while (conversation_active && turn_count < max_turns) {
        turn_count += 1;
        console.log(`--- Turn ${turn_count} ---`);

    const turnTimestamp = getJSTTimestamp();
        const llm_request_log = {
            prompt_template: prompt_template_name,
            full_prompt_content: next_prompt_content!,
            llm_metadata: {
                provider: openAIClient.getProviderName(),
                request_timestamp: turnTimestamp
            }
        };

        // 3-1. LLMへリクエスト送信
        const llm_response = await openAIClient.fetchOpenAPI(currentMessages);
        if (!llm_response || !llm_response.choices || llm_response.choices.length === 0) {
            console.error("Invalid response from LLM. Aborting.");
            status = "Error: Invalid LLM response";
            break;
        }
        const llm_content = llm_response.choices[0].message.content;
    const responseTimestamp = getJSTTimestamp();
        const usage = {
            prompt_tokens: llm_response.usage?.prompt_tokens || 0,
            completion_tokens: llm_response.usage?.completion_tokens || 0,
            total: llm_response.usage?.total_tokens || 0,
        };
        totalPromptTokens += usage.prompt_tokens;
        totalCompletionTokens += usage.completion_tokens;

        // 3-2. LLM応答を解析
        const parsed_response = messageHandler.analyzeMessages(llm_content);
        const llm_response_log = {
            raw_content: llm_content,
            parsed_content: {
                thought: parsed_response.thought,
                plan: parsed_response.plan ? [{ step: 1, description: parsed_response.plan }] : null,
                reply_required: parsed_response.requiredFilepaths.map(path => ({ type: "FILE_CONTENT", path })),
                modified_diff: parsed_response.modifiedDiff || null,
                commentText: parsed_response.commentText || null,
                has_fin_tag: parsed_response.has_fin_tag
            },
            usage: usage,
            llm_metadata: {
                provider: openAIClient.getProviderName(),
                model: llm_response.model || 'unknown',
                response_timestamp: responseTimestamp,
                request_timestamp: turnTimestamp
            }
        };

        // 3-3. システムアクションを決定し、次のプロンプトを準備
        let system_action_log = { type: "UNKNOWN", details: "No specific action was determined." };
        next_prompt_content = null; // 次のプロンプトを初期化

        if (parsed_response.has_fin_tag) {
            console.log("Found '%%_Fin_%%' tag. Finalizing process.");
            system_action_log = { type: "TERMINATING", details: "%%_Fin_%% tag detected." };
            status = "Completed (%%_Fin_%%)";
            conversation_active = false;

        } else if (parsed_response.requiredFilepaths.length > 0) {
            console.log("Found '%_Reply Required_%' tag. Preparing additional information.");
            const requiredFileContents: string[] = [];
            for (const filePath of parsed_response.requiredFilepaths) {
                const fullPath = path.join(config.inputProjectDir, filePath);
                if (fs.existsSync(fullPath)) {
                    requiredFileContents.push(`--- ${filePath}\n${fs.readFileSync(fullPath, 'utf-8')}`);
                } else {
                    console.warn(`File not found: ${filePath}`);
                    requiredFileContents.push(`--- ${filePath}\nFile not found.`);
                }
            }
            prompt_template_name = '00_promptReply.txt';
            next_prompt_content = config.readPromptReplyFile(requiredFileContents.join('\n\n'), parsed_response.modifiedDiff, parsed_response.commentText);
            system_action_log = { type: "FETCHING_FILES", details: `Replying with content of: ${parsed_response.requiredFilepaths.join(', ')}` };

        } else if (parsed_response.modifiedDiff) {
            console.log("Found '%_Modified_%' tag. Applying and verifying diff.");
            const restoreDiff = new RestoreDiff(config.inputProjectDir);
            try {
                const restoredContent = restoreDiff.applyDiff(parsed_response.modifiedDiff);
                fs.writeFileSync(config.tmpDiffRestorePath, restoredContent, 'utf-8');
                prompt_template_name = '00_promptModified.txt';
                next_prompt_content = config.readPromptModifiedFile(restoredContent);
                system_action_log = { type: "APPLYING_DIFF_AND_RECHECKING", details: "Diff applied successfully. Preparing for re-check." };
            } catch (error: any) {
                console.error(`Failed to apply diff: ${error.message}`);
                // エラー時の処理 (例: エラーをフィードバックするプロンプトを作成)
                // next_prompt_content = createErrorPrompt(error.message);
                system_action_log = { type: "APPLYING_DIFF_FAILED", details: error.message };
                status = `Error: Diff application failed on turn ${turn_count}`;
                conversation_active = false;
            }

        } else {
            console.log("No clear next action detected. Terminating process.");
            system_action_log = { type: "TERMINATING", details: "No actionable tags detected in LLM response." };
            status = "Completed (No Action)";
            conversation_active = false;
        }

        // 3-4. このターンのログを追加
        logger.addInteractionLog(turn_count, turnTimestamp, llm_request_log, llm_response_log, system_action_log);

        // 3-5. 次のターンのメッセージを準備
        if (conversation_active && next_prompt_content) {
            currentMessages = messageHandler.attachMessages("user", next_prompt_content);
        } else {
            conversation_active = false; // 次のプロンプトがない場合も終了
        }
    }

    // --- 4. 最終処理 ---
    const endTime = getJSTTimestamp();

    logger.setExperimentMetadata(
        experimentId,
        startTime,
        endTime,
        status,
        turn_count,
        totalPromptTokens,
        totalCompletionTokens,
        'openai', // llmProvider
        'gpt-4o-mini' // llmModel
    );

    const finalLog = logger.getFinalJSON();
    if (finalLog) {
        fs.writeFileSync(logFilePath, JSON.stringify(finalLog, null, 2), 'utf-8');
        console.log(`Log saved to ${logFilePath}`);
    }

    if (fs.existsSync(config.tmpDiffRestorePath)) {
        fs.unlinkSync(config.tmpDiffRestorePath);
    }

    console.log("All processes have been completed.");
}

// このファイルが直接実行された場合のみmain()を呼び出す
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Error in main:', error);
        process.exit(1);
    });
}

// LLMFlowController等から利用できるようクラスをエクスポート
export { Config, FileManager, MessageHandler, OpenAIClient, main };
