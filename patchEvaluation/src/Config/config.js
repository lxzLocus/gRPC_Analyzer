/**
 * 設定管理クラス（JavaScript版）
 * プロンプトテンプレートやファイルパスの管理を行う
 */

import fs from 'fs';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { DEFAULT_CONFIG } from '../types.js';

// 環境変数の読み込み（Config クラス読み込み時に実行）
dotenvConfig({ path: '/app/.env' });

/**
 * プロジェクトルートディレクトリを取得
 * patchEvaluationディレクトリから見て2つ上の /app ディレクトリ
 */
function getProjectRoot() {
    // 明示的に /app を返す
    return '/app';
}

/**
 * Configuration class for managing file paths and prompt templates.
 */
class Config {
    constructor(pullRequestPath, configPath) {
        // 外部設定を読み込み
        this.externalConfig = this.loadExternalConfig(configPath);
        
        // 環境変数の読み込み
        this.loadEnvironmentVariables();

        // 従来の設定（外部設定で上書き可能）
        const projectRoot = getProjectRoot();
        this.inputProjectDir = pullRequestPath;
        this.outputDir = this.getConfigValue('paths.outputDir', path.join(projectRoot, 'output'));
        this.inputDir = path.join(projectRoot, 'input');
        this.promptDir = this.getConfigValue('paths.promptDir', path.join(projectRoot, 'prompt'));
        this.promptTextfile = '00_prompt_gem.txt'; // Gemini用プロンプトに変更
        this.promptRefineTextfile = '00_promptRefine.txt';
        this.tmpDiffRestorePath = path.join(this.outputDir, 'tmpDiffRestore.txt');
        this.maxTokens = this.getConfigValue('llm.maxTokens', 4000);

        // 新しい設定プロパティ
        this.debugMode = this.getConfigValue('system.debugMode', false);
        this.logLevel = this.getConfigValue('system.logLevel', 'info');
        this.environment = this.getConfigValue('system.environment', 'development');

        // ディレクトリの作成（存在しない場合）
        this.ensureDirectoriesExist();

        // 一時ファイルを削除
        if (fs.existsSync(this.tmpDiffRestorePath)) {
            fs.unlinkSync(this.tmpDiffRestorePath);
        }
    }

    /**
     * 外部設定ファイルを読み込み
     */
    loadExternalConfig(configPath) {
        const projectRoot = getProjectRoot();
        const defaultConfigPath = configPath || path.join(projectRoot, 'config', 'config.json');
        
        try {
            if (fs.existsSync(defaultConfigPath)) {
                const configContent = fs.readFileSync(defaultConfigPath, 'utf-8');
                return JSON.parse(configContent);
            }
        } catch (error) {
            console.warn('Failed to load external config, using defaults:', error);
        }

        // デフォルト設定
        return { ...DEFAULT_CONFIG };
    }

    /**
     * 環境変数を読み込み（.env ファイルの値を上書き）
     */
    loadEnvironmentVariables() {
        // LLM設定の初期化（未定義の場合）
        if (!this.externalConfig.llm) {
            this.externalConfig.llm = {
                provider: 'openai',
                model: 'gpt-5.1-chat-latest',
                maxTokens: 4000,
                temperature: 0.1,
                timeout: 30000
            };
        }
        
        // システム設定の初期化（未定義の場合）
        if (!this.externalConfig.system) {
            this.externalConfig.system = {
                debugMode: false,
                logLevel: 'info'
            };
        }
        
        // ファイル操作設定の初期化（未定義の場合）
        if (!this.externalConfig.fileOperations) {
            this.externalConfig.fileOperations = {
                maxFileSize: 52428800
            };
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
            } else {
                return defaultValue;
            }
        }
        
        return value !== undefined ? value : defaultValue;
    }

    /**
     * 必要なディレクトリを作成
     */
    ensureDirectoriesExist() {
        const projectRoot = getProjectRoot();
        const directories = [
            this.outputDir,
            this.getConfigValue('paths.logsDir', path.join(projectRoot, 'logs')),
            this.getConfigValue('paths.backupDir', path.join(projectRoot, 'backups')),
            path.join(this.outputDir, 'reports'),
            path.join(this.outputDir, 'reports', 'assets'),
            path.join(this.getConfigValue('paths.logsDir', path.join(projectRoot, 'logs')), 'performance'),
            path.join(this.getConfigValue('paths.logsDir', path.join(projectRoot, 'logs')), 'diff_errors'),
            path.join(this.getConfigValue('paths.logsDir', path.join(projectRoot, 'logs')), 'parsing_errors'),
            path.join(this.getConfigValue('paths.logsDir', path.join(projectRoot, 'logs')), 'file_errors')
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

    /**
     * プロンプト応答ファイルを読み込み（Handlebarsを使わない簡易版）
     */
    readPromptReplyFile(filesRequested, modifiedDiff, commentText, previousThought = '', previousPlan = '') {
        try {
            const promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptReply.txt'), 'utf-8');
            
            // 簡易的なテンプレート置換
            return promptRefineText
                .replace(/\{\{filesRequested\}\}/g, filesRequested)
                .replace(/\{\{previousModifications\}\}/g, modifiedDiff)
                .replace(/\{\{previousThought\}\}/g, previousThought)
                .replace(/\{\{previousPlan\}\}/g, previousPlan);
        } catch (error) {
            console.error('Error reading prompt reply file:', error);
            return `Previous files requested: ${filesRequested}\nPrevious modifications: ${modifiedDiff}\nPrevious thought: ${previousThought}\nPrevious plan: ${previousPlan}`;
        }
    }

    /**
     * プロンプト修正ファイルを読み込み（Handlebarsを使わない簡易版）
     */
    readPromptModifiedFile(modifiedFiles, currentPlan = '', currentThought = '') {
        try {
            const promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptModified.txt'), 'utf-8');
            
            // 簡易的なテンプレート置換
            return promptRefineText
                .replace(/\{\{modifiedFiles\}\}/g, modifiedFiles)
                .replace(/\{\{current_plan\}\}/g, currentPlan)
                .replace(/\{\{current_thought\}\}/g, currentThought);
        } catch (error) {
            console.error('Error reading prompt modified file:', error);
            return `Modified files: ${modifiedFiles}\nCurrent plan: ${currentPlan}\nCurrent thought: ${currentThought}`;
        }
    }
}

export default Config;
