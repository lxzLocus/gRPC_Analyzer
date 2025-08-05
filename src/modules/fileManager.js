"use strict";
/**
 * ファイル管理クラス
 * プロンプトファイルの読み込みとテンプレート処理を担当
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var util_1 = require("util");
var module_1 = require("module");
// ESModule環境でCommonJS moduleをimportするためのrequire関数
var require = (0, module_1.createRequire)(import.meta.url);
var Handlebars = require('handlebars');
// @ts-ignore: 動的インポートのため型チェックを無視  
var generatePeripheralStructure_js_1 = require("./generatePeripheralStructure.js");
// 非同期ファイル操作
var readFileAsync = (0, util_1.promisify)(fs.readFile);
var statAsync = (0, util_1.promisify)(fs.stat);
var FileManager = /** @class */ (function () {
    function FileManager(config, logger) {
        // デフォルトのプロンプトファイル設定
        this.defaultPromptFiles = {
            promptTextfile: '00_prompt_gem.txt', // Gemini用プロンプトに変更
            protoFile: '01_proto.txt',
            protoFileChanges: '02_protoFileChanges.txt',
            fileChanges: '03_fileChanges.txt',
            surroundedFilePath: '04_surroundedFilePath.txt',
            suspectedFiles: '05_suspectedFiles.txt'
        };
        // ファイル操作の設定
        this.fileOperationConfig = {
            maxFileSize: 50 * 1024 * 1024, // 50MB
            timeoutMs: 30000, // 30秒
            encoding: 'utf-8',
            enableSizeCheck: true,
            enableTimeoutCheck: true
        };
        this.config = config;
        this.logger = logger;
    }
    /**
     * プロンプトファイルの存在確認
     * @param filename プロンプトファイル名
     * @returns ファイルが存在するかどうか
     */
    FileManager.prototype.checkPromptFileExists = function (filename) {
        // 1. データセットディレクトリからの検索
        var datasetPromptPath = this.findPromptFileInDataset(filename);
        if (datasetPromptPath) {
            return true;
        }
        // 2. デフォルトのプロンプトディレクトリからの検索
        var filePath = path.join(this.config.promptDir, filename);
        return fs.existsSync(filePath);
    };
    /**
     * データセットディレクトリ内でプロンプトファイルを検索
     * @param filename プロンプトファイル名
     * @returns 見つかったファイルのパス（見つからない場合はnull）
     */
    FileManager.prototype.findPromptFileInDataset = function (filename) {
        if (!this.config.inputProjectDir) {
            return null;
        }
        // inputProjectDirの親ディレクトリ（pullrequestディレクトリ）を取得
        var pullRequestDir = path.dirname(this.config.inputProjectDir);
        var datasetPromptPath = path.join(pullRequestDir, filename);
        if (fs.existsSync(datasetPromptPath)) {
            console.log("\uD83D\uDCC1 \u30C7\u30FC\u30BF\u30BB\u30C3\u30C8\u30D7\u30ED\u30F3\u30D7\u30C8\u30D5\u30A1\u30A4\u30EB\u3092\u767A\u898B: ".concat(datasetPromptPath));
            return datasetPromptPath;
        }
        return null;
    };
    /**
     * プロンプトファイルを安全に読み込み
     * @param filename プロンプトファイル名
     * @param fallbackContent フォールバック用のコンテンツ
     * @returns ファイル内容またはフォールバック内容
     */
    FileManager.prototype.safeReadPromptFile = function (filename, fallbackContent) {
        if (fallbackContent === void 0) { fallbackContent = ''; }
        // 1. データセットディレクトリからの読み込みを試行
        var datasetPromptPath = this.findPromptFileInDataset(filename);
        if (datasetPromptPath) {
            try {
                var content = fs.readFileSync(datasetPromptPath, 'utf-8');
                console.log("\u2705 \u30C7\u30FC\u30BF\u30BB\u30C3\u30C8\u30D7\u30ED\u30F3\u30D7\u30C8\u30D5\u30A1\u30A4\u30EB\u3092\u8AAD\u307F\u8FBC\u307F: ".concat(filename));
                return content;
            }
            catch (error) {
                console.warn("\u26A0\uFE0F  \u30C7\u30FC\u30BF\u30BB\u30C3\u30C8\u30D7\u30ED\u30F3\u30D7\u30C8\u30D5\u30A1\u30A4\u30EB\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ".concat(filename), error);
            }
        }
        // 2. デフォルトディレクトリからの読み込みを試行
        var filePath = path.join(this.config.promptDir, filename);
        if (!fs.existsSync(filePath)) {
            console.warn("\u26A0\uFE0F  \u30D7\u30ED\u30F3\u30D7\u30C8\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(filename));
            console.warn("   \u691C\u7D22\u30D1\u30B91: ".concat(datasetPromptPath || 'データセット未指定'));
            console.warn("   \u691C\u7D22\u30D1\u30B92: ".concat(filePath));
            console.warn("   \u30D5\u30A9\u30FC\u30EB\u30D0\u30C3\u30AF\u5185\u5BB9\u3092\u4F7F\u7528\u3057\u307E\u3059");
            return fallbackContent;
        }
        try {
            return fs.readFileSync(filePath, 'utf-8');
        }
        catch (error) {
            console.error("\u274C \u30D7\u30ED\u30F3\u30D7\u30C8\u30D5\u30A1\u30A4\u30EB\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ".concat(filename));
            console.error("   \u30A8\u30E9\u30FC\u8A73\u7D30: ".concat(error.message));
            console.warn("   \u30D5\u30A9\u30FC\u30EB\u30D0\u30C3\u30AF\u5185\u5BB9\u3092\u4F7F\u7528\u3057\u307E\u3059");
            return fallbackContent;
        }
    };
    /**
     * テンプレート変数の検証
     * @param context テンプレートコンテキスト
     * @returns 検証結果とエラーメッセージ
     */
    FileManager.prototype.validateTemplateContext = function (context) {
        var errors = [];
        var requiredFields = [
            'protoFile', 'protoFileChanges', 'fileChanges', 'surroundedFilePath', 'suspectedFiles'
        ];
        requiredFields.forEach(function (field) {
            if (!context[field] || context[field].trim() === '') {
                errors.push("\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u5909\u6570 '".concat(field, "' \u304C\u7A7A\u3067\u3059"));
            }
        });
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    };
    FileManager.prototype.readFirstPromptFile = function () {
        console.log('📋 プロンプトファイルの読み込みを開始...');
        // メインプロンプトファイルの読み込み
        var promptText = this.safeReadPromptFile(this.config.promptTextfile, '# デフォルトプロンプト\n\nFix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections.\n\n{{protoFile}}\n{{protoFileChanges}}\n{{fileChanges}}\n{{surroundedFilePath}}\n{{suspectedFiles}}');
        // 各プロンプトファイルの読み込み（フォールバック付き）
        var protoFileContent = this.safeReadPromptFile(this.defaultPromptFiles.protoFile, '# プロトファイル情報が利用できません');
        var protoFileChanges = this.safeReadPromptFile(this.defaultPromptFiles.protoFileChanges, '# プロトファイル変更情報が利用できません');
        var fileChangesContent = this.safeReadPromptFile(this.defaultPromptFiles.fileChanges, '# ファイル変更情報が利用できません');
        var surroundedFilePath = this.safeReadPromptFile(this.defaultPromptFiles.surroundedFilePath, '# ファイルパス情報が利用できません');
        var suspectedFiles = this.safeReadPromptFile(this.defaultPromptFiles.suspectedFiles, '# 疑わしいファイル情報が利用できません');
        // テンプレートコンテキストの構築と検証
        var context = {
            protoFile: protoFileContent,
            protoFileChanges: protoFileChanges,
            fileChanges: fileChangesContent,
            surroundedFilePath: surroundedFilePath,
            suspectedFiles: suspectedFiles
        };
        var validation = this.validateTemplateContext(context);
        if (!validation.isValid) {
            console.warn('⚠️  テンプレート変数に問題があります:');
            validation.errors.forEach(function (error) { return console.warn("   - ".concat(error)); });
        }
        // Handlebarsテンプレートのコンパイルと実行
        try {
            var template = Handlebars.compile(promptText, { noEscape: true });
            var result = template(context);
            console.log('✅ プロンプトファイルの読み込み完了');
            return result;
        }
        catch (error) {
            console.error('❌ Handlebarsテンプレートのコンパイルエラー:', error.message);
            console.warn('⚠️  フォールバック: 変数展開なしのプロンプトテキストを返します');
            return promptText;
        }
    };
    /**
     * FILE_CONTENTタイプのリクエストを処理してファイル内容を取得（最適化版）
     * @param fileInfos - FILE_CONTENTタイプのRequiredFileInfo配列
     * @returns ファイル内容の文字列
     */
    FileManager.prototype.getFileContents = function (fileInfos) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, filePaths, fileChecks, summary, contents, results, i, filePath, fileCheck, relativePath, fileStartTime, result, errorMsg, originalPath, suggestions, suggestionText, errorMsg, errorMsg, errorMsg, content, error_1, errorMsg, totalTime;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        console.log('📂 ファイル内容取得を開始...');
                        filePaths = fileInfos
                            .filter(function (info) { return info.type === 'FILE_CONTENT'; })
                            .map(function (info) { return path.join(_this.config.inputProjectDir, info.path); });
                        if (filePaths.length === 0) {
                            console.log('📂 処理対象ファイルなし');
                            return [2 /*return*/, ''];
                        }
                        console.log("\uD83D\uDCC2 \u5BFE\u8C61\u30D5\u30A1\u30A4\u30EB\u6570: ".concat(filePaths.length));
                        return [4 /*yield*/, this.batchFileExistenceCheck(filePaths)];
                    case 1:
                        fileChecks = _a.sent();
                        summary = {
                            totalFiles: filePaths.length,
                            successCount: 0,
                            errorCount: 0,
                            totalSize: 0,
                            totalProcessingTime: 0,
                            errors: []
                        };
                        contents = [];
                        results = [];
                        i = 0;
                        _a.label = 2;
                    case 2:
                        if (!(i < filePaths.length)) return [3 /*break*/, 15];
                        filePath = filePaths[i];
                        fileCheck = fileChecks[i];
                        relativePath = path.relative(this.config.inputProjectDir, filePath);
                        fileStartTime = Date.now();
                        result = {
                            success: false,
                            path: filePath,
                            relativePath: relativePath,
                            processingTime: 0
                        };
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 12, , 13]);
                        if (!!fileCheck.exists) return [3 /*break*/, 7];
                        if (!relativePath.endsWith('.pb.go')) return [3 /*break*/, 4];
                        errorMsg = this.generateProtobufFileErrorMessage(relativePath);
                        contents.push("--- ".concat(relativePath, "\n").concat(errorMsg));
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: 'Generated .pb.go file not found' });
                        summary.errorCount++;
                        return [3 /*break*/, 6];
                    case 4:
                        originalPath = fileInfos[i].path;
                        return [4 /*yield*/, this.findSimilarFiles(originalPath, this.config.inputProjectDir)];
                    case 5:
                        suggestions = _a.sent();
                        suggestionText = suggestions.length > 0
                            ? "\n\n\u985E\u4F3C\u30D5\u30A1\u30A4\u30EB\u306E\u5019\u88DC:\n".concat(suggestions.slice(0, 5).map(function (s) { return "  - ".concat(s); }).join('\n'))
                            : '';
                        errorMsg = "\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(fileCheck.error || 'File not found').concat(suggestionText);
                        contents.push("--- ".concat(relativePath, "\n[").concat(errorMsg, "]"));
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: errorMsg });
                        summary.errorCount++;
                        _a.label = 6;
                    case 6: return [3 /*break*/, 11];
                    case 7:
                        if (!!fileCheck.isFile) return [3 /*break*/, 8];
                        errorMsg = 'ディレクトリが指定されました（ファイルを期待）';
                        contents.push("--- ".concat(relativePath, "\n[").concat(errorMsg, "]"));
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: errorMsg });
                        summary.errorCount++;
                        return [3 /*break*/, 11];
                    case 8:
                        if (!!this.isFileSizeWithinLimit(fileCheck.size)) return [3 /*break*/, 9];
                        errorMsg = "\u30D5\u30A1\u30A4\u30EB\u30B5\u30A4\u30BA\u304C\u5236\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059: ".concat(this.formatFileSize(fileCheck.size), " > ").concat(this.formatFileSize(this.fileOperationConfig.maxFileSize));
                        contents.push("--- ".concat(relativePath, "\n[").concat(errorMsg, "]"));
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: errorMsg });
                        summary.errorCount++;
                        return [3 /*break*/, 11];
                    case 9: return [4 /*yield*/, this.readFileWithTimeout(filePath)];
                    case 10:
                        content = _a.sent();
                        contents.push("--- ".concat(relativePath, "\n").concat(content));
                        result.success = true;
                        result.size = fileCheck.size;
                        summary.successCount++;
                        summary.totalSize += fileCheck.size;
                        console.log("  \u2705 ".concat(relativePath, " (").concat(this.formatFileSize(fileCheck.size), ")"));
                        _a.label = 11;
                    case 11: return [3 /*break*/, 13];
                    case 12:
                        error_1 = _a.sent();
                        errorMsg = "\u30D5\u30A1\u30A4\u30EB\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ".concat(error_1.message);
                        contents.push("--- ".concat(relativePath, "\n[").concat(errorMsg, "]"));
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: errorMsg });
                        summary.errorCount++;
                        console.error("  \u274C ".concat(relativePath, ": ").concat(errorMsg));
                        // 詳細なファイル操作エラーログを記録
                        this.logger.logFileOperationError('READ_FILE', filePath, error_1, {
                            relativePath: relativePath,
                            attemptedEncoding: this.fileOperationConfig.encoding,
                            maxFileSize: this.fileOperationConfig.maxFileSize,
                            timeout: this.fileOperationConfig.timeoutMs
                        });
                        return [3 /*break*/, 13];
                    case 13:
                        result.processingTime = Date.now() - fileStartTime;
                        summary.totalProcessingTime += result.processingTime;
                        results.push(result);
                        _a.label = 14;
                    case 14:
                        i++;
                        return [3 /*break*/, 2];
                    case 15:
                        totalTime = Date.now() - startTime;
                        console.log('\n📊 ファイル処理統計:');
                        console.log("   \u6210\u529F: ".concat(summary.successCount, "/").concat(summary.totalFiles, " \u30D5\u30A1\u30A4\u30EB"));
                        console.log("   \u30A8\u30E9\u30FC: ".concat(summary.errorCount, "/").concat(summary.totalFiles, " \u30D5\u30A1\u30A4\u30EB"));
                        console.log("   \u7DCF\u30B5\u30A4\u30BA: ".concat(this.formatFileSize(summary.totalSize)));
                        console.log("   \u51E6\u7406\u6642\u9593: ".concat(totalTime, "ms"));
                        if (summary.errors.length > 0) {
                            console.log('   ❌ エラー詳細:');
                            summary.errors.forEach(function (err) { return console.log("      - ".concat(err.path, ": ").concat(err.error)); });
                        }
                        return [2 /*return*/, contents.join('\n\n')];
                }
            });
        });
    };
    /**
     * DIRECTORY_LISTINGタイプのリクエストを処理してディレクトリ構造を取得（最適化版）
     * @param fileInfos - DIRECTORY_LISTINGタイプのRequiredFileInfo配列
     * @returns ディレクトリ構造のJSON文字列
     */
    FileManager.prototype.getDirectoryListings = function (fileInfos) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, directoryPaths, dirChecks, results, successCount, errorCount, i, dirPath, dirCheck, relativePath, dirStartTime, errorMsg, errorMsg, structure, processingTime, errorMsg, totalTime;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        console.log('📁 ディレクトリ構造取得を開始...');
                        directoryPaths = fileInfos
                            .filter(function (info) { return info.type === 'DIRECTORY_LISTING'; })
                            .map(function (info) { return path.join(_this.config.inputProjectDir, info.path); });
                        if (directoryPaths.length === 0) {
                            console.log('📁 処理対象ディレクトリなし');
                            return [2 /*return*/, ''];
                        }
                        console.log("\uD83D\uDCC1 \u5BFE\u8C61\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u6570: ".concat(directoryPaths.length));
                        return [4 /*yield*/, this.batchFileExistenceCheck(directoryPaths)];
                    case 1:
                        dirChecks = _a.sent();
                        results = {};
                        successCount = 0;
                        errorCount = 0;
                        for (i = 0; i < directoryPaths.length; i++) {
                            dirPath = directoryPaths[i];
                            dirCheck = dirChecks[i];
                            relativePath = path.relative(this.config.inputProjectDir, dirPath);
                            dirStartTime = Date.now();
                            try {
                                if (!dirCheck.exists) {
                                    errorMsg = "\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(dirCheck.error || 'Directory not found');
                                    results[relativePath] = { error: errorMsg };
                                    errorCount++;
                                    console.error("  \u274C ".concat(relativePath, ": ").concat(errorMsg));
                                }
                                else if (dirCheck.isFile) {
                                    errorMsg = 'ファイルが指定されました（ディレクトリを期待）';
                                    results[relativePath] = { error: errorMsg };
                                    errorCount++;
                                    console.error("  \u274C ".concat(relativePath, ": ").concat(errorMsg));
                                }
                                else {
                                    structure = (0, generatePeripheralStructure_js_1.default)(dirPath, 2);
                                    results[relativePath] = structure;
                                    successCount++;
                                    processingTime = Date.now() - dirStartTime;
                                    console.log("  \u2705 ".concat(relativePath, " (").concat(processingTime, "ms)"));
                                }
                            }
                            catch (error) {
                                errorMsg = "\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u69CB\u9020\u53D6\u5F97\u30A8\u30E9\u30FC: ".concat(error.message);
                                results[relativePath] = { error: errorMsg };
                                errorCount++;
                                console.error("  \u274C ".concat(relativePath, ": ").concat(errorMsg));
                                // 詳細なファイル操作エラーログを記録
                                this.logger.logFileOperationError('READ_DIRECTORY', dirPath, error, {
                                    relativePath: relativePath,
                                    requestedDepth: 2,
                                    operation: 'getSurroundingDirectoryStructure'
                                });
                            }
                        }
                        totalTime = Date.now() - startTime;
                        console.log('\n📊 ディレクトリ処理統計:');
                        console.log("   \u6210\u529F: ".concat(successCount, "/").concat(directoryPaths.length, " \u30C7\u30A3\u30EC\u30AF\u30C8\u30EA"));
                        console.log("   \u30A8\u30E9\u30FC: ".concat(errorCount, "/").concat(directoryPaths.length, " \u30C7\u30A3\u30EC\u30AF\u30C8\u30EA"));
                        console.log("   \u51E6\u7406\u6642\u9593: ".concat(totalTime, "ms"));
                        return [2 /*return*/, JSON.stringify(results, null, 2)];
                }
            });
        });
    };
    /**
     * RequiredFileInfosを処理して適切な内容を取得
     * @param fileInfos - RequiredFileInfo配列
     * @returns 結合された結果文字列
     */
    FileManager.prototype.processRequiredFileInfos = function (fileInfos) {
        return __awaiter(this, void 0, void 0, function () {
            var results, fileContentInfos, fileContents, directoryListingInfos, directoryListings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = [];
                        fileContentInfos = fileInfos.filter(function (info) { return info.type === 'FILE_CONTENT'; });
                        if (!(fileContentInfos.length > 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getFileContents(fileContentInfos)];
                    case 1:
                        fileContents = _a.sent();
                        if (fileContents) {
                            results.push('=== FILE CONTENTS ===\n' + fileContents);
                        }
                        _a.label = 2;
                    case 2:
                        directoryListingInfos = fileInfos.filter(function (info) { return info.type === 'DIRECTORY_LISTING'; });
                        if (!(directoryListingInfos.length > 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.getDirectoryListings(directoryListingInfos)];
                    case 3:
                        directoryListings = _a.sent();
                        if (directoryListings) {
                            results.push('=== DIRECTORY STRUCTURES ===\n' + directoryListings);
                        }
                        _a.label = 4;
                    case 4: return [2 /*return*/, results.join('\n\n')];
                }
            });
        });
    };
    /**
     * プロンプトディレクトリ内のファイル一覧を取得
     * @returns プロンプトファイル一覧
     */
    FileManager.prototype.getPromptFilesList = function () {
        var _this = this;
        var allPromptFiles = Object.values(this.defaultPromptFiles);
        var available = [];
        var missing = [];
        allPromptFiles.forEach(function (filename) {
            if (_this.checkPromptFileExists(filename)) {
                available.push(filename);
            }
            else {
                missing.push(filename);
            }
        });
        return {
            available: available,
            missing: missing,
            total: allPromptFiles.length
        };
    };
    /**
     * プロンプトファイルの状態をログ出力
     */
    FileManager.prototype.logPromptFilesStatus = function () {
        var status = this.getPromptFilesList();
        console.log('📁 プロンプトファイル状態:');
        console.log("   \u5229\u7528\u53EF\u80FD: ".concat(status.available.length, "/").concat(status.total, " \u30D5\u30A1\u30A4\u30EB"));
        if (status.available.length > 0) {
            console.log('   ✅ 利用可能ファイル:');
            status.available.forEach(function (file) { return console.log("      - ".concat(file)); });
        }
        if (status.missing.length > 0) {
            console.log('   ❌ 不足ファイル:');
            status.missing.forEach(function (file) { return console.log("      - ".concat(file)); });
        }
    };
    /**
     * ファイル操作設定の更新
     * @param config 新しい設定
     */
    FileManager.prototype.updateFileOperationConfig = function (config) {
        Object.assign(this.fileOperationConfig, config);
        console.log('⚙️  ファイル操作設定を更新しました:', {
            maxFileSize: this.formatFileSize(this.fileOperationConfig.maxFileSize),
            timeoutMs: "".concat(this.fileOperationConfig.timeoutMs, "ms"),
            encoding: this.fileOperationConfig.encoding,
            enableSizeCheck: this.fileOperationConfig.enableSizeCheck,
            enableTimeoutCheck: this.fileOperationConfig.enableTimeoutCheck
        });
    };
    /**
     * 現在のファイル操作設定を取得
     * @returns 現在の設定
     */
    FileManager.prototype.getFileOperationConfig = function () {
        return __assign({}, this.fileOperationConfig);
    };
    /**
     * バッチでファイル存在確認とサイズチェック
     * @param filePaths ファイルパスの配列
     * @returns ファイル情報の配列
     */
    FileManager.prototype.batchFileExistenceCheck = function (filePaths) {
        return __awaiter(this, void 0, void 0, function () {
            var results;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.allSettled(filePaths.map(function (filePath) { return __awaiter(_this, void 0, void 0, function () {
                            var stats, error_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, statAsync(filePath)];
                                    case 1:
                                        stats = _a.sent();
                                        return [2 /*return*/, {
                                                path: filePath,
                                                exists: true,
                                                size: stats.size,
                                                isFile: stats.isFile(),
                                                error: undefined
                                            }];
                                    case 2:
                                        error_2 = _a.sent();
                                        return [2 /*return*/, {
                                                path: filePath,
                                                exists: false,
                                                size: 0,
                                                isFile: false,
                                                error: error_2.message
                                            }];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); }))];
                    case 1:
                        results = _a.sent();
                        return [2 /*return*/, results.map(function (result, index) {
                                var _a;
                                if (result.status === 'fulfilled') {
                                    return result.value;
                                }
                                else {
                                    return {
                                        path: filePaths[index],
                                        exists: false,
                                        size: 0,
                                        isFile: false,
                                        error: ((_a = result.reason) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'
                                    };
                                }
                            })];
                }
            });
        });
    };
    /**
     * ファイルサイズが制限内かチェック
     * @param size ファイルサイズ（バイト）
     * @returns 制限内かどうか
     */
    FileManager.prototype.isFileSizeWithinLimit = function (size) {
        return !this.fileOperationConfig.enableSizeCheck || size <= this.fileOperationConfig.maxFileSize;
    };
    /**
     * ファイルサイズを人間が読みやすい形式に変換
     * @param bytes バイト数
     * @returns フォーマットされた文字列
     */
    FileManager.prototype.formatFileSize = function (bytes) {
        var units = ['B', 'KB', 'MB', 'GB'];
        var size = bytes;
        var unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return "".concat(size.toFixed(2), " ").concat(units[unitIndex]);
    };
    /**
     * タイムアウト付きファイル読み込み
     * @param filePath ファイルパス
     * @returns ファイル内容
     */
    FileManager.prototype.readFileWithTimeout = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.fileOperationConfig.enableTimeoutCheck) return [3 /*break*/, 2];
                        return [4 /*yield*/, readFileAsync(filePath, this.fileOperationConfig.encoding)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2: return [2 /*return*/, new Promise(function (resolve, reject) {
                            var timeoutId = setTimeout(function () {
                                reject(new Error("File read timeout (".concat(_this.fileOperationConfig.timeoutMs, "ms): ").concat(filePath)));
                            }, _this.fileOperationConfig.timeoutMs);
                            readFileAsync(filePath, _this.fileOperationConfig.encoding)
                                .then(function (content) {
                                clearTimeout(timeoutId);
                                resolve(content);
                            })
                                .catch(function (error) {
                                clearTimeout(timeoutId);
                                reject(error);
                            });
                        })];
                }
            });
        });
    };
    /**
     * 類似ファイルを検索する
     * @param targetPath - 検索対象のパス
     * @param searchDir - 検索ディレクトリ
     * @returns 類似ファイルのパス配列
     */
    FileManager.prototype.findSimilarFiles = function (targetPath, searchDir) {
        return __awaiter(this, void 0, void 0, function () {
            var targetBasename_1, targetExt_1, targetNameWithoutExt_1, suggestions_1, searchRecursively_1, error_3;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        targetBasename_1 = path.basename(targetPath);
                        targetExt_1 = path.extname(targetPath);
                        targetNameWithoutExt_1 = path.basename(targetPath, targetExt_1);
                        suggestions_1 = [];
                        searchRecursively_1 = function (dir_1) {
                            var args_1 = [];
                            for (var _i = 1; _i < arguments.length; _i++) {
                                args_1[_i - 1] = arguments[_i];
                            }
                            return __awaiter(_this, __spreadArray([dir_1], args_1, true), void 0, function (dir, basePath) {
                                var entries, _a, entries_1, entry, fullPath, relativePath, score, error_4;
                                if (basePath === void 0) { basePath = ''; }
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _b.trys.push([0, 8, , 9]);
                                            return [4 /*yield*/, fs.promises.readdir(dir, { withFileTypes: true })];
                                        case 1:
                                            entries = _b.sent();
                                            _a = 0, entries_1 = entries;
                                            _b.label = 2;
                                        case 2:
                                            if (!(_a < entries_1.length)) return [3 /*break*/, 7];
                                            entry = entries_1[_a];
                                            // スキップするディレクトリ
                                            if (entry.isDirectory() &&
                                                (entry.name === 'node_modules' || entry.name === '.git' ||
                                                    entry.name === 'vendor' || entry.name.startsWith('.'))) {
                                                return [3 /*break*/, 6];
                                            }
                                            fullPath = path.join(dir, entry.name);
                                            relativePath = path.join(basePath, entry.name);
                                            if (!entry.isDirectory()) return [3 /*break*/, 5];
                                            if (!(basePath.split(path.sep).length < 5)) return [3 /*break*/, 4];
                                            return [4 /*yield*/, searchRecursively_1(fullPath, relativePath)];
                                        case 3:
                                            _b.sent();
                                            _b.label = 4;
                                        case 4: return [3 /*break*/, 6];
                                        case 5:
                                            if (entry.isFile()) {
                                                score = this.calculateFileNameSimilarity(targetPath, relativePath, targetBasename_1, targetExt_1, targetNameWithoutExt_1);
                                                if (score > 0) {
                                                    suggestions_1.push({ path: relativePath, score: score });
                                                }
                                            }
                                            _b.label = 6;
                                        case 6:
                                            _a++;
                                            return [3 /*break*/, 2];
                                        case 7: return [3 /*break*/, 9];
                                        case 8:
                                            error_4 = _b.sent();
                                            return [3 /*break*/, 9];
                                        case 9: return [2 /*return*/];
                                    }
                                });
                            });
                        };
                        return [4 /*yield*/, searchRecursively_1(searchDir)];
                    case 1:
                        _a.sent();
                        // スコア順にソートして上位を返す
                        return [2 /*return*/, suggestions_1
                                .sort(function (a, b) { return b.score - a.score; })
                                .slice(0, 10)
                                .map(function (item) { return item.path; })];
                    case 2:
                        error_3 = _a.sent();
                        console.warn('Error finding similar files:', error_3);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * ファイル名の類似度を計算する
     * @param targetPath - ターゲットパス
     * @param candidatePath - 候補パス
     * @param targetBasename - ターゲットのベース名
     * @param targetExt - ターゲットの拡張子
     * @param targetNameWithoutExt - ターゲットの拡張子なし名前
     * @returns 類似度スコア（高いほど類似）
     */
    FileManager.prototype.calculateFileNameSimilarity = function (targetPath, candidatePath, targetBasename, targetExt, targetNameWithoutExt) {
        var candidateBasename = path.basename(candidatePath);
        var candidateExt = path.extname(candidatePath);
        var candidateNameWithoutExt = path.basename(candidatePath, candidateExt);
        var score = 0;
        // 完全一致
        if (candidateBasename === targetBasename) {
            score += 100;
        }
        // 拡張子一致
        if (candidateExt === targetExt && targetExt) {
            score += 50;
        }
        // 名前の部分一致
        if (targetNameWithoutExt && candidateNameWithoutExt.includes(targetNameWithoutExt)) {
            score += 30;
        }
        // パスの類似性（ディレクトリ構造）
        var targetDirs = path.dirname(targetPath).split(path.sep);
        var candidateDirs = path.dirname(candidatePath).split(path.sep);
        for (var i = 0; i < Math.min(targetDirs.length, candidateDirs.length); i++) {
            if (targetDirs[i] === candidateDirs[i]) {
                score += 10;
            }
        }
        // レーベンシュタイン距離による類似度（逆数でスコア化）
        var distance = this.levenshteinDistance(targetBasename.toLowerCase(), candidateBasename.toLowerCase());
        if (distance < targetBasename.length) {
            score += Math.max(0, 20 - distance * 2);
        }
        return score;
    };
    /**
     * レーベンシュタイン距離を計算する
     * @param str1 - 文字列1
     * @param str2 - 文字列2
     * @returns 距離
     */
    FileManager.prototype.levenshteinDistance = function (str1, str2) {
        var matrix = [];
        // 初期化
        for (var i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (var j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        // 距離計算
        for (var i = 1; i <= str2.length; i++) {
            for (var j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1, // insertion
                    matrix[i - 1][j] + 1 // deletion
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    };
    /**
     * 03_fileChanges.txtから変更されたファイルリストを読み取る
     * @returns 変更されたファイルパスの配列
     */
    FileManager.prototype.loadChangedFilesList = function () {
        return __awaiter(this, void 0, void 0, function () {
            var changedFilesContent, lines, parsed;
            return __generator(this, function (_a) {
                try {
                    changedFilesContent = this.safeReadPromptFile(this.defaultPromptFiles.fileChanges, '');
                    if (!changedFilesContent.trim()) {
                        console.warn('⚠️  03_fileChanges.txt が空か見つかりません');
                        return [2 /*return*/, []];
                    }
                    lines = void 0;
                    try {
                        parsed = JSON.parse(changedFilesContent);
                        if (Array.isArray(parsed)) {
                            lines = parsed;
                        }
                        else {
                            throw new Error('Not an array');
                        }
                    }
                    catch (_b) {
                        // 単純なリスト形式の場合
                        lines = changedFilesContent.split('\n')
                            .map(function (line) { return line.trim(); })
                            .filter(function (line) { return line && !line.startsWith('#'); }); // コメント行を除去
                    }
                    console.log("\uD83D\uDCCB \u5909\u66F4\u3055\u308C\u305F\u30D5\u30A1\u30A4\u30EB\u6570: ".concat(lines.length));
                    console.log("\uD83D\uDCCB \u5909\u66F4\u30D5\u30A1\u30A4\u30EB\u30EA\u30B9\u30C8: ".concat(lines.join(', ')));
                    return [2 /*return*/, lines];
                }
                catch (error) {
                    console.error('❌ 変更ファイルリスト読み込みエラー:', error);
                    return [2 /*return*/, []];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * 要求されたファイルパスが変更リストに含まれているかを検知
     * @param requestedFilePath - LLMが要求するファイルパス
     * @param changedFiles - 変更されたファイルリスト
     * @returns 検知結果
     */
    FileManager.prototype.detectFileChangeStatus = function (requestedFilePath, changedFiles) {
        // 正規化された形でチェック
        var normalizedRequestPath = requestedFilePath.replace(/^\/+/, '').replace(/\\/g, '/');
        console.log("\uD83D\uDD0D \u5909\u66F4\u691C\u77E5: \"".concat(normalizedRequestPath, "\" \u3092\u30C1\u30A7\u30C3\u30AF\u4E2D..."));
        var isInChangeList = changedFiles.some(function (changedFile) {
            var normalizedChangedFile = changedFile.replace(/^\/+/, '').replace(/\\/g, '/');
            // 完全一致
            if (normalizedChangedFile === normalizedRequestPath) {
                console.log("  \u2705 \u5B8C\u5168\u4E00\u81F4: ".concat(normalizedChangedFile));
                return true;
            }
            // パスの末尾一致（ディレクトリ構造を考慮）
            if (normalizedChangedFile.endsWith('/' + normalizedRequestPath)) {
                console.log("  \u2705 \u672B\u5C3E\u4E00\u81F4: ".concat(normalizedChangedFile));
                return true;
            }
            if (normalizedRequestPath.endsWith('/' + normalizedChangedFile)) {
                console.log("  \u2705 \u524D\u65B9\u4E00\u81F4: ".concat(normalizedChangedFile));
                return true;
            }
            return false;
        });
        var status = isInChangeList ? 'CHANGED' : 'UNCHANGED';
        var templateToUse = isInChangeList ? 'TEMPLATE_5' : 'TEMPLATE_2';
        var message;
        if (isInChangeList) {
            message = "[NOTICE: File version mismatch] LLM expects post-change state, but system can only provide pre-change file content.";
            console.log("  \uD83D\uDD04 \u5909\u66F4\u691C\u77E5\u7D50\u679C: CHANGED - Template 5\u3092\u4F7F\u7528");
        }
        else {
            message = "[INFO] This file has not been changed before and after the commit.";
            console.log("  \u2705 \u5909\u66F4\u691C\u77E5\u7D50\u679C: UNCHANGED - Template 2\u3092\u4F7F\u7528");
        }
        return {
            filePath: requestedFilePath,
            status: status,
            isInChangeList: isInChangeList,
            templateToUse: templateToUse,
            message: message
        };
    };
    /**
     * ファイル変更検知を含む拡張版getFileContents
     * @param fileInfos - FILE_CONTENTタイプのRequiredFileInfo配列
     * @returns ファイル内容の文字列（変更検知情報付き）
     */
    FileManager.prototype.getFileContentsWithChangeDetection = function (fileInfos) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, changedFiles, filePaths, fileChecks, summary, contents, results, i, filePath, fileCheck, relativePath, fileStartTime, detectionResult, result, errorMsg, originalPath, suggestions, suggestionText, errorMsg, errorMsg, errorMsg, content, enhancedContent, statusIcon, error_5, errorMsg, totalTime;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        console.log('📂 ファイル内容取得を開始（変更検知有効）...');
                        return [4 /*yield*/, this.loadChangedFilesList()];
                    case 1:
                        changedFiles = _a.sent();
                        filePaths = fileInfos
                            .filter(function (info) { return info.type === 'FILE_CONTENT'; })
                            .map(function (info) { return path.join(_this.config.inputProjectDir, info.path); });
                        if (filePaths.length === 0) {
                            console.log('📂 処理対象ファイルなし');
                            return [2 /*return*/, ''];
                        }
                        console.log("\uD83D\uDCC2 \u5BFE\u8C61\u30D5\u30A1\u30A4\u30EB\u6570: ".concat(filePaths.length));
                        return [4 /*yield*/, this.batchFileExistenceCheck(filePaths)];
                    case 2:
                        fileChecks = _a.sent();
                        summary = {
                            totalFiles: filePaths.length,
                            successCount: 0,
                            errorCount: 0,
                            totalSize: 0,
                            totalProcessingTime: 0,
                            errors: []
                        };
                        contents = [];
                        results = [];
                        i = 0;
                        _a.label = 3;
                    case 3:
                        if (!(i < filePaths.length)) return [3 /*break*/, 16];
                        filePath = filePaths[i];
                        fileCheck = fileChecks[i];
                        relativePath = path.relative(this.config.inputProjectDir, filePath);
                        fileStartTime = Date.now();
                        detectionResult = this.detectFileChangeStatus(fileInfos[i].path, changedFiles);
                        result = {
                            success: false,
                            path: filePath,
                            relativePath: relativePath,
                            processingTime: 0
                        };
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 13, , 14]);
                        if (!!fileCheck.exists) return [3 /*break*/, 8];
                        if (!relativePath.endsWith('.pb.go')) return [3 /*break*/, 5];
                        errorMsg = this.generateProtobufFileErrorMessage(relativePath);
                        contents.push("--- ".concat(relativePath, "\n").concat(errorMsg));
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: 'Generated .pb.go file not found' });
                        summary.errorCount++;
                        return [3 /*break*/, 7];
                    case 5:
                        originalPath = fileInfos[i].path;
                        return [4 /*yield*/, this.findSimilarFiles(originalPath, this.config.inputProjectDir)];
                    case 6:
                        suggestions = _a.sent();
                        suggestionText = suggestions.length > 0
                            ? "\n\n\u985E\u4F3C\u30D5\u30A1\u30A4\u30EB\u306E\u5019\u88DC:\n".concat(suggestions.slice(0, 5).map(function (s) { return "  - ".concat(s); }).join('\n'))
                            : '';
                        errorMsg = "\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(fileCheck.error || 'File not found').concat(suggestionText);
                        contents.push("--- ".concat(relativePath, "\n[").concat(errorMsg, "]"));
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: errorMsg });
                        summary.errorCount++;
                        _a.label = 7;
                    case 7: return [3 /*break*/, 12];
                    case 8:
                        if (!!fileCheck.isFile) return [3 /*break*/, 9];
                        errorMsg = 'ディレクトリが指定されました（ファイルを期待）';
                        contents.push("--- ".concat(relativePath, "\n[").concat(errorMsg, "]"));
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: errorMsg });
                        summary.errorCount++;
                        return [3 /*break*/, 12];
                    case 9:
                        if (!!this.isFileSizeWithinLimit(fileCheck.size)) return [3 /*break*/, 10];
                        errorMsg = "\u30D5\u30A1\u30A4\u30EB\u30B5\u30A4\u30BA\u304C\u5236\u9650\u3092\u8D85\u3048\u3066\u3044\u307E\u3059: ".concat(this.formatFileSize(fileCheck.size), " > ").concat(this.formatFileSize(this.fileOperationConfig.maxFileSize));
                        contents.push("--- ".concat(relativePath, "\n[").concat(errorMsg, "]"));
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: errorMsg });
                        summary.errorCount++;
                        return [3 /*break*/, 12];
                    case 10: return [4 /*yield*/, this.readFileWithTimeout(filePath)];
                    case 11:
                        content = _a.sent();
                        enhancedContent = "--- ".concat(relativePath, "\n").concat(detectionResult.message, "\n\n").concat(content);
                        contents.push(enhancedContent);
                        result.success = true;
                        result.size = fileCheck.size;
                        summary.successCount++;
                        summary.totalSize += fileCheck.size;
                        statusIcon = detectionResult.status === 'CHANGED' ? '🔄' : '✅';
                        console.log("  ".concat(statusIcon, " ").concat(relativePath, " (").concat(this.formatFileSize(fileCheck.size), ") - ").concat(detectionResult.templateToUse));
                        _a.label = 12;
                    case 12: return [3 /*break*/, 14];
                    case 13:
                        error_5 = _a.sent();
                        errorMsg = "\u30D5\u30A1\u30A4\u30EB\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ".concat(error_5.message);
                        contents.push("--- ".concat(relativePath, "\n[").concat(errorMsg, "]"));
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: errorMsg });
                        summary.errorCount++;
                        console.error("  \u274C ".concat(relativePath, ": ").concat(errorMsg));
                        // 詳細なファイル操作エラーログを記録
                        this.logger.logFileOperationError('READ_FILE', filePath, error_5, {
                            relativePath: relativePath,
                            attemptedEncoding: this.fileOperationConfig.encoding,
                            maxFileSize: this.fileOperationConfig.maxFileSize,
                            timeout: this.fileOperationConfig.timeoutMs
                        });
                        return [3 /*break*/, 14];
                    case 14:
                        result.processingTime = Date.now() - fileStartTime;
                        summary.totalProcessingTime += result.processingTime;
                        results.push(result);
                        _a.label = 15;
                    case 15:
                        i++;
                        return [3 /*break*/, 3];
                    case 16:
                        totalTime = Date.now() - startTime;
                        console.log('\n📊 ファイル処理統計（変更検知付き）:');
                        console.log("   \u6210\u529F: ".concat(summary.successCount, "/").concat(summary.totalFiles, " \u30D5\u30A1\u30A4\u30EB"));
                        console.log("   \u30A8\u30E9\u30FC: ".concat(summary.errorCount, "/").concat(summary.totalFiles, " \u30D5\u30A1\u30A4\u30EB"));
                        console.log("   \u7DCF\u30B5\u30A4\u30BA: ".concat(this.formatFileSize(summary.totalSize)));
                        console.log("   \u51E6\u7406\u6642\u9593: ".concat(totalTime, "ms"));
                        console.log("   \u5909\u66F4\u691C\u77E5\u5BFE\u8C61: ".concat(changedFiles.length, " \u30D5\u30A1\u30A4\u30EB"));
                        if (summary.errors.length > 0) {
                            console.log('   ❌ エラー詳細:');
                            summary.errors.forEach(function (err) { return console.log("      - ".concat(err.path, ": ").concat(err.error)); });
                        }
                        return [2 /*return*/, contents.join('\n\n')];
                }
            });
        });
    };
    /**
     * Template 5（ファイルバージョン不整合）用のプロンプトを読み込み
     * @param requestedFileContent - 要求されたファイルの内容
     * @returns Template 5プロンプト文字列
     */
    FileManager.prototype.readFileVersionMismatchPrompt = function (requestedFileContent) {
        console.log('📋 Template 5プロンプト読み込み開始...');
        var promptText = this.safeReadPromptFile(
        // this.defaultPromptFiles.fileVersionMismatch,
        'templates/fileVersionMismatch.txt', '# Template 5: Context Discrepancy Notification Prompt\n\n{{fileVersionMismatch}}\n\n{{protoFile}}\n{{fileChanges}}\n{{suspectedFiles}}');
        // 各プロンプトファイルの読み込み
        var protoFileContent = this.safeReadPromptFile(this.defaultPromptFiles.protoFile, '# Proto file information is not available');
        var protoFileChanges = this.safeReadPromptFile(this.defaultPromptFiles.protoFileChanges, '# Proto file change information is not available');
        var fileChangesContent = this.safeReadPromptFile(this.defaultPromptFiles.fileChanges, '# File change information is not available');
        var suspectedFiles = this.safeReadPromptFile(this.defaultPromptFiles.suspectedFiles, '# Suspected file information is not available');
        // テンプレートコンテキストの構築
        var context = {
            protoFile: protoFileContent,
            protoFileChanges: protoFileChanges,
            fileChanges: fileChangesContent,
            surroundedFilePath: '', // Template 5では使用しない
            suspectedFiles: suspectedFiles,
            fileVersionMismatch: requestedFileContent
        };
        // Handlebarsテンプレートの実行
        try {
            var template = Handlebars.compile(promptText, { noEscape: true });
            var result = template(context);
            console.log('✅ Template 5プロンプト読み込み完了');
            return result;
        }
        catch (error) {
            console.error('❌ Template 5プロンプトのコンパイルエラー:', error.message);
            console.warn('⚠️  フォールバック: 変数展開なしのプロンプトテキストを返します');
            return promptText;
        }
    };
    /**
     * 拡張版プロンプトファイル読み込み（Template 5サポート）
     * @param useFileVersionMismatchTemplate - Template 5を使用するかどうか
     * @param requestedFileContent - 要求されたファイルの内容（Template 5用）
     * @returns 適切なテンプレートが適用されたプロンプト文字列
     */
    FileManager.prototype.readPromptFileWithChangeDetection = function (useFileVersionMismatchTemplate, requestedFileContent) {
        if (useFileVersionMismatchTemplate === void 0) { useFileVersionMismatchTemplate = false; }
        if (requestedFileContent === void 0) { requestedFileContent = ''; }
        console.log('📋 プロンプトファイルの読み込みを開始（変更検知対応）...');
        // メインプロンプトファイルの決定
        var promptFileName = useFileVersionMismatchTemplate
            ? 'templates/fileVersionMismatch.txt' // Template 5
            : this.config.promptTextfile; // 通常のTemplate（Template 2等）
        // メインプロンプトファイルの読み込み
        var promptText = this.safeReadPromptFile(promptFileName, useFileVersionMismatchTemplate
            ? "# Template 5: Context Discrepancy Notification Prompt\n\n## \u26A0\uFE0F Context Warning: Discrepancy Between Provided Files and Expected State ##\n\nThe files you requested have been modified in this commit.\nDue to my operational constraints, I can only provide file contents from the **pre-change state (premerge state)**.\n\n{{protoFile}}\n{{protoFileChanges}}\n{{fileChanges}}\n{{fileVersionMismatch}}\n{{suspectedFiles}}\n\nLeverage this constraint to maximize your differential reasoning capabilities."
            : '# Default Prompt\n\nFix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections.\n\n{{protoFile}}\n{{protoFileChanges}}\n{{fileChanges}}\n{{surroundedFilePath}}\n{{suspectedFiles}}');
        // 各プロンプトファイルの読み込み（フォールバック付き）
        var protoFileContent = this.safeReadPromptFile(this.defaultPromptFiles.protoFile, '# Proto file information is not available');
        var protoFileChanges = this.safeReadPromptFile(this.defaultPromptFiles.protoFileChanges, '# Proto file change information is not available');
        var fileChangesContent = this.safeReadPromptFile(this.defaultPromptFiles.fileChanges, '# File change information is not available');
        var surroundedFilePath = this.safeReadPromptFile(this.defaultPromptFiles.surroundedFilePath, '# File path information is not available');
        var suspectedFiles = this.safeReadPromptFile(this.defaultPromptFiles.suspectedFiles, '# Suspected file information is not available');
        // Template 5用の要求されたファイル内容
        var fileVersionMismatchContent = useFileVersionMismatchTemplate && requestedFileContent
            ? requestedFileContent
            : '# Requested file content is not available';
        // テンプレートコンテキストの構築と検証
        var context = __assign({ protoFile: protoFileContent, protoFileChanges: protoFileChanges, fileChanges: fileChangesContent, surroundedFilePath: surroundedFilePath, suspectedFiles: suspectedFiles }, (useFileVersionMismatchTemplate && { fileVersionMismatch: fileVersionMismatchContent }));
        var validation = this.validateTemplateContext(context);
        if (!validation.isValid) {
            console.warn('⚠️  テンプレート変数に問題があります:');
            validation.errors.forEach(function (error) { return console.warn("   - ".concat(error)); });
        }
        // Handlebarsテンプレートのコンパイルと実行
        try {
            var template = Handlebars.compile(promptText, { noEscape: true });
            var result = template(context);
            var templateType = useFileVersionMismatchTemplate ? 'Template 5 (コンテキスト不整合)' : 'Template 2 (通常)';
            console.log("\u2705 \u30D7\u30ED\u30F3\u30D7\u30C8\u30D5\u30A1\u30A4\u30EB\u306E\u8AAD\u307F\u8FBC\u307F\u5B8C\u4E86 - ".concat(templateType));
            return result;
        }
        catch (error) {
            console.error('❌ Handlebarsテンプレートのコンパイルエラー:', error.message);
            console.warn('⚠️  フォールバック: 変数展開なしのプロンプトテキストを返します');
            return promptText;
        }
    };
    /**
     * ファイル変更検知を含む統合処理フローメソッド
     * @param fileInfos - RequiredFileInfo配列
     * @returns 適切なテンプレートが適用された結果
     */
    FileManager.prototype.processRequiredFileInfosWithChangeDetection = function (fileInfos) {
        return __awaiter(this, void 0, void 0, function () {
            var changedFiles, fileContentInfos, changedFileDetections, hasChangedFiles, templateToUse, changedFilePaths, results, fileContents, template5Prompt, directoryListingInfos, directoryListings, changeDetectionSummary;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('🔄 統合処理フロー開始（変更検知有効）...');
                        return [4 /*yield*/, this.loadChangedFilesList()];
                    case 1:
                        changedFiles = _a.sent();
                        fileContentInfos = fileInfos.filter(function (info) { return info.type === 'FILE_CONTENT'; });
                        changedFileDetections = fileContentInfos.map(function (info) {
                            return _this.detectFileChangeStatus(info.path, changedFiles);
                        });
                        hasChangedFiles = changedFileDetections.some(function (detection) { return detection.status === 'CHANGED'; });
                        templateToUse = hasChangedFiles ? 'TEMPLATE_5' : 'TEMPLATE_2';
                        console.log("\uD83D\uDCCB \u9078\u629E\u3055\u308C\u305F\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8: ".concat(templateToUse));
                        if (hasChangedFiles) {
                            changedFilePaths = changedFileDetections
                                .filter(function (d) { return d.status === 'CHANGED'; })
                                .map(function (d) { return d.filePath; });
                            console.log("\u26A0\uFE0F  \u5909\u66F4\u3055\u308C\u305F\u30D5\u30A1\u30A4\u30EB: ".concat(changedFilePaths.join(', ')));
                        }
                        results = [];
                        if (!(fileContentInfos.length > 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.getFileContentsWithChangeDetection(fileContentInfos)];
                    case 2:
                        fileContents = _a.sent();
                        if (fileContents) {
                            // Template 5の場合、ファイル内容を{{fileVersionMismatch}}変数として処理
                            if (templateToUse === 'TEMPLATE_5') {
                                template5Prompt = this.readPromptFileWithChangeDetection(true, fileContents);
                                results.push(template5Prompt);
                            }
                            else {
                                // Template 2の場合は通常の処理
                                results.push('=== FILE CONTENTS ===\n' + fileContents);
                            }
                        }
                        _a.label = 3;
                    case 3:
                        directoryListingInfos = fileInfos.filter(function (info) { return info.type === 'DIRECTORY_LISTING'; });
                        if (!(directoryListingInfos.length > 0)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.getDirectoryListings(directoryListingInfos)];
                    case 4:
                        directoryListings = _a.sent();
                        if (directoryListings) {
                            results.push('=== DIRECTORY STRUCTURES ===\n' + directoryListings);
                        }
                        _a.label = 5;
                    case 5:
                        changeDetectionSummary = {
                            totalRequested: fileContentInfos.length,
                            changedFiles: changedFileDetections.filter(function (d) { return d.status === 'CHANGED'; }).length,
                            unchangedFiles: changedFileDetections.filter(function (d) { return d.status === 'UNCHANGED'; }).length,
                            changedFilesList: changedFileDetections
                                .filter(function (d) { return d.status === 'CHANGED'; })
                                .map(function (d) { return d.filePath; })
                        };
                        console.log('📊 変更検知サマリー:');
                        console.log("   \u8981\u6C42\u30D5\u30A1\u30A4\u30EB\u7DCF\u6570: ".concat(changeDetectionSummary.totalRequested));
                        console.log("   \u5909\u66F4\u3055\u308C\u305F\u30D5\u30A1\u30A4\u30EB: ".concat(changeDetectionSummary.changedFiles));
                        console.log("   \u672A\u5909\u66F4\u30D5\u30A1\u30A4\u30EB: ".concat(changeDetectionSummary.unchangedFiles));
                        return [2 /*return*/, {
                                content: results.join('\n\n'),
                                templateUsed: templateToUse,
                                changeDetectionSummary: changeDetectionSummary
                            }];
                }
            });
        });
    };
    /**
     * .pb.goファイル用の特別なエラーメッセージを生成
     */
    FileManager.prototype.generateProtobufFileErrorMessage = function (relativePath) {
        var protoPath = relativePath.replace('.pb.go', '.proto');
        return "\n\u26A0\uFE0F  \u81EA\u52D5\u751F\u6210\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(relativePath, "\n\n\u3053\u306E\u30D5\u30A1\u30A4\u30EB\u306F.proto\u30D5\u30A1\u30A4\u30EB\u304B\u3089\u81EA\u52D5\u751F\u6210\u3055\u308C\u308B\u30D5\u30A1\u30A4\u30EB\u3067\u3059\u3002\n\u73FE\u5728\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u72B6\u614B\u3067\u306F\u3001\u4EE5\u4E0B\u306E\u3044\u305A\u308C\u304B\u306E\u7406\u7531\u3067\u5B58\u5728\u3057\u306A\u3044\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\uFF1A\n\n1. proto\u30D5\u30A1\u30A4\u30EB (").concat(protoPath, ") \u304B\u3089\u307E\u3060\u751F\u6210\u3055\u308C\u3066\u3044\u306A\u3044\n2. \u30D3\u30EB\u30C9\u30D7\u30ED\u30BB\u30B9\u304C\u5B9F\u884C\u3055\u308C\u3066\u3044\u306A\u3044\n3. \u751F\u6210\u30B3\u30DE\u30F3\u30C9 (protoc) \u304C\u5B9F\u884C\u3055\u308C\u3066\u3044\u306A\u3044\n4. \u30D5\u30A1\u30A4\u30EB\u30D1\u30B9\u304C\u5909\u66F4\u3055\u308C\u3066\u3044\u308B\n\n\uD83D\uDD0D \u63A8\u5968\u30A2\u30AF\u30B7\u30E7\u30F3:\n- \u3053\u306E\u30D5\u30A1\u30A4\u30EB\u306E\u5185\u5BB9\u3092\u4EEE\u5B9A\u3057\u3066\u4FEE\u6B63\u3092\u884C\u308F\u306A\u3044\u3067\u304F\u3060\u3055\u3044\n- \u4EE3\u308F\u308A\u306B\u3001\u5BFE\u5FDC\u3059\u308B.proto\u30D5\u30A1\u30A4\u30EB\u306E\u5909\u66F4\u306B\u57FA\u3065\u3044\u3066\u4FEE\u6B63\u3092\u884C\u3063\u3066\u304F\u3060\u3055\u3044\n- .pb.go\u30D5\u30A1\u30A4\u30EB\u306F.proto\u30D5\u30A1\u30A4\u30EB\u304B\u3089\u81EA\u52D5\u518D\u751F\u6210\u3055\u308C\u308B\u305F\u3081\u3001\u76F4\u63A5\u7DE8\u96C6\u306F\u4E0D\u8981\u3067\u3059\n\n\uD83D\uDCDD \u5BFE\u5FDC\u3059\u308B.proto\u30D5\u30A1\u30A4\u30EB: ").concat(protoPath, "\n");
    };
    return FileManager;
}());
exports.default = FileManager;
