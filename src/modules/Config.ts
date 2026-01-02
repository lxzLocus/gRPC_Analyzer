/**
 * 設定管理クラス
 * プロンプトテンプレートやファイルパスの管理を行う
 * Phase 4-3: 外部設定ファイルと環境変数に対応
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// HandlebarsをPromiseで動的import
let Handlebars: any;
const handlebarsPromise = import('handlebars').then(module => {
    Handlebars = module.default || module;
    return Handlebars;
});

//実行ファイルが置かれているパス
const APP_DIR: string = "/app/src/";

// 外部設定の型定義
interface ExternalConfig {
    system: {
        version: string;
        environment: string;
        debugMode: boolean;
        logLevel: string;
    };
    llm?: {
        provider?: string;
        model?: string;
        maxTokens?: number;
        temperature?: number;
        timeout?: number;
        retryAttempts?: number;
        summaryThreshold?: number;
        summaryModel?: string;
        summaryTemperature?: number;
        qualityCheck?: {
            enabled?: boolean;
            requireModifiedContent?: boolean;
            minModifiedLines?: number;
            retryDelayMs?: number;
            exponentialBackoff?: boolean;
        };
    };
    openai?: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
        timeout?: number;
    };
    gemini?: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
        timeout?: number;
    };
    fileOperations: {
        maxFileSize: number;
        timeout: number;
        encoding: string;
        enableSizeCheck: boolean;
        enableTimeoutCheck: boolean;
        backupEnabled: boolean;
    };
    performance: {
        enableMonitoring: boolean;
        enableDetailedLogs: boolean;
        performanceLogPath: string;
        reportGenerationEnabled: boolean;
    };
    paths: {
        promptDir: string;
        outputDir: string;
        logsDir: string;
        backupDir: string;
    };
    testing: {
        mockMode: boolean;
        integrationTestEnabled: boolean;
        testReportPath: string;
        testTimeout: number;
    };
    security: {
        validateFilePaths: boolean;
        restrictToProjectDir: boolean;
        maxDepth: number;
    };
}

/**
 * Configuration class for managing file paths and prompt templates.
 * @pullRequestPath: プルリクエストのパス "/PATH/premerge_xxx"
 */
class Config {
    // 従来のプロパティ
    inputProjectDir: string;
    outputDir: string;
    inputDir: string;
    promptDir: string;
    promptTextfile: string;
    tmpDiffRestorePath: string;
    maxTokens: number;

    // Phase 4-3: 新しい設定プロパティ
    private externalConfig: ExternalConfig;
    debugMode: boolean;
    logLevel: string;
    environment: string;

    constructor(pullRequestPath: string, configPath?: string) {
        // 外部設定を読み込み
        this.externalConfig = this.loadExternalConfig(configPath);
        
        // 環境変数の読み込み
        this.loadEnvironmentVariables();

        // 従来の設定（外部設定で上書き可能）
        this.inputProjectDir = pullRequestPath;
        this.outputDir = this.getConfigValue('paths.outputDir', path.join(APP_DIR, 'output'));
        this.inputDir = path.join(APP_DIR, 'input');
        this.promptDir = this.getConfigValue('paths.promptDir', path.join(APP_DIR, 'prompts'));
        this.promptTextfile = '00_prompt_gem.txt'; // Gemini用プロンプトに変更
        this.tmpDiffRestorePath = path.join(this.outputDir + 'tmpDiffRestore.txt');
        this.maxTokens = this.getConfigValue('llm.maxTokens', 128000);

        // Phase 4-3: 新しい設定プロパティ
        this.debugMode = this.getConfigValue('system.debugMode', false);
        this.logLevel = this.getConfigValue('system.logLevel', 'info');
        this.environment = this.getConfigValue('system.environment', 'development');

        // ディレクトリの作成(存在しない場合)
        this.ensureDirectoriesExist();

        // 一時ファイルを削除
        if (fs.existsSync(this.tmpDiffRestorePath)) fs.unlinkSync(this.tmpDiffRestorePath);
    }

    /**
     * 外部設定ファイルを読み込み
     * プロバイダーに応じた設定ファイルを自動的に読み込む
     */
    private loadExternalConfig(configPath?: string): ExternalConfig {
        const baseConfigPath = configPath || '/app/config/config.json';
        
        try {
            // ベース設定を読み込み
            let baseConfig: ExternalConfig | null = null;
            if (fs.existsSync(baseConfigPath)) {
                const configContent = fs.readFileSync(baseConfigPath, 'utf-8');
                baseConfig = JSON.parse(configContent);
            }
            
            // プロバイダーが指定されている場合、専用設定ファイルを探す
            if (baseConfig && baseConfig.llm && baseConfig.llm.provider) {
                const provider = baseConfig.llm.provider;
                const providerConfigPath = `/app/config/config_${provider}.json`;
                
                if (fs.existsSync(providerConfigPath)) {
                    console.log(`📂 Loading provider-specific config: config_${provider}.json`);
                    const providerConfigContent = fs.readFileSync(providerConfigPath, 'utf-8');
                    const providerConfig = JSON.parse(providerConfigContent);
                    
                    // プロバイダー専用設定をベースにして、ベース設定で上書き（ベース設定が優先）
                    const mergedConfig = this.deepMerge(providerConfig, baseConfig);
                    return mergedConfig;
                } else {
                    console.log(`⚠️  Provider-specific config not found: config_${provider}.json, using base config`);
                }
            }
            
            if (baseConfig) {
                return baseConfig;
            }
        } catch (error) {
            console.warn('Failed to load external config, using defaults:', error);
        }

        // デフォルト設定
        return {
            system: { version: '1.0.0', environment: 'development', debugMode: false, logLevel: 'info' },
            llm: { provider: 'openai', model: 'gpt-4o', maxTokens: 4000, temperature: 0.1, timeout: 30000, retryAttempts: 3 },
            gemini: { model: 'gemini-2.5-pro', maxTokens: 4000, temperature: 0.1, timeout: 30000 },
            fileOperations: { maxFileSize: 52428800, timeout: 30000, encoding: 'utf-8', enableSizeCheck: true, enableTimeoutCheck: true, backupEnabled: true },
            performance: { enableMonitoring: true, enableDetailedLogs: true, performanceLogPath: '/app/logs/performance', reportGenerationEnabled: true },
            paths: { promptDir: '/app/src/prompts', outputDir: '/app/output', logsDir: '/app/logs', backupDir: '/app/backups' },
            testing: { mockMode: false, integrationTestEnabled: true, testReportPath: '/app/output', testTimeout: 60000 },
            security: { validateFilePaths: true, restrictToProjectDir: true, maxDepth: 10 }
        };
    }
    
    /**
     * オブジェクトをディープマージ
     */
    private deepMerge(target: any, source: any): any {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    /**
     * 環境変数を読み込み（APIキー/トークンのみ）
     * 設定値は config.json で管理し、環境変数では上書きしない
     */
    private loadEnvironmentVariables(): void {
        try {
            // dotenvライブラリが利用可能な場合は使用
            dotenv.config();
        } catch {
            // dotenvが利用できない場合は環境変数のみ使用
        }

        // APIキー/トークンのみ環境変数から読み込む
        // その他の設定（provider, model, temperature等）は config.json で管理
        // 環境変数による設定の上書きは行わない
    }

    /**
     * 設定値を取得（ドット記法対応）
     */
    private getConfigValue(key: string, defaultValue: any): any {
        const keys = key.split('.');
        let value: any = this.externalConfig;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value !== undefined ? value : defaultValue;
    }

    /**
     * 必要なディレクトリを作成
     */
    private ensureDirectoriesExist(): void {
        const directories = [
            this.outputDir,
            this.getConfigValue('paths.logsDir', '/app/logs'),
            this.getConfigValue('paths.backupDir', '/app/backups'),
            path.join(this.getConfigValue('paths.logsDir', '/app/logs'), 'performance'),
            path.join(this.getConfigValue('paths.logsDir', '/app/logs'), 'diff_errors'),
            path.join(this.getConfigValue('paths.logsDir', '/app/logs'), 'parsing_errors'),
            path.join(this.getConfigValue('paths.logsDir', '/app/logs'), 'file_errors')
        ];

        directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                try {
                    fs.mkdirSync(dir, { recursive: true });
                    if (this.debugMode) {
                        console.log(`Created directory: ${dir}`);
                    }
                } catch (error) {
                    console.error(`Failed to create directory ${dir}:`, error);
                }
            }
        });
    }

    /**
     * デバッグモード用のログ出力
     */
    debugLog(message: string, data?: any): void {
        if (this.debugMode) {
            const timestamp = new Date().toISOString();
            console.log(`[DEBUG ${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
        }
    }

    /**
     * 設定情報の表示
     */
    displayConfig(): void {
        if (this.debugMode) {
            console.log('=== Configuration Summary ===');
            console.log(`Environment: ${this.environment}`);
            console.log(`Debug Mode: ${this.debugMode}`);
            console.log(`Log Level: ${this.logLevel}`);
            console.log(`LLM Model: ${this.getConfigValue('llm.model', 'N/A')}`);
            console.log(`Max Tokens: ${this.maxTokens}`);
            console.log(`Input Project Dir: ${this.inputProjectDir}`);
            console.log(`Output Dir: ${this.outputDir}`);
            console.log(`Prompt Dir: ${this.promptDir}`);
            console.log('============================');
        }
    }

    /**
     * 外部設定の値を取得（公開メソッド）
     */
    get(key: string, defaultValue?: any): any {
        return this.getConfigValue(key, defaultValue);
    }

    /**
     * 設定値を動的に更新
     */
    set(key: string, value: any): void {
        const keys = key.split('.');
        let config: any = this.externalConfig;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in config)) {
                config[keys[i]] = {};
            }
            config = config[keys[i]];
        }
        
        config[keys[keys.length - 1]] = value;
        this.debugLog(`Config updated: ${key} = ${value}`);
    }

    readPromptReplyFile(
        filesRequested: string, 
        modifiedDiff: string, 
        commentText: string, 
        previousThought?: string, 
        previousPlan?: string,
        correctionGoals?: string
    ): string {
        const promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptReply.txt'), 'utf-8');

        const context = {
            filesRequested: filesRequested, // required section from previous message
            previousModifications: modifiedDiff, // diff from previous step
            previousThought: previousThought || '', // 前回の思考内容
            previousPlan: previousPlan || '', // 前回の計画内容
            correctionGoals: correctionGoals || '' // 修正目標
        };
        const template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    }

    // readPromptModifiedFile は readPromptModifiedEnhancedFile に置き換えられました

    /**
     * 対話履歴要約用プロンプトファイルを読み込み
     */
    readPromptSummarizeFile(fullConversationHistory: string): string {
        const promptSummarizeText = fs.readFileSync(path.join(this.promptDir, '00_prompt_summarize.txt'), 'utf-8');

        const context = {
            full_conversation_history: fullConversationHistory
        };
        const template = Handlebars.compile(promptSummarizeText, { noEscape: true });
        return template(context);
    }

    /**
     * 要約からの対話再開用プロンプトファイルを読み込み
     */
    readPromptResumeFromSummaryFile(
        summaryOfHistory: string,
        previousActionResult: string,
        correctionGoals: string = ''
    ): string {
        const promptResumeText = fs.readFileSync(path.join(this.promptDir, '00_prompt_resume_from_summary.txt'), 'utf-8');

        const context = {
            summary_of_history: summaryOfHistory,
            previous_action_result: previousActionResult,
            correctionGoals: correctionGoals
        };
        const template = Handlebars.compile(promptResumeText, { noEscape: true });
        return template(context);
    }

    /**
     * 改善された検証プロンプトファイルを読み込み(相互参照コンテキスト付き)
     */
    readPromptModifiedEnhancedFile(
        modifiedFiles: string, 
        currentPlan?: string, 
        currentThought?: string,
        filesRequested?: string,
        previousModifications?: string,
        previousThought?: string,
        previousPlan?: string,
        correctionGoals?: string,
        crossReferenceContext?: string
    ): string {
        const promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptModified_enhanced.txt'), 'utf-8');

        const context = {
            modifiedFiles: modifiedFiles, // diff that was just applied or restored
            currentPlan: currentPlan || '', // 現在のプラン
            currentThought: currentThought || '', // 現在の思考
            filesRequested: filesRequested || '', // リクエストされたファイル
            previousModifications: previousModifications || '', // 過去の修正
            previousThought: previousThought || '', // 過去の思考
            previousPlan: previousPlan || '', // 過去のプラン
            correctionGoals: correctionGoals || '', // 修正目標
            crossReferenceContext: crossReferenceContext || '' // 相互参照コンテキスト
        };
        const template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    }

    /**
     * 最終確認プロンプトファイルを読み込み
     */
    readPromptFinalCheckFile(
        verificationSummary: string,
        modifiedFilesStatus: string
    ): string {
        const promptFinalCheckText = fs.readFileSync(path.join(this.promptDir, '00_promptFinalCheck.txt'), 'utf-8');

        const context = {
            verificationSummary: verificationSummary,
            modifiedFilesStatus: modifiedFilesStatus
        };
        const template = Handlebars.compile(promptFinalCheckText, { noEscape: true });
        return template(context);
    }
}

export default Config;
