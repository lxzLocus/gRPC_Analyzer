/**
 * 型定義ファイル（JavaScript版）
 * プロジェクト全体で使用する共通設定
 */

// APR終了ステータス定数（/app/src/modules/Logger.tsと統一）
// ※ patchEvaluationは独立したコンテナで動作するため、親ディレクトリからインポートできない
// ※ このため、同じ定義をここに複製している
export const APRStatus = {
    FINISHED: 'FINISHED',                       // パッチ生成完了
    NO_CHANGES_NEEDED: 'NO_CHANGES_NEEDED',     // 修正不要と判定（LLM明示）
    TIMEOUT: 'TIMEOUT',                         // タイムアウト
    ERROR: 'ERROR',                             // エラー発生
    INVESTIGATION_PHASE: 'INVESTIGATION_PHASE', // 調査フェーズ（未完了）
    INCOMPLETE: 'INCOMPLETE'                    // 進捗なし（システム推測）
};

// デフォルト設定オブジェクト
export const DEFAULT_CONFIG = {
    system: { 
        environment: 'development', 
        debugMode: false, 
        logLevel: 'info' 
    },
    llm: { 
        provider: 'openai', 
        model: 'gpt-5', 
        maxTokens: 4000, 
        temperature: 0.1, 
        timeout: 30000
    },
    gemini: { 
        model: 'gemini-2.5-pro', 
        maxTokens: 4000, 
        temperature: 0.1, 
        timeout: 30000 
    },
    fileOperations: { 
        maxFileSize: 52428800
    },
    paths: { 
        promptDir: './src/prompts', 
        outputDir: './output', 
        logsDir: './logs', 
        backupDir: './backups' 
    }
};

/**
 * 必要なファイル情報オブジェクトを作成
 * @param {string} type - ファイルタイプ ('FILE_CONTENT' または 'DIRECTORY_LISTING')
 * @param {string} path - ファイルパス
 * @returns {Object} ファイル情報オブジェクト
 */
export function createRequiredFileInfo(type, path) {
    return {
        type: type,
        path: path
    };
}
