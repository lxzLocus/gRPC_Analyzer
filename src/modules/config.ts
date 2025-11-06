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
    promptRefineTextfile: string;
    tmpDiffRestorePath: string;
    maxTokens: number;

    // Phase 4-3: 新しい設定プロパティ
    private externalConfig: ExternalConfig;
    debugMode: boolean;
    logLevel: string;
    environment: string;

    // 実験機能: プロンプトセット切り替え
    private promptBasePath: string;
    private availableFeatures: Map<string, boolean> = new Map();

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
        this.promptRefineTextfile = '00_promptRefine.txt';
        this.tmpDiffRestorePath = path.join(this.outputDir + 'tmpDiffRestore.txt');
        this.maxTokens = this.getConfigValue('llm.maxTokens', 128000);

        // Phase 4-3: 新しい設定プロパティ
        this.debugMode = this.getConfigValue('system.debugMode', false);
        this.logLevel = this.getConfigValue('system.logLevel', 'info');
        this.environment = this.getConfigValue('system.environment', 'development');

        // 実験機能: プロンプトベースパスの決定と機能検出
        this.promptBasePath = this.determinePromptBasePath();
        this.detectAvailableFeatures();

        // ディレクトリの作成（存在しない場合）
        this.ensureDirectoriesExist();

        // 一時ファイルを削除
        if (fs.existsSync(this.tmpDiffRestorePath)) fs.unlinkSync(this.tmpDiffRestorePath);
    }

    /**
     * 外部設定ファイルを読み込み
     */
    private loadExternalConfig(configPath?: string): ExternalConfig {
        const defaultConfigPath = configPath || '/app/config/config.json';
        
        try {
            if (fs.existsSync(defaultConfigPath)) {
                const configContent = fs.readFileSync(defaultConfigPath, 'utf-8');
                return JSON.parse(configContent);
            }
        } catch (error) {
            console.warn('Failed to load external config, using defaults:', error);
        }

        // デフォルト設定
        return {
            system: { version: '1.0.0', environment: 'development', debugMode: false, logLevel: 'info' },
            llm: { provider: 'openai', model: 'gpt-4.1', maxTokens: 4000, temperature: 0.1, timeout: 30000, retryAttempts: 3 },
            gemini: { model: 'gemini-2.5-pro', maxTokens: 4000, temperature: 0.1, timeout: 30000 },
            fileOperations: { maxFileSize: 52428800, timeout: 30000, encoding: 'utf-8', enableSizeCheck: true, enableTimeoutCheck: true, backupEnabled: true },
            performance: { enableMonitoring: true, enableDetailedLogs: true, performanceLogPath: '/app/logs/performance', reportGenerationEnabled: true },
            paths: { promptDir: '/app/src/prompts', outputDir: '/app/output', logsDir: '/app/logs', backupDir: '/app/backups' },
            testing: { mockMode: false, integrationTestEnabled: true, testReportPath: '/app/output', testTimeout: 60000 },
            security: { validateFilePaths: true, restrictToProjectDir: true, maxDepth: 10 }
        };
    }

    /**
     * 環境変数を読み込み（.env ファイルの値を上書き）
     */
    private loadEnvironmentVariables(): void {
        try {
            // dotenvライブラリが利用可能な場合は使用
            dotenv.config();
        } catch {
            // dotenvが利用できない場合は環境変数のみ使用
        }

        // 環境変数で外部設定を上書き
        if (process.env.DEBUG_MODE) {
            this.externalConfig.system.debugMode = process.env.DEBUG_MODE === 'true';
        }
        if (process.env.LOG_LEVEL) {
            this.externalConfig.system.logLevel = process.env.LOG_LEVEL;
        }
        
        // LLM設定は環境変数で完全管理
        if (process.env.LLM_PROVIDER) {
            if (!this.externalConfig.llm) {
                this.externalConfig.llm = {};
            }
            this.externalConfig.llm.provider = process.env.LLM_PROVIDER;
        }
        if (process.env.LLM_MAX_TOKENS) {
            if (!this.externalConfig.llm) this.externalConfig.llm = {};
            this.externalConfig.llm.maxTokens = parseInt(process.env.LLM_MAX_TOKENS);
        }
        if (process.env.LLM_TEMPERATURE) {
            if (!this.externalConfig.llm) this.externalConfig.llm = {};
            this.externalConfig.llm.temperature = parseFloat(process.env.LLM_TEMPERATURE);
        }
        if (process.env.LLM_TIMEOUT) {
            if (!this.externalConfig.llm) this.externalConfig.llm = {};
            this.externalConfig.llm.timeout = parseInt(process.env.LLM_TIMEOUT);
        }
        if (process.env.LLM_RETRY_ATTEMPTS) {
            if (!this.externalConfig.llm) this.externalConfig.llm = {};
            this.externalConfig.llm.retryAttempts = parseInt(process.env.LLM_RETRY_ATTEMPTS);
        }
        
        // LLM要約設定
        if (process.env.LLM_SUMMARY_THRESHOLD) {
            if (!this.externalConfig.llm) this.externalConfig.llm = {};
            this.externalConfig.llm.summaryThreshold = parseInt(process.env.LLM_SUMMARY_THRESHOLD);
        }
        if (process.env.LLM_SUMMARY_MODEL) {
            if (!this.externalConfig.llm) this.externalConfig.llm = {};
            this.externalConfig.llm.summaryModel = process.env.LLM_SUMMARY_MODEL;
        }
        if (process.env.LLM_SUMMARY_TEMPERATURE) {
            if (!this.externalConfig.llm) this.externalConfig.llm = {};
            this.externalConfig.llm.summaryTemperature = parseFloat(process.env.LLM_SUMMARY_TEMPERATURE);
        }
        
        // LLM品質チェック設定
        if (process.env.LLM_QUALITY_CHECK_ENABLED) {
            if (!this.externalConfig.llm) this.externalConfig.llm = {};
            if (!this.externalConfig.llm.qualityCheck) this.externalConfig.llm.qualityCheck = {};
            this.externalConfig.llm.qualityCheck.enabled = process.env.LLM_QUALITY_CHECK_ENABLED === 'true';
        }
        if (process.env.LLM_REQUIRE_MODIFIED_CONTENT) {
            if (!this.externalConfig.llm) this.externalConfig.llm = {};
            if (!this.externalConfig.llm.qualityCheck) this.externalConfig.llm.qualityCheck = {};
            this.externalConfig.llm.qualityCheck.requireModifiedContent = process.env.LLM_REQUIRE_MODIFIED_CONTENT === 'true';
        }
        if (process.env.LLM_MIN_MODIFIED_LINES) {
            if (!this.externalConfig.llm) this.externalConfig.llm = {};
            if (!this.externalConfig.llm.qualityCheck) this.externalConfig.llm.qualityCheck = {};
            this.externalConfig.llm.qualityCheck.minModifiedLines = parseInt(process.env.LLM_MIN_MODIFIED_LINES);
        }
        
        // OpenAI設定
        if (process.env.OPENAI_MODEL) {
            if (!this.externalConfig.openai) {
                this.externalConfig.openai = {};
            }
            this.externalConfig.openai.model = process.env.OPENAI_MODEL;
        }
        if (process.env.OPENAI_MAX_TOKENS) {
            if (!this.externalConfig.openai) this.externalConfig.openai = {};
            this.externalConfig.openai.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS);
        }
        if (process.env.OPENAI_TEMPERATURE) {
            if (!this.externalConfig.openai) this.externalConfig.openai = {};
            this.externalConfig.openai.temperature = parseFloat(process.env.OPENAI_TEMPERATURE);
        }
        if (process.env.OPENAI_TIMEOUT) {
            if (!this.externalConfig.openai) this.externalConfig.openai = {};
            this.externalConfig.openai.timeout = parseInt(process.env.OPENAI_TIMEOUT);
        }
        
        // Gemini設定
        if (process.env.GEMINI_MODEL) {
            if (!this.externalConfig.gemini) {
                this.externalConfig.gemini = {};
            }
            this.externalConfig.gemini.model = process.env.GEMINI_MODEL;
        }
        if (process.env.GEMINI_MAX_TOKENS) {
            if (!this.externalConfig.gemini) this.externalConfig.gemini = {};
            this.externalConfig.gemini.maxTokens = parseInt(process.env.GEMINI_MAX_TOKENS);
        }
        if (process.env.GEMINI_TEMPERATURE) {
            if (!this.externalConfig.gemini) this.externalConfig.gemini = {};
            this.externalConfig.gemini.temperature = parseFloat(process.env.GEMINI_TEMPERATURE);
        }
        if (process.env.GEMINI_TIMEOUT) {
            if (!this.externalConfig.gemini) this.externalConfig.gemini = {};
            this.externalConfig.gemini.timeout = parseInt(process.env.GEMINI_TIMEOUT);
        }
        
        if (process.env.MAX_FILE_SIZE) {
            this.externalConfig.fileOperations.maxFileSize = parseInt(process.env.MAX_FILE_SIZE);
        }
        // 他の環境変数も同様に処理...
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
     * 実験機能: プロンプトベースパスを決定
     * experimental.flowMode が 'legacy' の場合、レガシープロンプトセットを使用
     */
    private determinePromptBasePath(): string {
        const flowMode = this.get('experimental.flowMode', 'modern');
        
        if (flowMode === 'legacy') {
            const promptSet = this.get('experimental.legacyPromptSet', 'e0e0931_baseline');
            const legacyPath = path.join(this.promptDir, 'legacy', promptSet);
            
            if (fs.existsSync(legacyPath)) {
                console.log(`📂 Using legacy prompt set: ${promptSet}`);
                console.log(`   Path: ${legacyPath}`);
                return legacyPath;
            } else {
                console.error(`❌ Legacy prompt set not found: ${legacyPath}`);
                console.warn(`   Falling back to modern prompts`);
                const modernPath = path.join(this.promptDir, 'modern');
                if (fs.existsSync(modernPath)) {
                    return modernPath;
                }
                // modernディレクトリもなければデフォルトのpromptsを使用
                return this.promptDir;
            }
        }
        
        // modernモードまたは未指定の場合
        const modernPath = path.join(this.promptDir, 'modern');
        if (fs.existsSync(modernPath)) {
            console.log(`📂 Using modern prompt set`);
            return modernPath;
        }
        
        // modernディレクトリがなければデフォルトのpromptsを使用
        console.log(`📂 Using default prompt directory`);
        return this.promptDir;
    }

    /**
     * 実験機能: 利用可能な機能を検出
     * プロンプトファイルの存在と機能フラグに基づいて、各機能の利用可能性を判定
     */
    private detectAvailableFeatures(): void {
        const featureRequirements: { [key: string]: string[] } = {
            'conversationSummarizer': ['00_prompt_summarize.txt', '00_prompt_resume_from_summary.txt'],
            'finalCheckPhase': ['00_promptFinalCheck.txt'],
            'crossReferenceAnalyzer': ['00_promptModified_enhanced.txt']
        };
        
        console.log(`🔍 Detecting available features in: ${this.promptBasePath}`);
        
        for (const [feature, requiredFiles] of Object.entries(featureRequirements)) {
            // プロンプトファイルの存在チェック
            const allFilesExist = requiredFiles.every(file => 
                fs.existsSync(path.join(this.promptBasePath, file))
            );
            
            // ユーザー設定の機能フラグをチェック
            const userEnabled = this.get(`experimental.features.${feature}`, true);
            
            // 両方の条件を満たす場合のみ利用可能
            const actuallyAvailable = allFilesExist && userEnabled;
            
            this.availableFeatures.set(feature, actuallyAvailable);
            
            if (!allFilesExist) {
                const missingFiles = requiredFiles.filter(file =>
                    !fs.existsSync(path.join(this.promptBasePath, file))
                );
                console.log(`⚠️  Feature '${feature}' unavailable (missing: ${missingFiles.join(', ')})`);
            } else if (!userEnabled) {
                console.log(`🔧 Feature '${feature}' disabled by config`);
            } else {
                console.log(`✅ Feature '${feature}' available`);
            }
        }
        
        // 早期終了防止はプロンプトに依存しない
        const earlyTerminationPrevention = this.get('experimental.features.earlyTerminationPrevention', true);
        this.availableFeatures.set('earlyTerminationPrevention', earlyTerminationPrevention);
        if (earlyTerminationPrevention) {
            console.log(`✅ Feature 'earlyTerminationPrevention' enabled`);
        } else {
            console.log(`🔧 Feature 'earlyTerminationPrevention' disabled`);
        }
    }

    /**
     * 実験機能: 指定された機能が利用可能かチェック
     */
    isFeatureAvailable(feature: string): boolean {
        return this.availableFeatures.get(feature) ?? false;
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
        const promptRefineText = fs.readFileSync(path.join(this.promptBasePath, '00_promptReply.txt'), 'utf-8');

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

    readPromptModifiedFile(
        modifiedFiles: string, 
        currentPlan?: string, 
        currentThought?: string,
        filesRequested?: string,
        previousModifications?: string,
        previousThought?: string,
        previousPlan?: string,
        correctionGoals?: string
    ): string {
        const promptRefineText = fs.readFileSync(path.join(this.promptBasePath, '00_promptModified.txt'), 'utf-8');

        const context = {
            modifiedFiles: modifiedFiles, // diff that was just applied or restored
            currentPlan: currentPlan || '', // 現在のプラン
            currentThought: currentThought || '', // 現在の思考
            filesRequested: filesRequested || '', // リクエストされたファイル
            previousModifications: previousModifications || '', // 過去の修正
            previousThought: previousThought || '', // 過去の思考
            previousPlan: previousPlan || '', // 過去のプラン
            correctionGoals: correctionGoals || '' // 修正目標
        };
        const template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    }

    /**
     * 対話履歴要約用プロンプトファイルを読み込み
     */
    readPromptSummarizeFile(fullConversationHistory: string): string {
        const primaryPath = path.join(this.promptBasePath, '00_prompt_summarize.txt');
        const fallbackPath = path.join(this.promptDir, '00_prompt_summarize.txt');
        
        let promptSummarizeText: string;
        
        // プライマリパスを試行
        if (fs.existsSync(primaryPath)) {
            promptSummarizeText = fs.readFileSync(primaryPath, 'utf-8');
        } else if (fs.existsSync(fallbackPath)) {
            console.warn(`⚠️  Summarize prompt not found in ${this.promptBasePath}, using fallback: ${fallbackPath}`);
            promptSummarizeText = fs.readFileSync(fallbackPath, 'utf-8');
        } else {
            throw new Error(`❌ Summarize prompt file not found in ${primaryPath} or ${fallbackPath}`);
        }

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
        const primaryPath = path.join(this.promptBasePath, '00_prompt_resume_from_summary.txt');
        const fallbackPath = path.join(this.promptDir, '00_prompt_resume_from_summary.txt');
        
        let promptResumeText: string;
        
        // プライマリパスを試行
        if (fs.existsSync(primaryPath)) {
            promptResumeText = fs.readFileSync(primaryPath, 'utf-8');
        } else if (fs.existsSync(fallbackPath)) {
            console.warn(`⚠️  Resume prompt not found in ${this.promptBasePath}, using fallback: ${fallbackPath}`);
            promptResumeText = fs.readFileSync(fallbackPath, 'utf-8');
        } else {
            throw new Error(`❌ Resume prompt file not found in ${primaryPath} or ${fallbackPath}`);
        }

        const context = {
            summary_of_history: summaryOfHistory,
            previous_action_result: previousActionResult,
            correctionGoals: correctionGoals
        };
        const template = Handlebars.compile(promptResumeText, { noEscape: true });
        return template(context);
    }

    /**
     * 改善された検証プロンプトファイルを読み込み（相互参照コンテキスト付き）
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
        const promptRefineText = fs.readFileSync(path.join(this.promptBasePath, '00_promptModified_enhanced.txt'), 'utf-8');

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
        const promptFinalCheckText = fs.readFileSync(path.join(this.promptBasePath, '00_promptFinalCheck.txt'), 'utf-8');

        const context = {
            verificationSummary: verificationSummary,
            modifiedFilesStatus: modifiedFilesStatus
        };
        const template = Handlebars.compile(promptFinalCheckText, { noEscape: true });
        return template(context);
    }
}

export default Config;
