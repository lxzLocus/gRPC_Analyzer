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
        model: 'gpt-4.1', 
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
        promptDir: '/app/src/prompts', 
        outputDir: '/app/output', 
        logsDir: '/app/logs', 
        backupDir: '/app/backups' 
    }
};
