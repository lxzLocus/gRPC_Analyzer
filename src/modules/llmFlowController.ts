/**
 * LLM自動応答・自動修正フローのステートマシン
 * Mermaidフロー図に基づく
*/

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// 環境変数の設定
config({ path: path.join(process.cwd(), '.env') });

import RestoreDiff from './restoreDiff.js';
import Logger from './logger.js';
import Config from './config.js';
import MessageHandler from './messageHandler.js';
import FileManager from './fileManager.js';
import OpenAIClient from './openAIClient.js';
import LLMRetryEnhancer from './llmRetryEnhancer.js';
import ConversationSummarizer from './conversationSummarizer.js';
import { CrossReferenceAnalyzer } from './crossReferenceAnalyzer.js';
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
    private retryEnhancer: LLMRetryEnhancer;
    private conversationSummarizer!: ConversationSummarizer;
    private crossReferenceAnalyzer!: CrossReferenceAnalyzer;

    // 作業用データ
    private currentMessages: Array<{ role: string, content: string }> = [];
    private prompt_template_name: string = '';
    private next_prompt_content: string | null = null;

    // ログ管理
    private currentTurn: number = 0;
    private startTime: string = '';
    private totalPromptTokens: number = 0;
    private totalCompletionTokens: number = 0;
    
    // 対話状態管理
    private correctionGoals: string = ''; // 修正目標を保持
    private initialThought: string = ''; // 初回の思考内容
    private initialPlan: string = ''; // 初回の計画内容
    private protoFileChanges: string = ''; // プロト変更内容
    
    // 処理オプション
    private enablePreVerification: boolean = true; // 事前検証を有効にするかどうか

    constructor(pullRequestPath: string, options?: { enablePreVerification?: boolean }) {
        this.inputPremergeDir = pullRequestPath;
        this.startTime = new Date().toISOString();
        
        // オプションの設定
        if (options?.enablePreVerification !== undefined) {
            this.enablePreVerification = options.enablePreVerification;
        }
        
        this.retryEnhancer = new LLMRetryEnhancer({
            maxRetries: 3,
            enableQualityCheck: true,
            requireModifiedContent: true,
            minModifiedLines: 1,
            retryDelayMs: 1000,
            exponentialBackoff: true
        }, this.config);  // Configを渡す
        
        // 🔧 パス構築デバッグ - コンストラクタレベルでのパス情報を記録
        console.log('🔧 LLMFlowController コンストラクタでのパス情報:');
        console.log(`   受け取った pullRequestPath: ${pullRequestPath}`);
        console.log(`   設定された inputPremergeDir: ${this.inputPremergeDir}`);
        
        // デバッグ情報：環境変数の確認
        console.log(`🔧 LLMFlowController initialized with path: ${pullRequestPath}`);
        console.log(`📋 Pre-verification: ${this.enablePreVerification ? 'Enabled' : 'Disabled'}`);
        console.log(`� [NEW VERSION 2025-07-31] LLMFlowController loaded`);
        console.log(`�🔑 OPENAI_API_KEY length: ${(process.env.OPENAI_API_KEY || '').length}`);
        console.log(`🔑 OPENAI_API_KEY length: ${(process.env.OPENAI_API_KEY || '').length}`);
        console.log(`🔑 GEMINI_API_KEY length: ${(process.env.GEMINI_API_KEY || '').length}`);
        console.log(`🤖 LLM_PROVIDER: ${process.env.LLM_PROVIDER || 'undefined'}`);
        console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
        console.log(`🐛 DEBUG_MODE: ${process.env.DEBUG_MODE || 'undefined'}`);
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
        if (parsed.plan && typeof parsed.plan === 'string') {
            try {
                console.log(`🔧 Converting plan to array format for logging`);
                
                // 安全なJSON解析を使用
                const planObj = this.safeParseJSON(parsed.plan, 'convertToLogFormat');
                if (Array.isArray(planObj)) {
                    planArray = planObj;
                } else {
                    // 単一のプランの場合は配列にラップ
                    planArray = [planObj];
                }
                console.log(`✅ Successfully parsed plan with ${planArray.length} items`);
            } catch (jsonError) {
                //  JSON解析エラーの詳細ログ
                console.error(`❌ JSON parse error for plan:`, {
                    error: jsonError instanceof Error ? jsonError.message : String(jsonError),
                    planLength: parsed.plan.length,
                    planPreview: parsed.plan.substring(0, 200),
                    planCharCodes: parsed.plan.substring(0, 10).split('').map(char => char.charCodeAt(0))
                });
                
                // JSON形式でない場合は文字列として配列にラップ
                planArray = [{ step: 1, action: "ANALYZE", description: parsed.plan }];
                console.log(`🔄 Fallback: Wrapped plan as string description`);
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
                    // 事前検証フラグに基づいて分岐
                    if (this.enablePreVerification) {
                        // 事前検証が有効な場合、事前検証ステップに進む
                        // TODO: 実装されていない場合は直接LLMDecisionに進む
                        console.log('📋 Pre-verification enabled, but not implemented yet - proceeding to LLMDecision');
                        this.state = State.LLMDecision;
                    } else {
                        // 事前検証が無効な場合、直接LLMDecisionに進む
                        console.log('📋 Pre-verification disabled - proceeding directly to LLMDecision');
                        this.state = State.LLMDecision;
                    }
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

                case State.SendFinalCheckToLLM:
                    await this.sendFinalCheckToLLM();
                    this.state = State.LLMFinalDecision;
                    break;

                case State.LLMFinalDecision:
                    await this.llmFinalDecision();
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
        
        // 🔧 Config 初期化後のパス情報をデバッグ
        console.log('🔧 Config 初期化後のパス情報:');
        console.log(`   this.inputPremergeDir: ${this.inputPremergeDir}`);
        console.log(`   this.config.inputProjectDir: ${this.config.inputProjectDir}`);
        
        this.fileManager = new FileManager(this.config, this.logger);
        this.messageHandler = new MessageHandler();
        this.openAIClient = new OpenAIClient(this.config); // Configインスタンスを渡す
        this.crossReferenceAnalyzer = new CrossReferenceAnalyzer(this.config.inputProjectDir);

        // OpenAIClientの初期化完了を待機
        await (this.openAIClient as any).initPromise;

        // 対話履歴要約機能を初期化
        this.conversationSummarizer = new ConversationSummarizer(
            this.config, 
            this.openAIClient, 
            () => this.correctionGoals // correctionGoalsのコールバック
        );

        // 初期プロンプト生成
        this.next_prompt_content = this.fileManager.readFirstPromptFile();
        this.prompt_template_name = this.config.promptTextfile;
        
        // ConversationSummarizer に初期メッセージを追加
        this.currentMessages = await this.sendMessageWithSummarizer("user", this.next_prompt_content);
        
        // プロト変更内容を取得して保存（事前検証で使用）
        try {
            const protoChangesFilePath = path.join(this.config.inputProjectDir, '02_protoFileChanges.txt');
            if (fs.existsSync(protoChangesFilePath)) {
                this.protoFileChanges = fs.readFileSync(protoChangesFilePath, 'utf-8');
            }
        } catch (error) {
            console.warn('⚠️ Could not read proto file changes:', error);
        }
    }

    // =============================================================================
    // LLM通信フェーズ
    // =============================================================================

    private async sendInitialInfoToLLM() {
        // LLMへ初期情報送信（品質チェック付きリトライ対応）
        const llm_response = await this.sendLLMWithQualityCheck('initial');
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
        const previousThought = parsed?.thought || '';
        const previousPlan = parsed?.plan || '';
        const promptReply = this.config.readPromptReplyFile(
            filesRequested, 
            modifiedDiff, 
            commentText, 
            previousThought, 
            previousPlan,
            this.correctionGoals // correctionGoals
        );
        this.currentMessages = await this.sendMessageWithSummarizer("user", promptReply);
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
        
        // Phase 3-3: LLM応答解析のパフォーマンス監視と詳細ログ
        try {
            this.context.llmParsed = await this.executeWithPerformanceMonitoring(
                'LLM_Response_Analysis',
                async () => this.messageHandler.analyzeMessages(llm_content)
            );

            // 初回の思考と計画を保存（事前検証で使用）
            if (this.context.llmParsed.thought) {
                this.initialThought = this.context.llmParsed.thought;
            }
            if (this.context.llmParsed.plan) {
                this.initialPlan = this.context.llmParsed.plan;
            }
            if (this.context.llmParsed.correctionGoals && !this.correctionGoals) {
                this.correctionGoals = this.context.llmParsed.correctionGoals;
            }

        } catch (error) {
            // 解析エラーの詳細ログ
            this.logger.logLLMParsingError(
                llm_content,
                'initial_analysis',
                'Valid LLM response with proper tags',
                'Invalid or malformed response',
                error instanceof Error ? error : undefined
            );
            throw error;
        }
    }

    private async llmReanalyze() {
        // LLM: 新情報を元に再分析・計画更新
        if (!this.context.llmResponse?.choices?.[0]?.message?.content) {
            this.state = State.End;
            return;
        }
        const content = this.context.llmResponse.choices[0].message.content;
        
        // Phase 3-3: 再解析時の詳細ログとパフォーマンス監視
        try {
            this.context.llmParsed = await this.executeWithPerformanceMonitoring(
                'LLM_Response_Reanalysis',
                async () => this.messageHandler.analyzeMessages(content)
            );
        } catch (error) {
            this.logger.logLLMParsingError(
                content,
                'reanalysis',
                'Valid LLM response with updated information',
                'Failed to parse updated response',
                error instanceof Error ? error : undefined
            );
            this.state = State.End;
            return;
        }
    }

    private async llmDecision() {
        // LLMの判断
        // context.llmParsedの内容に応じて分岐
        const parsed = this.context.llmParsed;
        if (!parsed) {
            this.state = State.End;
            return;
        }

        // 早期終了の防止: 最低限の処理フローを保証
        const hasProcessedFiles = this.internalProgress.contextAccumulated.sourceFiles.length > 0;
        const hasGeneratedDiff = this.currentTurn >= 2; // 最低2ターンは実行

        if (parsed.has_fin_tag && hasProcessedFiles && hasGeneratedDiff) {
            // タスク完了(ただし最低限の処理が完了している場合のみ)
            console.log('📋 Task completion confirmed after proper processing flow');
            this.state = State.End;
        } else if (parsed.requiredFilepaths && parsed.requiredFilepaths.length > 0) {
            // 追加情報要求
            this.state = State.SystemAnalyzeRequest;
        } else if (parsed.modifiedDiff && parsed.modifiedDiff.length > 0) {
            // 修正案(diff)生成
            this.state = State.SystemParseDiff;
        } else if (!hasProcessedFiles && this.currentTurn <= 3) {
            // 初回または2回目で、まだファイル処理していない場合は情報要求を強制
            console.log('📋 Forcing file content analysis to prevent early termination');
            // プロト関連ファイルのデフォルト要求を生成
            if (this.context.llmParsed) {
                this.context.llmParsed.requiredFilepaths = this.generateDefaultFileRequests();
                this.state = State.SystemAnalyzeRequest;
            } else {
                this.state = State.End;
            }
        } else {
            // その他(最低限の処理完了後のみ終了)
            console.log('📋 Ending after processing flow completion');
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
        
        // correctionGoalsが初回で設定された場合、保存する
        if (this.context.llmParsed.correctionGoals && !this.correctionGoals) {
            this.correctionGoals = this.context.llmParsed.correctionGoals;
            console.log('📋 Correction Goals extracted and saved from llmNextStep:', this.correctionGoals.substring(0, 200) + '...');
        }

        // ready_for_final_checkフラグのチェック
        if (this.context.llmParsed.ready_for_final_check) {
            console.log('✅ LLM indicated ready for final check, transitioning to final verification');
            this.state = State.SendFinalCheckToLLM;
            return;
        }
    }

    private async sendFinalCheckToLLM() {        // 最終確認プロンプトを送信
        const parsed = this.context.llmParsed;
        if (!parsed) {
            this.state = State.End;
            return;
        }

        // 検証レポートのサマリーを作成
        const verificationSummary = this.extractVerificationSummary(parsed);
        const modifiedFilesStatus = this.context.diff || 'No files modified';

        const finalCheckPrompt = this.config.readPromptFinalCheckFile(
            verificationSummary,
            modifiedFilesStatus
        );

        this.currentMessages = await this.sendMessageWithSummarizer("user", finalCheckPrompt);
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
                prompt_template: '00_promptFinalCheck.txt',
                full_prompt_content: finalCheckPrompt
            },
            {
                raw_content: llm_response?.choices?.[0]?.message?.content || '',
                parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                usage: usage
            },
            {
                type: 'FINAL_CHECK',
                details: 'Sending final verification prompt to LLM'
            }
        );
    }

    private async llmFinalDecision() {
        // 最終判断の解析
        if (!this.context.llmResponse?.choices?.[0]?.message?.content) {
            this.state = State.End;
            return;
        }
        
        const content = this.context.llmResponse.choices[0].message.content;
        this.context.llmParsed = this.messageHandler.analyzeMessages(content);

        // LLMの最終判断を解析
        if (this.context.llmParsed.has_fin_tag) {
            console.log('✅ LLM confirmed completion with %%_Fin_%% tag');
            this.state = State.End;
        } else if (this.context.llmParsed.modifiedDiff) {
            console.log('🔄 LLM provided additional modifications, applying patch');
            this.context.diff = this.context.llmParsed.modifiedDiff;
            this.state = State.SystemParseDiff;
        } else {
            console.log('⚠️ Unexpected response in final decision, ending');
            this.state = State.End;
        }
    }

    /**
     * 検証レポートからサマリーを抽出
     */
    private extractVerificationSummary(parsed: any): string {
        // thought から検証レポートを探す
        const thought = parsed.thought || '';
        
        // 検証レポートっぽい内容を抽出
        const lines = thought.split('\n');
        let summary = '';
        let inVerificationSection = false;
        
        for (const line of lines) {
            if (line.includes('Verification') || line.includes('verification') || 
                line.includes('What\'s Missing') || line.includes('What\'s the Risk')) {
                inVerificationSection = true;
            }
            
            if (inVerificationSection) {
                summary += line + '\n';
            }
        }
        
        if (!summary.trim()) {
            summary = 'Previous verification report indicated all goals were achieved.';
        }
        
        return summary.trim();
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
                    // Phase 3-3: ファイル操作のパフォーマンス監視
                    const result = await this.executeWithPerformanceMonitoring(
                        'File_Content_Retrieval',
                        async () => this.fileManager.getFileContents(fileContentInfos)
                    );
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
            
            // diff適用前のデバッグログ
            this.logger.logInfo(`Diff content preview: ${parsed.modifiedDiff.substring(0, 200)}...`);
            this.logger.logInfo(`Project directory: ${this.config.inputProjectDir}`);
            
            const restoredContent = restoreDiff.applyDiff(parsed.modifiedDiff);
            
            // 復元内容のデバッグログ
            this.logger.logInfo(`Restored content length: ${restoredContent?.length || 0}`);
            if (restoredContent && restoredContent.length > 0) {
                this.logger.logInfo(`Restored content preview: ${restoredContent.substring(0, 200)}...`);
            } else {
                this.logger.logError("RestoreDiff returned empty content");
                this.logger.logError(`Original diff: ${parsed.modifiedDiff}`);
            }
            
            // Phase 3-2 新機能: 適用結果の詳細検証
            const validationResult = await this.validateDiffApplication(restoredContent, parsed.modifiedDiff);
            
            if (!validationResult.isValid) {
                throw new Error(`Diff validation failed: ${validationResult.errors.join(', ')}`);
            }

            // 警告がある場合はログに記録
            if (validationResult.warnings.length > 0) {
                this.logger.logWarning(`Diff validation warnings: ${validationResult.warnings.join(', ')}`);
            }

            // 空のコンテンツでも処理を続行（警告のみ）
            let finalContent = restoredContent;
            if (!finalContent || finalContent.length === 0) {
                this.logger.logWarning("Restored content is empty, using original diff as fallback");
                finalContent = `# Original Diff Content\n${parsed.modifiedDiff}`;
            }

            // 結果をファイルに保存
            const tmpDiffRestorePath = path.join(this.config.outputDir, 'tmp_restoredDiff.txt');
            fs.writeFileSync(tmpDiffRestorePath, finalContent, 'utf-8');
            
            // contextに保存
            this.context.diff = finalContent;
            this.context.error = undefined;

            // Phase 3-2 新機能: 適用統計の記録
            const stats = await this.collectDiffApplicationStats(finalContent, parsed.modifiedDiff);
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
            const diffError = e instanceof Error ? e : new Error(errorMessage);
            
            // Phase 3-2 新機能: エラー時の詳細情報収集
            const detailedErrorContext = await this.collectErrorContext(parsed.modifiedDiff, errorMessage);
            
            // Phase 3-3 新機能: 詳細なdiff適用エラーログ
            const affectedFiles = this.extractAffectedFilesFromDiff(parsed.modifiedDiff);
            this.logger.logDiffApplicationError(
                diffError,
                parsed.modifiedDiff,
                affectedFiles,
                detailedErrorContext
            );
            
            this.logger.logError("Error applying diff", diffError);
            
            this.context.error = {
                message: errorMessage,
                errorContext: detailedErrorContext,
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
        const parsed = this.context.llmParsed;
        const currentPlan = parsed?.plan || '';
        const currentThought = parsed?.thought || '';
        
        // プラン進行状況を解析
        const planProgress = this.analyzePlanProgress(currentPlan);
        const enhancedPlan = planProgress.planWithProgress;
        
        // ログで進行状況を出力
        this.logger.logInfo(`Plan Progress: ${planProgress.progressPercentage}% (${planProgress.completedSteps.length}/${planProgress.totalSteps} steps)`);
        if (planProgress.currentStep) {
            this.logger.logInfo(`Current Step: ${planProgress.currentStep}`);
        }

        // 相互参照コンテキストを生成
        let crossReferenceContext = '';
        try {
            if (modifiedFiles) {
                const modifiedFilePaths = this.extractFilePaths(modifiedFiles);
                for (const filePath of modifiedFilePaths) {
                    const fullPath = path.resolve(this.config.inputProjectDir, filePath);
                    if (fs.existsSync(fullPath)) {
                        const fileContent = fs.readFileSync(fullPath, 'utf-8');
                        const snippets = await this.crossReferenceAnalyzer.findCrossReferences(fullPath, fileContent);
                        if (snippets.length > 0) {
                            crossReferenceContext += this.crossReferenceAnalyzer.formatCrossReferenceContext(snippets);
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.logError(`Failed to generate cross-reference context: ${error}`);
            crossReferenceContext = 'Cross-reference analysis failed. Proceeding without additional context.';
        }
        
        const promptModified = this.config.readPromptModifiedEnhancedFile(
            modifiedFiles, 
            enhancedPlan, 
            currentThought,
            '', // filesRequested (必要に応じて設定)
            '', // previousModifications (必要に応じて設定)
            '', // previousThought (必要に応じて設定)
            '', // previousPlan (必要に応じて設定)
            this.correctionGoals, // correctionGoals
            crossReferenceContext // crossReferenceContext
        );
        
        this.currentMessages = await this.sendMessageWithSummarizer("user", promptModified);
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
                prompt_template: '00_promptModified_enhanced.txt',
                full_prompt_content: promptModified
            },
            {
                raw_content: llm_response?.choices?.[0]?.message?.content || '',
                parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                usage: usage
            },
            {
                type: 'APPLYING_DIFF_AND_RECHECKING_ENHANCED',
                details: 'Diff applied successfully. Preparing for enhanced re-check with cross-reference context.'
            }
        );
    }

    private async sendErrorToLLM() {
        // エラー情報をLLMへ送信
        const errorMessage = this.context.error || 'Unknown error occurred';
        const errorPrompt = `エラーが発生しました: ${errorMessage}\n\n修正案を再検討してください。`;
        this.currentMessages = await this.sendMessageWithSummarizer("user", errorPrompt);
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
        
        // 基本的なステータス判定
        let status = this.context.llmParsed?.has_fin_tag ? 'Completed (%%_Fin_%%)' : 'Incomplete';
        
        // 後処理による完了判定ロジック（安全策）
        if (status === 'Incomplete' && !this.context.llmParsed?.has_fin_tag) {
            // ログ内に一度でも%_Modified_%が存在した場合の暗黙的完了判定
            const hasModification = this.logger.getInteractionLog().some((turn: any) => 
                turn.llm_response?.parsed_content?.modified_diff || 
                turn.llm_response?.raw_content?.includes('%_Modified_%')
            );
            
            if (hasModification) {
                status = 'Completed (Implicit)'; // 暗黙的な完了としてステータスを更新
                console.log(`✅ Status updated to 'Completed (Implicit)' based on post-processing logic.`);
                console.log(`   Reason: Found %_Modified_% tag without explicit %%_Fin_%% tag`);
            }
        }
        
        // LLMプロバイダー情報を取得（Configクラスから）
        const llmProvider = this.config.get('llm.provider', 'openai');
        const llmModel = this.getCurrentLLMModel();
        const llmConfig = this.getLLMConfig();

        // 要約機能の統計を出力
        let summaryTokensUsed = 0;
        if (this.conversationSummarizer) {
            const summaryStats = this.conversationSummarizer.getStats();
            summaryTokensUsed = summaryStats.summaryTokensUsed || 0;
            console.log('\n📊 Conversation Summarization Stats:');
            console.log(`   Total Messages: ${summaryStats.totalMessages}`);
            console.log(`   Estimated Tokens: ${summaryStats.estimatedTokens}`);
            console.log(`   Summary Threshold: ${summaryStats.summaryThreshold}`);
            console.log(`   Times Summarized: ${summaryStats.timesExceededThreshold}`);
            console.log(`   Last Summary Turn: ${summaryStats.lastSummaryTurn}`);
            console.log(`   Summary Tokens Used: ${summaryTokensUsed} tokens`);
        }
        
        this.logger.setExperimentMetadata(
            experimentId,
            this.startTime,
            endTime,
            status,
            this.currentTurn,
            this.totalPromptTokens,
            this.totalCompletionTokens,
            llmProvider,
            llmModel,
            llmConfig,
            summaryTokensUsed // 要約トークン数を渡す
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
            
            // 🔧 パス構築デバッグ情報をログ出力
            console.log('🔍 APRログパス構築デバッグ情報:');
            console.log(`   入力ディレクトリ: ${inputDir}`);
            console.log(`   パス分割結果: ${JSON.stringify(parts)}`);
            console.log(`   抽出されたプロジェクト名: ${projectName}`);
            console.log(`   抽出されたカテゴリ: ${category}`);
            console.log(`   抽出されたPR名: ${pullRequestName}`);

            // JST（日本標準時）でのログファイル名を生成
            const now = new Date();
            const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9 for JST
            const year = jstDate.getUTCFullYear();
            const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(jstDate.getUTCDate()).padStart(2, '0');
            const hour = String(jstDate.getUTCHours()).padStart(2, '0');
            const minute = String(jstDate.getUTCMinutes()).padStart(2, '0');
            const second = String(jstDate.getUTCSeconds()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}_${hour}-${minute}-${second}_JST`;
            
            const logDir = path.join('/app/log', projectName, category, pullRequestName);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            const logPath = path.join(logDir, `${dateStr}.log`);
            
            // 🔧 APRログ最終保存パス情報をログ出力
            console.log('📁 APRログ最終保存パス情報:');
            console.log(`   ログディレクトリ: ${logDir}`);
            console.log(`   ログファイルパス: ${logPath}`);

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
            this.logger.logInfo(`Validating diff application: content length ${restoredContent?.length || 0}, diff length ${originalDiff?.length || 0}`);

            // diffの形式チェック
            if (!originalDiff || originalDiff.trim().length === 0) {
                result.warnings.push("Original diff is empty or invalid");
                result.isValid = true; // 空のdiffは有効とみなす
                return result;
            }

            const diffLines = originalDiff.split('\n');
            let addedLines = 0;
            let deletedLines = 0;
            let contextLines = 0;
            let hasFileHeaders = false;

            for (const line of diffLines) {
                if (line.startsWith('---') || line.startsWith('+++')) {
                    hasFileHeaders = true;
                } else if (line.startsWith('+') && !line.startsWith('+++')) {
                    addedLines++;
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    deletedLines++;
                } else if (line.startsWith(' ')) {
                    contextLines++;
                }
            }

            result.appliedChanges = addedLines + deletedLines;

            // 改善されたコンテンツ検証
            if (!restoredContent || restoredContent.length === 0) {
                if (hasFileHeaders && (addedLines > 0 || deletedLines > 0)) {
                    // diff があるのにコンテンツが空の場合は警告だが、続行可能
                    result.warnings.push("Restored content is empty despite having diff changes");
                    this.logger.logWarning("Empty restored content but diff has changes - this may indicate diff processing issues");
                } else {
                    // diffも内容もない場合は正常
                    result.warnings.push("No changes to apply - diff and content are both empty");
                }
                // 空のコンテンツでも isValid = true として続行
            } else {
                this.logger.logInfo(`Restored content successfully validated: ${restoredContent.length} characters`);
            }

            // 警告チェック - より実用的な基準に調整
            if (addedLines === 0 && deletedLines === 0) {
                result.warnings.push("No actual changes detected in diff");
            }

            // コンテキストライン不足の判定を緩和
            // 小規模な変更（5行以下）では警告しない
            const totalChanges = addedLines + deletedLines;
            if (contextLines < 2 && totalChanges > 5) {
                result.warnings.push("Very few context lines in diff - may affect accuracy");
            } else if (contextLines === 0 && totalChanges > 0) {
                result.warnings.push("No context lines in diff - this may indicate incomplete diff");
            }

            // 復元内容の基本チェック（空でない場合のみ）
            if (restoredContent && restoredContent.length > 0) {
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
            }

        } catch (error) {
            result.errors.push(`Validation error: ${error}`);
            result.isValid = false;
        }

        // ログ出力
        if (result.warnings.length > 0) {
            this.logger.logWarning(`Diff validation warnings: ${result.warnings.join(', ')}`);
        }
        if (result.errors.length > 0) {
            this.logger.logError(`Diff validation errors: ${result.errors.join(', ')}`);
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

    // =============================================================================
    // Phase 3-3: 詳細エラーログ用ヘルパーメソッド
    // =============================================================================

    /**
     * diffから影響を受けるファイルのリストを抽出
     */
    private extractAffectedFilesFromDiff(diffContent: string): string[] {
        const files: string[] = [];
        if (!diffContent) return files;

        const lines = diffContent.split('\n');
        for (const line of lines) {
            if (line.startsWith('---') || line.startsWith('+++')) {
                // "--- a/path/to/file" または "+++ b/path/to/file" の形式から抽出
                const match = line.match(/^[+-]{3}\s+[ab]\/(.+)$/);
                if (match && match[1] !== '/dev/null') {
                    const filePath = match[1];
                    if (!files.includes(filePath)) {
                        files.push(filePath);
                    }
                }
            }
        }
        return files;
    }

    /**
     * パフォーマンス監視付きの処理実行
     */
    private async executeWithPerformanceMonitoring<T>(
        operationName: string,
        operation: () => Promise<T>
    ): Promise<T> {
        const timerId = this.logger.startPerformanceTimer(operationName);
        try {
            const result = await operation();
            this.logger.endPerformanceTimer(timerId);
            return result;
        } catch (error) {
            this.logger.endPerformanceTimer(timerId);
            throw error;
        }
    }

    // =============================================================================
    // プラン進行状況追跡
    // =============================================================================

    /**
     * プランの進行状況を解析して、どのステップが完了し、どのステップが残っているかを判定
     */
    private analyzePlanProgress(currentPlan: string): {
        totalSteps: number;
        completedSteps: string[];
        remainingSteps: string[];
        currentStep: string | null;
        progressPercentage: number;
        planWithProgress: string;
    } {
        const result = {
            totalSteps: 0,
            completedSteps: [] as string[],
            remainingSteps: [] as string[],
            currentStep: null as string | null,
            progressPercentage: 0,
            planWithProgress: currentPlan
        };

        if (!currentPlan || currentPlan.trim().length === 0) {
            return result;
        }

        try {
            console.log(`🔧 Analyzing plan progress`);
            
            // 安全なJSON解析を使用
            const planObj = this.safeParseJSON(currentPlan, 'analyzePlanProgress');
            if (Array.isArray(planObj)) {
                result.totalSteps = planObj.length;
                
                // 完了済みステップの特定（内部進行状況から判定）
                const completedActions = this.internalProgress.stepsCompleted;
                
                for (let i = 0; i < planObj.length; i++) {
                    const step = planObj[i];
                    const stepDescription = `${step.action}: ${step.filePath || step.reason || ''}`;
                    
                    // ステップが完了しているかチェック
                    const isCompleted = this.isStepCompleted(step, completedActions);
                    
                    if (isCompleted) {
                        result.completedSteps.push(stepDescription);
                    } else {
                        result.remainingSteps.push(stepDescription);
                        if (result.currentStep === null) {
                            result.currentStep = stepDescription;
                        }
                    }
                }
                
                result.progressPercentage = result.totalSteps > 0 ? 
                    Math.round((result.completedSteps.length / result.totalSteps) * 100) : 0;
                
                // 進行状況付きプランを生成
                result.planWithProgress = this.generateProgressPlan(planObj, result.completedSteps);
            }
        } catch (jsonError) {
            // JSON解析エラーの詳細ログ
            console.error(`❌ Plan progress analysis JSON parse error:`, {
                error: jsonError instanceof Error ? jsonError.message : String(jsonError),
                planLength: currentPlan.length,
                planPreview: currentPlan.substring(0, 200),
                planCharCodes: currentPlan.substring(0, 10).split('').map(char => char.charCodeAt(0))
            });
            
            // JSONでない場合は文字列として処理
            const lines = currentPlan.split('\n').filter(line => line.trim());
            result.totalSteps = lines.length;
            result.remainingSteps = lines;
            result.planWithProgress = currentPlan;
            
            console.log(`🔄 Plan progress fallback: processed as ${lines.length} text lines`);
        }

        return result;
    }

    /**
     * ステップが完了しているかを判定
     */
    private isStepCompleted(step: any, completedActions: string[]): boolean {
        if (!step.action) return false;
        
        // アクション別の完了判定
        switch (step.action) {
            case 'REVIEW_FILE_CONTENT':
            case 'REQUEST_FILE_CONTENT':
                // ファイル要求/レビューは、該当ファイルが処理済みかチェック
                return this.internalProgress.contextAccumulated.sourceFiles.includes(step.filePath) ||
                       this.internalProgress.contextAccumulated.configFiles.includes(step.filePath) ||
                       this.internalProgress.contextAccumulated.protoFiles.includes(step.filePath) ||
                       this.internalProgress.contextAccumulated.testFiles.includes(step.filePath);
            
            case 'MODIFY_FILE':
                // ファイル修正は、diffが適用されているかチェック
                return completedActions.includes('DIFF_APPLIED') || 
                       completedActions.includes(`MODIFIED_${step.filePath}`);
            
            case 'VERIFY_CHANGES':
                // 検証は、検証完了フラグをチェック
                return completedActions.includes('VERIFICATION_COMPLETED');
            
            default:
                // その他のアクションは、直接的な一致をチェック
                return completedActions.includes(step.action);
        }
    }

    /**
     * 進行状況を含むプランを生成
     */
    private generateProgressPlan(planArray: any[], completedSteps: string[]): string {
        const enhancedPlan = planArray.map((step, index) => {
            const stepDescription = `${step.action}: ${step.filePath || step.reason || ''}`;
            const isCompleted = completedSteps.includes(stepDescription);
            const status = isCompleted ? '✅' : '⏳';
            
            return {
                ...step,
                step: index + 1,
                status: status,
                completed: isCompleted
            };
        });
        
        return JSON.stringify(enhancedPlan, null, 2);
    }

    // =============================================================================
    // プレーンテキストの指示文判定ヘルパーメソッド
    // =============================================================================

    /**
     * プレーンテキストの指示文かどうかを判定するヘルパーメソッド
     */
    private looksLikePlainTextInstruction(text: string): boolean {
        if (!text || text.trim().length === 0) {
            return false;
        }

        const trimmed = text.trim();
        
        // 番号付きリストパターン
        const isNumberedList = /^\s*\d+\.\s*/.test(trimmed);
        
        // 箇条書きリストパターン
        const isBulletList = /^\s*[-*•]\s*/.test(trimmed);
        
        // JSON構造の存在チェック
        const hasJSONStructure = /[\[\{]/.test(trimmed) && /[\]\}]/.test(trimmed);
        
        // プレーンテキストの指示特有のパターン
        const hasInstructionKeywords = /\b(review|check|assess|modify|update|ensure|verify)\b/i.test(trimmed);
        
        // ファイルパス参照パターン
        const hasFileReferences = /`[^`]*\.(go|ts|js|proto|json|yaml|yml|txt|md)`/.test(trimmed);
        
        return (isNumberedList || isBulletList || hasInstructionKeywords || hasFileReferences) && !hasJSONStructure;
    }

    // =============================================================================
    // JSON解析ヘルパーメソッド
    // =============================================================================

    /**
     * 安全にJSONを解析するヘルパーメソッド
     * 一般的なJSONエラーを自動修復する
     */
    private safeParseJSON(jsonString: string, context: string = 'unknown'): any {
        if (!jsonString || typeof jsonString !== 'string') {
            throw new Error(`Invalid input for JSON parsing in ${context}`);
        }

        // プレーンテキストの指示リストかチェック（JSON解析の前に実行）
        const trimmed = jsonString.trim();
        const isNumberedList = /^\s*\d+\.\s*/.test(trimmed);
        const isBulletList = /^\s*[-*•]\s*/.test(trimmed);
        
        // より精密なJSON構造チェック - 実際にJSONとして開始されているかを確認
        const startsWithJsonStructure = /^\s*[\[\{]/.test(trimmed);
        const endsWithJsonStructure = /[\]\}]\s*$/.test(trimmed);
        const hasJsonBlockStart = /```json\s*\n\s*[\[\{]/.test(trimmed);
        
        // プレーンテキスト指示の特徴をチェック
        const hasInstructionKeywords = /\b(inspect|check|review|verify|ensure|update|modify)\b/i.test(trimmed);
        const hasFileReferences = /`[^`]*\.(go|ts|js|proto|json|yaml|yml|txt|md)`/.test(trimmed);
        
        // 混合コンテンツの判定：プレーンテキスト + JSONコードブロック
        const isMixedContent = (isNumberedList || isBulletList) && hasJsonBlockStart;
        
        if ((isNumberedList || isBulletList) && (!startsWithJsonStructure || isMixedContent)) {
            console.log(`🔧 Detected plain text instruction list in ${context}, returning as string`);
            console.log(`📋 List content preview: ${trimmed.substring(0, 200)}...`);
            console.log(`📋 List type: ${isNumberedList ? 'numbered' : 'bullet'}`);
            console.log(`📋 Mixed content: ${isMixedContent ? 'yes' : 'no'}`);
            console.log(`📋 Has instruction keywords: ${hasInstructionKeywords ? 'yes' : 'no'}`);
            console.log(`📋 Has file references: ${hasFileReferences ? 'yes' : 'no'}`);
            return trimmed; // プレーンテキストとして返す
        }

        // 段階的なクリーンアップ処理
        const cleanupSteps = [
            // ステップ1: 徹底的な文字クリーンアップ
            (str: string) => {
                let cleaned = str.trim();
                
                // 見えない制御文字、特殊空白文字の徹底除去
                cleaned = cleaned
                    .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅文字
                    .replace(/[\u0000-\u001F\u007F-\u009F]/g, (match) => {
                        const code = match.charCodeAt(0);
                        if (code === 9 || code === 10 || code === 13) { // タブ、改行、復帰
                            return ' ';
                        }
                        console.log(`🧹 Step1: Removing control character: charCode ${code}`);
                        return '';
                    })
                    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // 特殊空白を通常空白に
                    .replace(/[\u2028\u2029]/g, ' ') // ライン・パラグラフ区切り文字
                    .replace(/[\uFFF0-\uFFFF]/g, '') // 特殊用途文字
                    .replace(/\s+/g, ' ') // 連続する空白を単一のスペースに統合
                    .trim();
                
                console.log(`🧹 Step1: Thorough character cleanup completed, length: ${str.length} → ${cleaned.length}`);
                return cleaned;
            },
            
            // ステップ2: バッククォートで囲まれた文字列の処理
            (str: string) => {
                // バッククォートで囲まれた文字列を検出
                const backtickMatch = str.match(/^`([\s\S]*)`$/);
                if (backtickMatch) {
                    const content = backtickMatch[1].trim();
                    console.log(`🔧 Detected backtick-wrapped content in ${context}`);
                    
                    // より厳密なJSON構造チェック
                    const hasJsonStructure = this.isValidJsonStructure(content);
                    
                    if (hasJsonStructure) {
                        console.log(`🔄 Backtick content contains valid JSON structure`);
                        // JSONとして直接処理
                        return content;
                    } else {
                        console.log(`🔄 Backtick content is plain text, treating as string literal`);
                        // プレーンテキストとして適切なJSON文字列に変換
                        return JSON.stringify(content);
                    }
                }
                return str;
            },
            
            // ステップ3: YAML風リスト形式と混合コンテンツのクリーンアップ
            (str: string) => {
                let cleaned = str;
                
                // YAML風リスト形式の検出と変換（新機能）
                const yamlListPattern = /^(\s*-\s*\{[\s\S]*?\}\s*)+$/;
                if (yamlListPattern.test(cleaned.trim())) {
                    console.log(`🔄 Detected YAML-style list format in ${context}, converting to JSON array`);
                    try {
                        const lines = cleaned.trim().split('\n');
                        const jsonObjects = [];
                        
                        for (const line of lines) {
                            const trimmedLine = line.trim();
                            if (trimmedLine.startsWith('- {') && trimmedLine.endsWith('}')) {
                                // "- {" を除去してJSONオブジェクトを抽出
                                const jsonPart = trimmedLine.substring(2).trim();
                                try {
                                    const parsed = JSON.parse(jsonPart);
                                    jsonObjects.push(parsed);
                                } catch (lineError) {
                                    console.log(`❌ Failed to parse line: ${trimmedLine}, error: ${lineError}`);
                                }
                            }
                        }
                        
                        if (jsonObjects.length > 0) {
                            let jsonArray = JSON.stringify(jsonObjects);
                            
                            // 末尾カンマをチェックして除去（追加の安全策）
                            jsonArray = jsonArray.replace(/,(\s*[\]\}])/g, '$1');
                            
                            console.log(`✅ Converted YAML-style list to JSON array with ${jsonObjects.length} items`);
                            console.log(`🔄 Result: ${jsonArray.substring(0, 100)}...`);
                            return jsonArray;
                        }
                    } catch (yamlError) {
                        console.log(`❌ YAML-style list conversion failed: ${yamlError}`);
                    }
                }
                
                // 混合コンテンツのパターンを検出し、クリーンアップ
                
                // パターン0: プレーンテキスト指示 + JSONコードブロック（新しいパターン）
                const textWithJsonBlockPattern = /^(\d+\.\s*\*\*[^`]*```json\s*\n?)([\[\{][\s\S]*?[\]\}])(\s*```.*)?$/m;
                const textWithJsonMatch = cleaned.match(textWithJsonBlockPattern);
                if (textWithJsonMatch) {
                    console.log(`🔄 Detected plain text instruction with JSON code block in ${context}, extracting JSON part`);
                    console.log(`📋 Plain text part: "${textWithJsonMatch[1].substring(0, 100)}..."`);
                    console.log(`📋 JSON part: "${textWithJsonMatch[2].substring(0, 100)}..."`);
                    cleaned = textWithJsonMatch[2]; // JSON部分のみを抽出
                }
                
                // パターン1: JSON配列の後に続くテキストやリスト項目を削除
                const mixedPattern1 = /(\[[\s\S]*?\])\s*[-•*]\s*[^\[{]*$/;
                const mixedMatch1 = cleaned.match(mixedPattern1);
                if (mixedMatch1) {
                    console.log(`🔄 Detected mixed content (JSON + bullet list) in ${context}, extracting JSON part`);
                    cleaned = mixedMatch1[1];
                }
                
                // パターン2: 複数のJSON配列が改行で区切られている場合
                const multiJsonPattern = /(\[[\s\S]*?\])\s*\n\s*(\[[\s\S]*?\])/;
                const multiJsonMatch = cleaned.match(multiJsonPattern);
                if (multiJsonMatch) {
                    console.log(`🔄 Detected multiple JSON arrays separated by newlines in ${context}`);
                    try {
                        const array1 = JSON.parse(multiJsonMatch[1]);
                        const array2 = JSON.parse(multiJsonMatch[2]);
                        const merged = [...array1, ...array2];
                        cleaned = JSON.stringify(merged);
                        console.log(`🔄 Merged arrays: ${array1.length} + ${array2.length} = ${merged.length} items`);
                    } catch (e) {
                        console.log(`❌ Failed to merge arrays, using first one: ${e}`);
                        cleaned = multiJsonMatch[1];
                    }
                }
                
                // パターン3: JSON配列の後に続くプレーンテキストを削除
                const jsonWithTextPattern = /(\[[\s\S]*?\])\s*[\r\n]+\s*[-•*]?\s*[A-Za-z].*$/;
                const jsonWithTextMatch = cleaned.match(jsonWithTextPattern);
                if (jsonWithTextMatch) {
                    console.log(`🔄 Detected JSON followed by plain text in ${context}, extracting JSON part`);
                    cleaned = jsonWithTextMatch[1];
                }
                
                return cleaned;
            },
            
            // ステップ4: JSON境界の検出と抽出
            (str: string) => {
                // 先頭の空白を削除してから判定
                const trimmed = str.trim();
                
                // 複数のJSON配列が混在している場合の処理
                const jsonArrayMatches = trimmed.match(/\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/g);
                if (jsonArrayMatches && jsonArrayMatches.length > 1) {
                    console.log(`🔄 Detected multiple JSON arrays in ${context}, merging them`);
                    try {
                        // 複数のJSONを配列として結合
                        const parsedArrays = jsonArrayMatches.map(match => JSON.parse(match));
                        const mergedArray = parsedArrays.flat(); // 配列を平坦化
                        console.log(`🔄 Merged ${jsonArrayMatches.length} JSON arrays into one with ${mergedArray.length} items`);
                        return JSON.stringify(mergedArray);
                    } catch (mergeError) {
                        console.log(`❌ Failed to merge multiple JSON arrays: ${mergeError}`);
                        // 最初の有効なJSONを使用
                        return jsonArrayMatches[0];
                    }
                }
                
                // 単一のJSON配列またはオブジェクトの開始/終了を検出
                const arrayMatch = trimmed.match(/^\[[\s\S]*?\](?=\s*(?:\[|$))/);
                const objectMatch = trimmed.match(/^\{[\s\S]*?\}(?=\s*(?:\{|$))/);
                
                if (arrayMatch) {
                    console.log(`🔄 Detected JSON array in ${context}`);
                    let cleanedArray = arrayMatch[0];
                    // 末尾カンマを事前に除去
                    cleanedArray = cleanedArray.replace(/,(\s*[\]\}])/g, '$1');
                    return cleanedArray;
                }
                if (objectMatch) {
                    console.log(`🔄 Detected JSON object in ${context}`);
                    let cleanedObject = objectMatch[0];
                    // 末尾カンマを事前に除去
                    cleanedObject = cleanedObject.replace(/,(\s*[\]\}])/g, '$1');
                    return cleanedObject;
                }
                
                // より精密なJSON抽出を試行（ブラケットカウンティング）
                if (trimmed.includes('[') && trimmed.includes(']')) {
                    let startIdx = trimmed.indexOf('[');
                    let bracketCount = 0;
                    let inString = false;
                    let escapeNext = false;
                    let endIdx = -1;
                    
                    for (let i = startIdx; i < trimmed.length; i++) {
                        const char = trimmed[i];
                        
                        if (escapeNext) {
                            escapeNext = false;
                            continue;
                        }
                        
                        if (char === '\\' && inString) {
                            escapeNext = true;
                            continue;
                        }
                        
                        if (char === '"' && !escapeNext) {
                            inString = !inString;
                            continue;
                        }
                        
                        if (!inString) {
                            if (char === '[') {
                                bracketCount++;
                            } else if (char === ']') {
                                bracketCount--;
                                if (bracketCount === 0) {
                                    endIdx = i + 1;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (endIdx > startIdx) {
                        const extracted = trimmed.substring(startIdx, endIdx);
                        console.log(`🔄 Extracted JSON array using bracket counting in ${context}`);
                        return extracted;
                    }
                }
                
                if (trimmed.includes('{') && trimmed.includes('}')) {
                    let startIdx = trimmed.indexOf('{');
                    let braceCount = 0;
                    let inString = false;
                    let escapeNext = false;
                    let endIdx = -1;
                    
                    for (let i = startIdx; i < trimmed.length; i++) {
                        const char = trimmed[i];
                        
                        if (escapeNext) {
                            escapeNext = false;
                            continue;
                        }
                        
                        if (char === '\\' && inString) {
                            escapeNext = true;
                            continue;
                        }
                        
                        if (char === '"' && !escapeNext) {
                            inString = !inString;
                            continue;
                        }
                        
                        if (!inString) {
                            if (char === '{') {
                                braceCount++;
                            } else if (char === '}') {
                                braceCount--;
                                if (braceCount === 0) {
                                    endIdx = i + 1;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (endIdx > startIdx) {
                        const extracted = trimmed.substring(startIdx, endIdx);
                        console.log(`🔄 Extracted JSON object using brace counting in ${context}`);
                        return extracted;
                    }
                }
                
                return str;
            },
            
            // ステップ5: プレーンテキストの処理
            (str: string) => {
                // 既にJSON構造が検出されている場合はそのまま処理
                if (str.trim().startsWith('{') || str.trim().startsWith('[')) {
                    return str;
                }
                
                // すでにJSON文字列として適切にエンコードされている場合
                if (str.trim().startsWith('"') && str.trim().endsWith('"')) {
                    return str;
                }
                
                // JSONの開始文字がない場合、プレーンテキストとして扱う
                if (!str.startsWith('{') && !str.startsWith('[') && !str.startsWith('"')) {
                    console.log(`🔧 Treating as plain text in ${context}`);
                    console.log(`   Original: "${str.substring(0, 100)}..."`);
                    const encoded = JSON.stringify(str);
                    console.log(`   Encoded: "${encoded.substring(0, 100)}..."`);
                    
                    // エンコード結果をテスト
                    try {
                        JSON.parse(encoded);
                        console.log(`✅ Plain text encoding verification passed`);
                    } catch (testError) {
                        console.error(`❌ Plain text encoding verification failed: ${testError}`);
                    }
                    
                    return encoded;
                }
                return str;
            },
            
            // ステップ6: 一般的なJSON構文エラーの修正
            (str: string) => {
                let fixed = str
                    .replace(/[\r\n\t]/g, ' ') // 改行・タブを半角スペースに
                    .replace(/\s+/g, ' ') // 連続スペースを単一に
                    .replace(/:\s*,/g, ': null,') // 空値をnullに
                    .replace(/"\s*:\s*"/g, '": "'); // クォート問題の修正
                
                // バッククォートのエスケープ処理（JSON文字列内）
                // JSON文字列内でバッククォートが含まれている場合、それをエスケープ
                fixed = fixed.replace(/"([^"]*`[^"]*)"/g, (match, content) => {
                    const escapedContent = content.replace(/`/g, '\\u0060');
                    console.log(`🔧 Escaping backticks in JSON string: "${content}" → "${escapedContent}"`);
                    return `"${escapedContent}"`;
                });
                
                // 末尾カンマの除去（改良版）
                // 配列とオブジェクトの両方に対応
                fixed = fixed
                    .replace(/,(\s*[\]\}])/g, '$1') // 基本的な末尾カンマ除去
                    .replace(/,(\s*)\]/g, '$1]') // 配列の末尾カンマ
                    .replace(/,(\s*)\}/g, '$1}') // オブジェクトの末尾カンマ
                    .replace(/,(\s*)(\n\s*[\]\}])/g, '$1$2'); // 改行を含む末尾カンマ
                
                return fixed;
            },
            
            // ステップ7: 不正な文字の修正
            (str: string) => str
                .replace(/'/g, '"') // シングルクォートをダブルクォートに
                .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // プロパティ名をクォート
        ];

        let cleanedJson = jsonString;
        let lastError: Error | null = null;
        
        // 各クリーンアップステップを順次適用
        for (let i = 0; i < cleanupSteps.length; i++) {
            try {
                const previousJson = cleanedJson;
                cleanedJson = cleanupSteps[i](cleanedJson);
                
                console.log(`🔄 JSON cleanup step ${i + 1} for ${context}: "${previousJson.substring(0, 50)}..." → "${cleanedJson.substring(0, 50)}..."`);
                
                // デバッグ: JSON.parse前の詳細ログ
                console.log(`🔧 About to parse JSON in step ${i + 1}:`);
                console.log(`   Length: ${cleanedJson.length}`);
                console.log(`   First 20 chars: "${cleanedJson.substring(0, 20)}"`);
                console.log(`   Char codes: [${cleanedJson.substring(0, 10).split('').map(c => c.charCodeAt(0)).join(', ')}]`);
                
                // 各ステップ後にJSONパースを試行
                try {
                    const result = JSON.parse(cleanedJson);
                    console.log(`✅ JSON parsed successfully at cleanup step ${i + 1} for ${context}`);
                    return result;
                } catch (parseError) {
                    // このステップでの解析に失敗した場合、詳細ログを出力
                    console.log(`❌ JSON parse failed at step ${i + 1} for ${context}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
                    console.log(`   Cleaned content: "${cleanedJson.substring(0, 100)}..."`);
                    
                    // エラー位置の詳細分析
                    if (parseError instanceof Error && parseError.message.includes('at position')) {
                        const posMatch = parseError.message.match(/at position (\d+)/);
                        if (posMatch) {
                            const errorPos = parseInt(posMatch[1]);
                            console.log(`🔍 Error position analysis:`);
                            console.log(`   Error at position: ${errorPos}`);
                            console.log(`   JSON length: ${cleanedJson.length}`);
                            
                            // エラー位置周辺の文字を詳細表示
                            const start = Math.max(0, errorPos - 10);
                            const end = Math.min(cleanedJson.length, errorPos + 10);
                            console.log(`   Context (${start}-${end}):`);
                            for (let pos = start; pos < end; pos++) {
                                const char = cleanedJson[pos];
                                const charCode = char.charCodeAt(0);
                                const marker = pos === errorPos ? ' <-- ERROR' : '';
                                const charDesc = charCode < 32 ? `[CTRL-${charCode}]` : charCode > 126 ? `[EXTENDED-${charCode}]` : char;
                                console.log(`     ${pos}: '${charDesc}' (${charCode})${marker}`);
                            }
                            
                            // 特殊文字の全体スキャン
                            const specialChars = [];
                            for (let pos = 0; pos < cleanedJson.length; pos++) {
                                const charCode = cleanedJson.charCodeAt(pos);
                                if (charCode < 32 && charCode !== 10 && charCode !== 13 && charCode !== 9) { // 改行、復帰、タブ以外の制御文字
                                    specialChars.push({pos, char: cleanedJson[pos], code: charCode});
                                } else if (charCode >= 127 && charCode <= 159) { // 拡張制御文字
                                    specialChars.push({pos, char: cleanedJson[pos], code: charCode});
                                } else if (charCode >= 8192 && charCode <= 8303) { // Unicode空白・特殊文字
                                    specialChars.push({pos, char: cleanedJson[pos], code: charCode});
                                }
                            }
                            
                            if (specialChars.length > 0) {
                                console.log(`🚨 Found ${specialChars.length} special characters:`);
                                specialChars.slice(0, 10).forEach(sc => {
                                    console.log(`     Position ${sc.pos}: charCode ${sc.code}`);
                                });
                            }
                        }
                    }
                    
                    // プレーンテキストの可能性を再チェック
                    if (i === 0 && this.looksLikePlainTextInstruction(cleanedJson)) {
                        console.log(`🔄 Content appears to be plain text instruction, returning as-is`);
                        return cleanedJson;
                    }
                    
                    throw parseError; // エラーを再スロー（次のステップへ）
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                // このステップでは解析できない、次のステップへ
                console.log(`🔄 JSON cleanup step ${i + 1} failed for ${context}: ${lastError.message}`);
                continue;
            }
        }

        // 全てのクリーンアップが失敗した場合
        console.error(`❌ All JSON cleanup attempts failed for ${context}:`, {
            originalLength: jsonString.length,
            cleanedLength: cleanedJson.length,
            originalPreview: jsonString.substring(0, 100),
            cleanedPreview: cleanedJson.substring(0, 100),
            charCodes: jsonString.substring(0, 20).split('').map(char => char.charCodeAt(0)),
            lastError: lastError?.message || 'Unknown error'
        });
        
        // 最後の手段：プレーンテキストとして返す
        console.log(`🔄 Final fallback for ${context}: treating as plain text`);
        try {
            return jsonString; // プレーンテキストとして返す
        } catch (fallbackError) {
            throw new Error(`Failed to parse JSON after all cleanup attempts in ${context}: ${lastError?.message || 'Unknown error'}`);
        }
    }

    /**
     * JSON構造の妥当性をチェックするヘルパーメソッド
     */
    private isValidJsonStructure(content: string): boolean {
        if (!content || content.trim().length === 0) {
            return false;
        }

        const trimmed = content.trim();
        
        // 基本的なJSON開始文字チェック
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            return false;
        }

        // 対応する終了文字をチェック
        if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
            return false;
        }
        if (trimmed.startsWith('[') && !trimmed.endsWith(']')) {
            return false;
        }

        // JSON特有のパターンをチェック
        const jsonPatterns = [
            /"[^"]*"\s*:\s*/, // キー:値のパターン
            /\{\s*"/, // オブジェクト開始パターン
            /\[\s*\{/, // オブジェクト配列パターン
            /"[^"]*"\s*,\s*"/, // 複数のキーパターン
        ];

        const hasJsonPattern = jsonPatterns.some(pattern => pattern.test(trimmed));
        
        // 簡単なJSON解析テスト
        if (hasJsonPattern) {
            try {
                JSON.parse(trimmed);
                return true;
            } catch (e) {
                // パースエラーでも、基本的なJSON構造があれば修復可能とみなす
                return true;
            }
        }

        return false;
    }

    /**
     * ConversationSummarizer を使用してメッセージを送信
     */
    private async sendMessageWithSummarizer(role: string, content: string): Promise<Array<{ role: string, content: string }>> {
        // ConversationSummarizer にメッセージを追加(自動要約チェック付き)
        this.currentMessages = await this.conversationSummarizer.addMessage(role, content);
        return this.currentMessages;
    }

    /**
     * 品質チェック付きLLM実行メソッド
     * modified: 0 lines などの不完全応答を検出してリトライする
     */
    private async sendLLMWithQualityCheck(context: string = 'default'): Promise<any> {
        let bestResponse = null;
        let bestMetrics = null;
        let lastError = null;

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                console.log(`🚀 LLM Request (attempt ${attempt + 1}/3) for ${context}`);
                
                // プロンプトの強化（リトライ時）
                if (attempt > 0 && bestMetrics) {
                    const lastMessage = this.currentMessages[this.currentMessages.length - 1];
                    if (lastMessage?.role === 'user') {
                        lastMessage.content = this.retryEnhancer.enhancePromptForRetry(
                            lastMessage.content, 
                            attempt, 
                            bestMetrics
                        );
                    }
                }

                const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
                
                if (!llm_response?.choices?.[0]?.message?.content) {
                    throw new Error('Empty LLM response');
                }

                const content = llm_response.choices[0].message.content;
                const parsed = this.messageHandler.analyzeMessages(content);

                // アシスタントの応答をConversationSummarizerに追加
                await this.sendMessageWithSummarizer('assistant', content);
                
                // 品質チェック（初回フェーズでは修正内容を要求しない）
                const metrics = this.retryEnhancer.checkResponseQuality(parsed);
                this.retryEnhancer.logQualityMetrics(metrics);

                // ベストレスポンスの更新
                if (!bestResponse || metrics.completionScore > (bestMetrics?.completionScore || 0)) {
                    bestResponse = llm_response;
                    bestMetrics = metrics;
                    this.context.llmParsed = parsed;
                }

                // 初回フェーズ ('initial') では修正内容がなくても合格とする
                const isInitialPhase = context === 'initial';
                const shouldRetry = isInitialPhase 
                    ? this.shouldRetryInitialPhase(metrics, attempt)
                    : this.retryEnhancer.shouldRetry(metrics, attempt);

                // 品質チェック合格の場合は即座に返す
                if (!shouldRetry) {
                    console.log(`✅ Quality check passed (score: ${metrics.completionScore}%) - Phase: ${context}`);
                    return bestResponse;
                }

                // リトライ待機
                if (attempt < 2) {
                    const delay = this.retryEnhancer.calculateRetryDelay(attempt);
                    console.log(`⏳ Quality retry delay: ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

            } catch (error) {
                lastError = error;
                console.error(`❌ LLM call failed (attempt ${attempt + 1}):`, error);
                
                if (attempt < 2) {
                    const delay = this.retryEnhancer.calculateRetryDelay(attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // 全てのリトライが失敗した場合、ベストレスポンスがあればそれを返す
        if (bestResponse) {
            console.log(`⚠️ Using best available response (score: ${bestMetrics?.completionScore}%)`);
            return bestResponse;
        }

        throw new Error(`All LLM retry attempts failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
    }

    /**
     * 現在使用中のLLMモデル名を取得
     */
    private getCurrentLLMModel(): string {
        // Configクラスから設定を取得（config_openai.json等を参照）
        const provider = this.config.get('llm.provider', 'openai');
        
        if (provider === 'openai') {
            return this.config.get('llm.model', 'gpt-4');
        } else if (provider === 'gemini') {
            return this.config.get('gemini.model', 'gemini-1.5-pro');
        } else if (provider === 'restapi') {
            return this.config.get('llm.restApi.model', 'default');
        } else {
            return 'unknown';
        }
    }

    /**
     * LLM設定情報を取得
     */
    private getLLMConfig(): any {
        const provider = this.config.get('llm.provider', 'openai');
        const config: any = {};
        
        if (provider === 'openai') {
            config.temperature = this.config.get('llm.temperature', 0.7);
            config.max_tokens = this.config.get('llm.maxTokens', 4000);
            config.top_p = 1.0; // デフォルト値
        } else if (provider === 'gemini') {
            config.temperature = this.config.get('gemini.temperature', 0.7);
            config.max_tokens = this.config.get('gemini.maxTokens', 4000);
            config.top_p = 1.0; // デフォルト値
        } else if (provider === 'restapi') {
            config.temperature = this.config.get('llm.restApi.temperature', 0.7);
            config.max_tokens = this.config.get('llm.restApi.maxTokens', 4000);
        }
        
        // 空の設定オブジェクトの場合はundefinedを返す
        return Object.keys(config).length > 0 ? config : undefined;
    }

    /**
     * デフォルトのファイル要求を生成（早期終了防止用）
     */
    private generateDefaultFileRequests(): string[] {
        const defaultFiles: string[] = [];
        
        // プロト関連ファイルの一般的なパターンを追加
        try {
            const protoDir = path.join(this.config.inputProjectDir);
            
            // よく変更されるファイルパターンを推測
            const commonPatterns = [
                '**/*.proto',
                '**/*.go',
                '**/*.py',
                '**/*.java',
                '**/*.ts',
                '**/*.js',
                'Makefile',
                'BUILD',
                'build.gradle'
            ];
            
            // 実際にプロジェクトディレクトリから一部のファイルを探す
            if (fs.existsSync(protoDir)) {
                const files = fs.readdirSync(protoDir, { recursive: false });
                for (const file of files) {
                    if (typeof file === 'string' && 
                        (file.endsWith('.go') || file.endsWith('.proto') || 
                         file.endsWith('.py') || file.endsWith('.java'))) {
                        defaultFiles.push(file);
                        if (defaultFiles.length >= 3) break; // 最大3ファイル
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not generate default file requests:', error);
        }
        
        // 最低限1つのファイルは要求する
        if (defaultFiles.length === 0) {
            defaultFiles.push('main.go'); // フォールバック
        }
        
        console.log('📁 Generated default file requests:', defaultFiles);
        return defaultFiles;
    }

    /**
     * Diffテキストからファイルパスを抽出
     */
    private extractFilePaths(diffText: string): string[] {
        const filePaths: string[] = [];
        const lines = diffText.split('\n');
        
        for (const line of lines) {
            // "--- a/path/to/file" や "+++ b/path/to/file" の形式からパスを抽出
            const match = line.match(/^(?:---|\+\+\+)\s+[ab]\/(.+)$/);
            if (match) {
                const filePath = match[1];
                if (!filePaths.includes(filePath)) {
                    filePaths.push(filePath);
                }
            }
        }
        
        return filePaths;
    }

    /**
     * 初回フェーズ専用の品質チェック（修正内容を要求しない）
     */
    private shouldRetryInitialPhase(metrics: any, attempt: number): boolean {
        // 初回フェーズでは以下の条件で合格
        // 1. プランまたは思考内容がある
        // 2. ファイル要求がある、または完了タグがある
        const hasValidContent = metrics.planLines > 0 || metrics.thoughtLines > 0;
        const hasActionPlan = (metrics.fileRequestCount > 0) || metrics.hasCompletionTag;
        
        if (hasValidContent && hasActionPlan) {
            return false; // リトライ不要
        }
        
        // 最後の試行では最善の結果を受け入れる
        if (attempt >= 2) {
            console.log(`⚠️ Accepting result after final attempt (attempt ${attempt + 1})`);
            return false;
        }
        
        console.log(`🔄 Initial phase retry needed: hasValidContent=${hasValidContent}, hasActionPlan=${hasActionPlan}`);
        return true; // リトライ
    }

    /**
     * トークン使用量を取得（要約を含む）
     */
    public getTokenUsage(): { 
        promptTokens: number; 
        completionTokens: number; 
        totalTokens: number;
        summaryTokens?: number; 
    } {
        const summaryTokens = this.conversationSummarizer 
            ? this.conversationSummarizer.getStats().summaryTokensUsed || 0
            : 0;

        return {
            promptTokens: this.totalPromptTokens,
            completionTokens: this.totalCompletionTokens,
            totalTokens: this.totalPromptTokens + this.totalCompletionTokens,
            ...(summaryTokens > 0 && { summaryTokens })
        };
    }
}

export default LLMFlowController;