/**
 * バッチ処理関連の型定義
 * MVCアーキテクチャで使用する共通型
 */

// 処理結果の型
export interface ProcessingResult {
    success: boolean;
    repositoryName: string;
    category: string;
    pullRequestTitle: string;
    pullRequestPath: string;
    premergeDir: string;
    processingTime: number;
    errorMessage?: string;
    errorType?: string;
}

// リポジトリ処理結果の型
export interface RepositoryProcessingResult {
    repositoryName: string;
    totalCategories: number;
    totalPullRequests: number;
    successfulPullRequests: number;
    failedPullRequests: number;
    skippedPullRequests: number;
    processingTime: number;
}

// エラーレポートの型
export interface ErrorReport {
    timestamp: string;
    repositoryName: string;
    category: string;
    pullRequestTitle: string;
    pullRequestPath: string;
    premergeDir: string;
    errorType: string;
    errorMessage: string;
    stackTrace: string;
    processingPhase: string;
}

// バッチ処理オプションの型
export interface BatchProcessingOptions {
    baseOutputDir?: string;
    maxRetries?: number;
    memoryCleanupInterval?: number;
    timeoutMs?: number;
    enableGarbageCollection?: boolean;
}

// 処理統計の型
export interface ProcessingStatistics {
    totalRepositories: number;
    totalCategories: number;
    totalPullRequests: number;
    successfulPullRequests: number;
    failedPullRequests: number;
    skippedPullRequests: number;
    startTime: Date;
    endTime?: Date;
    totalDuration?: number;
    errorsByType: Record<string, number>;
    successRate: number;
}

// 進捗情報の型
export interface ProcessingProgress {
    totalRepositories: number;
    processedRepositories: number;
    totalPullRequests: number;
    processedPullRequests: number;
    successfulPullRequests: number;
    failedPullRequests: number;
    skippedPullRequests: number;
    progressPercentage: number;
    estimatedTimeRemaining?: number;
}

// メモリ使用量情報の型
export interface MemoryUsageInfo {
    rss: number;        // RSS memory in MB
    heapUsed: number;   // Heap used in MB
    heapTotal: number;  // Heap total in MB
    external: number;   // External memory in MB
}

// LLMFlowController関連の型
export interface LLMControllerResult {
    success: boolean;
    processingTime: number;
    errorMessage?: string;
    logFilePath?: string;
}

// プルリクエスト情報の型
export interface PullRequestInfo {
    repositoryName: string;
    category: string;
    pullRequestTitle: string;
    pullRequestPath: string;
    premergeDir: string;
}

// データセット検証結果の型
export interface DatasetValidationResult {
    isValid: boolean;
    repositoryCount: number;
    totalPullRequests: number;
    issues: string[];
}

// レポート設定の型
export interface ReportConfig {
    errorReportPath: string;
    summaryReportPath: string;
    enableJsonOutput: boolean;
    enableCsvOutput: boolean;
}

// 処理状態の列挙型
export enum ProcessingStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    SKIPPED = 'SKIPPED',
    TIMEOUT = 'TIMEOUT'
}

// 処理フェーズの列挙型
export enum ProcessingPhase {
    INITIALIZATION = 'INITIALIZATION',
    VALIDATION = 'VALIDATION',
    REPOSITORY_PROCESSING = 'REPOSITORY_PROCESSING',
    CATEGORY_PROCESSING = 'CATEGORY_PROCESSING',
    PULLREQUEST_PROCESSING = 'PULLREQUEST_PROCESSING',
    REPORT_GENERATION = 'REPORT_GENERATION',
    CLEANUP = 'CLEANUP'
}
