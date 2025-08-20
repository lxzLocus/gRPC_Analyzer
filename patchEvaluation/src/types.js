/**
 * 型定義ファイル（JavaScript版）
 * プロジェクト全体で使用する共通の型定義とenumをJavaScriptオブジェクトとして実装
 */

// 詳細なファイル情報リクエストタイプ
export const FileContentSubType = {
    SOURCE_CODE: 'SOURCE_CODE',      // ソースコード内容
    CONFIG_FILE: 'CONFIG_FILE',      // 設定ファイル
    PROTO_FILE: 'PROTO_FILE',        // .protoファイル
    TEST_FILE: 'TEST_FILE',          // テストファイル
    DOCUMENTATION: 'DOCUMENTATION',  // ドキュメントファイル
    BUILD_FILE: 'BUILD_FILE',        // ビルド設定ファイル
    GENERAL: 'GENERAL'               // その他
};

export const DirectoryListingSubType = {
    PROJECT_STRUCTURE: 'PROJECT_STRUCTURE',  // プロジェクト全体の構造
    SOURCE_DIRECTORY: 'SOURCE_DIRECTORY',   // ソースディレクトリ
    TEST_DIRECTORY: 'TEST_DIRECTORY',       // テストディレクトリ
    CONFIG_DIRECTORY: 'CONFIG_DIRECTORY',   // 設定ディレクトリ
    BUILD_DIRECTORY: 'BUILD_DIRECTORY',     // ビルド出力ディレクトリ
    DEPENDENCY_CHECK: 'DEPENDENCY_CHECK',   // 依存関係確認
    GENERAL: 'GENERAL'                      // その他
};

// 内部状態管理用の型
export const ProcessingPhase = {
    INITIAL_ANALYSIS: 'INITIAL_ANALYSIS',     // 初期分析フェーズ
    CONTEXT_GATHERING: 'CONTEXT_GATHERING',   // コンテキスト収集フェーズ
    DETAILED_ANALYSIS: 'DETAILED_ANALYSIS',   // 詳細分析フェーズ
    SOLUTION_PLANNING: 'SOLUTION_PLANNING',   // 解決策立案フェーズ
    IMPLEMENTATION: 'IMPLEMENTATION',         // 実装フェーズ
    VERIFICATION: 'VERIFICATION',             // 検証フェーズ
    FINALIZATION: 'FINALIZATION'              // 最終化フェーズ
};

export const State = {
    Start: 'Start',
    PrepareInitialContext: 'PrepareInitialContext',
    SendInitialInfoToLLM: 'SendInitialInfoToLLM',
    LLMAnalyzePlan: 'LLMAnalyzePlan',
    LLMDecision: 'LLMDecision',
    SystemAnalyzeRequest: 'SystemAnalyzeRequest',
    GetFileContent: 'GetFileContent',
    GetDirectoryListing: 'GetDirectoryListing',
    ProcessRequiredInfos: 'ProcessRequiredInfos',
    SendInfoToLLM: 'SendInfoToLLM',
    LLMReanalyze: 'LLMReanalyze',
    SystemParseDiff: 'SystemParseDiff',
    SystemApplyDiff: 'SystemApplyDiff',
    CheckApplyResult: 'CheckApplyResult',
    SendResultToLLM: 'SendResultToLLM',
    LLMNextStep: 'LLMNextStep',
    SendErrorToLLM: 'SendErrorToLLM',
    LLMErrorReanalyze: 'LLMErrorReanalyze',
    End: 'End'
};

/**
 * ファイル情報オブジェクトを作成するヘルパー関数
 * @param {string} type - 'FILE_CONTENT' または 'DIRECTORY_LISTING'
 * @param {string} path - ファイルパス
 * @param {string} [subType] - サブタイプ
 * @param {string} [priority] - 優先度 ('HIGH', 'MEDIUM', 'LOW')
 * @param {string} [reason] - リクエスト理由
 * @returns {object} RequiredFileInfoオブジェクト
 */
export function createRequiredFileInfo(type, path, subType = null, priority = null, reason = null) {
    return {
        type,
        path,
        ...(subType && { subType }),
        ...(priority && { priority }),
        ...(reason && { reason })
    };
}

/**
 * LLM解析結果オブジェクトを作成するヘルパー関数
 * @param {object} sections - 解析されたセクション
 * @returns {object} LLMParsedオブジェクト
 */
export function createLLMParsed(sections = {}) {
    return {
        thought: sections.thought || null,
        plan: sections.plan || null,
        requiredFilepaths: sections.requiredFilepaths || [],
        requiredFileInfos: sections.requiredFileInfos || [],
        modifiedDiff: sections.modifiedDiff || '',
        commentText: sections.commentText || '',
        has_fin_tag: sections.has_fin_tag || false,
        suggestedPhase: sections.suggestedPhase || null,
        confidenceLevel: sections.confidenceLevel || null,
        expectedIterations: sections.expectedIterations || null
    };
}

/**
 * ログ用の解析内容オブジェクトを作成するヘルパー関数
 * @param {object} parsed - LLMParsedオブジェクト
 * @returns {object} ParsedContentLogオブジェクト
 */
export function createParsedContentLog(parsed) {
    return {
        thought: parsed.thought,
        plan: parsed.plan ? [{ step: 1, description: parsed.plan }] : null,
        reply_required: parsed.requiredFilepaths.map(path => ({ type: "FILE_CONTENT", path })),
        modified_diff: parsed.modifiedDiff || null,
        commentText: parsed.commentText || null,
        has_fin_tag: parsed.has_fin_tag
    };
}

/**
 * コンテキストオブジェクトを作成するヘルパー関数
 * @param {object} initialData - 初期データ
 * @returns {object} Contextオブジェクト
 */
export function createContext(initialData = {}) {
    return {
        initialInfo: initialData.initialInfo || {},
        llmResponse: initialData.llmResponse || null,
        llmParsed: initialData.llmParsed || null,
        fileContent: initialData.fileContent || null,
        dirListing: initialData.dirListing || null,
        diff: initialData.diff || null,
        error: initialData.error || null,
        result: initialData.result || null
    };
}

// ファイル処理結果のヘルパー関数
export function createFileProcessingResult(success, path, relativePath, options = {}) {
    return {
        success,
        path,
        relativePath,
        ...(options.size !== undefined && { size: options.size }),
        ...(options.error && { error: options.error }),
        ...(options.processingTime !== undefined && { processingTime: options.processingTime })
    };
}

// デフォルト設定オブジェクト
export const DEFAULT_CONFIG = {
    system: { 
        version: '1.0.0', 
        environment: 'development', 
        debugMode: false, 
        logLevel: 'info' 
    },
    llm: { 
        provider: 'openai', 
        model: 'gpt-4.1', 
        maxTokens: 4000, 
        temperature: 0.1, 
        timeout: 30000, 
        retryAttempts: 3 
    },
    gemini: { 
        model: 'gemini-2.5-pro', 
        maxTokens: 4000, 
        temperature: 0.1, 
        timeout: 30000 
    },
    fileOperations: { 
        maxFileSize: 52428800, 
        timeout: 30000, 
        encoding: 'utf-8', 
        enableSizeCheck: true, 
        enableTimeoutCheck: true, 
        backupEnabled: true 
    },
    performance: { 
        enableMonitoring: true, 
        enableDetailedLogs: true, 
        performanceLogPath: '/app/logs/performance', 
        reportGenerationEnabled: true 
    },
    paths: { 
        promptDir: '/app/src/prompts', 
        outputDir: '/app/output', 
        logsDir: '/app/logs', 
        backupDir: '/app/backups' 
    },
    testing: { 
        mockMode: false, 
        integrationTestEnabled: true, 
        testReportPath: '/app/output', 
        testTimeout: 60000 
    },
    security: { 
        validateFilePaths: true, 
        restrictToProjectDir: true, 
        maxDepth: 10 
    }
};
