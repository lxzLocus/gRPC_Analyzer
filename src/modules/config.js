"use strict";
/**
 * 設定管理クラス
 * プロンプトテンプレートやファイルパスの管理を行う
 * Phase 4-3: 外部設定ファイルと環境変数に対応
 */
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var dotenv = require("dotenv");
// HandlebarsをPromiseで動的import
var Handlebars;
var handlebarsPromise = Promise.resolve().then(function () { return require('handlebars'); }).then(function (module) {
    Handlebars = module.default || module;
    return Handlebars;
});
//実行ファイルが置かれているパス
var APP_DIR = "/app/src/";
/**
 * Configuration class for managing file paths and prompt templates.
 * @pullRequestPath: プルリクエストのパス "/PATH/premerge_xxx"
 */
var Config = /** @class */ (function () {
    function Config(pullRequestPath, configPath) {
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
    Config.prototype.loadExternalConfig = function (configPath) {
        var defaultConfigPath = configPath || '/app/config/config.json';
        try {
            if (fs.existsSync(defaultConfigPath)) {
                var configContent = fs.readFileSync(defaultConfigPath, 'utf-8');
                return JSON.parse(configContent);
            }
        }
        catch (error) {
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
    };
    /**
     * 環境変数を読み込み（.env ファイルの値を上書き）
     */
    Config.prototype.loadEnvironmentVariables = function () {
        try {
            // dotenvライブラリが利用可能な場合は使用
            dotenv.config();
        }
        catch (_a) {
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
                    timeout: 30000
                };
            }
            this.externalConfig.gemini.model = process.env.GEMINI_MODEL;
        }
        if (process.env.MAX_FILE_SIZE) {
            this.externalConfig.fileOperations.maxFileSize = parseInt(process.env.MAX_FILE_SIZE);
        }
        // 他の環境変数も同様に処理...
    };
    /**
     * 設定値を取得（ドット記法対応）
     */
    Config.prototype.getConfigValue = function (key, defaultValue) {
        var keys = key.split('.');
        var value = this.externalConfig;
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var k = keys_1[_i];
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            }
            else {
                return defaultValue;
            }
        }
        return value !== undefined ? value : defaultValue;
    };
    /**
     * 必要なディレクトリを作成
     */
    Config.prototype.ensureDirectoriesExist = function () {
        var _this = this;
        var directories = [
            this.outputDir,
            this.getConfigValue('paths.logsDir', '/app/logs'),
            this.getConfigValue('paths.backupDir', '/app/backups'),
            path.join(this.getConfigValue('paths.logsDir', '/app/logs'), 'performance'),
            path.join(this.getConfigValue('paths.logsDir', '/app/logs'), 'diff_errors'),
            path.join(this.getConfigValue('paths.logsDir', '/app/logs'), 'parsing_errors'),
            path.join(this.getConfigValue('paths.logsDir', '/app/logs'), 'file_errors')
        ];
        directories.forEach(function (dir) {
            if (!fs.existsSync(dir)) {
                try {
                    fs.mkdirSync(dir, { recursive: true });
                    if (_this.debugMode) {
                        console.log("Created directory: ".concat(dir));
                    }
                }
                catch (error) {
                    console.error("Failed to create directory ".concat(dir, ":"), error);
                }
            }
        });
    };
    /**
     * デバッグモード用のログ出力
     */
    Config.prototype.debugLog = function (message, data) {
        if (this.debugMode) {
            var timestamp = new Date().toISOString();
            console.log("[DEBUG ".concat(timestamp, "] ").concat(message), data ? JSON.stringify(data, null, 2) : '');
        }
    };
    /**
     * 設定情報の表示
     */
    Config.prototype.displayConfig = function () {
        if (this.debugMode) {
            console.log('=== Configuration Summary ===');
            console.log("Environment: ".concat(this.environment));
            console.log("Debug Mode: ".concat(this.debugMode));
            console.log("Log Level: ".concat(this.logLevel));
            console.log("LLM Model: ".concat(this.getConfigValue('llm.model', 'N/A')));
            console.log("Max Tokens: ".concat(this.maxTokens));
            console.log("Input Project Dir: ".concat(this.inputProjectDir));
            console.log("Output Dir: ".concat(this.outputDir));
            console.log("Prompt Dir: ".concat(this.promptDir));
            console.log('============================');
        }
    };
    /**
     * 外部設定の値を取得（公開メソッド）
     */
    Config.prototype.get = function (key, defaultValue) {
        return this.getConfigValue(key, defaultValue);
    };
    /**
     * 設定値を動的に更新
     */
    Config.prototype.set = function (key, value) {
        var keys = key.split('.');
        var config = this.externalConfig;
        for (var i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in config)) {
                config[keys[i]] = {};
            }
            config = config[keys[i]];
        }
        config[keys[keys.length - 1]] = value;
        this.debugLog("Config updated: ".concat(key, " = ").concat(value));
    };
    Config.prototype.readPromptReplyFile = function (filesRequested, modifiedDiff, commentText, previousThought, previousPlan) {
        var promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptReply.txt'), 'utf-8');
        var context = {
            filesRequested: filesRequested, // required section from previous message
            previousModifications: modifiedDiff, // diff from previous step
            previousThought: previousThought || '', // 前回の思考内容
            previousPlan: previousPlan || '' // 前回の計画内容
        };
        var template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    };
    Config.prototype.readPromptModifiedFile = function (modifiedFiles, currentPlan, currentThought) {
        var promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptModified.txt'), 'utf-8');
        var context = {
            modifiedFiles: modifiedFiles, // diff that was just applied or restored
            current_plan: currentPlan || '', // 現在のプラン
            current_thought: currentThought || '' // 現在の思考
        };
        var template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    };
    return Config;
}());
exports.default = Config;
