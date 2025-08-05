"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafeBatchRunner = void 0;
var fs_1 = require("fs");
var path_1 = require("path");
var dotenv_1 = require("dotenv");
var llmFlowController_js_1 = require("../dist/js/modules/llmFlowController.js");
var url_1 = require("url");
var path_2 = require("path");
// ES module環境での __dirname の取得
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = (0, path_2.dirname)(__filename);
// 環境変数の設定 - 正しいパスで .env ファイルを読み込み
(0, dotenv_1.config)({ path: path_1.default.join(__dirname, '..', '.env') });
var SafeBatchRunner = /** @class */ (function () {
    function SafeBatchRunner(baseOutputDir) {
        if (baseOutputDir === void 0) { baseOutputDir = '/app/output'; }
        var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.errorReportFile = path_1.default.join(baseOutputDir, "error_report_".concat(timestamp, ".json"));
        this.summaryReportFile = path_1.default.join(baseOutputDir, "processing_summary_".concat(timestamp, ".json"));
        // 環境変数デバッグ情報
        console.log("\uD83D\uDD0D SafeBatchRunner Environment Debug:");
        console.log("   LLM_PROVIDER: ".concat(process.env.LLM_PROVIDER || 'undefined'));
        console.log("   GEMINI_API_KEY length: ".concat((process.env.GEMINI_API_KEY || '').length));
        console.log("   OPENAI_TOKEN length: ".concat((process.env.OPENAI_TOKEN || '').length));
        console.log("   OPENAI_API_KEY length: ".concat((process.env.OPENAI_API_KEY || '').length));
        this.stats = {
            totalRepositories: 0,
            totalCategories: 0,
            totalPullRequests: 0,
            successfulPullRequests: 0,
            failedPullRequests: 0,
            skippedPullRequests: 0,
            startTime: new Date(),
            errorsByType: {}
        };
        // 出力ディレクトリの作成
        if (!fs_1.default.existsSync(baseOutputDir)) {
            fs_1.default.mkdirSync(baseOutputDir, { recursive: true });
        }
        console.log("\uD83D\uDCCB Error report will be saved to: ".concat(this.errorReportFile));
        console.log("\uD83D\uDCCB Summary report will be saved to: ".concat(this.summaryReportFile));
    }
    /**
     * エラーレポートを追記
     */
    SafeBatchRunner.prototype.appendErrorReport = function (errorReport) {
        try {
            var existingErrors = [];
            // 既存のエラーレポートを読み込み
            if (fs_1.default.existsSync(this.errorReportFile)) {
                var content = fs_1.default.readFileSync(this.errorReportFile, 'utf-8');
                existingErrors = JSON.parse(content);
            }
            // 新しいエラーを追加
            existingErrors.push(errorReport);
            // ファイルに書き込み
            fs_1.default.writeFileSync(this.errorReportFile, JSON.stringify(existingErrors, null, 2));
            console.log("\u274C Error recorded: ".concat(errorReport.pullRequestTitle, " (").concat(errorReport.errorType, ")"));
            console.log("   Error message: ".concat(errorReport.errorMessage));
            console.log("   Total errors so far: ".concat(existingErrors.length));
        }
        catch (writeError) {
            console.error("\u274C Failed to write error report:", writeError);
        }
    };
    /**
     * 処理統計を更新
     */
    SafeBatchRunner.prototype.updateStats = function (type, errorType) {
        switch (type) {
            case 'success':
                this.stats.successfulPullRequests++;
                break;
            case 'failure':
                this.stats.failedPullRequests++;
                if (errorType) {
                    this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
                }
                break;
            case 'skip':
                this.stats.skippedPullRequests++;
                break;
        }
    };
    /**
     * 統計サマリーを保存
     */
    SafeBatchRunner.prototype.saveSummaryReport = function () {
        try {
            this.stats.endTime = new Date();
            this.stats.totalDuration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
            var summary = __assign(__assign({}, this.stats), { totalDurationFormatted: this.formatDuration(this.stats.totalDuration), successRate: this.stats.totalPullRequests > 0
                    ? Math.round((this.stats.successfulPullRequests / this.stats.totalPullRequests) * 100)
                    : 0, errorReportPath: this.errorReportFile, topErrorTypes: Object.entries(this.stats.errorsByType)
                    .sort(function (_a, _b) {
                    var a = _a[1];
                    var b = _b[1];
                    return b - a;
                })
                    .slice(0, 5)
                    .map(function (_a) {
                    var type = _a[0], count = _a[1];
                    return ({ type: type, count: count });
                }) });
            fs_1.default.writeFileSync(this.summaryReportFile, JSON.stringify(summary, null, 2));
            console.log("\uD83D\uDCCA Summary report saved to: ".concat(this.summaryReportFile));
        }
        catch (error) {
            console.error("\u274C Failed to save summary report:", error);
        }
    };
    /**
     * 継続時間をフォーマット
     */
    SafeBatchRunner.prototype.formatDuration = function (milliseconds) {
        var seconds = Math.floor(milliseconds / 1000);
        var minutes = Math.floor(seconds / 60);
        var hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return "".concat(hours, "h ").concat(minutes % 60, "m ").concat(seconds % 60, "s");
        }
        else if (minutes > 0) {
            return "".concat(minutes, "m ").concat(seconds % 60, "s");
        }
        else {
            return "".concat(seconds, "s");
        }
    };
    /**
     * 処理結果を解析してログファイルから成功/失敗を判定
     */
    SafeBatchRunner.prototype.analyzeProcessingResult = function (repositoryName, category, pullRequestTitle, pullRequestPath, premergeDir) {
        var _a;
        try {
            // ログディレクトリの検索
            var logDir = path_1.default.join('/app/log', repositoryName, category, pullRequestTitle);
            if (!fs_1.default.existsSync(logDir)) {
                console.log("\u26A0\uFE0F  Log directory not found: ".concat(logDir));
                return false;
            }
            // .logファイルを検索
            var logFiles = fs_1.default.readdirSync(logDir).filter(function (file) { return file.endsWith('.log'); });
            if (logFiles.length === 0) {
                console.log("\u26A0\uFE0F  No log files found for ".concat(pullRequestTitle));
                return false;
            }
            // 最新のログファイルを確認
            var latestLogFile = logFiles.sort().pop();
            if (!latestLogFile)
                return false;
            var logFilePath = path_1.default.join(logDir, latestLogFile);
            var logContent = fs_1.default.readFileSync(logFilePath, 'utf-8');
            var logData = JSON.parse(logContent);
            // ステータスを確認（%%_Fin_%%タグベースの厳密な判定）
            var status_1 = ((_a = logData.experiment_metadata) === null || _a === void 0 ? void 0 : _a.status) || 'Unknown';
            // %%_Fin_%%タグの存在確認
            var hasFinTag = logContent.includes('%%_Fin_%%') || status_1.includes('%%_Fin_%%');
            // 明示的なエラーの確認
            var hasErrors = logContent.includes('400 This model\'s maximum context length') ||
                logContent.includes('JSON parse failed') ||
                status_1.includes('Incomplete') ||
                status_1.includes('Error') ||
                status_1.includes('Failed');
            // 成功条件: %%_Fin_%%タグがあり、重大なエラーがない
            var isSuccess = hasFinTag && !hasErrors;
            console.log("\uD83D\uDCCA Processing result for ".concat(pullRequestTitle, ":"));
            console.log("   Status: ".concat(status_1));
            console.log("   %%_Fin_%% tag: ".concat(hasFinTag ? 'YES' : 'NO'));
            console.log("   Has errors: ".concat(hasErrors ? 'YES' : 'NO'));
            console.log("   Final result: ".concat(isSuccess ? 'SUCCESS' : 'FAILURE'));
            return isSuccess;
        }
        catch (error) {
            console.error("\u274C Error analyzing processing result for ".concat(pullRequestTitle, ":"), error);
            return false;
        }
    };
    /**
     * 単一のPullRequestを安全に処理
     */
    SafeBatchRunner.prototype.processSinglePullRequest = function (repositoryName, category, pullRequestTitle, pullRequestPath, premergeDir) {
        return __awaiter(this, void 0, void 0, function () {
            var controller, maxRetries, lastError, _loop_1, this_1, retry, state_1, errorReport;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        controller = null;
                        maxRetries = 3;
                        lastError = null;
                        _loop_1 = function (retry) {
                            var isActualSuccess, error_1, isRetryableError, waitTime_1, cleanupError_1;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 8]);
                                        console.log("\uD83D\uDD04 Processing (attempt ".concat(retry + 1, "/").concat(maxRetries + 1, "): ").concat(repositoryName, "/").concat(category, "/").concat(pullRequestTitle));
                                        // LLMFlowControllerを直接インスタンス化
                                        controller = new llmFlowController_js_1.default(premergeDir);
                                        // エラーハンドリングを強化した処理実行
                                        return [4 /*yield*/, this_1.runControllerWithEnhancedErrorHandling(controller, repositoryName, category, pullRequestTitle)];
                                    case 1:
                                        // エラーハンドリングを強化した処理実行
                                        _b.sent();
                                        isActualSuccess = this_1.analyzeProcessingResult(repositoryName, category, pullRequestTitle, pullRequestPath, premergeDir);
                                        if (isActualSuccess) {
                                            console.log("\u2705 Successfully processed: ".concat(pullRequestTitle));
                                            this_1.updateStats('success');
                                            return [2 /*return*/, { value: true }];
                                        }
                                        else {
                                            console.log("\u26A0\uFE0F  Processing completed but status indicates failure: ".concat(pullRequestTitle));
                                            this_1.updateStats('failure', 'ProcessingIncomplete');
                                            return [2 /*return*/, { value: false }];
                                        }
                                        return [3 /*break*/, 8];
                                    case 2:
                                        error_1 = _b.sent();
                                        lastError = error_1 instanceof Error ? error_1 : new Error(String(error_1));
                                        console.error("\u274C Error in attempt ".concat(retry + 1, "/").concat(maxRetries + 1, " for ").concat(pullRequestTitle, ":"), lastError.message);
                                        isRetryableError = this_1.isRetryableError(lastError);
                                        if (!isRetryableError || retry === maxRetries) {
                                            return [2 /*return*/, "break"];
                                        }
                                        waitTime_1 = Math.pow(2, retry) * 1000;
                                        console.log("\u23F3 Waiting ".concat(waitTime_1, "ms before retry..."));
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, waitTime_1); })];
                                    case 3:
                                        _b.sent();
                                        if (!(controller && typeof controller.cleanup === 'function')) return [3 /*break*/, 7];
                                        _b.label = 4;
                                    case 4:
                                        _b.trys.push([4, 6, , 7]);
                                        return [4 /*yield*/, controller.cleanup()];
                                    case 5:
                                        _b.sent();
                                        return [3 /*break*/, 7];
                                    case 6:
                                        cleanupError_1 = _b.sent();
                                        console.warn("\u26A0\uFE0F  Controller cleanup failed: ".concat(cleanupError_1));
                                        return [3 /*break*/, 7];
                                    case 7:
                                        // ガベージコレクション
                                        if (global.gc) {
                                            global.gc();
                                        }
                                        return [3 /*break*/, 8];
                                    case 8: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        retry = 0;
                        _a.label = 1;
                    case 1:
                        if (!(retry <= maxRetries)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_1(retry)];
                    case 2:
                        state_1 = _a.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        if (state_1 === "break")
                            return [3 /*break*/, 4];
                        _a.label = 3;
                    case 3:
                        retry++;
                        return [3 /*break*/, 1];
                    case 4:
                        errorReport = {
                            timestamp: new Date().toISOString(),
                            repositoryName: repositoryName,
                            category: category,
                            pullRequestTitle: pullRequestTitle,
                            pullRequestPath: pullRequestPath,
                            premergeDir: premergeDir,
                            errorType: (lastError === null || lastError === void 0 ? void 0 : lastError.constructor.name) || 'UnknownError',
                            errorMessage: (lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'Unknown error after retries',
                            stackTrace: (lastError === null || lastError === void 0 ? void 0 : lastError.stack) || '',
                            processingPhase: 'CONTROLLER_EXECUTION_WITH_RETRIES'
                        };
                        this.appendErrorReport(errorReport);
                        this.updateStats('failure', errorReport.errorType);
                        return [2 /*return*/, false];
                }
            });
        });
    };
    /**
     * エラーがリトライ可能かどうかを判定
     */
    SafeBatchRunner.prototype.isRetryableError = function (error) {
        var retryablePatterns = [
            /network|timeout|connection/i,
            /rate.*limit/i,
            /temporary|temp/i,
            /502|503|504/i,
            /JSON.*parse/i,
            /SyntaxError/i,
            /unexpected/i
        ];
        var nonRetryablePatterns = [
            /401|403|404|413/i, // 認証・権限・見つからない・ペイロード過大
            /invalid.*request/i,
            /malformed/i,
            /file.*not.*found/i,
            /directory.*not.*found/i
        ];
        // 非リトライ対象のエラーをチェック
        var errorMessage = error.message.toLowerCase();
        for (var _i = 0, nonRetryablePatterns_1 = nonRetryablePatterns; _i < nonRetryablePatterns_1.length; _i++) {
            var pattern = nonRetryablePatterns_1[_i];
            if (pattern.test(errorMessage)) {
                console.log("\uD83D\uDEAB Non-retryable error detected: ".concat(error.message));
                return false;
            }
        }
        // リトライ対象のエラーをチェック
        for (var _a = 0, retryablePatterns_1 = retryablePatterns; _a < retryablePatterns_1.length; _a++) {
            var pattern = retryablePatterns_1[_a];
            if (pattern.test(errorMessage)) {
                console.log("\uD83D\uDD04 Retryable error detected: ".concat(error.message));
                return true;
            }
        }
        // デフォルトはリトライ対象外
        console.log("\u2753 Unknown error type, not retrying: ".concat(error.message));
        return false;
    };
    /**
     * 強化されたエラーハンドリングでコントローラーを実行
     */
    SafeBatchRunner.prototype.runControllerWithEnhancedErrorHandling = function (controller, repositoryName, category, pullRequestTitle) {
        return __awaiter(this, void 0, void 0, function () {
            var memUsage, timeoutMs_1, timeoutPromise, error_2, memUsageAfter;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 5]);
                        memUsage = process.memoryUsage();
                        console.log("\uD83D\uDCBE Memory before execution: RSS=".concat(Math.round(memUsage.rss / 1024 / 1024), "MB, Heap=").concat(Math.round(memUsage.heapUsed / 1024 / 1024), "MB"));
                        timeoutMs_1 = 30 * 60 * 1000;
                        timeoutPromise = new Promise(function (_, reject) {
                            setTimeout(function () { return reject(new Error("Process timeout after ".concat(timeoutMs_1 / 1000, "s"))); }, timeoutMs_1);
                        });
                        // 実際の処理実行
                        return [4 /*yield*/, Promise.race([
                                controller.run(),
                                timeoutPromise
                            ])];
                    case 1:
                        // 実際の処理実行
                        _b.sent();
                        console.log("\u2705 Controller execution completed for ".concat(pullRequestTitle));
                        return [3 /*break*/, 5];
                    case 2:
                        error_2 = _b.sent();
                        console.error("\u274C Enhanced error handler caught error in ".concat(pullRequestTitle, ":"), error_2);
                        if (!(error_2 instanceof Error && /JSON.*parse|SyntaxError/.test(error_2.message))) return [3 /*break*/, 4];
                        console.log("\uD83D\uDD0D JSON Parse Error Analysis:");
                        console.log("   Error message: ".concat(error_2.message));
                        console.log("   Stack trace preview: ".concat((_a = error_2.stack) === null || _a === void 0 ? void 0 : _a.substring(0, 300), "..."));
                        // ログファイルから問題のある部分を抽出して分析
                        return [4 /*yield*/, this.analyzeJsonParseError(repositoryName, category, pullRequestTitle, error_2)];
                    case 3:
                        // ログファイルから問題のある部分を抽出して分析
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        memUsageAfter = process.memoryUsage();
                        console.log("\uD83D\uDCBE Memory after error: RSS=".concat(Math.round(memUsageAfter.rss / 1024 / 1024), "MB, Heap=").concat(Math.round(memUsageAfter.heapUsed / 1024 / 1024), "MB"));
                        throw error_2;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * JSONパースエラーの詳細分析
     */
    SafeBatchRunner.prototype.analyzeJsonParseError = function (repositoryName, category, pullRequestTitle, error) {
        return __awaiter(this, void 0, void 0, function () {
            var logDir, logFiles, latestLogFile, logFilePath, logContent, llmResponseMatches, lastResponse, contentMatch, content, problemPatterns, _i, problemPatterns_1, pattern, matches;
            return __generator(this, function (_a) {
                try {
                    logDir = path_1.default.join('/app/log', repositoryName, category, pullRequestTitle);
                    if (!fs_1.default.existsSync(logDir)) {
                        console.log("\u26A0\uFE0F  Log directory not found for JSON error analysis: ".concat(logDir));
                        return [2 /*return*/];
                    }
                    logFiles = fs_1.default.readdirSync(logDir).filter(function (file) { return file.endsWith('.log'); });
                    if (logFiles.length === 0) {
                        console.log("\u26A0\uFE0F  No log files found for JSON error analysis");
                        return [2 /*return*/];
                    }
                    latestLogFile = logFiles.sort().pop();
                    if (!latestLogFile)
                        return [2 /*return*/];
                    logFilePath = path_1.default.join(logDir, latestLogFile);
                    logContent = fs_1.default.readFileSync(logFilePath, 'utf-8');
                    console.log("\uD83D\uDD0D JSON Error Analysis for ".concat(pullRequestTitle, ":"));
                    console.log("   Log file: ".concat(logFilePath));
                    console.log("   Log size: ".concat(Math.round(logContent.length / 1024), "KB"));
                    llmResponseMatches = logContent.match(/"llm_response":\s*\{[\s\S]*?"raw_content":\s*"([\s\S]*?)"/g);
                    if (llmResponseMatches) {
                        console.log("   Found ".concat(llmResponseMatches.length, " LLM responses in log"));
                        lastResponse = llmResponseMatches[llmResponseMatches.length - 1];
                        contentMatch = lastResponse.match(/"raw_content":\s*"([\s\S]*?)"/);
                        if (contentMatch) {
                            content = contentMatch[1];
                            console.log("   Last LLM response length: ".concat(content.length, " chars"));
                            console.log("   Content preview: ".concat(content.substring(0, 200), "..."));
                            problemPatterns = [
                                /\\"/g, // エスケープされた引用符
                                /\n/g, // 改行文字
                                /\r/g, // 復帰文字
                                /\t/g, // タブ文字
                                /\\n/g, // エスケープされた改行
                                /\\r/g, // エスケープされた復帰
                                /\\t/g // エスケープされたタブ
                            ];
                            for (_i = 0, problemPatterns_1 = problemPatterns; _i < problemPatterns_1.length; _i++) {
                                pattern = problemPatterns_1[_i];
                                matches = content.match(pattern);
                                if (matches) {
                                    console.log("   Found ".concat(matches.length, " instances of ").concat(pattern.toString()));
                                }
                            }
                        }
                    }
                }
                catch (analysisError) {
                    console.error("\u274C JSON error analysis failed: ".concat(analysisError));
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * 安全なバッチ処理実行
     */
    SafeBatchRunner.prototype.runSafeDatasetProcessing = function (datasetDir) {
        return __awaiter(this, void 0, void 0, function () {
            var datasetDirs, _loop_2, this_2, _i, datasetDirs_1, repositoryName, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\uD83D\uDE80 Starting safe batch processing for: ".concat(datasetDir));
                        console.log("\uD83D\uDCC5 Started at: ".concat(this.stats.startTime.toISOString()));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, 7, 8]);
                        datasetDirs = fs_1.default.readdirSync(datasetDir).filter(function (dir) {
                            return fs_1.default.statSync(path_1.default.join(datasetDir, dir)).isDirectory();
                        });
                        this.stats.totalRepositories = datasetDirs.length;
                        console.log("\uD83D\uDCCA Found ".concat(this.stats.totalRepositories, " repositories to process"));
                        _loop_2 = function (repositoryName) {
                            var savedRepositoryPath, categoryDirs, _loop_3, _b, categoryDirs_1, category;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        savedRepositoryPath = path_1.default.join(datasetDir, repositoryName);
                                        categoryDirs = [];
                                        try {
                                            categoryDirs = fs_1.default.readdirSync(savedRepositoryPath).filter(function (dir) {
                                                return fs_1.default.statSync(path_1.default.join(savedRepositoryPath, dir)).isDirectory();
                                            });
                                        }
                                        catch (err) {
                                            console.error("\u274C Error reading repository ".concat(repositoryName, ":"), err.message);
                                            return [2 /*return*/, "continue"];
                                        }
                                        this_2.stats.totalCategories += categoryDirs.length;
                                        console.log("\uD83D\uDCC1 Repository ".concat(repositoryName, ": ").concat(categoryDirs.length, " categories"));
                                        _loop_3 = function (category) {
                                            var categoryPath, titleDirs, _loop_4, _d, titleDirs_1, pullRequestTitle;
                                            return __generator(this, function (_e) {
                                                switch (_e.label) {
                                                    case 0:
                                                        categoryPath = path_1.default.join(savedRepositoryPath, category);
                                                        titleDirs = [];
                                                        try {
                                                            titleDirs = fs_1.default.readdirSync(categoryPath).filter(function (dir) {
                                                                return fs_1.default.statSync(path_1.default.join(categoryPath, dir)).isDirectory();
                                                            });
                                                        }
                                                        catch (err) {
                                                            console.error("\u274C Error reading category ".concat(category, ":"), err.message);
                                                            return [2 /*return*/, "continue"];
                                                        }
                                                        this_2.stats.totalPullRequests += titleDirs.length;
                                                        console.log("\uD83D\uDCCB Category ".concat(category, ": ").concat(titleDirs.length, " pull requests"));
                                                        _loop_4 = function (pullRequestTitle) {
                                                            var pullRequestPath, premergeDir, success, processed, progress, memUsage, memUsageMB, memUsageAfterGC, memUsageAfterMB, dirError_1, errorReport;
                                                            return __generator(this, function (_f) {
                                                                switch (_f.label) {
                                                                    case 0:
                                                                        pullRequestPath = path_1.default.join(categoryPath, pullRequestTitle);
                                                                        _f.label = 1;
                                                                    case 1:
                                                                        _f.trys.push([1, 3, , 4]);
                                                                        premergeDir = fs_1.default.readdirSync(pullRequestPath)
                                                                            .map(function (dir) { return path_1.default.join(pullRequestPath, dir); })
                                                                            .find(function (filePath) {
                                                                            return fs_1.default.statSync(filePath).isDirectory() &&
                                                                                path_1.default.basename(filePath).startsWith('premerge');
                                                                        });
                                                                        if (!premergeDir) {
                                                                            console.warn("\u26A0\uFE0F  No premerge directory found in ".concat(pullRequestPath));
                                                                            this_2.updateStats('skip');
                                                                            return [2 /*return*/, "continue"];
                                                                        }
                                                                        return [4 /*yield*/, this_2.processSinglePullRequest(repositoryName, category, pullRequestTitle, pullRequestPath, premergeDir)];
                                                                    case 2:
                                                                        success = _f.sent();
                                                                        // 進捗報告
                                                                        if (this_2.stats.totalPullRequests > 0) {
                                                                            processed = this_2.stats.successfulPullRequests + this_2.stats.failedPullRequests + this_2.stats.skippedPullRequests;
                                                                            progress = Math.round((processed / this_2.stats.totalPullRequests) * 100);
                                                                            console.log("\uD83D\uDCCA Progress: ".concat(processed, "/").concat(this_2.stats.totalPullRequests, " (").concat(progress, "%) - Success: ").concat(this_2.stats.successfulPullRequests, ", Failed: ").concat(this_2.stats.failedPullRequests, ", Skipped: ").concat(this_2.stats.skippedPullRequests));
                                                                        }
                                                                        // メモリ管理：定期的なガベージコレクション
                                                                        if ((this_2.stats.successfulPullRequests + this_2.stats.failedPullRequests) % 5 === 0) {
                                                                            console.log("\uD83D\uDDD1\uFE0F  Running memory management...");
                                                                            memUsage = process.memoryUsage();
                                                                            memUsageMB = {
                                                                                rss: Math.round(memUsage.rss / 1024 / 1024),
                                                                                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                                                                                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                                                                                external: Math.round(memUsage.external / 1024 / 1024)
                                                                            };
                                                                            console.log("\uD83D\uDCBE Current memory usage: RSS=".concat(memUsageMB.rss, "MB, Heap=").concat(memUsageMB.heapUsed, "/").concat(memUsageMB.heapTotal, "MB, External=").concat(memUsageMB.external, "MB"));
                                                                            // ガベージコレクション実行
                                                                            if (global.gc) {
                                                                                global.gc();
                                                                                memUsageAfterGC = process.memoryUsage();
                                                                                memUsageAfterMB = {
                                                                                    rss: Math.round(memUsageAfterGC.rss / 1024 / 1024),
                                                                                    heapUsed: Math.round(memUsageAfterGC.heapUsed / 1024 / 1024)
                                                                                };
                                                                                console.log("\uD83D\uDDD1\uFE0F  Memory after GC: RSS=".concat(memUsageAfterMB.rss, "MB (\u0394").concat(memUsageAfterMB.rss - memUsageMB.rss, "), Heap=").concat(memUsageAfterMB.heapUsed, "MB (\u0394").concat(memUsageAfterMB.heapUsed - memUsageMB.heapUsed, ")"));
                                                                                // メモリ使用量が高い場合の警告
                                                                                if (memUsageAfterMB.rss > 4000) { // 4GB以上
                                                                                    console.warn("\u26A0\uFE0F  High memory usage detected: ".concat(memUsageAfterMB.rss, "MB RSS"));
                                                                                }
                                                                            }
                                                                            else {
                                                                                console.warn("\u26A0\uFE0F  Garbage collection not available. Start Node.js with --expose-gc flag for better memory management.");
                                                                            }
                                                                        }
                                                                        return [3 /*break*/, 4];
                                                                    case 3:
                                                                        dirError_1 = _f.sent();
                                                                        console.error("\u274C Error processing pullRequest ".concat(pullRequestTitle, ":"), dirError_1);
                                                                        errorReport = {
                                                                            timestamp: new Date().toISOString(),
                                                                            repositoryName: repositoryName,
                                                                            category: category,
                                                                            pullRequestTitle: pullRequestTitle,
                                                                            pullRequestPath: pullRequestPath,
                                                                            premergeDir: 'N/A',
                                                                            errorType: dirError_1 instanceof Error ? dirError_1.constructor.name : 'DirectoryError',
                                                                            errorMessage: dirError_1 instanceof Error ? dirError_1.message : String(dirError_1),
                                                                            stackTrace: dirError_1 instanceof Error ? dirError_1.stack || '' : '',
                                                                            processingPhase: 'DIRECTORY_SCANNING'
                                                                        };
                                                                        this_2.appendErrorReport(errorReport);
                                                                        this_2.updateStats('failure', errorReport.errorType);
                                                                        return [3 /*break*/, 4];
                                                                    case 4: return [2 /*return*/];
                                                                }
                                                            });
                                                        };
                                                        _d = 0, titleDirs_1 = titleDirs;
                                                        _e.label = 1;
                                                    case 1:
                                                        if (!(_d < titleDirs_1.length)) return [3 /*break*/, 4];
                                                        pullRequestTitle = titleDirs_1[_d];
                                                        return [5 /*yield**/, _loop_4(pullRequestTitle)];
                                                    case 2:
                                                        _e.sent();
                                                        _e.label = 3;
                                                    case 3:
                                                        _d++;
                                                        return [3 /*break*/, 1];
                                                    case 4: return [2 /*return*/];
                                                }
                                            });
                                        };
                                        _b = 0, categoryDirs_1 = categoryDirs;
                                        _c.label = 1;
                                    case 1:
                                        if (!(_b < categoryDirs_1.length)) return [3 /*break*/, 4];
                                        category = categoryDirs_1[_b];
                                        return [5 /*yield**/, _loop_3(category)];
                                    case 2:
                                        _c.sent();
                                        _c.label = 3;
                                    case 3:
                                        _b++;
                                        return [3 /*break*/, 1];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        _i = 0, datasetDirs_1 = datasetDirs;
                        _a.label = 2;
                    case 2:
                        if (!(_i < datasetDirs_1.length)) return [3 /*break*/, 5];
                        repositoryName = datasetDirs_1[_i];
                        return [5 /*yield**/, _loop_2(repositoryName)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [3 /*break*/, 8];
                    case 6:
                        error_3 = _a.sent();
                        console.error("\u274C Fatal error in batch processing:", error_3);
                        throw error_3;
                    case 7:
                        // 最終統計を保存
                        this.saveSummaryReport();
                        this.printFinalReport();
                        return [7 /*endfinally*/];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 最終レポートを表示
     */
    SafeBatchRunner.prototype.printFinalReport = function () {
        console.log("\n\uD83C\uDFAF ===== FINAL PROCESSING REPORT =====");
        console.log("\uD83D\uDCCA Total Repositories: ".concat(this.stats.totalRepositories));
        console.log("\uD83D\uDCCA Total Categories: ".concat(this.stats.totalCategories));
        console.log("\uD83D\uDCCA Total Pull Requests: ".concat(this.stats.totalPullRequests));
        console.log("\u2705 Successful: ".concat(this.stats.successfulPullRequests));
        console.log("\u274C Failed: ".concat(this.stats.failedPullRequests));
        console.log("\u23ED\uFE0F  Skipped: ".concat(this.stats.skippedPullRequests));
        if (this.stats.totalPullRequests > 0) {
            var successRate = Math.round((this.stats.successfulPullRequests / this.stats.totalPullRequests) * 100);
            console.log("\uD83D\uDCC8 Success Rate: ".concat(successRate, "%"));
        }
        if (this.stats.totalDuration) {
            console.log("\u23F1\uFE0F  Total Duration: ".concat(this.formatDuration(this.stats.totalDuration)));
        }
        console.log("\uD83D\uDCC4 Error Report: ".concat(this.errorReportFile));
        console.log("\uD83D\uDCC4 Summary Report: ".concat(this.summaryReportFile));
        console.log("=====================================");
    };
    return SafeBatchRunner;
}());
exports.SafeBatchRunner = SafeBatchRunner;
// グレースフルシャットダウンの実装
var isShuttingDown = false;
var currentRunner = null;
var gracefulShutdown = function (signal) {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    console.log("\uD83D\uDCE1 Received ".concat(signal, ". Starting graceful shutdown..."));
    // 現在の統計を保存
    if (currentRunner) {
        console.log('💾 Saving current processing state...');
        try {
            currentRunner.saveSummaryReport();
            console.log('✅ Processing state saved successfully');
        }
        catch (saveError) {
            console.error('❌ Failed to save processing state:', saveError);
        }
    }
    // リソースのクリーンアップ
    console.log('🧹 Cleaning up resources...');
    // アクティブな処理のキャンセル
    if (currentRunner) {
        try {
            // 現在進行中の処理の情報を保存
            var currentStats = currentRunner.stats;
            console.log("\uD83D\uDCCA Final stats before shutdown: Success=".concat(currentStats.successfulPullRequests, ", Failed=").concat(currentStats.failedPullRequests, ", Skipped=").concat(currentStats.skippedPullRequests));
        }
        catch (statError) {
            console.error('❌ Error accessing current stats:', statError);
        }
    }
    // ガベージコレクション強制実行
    if (global.gc) {
        console.log('🗑️ Running final garbage collection...');
        try {
            global.gc();
            console.log('✅ Garbage collection completed');
        }
        catch (gcError) {
            console.error('❌ Garbage collection failed:', gcError);
        }
    }
    // プロセス情報の表示
    var memUsage = process.memoryUsage();
    console.log("\uD83D\uDCBE Final memory usage: RSS=".concat(Math.round(memUsage.rss / 1024 / 1024), "MB, Heap=").concat(Math.round(memUsage.heapUsed / 1024 / 1024), "MB"));
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
};
// シグナルハンドラーの設定
process.on('SIGINT', function () { return gracefulShutdown('SIGINT'); });
process.on('SIGTERM', function () { return gracefulShutdown('SIGTERM'); });
// 異常終了のキャッチ
process.on('uncaughtException', function (error) {
    console.error('❌ Uncaught Exception:', error.message);
    console.error('Stack:', error.stack);
    // エラーの詳細をログに記録
    if (currentRunner) {
        try {
            var errorReport = {
                timestamp: new Date().toISOString(),
                repositoryName: 'SYSTEM',
                category: 'UNCAUGHT_EXCEPTION',
                pullRequestTitle: 'N/A',
                pullRequestPath: 'N/A',
                premergeDir: 'N/A',
                errorType: error.constructor.name,
                errorMessage: error.message,
                stackTrace: error.stack || '',
                processingPhase: 'SYSTEM_LEVEL'
            };
            currentRunner.appendErrorReport(errorReport);
            console.log('📝 Uncaught exception logged to error report');
        }
        catch (logError) {
            console.error('❌ Failed to log uncaught exception:', logError);
        }
    }
    gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', function (reason, promise) {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Unhandled rejectionの詳細をログに記録
    if (currentRunner) {
        try {
            var errorReport = {
                timestamp: new Date().toISOString(),
                repositoryName: 'SYSTEM',
                category: 'UNHANDLED_REJECTION',
                pullRequestTitle: 'N/A',
                pullRequestPath: 'N/A',
                premergeDir: 'N/A',
                errorType: reason instanceof Error ? reason.constructor.name : 'UnhandledRejection',
                errorMessage: reason instanceof Error ? reason.message : String(reason),
                stackTrace: reason instanceof Error ? reason.stack || '' : '',
                processingPhase: 'PROMISE_REJECTION'
            };
            currentRunner.appendErrorReport(errorReport);
            console.log('📝 Unhandled rejection logged to error report');
        }
        catch (logError) {
            console.error('❌ Failed to log unhandled rejection:', logError);
        }
    }
    gracefulShutdown('unhandledRejection');
});
// メモリ使用量監視（定期チェック）
setInterval(function () {
    if (!isShuttingDown && currentRunner) {
        var memUsage = process.memoryUsage();
        var memUsageMB = Math.round(memUsage.rss / 1024 / 1024);
        // メモリ使用量が異常に高い場合の警告
        if (memUsageMB > 6000) { // 6GB以上
            console.warn("\u26A0\uFE0F  CRITICAL: Very high memory usage detected: ".concat(memUsageMB, "MB"));
            console.warn("\u26A0\uFE0F  Consider terminating the process to prevent system instability");
            // 緊急ガベージコレクション
            if (global.gc) {
                console.log('🚨 Running emergency garbage collection...');
                global.gc();
            }
        }
        else if (memUsageMB > 4000) { // 4GB以上
            console.warn("\u26A0\uFE0F  High memory usage: ".concat(memUsageMB, "MB - monitoring closely"));
        }
    }
}, 60000); // 60秒ごとにチェック
// メイン実行
if (import.meta.url === "file://".concat(process.argv[1])) {
    var datasetDir = process.argv[2] || "/app/dataset/filtered_fewChanged";
    var outputDir = process.argv[3] || "/app/output";
    console.log("\uD83C\uDFAF Safe Batch Runner Starting...");
    console.log("\uD83D\uDCC1 Dataset Directory: ".concat(datasetDir));
    console.log("\uD83D\uDCC1 Output Directory: ".concat(outputDir));
    console.log("\uD83D\uDC1B Process ID: ".concat(process.pid));
    console.log("\uD83D\uDCBE Node.js Version: ".concat(process.version));
    console.log("\uD83D\uDDD1\uFE0F  Garbage Collection: ".concat(global.gc ? 'Available' : 'Not Available (use --expose-gc)'));
    // メモリ制限の確認と設定
    var memUsage = process.memoryUsage();
    console.log("\uD83D\uDCBE Initial Memory: RSS=".concat(Math.round(memUsage.rss / 1024 / 1024), "MB, Heap=").concat(Math.round(memUsage.heapUsed / 1024 / 1024), "MB"));
    try {
        // プロセス制限の確認
        if (process.platform === 'linux') {
            console.log("\uD83D\uDD27 Platform: ".concat(process.platform, " (containerized environment)"));
        }
        // データセットディレクトリの事前チェック
        if (!fs_1.default.existsSync(datasetDir)) {
            throw new Error("Dataset directory not found: ".concat(datasetDir));
        }
        // アウトプットディレクトリの作成
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
            console.log("\uD83D\uDCC1 Created output directory: ".concat(outputDir));
        }
        // プロセス開始の記録
        console.log("\u23F0 Process started at: ".concat(new Date().toISOString()));
        currentRunner = new SafeBatchRunner(outputDir);
        await currentRunner.runSafeDatasetProcessing(datasetDir);
        console.log("✅ Safe batch processing completed successfully.");
        // 正常終了
        process.exit(0);
    }
    catch (error) {
        console.error("❌ Critical error in safe batch processing:", error);
        // 最終エラーレポートの生成
        if (currentRunner) {
            try {
                var finalErrorReport = {
                    timestamp: new Date().toISOString(),
                    repositoryName: 'SYSTEM',
                    category: 'CRITICAL_ERROR',
                    pullRequestTitle: 'BATCH_PROCESSING',
                    pullRequestPath: datasetDir,
                    premergeDir: 'N/A',
                    errorType: error instanceof Error ? error.constructor.name : 'CriticalError',
                    errorMessage: error instanceof Error ? error.message : String(error),
                    stackTrace: error instanceof Error ? error.stack || '' : '',
                    processingPhase: 'BATCH_INITIALIZATION'
                };
                currentRunner.appendErrorReport(finalErrorReport);
                console.log('📝 Critical error logged to final error report');
            }
            catch (reportError) {
                console.error('❌ Failed to log critical error:', reportError);
            }
        }
        gracefulShutdown('error');
    }
}
