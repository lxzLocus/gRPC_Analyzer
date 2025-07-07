/**
 * LLM自動応答・自動修正フローのステートマシン
 * Mermaidフロー図に基づく
*/

import fs from 'fs';
import path from 'path';

import RestoreDiff from '/app/app/module/restoreDiff.js';
import Logger from './logger.js';
import Config from './config.js';
import MessageHandler from './messageHandler.js';
import FileManager from './fileManager.js';
import OpenAIClient from './openAIClient.js';
import { LLMParsed, ParsedContentLog, Context, State } from './types.js';

class LLMFlowController {
    // 状態管理
    private state: State = State.Start;
    private context: Context = {};
    private inputPremergeDir: string = ''; // プルリクエストのパス "/PATH/premerge_xxx"

    // 依存関係
    private config!: Config;
    private fileManager!: FileManager;
    private messageHandler!: MessageHandler;
    private openAIClient!: OpenAIClient;
    private logger: Logger = new Logger();

    // 作業用データ
    private currentMessages: Array<{ role: string, content: string }> = [];
    private prompt_template_name: string = '';
    private next_prompt_content: string | null = null;

    // ログ管理
    private currentTurn: number = 0;
    private startTime: string = '';
    private totalPromptTokens: number = 0;
    private totalCompletionTokens: number = 0;

    constructor(pullRequestPath: string) {
        this.inputPremergeDir = pullRequestPath;
        this.startTime = new Date().toISOString();
    }

    // 型変換ヘルパー
    private convertToLogFormat(parsed: LLMParsed | null): ParsedContentLog {
        if (!parsed) {
            return {
                thought: null,
                plan: null,
                reply_required: [],
                modified_diff: null,
                commentText: null,
                has_fin_tag: false
            };
        }

        // planを配列形式に変換
        let planArray: any[] = [];
        if (parsed.plan) {
            try {
                // プランがJSON形式の場合
                const planObj = JSON.parse(parsed.plan);
                if (Array.isArray(planObj)) {
                    planArray = planObj;
                } else {
                    // 単一のプランの場合は配列にラップ
                    planArray = [planObj];
                }
            } catch {
                // JSON形式でない場合は文字列として配列にラップ
                planArray = [{ step: 1, action: "ANALYZE", description: parsed.plan }];
            }
        }

        return {
            thought: parsed.thought,
            plan: planArray.length > 0 ? planArray : null,
            reply_required: parsed.requiredFilepaths.map(path => ({ type: "FILE_CONTENT", path })),
            modified_diff: parsed.modifiedDiff || null,
            commentText: parsed.commentText || null,
            has_fin_tag: parsed.has_fin_tag
        };
    }

    // =============================================================================
    // メインフロー制御
    // =============================================================================

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

                case State.ProcessRequiredInfos:
                    await this.processRequiredInfos();
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

    // =============================================================================
    // 初期化・準備フェーズ
    // =============================================================================

    private async prepareInitialContext() {
        // autoResponser.tsのConfig, FileManager, MessageHandler, OpenAIClientを初期化
        this.config = new Config(this.inputPremergeDir);
        this.fileManager = new FileManager(this.config);
        this.messageHandler = new MessageHandler();
        this.openAIClient = new OpenAIClient(process.env.OPENAI_TOKEN || '');

        // 初期プロンプト生成
        this.next_prompt_content = this.fileManager.readFirstPromptFile();
        this.prompt_template_name = this.config.promptTextfile;
        this.currentMessages = this.messageHandler.attachMessages("user", this.next_prompt_content);
    }

    // =============================================================================
    // LLM通信フェーズ
    // =============================================================================

    private async sendInitialInfoToLLM() {
        // LLMへ初期情報送信
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;

        // ターン数とトークン数を更新
        this.currentTurn++;
        const usage = llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
        this.totalPromptTokens += usage.prompt_tokens;
        this.totalCompletionTokens += usage.completion_tokens;

        // ログ記録
        this.logger.addInteractionLog(
            this.currentTurn,
            new Date().toISOString(),
            {
                prompt_template: this.prompt_template_name,
                full_prompt_content: this.next_prompt_content || ''
            },
            {
                raw_content: llm_response?.choices?.[0]?.message?.content || '',
                parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                usage: usage
            },
            {
                type: 'INITIAL_CONTEXT',
                details: 'Initial context sent to LLM'
            }
        );
    }

    private async sendInfoToLLM() {
        // 取得したファイル内容をLLMへ送信
        const parsed = this.context.llmParsed;
        const filesRequested = typeof this.context.fileContent === 'string' ? this.context.fileContent : '';
        const modifiedDiff = parsed?.modifiedDiff || '';
        const commentText = parsed?.commentText || '';
        const promptReply = this.config.readPromptReplyFile(filesRequested, modifiedDiff, commentText);
        this.currentMessages = this.messageHandler.attachMessages("user", promptReply);
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;

        // ターン数とトークン数を更新
        this.currentTurn++;
        const usage = llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
        this.totalPromptTokens += usage.prompt_tokens;
        this.totalCompletionTokens += usage.completion_tokens;

        // ログ記録
        this.logger.addInteractionLog(
            this.currentTurn,
            new Date().toISOString(),
            {
                prompt_template: '00_promptReply.txt',
                full_prompt_content: promptReply
            },
            {
                raw_content: llm_response?.choices?.[0]?.message?.content || '',
                parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                usage: usage
            },
            {
                type: 'FETCHING_FILES',
                details: 'Requested files sent to LLM'
            }
        );
    }

    // =============================================================================
    // LLM応答処理フェーズ
    // =============================================================================

    private async llmAnalyzePlan() {
        // LLM: 分析・思考・計画
        // LLM応答を解析し、contextに格納
        if (!this.context.llmResponse || !this.context.llmResponse.choices || this.context.llmResponse.choices.length === 0) {
            throw new Error("LLM応答が不正です");
        }
        const llm_content = this.context.llmResponse.choices[0].message.content;
        this.context.llmParsed = this.messageHandler.analyzeMessages(llm_content);
    }

    private async llmReanalyze() {
        // LLM: 新情報を元に再分析・計画更新
        if (!this.context.llmResponse?.choices?.[0]?.message?.content) {
            this.state = State.End;
            return;
        }
        const content = this.context.llmResponse.choices[0].message.content;
        this.context.llmParsed = this.messageHandler.analyzeMessages(content);
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

    private async llmNextStep() {
        // LLM: 計画の次のステップ実行 or 再評価
        if (!this.context.llmResponse?.choices?.[0]?.message?.content) {
            this.state = State.End;
            return;
        }
        const content = this.context.llmResponse.choices[0].message.content;
        this.context.llmParsed = this.messageHandler.analyzeMessages(content);
    }

    private async llmErrorReanalyze() {
        // LLM: エラーに基づき再分析・計画修正
        if (!this.context.llmResponse?.choices?.[0]?.message?.content) {
            this.state = State.End;
            return;
        }
        const content = this.context.llmResponse.choices[0].message.content;
        this.context.llmParsed = this.messageHandler.analyzeMessages(content);
    }

    // =============================================================================
    // システム情報取得フェーズ
    // =============================================================================

    private async systemAnalyzeRequest() {
        // requiredFileInfosの内容に応じてファイル or ディレクトリ取得に分岐
        const parsed = this.context.llmParsed;
        if (!parsed) {
            this.state = State.End;
            return;
        }

        if (!parsed.requiredFileInfos || parsed.requiredFileInfos.length === 0) {
            // 後方互換性のために古いrequiredFilepathsもチェック
            if (!parsed.requiredFilepaths || parsed.requiredFilepaths.length === 0) {
                this.state = State.End;
                return;
            }
            // 古い形式の場合は全てFILE_CONTENTとして扱う
            this.state = State.GetFileContent;
            return;
        }

        // 新しい形式：requiredFileInfosに基づいて処理
        const hasFileContent = parsed.requiredFileInfos.some(info => info.type === 'FILE_CONTENT');
        const hasDirectoryListing = parsed.requiredFileInfos.some(info => info.type === 'DIRECTORY_LISTING');

        if (hasFileContent && hasDirectoryListing) {
            // 両方ある場合は統合処理
            this.state = State.ProcessRequiredInfos;
        } else if (hasFileContent) {
            // ファイル内容のみ
            this.state = State.GetFileContent;
        } else if (hasDirectoryListing) {
            // ディレクトリ構造のみ
            this.state = State.GetDirectoryListing;
        } else {
            this.state = State.End;
        }
    }

    private async getFileContent() {
        // FILE_CONTENTリクエストを処理
        const parsed = this.context.llmParsed;
        if (!parsed) {
            this.state = State.End;
            return;
        }

        try {
            // 新しいAPIを使用
            if (parsed.requiredFileInfos && parsed.requiredFileInfos.length > 0) {
                const fileContentInfos = parsed.requiredFileInfos.filter(info => info.type === 'FILE_CONTENT');
                if (fileContentInfos.length > 0) {
                    const result = await this.fileManager.getFileContents(fileContentInfos);
                    this.context.fileContent = result;
                    return;
                }
            }

            // 後方互換性：古いAPIを使用
            if (parsed.requiredFilepaths && parsed.requiredFilepaths.length > 0) {
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
        } catch (error) {
            console.error('Error getting file content:', error);
            this.context.fileContent = `Error: ${(error as Error).message}`;
        }
    }

    private async getDirectoryListing() {
        // DIRECTORY_LISTINGリクエストを処理
        const parsed = this.context.llmParsed;
        if (!parsed) {
            this.state = State.End;
            return;
        }

        try {
            // 新しいAPIを使用
            if (parsed.requiredFileInfos && parsed.requiredFileInfos.length > 0) {
                const directoryListingInfos = parsed.requiredFileInfos.filter(info => info.type === 'DIRECTORY_LISTING');
                if (directoryListingInfos.length > 0) {
                    const result = await this.fileManager.getDirectoryListings(directoryListingInfos);
                    this.context.fileContent = result;
                    return;
                }
            }

            // 後方互換性：古いAPIを使用（generatePeripheralStructure.jsを直接使用）
            // @ts-ignore: 動的インポートのため型チェックを無視
            const getSurroundingDirectoryStructure = (await import('./generatePeripheralStructure.js')).default;
            if (parsed.requiredFilepaths && parsed.requiredFilepaths.length > 0) {
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
                this.context.fileContent = JSON.stringify(dirResults, null, 2);
            }
        } catch (importError) {
            console.warn('Failed to process directory listing:', importError);
            this.context.fileContent = `Error: ${(importError as Error).message}`;
        }
    }

    private async processRequiredInfos() {
        // 新しい統合処理：FILE_CONTENTとDIRECTORY_LISTINGの両方を処理
        const parsed = this.context.llmParsed;
        if (!parsed || !parsed.requiredFileInfos || parsed.requiredFileInfos.length === 0) {
            this.state = State.End;
            return;
        }

        try {
            const result = await this.fileManager.processRequiredFileInfos(parsed.requiredFileInfos);
            this.context.fileContent = result;
        } catch (error) {
            console.error('Error processing required file infos:', error);
            this.context.fileContent = `Error processing files: ${(error as Error).message}`;
        }
    }

    // =============================================================================
    // diff処理フェーズ
    // =============================================================================

    private async systemParseDiff() {
        // 修正差分(diff)を解析・検証
        const parsed = this.context.llmParsed;
        if (!parsed?.modifiedDiff) {
            console.warn("No diff to parse");
            this.state = State.End;
            return;
        }
        // diff形式の検証ロジックを実装
        // 今のところは単純にパススルー
        console.log(`Parsing diff: ${parsed.modifiedDiff.slice(0, 100)}...`);
    }

    private async systemApplyDiff() {
        // 修正を(仮想的に)適用
        const parsed = this.context.llmParsed;
        if (!parsed || !parsed.modifiedDiff || parsed.modifiedDiff.length === 0) {
            console.warn("systemApplyDiff was called without a diff. Ending flow.");
            this.state = State.End;
            return;
        }

        try {
            const restoreDiff = new RestoreDiff(this.config.inputProjectDir);
            const restoredContent = restoreDiff.applyDiff(parsed.modifiedDiff);
            const tmpDiffRestorePath = path.join(this.config.outputDir, 'tmp_restoredDiff.txt');
            fs.writeFileSync(tmpDiffRestorePath, restoredContent, 'utf-8');
            // contextに保存
            this.context.diff = restoredContent;
            // 成功したのでエラーコンテキストをクリア
            this.context.error = undefined;
        } catch (e) {
            console.error("Error applying diff:", e);
            this.context.error = e instanceof Error ? e.message : String(e);
            this.context.diff = undefined;
        }
    }

    private async checkApplyResult() {
        // 適用結果/状態を判定
        if (this.context.error) {
            // エラーがあればLLMにエラーを報告
            this.state = State.SendErrorToLLM;
        } else {
            // 成功したらLLMに結果を報告
            this.state = State.SendResultToLLM;
        }
    }

    // =============================================================================
    // 結果・エラー処理フェーズ
    // =============================================================================

    private async sendResultToLLM() {
        // 適用結果と次の指示をLLMへ送信
        const modifiedFiles = this.context.diff || '';
        const promptModified = this.config.readPromptModifiedFile(modifiedFiles);
        this.currentMessages = this.messageHandler.attachMessages("user", promptModified);
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;

        // ターン数とトークン数を更新
        this.currentTurn++;
        const usage = llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
        this.totalPromptTokens += usage.prompt_tokens;
        this.totalCompletionTokens += usage.completion_tokens;

        // ログ記録
        this.logger.addInteractionLog(
            this.currentTurn,
            new Date().toISOString(),
            {
                prompt_template: '00_promptModified.txt',
                full_prompt_content: promptModified
            },
            {
                raw_content: llm_response?.choices?.[0]?.message?.content || '',
                parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                usage: usage
            },
            {
                type: 'APPLYING_DIFF_AND_RECHECKING',
                details: 'Diff applied successfully. Preparing for re-check.'
            }
        );
    }

    private async sendErrorToLLM() {
        // エラー情報をLLMへ送信
        const errorMessage = this.context.error || 'Unknown error occurred';
        const errorPrompt = `エラーが発生しました: ${errorMessage}\n\n修正案を再検討してください。`;
        this.currentMessages = this.messageHandler.attachMessages("user", errorPrompt);
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;

        // ターン数とトークン数を更新
        this.currentTurn++;
        const usage = llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
        this.totalPromptTokens += usage.prompt_tokens;
        this.totalCompletionTokens += usage.completion_tokens;

        // ログ記録
        this.logger.addInteractionLog(
            this.currentTurn,
            new Date().toISOString(),
            {
                prompt_template: 'error_prompt',
                full_prompt_content: errorPrompt
            },
            {
                raw_content: llm_response?.choices?.[0]?.message?.content || '',
                parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                usage: usage
            },
            {
                type: 'ERROR_HANDLING',
                details: `Error sent to LLM: ${errorMessage}`
            }
        );
    }

    // =============================================================================
    // 終了処理
    // =============================================================================

    private async finish() {
        // 実験メタデータを設定
        const endTime = new Date().toISOString();
        const experimentId = this.generateExperimentId();
        const status = this.context.llmParsed?.has_fin_tag ? 'Completed (%%_Fin_%%)' : 'Incomplete';
        
        this.logger.setExperimentMetadata(
            experimentId,
            this.startTime,
            endTime,
            status,
            this.currentTurn,
            this.totalPromptTokens,
            this.totalCompletionTokens
        );

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

    private generateExperimentId(): string {
        // 入力ディレクトリからプロジェクト名とPR名を抽出してIDを生成
        const inputDir = this.config.inputProjectDir;
        const parts = inputDir.split(path.sep);
        const projectName = parts[parts.length - 4] || 'unknown_project';
        const pullRequestName = parts[parts.length - 2] || 'unknown_pr';
        return `${projectName}/Issue_${pullRequestName}`;
    }
}

export { LLMFlowController, State, Context };
