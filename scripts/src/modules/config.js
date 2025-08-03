/**
 * 設定管理クラス
 * プロンプトテンプレートやファイルパスの管理を行う
 * Phase 4-3: 外部設定ファイルと環境変数に対応
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
// HandlebarsをPromiseで動的import
let Handlebars;
const handlebarsPromise = import('handlebars').then(module => {
    Handlebars = module.default || module;
    return Handlebars;
});
//実行ファイルが置かれているパス
const APP_DIR = "/app/src/";
/**
 * Configuration class for managing file paths and prompt templates.
 * @pullRequestPath: プルリクエストのパス "/PATH/premerge_xxx"
 */
class Config {
    constructor(pullRequestPath, configPath) {
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
        // ディレクトリの作成（存在しない場合）
        this.ensureDirectoriesExist();
        // 一時ファイルを削除
        if (fs.existsSync(this.tmpDiffRestorePath))
            fs.unlinkSync(this.tmpDiffRestorePath);
    }
    /**
     * 外部設定ファイルを読み込み
     */
    loadExternalConfig(configPath) {
        const defaultConfigPath = configPath || '/app/config/config.json';
        try {
            if (fs.existsSync(defaultConfigPath)) {
                const configContent = fs.readFileSync(defaultConfigPath, 'utf-8');
                return JSON.parse(configContent);
            }
        }
        catch (error) {
            console.warn('Failed to load external config, using defaults:', error);
        }
        // デフォルト設定
        return {
            system: { version: '1.0.0', environment: 'development', debugMode: false, logLevel: 'info' },
            llm: { provider: 'openai', model: 'gpt-4.1', maxTokens: 4000, temperature: 0.1, timeout: 120000, retryAttempts: 3 },
            gemini: { model: 'gemini-2.5-pro', maxTokens: 4000, temperature: 0.1, timeout: 120000 },
            fileOperations: { maxFileSize: 52428800, timeout: 60000, encoding: 'utf-8', enableSizeCheck: true, enableTimeoutCheck: true, backupEnabled: true },
            performance: { enableMonitoring: true, enableDetailedLogs: true, performanceLogPath: '/app/logs/performance', reportGenerationEnabled: true },
            paths: { promptDir: '/app/src/prompts', outputDir: '/app/output', logsDir: '/app/logs', backupDir: '/app/backups' },
            testing: { mockMode: false, integrationTestEnabled: true, testReportPath: '/app/output', testTimeout: 60000 },
            security: { validateFilePaths: true, restrictToProjectDir: true, maxDepth: 10 }
        };
    }
    /**
     * 環境変数を読み込み（.env ファイルの値を上書き）
     */
    loadEnvironmentVariables() {
        try {
            // dotenvライブラリが利用可能な場合は使用
            dotenv.config();
        }
        catch {
            // dotenvが利用できない場合は環境変数のみ使用
        }
        // 環境変数で外部設定を上書き
        if (process.env.DEBUG_MODE) {
            this.externalConfig.system.debugMode = process.env.DEBUG_MODE === 'true';
        }
        if (process.env.LOG_LEVEL) {
            this.externalConfig.system.logLevel = process.env.LOG_LEVEL;
        }
        if (process.env.LLM_PROVIDER) {
            this.externalConfig.llm.provider = process.env.LLM_PROVIDER;
        }
        if (process.env.OPENAI_MODEL) {
            this.externalConfig.llm.model = process.env.OPENAI_MODEL;
        }
        if (process.env.GEMINI_MODEL) {
            if (!this.externalConfig.gemini) {
                this.externalConfig.gemini = {
                    model: 'gemini-2.5-pro',
                    maxTokens: 4000,
                    temperature: 0.1,
                    timeout: 120000
                };
            }
            this.externalConfig.gemini.model = process.env.GEMINI_MODEL;
        }
        if (process.env.MAX_FILE_SIZE) {
            this.externalConfig.fileOperations.maxFileSize = parseInt(process.env.MAX_FILE_SIZE);
        }
        // 他の環境変数も同様に処理...
    }
    /**
     * 設定値を取得（ドット記法対応）
     */
    getConfigValue(key, defaultValue) {
        const keys = key.split('.');
        let value = this.externalConfig;
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            }
            else {
                return defaultValue;
            }
        }
        return value !== undefined ? value : defaultValue;
    }
    /**
     * 必要なディレクトリを作成
     */
    ensureDirectoriesExist() {
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
                }
                catch (error) {
                    console.error(`Failed to create directory ${dir}:`, error);
                }
            }
        });
    }
    /**
     * デバッグモード用のログ出力
     */
    debugLog(message, data) {
        if (this.debugMode) {
            const timestamp = new Date().toISOString();
            console.log(`[DEBUG ${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
        }
    }
    /**
     * 設定情報の表示
     */
    displayConfig() {
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
    get(key, defaultValue) {
        return this.getConfigValue(key, defaultValue);
    }
    /**
     * 設定値を動的に更新
     */
    set(key, value) {
        const keys = key.split('.');
        let config = this.externalConfig;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in config)) {
                config[keys[i]] = {};
            }
            config = config[keys[i]];
        }
        config[keys[keys.length - 1]] = value;
        this.debugLog(`Config updated: ${key} = ${value}`);
    }
    readPromptReplyFile(filesRequested, modifiedDiff, commentText, previousThought, previousPlan) {
        const promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptReply.txt'), 'utf-8');
        const context = {
            filesRequested: filesRequested, // required section from previous message
            previousModifications: modifiedDiff, // diff from previous step
            previousThought: previousThought || '', // 前回の思考内容
            previousPlan: previousPlan || '' // 前回の計画内容
        };
        const template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    }
    readPromptModifiedFile(modifiedFiles, currentPlan, currentThought) {
        const promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptModified.txt'), 'utf-8');
        const context = {
            modifiedFiles: modifiedFiles, // diff that was just applied or restored
            current_plan: currentPlan || '', // 現在のプラン
            current_thought: currentThought || '' // 現在の思考
        };
        const template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    }
}
export default Config;
//# sourceMappingURL=config.js.map