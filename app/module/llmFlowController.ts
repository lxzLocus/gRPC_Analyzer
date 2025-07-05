/**
 * LLM自動応答・自動修正フローのステートマシン雛形
 * Mermaidフロー図に基づく
*/

import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';

import RestoreDiff from '/app/app/module/restoreDiff.js';
import Logger from './logger.js';


//実行ファイルが置かれているパス
const APP_DIR: string = "/app/app/";

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
        this.outputDir = path.join(APP_DIR, 'output');
        this.inputDir = path.join(APP_DIR, 'input');
        this.promptDir = path.join(APP_DIR, 'prompt');
        this.promptTextfile = '00_prompt.txt';
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
        // OpenAIクライアントの初期化
        // ここではautoResponser.tsのimport OpenAI from 'openai';に依存
        // ただしllmFlowController.tsでOpenAIがimportされている必要あり
        this.client = new (require('openai'))({ apiKey });
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

type LLMParsed = {
    thought: string | null;
    plan: string | null;
    requiredFilepaths: string[];
    modifiedDiff: string;
    commentText: string;
    has_fin_tag: boolean;
};

type Context = {
    initialInfo?: Record<string, unknown>;
    llmResponse?: {
        choices?: Array<{
            message: { content: string }
        }>;
        [key: string]: any;
    };
    llmParsed?: LLMParsed;
    fileContent?: string | Record<string, string>;
    dirListing?: string[] | Record<string, unknown>;
    diff?: string;
    error?: Error | string;
    result?: unknown;
};

enum State {
    Start = "Start",
    PrepareInitialContext = "PrepareInitialContext",
    SendInitialInfoToLLM = "SendInitialInfoToLLM",
    LLMAnalyzePlan = "LLMAnalyzePlan",
    LLMDecision = "LLMDecision",
    SystemAnalyzeRequest = "SystemAnalyzeRequest",
    GetFileContent = "GetFileContent",
    GetDirectoryListing = "GetDirectoryListing",
    SendInfoToLLM = "SendInfoToLLM",
    LLMReanalyze = "LLMReanalyze",
    SystemParseDiff = "SystemParseDiff",
    SystemApplyDiff = "SystemApplyDiff",
    CheckApplyResult = "CheckApplyResult",
    SendResultToLLM = "SendResultToLLM",
    LLMNextStep = "LLMNextStep",
    SendErrorToLLM = "SendErrorToLLM",
    LLMErrorReanalyze = "LLMErrorReanalyze",
    End = "End"
}


class LLMFlowController {
    private state: State = State.Start;
    private context: Context = {};

    // 厳密な型付け
    private config!: Config;
    private fileManager!: FileManager;
    private messageHandler!: MessageHandler;
    private openAIClient!: OpenAIClient;
    private logger: Logger = new Logger();
    private currentMessages: Array<{ role: string, content: string }> = [];
    private prompt_template_name: string = '';
    private next_prompt_content: string | null = null;

    async run() {
        while (this.state !== State.End) {
            switch (this.state) {
                case State.Start:
                    this.state = State.PrepareInitialContext;
                    break;

                case State.PrepareInitialContext:
                    await this.prepareInitialContext();
                    this.state = State.SendInitialInfoToLLM;
                    break;

                case State.SendInitialInfoToLLM:
                    await this.sendInitialInfoToLLM();
                    this.state = State.LLMAnalyzePlan;
                    break;

                case State.LLMAnalyzePlan:
                    await this.llmAnalyzePlan();
                    this.state = State.LLMDecision;
                    break;

                case State.LLMDecision:
                    await this.llmDecision();
                    break;

                case State.SystemAnalyzeRequest:
                    await this.systemAnalyzeRequest();
                    break;

                case State.GetFileContent:
                    await this.getFileContent();
                    this.state = State.SendInfoToLLM;
                    break;

                case State.GetDirectoryListing:
                    await this.getDirectoryListing();
                    this.state = State.SendInfoToLLM;
                    break;

                case State.SendInfoToLLM:
                    await this.sendInfoToLLM();
                    this.state = State.LLMReanalyze;
                    break;

                case State.LLMReanalyze:
                    await this.llmReanalyze();
                    this.state = State.LLMDecision;
                    break;

                case State.SystemParseDiff:
                    await this.systemParseDiff();
                    this.state = State.SystemApplyDiff;
                    break;

                case State.SystemApplyDiff:
                    await this.systemApplyDiff();
                    this.state = State.CheckApplyResult;
                    break;

                case State.CheckApplyResult:
                    await this.checkApplyResult();
                    break;

                case State.SendResultToLLM:
                    await this.sendResultToLLM();
                    this.state = State.LLMNextStep;
                    break;

                case State.LLMNextStep:
                    await this.llmNextStep();
                    this.state = State.LLMDecision;
                    break;

                case State.SendErrorToLLM:
                    await this.sendErrorToLLM();
                    this.state = State.LLMErrorReanalyze;
                    break;

                case State.LLMErrorReanalyze:
                    await this.llmErrorReanalyze();
                    this.state = State.LLMDecision;
                    break;

                default:
                    this.state = State.End;
            }
        }
        await this.finish();
    }

    // 以下、各ステップの関数は必要に応じて実装

    private async prepareInitialContext() {
        // autoResponser.tsのConfig, FileManager, MessageHandler, OpenAIClientを初期化
        this.config = new Config();
        this.fileManager = new FileManager(this.config);
        this.messageHandler = new MessageHandler();
        this.openAIClient = new OpenAIClient(process.env.OPENAI_TOKEN || '');

        // 初期プロンプト生成
        this.next_prompt_content = this.fileManager.readFirstPromptFile();
        this.prompt_template_name = this.config.promptTextfile;
        this.currentMessages = this.messageHandler.attachMessages("user", this.next_prompt_content);
    }

    private async sendInitialInfoToLLM() {
        // LLMへ初期情報送信
        // autoResponser.tsのmain()の最初のリクエスト部分を流用
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;

        // ログ記録
        this.logger.addInteractionLog(
            0,
            new Date().toISOString(),
            {
                prompt_template: this.prompt_template_name,
                full_prompt_content: this.next_prompt_content || ''
            },
            {
                raw_content: llm_response?.choices?.[0]?.message?.content || '',
                parsed_content: this.context.llmParsed || {
                    thought: null, plan: null, reply_required: [], modified_diff: '', commentText: '', has_fin_tag: false
                },
                usage: llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 }
            },
            {
                type: 'sendInitialInfoToLLM',
                details: 'Initial prompt sent to LLM'
            }
        );
    }

    private async llmAnalyzePlan() {
        // LLM: 分析・思考・計画
        // LLM応答を解析し、contextに格納
        if (!this.context.llmResponse || !this.context.llmResponse.choices || this.context.llmResponse.choices.length === 0) {
            throw new Error("LLM応答が不正です");
        }
        const llm_content = this.context.llmResponse.choices[0].message.content;
        this.context.llmParsed = this.messageHandler.analyzeMessages(llm_content);
    }

    private async llmDecision() {
        // LLMの判断
        // context.llmParsedの内容に応じて分岐
        const parsed = this.context.llmParsed;
        if (!parsed) {
            this.state = State.End;
            return;
        }
        if (parsed.has_fin_tag) {
            // タスク完了
            this.state = State.End;
        } else if (parsed.requiredFilepaths && parsed.requiredFilepaths.length > 0) {
            // 追加情報要求
            this.state = State.SystemAnalyzeRequest;
        } else if (parsed.modifiedDiff && parsed.modifiedDiff.length > 0) {
            // 修正案(diff)生成
            this.state = State.SystemParseDiff;
        } else {
            // その他（エラーや不明な場合は終了）
            this.state = State.End;
        }
    }

    private async systemAnalyzeRequest() {
        // requiredFilepathsの内容に応じてファイル or ディレクトリ取得に分岐
        const parsed = this.context.llmParsed;
        if (!parsed || !parsed.requiredFilepaths || parsed.requiredFilepaths.length === 0) {
            this.state = State.End;
            return;
        }
        // ここではファイルパスがディレクトリかファイルかを判定し、分岐
        // シンプルにファイル取得のみ実装（必要に応じてディレクトリ取得も追加）
        this.state = State.GetFileContent;
    }

    private async getFileContent() {
        // requiredFilepathsの内容をすべて取得しcontextに格納
        const parsed = this.context.llmParsed;
        if (!parsed || !parsed.requiredFilepaths || parsed.requiredFilepaths.length === 0) {
            this.state = State.End;
            return;
        }
        const fileContents: string[] = [];
        for (const filePath of parsed.requiredFilepaths) {
            const fullPath = path.join(this.config.inputProjectDir, filePath);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                fileContents.push(`--- ${filePath}\n${content}`);
            } else {
                fileContents.push(`--- ${filePath}\n[ファイルが見つかりません]`);
            }
        }
        this.context.fileContent = fileContents.join('\n\n');
    }

    private async getDirectoryListing() {
        // ディレクトリ構造取得
        // generatePeripheralStructure.jsのgetSurroundingDirectoryStructureを利用
        const getSurroundingDirectoryStructure = (await import('./generatePeripheralStructure.js')).default;
        const parsed = this.context.llmParsed;
        if (!parsed || !parsed.requiredFilepaths || parsed.requiredFilepaths.length === 0) {
            this.state = State.End;
            return;
        }
        const dirResults: Record<string, any> = {};
        for (const filePath of parsed.requiredFilepaths) {
            const absPath = path.join(this.config.inputProjectDir, filePath);
            try {
                dirResults[filePath] = getSurroundingDirectoryStructure(absPath, 2);
            } catch (e) {
                dirResults[filePath] = { error: (e as Error).message };
            }
        }
        this.context.dirListing = dirResults;
    }

    private async sendInfoToLLM() {
        // 取得したファイル内容をLLMへ送信
        // autoResponser.jsのpromptReply生成ロジックを流用
        const parsed = this.context.llmParsed;
        const filesRequested = typeof this.context.fileContent === 'string' ? this.context.fileContent : '';
        const modifiedDiff = parsed?.modifiedDiff || '';
        const commentText = parsed?.commentText || '';
        const promptReply = this.config.readPromptReplyFile(filesRequested, modifiedDiff, commentText);
        this.currentMessages = this.messageHandler.attachMessages("user", promptReply);
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;

        // ログ記録
        this.logger.addInteractionLog(
            0,
            new Date().toISOString(),
            {
                prompt_template: '00_promptReply.txt',
                full_prompt_content: promptReply
            },
            {
                raw_content: llm_response?.choices?.[0]?.message?.content || '',
                parsed_content: this.context.llmParsed || {
                    thought: null, plan: null, reply_required: [], modified_diff: '', commentText: '', has_fin_tag: false
                },
                usage: llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 }
            },
            {
                type: 'sendInfoToLLM',
                details: 'Reply prompt sent to LLM'
            }
        );
    }

    private async llmReanalyze() {
        // LLM: 新情報を元に再分析・計画更新
    }

    private async systemParseDiff() {
        // 修正差分(diff)を解析
    }

    private async systemApplyDiff() {
        // 修正を(仮想的に)適用
        // autoResponser.jsのRestoreDiffロジックをTypeScriptで再現
        const parsed = this.context.llmParsed;
        if (!parsed || !parsed.modifiedDiff || parsed.modifiedDiff.length === 0) {
            this.state = State.End;
            return;
        }
        const restoreDiff = new RestoreDiff(this.config.inputProjectDir);
        const restoredContent = restoreDiff.applyDiff(parsed.modifiedDiff);
        const tmpDiffRestorePath = path.join(this.config.outputDir, 'tmp_restoredDiff.txt');
        fs.writeFileSync(tmpDiffRestorePath, restoredContent, 'utf-8');
        // contextに保存
        this.context.diff = restoredContent;
    }

    private async checkApplyResult() {
        // 適用結果/状態を判定
        // 成功/次のステップ or エラー
        // this.state = State.SendResultToLLM など
    }

    private async sendResultToLLM() {
        // 適用結果と次の指示をLLMへ送信
    }

    private async llmNextStep() {
        // LLM: 計画の次のステップ実行 or 再評価
    }
    private async sendErrorToLLM() {
        // エラー情報をLLMへ送信
    }

    private async llmErrorReanalyze() {
        // LLM: エラーに基づき再分析・計画修正
    }

    private async finish() {
        // 終了処理: ログを /app/log/PROJECT_NAME/PULLREQUEST/PULLREQUEST_NAME/DATE_TIME.log へ保存
        try {
            // 入力ディレクトリからプロジェクト名・カテゴリ・PR名を抽出
            // 例: /app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml/premerge_xxx
            const inputDir = this.config.inputProjectDir;
            const parts = inputDir.split(path.sep);
            // parts: ["", "app", "dataset", "test", "servantes", "pullrequest", "add_Secrets_service-_global_yaml", "premerge_xxx"]
            // プロジェクト名: parts[-4], カテゴリ: parts[-3], PR名: parts[-2]
            const projectName = parts[parts.length - 4] || 'unknown_project';
            const category = parts[parts.length - 3] || 'unknown_category';
            const pullRequestName = parts[parts.length - 2] || 'unknown_pr';

            const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
            const logDir = path.join('/app/log', projectName, category, pullRequestName);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            const logPath = path.join(logDir, `${dateStr}.log`);

            const logData = this.logger.getFinalJSON();
            if (logData) {
                fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), 'utf-8');
            } else {
                // 必要な情報が足りない場合はコメントとして保存
                fs.writeFileSync(logPath, '// ログ情報が不足しています', 'utf-8');
            }
        } catch (e) {
            // 例外時も最低限のエラーログを出力
            try {
                fs.writeFileSync('/app/log/llmFlowController_error.log', String(e), 'utf-8');
            } catch {}
        }
    }
}

export { LLMFlowController, State, Context };
