"use strict";
/**
 * 設定管理クラス
 * プロンプトテンプレートやファイルパスの管理を行う
 * Phase 4-3: 外部設定ファイルと環境変数に対応
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var dotenv = __importStar(require("dotenv"));
// HandlebarsをPromiseで動的import
var Handlebars;
var handlebarsPromise = Promise.resolve().then(function () { return __importStar(require('handlebars')); }).then(function (module) {
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
        this.tmpDiffRestorePath = path.join(this.outputDir + 'tmpDiffRestore.txt');
        this.maxTokens = this.getConfigValue('llm.maxTokens', 128000);
        // Phase 4-3: 新しい設定プロパティ
        this.debugMode = this.getConfigValue('system.debugMode', false);
        this.logLevel = this.getConfigValue('system.logLevel', 'info');
        this.environment = this.getConfigValue('system.environment', 'development');
        // ディレクトリの作成(存在しない場合)
        this.ensureDirectoriesExist();
        // 一時ファイルを削除
        if (fs.existsSync(this.tmpDiffRestorePath))
            fs.unlinkSync(this.tmpDiffRestorePath);
    }
    /**
     * 外部設定ファイルを読み込み
     * プロバイダーに応じた設定ファイルを自動的に読み込む
     */
    Config.prototype.loadExternalConfig = function (configPath) {
        var baseConfigPath = configPath || '/app/config/config.json';
        try {
            // ベース設定を読み込み
            var baseConfig = null;
            if (fs.existsSync(baseConfigPath)) {
                var configContent = fs.readFileSync(baseConfigPath, 'utf-8');
                baseConfig = JSON.parse(configContent);
            }
            // プロバイダーが指定されている場合、専用設定ファイルを探す
            if (baseConfig && baseConfig.llm && baseConfig.llm.provider) {
                var provider = baseConfig.llm.provider;
                var providerConfigPath = "/app/config/config_".concat(provider, ".json");
                if (fs.existsSync(providerConfigPath)) {
                    console.log("\uD83D\uDCC2 Loading provider-specific config: config_".concat(provider, ".json"));
                    var providerConfigContent = fs.readFileSync(providerConfigPath, 'utf-8');
                    var providerConfig = JSON.parse(providerConfigContent);
                    // プロバイダー専用設定をベースにして、ベース設定で上書き（ベース設定が優先）
                    var mergedConfig = this.deepMerge(providerConfig, baseConfig);
                    return mergedConfig;
                }
                else {
                    console.log("\u26A0\uFE0F  Provider-specific config not found: config_".concat(provider, ".json, using base config"));
                }
            }
            if (baseConfig) {
                return baseConfig;
            }
        }
        catch (error) {
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
    };
    /**
     * オブジェクトをディープマージ
     */
    Config.prototype.deepMerge = function (target, source) {
        var result = __assign({}, target);
        for (var key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            }
            else {
                result[key] = source[key];
            }
        }
        return result;
    };
    /**
     * 環境変数を読み込み（APIキー/トークンのみ）
     * 設定値は config.json で管理し、環境変数では上書きしない
     */
    Config.prototype.loadEnvironmentVariables = function () {
        try {
            // dotenvライブラリが利用可能な場合は使用
            dotenv.config();
        }
        catch (_a) {
            // dotenvが利用できない場合は環境変数のみ使用
        }
        // APIキー/トークンのみ環境変数から読み込む
        // その他の設定（provider, model, temperature等）は config.json で管理
        // 環境変数による設定の上書きは行わない
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
    Config.prototype.readPromptReplyFile = function (filesRequested, modifiedDiff, commentText, previousThought, previousPlan, correctionGoals, systemState) {
        var promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptReply.txt'), 'utf-8');
        var context = {
            filesRequested: filesRequested, // required section from previous message
            previousModifications: modifiedDiff, // diff from previous step
            previousThought: previousThought || '', // 前回の思考内容
            previousPlan: previousPlan || '', // 前回の計画内容
            correctionGoals: correctionGoals || '', // 修正目標
            systemState: systemState || '' // FSM状態情報
        };
        var template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    };
    // readPromptModifiedFile は readPromptModifiedEnhancedFile に置き換えられました
    /**
     * 対話履歴要約用プロンプトファイルを読み込み
     */
    Config.prototype.readPromptSummarizeFile = function (fullConversationHistory, systemState) {
        var promptSummarizeText = fs.readFileSync(path.join(this.promptDir, '00_prompt_summarize.txt'), 'utf-8');
        var context = {
            full_conversation_history: fullConversationHistory,
            systemState: systemState || ''
        };
        var template = Handlebars.compile(promptSummarizeText, { noEscape: true });
        return template(context);
    };
    /**
     * 要約からの対話再開用プロンプトファイルを読み込み
     */
    Config.prototype.readPromptResumeFromSummaryFile = function (summaryOfHistory, previousActionResult, correctionGoals, systemState) {
        if (correctionGoals === void 0) { correctionGoals = ''; }
        var promptResumeText = fs.readFileSync(path.join(this.promptDir, '00_prompt_resume_from_summary.txt'), 'utf-8');
        var context = {
            summary_of_history: summaryOfHistory,
            previous_action_result: previousActionResult,
            correctionGoals: correctionGoals,
            systemState: systemState || ''
        };
        var template = Handlebars.compile(promptResumeText, { noEscape: true });
        return template(context);
    };
    /**
     * 改善された検証プロンプトファイルを読み込み(相互参照コンテキスト付き)
     */
    Config.prototype.readPromptModifiedEnhancedFile = function (modifiedFiles, currentPlan, currentThought, filesRequested, previousModifications, previousThought, previousPlan, correctionGoals, crossReferenceContext, systemState) {
        var promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptModified_enhanced.txt'), 'utf-8');
        var context = {
            modifiedFiles: modifiedFiles, // diff that was just applied or restored
            currentPlan: currentPlan || '', // 現在のプラン
            currentThought: currentThought || '', // 現在の思考
            filesRequested: filesRequested || '', // リクエストされたファイル
            previousModifications: previousModifications || '', // 過去の修正
            previousThought: previousThought || '', // 過去の思考
            previousPlan: previousPlan || '', // 過去のプラン
            correctionGoals: correctionGoals || '', // 修正目標
            crossReferenceContext: crossReferenceContext || '', // 相互参照コンテキスト
            systemState: systemState || '' // FSM状態情報
        };
        var template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    };
    /**
     * 最終確認プロンプトファイルを読み込み
     */
    Config.prototype.readPromptFinalCheckFile = function (verificationSummary, modifiedFilesStatus, systemState) {
        var promptFinalCheckText = fs.readFileSync(path.join(this.promptDir, '00_promptFinalCheck.txt'), 'utf-8');
        var context = {
            verificationSummary: verificationSummary,
            modifiedFilesStatus: modifiedFilesStatus,
            systemState: systemState || ''
        };
        var template = Handlebars.compile(promptFinalCheckText, { noEscape: true });
        return template(context);
    };
    /**
     * エラー回復プロンプトファイルを読み込み
     */
    Config.prototype.readPromptErrorFile = function (errorContext, currentWorkingSet, systemState) {
        var promptErrorText = fs.readFileSync(path.join(this.promptDir, '00_prompt_error.txt'), 'utf-8');
        var context = {
            errorContext: errorContext,
            currentWorkingSet: currentWorkingSet,
            systemState: systemState || ''
        };
        var template = Handlebars.compile(promptErrorText, { noEscape: true });
        return template(context);
    };
    return Config;
}());
exports.default = Config;
