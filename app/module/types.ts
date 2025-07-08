/**
 * 型定義ファイル
 * プロジェクト全体で使用する共通の型定義
 */

export type RequiredFileInfo = {
    type: 'FILE_CONTENT' | 'DIRECTORY_LISTING';
    path: string;
};

export type LLMParsed = {
    thought: string | null;
    plan: string | null;
    requiredFilepaths: string[];
    requiredFileInfos: RequiredFileInfo[]; // 新しいフィールド
    modifiedDiff: string;
    commentText: string;
    has_fin_tag: boolean;
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
    fileChanges: string;
    allFilePaths: string;
    suspectedFiles: string;
};

export type PromptFileConfig = {
    promptTextfile: string;
    protoFile: string;
    protoFileChanges: string;
    fileChanges: string;
    allFilePaths: string;
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

