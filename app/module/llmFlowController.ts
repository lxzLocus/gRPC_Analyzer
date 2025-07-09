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
import { 
    LLMParsed, 
    ParsedContentLog, 
    Context, 
    State, 
    InternalProgressState, 
    ProcessingPhase,
    RequiredFileInfo,
    FileContentSubType,
    DirectoryListingSubType,
    RequiredFileAnalysisResult,
    ProcessingPlan,
    BackupInfo,
    DiffValidationResult,
    DiffApplicationStats,
    ErrorContext
} from './types.js';

class LLMFlowController {
    // 状態管理
    private state: State = State.Start;
    private context: Context = {};
    private inputPremergeDir: string = ''; // プルリクエストのパス "/PATH/premerge_xxx"
    
    // 内部進行状況管理
    private internalProgress: InternalProgressState = {
        currentPhase: 'INITIAL_ANALYSIS',
        stepsCompleted: [],
        stepsRemaining: [],
        contextAccumulated: {
            sourceFiles: [],
            configFiles: [],
            protoFiles: [],
            testFiles: [],
            directories: [],
            dependencies: []
        },
        analysisDepth: 1,
        iterationCount: 0,
        maxIterations: 10,
        errorCount: 0,
        warningCount: 0
    };

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
        // Phase 3-1: 状態遷移最適化 - 詳細な分析と循環参照防止
        this.logProgressState();
        
        const parsed = this.context.llmParsed;
        if (!parsed) {
            this.logger.logWarning("No parsed LLM response found, ending");
            this.state = State.End;
            return;
        }

        // 循環参照防止: 既に処理済みのファイルを追跡
        const processedPaths = this.getProcessedFilePaths();
        
        // requiredFileInfosの詳細分析
        const analysisResult = this.analyzeRequiredFileInfos(parsed, processedPaths);
        
        if (analysisResult.isEmpty) {
            this.logger.logInfo("No files or directories to process, ending");
            this.state = State.End;
            return;
        }

        // パフォーマンス最適化: 優先度ベースの処理順序決定
        const optimizedPlan = this.optimizeProcessingPlan(analysisResult);
        
        // 進行状況を内部状態に記録
        this.updateInternalProgress({
            analysisDepth: this.internalProgress.analysisDepth + 1,
            stepsRemaining: optimizedPlan.steps,
            contextAccumulated: {
                ...this.internalProgress.contextAccumulated,
                sourceFiles: [...this.internalProgress.contextAccumulated.sourceFiles, ...optimizedPlan.sourceFiles],
                configFiles: [...this.internalProgress.contextAccumulated.configFiles, ...optimizedPlan.configFiles],
                protoFiles: [...this.internalProgress.contextAccumulated.protoFiles, ...optimizedPlan.protoFiles],
                testFiles: [...this.internalProgress.contextAccumulated.testFiles, ...optimizedPlan.testFiles],
                directories: [...this.internalProgress.contextAccumulated.directories, ...optimizedPlan.directories]
            }
        });

        // 状態遷移決定
        this.state = this.determineNextState(analysisResult, optimizedPlan);
        
        this.logger.logInfo(`Next state: ${this.state}, Processing ${analysisResult.totalFiles} files, ${analysisResult.totalDirectories} directories`);
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
        // Phase 3-2: 改善されたdiff適用システム
        const parsed = this.context.llmParsed;
        if (!parsed || !parsed.modifiedDiff || parsed.modifiedDiff.length === 0) {
            this.logger.logWarning("systemApplyDiff was called without a diff. Ending flow.");
            this.state = State.End;
            return;
        }

        this.logger.logInfo("Starting enhanced diff application process...");
        
        try {
            // Phase 3-2 新機能: 適用前のバックアップ作成
            const backupInfo = await this.createPreApplyBackup();
            this.logger.logInfo(`Backup created: ${backupInfo.backupPath}`);

            // RestoreDiffクラスを使用してdiffを適用
            const restoreDiff = new RestoreDiff(this.config.inputProjectDir);
            this.logger.logInfo("Applying diff using RestoreDiff...");
            
            const restoredContent = restoreDiff.applyDiff(parsed.modifiedDiff);
            
            // Phase 3-2 新機能: 適用結果の詳細検証
            const validationResult = await this.validateDiffApplication(restoredContent, parsed.modifiedDiff);
            
            if (!validationResult.isValid) {
                throw new Error(`Diff validation failed: ${validationResult.errors.join(', ')}`);
            }

            // 結果をファイルに保存
            const tmpDiffRestorePath = path.join(this.config.outputDir, 'tmp_restoredDiff.txt');
            fs.writeFileSync(tmpDiffRestorePath, restoredContent, 'utf-8');
            
            // contextに保存
            this.context.diff = restoredContent;
            this.context.error = undefined;

            // Phase 3-2 新機能: 適用統計の記録
            const stats = await this.collectDiffApplicationStats(restoredContent, parsed.modifiedDiff);
            this.logger.logInfo(`Diff applied successfully. Stats: ${JSON.stringify(stats)}`);
            
            // 内部進行状況を更新
            this.updateInternalProgress({
                stepsCompleted: [...this.internalProgress.stepsCompleted, 'DIFF_APPLIED'],
                contextAccumulated: {
                    ...this.internalProgress.contextAccumulated,
                    dependencies: [...this.internalProgress.contextAccumulated.dependencies, `backup:${backupInfo.backupPath}`]
                }
            });

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            this.logger.logError("Error applying diff", e instanceof Error ? e : new Error(errorMessage));
            
            // Phase 3-2 新機能: エラー時の詳細情報収集
            const errorContext = await this.collectErrorContext(parsed.modifiedDiff, errorMessage);
            
            this.context.error = {
                message: errorMessage,
                errorContext: errorContext,
                timestamp: new Date().toISOString(),
                phase: 'DIFF_APPLICATION'
            } as any;
            this.context.diff = undefined;
            
            // エラー統計を更新
            this.updateInternalProgress({
                errorCount: this.internalProgress.errorCount + 1
            });
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

    // =============================================================================
    // 内部進行状況管理メソッド
    // =============================================================================

    private updateProgress(phase: ProcessingPhase, stepCompleted?: string, stepRemaining?: string[]) {
        this.internalProgress.currentPhase = phase;
        
        if (stepCompleted) {
            this.internalProgress.stepsCompleted.push(stepCompleted);
        }
        
        if (stepRemaining) {
            this.internalProgress.stepsRemaining = stepRemaining;
        }
        
        this.logger.logInfo(`Phase: ${phase}, Step: ${stepCompleted || 'N/A'}, Remaining: ${stepRemaining?.length || 0}`);
    }

    private categorizeRequiredFiles(requiredFileInfos: RequiredFileInfo[]): {
        highPriority: RequiredFileInfo[];
        mediumPriority: RequiredFileInfo[];
        lowPriority: RequiredFileInfo[];
        byCategory: {
            sourceFiles: RequiredFileInfo[];
            configFiles: RequiredFileInfo[];
            protoFiles: RequiredFileInfo[];
            testFiles: RequiredFileInfo[];
            directories: RequiredFileInfo[];
            other: RequiredFileInfo[];
        }
    } {
        const result = {
            highPriority: [] as RequiredFileInfo[],
            mediumPriority: [] as RequiredFileInfo[],
            lowPriority: [] as RequiredFileInfo[],
            byCategory: {
                sourceFiles: [] as RequiredFileInfo[],
                configFiles: [] as RequiredFileInfo[],
                protoFiles: [] as RequiredFileInfo[],
                testFiles: [] as RequiredFileInfo[],
                directories: [] as RequiredFileInfo[],
                other: [] as RequiredFileInfo[]
            }
        };

        for (const info of requiredFileInfos) {
            // 優先度別分類
            switch (info.priority) {
                case 'HIGH':
                    result.highPriority.push(info);
                    break;
                case 'MEDIUM':
                    result.mediumPriority.push(info);
                    break;
                case 'LOW':
                    result.lowPriority.push(info);
                    break;
                default:
                    result.mediumPriority.push(info); // デフォルトはMEDIUM
            }

            // カテゴリ別分類
            if (info.type === 'DIRECTORY_LISTING') {
                result.byCategory.directories.push(info);
            } else if (info.type === 'FILE_CONTENT') {
                switch (info.subType as FileContentSubType) {
                    case 'SOURCE_CODE':
                        result.byCategory.sourceFiles.push(info);
                        break;
                    case 'CONFIG_FILE':
                    case 'BUILD_FILE':
                        result.byCategory.configFiles.push(info);
                        break;
                    case 'PROTO_FILE':
                        result.byCategory.protoFiles.push(info);
                        break;
                    case 'TEST_FILE':
                        result.byCategory.testFiles.push(info);
                        break;
                    default:
                        result.byCategory.other.push(info);
                }
            }
        }

        return result;
    }

    private determineNextPhase(parsed: LLMParsed): ProcessingPhase {
        const currentPhase = this.internalProgress.currentPhase;
        const iterationCount = this.internalProgress.iterationCount;
        
        // LLMからの提案があれば考慮
        if (parsed.suggestedPhase) {
            return parsed.suggestedPhase;
        }

        // ファイル要求の内容に基づいて判断
        if (parsed.requiredFileInfos && parsed.requiredFileInfos.length > 0) {
            const categorized = this.categorizeRequiredFiles(parsed.requiredFileInfos);
            
            // プロトファイルが要求されている = 詳細分析フェーズ
            if (categorized.byCategory.protoFiles.length > 0) {
                return 'DETAILED_ANALYSIS';
            }
            
            // テストファイルが要求されている = 検証フェーズ
            if (categorized.byCategory.testFiles.length > 0) {
                return 'VERIFICATION';
            }
            
            // ソースファイルとconfigが混在 = 解決策立案フェーズ
            if (categorized.byCategory.sourceFiles.length > 0 && categorized.byCategory.configFiles.length > 0) {
                return 'SOLUTION_PLANNING';
            }
            
            // 最初の反復でソースファイル = コンテキスト収集
            if (iterationCount <= 2 && categorized.byCategory.sourceFiles.length > 0) {
                return 'CONTEXT_GATHERING';
            }
        }

        // diffが生成されている = 実装フェーズ
        if (parsed.modifiedDiff && parsed.modifiedDiff.length > 0) {
            return 'IMPLEMENTATION';
        }

        // 完了フラグがある = 最終化フェーズ
        if (parsed.has_fin_tag) {
            return 'FINALIZATION';
        }

        // デフォルトの進行
        switch (currentPhase) {
            case 'INITIAL_ANALYSIS':
                return 'CONTEXT_GATHERING';
            case 'CONTEXT_GATHERING':
                return 'DETAILED_ANALYSIS';
            case 'DETAILED_ANALYSIS':
                return 'SOLUTION_PLANNING';
            case 'SOLUTION_PLANNING':
                return 'IMPLEMENTATION';
            case 'IMPLEMENTATION':
                return 'VERIFICATION';
            case 'VERIFICATION':
                return 'FINALIZATION';
            default:
                return currentPhase;
        }
    }

    // =============================================================================
    // Phase 3-1: 状態遷移最適化のためのヘルパーメソッド
    // =============================================================================

    /**
     * 既に処理済みのファイルパスを取得（循環参照防止）
     */
    private getProcessedFilePaths(): Set<string> {
        const processed = new Set<string>();
        
        // 内部進行状況から既に処理済みのファイルを取得
        this.internalProgress.contextAccumulated.sourceFiles.forEach(f => processed.add(f));
        this.internalProgress.contextAccumulated.configFiles.forEach(f => processed.add(f));
        this.internalProgress.contextAccumulated.protoFiles.forEach(f => processed.add(f));
        this.internalProgress.contextAccumulated.testFiles.forEach(f => processed.add(f));
        
        return processed;
    }

    /**
     * RequiredFileInfosの詳細分析
     */
    private analyzeRequiredFileInfos(parsed: any, processedPaths: Set<string>): RequiredFileAnalysisResult {
        const result: RequiredFileAnalysisResult = {
            isEmpty: true,
            totalFiles: 0,
            totalDirectories: 0,
            hasFileContent: false,
            hasDirectoryListing: false,
            newFiles: [],
            duplicateFiles: [],
            priorityGroups: {
                high: [],
                medium: [],
                low: []
            }
        };

        // 新しい形式をチェック
        if (parsed.requiredFileInfos && parsed.requiredFileInfos.length > 0) {
            result.isEmpty = false;
            
            for (const info of parsed.requiredFileInfos) {
                const isDuplicate = processedPaths.has(info.path);
                
                if (info.type === 'FILE_CONTENT') {
                    result.hasFileContent = true;
                    result.totalFiles++;
                    
                    if (isDuplicate) {
                        result.duplicateFiles.push(info);
                    } else {
                        result.newFiles.push(info);
                        // 優先度ベースの分類
                        const priority = info.priority || 'medium';
                        result.priorityGroups[priority as keyof typeof result.priorityGroups].push(info);
                    }
                } else if (info.type === 'DIRECTORY_LISTING') {
                    result.hasDirectoryListing = true;
                    result.totalDirectories++;
                    
                    if (!isDuplicate) {
                        result.newFiles.push(info);
                        const priority = info.priority || 'medium';
                        result.priorityGroups[priority as keyof typeof result.priorityGroups].push(info);
                    }
                }
            }
        }

        // 後方互換性：古い形式もチェック
        if (result.isEmpty && parsed.requiredFilepaths && parsed.requiredFilepaths.length > 0) {
            result.isEmpty = false;
            result.hasFileContent = true;
            result.totalFiles = parsed.requiredFilepaths.length;
            
            // 古い形式は中優先度として扱う
            for (const filePath of parsed.requiredFilepaths) {
                if (!processedPaths.has(filePath)) {
                    const info: RequiredFileInfo = { 
                        type: 'FILE_CONTENT' as const, 
                        path: filePath, 
                        priority: 'MEDIUM' as const 
                    };
                    result.newFiles.push(info);
                    result.priorityGroups.medium.push(info);
                } else {
                    result.duplicateFiles.push({ 
                        type: 'FILE_CONTENT' as const, 
                        path: filePath 
                    });
                }
            }
        }

        return result;
    }

    /**
     * 処理プランの最適化（優先度とパフォーマンスを考慮）
     */
    private optimizeProcessingPlan(analysisResult: RequiredFileAnalysisResult): ProcessingPlan {
        const plan: ProcessingPlan = {
            steps: [],
            sourceFiles: [],
            configFiles: [],
            protoFiles: [],
            testFiles: [],
            directories: []
        };

        // 優先度順に処理ステップを構築
        const allFiles = [
            ...analysisResult.priorityGroups.high,
            ...analysisResult.priorityGroups.medium,
            ...analysisResult.priorityGroups.low
        ];

        for (const fileInfo of allFiles) {
            plan.steps.push(`Process ${fileInfo.type}: ${fileInfo.path}`);
            
            // ファイル種別による分類
            const ext = path.extname(fileInfo.path).toLowerCase();
            if (fileInfo.type === 'DIRECTORY_LISTING') {
                plan.directories.push(fileInfo.path);
            } else if (ext === '.proto') {
                plan.protoFiles.push(fileInfo.path);
            } else if (ext === '.json' || ext === '.yaml' || ext === '.yml' || ext === '.toml') {
                plan.configFiles.push(fileInfo.path);
            } else if (fileInfo.path.includes('test') || fileInfo.path.includes('spec')) {
                plan.testFiles.push(fileInfo.path);
            } else {
                plan.sourceFiles.push(fileInfo.path);
            }
        }

        return plan;
    }

    /**
     * 内部進行状況の更新
     */
    private updateInternalProgress(updates: Partial<InternalProgressState>): void {
        this.internalProgress = {
            ...this.internalProgress,
            ...updates,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * 分析結果に基づく次の状態決定
     */
    private determineNextState(analysisResult: RequiredFileAnalysisResult, plan: ProcessingPlan): State {
        if (analysisResult.isEmpty) {
            return State.End;
        }

        // 重複ファイルのみの場合は警告してスキップ
        if (analysisResult.newFiles.length === 0 && analysisResult.duplicateFiles.length > 0) {
            this.logger.logWarning(`All ${analysisResult.duplicateFiles.length} files already processed, skipping to avoid circular references`);
            return State.End;
        }

        // 効率的な処理ルート決定
        if (analysisResult.hasFileContent && analysisResult.hasDirectoryListing) {
            return State.ProcessRequiredInfos; // 統合処理
        } else if (analysisResult.hasFileContent) {
            return State.GetFileContent;
        } else if (analysisResult.hasDirectoryListing) {
            return State.GetDirectoryListing;
        } else {
            return State.End;
        }
    }

    /**
     * 現在のログ状況と進行状況を表示
     */
    private logProgressState() {
        const progress = this.internalProgress;
        this.logger.logInfo(`=== Progress State ===`);
        this.logger.logInfo(`Phase: ${progress.currentPhase}`);
        this.logger.logInfo(`Iteration: ${progress.iterationCount}/${progress.maxIterations}`);
        this.logger.logInfo(`Analysis Depth: ${progress.analysisDepth}`);
        this.logger.logInfo(`Steps Completed: ${progress.stepsCompleted.length}`);
        this.logger.logInfo(`Steps Remaining: ${progress.stepsRemaining.length}`);
        this.logger.logInfo(`Context Accumulated:`);
        this.logger.logInfo(`  - Source Files: ${progress.contextAccumulated.sourceFiles.length}`);
        this.logger.logInfo(`  - Config Files: ${progress.contextAccumulated.configFiles.length}`);
        this.logger.logInfo(`  - Proto Files: ${progress.contextAccumulated.protoFiles.length}`);
        this.logger.logInfo(`  - Test Files: ${progress.contextAccumulated.testFiles.length}`);
        this.logger.logInfo(`  - Directories: ${progress.contextAccumulated.directories.length}`);
        this.logger.logInfo(`Errors: ${progress.errorCount}, Warnings: ${progress.warningCount}`);
        this.logger.logInfo(`=====================`);
    }

    // =============================================================================
    // Phase 3-2: diff適用システム改善のためのヘルパーメソッド
    // =============================================================================

    /**
     * 適用前のバックアップを作成
     */
    private async createPreApplyBackup(): Promise<BackupInfo> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(this.config.outputDir, 'backups', timestamp);
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const originalFiles: string[] = [];
        let totalSize = 0;

        // プロジェクトディレクトリ内の重要ファイルをバックアップ
        const filesToBackup = this.findFilesToBackup();
        
        for (const filePath of filesToBackup) {
            try {
                const relativePath = path.relative(this.config.inputProjectDir, filePath);
                const backupFilePath = path.join(backupDir, relativePath);
                const backupFileDir = path.dirname(backupFilePath);
                
                if (!fs.existsSync(backupFileDir)) {
                    fs.mkdirSync(backupFileDir, { recursive: true });
                }
                
                fs.copyFileSync(filePath, backupFilePath);
                originalFiles.push(relativePath);
                
                const stats = fs.statSync(filePath);
                totalSize += stats.size;
                
            } catch (error) {
                this.logger.logWarning(`Failed to backup file ${filePath}: ${error}`);
            }
        }

        const backupInfo: BackupInfo = {
            backupPath: backupDir,
            timestamp: timestamp,
            originalFiles: originalFiles,
            backupSize: totalSize
        };

        // バックアップ情報をJSONで保存
        const backupInfoPath = path.join(backupDir, 'backup_info.json');
        fs.writeFileSync(backupInfoPath, JSON.stringify(backupInfo, null, 2));

        return backupInfo;
    }

    /**
     * バックアップ対象ファイルを特定
     */
    private findFilesToBackup(): string[] {
        const files: string[] = [];
        const projectDir = this.config.inputProjectDir;

        // 重要ファイル拡張子
        const importantExtensions = ['.js', '.ts', '.proto', '.json', '.yaml', '.yml', '.md', '.txt'];
        
        const scanDirectory = (dir: string) => {
            try {
                const entries = fs.readdirSync(dir);
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        // node_modules や .git は除外
                        if (!['node_modules', '.git', '.vscode'].includes(entry)) {
                            scanDirectory(fullPath);
                        }
                    } else if (stat.isFile()) {
                        const ext = path.extname(entry).toLowerCase();
                        if (importantExtensions.includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                this.logger.logWarning(`Failed to scan directory ${dir}: ${error}`);
            }
        };

        scanDirectory(projectDir);
        return files;
    }

    /**
     * diff適用結果の検証
     */
    private async validateDiffApplication(restoredContent: string, originalDiff: string): Promise<DiffValidationResult> {
        const result: DiffValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            appliedChanges: 0,
            skippedChanges: 0
        };

        try {
            // 基本的な形式チェック
            if (!restoredContent || restoredContent.length === 0) {
                result.errors.push("Restored content is empty");
                result.isValid = false;
            }

            // diffの形式チェック
            const diffLines = originalDiff.split('\n');
            let addedLines = 0;
            let deletedLines = 0;
            let contextLines = 0;

            for (const line of diffLines) {
                if (line.startsWith('+') && !line.startsWith('+++')) {
                    addedLines++;
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    deletedLines++;
                } else if (line.startsWith(' ')) {
                    contextLines++;
                }
            }

            result.appliedChanges = addedLines + deletedLines;

            // 警告チェック
            if (addedLines === 0 && deletedLines === 0) {
                result.warnings.push("No actual changes detected in diff");
            }

            if (contextLines < 3) {
                result.warnings.push("Insufficient context lines in diff");
            }

            // 復元内容の基本チェック
            if (restoredContent.includes('<<<<<<< HEAD') || restoredContent.includes('>>>>>>> ')) {
                result.errors.push("Merge conflict markers detected in restored content");
                result.isValid = false;
            }

            // 文字エンコーディングチェック
            try {
                Buffer.from(restoredContent, 'utf-8');
            } catch (e) {
                result.errors.push("Invalid UTF-8 encoding in restored content");
                result.isValid = false;
            }

        } catch (error) {
            result.errors.push(`Validation error: ${error}`);
            result.isValid = false;
        }

        return result;
    }

    /**
     * diff適用統計の収集
     */
    private async collectDiffApplicationStats(restoredContent: string, originalDiff: string): Promise<DiffApplicationStats> {
        const startTime = Date.now();
        
        const stats: DiffApplicationStats = {
            totalLines: 0,
            addedLines: 0,
            deletedLines: 0,
            modifiedFiles: 0,
            processingTime: 0,
            backupCreated: true
        };

        try {
            // 復元内容の統計
            stats.totalLines = restoredContent.split('\n').length;

            // diff統計の計算
            const diffLines = originalDiff.split('\n');
            for (const line of diffLines) {
                if (line.startsWith('+') && !line.startsWith('+++')) {
                    stats.addedLines++;
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    stats.deletedLines++;
                } else if (line.startsWith('@@')) {
                    // ハンクヘッダー = ファイル修正の境界
                    stats.modifiedFiles++;
                }
            }

            // ファイル数の調整（最低1つ）
            if (stats.modifiedFiles === 0 && (stats.addedLines > 0 || stats.deletedLines > 0)) {
                stats.modifiedFiles = 1;
            }

        } catch (error) {
            this.logger.logWarning(`Failed to collect diff stats: ${error}`);
        }

        stats.processingTime = Date.now() - startTime;
        return stats;
    }

    /**
     * エラー発生時のコンテキスト情報収集
     */
    private async collectErrorContext(originalDiff: string, errorMessage: string): Promise<ErrorContext> {
        const context: ErrorContext = {
            diffPreview: '',
            affectedFiles: [],
            systemState: '',
            possibleCauses: []
        };

        try {
            // diffのプレビュー（最初の100文字）
            context.diffPreview = originalDiff.substring(0, 100) + (originalDiff.length > 100 ? '...' : '');

            // 影響を受けるファイルの特定
            const diffLines = originalDiff.split('\n');
            for (const line of diffLines) {
                if (line.startsWith('---') || line.startsWith('+++')) {
                    const filePath = line.substring(4).trim();
                    if (filePath !== '/dev/null' && !context.affectedFiles.includes(filePath)) {
                        context.affectedFiles.push(filePath);
                    }
                }
            }

            // システム状態の記録
            context.systemState = `Phase: ${this.internalProgress.currentPhase}, Turn: ${this.currentTurn}, Errors: ${this.internalProgress.errorCount}`;

            // 可能な原因の推測
            if (errorMessage.includes('ENOENT')) {
                context.possibleCauses.push('File not found - target file may not exist');
            }
            if (errorMessage.includes('EACCES')) {
                context.possibleCauses.push('Permission denied - insufficient file system permissions');
            }
            if (errorMessage.includes('diff') || errorMessage.includes('patch')) {
                context.possibleCauses.push('Invalid diff format or corrupted patch data');
            }
            if (errorMessage.includes('line')) {
                context.possibleCauses.push('Line number mismatch - file may have been modified');
            }
            if (context.possibleCauses.length === 0) {
                context.possibleCauses.push('Unknown error - check diff format and file accessibility');
            }

    } catch (error) {
        this.logger.logWarning(`Failed to collect error context: ${error}`);
    }

    return context;
    }
}

export default LLMFlowController;