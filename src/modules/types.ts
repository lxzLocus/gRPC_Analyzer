/**
 * 型定義ファイル
 * プロジェクト全体で使用する共通の型定義
 */

// 詳細なファイル情報リクエストタイプ
export type FileContentSubType = 
    | 'SOURCE_CODE'      // ソースコード内容
    | 'CONFIG_FILE'      // 設定ファイル
    | 'PROTO_FILE'       // .protoファイル
    | 'TEST_FILE'        // テストファイル
    | 'DOCUMENTATION'    // ドキュメントファイル
    | 'BUILD_FILE'       // ビルド設定ファイル
    | 'GENERAL';         // その他

export type DirectoryListingSubType = 
    | 'PROJECT_STRUCTURE'  // プロジェクト全体の構造
    | 'SOURCE_DIRECTORY'   // ソースディレクトリ
    | 'TEST_DIRECTORY'     // テストディレクトリ
    | 'CONFIG_DIRECTORY'   // 設定ディレクトリ
    | 'BUILD_DIRECTORY'    // ビルド出力ディレクトリ
    | 'DEPENDENCY_CHECK'   // 依存関係確認
    | 'GENERAL';           // その他

export type RequiredFileInfo = {
    type: 'FILE_CONTENT' | 'DIRECTORY_LISTING';
    path: string;
    subType?: FileContentSubType | DirectoryListingSubType; // サブタイプ
    priority?: 'HIGH' | 'MEDIUM' | 'LOW'; // 優先度
    reason?: string; // リクエスト理由
};

// 内部状態管理用の型
export type ProcessingPhase = 
    | 'INITIAL_ANALYSIS'     // 初期分析フェーズ
    | 'CONTEXT_GATHERING'    // コンテキスト収集フェーズ
    | 'DETAILED_ANALYSIS'    // 詳細分析フェーズ
    | 'SOLUTION_PLANNING'    // 解決策立案フェーズ
    | 'IMPLEMENTATION'       // 実装フェーズ
    | 'VERIFICATION'         // 検証フェーズ
    | 'FINALIZATION';        // 最終化フェーズ

export type InternalProgressState = {
    currentPhase: ProcessingPhase;
    stepsCompleted: string[];
    stepsRemaining: string[];
    contextAccumulated: {
        sourceFiles: string[];
        configFiles: string[];
        protoFiles: string[];
        testFiles: string[];
        directories: string[];
        dependencies: string[];
    };
    analysisDepth: number; // 分析の深度レベル
    iterationCount: number; // 現在の反復回数
    maxIterations: number;  // 最大反復回数
    errorCount: number;     // エラー発生回数
    warningCount: number;   // 警告回数
    lastUpdated?: string;   // 最終更新時刻（オプショナル）
};

export type LLMParsed = {
    thought: string | null;
    plan: string | null;
    requiredFilepaths: string[];
    requiredFileInfos: RequiredFileInfo[]; // 新しいフィールド
    modifiedDiff: string;
    commentText: string;
    has_fin_tag: boolean;
    has_no_changes_needed?: boolean; // LLM明示判断：変更不要タグ（オプショナル）
    // 新しいフィールド：LLMからの進行状況指示
    suggestedPhase?: ProcessingPhase;
    confidenceLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
    expectedIterations?: number;
};

// Logger用の型変換ヘルパー
export type ParsedContentLog = {
    thought: string | null;
    plan: any[] | null;
    reply_required: Array<{
        type: string;
        path: string;
    }>;
    modified_diff: string | null;
    commentText: string | null;
    has_fin_tag: boolean;
};

export type Context = {
    initialInfo?: Record<string, unknown>;
    llmResponse?: {
        choices?: Array<{
            message: {
                content: string;
            };
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

export enum State {
    Start = 'Start',
    PrepareInitialContext = 'PrepareInitialContext',
    SendInitialInfoToLLM = 'SendInitialInfoToLLM',
    LLMAnalyzePlan = 'LLMAnalyzePlan',
    LLMDecision = 'LLMDecision',
    SystemAnalyzeRequest = 'SystemAnalyzeRequest',
    GetFileContent = 'GetFileContent',
    GetDirectoryListing = 'GetDirectoryListing',
    ProcessRequiredInfos = 'ProcessRequiredInfos', // 新しいState
    SendInfoToLLM = 'SendInfoToLLM',
    LLMReanalyze = 'LLMReanalyze',
    SystemParseDiff = 'SystemParseDiff',
    SystemApplyDiff = 'SystemApplyDiff',
    CheckApplyResult = 'CheckApplyResult',
    SendResultToLLM = 'SendResultToLLM',
    LLMNextStep = 'LLMNextStep',
    SendErrorToLLM = 'SendErrorToLLM',
    LLMErrorReanalyze = 'LLMErrorReanalyze',
    End = 'End',
}

// プロンプトテンプレート用の型定義
export type PromptTemplateContext = {
    protoFile: string;
    protoFileChanges: string;
    stubFileChanges: string;  // 新規追加: スタブファイルの差分
    fileChanges: string;
    surroundedFilePath: string;
    suspectedFiles: string;
    pullRequestTitle?: string;
};

// 終了ステータスの型定義
export type CompletionType = 
    | 'patch_generated'      // パッチ生成成功
    | 'llm_no_changes'       // LLM明示判断：変更不要
    | 'system_no_progress'   // システム判定：進捗なし
    | 'incomplete'           // 未完了（最大ターン到達等）
    | 'error';               // エラー

// dialogue.json メタデータの型定義
export type DialogueMetadata = {
    completion_type: CompletionType;
    total_turns: number;
    total_tokens_used: number;
    patch_file_path?: string;
    error_message?: string;
    summarization_count?: number;
    final_token_count?: number;
};

export type PromptFileConfig = {
    promptTextfile: string;
    protoFile: string;
    protoFileChanges: string;
    stubFileChanges: string;  // 新規追加
    fileChanges: string;
    surroundedFilePath: string;
    suspectedFiles: string;
};

// ファイル処理結果の型定義
export type FileProcessingResult = {
    success: boolean;
    path: string;
    relativePath: string;
    size?: number;
    error?: string;
    processingTime?: number;
};

export type FileProcessingSummary = {
    totalFiles: number;
    successCount: number;
    errorCount: number;
    totalSize: number;
    totalProcessingTime: number;
    errors: Array<{ path: string; error: string }>;
};

// ファイル操作の設定型
export type FileOperationConfig = {
    maxFileSize: number; // バイト単位
    timeoutMs: number; // タイムアウト（ミリ秒）
    encoding: BufferEncoding;
    enableSizeCheck: boolean;
    enableTimeoutCheck: boolean;
};

// Phase 3-1: 状態遷移最適化のための追加型定義
export type RequiredFileAnalysisResult = {
    isEmpty: boolean;
    totalFiles: number;
    totalDirectories: number;
    hasFileContent: boolean;
    hasDirectoryListing: boolean;
    newFiles: RequiredFileInfo[];
    duplicateFiles: RequiredFileInfo[];
    priorityGroups: {
        high: RequiredFileInfo[];
        medium: RequiredFileInfo[];
        low: RequiredFileInfo[];
    };
};

export type ProcessingPlan = {
    steps: string[];
    sourceFiles: string[];
    configFiles: string[];
    protoFiles: string[];
    testFiles: string[];
    directories: string[];
};

// 要約機能の型定義
export type ConversationSummary = {
    original_goal_summary: string;
    progress_summary: string[];
    current_status: string;
    open_correction_goals: string[];
};

// 要約トリガーの種類
export type SummarizationTriggerType =
    | 'TOKEN_THRESHOLD'      // トークン閾値超過
    | 'PRE_SEND_CHECK'       // LLM送信直前チェック
    | 'TURN_COMPLETION'      // ターン完了時
    | 'TASK_COMPLETION'      // タスク完了時
    | 'MANUAL';              // 手動トリガー

// 要約トリガー情報
export type SummarizationTrigger = {
    type: SummarizationTriggerType;
    reason: string;
    timestamp: string;
    tokenCount: number;
    messageCount: number;
};

export type ConversationHistoryManager = {
    messages: Array<{ role: string, content: string }>;
    totalTokens: number;
    summaryThreshold: number; // トークン数の閾値
    lastSummaryTurn: number;  // 最後に要約した時のターン
    summaryTokensUsed: number; // 要約処理で消費した総トークン数
    lastTokenAtSummary: number; // 前回要約時のトークン数（成長率計算用）
    summarizationHistory: SummarizationTrigger[]; // 要約履歴
};

export type SummarizeRequest = {
    fullConversationHistory: string;
    model?: string;          // 要約に使用するLLMモデル
    temperature?: number;    // 要約時の温度設定
};

export type SummarizeResponse = {
    summary: ConversationSummary;
    success: boolean;
    error?: string;
};

// Phase 3-2: diff適用システム改善のための追加型定義
export type BackupInfo = {
    backupPath: string;
    timestamp: string;
    originalFiles: string[];
    backupSize: number;
};

export type DiffValidationResult = {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    appliedChanges: number;
    skippedChanges: number;
};

export type DiffApplicationStats = {
    totalLines: number;
    addedLines: number;
    deletedLines: number;
    modifiedFiles: number;
    processingTime: number;
    backupCreated: boolean;
};

export type ErrorContext = {
    diffPreview: string;
    affectedFiles: string[];
    systemState: string;
    possibleCauses: string[];
};

