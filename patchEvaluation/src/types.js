/**
 * 型定義ファイル（JavaScript版）
 * プロジェクト全体で使用する共通設定
 */

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
