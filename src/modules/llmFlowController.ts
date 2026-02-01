/**
 * LLM自動応答・自動修正フローのステートマシン
 * Mermaidフロー図に基づく
*/

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// 環境変数の設定
config({ path: path.join(process.cwd(), '.env') });

import RestoreDiff from './RestoreDiff.js';
import Logger, { APRStatus } from './Logger.js';
import Config from './Config.js';
import MessageHandler from './MessageHandler.js';
import FileManager from './FileManager.js';
import OpenAIClient from './OpenAIClient.js';
import LLMRetryEnhancer from './llmRetryEnhancer.js';
import ConversationSummarizer from './ConversationSummarizer.js';
import { CrossReferenceAnalyzer } from './crossReferenceAnalyzer.js';
import { AgentStateService } from '../Service/AgentStateService.js';
import { AgentState, formatSystemState } from '../types/AgentState.js';
import { AgentStateRepository } from '../Repository/AgentStateRepository.js';
import { ValidationError } from '../types/ValidationError.js';
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
    private context: Context = {
        // Priority 1: 取得済み情報の追跡を初期化
        retrievedSoFar: {
            fileContents: new Set<string>(),
            directoryListings: new Set<string>()
        }
    };
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
    private agentStateService!: AgentStateService;

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
    
    // タグ違反リトライ管理
    private tagViolationRetryCount: number = 0;
    private maxTagViolationRetries: number = 2; // 最大リトライ回数
    
    // 調査フェーズ強制終了管理
    private consecutiveFileRequestCount: number = 0;
    private maxConsecutiveFileRequests: number = 5; // 連続ファイルリクエストの上限
    private hasEverProducedModification: boolean = false; // 修正を一度でも出力したか
    
    // 処理オプション
    private enablePreVerification: boolean = true; // 事前検証を有効にするかどうか
    
    // エラー発生時のコンテキスト保持
    private errorRecoveryContext: {
        previousState: AgentState | null;
        errorMessage: string | null;
        errorType: string | null;
        occurredAt: string | null;
        modifiedFilesSnapshot: string[];
        requestedFilesSnapshot: string[];
    } = {
        previousState: null,
        errorMessage: null,
        errorType: null,
        occurredAt: null,
        modifiedFilesSnapshot: [],
        requestedFilesSnapshot: []
    };

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
        });  // Config引数を削除
        
        // デバッグログは環境変数で制御
        const debugMode = process.env.DEBUG_MODE === 'true' || process.env.DEBUG_MODE === '1';
        
        if (debugMode) {
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
                has_fin_tag: false,
                has_no_changes_needed: false,
                no_progress_fallback: false
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
            has_fin_tag: parsed.has_fin_tag,
            has_no_changes_needed: parsed.has_no_changes_needed,
            no_progress_fallback: parsed.no_progress_fallback || false
        };
    }

    // =============================================================================
    // メインフロー制御
    // =============================================================================

    async run() {
        while (this.state !== State.End) {
            // FSM状態チェック: FINISHED状態なら終了
            const currentFSMState = this.agentStateService?.getCurrentState();
            if (currentFSMState === AgentState.FINISHED) {
                console.log('🏁 FSM: FINISHED state detected, ending main loop');
                this.state = State.End;
                break;
            }
            
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
                    // AWAITING_INFO状態を内部専用にする：即座にANALYSIS状態に戻す
                    await this.transitionFromAwaitingInfoToAnalysis();
                    this.state = State.SendInfoToLLM;
                    break;

                case State.GetDirectoryListing:
                    await this.getDirectoryListing();
                    // AWAITING_INFO状態を内部専用にする：即座にANALYSIS状態に戻す
                    await this.transitionFromAwaitingInfoToAnalysis();
                    this.state = State.SendInfoToLLM;
                    break;

                case State.ProcessRequiredInfos:
                    await this.processRequiredInfos();
                    // AWAITING_INFO状態を内部専用にする：即座にANALYSIS状態に戻す
                    await this.transitionFromAwaitingInfoToAnalysis();
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

                case State.SendVerificationPrompt:
                    await this.sendVerificationPrompt();
                    this.state = State.LLMVerificationDecision;
                    break;

                case State.LLMVerificationDecision:
                    await this.llmVerificationDecision();
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
        
        // FSM (AgentStateService) を初期化
        const agentStateRepository = new AgentStateRepository();
        const agentId = `llm-flow-${Date.now()}`;
        this.agentStateService = new AgentStateService(agentId, agentStateRepository, {
            autoSave: false,  // 自動保存は無効（パフォーマンス考慮）
            enableTagValidation: true,
            autoRetryOnInvalidTags: false,
            debug: false
        });
        await this.agentStateService.initialize();
        console.log('🤖 FSM initialized with state:', this.agentStateService.getCurrentState());

        // OpenAIClientの初期化完了を待機
        await (this.openAIClient as any).initPromise;

        // 対話履歴要約機能を初期化
        this.conversationSummarizer = new ConversationSummarizer(
            this.config, 
            this.openAIClient, 
            () => this.correctionGoals // correctionGoalsのコールバック
        );

        // 初期プロンプト生成 (FSM System State込み)
        const currentAgentState = this.agentStateService.getCurrentState();
        const systemState = formatSystemState(currentAgentState);
        this.next_prompt_content = this.fileManager.readFirstPromptFile(systemState);
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
        
        // 【新規】Ground Truthの変更ファイルリストを読み込み（No Progress改善用）
        try {
            const fileChangesPath = path.join(this.config.inputProjectDir, '03_fileChanges.txt');
            if (fs.existsSync(fileChangesPath)) {
                const fileChangesContent = fs.readFileSync(fileChangesPath, 'utf-8');
                this.context.groundTruthChangedFiles = fileChangesContent.trim().split('\n').filter(f => f.trim());
                console.log(`📋 Ground Truth changed files loaded: ${this.context.groundTruthChangedFiles.length} files`);
            } else {
                this.context.groundTruthChangedFiles = [];
            }
        } catch (error) {
            console.warn('⚠️ Could not read ground truth file changes:', error);
            this.context.groundTruthChangedFiles = [];
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

        // トリガー層3: ターン完了時の要約チェック
        await this.conversationSummarizer.onTurnComplete(this.currentTurn);

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

    /**
     * AWAITING_INFO状態を内部専用にするヘルパー
     * ファイル取得完了後、即座にANALYSIS状態に戻す
     */
    private async transitionFromAwaitingInfoToAnalysis() {
        const currentState = this.agentStateService.getCurrentState();
        if (currentState === AgentState.AWAITING_INFO) {
            console.log('🔄 FSM: AWAITING_INFO is internal-only, transitioning back to ANALYSIS');
            await this.agentStateService.transition(AgentState.ANALYSIS, 'info_received_return_to_analysis');
        }
    }

    private async sendInfoToLLM() {
        // 取得したファイル内容をLLMへ送信（既にANALYSIS状態に戻っている）
        const parsed = this.context.llmParsed;
        const filesRequested = typeof this.context.fileContent === 'string' ? this.context.fileContent : '';
        const modifiedDiff = parsed?.modifiedDiff || '';
        const commentText = parsed?.commentText || '';
        const previousThought = parsed?.thought || '';
        const previousPlan = parsed?.plan || '';
        
        // FSM System Stateを取得（ANALYSIS状態になっている）
        const currentAgentState = this.agentStateService.getCurrentState();
        const systemState = formatSystemState(currentAgentState);
        
        const promptReply = this.config.readPromptReplyFile(
            filesRequested, 
            modifiedDiff, 
            commentText, 
            previousThought, 
            previousPlan,
            this.correctionGoals, // correctionGoals
            systemState, // FSM System State
            this.context.retrievedSoFar // Priority 1: 取得済み情報
        );
        this.currentMessages = await this.sendMessageWithSummarizer("user", promptReply);
        
        // トリガー層2: LLM送信直前の最終安全チェック
        this.currentMessages = await this.conversationSummarizer.preSendCheck();
        
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;

        // ターン数とトークン数を更新
        this.currentTurn++;
        const usage = llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
        this.totalPromptTokens += usage.prompt_tokens;
        this.totalCompletionTokens += usage.completion_tokens;

        // トリガー層3: ターン完了時の要約チェック
        await this.conversationSummarizer.onTurnComplete(this.currentTurn);

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
            const currentAgentState = this.agentStateService.getCurrentState();
            this.context.llmParsed = await this.executeWithPerformanceMonitoring(
                'LLM_Response_Analysis',
                async () => this.messageHandler.analyzeMessages(llm_content, currentAgentState)
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
            
            // FSM: LLM応答を検証して状態遷移
            try {
                const validationResult = this.agentStateService.validateLLMResponse(llm_content, {
                    modifiedLines: this.context.llmParsed.modifiedLines
                });
                if (!validationResult.valid) {
                    console.warn('⚠️ FSM: Invalid tags detected:', validationResult.invalidTags);
                    console.log('✅ FSM: Allowed tags:', validationResult.allowedTags);
                    // タグエラーをログに記録（リトライは上位層で処理）
                    this.logger.logError(`FSM Tag Validation Failed: ${JSON.stringify(validationResult)}`);
                } else {
                    // 有効な場合は推奨される次の状態に遷移
                    if (validationResult.suggestedNextState) {
                        await this.agentStateService.transition(
                            validationResult.suggestedNextState, 
                            'llm_response_analyzed'
                        );
                    }
                }
                console.log(`🤖 FSM: State transitioned to ${this.agentStateService.getCurrentState()}`);
            } catch (fsmError) {
                console.error('❌ FSM validation error:', fsmError);
                // FSMエラーは致命的ではないため、処理は続行
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
            const currentAgentState = this.agentStateService.getCurrentState();
            this.context.llmParsed = await this.executeWithPerformanceMonitoring(
                'LLM_Response_Reanalysis',
                async () => this.messageHandler.analyzeMessages(content, currentAgentState)
            );
            
            // FSM: 再解析時の応答検証（AWAITING_INFOは内部専用なのでここではANALYSIS状態）
            try {
                const validationResult = this.agentStateService.validateLLMResponse(content, {
                    modifiedLines: this.context.llmParsed.modifiedLines
                });
                const currentState = this.agentStateService.getCurrentState();
                
                // AWAITING_INFOの場合は既にANALYSISに戻っているはず
                if (currentState === AgentState.AWAITING_INFO) {
                    console.warn('⚠️ FSM: Unexpected AWAITING_INFO state in reanalysis, fixing');
                    await this.agentStateService.transition(AgentState.ANALYSIS, 'fix_awaiting_info');
                }
                
                if (!validationResult.valid) {
                    console.warn('⚠️ FSM (Reanalyze): Invalid tags detected:', validationResult.invalidTags);
                }
                
                // 注意: ここでsuggestedNextStateへの遷移はしない
                // ファイル情報取得後、llmDecision()で適切に処理される
                
                console.log(`🤖 FSM (Reanalyze): State = ${this.agentStateService.getCurrentState()}`);
            } catch (fsmError) {
                console.error('❌ FSM reanalysis validation error:', fsmError);
            }
            
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
        // FSMベースの完全な状態管理
        // LLMの応答をFSMで検証し、状態遷移を決定
        
        const parsed = this.context.llmParsed;
        if (!parsed) {
            console.error('❌ No parsed LLM response');
            this.captureErrorContext('No parsed LLM response available');
            await this.agentStateService.transition(AgentState.ERROR, 'no_parsed_response');
            this.state = State.End;
            return;
        }
        
        const content = this.context.llmResponse?.choices?.[0]?.message?.content || '';
        
        // FSM: LLM応答を検証
        const validationResult = this.agentStateService.validateLLMResponse(content, {
            modifiedLines: parsed.modifiedLines
        });
        const currentFSMState = this.agentStateService.getCurrentState();
        
        console.log(`🤖 FSM (Decision): Current state = ${currentFSMState}`);
        console.log(`🤖 FSM (Decision): Detected tags = [${validationResult.detectedTags.join(', ')}]`);
        console.log(`🤖 FSM (Decision): Valid = ${validationResult.valid}`);
        
        // イテレーションカウントを更新
        this.internalProgress.iterationCount = this.currentTurn;
        
        // ターン数上限チェック（無限ループ防止）
        if (this.currentTurn >= 15) {
            console.warn('⚠️ Reached maximum turns (15), forcing termination');
            this.captureErrorContext('Maximum turns (15) exceeded - forcing termination');
            // ERROR状態に遷移してから、直接State.Endへ
            // FINISHED状態へは遷移せず、処理を終了
            const currentState = this.agentStateService.getCurrentState();
            if (currentState !== AgentState.ERROR) {
                await this.agentStateService.transition(AgentState.ERROR, 'max_turns_exceeded');
            }
            this.state = State.End;
            return;
        }
        
        if (!validationResult.valid) {
            // No Progress検出: LLMが意味的に行き詰まっている
            if (validationResult.isNoProgress) {
                console.warn('❌ No progress detected: LLM has exhausted its options');
                await this.handleNoProgress();
                return;
            }
            
            // タグエラー: 不正なタグが検出された
            console.warn(`⚠️ FSM: Invalid tags detected: [${validationResult.invalidTags.join(', ')}]`);
            console.log(`✅ FSM: Allowed tags in ${currentFSMState}: [${validationResult.allowedTags.join(', ')}]`);
            
            // リトライ回数をチェック
            if (this.tagViolationRetryCount < this.maxTagViolationRetries) {
                // 軽量なcorrective retryを実行
                this.tagViolationRetryCount++;
                console.log(`🔄 FSM: Tag violation detected, performing corrective retry (attempt ${this.tagViolationRetryCount}/${this.maxTagViolationRetries})`);
                
                // FSM状態は変更せず、同じプロンプトを補助文付きで再送信
                await this.performCorrectiveRetry(currentFSMState);
                return;
            }
            
            // リトライ上限到達：ERROR eventとして扱う
            console.error(`❌ FSM: Tag violation retry limit reached (${this.maxTagViolationRetries})`);
            this.logger.logError(`FSM Tag Validation Failed after ${this.maxTagViolationRetries} retries: ${JSON.stringify(validationResult)}`);
            
            // エラーコンテキスト保存
            this.captureErrorContext(`Invalid tags after ${this.maxTagViolationRetries} retries: [${validationResult.invalidTags.join(', ')}]`);
            
            // ERROR状態への遷移（既にERROR状態の場合は遷移しない）
            if (currentFSMState !== AgentState.ERROR) {
                await this.agentStateService.transition(AgentState.ERROR, 'invalid_tags_detected');
            } else {
                console.log('⚠️ FSM: Already in ERROR state, skipping ERROR->ERROR transition');
            }
            
            // ERROR eventとしてANALYSISに戻す
            this.state = State.SendErrorToLLM;
            return;
        }
        
        // タグ検証成功：リトライカウンターをリセット
        this.tagViolationRetryCount = 0;
        
        // 有効なタグ: 推奨される次の状態に遷移（既に同じ状態の場合はスキップ）
        if (validationResult.suggestedNextState) {
            const targetState = validationResult.suggestedNextState;
            if (targetState !== currentFSMState) {
                console.log(`🤖 FSM: Transitioning to suggested state: ${targetState}`);
                await this.agentStateService.transition(
                    targetState,
                    'llm_response_validated'
                );
            } else {
                console.log(`⚠️ FSM: Already in ${currentFSMState} state, skipping transition`);
            }
        }
        
        // FSM状態に基づいて次のアクションを決定
        const nextFSMState = this.agentStateService.getCurrentState();
        console.log(`🤖 FSM: New state = ${nextFSMState}`);
        
        // FSM状態ごとの処理
        switch (nextFSMState) {
            case AgentState.FINISHED:
                // 完了状態: タスク完了
                console.log('✅ FSM: Task completed in FINISHED state');
                
                // タスク完了要約を生成
                const taskSummary = await this.conversationSummarizer.onTaskComplete('PR Analysis');
                if (taskSummary) {
                    console.log('📊 Task completion summary generated');
                }
                
                this.state = State.End;
                break;
                
            case AgentState.AWAITING_INFO:
                // 情報待ち状態: ファイルコンテンツ取得
                if (parsed.has_no_changes_needed) {
                    // LLMが追加情報なしで「修正不要」と判断した場合 → VERIFYINGへ
                    console.log('✅ FSM: No changes needed detected in AWAITING_INFO, transitioning to VERIFYING');
                    this.consecutiveFileRequestCount = 0; // リセット
                    await this.agentStateService.transition(AgentState.VERIFYING, 'no_changes_needed_from_awaiting_info');
                    this.state = State.SendVerificationPrompt;
                } else if (parsed.requiredFilepaths && parsed.requiredFilepaths.length > 0) {
                    // 調査フェーズ強制終了チェック
                    this.consecutiveFileRequestCount++;
                    console.log(`📝 FSM: Requesting ${parsed.requiredFilepaths.length} files (consecutive: ${this.consecutiveFileRequestCount}/${this.maxConsecutiveFileRequests})`);
                    
                    if (this.consecutiveFileRequestCount >= this.maxConsecutiveFileRequests && !this.hasEverProducedModification) {
                        console.warn(`⚠️ FSM: Investigation phase limit reached (${this.maxConsecutiveFileRequests} consecutive file requests without modification)`);
                        console.warn('⚠️ FSM: Forcing transition to MODIFYING state to produce output');
                        
                        // 調査フェーズから強制的に修正フェーズへ遷移
                        await this.agentStateService.transition(AgentState.MODIFYING, 'force_exit_investigation_phase');
                        
                        // 調査終了プロンプトを送信
                        await this.sendForceModificationPrompt();
                        return;
                    }
                    
                    this.state = State.SystemAnalyzeRequest;
                } else {
                    console.warn('⚠️ FSM: In AWAITING_INFO but no file requests, forcing default requests');
                    if (this.context.llmParsed) {
                        this.context.llmParsed.requiredFilepaths = this.generateDefaultFileRequests();
                        if (this.context.llmParsed.requiredFilepaths.length > 0) {
                            this.state = State.SystemAnalyzeRequest;
                        } else {
                            this.state = State.SendErrorToLLM;
                        }
                    } else {
                        this.state = State.SendErrorToLLM;
                    }
                }
                break;
                
            case AgentState.MODIFYING:
                // 修正中状態: パッチ適用
                if (parsed.modifiedDiff && parsed.modifiedDiff.length > 0) {
                    console.log('🔧 FSM: Applying patch in MODIFYING state');
                    // 修正が出力されたのでフラグを更新
                    this.hasEverProducedModification = true;
                    this.consecutiveFileRequestCount = 0; // リセット
                    this.state = State.SystemParseDiff;
                } else if (parsed.has_no_changes_needed) {
                    // LLMが修正不要（修正完了）を示した場合 → VERIFYINGへ遷移
                    console.log('✅ FSM: No changes needed detected in MODIFYING state, transitioning to VERIFYING');
                    await this.agentStateService.transition(AgentState.VERIFYING, 'modifications_complete');
                    this.state = State.SendVerificationPrompt;
                } else if (parsed.requiredFilepaths && parsed.requiredFilepaths.length > 0) {
                    console.log('📝 FSM: Requesting additional files before modification');
                    this.consecutiveFileRequestCount++;
                    this.state = State.SystemAnalyzeRequest;
                } else {
                    console.warn('⚠️ FSM: In MODIFYING but no patch or file requests');
                    this.state = State.SendErrorToLLM;
                }
                break;
                
            case AgentState.VERIFYING:
                // 検証中状態: 検証プロンプトを送信または検証レポート受信後完了
                if (parsed.has_verification_report) {
                    console.log('✅ FSM: Verification report received, transitioning to completion');
                    // VERIFYING → READY_TO_FINISH → FINISHED の自動遷移
                    await this.agentStateService.transition(AgentState.READY_TO_FINISH, 'verification_completed');
                    await this.agentStateService.transition(AgentState.FINISHED, 'auto_completion');
                    this.state = State.End;
                } else if (parsed.has_no_changes_needed) {
                    // LLMが検証結果として「修正不要」を返した場合 → 完了へ遷移
                    console.log('✅ FSM: No changes needed in VERIFYING state, transitioning to completion');
                    await this.agentStateService.transition(AgentState.READY_TO_FINISH, 'no_changes_verified');
                    await this.agentStateService.transition(AgentState.FINISHED, 'no_changes_completion');
                    this.state = State.End;
                } else {
                    // 検証レポートがまだない場合は検証プロンプト送信
                    console.log('🔍 FSM: Sending verification prompt');
                    this.state = State.SendVerificationPrompt;
                }
                break;
                
            case AgentState.READY_TO_FINISH:
                // 完了準備状態（内部状態）: 自動的にFINISHEDへ遷移
                console.log('🏁 FSM: Ready to finish (internal state), transitioning to FINISHED');
                await this.agentStateService.transition(AgentState.FINISHED, 
                    parsed.has_no_changes_needed ? 'no_changes_needed_completion' : 'verification_completion');
                this.state = State.End;
                break;
                
            case AgentState.ERROR:
                // エラー状態: エラープロンプト送信
                console.log('❌ FSM: In ERROR state, sending error prompt');
                this.state = State.SendErrorToLLM;
                break;
                
            case AgentState.ANALYSIS:
            default:
                // 分析状態: No_Changes_Neededタグがある場合はREADY_TO_FINISHへ遷移
                // (ANALYSISからVERIFYINGへの直接遷移は不可)
                if (parsed.has_no_changes_needed) {
                    console.log('✅ FSM: No changes needed detected in ANALYSIS, transitioning to VERIFYING for validation');
                    this.consecutiveFileRequestCount = 0; // リセット
                    await this.agentStateService.transition(AgentState.VERIFYING, 'no_changes_needed_to_verification');
                    this.state = State.SendVerificationPrompt;
                } else if (parsed.requiredFilepaths && parsed.requiredFilepaths.length > 0) {
                    // 調査フェーズのファイルリクエストをカウント
                    this.consecutiveFileRequestCount++;
                    console.log(`📝 FSM: Continuing analysis with file requests (consecutive: ${this.consecutiveFileRequestCount}/${this.maxConsecutiveFileRequests})`);
                    
                    // 調査フェーズ強制終了チェック
                    if (this.consecutiveFileRequestCount >= this.maxConsecutiveFileRequests && !this.hasEverProducedModification) {
                        console.warn(`⚠️ FSM: Investigation phase limit reached in ANALYSIS state`);
                        console.warn('⚠️ FSM: Forcing transition to MODIFYING state to produce output');
                        
                        await this.agentStateService.transition(AgentState.MODIFYING, 'force_exit_investigation_phase');
                        await this.sendForceModificationPrompt();
                        return;
                    }
                    
                    this.state = State.SystemAnalyzeRequest;
                } else if (parsed.modifiedDiff && parsed.modifiedDiff.length > 0) {
                    console.log('🔧 FSM: Found patch in analysis, applying');
                    this.hasEverProducedModification = true;
                    this.consecutiveFileRequestCount = 0; // リセット
                    this.state = State.SystemParseDiff;
                } else {
                    // タグも内容もない空のレスポンス → 強制的にNo Progress扱い
                    console.warn('⚠️  FSM: Analysis produced no actionable output (no tags, no patch, no file requests)');
                    console.warn('⚠️  Empty response detected - treating as no-changes for verification');
                    
                    // No Progress扱いでVERIFYINGへ
                    await this.agentStateService.transition(AgentState.VERIFYING, 'empty_response_to_verification');
                    this.state = State.SendVerificationPrompt;
                }
                break;
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
        
        // FSM System Stateを取得
        const currentAgentState = this.agentStateService.getCurrentState();
        const systemState = formatSystemState(currentAgentState);

        const finalCheckPrompt = this.config.readPromptFinalCheckFile(
            verificationSummary,
            modifiedFilesStatus,
            systemState // FSM System State
        );

        this.currentMessages = await this.sendMessageWithSummarizer("user", finalCheckPrompt);
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;

        // ターン数とトークン数を更新
        this.currentTurn++;
        const usage = llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
        this.totalPromptTokens += usage.prompt_tokens;
        this.totalCompletionTokens += usage.completion_tokens;

        // トリガー層3: ターン完了時の要約チェック
        await this.conversationSummarizer.onTurnComplete(this.currentTurn);

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

    private async sendVerificationPrompt() {
        // VERIFYING状態用の検証プロンプトを送信
        const parsed = this.context.llmParsed;
        if (!parsed) {
            this.state = State.End;
            return;
        }

        // FSM System Stateを取得
        const currentAgentState = this.agentStateService.getCurrentState();
        const systemState = formatSystemState(currentAgentState);

        let verifyingPrompt: string;
        let promptType: string;
        
        // 3分岐: No Progress > No Changes Needed > Modified
        if (parsed.no_progress_fallback) {
            // No Progress: システムが自動判定した場合（優先度最高）
            console.log('🔍 FSM: Sending verification prompt for No Progress fallback (system-determined)');
            
            // No Progress専用プロンプト：なぜ進めなかったかを診断
            const requestedFiles = parsed.requiredFilepaths.join(', ') || 'None';
            verifyingPrompt = this.config.readPromptVerifyingNoProgressFile(
                this.correctionGoals || '',
                parsed.thought || '',
                parsed.plan || '',
                requestedFiles,
                systemState
            );
            promptType = '00_promptVerifyingNoProgress.txt';
        } else if (parsed.has_no_changes_needed) {
            // No Changes Needed: LLMが明示的に判断した場合
            console.log('🔍 FSM: Sending verification prompt for No Changes Needed decision (LLM-explicit)');
            
            // 修正不要の判断を検証するプロンプト
            verifyingPrompt = this.config.readPromptVerifyingNoChangesFile(
                this.correctionGoals || '',
                parsed.thought || '',
                parsed.plan || '',
                systemState
            );
            promptType = '00_promptVerifyingNoChanges.txt';
        } else {
            // Modified: パッチが生成された場合
            console.log('🔍 FSM: Sending verification prompt for Modified diff');
            
            const modifiedFiles = this.context.diff || '';
            verifyingPrompt = this.config.readPromptVerifyingFile(
                this.correctionGoals || '',
                parsed.thought || '',
                parsed.plan || '',
                modifiedFiles,
                systemState
            );
            promptType = '00_promptVerifying.txt';
        }

        this.currentMessages = await this.sendMessageWithSummarizer("user", verifyingPrompt);
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;

        // ターン数とトークン数を更新
        this.currentTurn++;
        const usage = llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
        this.totalPromptTokens += usage.prompt_tokens;
        this.totalCompletionTokens += usage.completion_tokens;

        // トリガー層3: ターン完了時の要約チェック
        await this.conversationSummarizer.onTurnComplete(this.currentTurn);

        // ログ記録
        this.logger.addInteractionLog(
            this.currentTurn,
            new Date().toISOString(),
            {
                prompt_template: promptType,
                full_prompt_content: verifyingPrompt
            },
            {
                raw_content: llm_response?.choices?.[0]?.message?.content || '',
                parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                usage: usage
            },
            {
                type: 'VERIFICATION',
                details: 'Sending verification prompt to LLM'
            }
        );
    }

    private async llmVerificationDecision() {
        // VERIFYING状態からの応答処理
        if (!this.context.llmResponse?.choices?.[0]?.message?.content) {
            console.error('❌ No LLM response for verification decision');
            this.captureErrorContext('No LLM response for verification decision');
            await this.agentStateService.transition(AgentState.ERROR, 'no_verification_response');
            this.state = State.End;
            return;
        }
        
        const content = this.context.llmResponse.choices[0].message.content;
        
        // Priority 3: VERIFYING状態では、ANALYSIS状態で設定されたフラグを保持する
        const previousHasNoChangesNeeded = this.context.llmParsed?.has_no_changes_needed || false;
        const previousNoProgressFallback = this.context.llmParsed?.no_progress_fallback || false;
        
        this.context.llmParsed = this.messageHandler.analyzeMessages(content);
        
        // Verification Reportが生成された場合、no_progress_fallbackをクリア
        if (this.context.llmParsed.has_verification_report && previousNoProgressFallback) {
            console.log('🔄 Verification Report detected: clearing no_progress_fallback flag');
            console.log('   Reason: LLM successfully generated verification, indicating progress was made');
            // no_progress_fallbackはクリア（成功の証拠がある）
            this.context.llmParsed.no_progress_fallback = false;
        } else if (previousHasNoChangesNeeded || previousNoProgressFallback) {
            // Verification Reportがない場合のみ、フラグを復元（VERIFYING状態の応答では再度タグが出ないため）
            console.log('🔄 Preserving completion flags from previous state:');
            console.log(`   has_no_changes_needed: ${previousHasNoChangesNeeded}`);
            console.log(`   no_progress_fallback: ${previousNoProgressFallback}`);
            
            this.context.llmParsed.has_no_changes_needed = previousHasNoChangesNeeded;
            this.context.llmParsed.no_progress_fallback = previousNoProgressFallback;
        }
        
        // FSM検証
        const validationResult = this.agentStateService.validateLLMResponse(content, {
            modifiedLines: this.context.llmParsed.modifiedLines
        });
        const currentFSMState = this.agentStateService.getCurrentState();
        
        console.log(`🤖 FSM (VerificationDecision): Current state = ${currentFSMState}`);
        console.log(`🤖 FSM (VerificationDecision): Detected tags = [${validationResult.detectedTags.join(', ')}]`);
        
        if (!validationResult.valid) {
            console.warn(`⚠️ FSM: Invalid tags in verification decision: [${validationResult.invalidTags.join(', ')}]`);
            this.captureErrorContext(`Invalid tags in verification decision: [${validationResult.invalidTags.join(', ')}]`);
            await this.agentStateService.transition(AgentState.ERROR, 'invalid_verification_tags');
            this.state = State.SendErrorToLLM;
            return;
        }
        
        // 有効な応答: 推奨状態に遷移（既に同じ状態の場合はスキップ）
        if (validationResult.suggestedNextState) {
            const targetState = validationResult.suggestedNextState;
            if (targetState !== currentFSMState) {
                await this.agentStateService.transition(
                    targetState,
                    'verification_decision_validated'
                );
            } else {
                console.log(`⚠️ FSM: Already in ${currentFSMState} state, skipping transition`);
            }
        }
        
        const nextFSMState = this.agentStateService.getCurrentState();
        
        // %_Verification_Report_%が検出された場合は完了へ
        if (this.context.llmParsed.has_verification_report || nextFSMState === AgentState.READY_TO_FINISH) {
            console.log('✅ FSM: Verification complete, transitioning to completion');
            
            // Priority 3: No Changes Neededフラグを維持
            // （VERIFYING状態でhas_no_changes_neededが既に設定されている場合、それを保持）
            // この時点でフラグはANALYSIS状態で既に設定済み
            
            if (nextFSMState !== AgentState.READY_TO_FINISH) {
                await this.agentStateService.transition(AgentState.READY_TO_FINISH, 'verification_completed');
            }
            await this.agentStateService.transition(AgentState.FINISHED, 'auto_completion');
            
            // タスク完了要約
            const taskSummary = await this.conversationSummarizer.onTaskComplete('PR Analysis');
            if (taskSummary) {
                console.log('📊 Task completion summary generated');
            }
            
            this.state = State.End;
        } else if (this.context.llmParsed.modifiedDiff) {
            // 検証中に追加の修正が必要と判断された場合
            console.log('🔄 FSM: Additional modifications needed during verification');
            this.context.diff = this.context.llmParsed.modifiedDiff;
            await this.agentStateService.transition(AgentState.MODIFYING, 'additional_modifications_from_verification');
            this.state = State.SystemParseDiff;
        } else {
            // まだ検証が完了していない場合は再度検証プロンプト
            console.log('🔄 FSM: Verification not complete, continuing');
            this.state = State.LLMDecision;
        }
    }

    private async llmFinalDecision() {
        // FSMベースの最終判断
        if (!this.context.llmResponse?.choices?.[0]?.message?.content) {
            console.error('❌ No LLM response for final decision');
            this.captureErrorContext('No LLM response for final decision');
            await this.agentStateService.transition(AgentState.ERROR, 'no_final_response');
            this.state = State.End;
            return;
        }
        
        const content = this.context.llmResponse.choices[0].message.content;
        this.context.llmParsed = this.messageHandler.analyzeMessages(content);
        
        // FSM検証
        const validationResult = this.agentStateService.validateLLMResponse(content, {
            modifiedLines: this.context.llmParsed.modifiedLines
        });
        const currentFSMState = this.agentStateService.getCurrentState();
        
        console.log(`🤖 FSM (FinalDecision): Current state = ${currentFSMState}`);
        console.log(`🤖 FSM (FinalDecision): Detected tags = [${validationResult.detectedTags.join(', ')}]`);
        
        if (!validationResult.valid) {
            console.warn(`⚠️ FSM: Invalid tags in final decision: [${validationResult.invalidTags.join(', ')}]`);
            this.captureErrorContext(`Invalid tags in final decision: [${validationResult.invalidTags.join(', ')}]`);
            await this.agentStateService.transition(AgentState.ERROR, 'invalid_final_tags');
            this.state = State.SendErrorToLLM;
            return;
        }
        
        // 有効な応答: 推奨状態に遷移（既に同じ状態の場合はスキップ）
        if (validationResult.suggestedNextState) {
            const targetState = validationResult.suggestedNextState;
            if (targetState !== currentFSMState) {
                await this.agentStateService.transition(
                    targetState,
                    'final_decision_validated'
                );
            } else {
                console.log(`⚠️ FSM: Already in ${currentFSMState} state, skipping transition`);
            }
        }
        
        const nextFSMState = this.agentStateService.getCurrentState();
        
        if (nextFSMState === AgentState.FINISHED) {
            console.log('✅ FSM: Task completed with %%_Fin_%% tag in final decision');
            
            // タスク完了要約
            const taskSummary = await this.conversationSummarizer.onTaskComplete('PR Analysis');
            if (taskSummary) {
                console.log('📊 Task completion summary generated');
            }
            
            this.state = State.End;
        } else if (this.context.llmParsed.modifiedDiff) {
            console.log('🔄 FSM: Additional modifications in final decision, applying patch');
            this.context.diff = this.context.llmParsed.modifiedDiff;
            await this.agentStateService.transition(AgentState.MODIFYING, 'additional_modifications');
            this.state = State.SystemParseDiff;
        } else {
            console.log(`🔄 FSM: Final decision leads to state ${nextFSMState}, continuing`);
            this.state = State.LLMDecision;
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
        // FSMベースのエラー再分析
        if (!this.context.llmResponse?.choices?.[0]?.message?.content) {
            console.error('❌ No LLM response for error reanalysis');
            // エラーが続く場合は強制終了
            await this.agentStateService.transition(AgentState.FINISHED, 'error_reanalysis_failed');
            this.state = State.End;
            return;
        }
        
        const content = this.context.llmResponse.choices[0].message.content;
        this.context.llmParsed = this.messageHandler.analyzeMessages(content);
        
        // FSM検証
        const validationResult = this.agentStateService.validateLLMResponse(content, {
            modifiedLines: this.context.llmParsed.modifiedLines
        });
        const currentFSMState = this.agentStateService.getCurrentState();
        
        console.log(`🤖 FSM (ErrorReanalyze): Current state = ${currentFSMState}`);
        console.log(`🤖 FSM (ErrorReanalyze): Detected tags = [${validationResult.detectedTags.join(', ')}]`);
        
        if (!validationResult.valid) {
            console.warn(`⚠️ FSM: Invalid tags in error reanalysis: [${validationResult.invalidTags.join(', ')}]`);
            // エラーが続く場合は警告を出して続行
            this.logger.logError('Multiple validation failures detected');
        }
        
        // 注意: ここでsuggestedNextStateへの遷移はしない
        // ERROR状態からの回復はANALYSIS状態への遷移のみを許可
        
        // ANALYSIS状態に戻して再試行（既にANALYSISの場合はスキップ）
        if (currentFSMState !== AgentState.ANALYSIS) {
            console.log('🔄 FSM: Returning to ANALYSIS for retry');
            await this.agentStateService.transition(AgentState.ANALYSIS, 'error_retry');
        } else {
            console.log('⚠️ FSM: Already in ANALYSIS state, skipping transition');
        }
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
                    // パス種別の検証
                    for (const fileInfo of fileContentInfos) {
                        try {
                            this.fileManager.validatePathType('FILE_CONTENT', fileInfo.path);
                        } catch (error) {
                            if (error instanceof ValidationError) {
                                console.warn(`⚠️ Validation error for ${fileInfo.path}: ${error.message}`);
                                // ValidationErrorをcorrective retry経由で処理
                                await this.handleValidationError(error);
                                return;
                            }
                            throw error;
                        }
                    }
                    
                    // Phase 3-3: ファイル操作のパフォーマンス監視
                    const result = await this.executeWithPerformanceMonitoring(
                        'File_Content_Retrieval',
                        async () => this.fileManager.getFileContents(fileContentInfos)
                    );
                    this.context.fileContent = result;
                    
                    // Priority 1: 取得済みファイルを記録
                    if (!this.context.retrievedSoFar) {
                        this.context.retrievedSoFar = {
                            fileContents: new Set<string>(),
                            directoryListings: new Set<string>()
                        };
                    }
                    fileContentInfos.forEach(info => {
                        this.context.retrievedSoFar!.fileContents.add(info.path);
                    });
                    
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
                    // パス種別の検証
                    for (const dirInfo of directoryListingInfos) {
                        try {
                            this.fileManager.validatePathType('DIRECTORY_LISTING', dirInfo.path);
                        } catch (error) {
                            if (error instanceof ValidationError) {
                                console.warn(`⚠️ Validation error for ${dirInfo.path}: ${error.message}`);
                                // ValidationErrorをcorrective retry経由で処理
                                await this.handleValidationError(error);
                                return;
                            }
                            throw error;
                        }
                    }
                    
                    const result = await this.fileManager.getDirectoryListings(directoryListingInfos);
                    this.context.fileContent = result;
                    
                    // Priority 1: 取得済みディレクトリを記録
                    if (!this.context.retrievedSoFar) {
                        this.context.retrievedSoFar = {
                            fileContents: new Set<string>(),
                            directoryListings: new Set<string>()
                        };
                    }
                    directoryListingInfos.forEach(info => {
                        this.context.retrievedSoFar!.directoryListings.add(info.path);
                    });
                    
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

        // FSM Enhancement: Check if diff is essentially empty (LLM signaling "no more changes needed")
        if (this.isDiffEffectivelyEmpty(parsed.modifiedDiff)) {
            console.log('🔍 Diff is effectively empty (LLM signaling no more changes needed), transitioning to VERIFYING');
            await this.agentStateService.transition(AgentState.VERIFYING, 'modifications_complete');
            this.state = State.SendVerificationPrompt;
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
            // 修正適用成功 → FSMをVERIFYINGに遷移させて検証プロンプトへ
            console.log('✅ Diff applied successfully, transitioning to VERIFYING state');
            await this.agentStateService.transition(AgentState.VERIFYING, 'diff_applied_successfully');
            this.state = State.SendVerificationPrompt;
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
        
        // FSM System Stateを取得
        const currentAgentState = this.agentStateService.getCurrentState();
        const systemState = formatSystemState(currentAgentState);
        
        const promptModified = this.config.readPromptModifiedEnhancedFile(
            modifiedFiles, 
            enhancedPlan, 
            currentThought,
            '', // filesRequested (必要に応じて設定)
            '', // previousModifications (必要に応じて設定)
            '', // previousThought (必要に応じて設定)
            '', // previousPlan (必要に応じて設定)
            this.correctionGoals, // correctionGoals
            crossReferenceContext, // crossReferenceContext
            systemState // FSM System State
        );
        
        this.currentMessages = await this.sendMessageWithSummarizer("user", promptModified);
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;

        // ターン数とトークン数を更新
        this.currentTurn++;
        const usage = llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
        this.totalPromptTokens += usage.prompt_tokens;
        this.totalCompletionTokens += usage.completion_tokens;

        // トリガー層3: ターン完了時の要約チェック
        await this.conversationSummarizer.onTurnComplete(this.currentTurn);

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
        // エラーコンテキストが保存されている場合はそれを使用
        let previousState: AgentState;
        let errorMessage: string;
        let errorType: string;
        
        if (this.errorRecoveryContext.previousState) {
            // 保存されたコンテキストを使用
            previousState = this.errorRecoveryContext.previousState;
            errorMessage = this.errorRecoveryContext.errorMessage || 'Unknown error';
            errorType = this.errorRecoveryContext.errorType || 'UnknownError';
            console.log(`🔄 Using captured error context: ${errorType} from ${previousState}`);
        } else {
            // フォールバック: 現在の状態を使用
            previousState = this.agentStateService.getCurrentState();
            const rawError = this.context.error || 'Invalid tags detected in your previous response';
            errorMessage = typeof rawError === 'string' ? rawError : rawError.message;
            errorType = this.determineErrorType(errorMessage);
            console.warn(`⚠️ No captured error context, using current state: ${previousState}`);
        }
        
        // FSM: まずERROR状態に遷移（previousStateがERRORでない場合）
        const currentState = this.agentStateService.getCurrentState();
        if (currentState !== AgentState.ERROR) {
            console.log(`🔄 FSM: Transitioning from ${previousState} to ERROR`);
            await this.agentStateService.transition(AgentState.ERROR, 'error_detected');
        }
        
        // FSM: ERROR状態からANALYSIS状態に遷移
        console.log(`🔄 FSM: Transitioning from ERROR to ANALYSIS for recovery`);
        await this.agentStateService.transition(AgentState.ANALYSIS, 'error_recovery_start');
        
        // Error Contextの構築（指定フォーマット）
        const errorContext = this.buildErrorContext(errorType, errorMessage, previousState);
        
        // Current Working Setの構築（指定フォーマット）
        const currentWorkingSet = this.buildCurrentWorkingSet();
        
        // FSM System Stateを取得（ANALYSIS状態）
        const currentAgentState = this.agentStateService.getCurrentState();
        const systemState = formatSystemState(currentAgentState);
        
        // 通常プロンプトにError Contextを注入
        // readFirstPromptFile()を使用し、Error ContextをContextセクションに追加
        console.log('📢 Sending error recovery prompt using standard template with error context injection');
        const errorPrompt = this.fileManager.readFirstPromptFileWithErrorContext(
            systemState,
            errorContext,
            currentWorkingSet
        );
        
        this.currentMessages = await this.sendMessageWithSummarizer("user", errorPrompt);
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;

        // ターン数とトークン数を更新
        this.currentTurn++;
        const usage = llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
        this.totalPromptTokens += usage.prompt_tokens;
        this.totalCompletionTokens += usage.completion_tokens;

        // トリガー層3: ターン完了時の要約チェック
        await this.conversationSummarizer.onTurnComplete(this.currentTurn);

        // ログ記録
        this.logger.addInteractionLog(
            this.currentTurn,
            new Date().toISOString(),
            {
                prompt_template: '00_prompt_gem.txt (with error context)',
                full_prompt_content: errorPrompt
            },
            {
                raw_content: llm_response?.choices?.[0]?.message?.content || '',
                parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                usage: usage
            },
            {
                type: 'ERROR_RECOVERY',
                details: `Error recovery using standard prompt with context injection. FSM state: ANALYSIS. Error type: ${errorType}, Message: ${errorMessage}`
            }
        );
    }

    /**
     * タグ違反時の軽量なcorrective retryを実行
     * FSM状態は変更せず、補助文付きで同じプロンプトを再送信
     */
    /**
     * No Progress時の処理: LLMが行き詰まった時のフォールバック
     * 【改善版】追加コンテキストを提供して1回リトライする
     */
    private async handleNoProgress(): Promise<void> {
        console.log('🔄 No Progress: LLM has exhausted its exploration, checking for modifications...');
        
        const parsed = this.context.llmParsed;
        const currentState = this.agentStateService.getCurrentState();
        
        // これまでに修正があったか確認
        if (parsed?.modifiedDiff) {
            console.log('✅ Found modifications despite no progress, applying and transitioning to VERIFYING');
            this.context.diff = parsed.modifiedDiff;
            
            // MODIFYING状態へ遷移してパッチ適用
            await this.agentStateService.transition(AgentState.MODIFYING, 'no_progress_with_modifications');
            this.state = State.SystemParseDiff;
        } else {
            console.log('ℹ️  No modifications found, attempting recovery with additional context...');
            
            // 【改善】リトライフラグの確認
            if (!this.context.noProgressRetried) {
                console.log('🔄 First no-progress detection: attempting retry with enhanced context...');
                this.context.noProgressRetried = true;
                
                // 追加コンテキストを提供してリトライ
                await this.retryWithEnhancedContext();
                return;
            }
            
            // リトライ後も改善しなかった場合
            console.log('⚠️  No improvement after retry, proceeding to no-progress verification...');
            
            // No Progressフラグを設定（システム判定であることを明示）
            if (!parsed) {
                // 空のparsedオブジェクトを作成
                this.context.llmParsed = this.messageHandler.analyzeMessages('', this.agentStateService.getCurrentState());
            }
            if (this.context.llmParsed) {
                this.context.llmParsed.no_progress_fallback = true;
                console.log('🔄 Set no_progress_fallback flag (system-determined)');
            }
            
            // 修正不要として扱う
            // ANALYSIS状態の場合もVERIFYINGに遷移して検証を行う
            if (currentState === AgentState.ANALYSIS) {
                // ANALYSISからVERIFYINGへ遷移して判断を検証
                await this.agentStateService.transition(AgentState.VERIFYING, 'no_progress_to_verification');
                this.state = State.SendVerificationPrompt;
            } else {
                // MODIFYING等の場合はVERIFYINGへ遷移
                await this.agentStateService.transition(AgentState.VERIFYING, 'no_progress_no_changes');
                this.state = State.SendVerificationPrompt;
            }
        }
    }
    
    /**
     * 【新規】No Progress時の追加コンテキスト提供によるリトライ
     */
    private async retryWithEnhancedContext(): Promise<void> {
        console.log('🔄 Providing enhanced context to help LLM find modification points...');
        
        // Ground Truthの変更ファイル情報を取得
        const gtFiles = this.context.groundTruthChangedFiles || [];
        const gtFileList = gtFiles.length > 0 
            ? `\n\n**Hint**: The actual commit modified these files:\n${gtFiles.map(f => `- ${f}`).join('\n')}\n\nConsider why these files might need changes based on the commit message.`
            : '';
        
        // 強化されたガイダンス
        const enhancedGuidance = `
**Important Reminder**: You have not made progress. Let's reconsider the task:

1. **Re-read the commit message carefully**: What is the core intent? What functionality is being added, fixed, or changed?

2. **Identify the modification points**: Based on the commit message, which files and functions need to be modified?

3. **Don't give up too easily**: If you can't find the exact location, make a reasonable inference based on:
   - Function names mentioned in the commit message
   - Typical patterns in this codebase
   - Similar changes you've seen before${gtFileList}

4. **Proceed with modification**: Even if you're not 100% certain, provide your best attempt at the modification. The verification step will catch any issues.

**Remember**: It's better to attempt a modification and refine it than to conclude "no changes needed" when the commit message clearly indicates changes were made.
`;
        
        // 現在のメッセージに追加コンテキストを挿入
        const enhancedMessage = {
            role: 'user' as const,
            content: enhancedGuidance
        };
        
        this.currentMessages.push(enhancedMessage);
        
        // LLMを呼び出し
        console.log('📤 Sending retry request with enhanced guidance...');
        this.state = State.SendInfoToLLM;
    }

    private async performCorrectiveRetry(currentState: AgentState) {
        console.log('🔄 Performing corrective retry with tag violation note');
        
        // タグ違反通知文
        const tagViolationNote = `Note:
The previous response used a tag that is not allowed in the current state.
Please respond again using only the allowed tags.`;
        
        // FSM System State（補助文付き）
        const systemState = formatSystemState(currentState, tagViolationNote);
        
        // currentMessagesが空の場合はsendErrorToLLMにフォールバック
        if (!this.currentMessages || this.currentMessages.length === 0) {
            console.warn('⚠️ currentMessages is empty, falling back to sendErrorToLLM');
            this.captureErrorContext('Tag violation with empty message history');
            await this.agentStateService.transition(AgentState.ERROR, 'corrective_retry_failed');
            this.state = State.SendErrorToLLM;
            return;
        }
        
        // 最後に送信したプロンプトと同じ内容を再構築
        // （currentMessagesの最後のuserメッセージを使用）
        const lastUserMessage = this.currentMessages[this.currentMessages.length - 1];
        if (!lastUserMessage || lastUserMessage.role !== 'user') {
            console.error('❌ Cannot perform corrective retry: no user message found');
            console.warn('⚠️ Falling back to sendErrorToLLM');
            this.captureErrorContext('Tag violation with invalid message history');
            await this.agentStateService.transition(AgentState.ERROR, 'corrective_retry_no_user_message');
            this.state = State.SendErrorToLLM;
            return;
        }
        
        // 元のプロンプトのsystemState部分だけを置き換え
        // （簡易実装: 直接LLMに再送信）
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;
        
        // LLM応答を解析（ターン数は増やさない）
        const content = llm_response?.choices?.[0]?.message?.content || '';
        this.context.llmParsed = this.messageHandler.analyzeMessages(content);
        
        // トークン数のみ更新
        const usage = llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
        this.totalPromptTokens += usage.prompt_tokens;
        this.totalCompletionTokens += usage.completion_tokens;
        
        console.log(`✅ Corrective retry completed (retry ${this.tagViolationRetryCount}/${this.maxTagViolationRetries})`);
        
        // llmDecision()に戻って再検証
        await this.llmDecision();
    }

    /**
     * 調査フェーズから強制的に修正フェーズへ移行するプロンプトを送信
     * INVESTIGATION_PHASE問題を解決するための機能
     */
    private async sendForceModificationPrompt(): Promise<void> {
        console.log('🔄 Sending force modification prompt to exit investigation phase...');
        
        // 収集したファイル情報のサマリーを作成
        const collectedFiles = [...this.internalProgress.contextAccumulated.sourceFiles];
        const filesSummary = collectedFiles.length > 0
            ? `Files collected so far (${collectedFiles.length}):\n${collectedFiles.slice(0, 10).map(f => `- ${f}`).join('\n')}${collectedFiles.length > 10 ? `\n... and ${collectedFiles.length - 10} more` : ''}`
            : 'No files collected yet.';
        
        const forceModificationPrompt = `
## IMPORTANT: Investigation Phase Limit Reached ##

You have made ${this.consecutiveFileRequestCount} consecutive file requests without producing any modifications.
The investigation phase is now complete. You MUST now proceed to the modification phase.

**Current Status:**
${filesSummary}

**Required Action:**
Based on the commit message and proto changes you've analyzed, you MUST now:
1. Produce a concrete modification (%_Modified_% tag) based on your analysis
2. OR explicitly conclude that no changes are needed (%_No_Changes_Needed_% tag) with clear justification

**Reminder of the Task:**
- Analyze the proto file changes
- Identify what handwritten code needs to be updated
- Apply the necessary modifications

**Do NOT request more files.** Use what you have collected to make your best determination.

You are now in the MODIFYING state. Please provide your output:
`;
        
        // メッセージを送信
        this.currentMessages = await this.sendMessageWithSummarizer("user", forceModificationPrompt);
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;
        
        // ターン数とトークン数を更新
        this.currentTurn++;
        const usage = llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
        this.totalPromptTokens += usage.prompt_tokens;
        this.totalCompletionTokens += usage.completion_tokens;
        
        // LLM応答を解析
        const content = llm_response?.choices?.[0]?.message?.content || '';
        const currentAgentState = this.agentStateService.getCurrentState();
        this.context.llmParsed = this.messageHandler.analyzeMessages(content, currentAgentState);
        
        console.log('✅ Force modification prompt sent, processing response...');
        
        // llmDecision()で応答を処理
        await this.llmDecision();
    }

    /**
     * エラー発生時のコンテキストを保存
     */
    private captureErrorContext(errorMessage: string | Error) {
        const currentState = this.agentStateService.getCurrentState();
        const errorString = typeof errorMessage === 'string' ? errorMessage : errorMessage.message;
        
        this.errorRecoveryContext = {
            previousState: currentState,
            errorMessage: errorString,
            errorType: this.determineErrorType(errorString),
            occurredAt: new Date().toISOString(),
            modifiedFilesSnapshot: this.extractModifiedFiles(),
            requestedFilesSnapshot: [...this.internalProgress.contextAccumulated.sourceFiles]
        };
        
        console.log(`📸 Error context captured: ${this.errorRecoveryContext.errorType} at ${currentState}`);
    }

    /**
     * エラータイプを決定
     */
    private determineErrorType(errorMessage: string): string {
        if (errorMessage.includes('tag') || errorMessage.includes('Tag')) {
            return 'TagValidationError';
        } else if (errorMessage.includes('patch') || errorMessage.includes('diff') || errorMessage.includes('hunk')) {
            return 'PatchApplyError';
        } else if (errorMessage.includes('parse') || errorMessage.includes('Parse')) {
            return 'ResponseParseError';
        } else if (errorMessage.includes('state') || errorMessage.includes('State')) {
            return 'StateTransitionError';
        } else {
            return 'UnknownError';
        }
    }

    /**
     * Error Contextを構築（指定フォーマット）
     */
    private buildErrorContext(errorType: string, errorMessage: string, previousState: AgentState): string {
        let errorContext = 'last_error:\n';
        errorContext += `  type: ${errorType}\n`;
        errorContext += `  message: "${errorMessage}"\n`;
        // AWAITING_INFOはLLMに見せない内部状態なので、INTERNAL_FETCHと表示
        const displayState = previousState === AgentState.AWAITING_INFO ? 'INTERNAL_FETCH' : previousState;
        errorContext += `  previous_state: ${displayState}\n`;
        return errorContext;
    }

    /**
     * 現在の作業セット（これまでの処理内容）を構築（指定フォーマット）
     */
    private buildCurrentWorkingSet(): string {
        let workingSet = '';

        // Proto change summary
        const protoChangeSummary = this.extractProtoChangeSummary();
        if (protoChangeSummary) {
            workingSet += `- proto change summary: ${protoChangeSummary}\n`;
        }

        // Last modified files
        const modifiedFiles = this.extractModifiedFiles();
        if (modifiedFiles.length > 0) {
            workingSet += '- last modified files:\n';
            modifiedFiles.forEach(file => {
                workingSet += `  - ${file}\n`;
            });
        }

        // Last requested files
        const requestedFiles = this.internalProgress.contextAccumulated.sourceFiles;
        if (requestedFiles.length > 0) {
            workingSet += '- last requested files:\n';
            requestedFiles.slice(-5).forEach(file => { // 最後の5ファイルのみ
                workingSet += `  - ${file}\n`;
            });
        }

        if (!workingSet) {
            workingSet = '- no previous work recorded (early-stage error)\n';
        }

        return workingSet;
    }

    /**
     * Proto変更のサマリーを抽出
     */
    private extractProtoChangeSummary(): string {
        // protoFileChangesから主要な変更を抽出
        try {
            const protoChanges = this.protoFileChanges || '';
            if (!protoChanges) return '';
            
            // 簡単なパターンマッチングで主要な変更を抽出
            const lines = protoChanges.split('\n');
            const additions = lines.filter(line => line.trim().startsWith('+')).slice(0, 3);
            
            if (additions.length > 0) {
                return additions.map(line => line.trim().substring(1).trim()).join(', ');
            }
            
            return 'proto structure changes detected';
        } catch (error) {
            return 'proto changes (details unavailable)';
        }
    }

    /**
     * 修正したファイル一覧を抽出
     */
    private extractModifiedFiles(): string[] {
        const modifiedFiles: string[] = [];
        
        try {
            // context.diffからファイル名を抽出
            if (this.context.diff) {
                const diffLines = this.context.diff.split('\n');
                for (const line of diffLines) {
                    if (line.startsWith('---') || line.startsWith('+++')) {
                        const match = line.match(/[+-]{3}\s+([^\s]+)/);
                        if (match && match[1] !== '/dev/null') {
                            const filename = match[1].replace(/^[ab]\//, '');
                            if (!modifiedFiles.includes(filename)) {
                                modifiedFiles.push(filename);
                            }
                        }
                    }
                }
            }
            
            // ログからも抽出
            const logs = this.logger.getInteractionLog();
            for (const log of logs.slice(-3)) { // 最後の3ターン
                const parsedContent = log.llm_response?.parsed_content;
                if (parsedContent?.modified_diff) {
                    const diffLines = parsedContent.modified_diff.split('\n');
                    for (const line of diffLines) {
                        if (line.startsWith('---') || line.startsWith('+++')) {
                            const match = line.match(/[+-]{3}\s+([^\s]+)/);
                            if (match && match[1] !== '/dev/null') {
                                const filename = match[1].replace(/^[ab]\//, '');
                                if (!modifiedFiles.includes(filename)) {
                                    modifiedFiles.push(filename);
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to extract modified files:', error);
        }
        
        return modifiedFiles.slice(0, 5); // 最大5ファイルまで
    }

    /**
     * 旧buildCurrentWorkingSet（下位互換性のため保持）
     * @deprecated Use the new buildCurrentWorkingSet() instead
     */
    private buildCurrentWorkingSetLegacy(): string {
        const parsed = this.context.llmParsed;
        let workingSet = '';

        // 前回の思考内容
        if (parsed?.thought) {
            workingSet += `### Your Previous Thought ###\n${parsed.thought}\n\n`;
        }

        // 前回の計画
        if (parsed?.plan) {
            workingSet += `### Your Previous Plan ###\n`;
            if (typeof parsed.plan === 'string') {
                workingSet += `${parsed.plan}\n\n`;
            } else {
                workingSet += `${JSON.stringify(parsed.plan, null, 2)}\n\n`;
            }
        }

        // Correction Goals
        if (this.correctionGoals) {
            workingSet += `### Correction Goals ###\n${this.correctionGoals}\n\n`;
        }

        // これまでに要求したファイル
        const requestedFiles = this.internalProgress.contextAccumulated.sourceFiles;
        if (requestedFiles.length > 0) {
            workingSet += `### Files You Have Requested ###\n`;
            requestedFiles.forEach(file => {
                workingSet += `- ${file}\n`;
            });
            workingSet += '\n';
        }

        // これまでに生成したパッチ
        if (this.context.diff) {
            workingSet += `### Your Previous Modifications ###\n`;
            workingSet += `\`\`\`diff\n${this.context.diff.substring(0, 500)}...\n\`\`\`\n\n`;
        }

        if (!workingSet) {
            workingSet = 'No previous work recorded yet. This is an early-stage error.\n';
        }

        return workingSet;
    }

    /**
     * LLM応答からパッチ内容を抽出してfinal_patch.diffとして保存
     * @returns パッチ抽出に成功した場合true、失敗した場合false
     */
    private async extractAndSavePatch(llmContent: string): Promise<boolean> {
        try {
            // パッチブロックを抽出（diff形式を探す）
            const patchPatterns = [
                // ```diff ブロック
                /```diff\n([\s\S]*?)```/gi,
                // ```patch ブロック
                /```patch\n([\s\S]*?)```/gi,
                // --- ... +++ ... から始まるdiff形式
                /(^--- .*?\n\+\+\+ .*?\n[\s\S]*?)(?=\n\n|\n---|$)/gm
            ];

            let extractedPatches: string[] = [];
            
            for (const pattern of patchPatterns) {
                const matches = llmContent.matchAll(pattern);
                for (const match of matches) {
                    const patchContent = match[1] || match[0];
                    if (patchContent && patchContent.trim().length > 0) {
                        extractedPatches.push(patchContent.trim());
                    }
                }
            }

            if (extractedPatches.length === 0) {
                console.log('⚠️  No patch content found in LLM response');
                return false;
            }

            // 複数のパッチを結合
            const combinedPatch = extractedPatches.join('\n\n');
            
            // 出力パス構築（inputPremergeDir + final_patch.diff）
            const outputPath = path.join(this.inputPremergeDir, 'final_patch.diff');
            
            // ファイルに保存
            await fs.promises.writeFile(outputPath, combinedPatch, 'utf-8');
            
            const patchLines = combinedPatch.split('\n').length;
            const patchSize = Buffer.byteLength(combinedPatch, 'utf-8');
            
            console.log(`✅ Patch file generated: ${outputPath}`);
            console.log(`   📊 Size: ${patchLines} lines, ${patchSize} bytes`);
            console.log(`   📦 Extracted ${extractedPatches.length} patch block(s)`);
            
            return true;
        } catch (error) {
            console.error(`❌ Failed to extract and save patch:`, error);
            return false;
        }
    }

    // =============================================================================
    // 終了処理
    // =============================================================================

    private async finish() {
        // 実験メタデータを設定
        const endTime = new Date().toISOString();
        const experimentId = this.generateExperimentId();
        
        // FSM状態に基づく完了判定（優先）
        let status: typeof APRStatus[keyof typeof APRStatus];
        const currentFSMState = this.agentStateService.getCurrentState();
        
        // 完了カテゴリの判定（Priority 3）
        let completionType: 'patch_generated' | 'llm_no_changes' | 'system_no_progress' | 'incomplete' | 'error' = 'incomplete';
        const hasNoChangesNeeded = this.context.llmParsed?.has_no_changes_needed || false;
        const noProgressFallback = this.context.llmParsed?.no_progress_fallback || false;
        
        if (currentFSMState === AgentState.FINISHED) {
            // FSMがFINISHED状態に到達した場合、理由を判定
            // 優先度: LLMの明示的判断 > パッチ生成の証拠 > システム推測
            
            if (this.context.llmParsed?.has_no_changes_needed) {
                // 優先度1: No Changes Needed = LLMの明示的判断（最優先）
                status = APRStatus.NO_CHANGES_NEEDED;
                completionType = 'llm_no_changes';
                console.log(`✅ Status: '${APRStatus.NO_CHANGES_NEEDED}' via FSM + explicit tag (Priority 1)`);
            } else if (this.context.llmParsed?.has_verification_report) {
                // 優先度2: Verification Report = パッチ生成の可能性
                // パッチファイル生成を試行：最終的な応答からパッチを抽出
                const lastLLMContent = this.context.llmResponse?.choices?.[0]?.message?.content || '';
                const patchExtracted = await this.extractAndSavePatch(lastLLMContent);
                
                if (patchExtracted) {
                    // パッチが実際に抽出できた場合のみpatch_generated
                    status = APRStatus.FINISHED;
                    completionType = 'patch_generated';
                    console.log(`✅ Status: '${APRStatus.FINISHED}' - patch extracted successfully (Priority 2a)`);
                } else {
                    // Verification Reportはあるがパッチコードがない場合
                    // -> LLMがNo Changesと判断した可能性が高い
                    status = APRStatus.NO_CHANGES_NEEDED;
                    completionType = 'llm_no_changes';
                    console.log(`✅ Status: '${APRStatus.NO_CHANGES_NEEDED}' - verification report without patch (Priority 2b)`);
                }
                
                // 成功の証拠があるため、no_progress_fallbackフラグをクリア
                if (this.context.llmParsed.no_progress_fallback) {
                    console.log(`   🔄 Clearing no_progress_fallback flag due to verification flow`);
                    this.context.llmParsed.no_progress_fallback = false;
                }
            } else if (this.context.llmParsed?.no_progress_fallback) {
                // 優先度3: No Progress Fallback = システムの推測（フォールバック）
                status = APRStatus.INCOMPLETE;
                completionType = 'system_no_progress';
                console.log(`✅ Status: '${APRStatus.INCOMPLETE}' via FSM + system fallback (Priority 3)`);
            } else {
                // フォールバック: FSMがFINISHEDだが理由不明
                status = APRStatus.FINISHED;
                completionType = 'patch_generated'; // デフォルトはパッチ生成とみなす
                console.log(`✅ Status: '${APRStatus.FINISHED}' - reached FINISHED state (default to patch_generated)`);
            }
        } else {
            // FSMがFINISHEDでない場合の従来ロジック（後方互換性）
            status = this.context.llmParsed?.has_fin_tag ? APRStatus.FINISHED : APRStatus.INCOMPLETE;
            
            // 優先1: %_No_Changes_Needed_%タグによる完了
            if (this.context.llmParsed?.has_no_changes_needed) {
                status = APRStatus.NO_CHANGES_NEEDED;
                completionType = 'llm_no_changes'; // LLM明示判断
                console.log(`✅ Status: '${APRStatus.NO_CHANGES_NEEDED}' via explicit tag (legacy path)`);
            }
        }
        
        // 後処理による完了判定ロジック（安全策・フォールバック）- FSMが正しく動作すればこのパスは通らない
        if (currentFSMState !== AgentState.FINISHED && status === APRStatus.INCOMPLETE && !this.context.llmParsed?.has_fin_tag) {
            console.warn('⚠️ FSM did not reach FINISHED state, falling back to implicit completion logic');
            
            // ログ内に一度でも%_Modified_%が存在した場合の暗黙的完了判定
            const hasModification = this.logger.getInteractionLog().some((turn: any) => 
                turn.llm_response?.parsed_content?.modified_diff || 
                turn.llm_response?.raw_content?.includes('%_Modified_%')
            );
            
            if (hasModification) {
                status = APRStatus.FINISHED; // 暗黙的な完了としてステータスを更新
                completionType = 'patch_generated'; // パッチ生成
                console.log(`✅ Status updated to 'Completed (Implicit)' based on fallback post-processing logic.`);
                console.log(`   Reason: Found %_Modified_% tag without explicit %%_Fin_%% tag`);
            }
            // 修正不要と判断したケース（暗黙的検出・フォールバック）
            else {
                const interactionLog = this.logger.getInteractionLog();
                if (interactionLog.length > 0) {
                    const lastTurn = interactionLog[interactionLog.length - 1] as any;
                    const replyRequired = lastTurn.llm_response?.parsed_content?.reply_required;
                    const thought = lastTurn.llm_response?.parsed_content?.thought || '';
                    
                    if (replyRequired && Array.isArray(replyRequired) && replyRequired.length === 0) {
                        const noModsKeywords = [
                            'no code modifications',
                            'no modifications needed',
                            'no fixes needed',
                            'nothing to change',
                            'not appropriate',
                            'preparatory only',
                            'no changes required',
                            'no modifications are appropriate'
                        ];
                        
                        if (noModsKeywords.some(keyword => thought.toLowerCase().includes(keyword))) {
                            status = APRStatus.NO_CHANGES_NEEDED;
                            completionType = 'system_no_progress'; // システム自動判定（暗黙的）
                            console.log(`✅ Status updated to '${APRStatus.NO_CHANGES_NEEDED}' based on analysis.`);
                            console.log(`   Reason: Empty reply_required with "no modifications" reasoning (fallback detection)`);
                        }
                    }
                }
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
        
        // 完了カテゴリ統計の出力（Priority 3）
        console.log('\n📊 Completion Category Stats:');
        console.log(`   Type: ${completionType}`);
        console.log(`   LLM No Changes Needed (explicit): ${hasNoChangesNeeded}`);
        console.log(`   System No Progress (fallback): ${noProgressFallback}`);
        
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
            summaryTokensUsed, // 要約トークン数を渡す
            { // 完了カテゴリ統計（Priority 3）
                type: completionType,
                has_no_changes_needed: hasNoChangesNeeded,
                no_progress_fallback: noProgressFallback
            }
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
     * 
     * 重要: 要約によってファイル内容が会話履歴から消えても、LLMは
     * 実際の会話履歴にあるファイルのみを「見た」と認識する。
     * そのため、internalProgressではなく実際の会話履歴から取得する。
     */
    private getProcessedFilePaths(): Set<string> {
        const processed = new Set<string>();
        
        // 実際の会話履歴から提供済みファイルを抽出
        // これによりLLMが実際にアクセス可能なファイルのみをトラッキング
        const currentMessages = this.conversationSummarizer.getCurrentMessages();
        
        for (const msg of currentMessages) {
            if (msg.role === 'user') {
                // ファイル提供を示すパターンを検索
                // パターン1: "## File: path/to/file.go"
                const fileHeaderMatches = msg.content.matchAll(/^## File: (.+)$/gm);
                for (const match of fileHeaderMatches) {
                    processed.add(match[1].trim());
                }
                
                // パターン2: "Reading file: path/to/file.go"
                const readingMatches = msg.content.matchAll(/Reading file: (.+)$/gm);
                for (const match of readingMatches) {
                    processed.add(match[1].trim());
                }
                
                // パターン3: "📄 File: path/to/file.go"
                const emojiMatches = msg.content.matchAll(/📄 File: (.+)$/gm);
                for (const match of emojiMatches) {
                    processed.add(match[1].trim());
                }
            }
        }
        
        // フォールバック: internalProgressも参照（要約前のファイルを保持）
        // ただし、これは二次的な情報源として扱う
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

        // 重複ファイルのみの場合はLLMに通知してパッチ生成を促す
        if (analysisResult.newFiles.length === 0 && analysisResult.duplicateFiles.length > 0) {
            this.logger.logWarning(`All ${analysisResult.duplicateFiles.length} files already processed, informing LLM to proceed with current context`);
            
            // エラーコンテキストに記録（エラープロンプトで使用）
            this.errorRecoveryContext.errorMessage = 
                `The files you requested (${analysisResult.duplicateFiles.map(f => f.path).join(', ')}) have already been provided earlier in the conversation. ` +
                `Please use the information from those files to generate your patch, or request different files if you need additional context.`;
            this.errorRecoveryContext.errorType = 'DUPLICATE_FILE_REQUEST';
            this.errorRecoveryContext.occurredAt = new Date().toISOString();
            
            // エラープロンプトで対応を促す
            return State.SendErrorToLLM;
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
                
                // トリガー層2: LLM送信直前の最終安全チェック
                this.currentMessages = await this.conversationSummarizer.preSendCheck();
                
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
            // llm.modelを優先し、次にopenai.model、環境変数、最後にデフォルト
            return this.config.get('llm.model', this.config.get('openai.model', process.env.OPENAI_MODEL || 'gpt-5.1-chat-latest'));
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
     * Check if a diff is effectively empty (LLM signaling "no more changes needed")
     * This handles cases where LLM returns %_Modified_% with phrases like "(No changes needed)"
     */
    private isDiffEffectivelyEmpty(diff: string): boolean {
        if (!diff || diff.trim().length === 0) {
            return true;
        }

        const normalizedDiff = diff.toLowerCase().trim();
        
        // Common phrases indicating no actual diff content
        const emptyPatterns = [
            /^\(no\s+changes?\s+needed\)$/i,
            /^no\s+changes?\s+needed\.?$/i,
            /^no\s+further\s+changes?/i,
            /^no\s+additional\s+changes?/i,
            /^none\.?$/i,
            /^\(none\)$/i,
            /^n\/a$/i,
            /^no\s+modifications?/i,
            /^\(no\s+modifications?\s+required/i,
            /^all\s+changes?\s+complete/i,
            /^modifications?\s+complete/i,
            /^no\s+diff/i,
            /^empty$/i,
            /^\/\/.*transition.*verifying/i,  // Comments about transitioning
            /all\s+code\s+is\s+correct/i,
            /no\s+further\s+modifications?\s+(are\s+)?necessary/i,
            /no\s+handwritten\s+files/i,
            /only\s+auto-?generated\s+files/i,
            /no\s+suspected\s+files/i,
        ];

        for (const pattern of emptyPatterns) {
            if (pattern.test(normalizedDiff)) {
                console.log(`🔍 Diff matches empty pattern: ${pattern}`);
                return true;
            }
        }

        // Check if the diff has no actual diff content (no +/- lines except headers)
        const lines = diff.split('\n');
        let hasActualChanges = false;
        for (const line of lines) {
            // Skip empty lines, comments, and headers
            if (line.trim().length === 0) continue;
            if (line.startsWith('//')) continue;
            if (line.startsWith('#')) continue;
            if (line.startsWith('---')) continue;
            if (line.startsWith('+++')) continue;
            if (line.startsWith('@@')) continue;
            
            // Check for actual change lines
            if (line.startsWith('+') || line.startsWith('-')) {
                hasActualChanges = true;
                break;
            }
            
            // Context lines (starting with space) are valid diff content
            if (line.startsWith(' ')) {
                hasActualChanges = true;
                break;
            }
        }

        if (!hasActualChanges) {
            console.log('🔍 Diff has no actual change lines (+/- or context)');
            return true;
        }

        return false;
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

    /**
     * ValidationErrorをcorrective retry経由で処理
     */
    private async handleValidationError(error: ValidationError): Promise<void> {
        console.log(`🔄 Handling ValidationError: ${error.type}`);
        
        // タグ違反リトライカウントを増加
        this.tagViolationRetryCount++;
        
        // 上限チェック
        if (this.tagViolationRetryCount > this.maxTagViolationRetries) {
            console.error(`❌ Max validation retries (${this.maxTagViolationRetries}) exceeded`);
            this.captureErrorContext(error.message);
            await this.agentStateService.transition(AgentState.ERROR, 'validation_retry_limit_exceeded');
            this.state = State.End;
            return;
        }
        
        console.log(`🔄 Validation retry ${this.tagViolationRetryCount}/${this.maxTagViolationRetries}`);
        
        // FSM状態は変更しない（現在の状態を維持）
        const currentState = this.agentStateService.getCurrentState();
        
        // LLMへのフィードバックメッセージを生成
        const feedbackMessage = error.toFeedbackMessage();
        
        // FSM System State（フィードバック付き）
        const systemState = formatSystemState(currentState, feedbackMessage);
        
        // currentMessagesが空の場合はsendErrorToLLMにフォールバック
        if (!this.currentMessages || this.currentMessages.length === 0) {
            console.warn('⚠️ currentMessages is empty, falling back to sendErrorToLLM');
            this.captureErrorContext(error.message);
            await this.agentStateService.transition(AgentState.ERROR, 'validation_retry_no_history');
            this.state = State.SendErrorToLLM;
            return;
        }
        
        // 最後に送信したプロンプトを再構築
        const lastUserMessage = this.currentMessages[this.currentMessages.length - 1];
        if (!lastUserMessage || lastUserMessage.role !== 'user') {
            console.error('❌ Cannot perform validation retry: no user message found');
            console.warn('⚠️ Falling back to sendErrorToLLM');
            this.captureErrorContext(error.message);
            await this.agentStateService.transition(AgentState.ERROR, 'validation_retry_invalid_history');
            this.state = State.SendErrorToLLM;
            return;
        }
        
        // 元のプロンプトにフィードバックを埋め込み（System State部分を更新）
        let retryPrompt = lastUserMessage.content;
        
        // System State部分を新しいもので置換（System State ##...## の間を置換）
        const systemStateRegex = /## System State ##\s*\n([\s\S]*?)(?=\n---\n|$)/;
        if (systemStateRegex.test(retryPrompt)) {
            retryPrompt = retryPrompt.replace(systemStateRegex, `## System State ##\n${systemState}\n\n`);
        }
        
        // LLMに再送信
        this.currentMessages = await this.sendMessageWithSummarizer("user", retryPrompt);
        const llm_response = await this.openAIClient.fetchOpenAPI(this.currentMessages);
        this.context.llmResponse = llm_response;
        
        // ターン数とトークン数を更新
        this.currentTurn++;
        const usage = llm_response?.usage || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
        this.totalPromptTokens += usage.prompt_tokens;
        this.totalCompletionTokens += usage.completion_tokens;
        
        // 要約チェック
        await this.conversationSummarizer.onTurnComplete(this.currentTurn);
        
        // ログ記録
        this.logger.addInteractionLog(
            this.currentTurn,
            new Date().toISOString(),
            {
                prompt_template: 'validation_retry',
                full_prompt_content: retryPrompt
            },
            {
                raw_content: llm_response?.choices?.[0]?.message?.content || '',
                parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                usage: usage
            },
            {
                type: 'VALIDATION_RETRY',
                details: `Validation error: ${error.type}. Retry ${this.tagViolationRetryCount}/${this.maxTagViolationRetries}. Path: ${error.path}`
            }
        );
        
        // 次の状態へ遷移（元の処理フローに戻る）
        this.state = State.LLMReanalyze;
    }
}

export default LLMFlowController;