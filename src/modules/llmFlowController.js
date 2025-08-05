"use strict";
/**
 * LLM自動応答・自動修正フローのステートマシン
 * Mermaidフロー図に基づく
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
var dotenv_1 = require("dotenv");
// 環境変数の設定
(0, dotenv_1.config)({ path: path.join(process.cwd(), '.env') });
var restoreDiff_js_1 = require("./restoreDiff.js");
var logger_js_1 = require("./logger.js");
var config_js_1 = require("./config.js");
var messageHandler_js_1 = require("./messageHandler.js");
var fileManager_js_1 = require("./fileManager.js");
var openAIClient_js_1 = require("./openAIClient.js");
var types_js_1 = require("./types.js");
var LLMFlowController = /** @class */ (function () {
    function LLMFlowController(pullRequestPath) {
        // 状態管理
        this.state = types_js_1.State.Start;
        this.context = {};
        this.inputPremergeDir = ''; // プルリクエストのパス "/PATH/premerge_xxx"
        // 内部進行状況管理
        this.internalProgress = {
            currentPhase: 'INITIAL_ANALYSIS',
            stepsCompleted: [],
            stepsRemaining: [],
            contextAccumulated: {
                sourceFiles: [],
                configFiles: [],
                protoFiles: [],
                testFiles: [],
                directories: [],
                dependencies: []
            },
            analysisDepth: 1,
            iterationCount: 0,
            maxIterations: 10,
            errorCount: 0,
            warningCount: 0
        };
        this.logger = new logger_js_1.default();
        // 作業用データ
        this.currentMessages = [];
        this.prompt_template_name = '';
        this.next_prompt_content = null;
        // ログ管理
        this.currentTurn = 0;
        this.startTime = '';
        this.totalPromptTokens = 0;
        this.totalCompletionTokens = 0;
        this.inputPremergeDir = pullRequestPath;
        this.startTime = new Date().toISOString();
        // デバッグ情報：環境変数の確認
        console.log("\uD83D\uDD27 LLMFlowController initialized with path: ".concat(pullRequestPath));
        console.log("\uFFFD [NEW VERSION 2025-07-31] LLMFlowController loaded");
        console.log("\uFFFD\uD83D\uDD11 OPENAI_TOKEN length: ".concat((process.env.OPENAI_TOKEN || '').length));
        console.log("\uD83D\uDD11 OPENAI_API_KEY length: ".concat((process.env.OPENAI_API_KEY || '').length));
        console.log("\uD83D\uDD11 GEMINI_API_KEY length: ".concat((process.env.GEMINI_API_KEY || '').length));
        console.log("\uD83E\uDD16 LLM_PROVIDER: ".concat(process.env.LLM_PROVIDER || 'undefined'));
        console.log("\uD83C\uDF0D NODE_ENV: ".concat(process.env.NODE_ENV || 'undefined'));
        console.log("\uD83D\uDC1B DEBUG_MODE: ".concat(process.env.DEBUG_MODE || 'undefined'));
    }
    // 型変換ヘルパー
    LLMFlowController.prototype.convertToLogFormat = function (parsed) {
        if (!parsed) {
            return {
                thought: null,
                plan: null,
                reply_required: [],
                modified_diff: null,
                commentText: null,
                has_fin_tag: false
            };
        }
        // planを配列形式に変換
        var planArray = [];
        if (parsed.plan && typeof parsed.plan === 'string') {
            try {
                console.log("\uD83D\uDD27 Converting plan to array format for logging");
                // 安全なJSON解析を使用
                var planObj = this.safeParseJSON(parsed.plan, 'convertToLogFormat');
                if (Array.isArray(planObj)) {
                    planArray = planObj;
                }
                else {
                    // 単一のプランの場合は配列にラップ
                    planArray = [planObj];
                }
                console.log("\u2705 Successfully parsed plan with ".concat(planArray.length, " items"));
            }
            catch (jsonError) {
                //  JSON解析エラーの詳細ログ
                console.error("\u274C JSON parse error for plan:", {
                    error: jsonError instanceof Error ? jsonError.message : String(jsonError),
                    planLength: parsed.plan.length,
                    planPreview: parsed.plan.substring(0, 200),
                    planCharCodes: parsed.plan.substring(0, 10).split('').map(function (char) { return char.charCodeAt(0); })
                });
                // JSON形式でない場合は文字列として配列にラップ
                planArray = [{ step: 1, action: "ANALYZE", description: parsed.plan }];
                console.log("\uD83D\uDD04 Fallback: Wrapped plan as string description");
            }
        }
        return {
            thought: parsed.thought,
            plan: planArray.length > 0 ? planArray : null,
            reply_required: parsed.requiredFilepaths.map(function (path) { return ({ type: "FILE_CONTENT", path: path }); }),
            modified_diff: parsed.modifiedDiff || null,
            commentText: parsed.commentText || null,
            has_fin_tag: parsed.has_fin_tag
        };
    };
    // =============================================================================
    // メインフロー制御
    // =============================================================================
    LLMFlowController.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(this.state !== types_js_1.State.End)) return [3 /*break*/, 38];
                        _a = this.state;
                        switch (_a) {
                            case types_js_1.State.Start: return [3 /*break*/, 1];
                            case types_js_1.State.PrepareInitialContext: return [3 /*break*/, 2];
                            case types_js_1.State.SendInitialInfoToLLM: return [3 /*break*/, 4];
                            case types_js_1.State.LLMAnalyzePlan: return [3 /*break*/, 6];
                            case types_js_1.State.LLMDecision: return [3 /*break*/, 8];
                            case types_js_1.State.SystemAnalyzeRequest: return [3 /*break*/, 10];
                            case types_js_1.State.GetFileContent: return [3 /*break*/, 12];
                            case types_js_1.State.GetDirectoryListing: return [3 /*break*/, 14];
                            case types_js_1.State.ProcessRequiredInfos: return [3 /*break*/, 16];
                            case types_js_1.State.SendInfoToLLM: return [3 /*break*/, 18];
                            case types_js_1.State.LLMReanalyze: return [3 /*break*/, 20];
                            case types_js_1.State.SystemParseDiff: return [3 /*break*/, 22];
                            case types_js_1.State.SystemApplyDiff: return [3 /*break*/, 24];
                            case types_js_1.State.CheckApplyResult: return [3 /*break*/, 26];
                            case types_js_1.State.SendResultToLLM: return [3 /*break*/, 28];
                            case types_js_1.State.LLMNextStep: return [3 /*break*/, 30];
                            case types_js_1.State.SendErrorToLLM: return [3 /*break*/, 32];
                            case types_js_1.State.LLMErrorReanalyze: return [3 /*break*/, 34];
                        }
                        return [3 /*break*/, 36];
                    case 1:
                        this.state = types_js_1.State.PrepareInitialContext;
                        return [3 /*break*/, 37];
                    case 2: return [4 /*yield*/, this.prepareInitialContext()];
                    case 3:
                        _b.sent();
                        this.state = types_js_1.State.SendInitialInfoToLLM;
                        return [3 /*break*/, 37];
                    case 4: return [4 /*yield*/, this.sendInitialInfoToLLM()];
                    case 5:
                        _b.sent();
                        this.state = types_js_1.State.LLMAnalyzePlan;
                        return [3 /*break*/, 37];
                    case 6: return [4 /*yield*/, this.llmAnalyzePlan()];
                    case 7:
                        _b.sent();
                        this.state = types_js_1.State.LLMDecision;
                        return [3 /*break*/, 37];
                    case 8: return [4 /*yield*/, this.llmDecision()];
                    case 9:
                        _b.sent();
                        return [3 /*break*/, 37];
                    case 10: return [4 /*yield*/, this.systemAnalyzeRequest()];
                    case 11:
                        _b.sent();
                        return [3 /*break*/, 37];
                    case 12: return [4 /*yield*/, this.getFileContent()];
                    case 13:
                        _b.sent();
                        this.state = types_js_1.State.SendInfoToLLM;
                        return [3 /*break*/, 37];
                    case 14: return [4 /*yield*/, this.getDirectoryListing()];
                    case 15:
                        _b.sent();
                        this.state = types_js_1.State.SendInfoToLLM;
                        return [3 /*break*/, 37];
                    case 16: return [4 /*yield*/, this.processRequiredInfos()];
                    case 17:
                        _b.sent();
                        this.state = types_js_1.State.SendInfoToLLM;
                        return [3 /*break*/, 37];
                    case 18: return [4 /*yield*/, this.sendInfoToLLM()];
                    case 19:
                        _b.sent();
                        this.state = types_js_1.State.LLMReanalyze;
                        return [3 /*break*/, 37];
                    case 20: return [4 /*yield*/, this.llmReanalyze()];
                    case 21:
                        _b.sent();
                        this.state = types_js_1.State.LLMDecision;
                        return [3 /*break*/, 37];
                    case 22: return [4 /*yield*/, this.systemParseDiff()];
                    case 23:
                        _b.sent();
                        this.state = types_js_1.State.SystemApplyDiff;
                        return [3 /*break*/, 37];
                    case 24: return [4 /*yield*/, this.systemApplyDiff()];
                    case 25:
                        _b.sent();
                        this.state = types_js_1.State.CheckApplyResult;
                        return [3 /*break*/, 37];
                    case 26: return [4 /*yield*/, this.checkApplyResult()];
                    case 27:
                        _b.sent();
                        return [3 /*break*/, 37];
                    case 28: return [4 /*yield*/, this.sendResultToLLM()];
                    case 29:
                        _b.sent();
                        this.state = types_js_1.State.LLMNextStep;
                        return [3 /*break*/, 37];
                    case 30: return [4 /*yield*/, this.llmNextStep()];
                    case 31:
                        _b.sent();
                        this.state = types_js_1.State.LLMDecision;
                        return [3 /*break*/, 37];
                    case 32: return [4 /*yield*/, this.sendErrorToLLM()];
                    case 33:
                        _b.sent();
                        this.state = types_js_1.State.LLMErrorReanalyze;
                        return [3 /*break*/, 37];
                    case 34: return [4 /*yield*/, this.llmErrorReanalyze()];
                    case 35:
                        _b.sent();
                        this.state = types_js_1.State.LLMDecision;
                        return [3 /*break*/, 37];
                    case 36:
                        this.state = types_js_1.State.End;
                        _b.label = 37;
                    case 37: return [3 /*break*/, 0];
                    case 38: return [4 /*yield*/, this.finish()];
                    case 39:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // =============================================================================
    // 初期化・準備フェーズ
    // =============================================================================
    LLMFlowController.prototype.prepareInitialContext = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // autoResponser.tsのConfig, FileManager, MessageHandler, OpenAIClientを初期化
                        this.config = new config_js_1.default(this.inputPremergeDir);
                        this.fileManager = new fileManager_js_1.default(this.config, this.logger);
                        this.messageHandler = new messageHandler_js_1.default();
                        this.openAIClient = new openAIClient_js_1.default(this.config); // Configインスタンスを渡す
                        // OpenAIClientの初期化完了を待機
                        return [4 /*yield*/, this.openAIClient.initPromise];
                    case 1:
                        // OpenAIClientの初期化完了を待機
                        _a.sent();
                        // 初期プロンプト生成
                        this.next_prompt_content = this.fileManager.readFirstPromptFile();
                        this.prompt_template_name = this.config.promptTextfile;
                        this.currentMessages = this.messageHandler.attachMessages("user", this.next_prompt_content);
                        return [2 /*return*/];
                }
            });
        });
    };
    // =============================================================================
    // LLM通信フェーズ
    // =============================================================================
    LLMFlowController.prototype.sendInitialInfoToLLM = function () {
        return __awaiter(this, void 0, void 0, function () {
            var llm_response, usage;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.openAIClient.fetchOpenAPI(this.currentMessages)];
                    case 1:
                        llm_response = _d.sent();
                        this.context.llmResponse = llm_response;
                        // ターン数とトークン数を更新
                        this.currentTurn++;
                        usage = (llm_response === null || llm_response === void 0 ? void 0 : llm_response.usage) || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
                        this.totalPromptTokens += usage.prompt_tokens;
                        this.totalCompletionTokens += usage.completion_tokens;
                        // ログ記録
                        this.logger.addInteractionLog(this.currentTurn, new Date().toISOString(), {
                            prompt_template: this.prompt_template_name,
                            full_prompt_content: this.next_prompt_content || ''
                        }, {
                            raw_content: ((_c = (_b = (_a = llm_response === null || llm_response === void 0 ? void 0 : llm_response.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || '',
                            parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                            usage: usage
                        }, {
                            type: 'INITIAL_CONTEXT',
                            details: 'Initial context sent to LLM'
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    LLMFlowController.prototype.sendInfoToLLM = function () {
        return __awaiter(this, void 0, void 0, function () {
            var parsed, filesRequested, modifiedDiff, commentText, previousThought, previousPlan, promptReply, llm_response, usage;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        parsed = this.context.llmParsed;
                        filesRequested = typeof this.context.fileContent === 'string' ? this.context.fileContent : '';
                        modifiedDiff = (parsed === null || parsed === void 0 ? void 0 : parsed.modifiedDiff) || '';
                        commentText = (parsed === null || parsed === void 0 ? void 0 : parsed.commentText) || '';
                        previousThought = (parsed === null || parsed === void 0 ? void 0 : parsed.thought) || '';
                        previousPlan = (parsed === null || parsed === void 0 ? void 0 : parsed.plan) || '';
                        promptReply = this.config.readPromptReplyFile(filesRequested, modifiedDiff, commentText, previousThought, previousPlan);
                        this.currentMessages = this.messageHandler.attachMessages("user", promptReply);
                        return [4 /*yield*/, this.openAIClient.fetchOpenAPI(this.currentMessages)];
                    case 1:
                        llm_response = _d.sent();
                        this.context.llmResponse = llm_response;
                        // ターン数とトークン数を更新
                        this.currentTurn++;
                        usage = (llm_response === null || llm_response === void 0 ? void 0 : llm_response.usage) || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
                        this.totalPromptTokens += usage.prompt_tokens;
                        this.totalCompletionTokens += usage.completion_tokens;
                        // ログ記録
                        this.logger.addInteractionLog(this.currentTurn, new Date().toISOString(), {
                            prompt_template: '00_promptReply.txt',
                            full_prompt_content: promptReply
                        }, {
                            raw_content: ((_c = (_b = (_a = llm_response === null || llm_response === void 0 ? void 0 : llm_response.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || '',
                            parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                            usage: usage
                        }, {
                            type: 'FETCHING_FILES',
                            details: 'Requested files sent to LLM'
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    // =============================================================================
    // LLM応答処理フェーズ
    // =============================================================================
    LLMFlowController.prototype.llmAnalyzePlan = function () {
        return __awaiter(this, void 0, void 0, function () {
            var llm_content, _a, error_1;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        // LLM: 分析・思考・計画
                        // LLM応答を解析し、contextに格納
                        if (!this.context.llmResponse || !this.context.llmResponse.choices || this.context.llmResponse.choices.length === 0) {
                            throw new Error("LLM応答が不正です");
                        }
                        llm_content = this.context.llmResponse.choices[0].message.content;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        _a = this.context;
                        return [4 /*yield*/, this.executeWithPerformanceMonitoring('LLM_Response_Analysis', function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, this.messageHandler.analyzeMessages(llm_content)];
                            }); }); })];
                    case 2:
                        _a.llmParsed = _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _b.sent();
                        // 解析エラーの詳細ログ
                        this.logger.logLLMParsingError(llm_content, 'initial_analysis', 'Valid LLM response with proper tags', 'Invalid or malformed response', error_1 instanceof Error ? error_1 : undefined);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    LLMFlowController.prototype.llmReanalyze = function () {
        return __awaiter(this, void 0, void 0, function () {
            var content, _a, error_2;
            var _this = this;
            var _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        // LLM: 新情報を元に再分析・計画更新
                        if (!((_e = (_d = (_c = (_b = this.context.llmResponse) === null || _b === void 0 ? void 0 : _b.choices) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.content)) {
                            this.state = types_js_1.State.End;
                            return [2 /*return*/];
                        }
                        content = this.context.llmResponse.choices[0].message.content;
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 3, , 4]);
                        _a = this.context;
                        return [4 /*yield*/, this.executeWithPerformanceMonitoring('LLM_Response_Reanalysis', function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, this.messageHandler.analyzeMessages(content)];
                            }); }); })];
                    case 2:
                        _a.llmParsed = _f.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _f.sent();
                        this.logger.logLLMParsingError(content, 'reanalysis', 'Valid LLM response with updated information', 'Failed to parse updated response', error_2 instanceof Error ? error_2 : undefined);
                        this.state = types_js_1.State.End;
                        return [2 /*return*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    LLMFlowController.prototype.llmDecision = function () {
        return __awaiter(this, void 0, void 0, function () {
            var parsed;
            return __generator(this, function (_a) {
                parsed = this.context.llmParsed;
                if (!parsed) {
                    this.state = types_js_1.State.End;
                    return [2 /*return*/];
                }
                if (parsed.has_fin_tag) {
                    // タスク完了
                    this.state = types_js_1.State.End;
                }
                else if (parsed.requiredFilepaths && parsed.requiredFilepaths.length > 0) {
                    // 追加情報要求
                    this.state = types_js_1.State.SystemAnalyzeRequest;
                }
                else if (parsed.modifiedDiff && parsed.modifiedDiff.length > 0) {
                    // 修正案(diff)生成
                    this.state = types_js_1.State.SystemParseDiff;
                }
                else {
                    // その他（エラーや不明な場合は終了）
                    this.state = types_js_1.State.End;
                }
                return [2 /*return*/];
            });
        });
    };
    LLMFlowController.prototype.llmNextStep = function () {
        return __awaiter(this, void 0, void 0, function () {
            var content;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                // LLM: 計画の次のステップ実行 or 再評価
                if (!((_d = (_c = (_b = (_a = this.context.llmResponse) === null || _a === void 0 ? void 0 : _a.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content)) {
                    this.state = types_js_1.State.End;
                    return [2 /*return*/];
                }
                content = this.context.llmResponse.choices[0].message.content;
                this.context.llmParsed = this.messageHandler.analyzeMessages(content);
                return [2 /*return*/];
            });
        });
    };
    LLMFlowController.prototype.llmErrorReanalyze = function () {
        return __awaiter(this, void 0, void 0, function () {
            var content;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                // LLM: エラーに基づき再分析・計画修正
                if (!((_d = (_c = (_b = (_a = this.context.llmResponse) === null || _a === void 0 ? void 0 : _a.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content)) {
                    this.state = types_js_1.State.End;
                    return [2 /*return*/];
                }
                content = this.context.llmResponse.choices[0].message.content;
                this.context.llmParsed = this.messageHandler.analyzeMessages(content);
                return [2 /*return*/];
            });
        });
    };
    // =============================================================================
    // システム情報取得フェーズ
    // =============================================================================
    LLMFlowController.prototype.systemAnalyzeRequest = function () {
        return __awaiter(this, void 0, void 0, function () {
            var parsed, processedPaths, analysisResult, optimizedPlan;
            return __generator(this, function (_a) {
                // Phase 3-1: 状態遷移最適化 - 詳細な分析と循環参照防止
                this.logProgressState();
                parsed = this.context.llmParsed;
                if (!parsed) {
                    this.logger.logWarning("No parsed LLM response found, ending");
                    this.state = types_js_1.State.End;
                    return [2 /*return*/];
                }
                processedPaths = this.getProcessedFilePaths();
                analysisResult = this.analyzeRequiredFileInfos(parsed, processedPaths);
                if (analysisResult.isEmpty) {
                    this.logger.logInfo("No files or directories to process, ending");
                    this.state = types_js_1.State.End;
                    return [2 /*return*/];
                }
                optimizedPlan = this.optimizeProcessingPlan(analysisResult);
                // 進行状況を内部状態に記録
                this.updateInternalProgress({
                    analysisDepth: this.internalProgress.analysisDepth + 1,
                    stepsRemaining: optimizedPlan.steps,
                    contextAccumulated: __assign(__assign({}, this.internalProgress.contextAccumulated), { sourceFiles: __spreadArray(__spreadArray([], this.internalProgress.contextAccumulated.sourceFiles, true), optimizedPlan.sourceFiles, true), configFiles: __spreadArray(__spreadArray([], this.internalProgress.contextAccumulated.configFiles, true), optimizedPlan.configFiles, true), protoFiles: __spreadArray(__spreadArray([], this.internalProgress.contextAccumulated.protoFiles, true), optimizedPlan.protoFiles, true), testFiles: __spreadArray(__spreadArray([], this.internalProgress.contextAccumulated.testFiles, true), optimizedPlan.testFiles, true), directories: __spreadArray(__spreadArray([], this.internalProgress.contextAccumulated.directories, true), optimizedPlan.directories, true) })
                });
                // 状態遷移決定
                this.state = this.determineNextState(analysisResult, optimizedPlan);
                this.logger.logInfo("Next state: ".concat(this.state, ", Processing ").concat(analysisResult.totalFiles, " files, ").concat(analysisResult.totalDirectories, " directories"));
                return [2 /*return*/];
            });
        });
    };
    LLMFlowController.prototype.getFileContent = function () {
        return __awaiter(this, void 0, void 0, function () {
            var parsed, fileContentInfos_1, result, fileContents, _i, _a, filePath, fullPath, content, error_3;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        parsed = this.context.llmParsed;
                        if (!parsed) {
                            this.state = types_js_1.State.End;
                            return [2 /*return*/];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        if (!(parsed.requiredFileInfos && parsed.requiredFileInfos.length > 0)) return [3 /*break*/, 3];
                        fileContentInfos_1 = parsed.requiredFileInfos.filter(function (info) { return info.type === 'FILE_CONTENT'; });
                        if (!(fileContentInfos_1.length > 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.executeWithPerformanceMonitoring('File_Content_Retrieval', function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, this.fileManager.getFileContents(fileContentInfos_1)];
                            }); }); })];
                    case 2:
                        result = _b.sent();
                        this.context.fileContent = result;
                        return [2 /*return*/];
                    case 3:
                        // 後方互換性：古いAPIを使用
                        if (parsed.requiredFilepaths && parsed.requiredFilepaths.length > 0) {
                            fileContents = [];
                            for (_i = 0, _a = parsed.requiredFilepaths; _i < _a.length; _i++) {
                                filePath = _a[_i];
                                fullPath = path.join(this.config.inputProjectDir, filePath);
                                if (fs.existsSync(fullPath)) {
                                    content = fs.readFileSync(fullPath, 'utf-8');
                                    fileContents.push("--- ".concat(filePath, "\n").concat(content));
                                }
                                else {
                                    fileContents.push("--- ".concat(filePath, "\n[\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093]"));
                                }
                            }
                            this.context.fileContent = fileContents.join('\n\n');
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _b.sent();
                        console.error('Error getting file content:', error_3);
                        this.context.fileContent = "Error: ".concat(error_3.message);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    LLMFlowController.prototype.getDirectoryListing = function () {
        return __awaiter(this, void 0, void 0, function () {
            var parsed, directoryListingInfos, result, getSurroundingDirectoryStructure, dirResults, _i, _a, filePath, absPath, importError_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        parsed = this.context.llmParsed;
                        if (!parsed) {
                            this.state = types_js_1.State.End;
                            return [2 /*return*/];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 5, , 6]);
                        if (!(parsed.requiredFileInfos && parsed.requiredFileInfos.length > 0)) return [3 /*break*/, 3];
                        directoryListingInfos = parsed.requiredFileInfos.filter(function (info) { return info.type === 'DIRECTORY_LISTING'; });
                        if (!(directoryListingInfos.length > 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.fileManager.getDirectoryListings(directoryListingInfos)];
                    case 2:
                        result = _b.sent();
                        this.context.fileContent = result;
                        return [2 /*return*/];
                    case 3: return [4 /*yield*/, Promise.resolve().then(function () { return require('./generatePeripheralStructure.js'); })];
                    case 4:
                        getSurroundingDirectoryStructure = (_b.sent()).default;
                        if (parsed.requiredFilepaths && parsed.requiredFilepaths.length > 0) {
                            dirResults = {};
                            for (_i = 0, _a = parsed.requiredFilepaths; _i < _a.length; _i++) {
                                filePath = _a[_i];
                                absPath = path.join(this.config.inputProjectDir, filePath);
                                try {
                                    dirResults[filePath] = getSurroundingDirectoryStructure(absPath, 2);
                                }
                                catch (e) {
                                    dirResults[filePath] = { error: e.message };
                                }
                            }
                            this.context.dirListing = dirResults;
                            this.context.fileContent = JSON.stringify(dirResults, null, 2);
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        importError_1 = _b.sent();
                        console.warn('Failed to process directory listing:', importError_1);
                        this.context.fileContent = "Error: ".concat(importError_1.message);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    LLMFlowController.prototype.processRequiredInfos = function () {
        return __awaiter(this, void 0, void 0, function () {
            var parsed, result, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        parsed = this.context.llmParsed;
                        if (!parsed || !parsed.requiredFileInfos || parsed.requiredFileInfos.length === 0) {
                            this.state = types_js_1.State.End;
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.fileManager.processRequiredFileInfos(parsed.requiredFileInfos)];
                    case 2:
                        result = _a.sent();
                        this.context.fileContent = result;
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _a.sent();
                        console.error('Error processing required file infos:', error_4);
                        this.context.fileContent = "Error processing files: ".concat(error_4.message);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // =============================================================================
    // diff処理フェーズ
    // =============================================================================
    LLMFlowController.prototype.systemParseDiff = function () {
        return __awaiter(this, void 0, void 0, function () {
            var parsed;
            return __generator(this, function (_a) {
                parsed = this.context.llmParsed;
                if (!(parsed === null || parsed === void 0 ? void 0 : parsed.modifiedDiff)) {
                    console.warn("No diff to parse");
                    this.state = types_js_1.State.End;
                    return [2 /*return*/];
                }
                // diff形式の検証ロジックを実装
                // 今のところは単純にパススルー
                console.log("Parsing diff: ".concat(parsed.modifiedDiff.slice(0, 100), "..."));
                return [2 /*return*/];
            });
        });
    };
    LLMFlowController.prototype.systemApplyDiff = function () {
        return __awaiter(this, void 0, void 0, function () {
            var parsed, backupInfo, restoreDiff, restoredContent, validationResult, finalContent, tmpDiffRestorePath, stats, e_1, errorMessage, diffError, detailedErrorContext, affectedFiles;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        parsed = this.context.llmParsed;
                        if (!parsed || !parsed.modifiedDiff || parsed.modifiedDiff.length === 0) {
                            this.logger.logWarning("systemApplyDiff was called without a diff. Ending flow.");
                            this.state = types_js_1.State.End;
                            return [2 /*return*/];
                        }
                        this.logger.logInfo("Starting enhanced diff application process...");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 7]);
                        return [4 /*yield*/, this.createPreApplyBackup()];
                    case 2:
                        backupInfo = _a.sent();
                        this.logger.logInfo("Backup created: ".concat(backupInfo.backupPath));
                        restoreDiff = new restoreDiff_js_1.default(this.config.inputProjectDir);
                        this.logger.logInfo("Applying diff using RestoreDiff...");
                        // diff適用前のデバッグログ
                        this.logger.logInfo("Diff content preview: ".concat(parsed.modifiedDiff.substring(0, 200), "..."));
                        this.logger.logInfo("Project directory: ".concat(this.config.inputProjectDir));
                        restoredContent = restoreDiff.applyDiff(parsed.modifiedDiff);
                        // 復元内容のデバッグログ
                        this.logger.logInfo("Restored content length: ".concat((restoredContent === null || restoredContent === void 0 ? void 0 : restoredContent.length) || 0));
                        if (restoredContent && restoredContent.length > 0) {
                            this.logger.logInfo("Restored content preview: ".concat(restoredContent.substring(0, 200), "..."));
                        }
                        else {
                            this.logger.logError("RestoreDiff returned empty content");
                            this.logger.logError("Original diff: ".concat(parsed.modifiedDiff));
                        }
                        return [4 /*yield*/, this.validateDiffApplication(restoredContent, parsed.modifiedDiff)];
                    case 3:
                        validationResult = _a.sent();
                        if (!validationResult.isValid) {
                            throw new Error("Diff validation failed: ".concat(validationResult.errors.join(', ')));
                        }
                        // 警告がある場合はログに記録
                        if (validationResult.warnings.length > 0) {
                            this.logger.logWarning("Diff validation warnings: ".concat(validationResult.warnings.join(', ')));
                        }
                        finalContent = restoredContent;
                        if (!finalContent || finalContent.length === 0) {
                            this.logger.logWarning("Restored content is empty, using original diff as fallback");
                            finalContent = "# Original Diff Content\n".concat(parsed.modifiedDiff);
                        }
                        tmpDiffRestorePath = path.join(this.config.outputDir, 'tmp_restoredDiff.txt');
                        fs.writeFileSync(tmpDiffRestorePath, finalContent, 'utf-8');
                        // contextに保存
                        this.context.diff = finalContent;
                        this.context.error = undefined;
                        return [4 /*yield*/, this.collectDiffApplicationStats(finalContent, parsed.modifiedDiff)];
                    case 4:
                        stats = _a.sent();
                        this.logger.logInfo("Diff applied successfully. Stats: ".concat(JSON.stringify(stats)));
                        // 内部進行状況を更新
                        this.updateInternalProgress({
                            stepsCompleted: __spreadArray(__spreadArray([], this.internalProgress.stepsCompleted, true), ['DIFF_APPLIED'], false),
                            contextAccumulated: __assign(__assign({}, this.internalProgress.contextAccumulated), { dependencies: __spreadArray(__spreadArray([], this.internalProgress.contextAccumulated.dependencies, true), ["backup:".concat(backupInfo.backupPath)], false) })
                        });
                        return [3 /*break*/, 7];
                    case 5:
                        e_1 = _a.sent();
                        errorMessage = e_1 instanceof Error ? e_1.message : String(e_1);
                        diffError = e_1 instanceof Error ? e_1 : new Error(errorMessage);
                        return [4 /*yield*/, this.collectErrorContext(parsed.modifiedDiff, errorMessage)];
                    case 6:
                        detailedErrorContext = _a.sent();
                        affectedFiles = this.extractAffectedFilesFromDiff(parsed.modifiedDiff);
                        this.logger.logDiffApplicationError(diffError, parsed.modifiedDiff, affectedFiles, detailedErrorContext);
                        this.logger.logError("Error applying diff", diffError);
                        this.context.error = {
                            message: errorMessage,
                            errorContext: detailedErrorContext,
                            timestamp: new Date().toISOString(),
                            phase: 'DIFF_APPLICATION'
                        };
                        this.context.diff = undefined;
                        // エラー統計を更新
                        this.updateInternalProgress({
                            errorCount: this.internalProgress.errorCount + 1
                        });
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    LLMFlowController.prototype.checkApplyResult = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // 適用結果/状態を判定
                if (this.context.error) {
                    // エラーがあればLLMにエラーを報告
                    this.state = types_js_1.State.SendErrorToLLM;
                }
                else {
                    // 成功したらLLMに結果を報告
                    this.state = types_js_1.State.SendResultToLLM;
                }
                return [2 /*return*/];
            });
        });
    };
    // =============================================================================
    // 結果・エラー処理フェーズ
    // =============================================================================
    LLMFlowController.prototype.sendResultToLLM = function () {
        return __awaiter(this, void 0, void 0, function () {
            var modifiedFiles, parsed, currentPlan, currentThought, planProgress, enhancedPlan, promptModified, llm_response, usage;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        modifiedFiles = this.context.diff || '';
                        parsed = this.context.llmParsed;
                        currentPlan = (parsed === null || parsed === void 0 ? void 0 : parsed.plan) || '';
                        currentThought = (parsed === null || parsed === void 0 ? void 0 : parsed.thought) || '';
                        planProgress = this.analyzePlanProgress(currentPlan);
                        enhancedPlan = planProgress.planWithProgress;
                        // ログで進行状況を出力
                        this.logger.logInfo("Plan Progress: ".concat(planProgress.progressPercentage, "% (").concat(planProgress.completedSteps.length, "/").concat(planProgress.totalSteps, " steps)"));
                        if (planProgress.currentStep) {
                            this.logger.logInfo("Current Step: ".concat(planProgress.currentStep));
                        }
                        promptModified = this.config.readPromptModifiedFile(modifiedFiles, enhancedPlan, currentThought);
                        this.currentMessages = this.messageHandler.attachMessages("user", promptModified);
                        return [4 /*yield*/, this.openAIClient.fetchOpenAPI(this.currentMessages)];
                    case 1:
                        llm_response = _d.sent();
                        this.context.llmResponse = llm_response;
                        // ターン数とトークン数を更新
                        this.currentTurn++;
                        usage = (llm_response === null || llm_response === void 0 ? void 0 : llm_response.usage) || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
                        this.totalPromptTokens += usage.prompt_tokens;
                        this.totalCompletionTokens += usage.completion_tokens;
                        // ログ記録
                        this.logger.addInteractionLog(this.currentTurn, new Date().toISOString(), {
                            prompt_template: '00_promptModified.txt',
                            full_prompt_content: promptModified
                        }, {
                            raw_content: ((_c = (_b = (_a = llm_response === null || llm_response === void 0 ? void 0 : llm_response.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || '',
                            parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                            usage: usage
                        }, {
                            type: 'APPLYING_DIFF_AND_RECHECKING',
                            details: 'Diff applied successfully. Preparing for re-check.'
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    LLMFlowController.prototype.sendErrorToLLM = function () {
        return __awaiter(this, void 0, void 0, function () {
            var errorMessage, errorPrompt, llm_response, usage;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        errorMessage = this.context.error || 'Unknown error occurred';
                        errorPrompt = "\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F: ".concat(errorMessage, "\n\n\u4FEE\u6B63\u6848\u3092\u518D\u691C\u8A0E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
                        this.currentMessages = this.messageHandler.attachMessages("user", errorPrompt);
                        return [4 /*yield*/, this.openAIClient.fetchOpenAPI(this.currentMessages)];
                    case 1:
                        llm_response = _d.sent();
                        this.context.llmResponse = llm_response;
                        // ターン数とトークン数を更新
                        this.currentTurn++;
                        usage = (llm_response === null || llm_response === void 0 ? void 0 : llm_response.usage) || { prompt_tokens: 0, completion_tokens: 0, total: 0 };
                        this.totalPromptTokens += usage.prompt_tokens;
                        this.totalCompletionTokens += usage.completion_tokens;
                        // ログ記録
                        this.logger.addInteractionLog(this.currentTurn, new Date().toISOString(), {
                            prompt_template: 'error_prompt',
                            full_prompt_content: errorPrompt
                        }, {
                            raw_content: ((_c = (_b = (_a = llm_response === null || llm_response === void 0 ? void 0 : llm_response.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || '',
                            parsed_content: this.convertToLogFormat(this.context.llmParsed || null),
                            usage: usage
                        }, {
                            type: 'ERROR_HANDLING',
                            details: "Error sent to LLM: ".concat(errorMessage)
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    // =============================================================================
    // 終了処理
    // =============================================================================
    LLMFlowController.prototype.finish = function () {
        return __awaiter(this, void 0, void 0, function () {
            var endTime, experimentId, status, hasModification, inputDir, parts, projectName, category, pullRequestName, now, jstDate, year, month, day, hour, minute, second, dateStr, logDir, logPath, logData;
            var _a, _b;
            return __generator(this, function (_c) {
                endTime = new Date().toISOString();
                experimentId = this.generateExperimentId();
                status = ((_a = this.context.llmParsed) === null || _a === void 0 ? void 0 : _a.has_fin_tag) ? 'Completed (%%_Fin_%%)' : 'Incomplete';
                // 後処理による完了判定ロジック（安全策）
                if (status === 'Incomplete' && !((_b = this.context.llmParsed) === null || _b === void 0 ? void 0 : _b.has_fin_tag)) {
                    hasModification = this.logger.getInteractionLog().some(function (turn) {
                        var _a, _b, _c, _d;
                        return ((_b = (_a = turn.llm_response) === null || _a === void 0 ? void 0 : _a.parsed_content) === null || _b === void 0 ? void 0 : _b.modified_diff) ||
                            ((_d = (_c = turn.llm_response) === null || _c === void 0 ? void 0 : _c.raw_content) === null || _d === void 0 ? void 0 : _d.includes('%_Modified_%'));
                    });
                    if (hasModification) {
                        status = 'Completed (Implicit)'; // 暗黙的な完了としてステータスを更新
                        console.log("\u2705 Status updated to 'Completed (Implicit)' based on post-processing logic.");
                        console.log("   Reason: Found %_Modified_% tag without explicit %%_Fin_%% tag");
                    }
                }
                this.logger.setExperimentMetadata(experimentId, this.startTime, endTime, status, this.currentTurn, this.totalPromptTokens, this.totalCompletionTokens);
                // 終了処理: ログを /app/log/PROJECT_NAME/PULLREQUEST/PULLREQUEST_NAME/DATE_TIME.log へ保存
                try {
                    inputDir = this.config.inputProjectDir;
                    parts = inputDir.split(path.sep);
                    projectName = parts[parts.length - 4] || 'unknown_project';
                    category = parts[parts.length - 3] || 'unknown_category';
                    pullRequestName = parts[parts.length - 2] || 'unknown_pr';
                    now = new Date();
                    jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
                    year = jstDate.getUTCFullYear();
                    month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
                    day = String(jstDate.getUTCDate()).padStart(2, '0');
                    hour = String(jstDate.getUTCHours()).padStart(2, '0');
                    minute = String(jstDate.getUTCMinutes()).padStart(2, '0');
                    second = String(jstDate.getUTCSeconds()).padStart(2, '0');
                    dateStr = "".concat(year, "-").concat(month, "-").concat(day, "_").concat(hour, "-").concat(minute, "-").concat(second, "_JST");
                    logDir = path.join('/app/log', projectName, category, pullRequestName);
                    if (!fs.existsSync(logDir)) {
                        fs.mkdirSync(logDir, { recursive: true });
                    }
                    logPath = path.join(logDir, "".concat(dateStr, ".log"));
                    logData = this.logger.getFinalJSON();
                    if (logData) {
                        fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), 'utf-8');
                    }
                    else {
                        // 必要な情報が足りない場合はコメントとして保存
                        fs.writeFileSync(logPath, '// ログ情報が不足しています', 'utf-8');
                    }
                }
                catch (e) {
                    // 例外時も最低限のエラーログを出力
                    try {
                        fs.writeFileSync('/app/log/llmFlowController_error.log', String(e), 'utf-8');
                    }
                    catch (_d) { }
                }
                return [2 /*return*/];
            });
        });
    };
    LLMFlowController.prototype.generateExperimentId = function () {
        // 入力ディレクトリからプロジェクト名とPR名を抽出してIDを生成
        var inputDir = this.config.inputProjectDir;
        var parts = inputDir.split(path.sep);
        var projectName = parts[parts.length - 4] || 'unknown_project';
        var pullRequestName = parts[parts.length - 2] || 'unknown_pr';
        return "".concat(projectName, "/Issue_").concat(pullRequestName);
    };
    // =============================================================================
    // 内部進行状況管理メソッド
    // =============================================================================
    LLMFlowController.prototype.updateProgress = function (phase, stepCompleted, stepRemaining) {
        this.internalProgress.currentPhase = phase;
        if (stepCompleted) {
            this.internalProgress.stepsCompleted.push(stepCompleted);
        }
        if (stepRemaining) {
            this.internalProgress.stepsRemaining = stepRemaining;
        }
        this.logger.logInfo("Phase: ".concat(phase, ", Step: ").concat(stepCompleted || 'N/A', ", Remaining: ").concat((stepRemaining === null || stepRemaining === void 0 ? void 0 : stepRemaining.length) || 0));
    };
    LLMFlowController.prototype.categorizeRequiredFiles = function (requiredFileInfos) {
        var result = {
            highPriority: [],
            mediumPriority: [],
            lowPriority: [],
            byCategory: {
                sourceFiles: [],
                configFiles: [],
                protoFiles: [],
                testFiles: [],
                directories: [],
                other: []
            }
        };
        for (var _i = 0, requiredFileInfos_1 = requiredFileInfos; _i < requiredFileInfos_1.length; _i++) {
            var info = requiredFileInfos_1[_i];
            // 優先度別分類
            switch (info.priority) {
                case 'HIGH':
                    result.highPriority.push(info);
                    break;
                case 'MEDIUM':
                    result.mediumPriority.push(info);
                    break;
                case 'LOW':
                    result.lowPriority.push(info);
                    break;
                default:
                    result.mediumPriority.push(info); // デフォルトはMEDIUM
            }
            // カテゴリ別分類
            if (info.type === 'DIRECTORY_LISTING') {
                result.byCategory.directories.push(info);
            }
            else if (info.type === 'FILE_CONTENT') {
                switch (info.subType) {
                    case 'SOURCE_CODE':
                        result.byCategory.sourceFiles.push(info);
                        break;
                    case 'CONFIG_FILE':
                    case 'BUILD_FILE':
                        result.byCategory.configFiles.push(info);
                        break;
                    case 'PROTO_FILE':
                        result.byCategory.protoFiles.push(info);
                        break;
                    case 'TEST_FILE':
                        result.byCategory.testFiles.push(info);
                        break;
                    default:
                        result.byCategory.other.push(info);
                }
            }
        }
        return result;
    };
    LLMFlowController.prototype.determineNextPhase = function (parsed) {
        var currentPhase = this.internalProgress.currentPhase;
        var iterationCount = this.internalProgress.iterationCount;
        // LLMからの提案があれば考慮
        if (parsed.suggestedPhase) {
            return parsed.suggestedPhase;
        }
        // ファイル要求の内容に基づいて判断
        if (parsed.requiredFileInfos && parsed.requiredFileInfos.length > 0) {
            var categorized = this.categorizeRequiredFiles(parsed.requiredFileInfos);
            // プロトファイルが要求されている = 詳細分析フェーズ
            if (categorized.byCategory.protoFiles.length > 0) {
                return 'DETAILED_ANALYSIS';
            }
            // テストファイルが要求されている = 検証フェーズ
            if (categorized.byCategory.testFiles.length > 0) {
                return 'VERIFICATION';
            }
            // ソースファイルとconfigが混在 = 解決策立案フェーズ
            if (categorized.byCategory.sourceFiles.length > 0 && categorized.byCategory.configFiles.length > 0) {
                return 'SOLUTION_PLANNING';
            }
            // 最初の反復でソースファイル = コンテキスト収集
            if (iterationCount <= 2 && categorized.byCategory.sourceFiles.length > 0) {
                return 'CONTEXT_GATHERING';
            }
        }
        // diffが生成されている = 実装フェーズ
        if (parsed.modifiedDiff && parsed.modifiedDiff.length > 0) {
            return 'IMPLEMENTATION';
        }
        // 完了フラグがある = 最終化フェーズ
        if (parsed.has_fin_tag) {
            return 'FINALIZATION';
        }
        // デフォルトの進行
        switch (currentPhase) {
            case 'INITIAL_ANALYSIS':
                return 'CONTEXT_GATHERING';
            case 'CONTEXT_GATHERING':
                return 'DETAILED_ANALYSIS';
            case 'DETAILED_ANALYSIS':
                return 'SOLUTION_PLANNING';
            case 'SOLUTION_PLANNING':
                return 'IMPLEMENTATION';
            case 'IMPLEMENTATION':
                return 'VERIFICATION';
            case 'VERIFICATION':
                return 'FINALIZATION';
            default:
                return currentPhase;
        }
    };
    // =============================================================================
    // Phase 3-1: 状態遷移最適化のためのヘルパーメソッド
    // =============================================================================
    /**
     * 既に処理済みのファイルパスを取得（循環参照防止）
     */
    LLMFlowController.prototype.getProcessedFilePaths = function () {
        var processed = new Set();
        // 内部進行状況から既に処理済みのファイルを取得
        this.internalProgress.contextAccumulated.sourceFiles.forEach(function (f) { return processed.add(f); });
        this.internalProgress.contextAccumulated.configFiles.forEach(function (f) { return processed.add(f); });
        this.internalProgress.contextAccumulated.protoFiles.forEach(function (f) { return processed.add(f); });
        this.internalProgress.contextAccumulated.testFiles.forEach(function (f) { return processed.add(f); });
        return processed;
    };
    /**
     * RequiredFileInfosの詳細分析
     */
    LLMFlowController.prototype.analyzeRequiredFileInfos = function (parsed, processedPaths) {
        var result = {
            isEmpty: true,
            totalFiles: 0,
            totalDirectories: 0,
            hasFileContent: false,
            hasDirectoryListing: false,
            newFiles: [],
            duplicateFiles: [],
            priorityGroups: {
                high: [],
                medium: [],
                low: []
            }
        };
        // 新しい形式をチェック
        if (parsed.requiredFileInfos && parsed.requiredFileInfos.length > 0) {
            result.isEmpty = false;
            for (var _i = 0, _a = parsed.requiredFileInfos; _i < _a.length; _i++) {
                var info = _a[_i];
                var isDuplicate = processedPaths.has(info.path);
                if (info.type === 'FILE_CONTENT') {
                    result.hasFileContent = true;
                    result.totalFiles++;
                    if (isDuplicate) {
                        result.duplicateFiles.push(info);
                    }
                    else {
                        result.newFiles.push(info);
                        // 優先度ベースの分類
                        var priority = info.priority || 'medium';
                        result.priorityGroups[priority].push(info);
                    }
                }
                else if (info.type === 'DIRECTORY_LISTING') {
                    result.hasDirectoryListing = true;
                    result.totalDirectories++;
                    if (!isDuplicate) {
                        result.newFiles.push(info);
                        var priority = info.priority || 'medium';
                        result.priorityGroups[priority].push(info);
                    }
                }
            }
        }
        // 後方互換性：古い形式もチェック
        if (result.isEmpty && parsed.requiredFilepaths && parsed.requiredFilepaths.length > 0) {
            result.isEmpty = false;
            result.hasFileContent = true;
            result.totalFiles = parsed.requiredFilepaths.length;
            // 古い形式は中優先度として扱う
            for (var _b = 0, _c = parsed.requiredFilepaths; _b < _c.length; _b++) {
                var filePath = _c[_b];
                if (!processedPaths.has(filePath)) {
                    var info = {
                        type: 'FILE_CONTENT',
                        path: filePath,
                        priority: 'MEDIUM'
                    };
                    result.newFiles.push(info);
                    result.priorityGroups.medium.push(info);
                }
                else {
                    result.duplicateFiles.push({
                        type: 'FILE_CONTENT',
                        path: filePath
                    });
                }
            }
        }
        return result;
    };
    /**
     * 処理プランの最適化（優先度とパフォーマンスを考慮）
     */
    LLMFlowController.prototype.optimizeProcessingPlan = function (analysisResult) {
        var plan = {
            steps: [],
            sourceFiles: [],
            configFiles: [],
            protoFiles: [],
            testFiles: [],
            directories: []
        };
        // 優先度順に処理ステップを構築
        var allFiles = __spreadArray(__spreadArray(__spreadArray([], analysisResult.priorityGroups.high, true), analysisResult.priorityGroups.medium, true), analysisResult.priorityGroups.low, true);
        for (var _i = 0, allFiles_1 = allFiles; _i < allFiles_1.length; _i++) {
            var fileInfo = allFiles_1[_i];
            plan.steps.push("Process ".concat(fileInfo.type, ": ").concat(fileInfo.path));
            // ファイル種別による分類
            var ext = path.extname(fileInfo.path).toLowerCase();
            if (fileInfo.type === 'DIRECTORY_LISTING') {
                plan.directories.push(fileInfo.path);
            }
            else if (ext === '.proto') {
                plan.protoFiles.push(fileInfo.path);
            }
            else if (ext === '.json' || ext === '.yaml' || ext === '.yml' || ext === '.toml') {
                plan.configFiles.push(fileInfo.path);
            }
            else if (fileInfo.path.includes('test') || fileInfo.path.includes('spec')) {
                plan.testFiles.push(fileInfo.path);
            }
            else {
                plan.sourceFiles.push(fileInfo.path);
            }
        }
        return plan;
    };
    /**
     * 内部進行状況の更新
     */
    LLMFlowController.prototype.updateInternalProgress = function (updates) {
        this.internalProgress = __assign(__assign(__assign({}, this.internalProgress), updates), { lastUpdated: new Date().toISOString() });
    };
    /**
     * 分析結果に基づく次の状態決定
     */
    LLMFlowController.prototype.determineNextState = function (analysisResult, plan) {
        if (analysisResult.isEmpty) {
            return types_js_1.State.End;
        }
        // 重複ファイルのみの場合は警告してスキップ
        if (analysisResult.newFiles.length === 0 && analysisResult.duplicateFiles.length > 0) {
            this.logger.logWarning("All ".concat(analysisResult.duplicateFiles.length, " files already processed, skipping to avoid circular references"));
            return types_js_1.State.End;
        }
        // 効率的な処理ルート決定
        if (analysisResult.hasFileContent && analysisResult.hasDirectoryListing) {
            return types_js_1.State.ProcessRequiredInfos; // 統合処理
        }
        else if (analysisResult.hasFileContent) {
            return types_js_1.State.GetFileContent;
        }
        else if (analysisResult.hasDirectoryListing) {
            return types_js_1.State.GetDirectoryListing;
        }
        else {
            return types_js_1.State.End;
        }
    };
    /**
     * 現在のログ状況と進行状況を表示
     */
    LLMFlowController.prototype.logProgressState = function () {
        var progress = this.internalProgress;
        this.logger.logInfo("=== Progress State ===");
        this.logger.logInfo("Phase: ".concat(progress.currentPhase));
        this.logger.logInfo("Iteration: ".concat(progress.iterationCount, "/").concat(progress.maxIterations));
        this.logger.logInfo("Analysis Depth: ".concat(progress.analysisDepth));
        this.logger.logInfo("Steps Completed: ".concat(progress.stepsCompleted.length));
        this.logger.logInfo("Steps Remaining: ".concat(progress.stepsRemaining.length));
        this.logger.logInfo("Context Accumulated:");
        this.logger.logInfo("  - Source Files: ".concat(progress.contextAccumulated.sourceFiles.length));
        this.logger.logInfo("  - Config Files: ".concat(progress.contextAccumulated.configFiles.length));
        this.logger.logInfo("  - Proto Files: ".concat(progress.contextAccumulated.protoFiles.length));
        this.logger.logInfo("  - Test Files: ".concat(progress.contextAccumulated.testFiles.length));
        this.logger.logInfo("  - Directories: ".concat(progress.contextAccumulated.directories.length));
        this.logger.logInfo("Errors: ".concat(progress.errorCount, ", Warnings: ").concat(progress.warningCount));
        this.logger.logInfo("=====================");
    };
    // =============================================================================
    // Phase 3-2: diff適用システム改善のためのヘルパーメソッド
    // =============================================================================
    /**
     * 適用前のバックアップを作成
     */
    LLMFlowController.prototype.createPreApplyBackup = function () {
        return __awaiter(this, void 0, void 0, function () {
            var timestamp, backupDir, originalFiles, totalSize, filesToBackup, _i, filesToBackup_1, filePath, relativePath, backupFilePath, backupFileDir, stats, backupInfo, backupInfoPath;
            return __generator(this, function (_a) {
                timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                backupDir = path.join(this.config.outputDir, 'backups', timestamp);
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, { recursive: true });
                }
                originalFiles = [];
                totalSize = 0;
                filesToBackup = this.findFilesToBackup();
                for (_i = 0, filesToBackup_1 = filesToBackup; _i < filesToBackup_1.length; _i++) {
                    filePath = filesToBackup_1[_i];
                    try {
                        relativePath = path.relative(this.config.inputProjectDir, filePath);
                        backupFilePath = path.join(backupDir, relativePath);
                        backupFileDir = path.dirname(backupFilePath);
                        if (!fs.existsSync(backupFileDir)) {
                            fs.mkdirSync(backupFileDir, { recursive: true });
                        }
                        fs.copyFileSync(filePath, backupFilePath);
                        originalFiles.push(relativePath);
                        stats = fs.statSync(filePath);
                        totalSize += stats.size;
                    }
                    catch (error) {
                        this.logger.logWarning("Failed to backup file ".concat(filePath, ": ").concat(error));
                    }
                }
                backupInfo = {
                    backupPath: backupDir,
                    timestamp: timestamp,
                    originalFiles: originalFiles,
                    backupSize: totalSize
                };
                backupInfoPath = path.join(backupDir, 'backup_info.json');
                fs.writeFileSync(backupInfoPath, JSON.stringify(backupInfo, null, 2));
                return [2 /*return*/, backupInfo];
            });
        });
    };
    /**
     * バックアップ対象ファイルを特定
     */
    LLMFlowController.prototype.findFilesToBackup = function () {
        var _this = this;
        var files = [];
        var projectDir = this.config.inputProjectDir;
        // 重要ファイル拡張子
        var importantExtensions = ['.js', '.ts', '.proto', '.json', '.yaml', '.yml', '.md', '.txt'];
        var scanDirectory = function (dir) {
            try {
                var entries = fs.readdirSync(dir);
                for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                    var entry = entries_1[_i];
                    var fullPath = path.join(dir, entry);
                    var stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        // node_modules や .git は除外
                        if (!['node_modules', '.git', '.vscode'].includes(entry)) {
                            scanDirectory(fullPath);
                        }
                    }
                    else if (stat.isFile()) {
                        var ext = path.extname(entry).toLowerCase();
                        if (importantExtensions.includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            }
            catch (error) {
                _this.logger.logWarning("Failed to scan directory ".concat(dir, ": ").concat(error));
            }
        };
        scanDirectory(projectDir);
        return files;
    };
    /**
     * diff適用結果の検証
     */
    LLMFlowController.prototype.validateDiffApplication = function (restoredContent, originalDiff) {
        return __awaiter(this, void 0, void 0, function () {
            var result, diffLines, addedLines, deletedLines, contextLines, hasFileHeaders, _i, diffLines_1, line;
            return __generator(this, function (_a) {
                result = {
                    isValid: true,
                    errors: [],
                    warnings: [],
                    appliedChanges: 0,
                    skippedChanges: 0
                };
                try {
                    this.logger.logInfo("Validating diff application: content length ".concat((restoredContent === null || restoredContent === void 0 ? void 0 : restoredContent.length) || 0, ", diff length ").concat((originalDiff === null || originalDiff === void 0 ? void 0 : originalDiff.length) || 0));
                    // diffの形式チェック
                    if (!originalDiff || originalDiff.trim().length === 0) {
                        result.warnings.push("Original diff is empty or invalid");
                        result.isValid = true; // 空のdiffは有効とみなす
                        return [2 /*return*/, result];
                    }
                    diffLines = originalDiff.split('\n');
                    addedLines = 0;
                    deletedLines = 0;
                    contextLines = 0;
                    hasFileHeaders = false;
                    for (_i = 0, diffLines_1 = diffLines; _i < diffLines_1.length; _i++) {
                        line = diffLines_1[_i];
                        if (line.startsWith('---') || line.startsWith('+++')) {
                            hasFileHeaders = true;
                        }
                        else if (line.startsWith('+') && !line.startsWith('+++')) {
                            addedLines++;
                        }
                        else if (line.startsWith('-') && !line.startsWith('---')) {
                            deletedLines++;
                        }
                        else if (line.startsWith(' ')) {
                            contextLines++;
                        }
                    }
                    result.appliedChanges = addedLines + deletedLines;
                    // 改善されたコンテンツ検証
                    if (!restoredContent || restoredContent.length === 0) {
                        if (hasFileHeaders && (addedLines > 0 || deletedLines > 0)) {
                            // diff があるのにコンテンツが空の場合は警告だが、続行可能
                            result.warnings.push("Restored content is empty despite having diff changes");
                            this.logger.logWarning("Empty restored content but diff has changes - this may indicate diff processing issues");
                        }
                        else {
                            // diffも内容もない場合は正常
                            result.warnings.push("No changes to apply - diff and content are both empty");
                        }
                        // 空のコンテンツでも isValid = true として続行
                    }
                    else {
                        this.logger.logInfo("Restored content successfully validated: ".concat(restoredContent.length, " characters"));
                    }
                    // 警告チェック
                    if (addedLines === 0 && deletedLines === 0) {
                        result.warnings.push("No actual changes detected in diff");
                    }
                    if (contextLines < 3 && (addedLines > 0 || deletedLines > 0)) {
                        result.warnings.push("Insufficient context lines in diff");
                    }
                    // 復元内容の基本チェック（空でない場合のみ）
                    if (restoredContent && restoredContent.length > 0) {
                        if (restoredContent.includes('<<<<<<< HEAD') || restoredContent.includes('>>>>>>> ')) {
                            result.errors.push("Merge conflict markers detected in restored content");
                            result.isValid = false;
                        }
                        // 文字エンコーディングチェック
                        try {
                            Buffer.from(restoredContent, 'utf-8');
                        }
                        catch (e) {
                            result.errors.push("Invalid UTF-8 encoding in restored content");
                            result.isValid = false;
                        }
                    }
                }
                catch (error) {
                    result.errors.push("Validation error: ".concat(error));
                    result.isValid = false;
                }
                // ログ出力
                if (result.warnings.length > 0) {
                    this.logger.logWarning("Diff validation warnings: ".concat(result.warnings.join(', ')));
                }
                if (result.errors.length > 0) {
                    this.logger.logError("Diff validation errors: ".concat(result.errors.join(', ')));
                }
                return [2 /*return*/, result];
            });
        });
    };
    /**
     * diff適用統計の収集
     */
    LLMFlowController.prototype.collectDiffApplicationStats = function (restoredContent, originalDiff) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, stats, diffLines, _i, diffLines_2, line;
            return __generator(this, function (_a) {
                startTime = Date.now();
                stats = {
                    totalLines: 0,
                    addedLines: 0,
                    deletedLines: 0,
                    modifiedFiles: 0,
                    processingTime: 0,
                    backupCreated: true
                };
                try {
                    // 復元内容の統計
                    stats.totalLines = restoredContent.split('\n').length;
                    diffLines = originalDiff.split('\n');
                    for (_i = 0, diffLines_2 = diffLines; _i < diffLines_2.length; _i++) {
                        line = diffLines_2[_i];
                        if (line.startsWith('+') && !line.startsWith('+++')) {
                            stats.addedLines++;
                        }
                        else if (line.startsWith('-') && !line.startsWith('---')) {
                            stats.deletedLines++;
                        }
                        else if (line.startsWith('@@')) {
                            // ハンクヘッダー = ファイル修正の境界
                            stats.modifiedFiles++;
                        }
                    }
                    // ファイル数の調整（最低1つ）
                    if (stats.modifiedFiles === 0 && (stats.addedLines > 0 || stats.deletedLines > 0)) {
                        stats.modifiedFiles = 1;
                    }
                }
                catch (error) {
                    this.logger.logWarning("Failed to collect diff stats: ".concat(error));
                }
                stats.processingTime = Date.now() - startTime;
                return [2 /*return*/, stats];
            });
        });
    };
    /**
     * エラー発生時のコンテキスト情報収集
     */
    LLMFlowController.prototype.collectErrorContext = function (originalDiff, errorMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var context, diffLines, _i, diffLines_3, line, filePath;
            return __generator(this, function (_a) {
                context = {
                    diffPreview: '',
                    affectedFiles: [],
                    systemState: '',
                    possibleCauses: []
                };
                try {
                    // diffのプレビュー（最初の100文字）
                    context.diffPreview = originalDiff.substring(0, 100) + (originalDiff.length > 100 ? '...' : '');
                    diffLines = originalDiff.split('\n');
                    for (_i = 0, diffLines_3 = diffLines; _i < diffLines_3.length; _i++) {
                        line = diffLines_3[_i];
                        if (line.startsWith('---') || line.startsWith('+++')) {
                            filePath = line.substring(4).trim();
                            if (filePath !== '/dev/null' && !context.affectedFiles.includes(filePath)) {
                                context.affectedFiles.push(filePath);
                            }
                        }
                    }
                    // システム状態の記録
                    context.systemState = "Phase: ".concat(this.internalProgress.currentPhase, ", Turn: ").concat(this.currentTurn, ", Errors: ").concat(this.internalProgress.errorCount);
                    // 可能な原因の推測
                    if (errorMessage.includes('ENOENT')) {
                        context.possibleCauses.push('File not found - target file may not exist');
                    }
                    if (errorMessage.includes('EACCES')) {
                        context.possibleCauses.push('Permission denied - insufficient file system permissions');
                    }
                    if (errorMessage.includes('diff') || errorMessage.includes('patch')) {
                        context.possibleCauses.push('Invalid diff format or corrupted patch data');
                    }
                    if (errorMessage.includes('line')) {
                        context.possibleCauses.push('Line number mismatch - file may have been modified');
                    }
                    if (context.possibleCauses.length === 0) {
                        context.possibleCauses.push('Unknown error - check diff format and file accessibility');
                    }
                }
                catch (error) {
                    this.logger.logWarning("Failed to collect error context: ".concat(error));
                }
                return [2 /*return*/, context];
            });
        });
    };
    // =============================================================================
    // Phase 3-3: 詳細エラーログ用ヘルパーメソッド
    // =============================================================================
    /**
     * diffから影響を受けるファイルのリストを抽出
     */
    LLMFlowController.prototype.extractAffectedFilesFromDiff = function (diffContent) {
        var files = [];
        if (!diffContent)
            return files;
        var lines = diffContent.split('\n');
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            if (line.startsWith('---') || line.startsWith('+++')) {
                // "--- a/path/to/file" または "+++ b/path/to/file" の形式から抽出
                var match = line.match(/^[+-]{3}\s+[ab]\/(.+)$/);
                if (match && match[1] !== '/dev/null') {
                    var filePath = match[1];
                    if (!files.includes(filePath)) {
                        files.push(filePath);
                    }
                }
            }
        }
        return files;
    };
    /**
     * パフォーマンス監視付きの処理実行
     */
    LLMFlowController.prototype.executeWithPerformanceMonitoring = function (operationName, operation) {
        return __awaiter(this, void 0, void 0, function () {
            var timerId, result, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        timerId = this.logger.startPerformanceTimer(operationName);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, operation()];
                    case 2:
                        result = _a.sent();
                        this.logger.endPerformanceTimer(timerId);
                        return [2 /*return*/, result];
                    case 3:
                        error_5 = _a.sent();
                        this.logger.endPerformanceTimer(timerId);
                        throw error_5;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // =============================================================================
    // プラン進行状況追跡
    // =============================================================================
    /**
     * プランの進行状況を解析して、どのステップが完了し、どのステップが残っているかを判定
     */
    LLMFlowController.prototype.analyzePlanProgress = function (currentPlan) {
        var result = {
            totalSteps: 0,
            completedSteps: [],
            remainingSteps: [],
            currentStep: null,
            progressPercentage: 0,
            planWithProgress: currentPlan
        };
        if (!currentPlan || currentPlan.trim().length === 0) {
            return result;
        }
        try {
            console.log("\uD83D\uDD27 Analyzing plan progress");
            // 安全なJSON解析を使用
            var planObj = this.safeParseJSON(currentPlan, 'analyzePlanProgress');
            if (Array.isArray(planObj)) {
                result.totalSteps = planObj.length;
                // 完了済みステップの特定（内部進行状況から判定）
                var completedActions = this.internalProgress.stepsCompleted;
                for (var i = 0; i < planObj.length; i++) {
                    var step = planObj[i];
                    var stepDescription = "".concat(step.action, ": ").concat(step.filePath || step.reason || '');
                    // ステップが完了しているかチェック
                    var isCompleted = this.isStepCompleted(step, completedActions);
                    if (isCompleted) {
                        result.completedSteps.push(stepDescription);
                    }
                    else {
                        result.remainingSteps.push(stepDescription);
                        if (result.currentStep === null) {
                            result.currentStep = stepDescription;
                        }
                    }
                }
                result.progressPercentage = result.totalSteps > 0 ?
                    Math.round((result.completedSteps.length / result.totalSteps) * 100) : 0;
                // 進行状況付きプランを生成
                result.planWithProgress = this.generateProgressPlan(planObj, result.completedSteps);
            }
        }
        catch (jsonError) {
            // JSON解析エラーの詳細ログ
            console.error("\u274C Plan progress analysis JSON parse error:", {
                error: jsonError instanceof Error ? jsonError.message : String(jsonError),
                planLength: currentPlan.length,
                planPreview: currentPlan.substring(0, 200),
                planCharCodes: currentPlan.substring(0, 10).split('').map(function (char) { return char.charCodeAt(0); })
            });
            // JSONでない場合は文字列として処理
            var lines = currentPlan.split('\n').filter(function (line) { return line.trim(); });
            result.totalSteps = lines.length;
            result.remainingSteps = lines;
            result.planWithProgress = currentPlan;
            console.log("\uD83D\uDD04 Plan progress fallback: processed as ".concat(lines.length, " text lines"));
        }
        return result;
    };
    /**
     * ステップが完了しているかを判定
     */
    LLMFlowController.prototype.isStepCompleted = function (step, completedActions) {
        if (!step.action)
            return false;
        // アクション別の完了判定
        switch (step.action) {
            case 'REVIEW_FILE_CONTENT':
            case 'REQUEST_FILE_CONTENT':
                // ファイル要求/レビューは、該当ファイルが処理済みかチェック
                return this.internalProgress.contextAccumulated.sourceFiles.includes(step.filePath) ||
                    this.internalProgress.contextAccumulated.configFiles.includes(step.filePath) ||
                    this.internalProgress.contextAccumulated.protoFiles.includes(step.filePath) ||
                    this.internalProgress.contextAccumulated.testFiles.includes(step.filePath);
            case 'MODIFY_FILE':
                // ファイル修正は、diffが適用されているかチェック
                return completedActions.includes('DIFF_APPLIED') ||
                    completedActions.includes("MODIFIED_".concat(step.filePath));
            case 'VERIFY_CHANGES':
                // 検証は、検証完了フラグをチェック
                return completedActions.includes('VERIFICATION_COMPLETED');
            default:
                // その他のアクションは、直接的な一致をチェック
                return completedActions.includes(step.action);
        }
    };
    /**
     * 進行状況を含むプランを生成
     */
    LLMFlowController.prototype.generateProgressPlan = function (planArray, completedSteps) {
        var enhancedPlan = planArray.map(function (step, index) {
            var stepDescription = "".concat(step.action, ": ").concat(step.filePath || step.reason || '');
            var isCompleted = completedSteps.includes(stepDescription);
            var status = isCompleted ? '✅' : '⏳';
            return __assign(__assign({}, step), { step: index + 1, status: status, completed: isCompleted });
        });
        return JSON.stringify(enhancedPlan, null, 2);
    };
    // =============================================================================
    // プレーンテキストの指示文判定ヘルパーメソッド
    // =============================================================================
    /**
     * プレーンテキストの指示文かどうかを判定するヘルパーメソッド
     */
    LLMFlowController.prototype.looksLikePlainTextInstruction = function (text) {
        if (!text || text.trim().length === 0) {
            return false;
        }
        var trimmed = text.trim();
        // 番号付きリストパターン
        var isNumberedList = /^\s*\d+\.\s*/.test(trimmed);
        // 箇条書きリストパターン
        var isBulletList = /^\s*[-*•]\s*/.test(trimmed);
        // JSON構造の存在チェック
        var hasJSONStructure = /[\[\{]/.test(trimmed) && /[\]\}]/.test(trimmed);
        // プレーンテキストの指示特有のパターン
        var hasInstructionKeywords = /\b(review|check|assess|modify|update|ensure|verify)\b/i.test(trimmed);
        // ファイルパス参照パターン
        var hasFileReferences = /`[^`]*\.(go|ts|js|proto|json|yaml|yml|txt|md)`/.test(trimmed);
        return (isNumberedList || isBulletList || hasInstructionKeywords || hasFileReferences) && !hasJSONStructure;
    };
    // =============================================================================
    // JSON解析ヘルパーメソッド
    // =============================================================================
    /**
     * 安全にJSONを解析するヘルパーメソッド
     * 一般的なJSONエラーを自動修復する
     */
    LLMFlowController.prototype.safeParseJSON = function (jsonString, context) {
        var _this = this;
        if (context === void 0) { context = 'unknown'; }
        if (!jsonString || typeof jsonString !== 'string') {
            throw new Error("Invalid input for JSON parsing in ".concat(context));
        }
        // プレーンテキストの指示リストかチェック（JSON解析の前に実行）
        var trimmed = jsonString.trim();
        var isNumberedList = /^\s*\d+\.\s*/.test(trimmed);
        var isBulletList = /^\s*[-*•]\s*/.test(trimmed);
        // より精密なJSON構造チェック - 実際にJSONとして開始されているかを確認
        var startsWithJsonStructure = /^\s*[\[\{]/.test(trimmed);
        var endsWithJsonStructure = /[\]\}]\s*$/.test(trimmed);
        var hasJsonBlockStart = /```json\s*\n\s*[\[\{]/.test(trimmed);
        // プレーンテキスト指示の特徴をチェック
        var hasInstructionKeywords = /\b(inspect|check|review|verify|ensure|update|modify)\b/i.test(trimmed);
        var hasFileReferences = /`[^`]*\.(go|ts|js|proto|json|yaml|yml|txt|md)`/.test(trimmed);
        // 混合コンテンツの判定：プレーンテキスト + JSONコードブロック
        var isMixedContent = (isNumberedList || isBulletList) && hasJsonBlockStart;
        if ((isNumberedList || isBulletList) && (!startsWithJsonStructure || isMixedContent)) {
            console.log("\uD83D\uDD27 Detected plain text instruction list in ".concat(context, ", returning as string"));
            console.log("\uD83D\uDCCB List content preview: ".concat(trimmed.substring(0, 200), "..."));
            console.log("\uD83D\uDCCB List type: ".concat(isNumberedList ? 'numbered' : 'bullet'));
            console.log("\uD83D\uDCCB Mixed content: ".concat(isMixedContent ? 'yes' : 'no'));
            console.log("\uD83D\uDCCB Has instruction keywords: ".concat(hasInstructionKeywords ? 'yes' : 'no'));
            console.log("\uD83D\uDCCB Has file references: ".concat(hasFileReferences ? 'yes' : 'no'));
            return trimmed; // プレーンテキストとして返す
        }
        // 段階的なクリーンアップ処理
        var cleanupSteps = [
            // ステップ1: 徹底的な文字クリーンアップ
            function (str) {
                var cleaned = str.trim();
                // 見えない制御文字、特殊空白文字の徹底除去
                cleaned = cleaned
                    .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅文字
                    .replace(/[\u0000-\u001F\u007F-\u009F]/g, function (match) {
                    var code = match.charCodeAt(0);
                    if (code === 9 || code === 10 || code === 13) { // タブ、改行、復帰
                        return ' ';
                    }
                    console.log("\uD83E\uDDF9 Step1: Removing control character: charCode ".concat(code));
                    return '';
                })
                    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // 特殊空白を通常空白に
                    .replace(/[\u2028\u2029]/g, ' ') // ライン・パラグラフ区切り文字
                    .replace(/[\uFFF0-\uFFFF]/g, '') // 特殊用途文字
                    .replace(/\s+/g, ' ') // 連続する空白を単一のスペースに統合
                    .trim();
                console.log("\uD83E\uDDF9 Step1: Thorough character cleanup completed, length: ".concat(str.length, " \u2192 ").concat(cleaned.length));
                return cleaned;
            },
            // ステップ2: バッククォートで囲まれた文字列の処理
            function (str) {
                // バッククォートで囲まれた文字列を検出
                var backtickMatch = str.match(/^`([\s\S]*)`$/);
                if (backtickMatch) {
                    var content = backtickMatch[1].trim();
                    console.log("\uD83D\uDD27 Detected backtick-wrapped content in ".concat(context));
                    // より厳密なJSON構造チェック
                    var hasJsonStructure = _this.isValidJsonStructure(content);
                    if (hasJsonStructure) {
                        console.log("\uD83D\uDD04 Backtick content contains valid JSON structure");
                        // JSONとして直接処理
                        return content;
                    }
                    else {
                        console.log("\uD83D\uDD04 Backtick content is plain text, treating as string literal");
                        // プレーンテキストとして適切なJSON文字列に変換
                        return JSON.stringify(content);
                    }
                }
                return str;
            },
            // ステップ3: YAML風リスト形式と混合コンテンツのクリーンアップ
            function (str) {
                var cleaned = str;
                // YAML風リスト形式の検出と変換（新機能）
                var yamlListPattern = /^(\s*-\s*\{[\s\S]*?\}\s*)+$/;
                if (yamlListPattern.test(cleaned.trim())) {
                    console.log("\uD83D\uDD04 Detected YAML-style list format in ".concat(context, ", converting to JSON array"));
                    try {
                        var lines = cleaned.trim().split('\n');
                        var jsonObjects = [];
                        for (var _i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
                            var line = lines_2[_i];
                            var trimmedLine = line.trim();
                            if (trimmedLine.startsWith('- {') && trimmedLine.endsWith('}')) {
                                // "- {" を除去してJSONオブジェクトを抽出
                                var jsonPart = trimmedLine.substring(2).trim();
                                try {
                                    var parsed = JSON.parse(jsonPart);
                                    jsonObjects.push(parsed);
                                }
                                catch (lineError) {
                                    console.log("\u274C Failed to parse line: ".concat(trimmedLine, ", error: ").concat(lineError));
                                }
                            }
                        }
                        if (jsonObjects.length > 0) {
                            var jsonArray = JSON.stringify(jsonObjects);
                            // 末尾カンマをチェックして除去（追加の安全策）
                            jsonArray = jsonArray.replace(/,(\s*[\]\}])/g, '$1');
                            console.log("\u2705 Converted YAML-style list to JSON array with ".concat(jsonObjects.length, " items"));
                            console.log("\uD83D\uDD04 Result: ".concat(jsonArray.substring(0, 100), "..."));
                            return jsonArray;
                        }
                    }
                    catch (yamlError) {
                        console.log("\u274C YAML-style list conversion failed: ".concat(yamlError));
                    }
                }
                // 混合コンテンツのパターンを検出し、クリーンアップ
                // パターン0: プレーンテキスト指示 + JSONコードブロック（新しいパターン）
                var textWithJsonBlockPattern = /^(\d+\.\s*\*\*[^`]*```json\s*\n?)([\[\{][\s\S]*?[\]\}])(\s*```.*)?$/m;
                var textWithJsonMatch = cleaned.match(textWithJsonBlockPattern);
                if (textWithJsonMatch) {
                    console.log("\uD83D\uDD04 Detected plain text instruction with JSON code block in ".concat(context, ", extracting JSON part"));
                    console.log("\uD83D\uDCCB Plain text part: \"".concat(textWithJsonMatch[1].substring(0, 100), "...\""));
                    console.log("\uD83D\uDCCB JSON part: \"".concat(textWithJsonMatch[2].substring(0, 100), "...\""));
                    cleaned = textWithJsonMatch[2]; // JSON部分のみを抽出
                }
                // パターン1: JSON配列の後に続くテキストやリスト項目を削除
                var mixedPattern1 = /(\[[\s\S]*?\])\s*[-•*]\s*[^\[{]*$/;
                var mixedMatch1 = cleaned.match(mixedPattern1);
                if (mixedMatch1) {
                    console.log("\uD83D\uDD04 Detected mixed content (JSON + bullet list) in ".concat(context, ", extracting JSON part"));
                    cleaned = mixedMatch1[1];
                }
                // パターン2: 複数のJSON配列が改行で区切られている場合
                var multiJsonPattern = /(\[[\s\S]*?\])\s*\n\s*(\[[\s\S]*?\])/;
                var multiJsonMatch = cleaned.match(multiJsonPattern);
                if (multiJsonMatch) {
                    console.log("\uD83D\uDD04 Detected multiple JSON arrays separated by newlines in ".concat(context));
                    try {
                        var array1 = JSON.parse(multiJsonMatch[1]);
                        var array2 = JSON.parse(multiJsonMatch[2]);
                        var merged = __spreadArray(__spreadArray([], array1, true), array2, true);
                        cleaned = JSON.stringify(merged);
                        console.log("\uD83D\uDD04 Merged arrays: ".concat(array1.length, " + ").concat(array2.length, " = ").concat(merged.length, " items"));
                    }
                    catch (e) {
                        console.log("\u274C Failed to merge arrays, using first one: ".concat(e));
                        cleaned = multiJsonMatch[1];
                    }
                }
                // パターン3: JSON配列の後に続くプレーンテキストを削除
                var jsonWithTextPattern = /(\[[\s\S]*?\])\s*[\r\n]+\s*[-•*]?\s*[A-Za-z].*$/;
                var jsonWithTextMatch = cleaned.match(jsonWithTextPattern);
                if (jsonWithTextMatch) {
                    console.log("\uD83D\uDD04 Detected JSON followed by plain text in ".concat(context, ", extracting JSON part"));
                    cleaned = jsonWithTextMatch[1];
                }
                return cleaned;
            },
            // ステップ4: JSON境界の検出と抽出
            function (str) {
                // 先頭の空白を削除してから判定
                var trimmed = str.trim();
                // 複数のJSON配列が混在している場合の処理
                var jsonArrayMatches = trimmed.match(/\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/g);
                if (jsonArrayMatches && jsonArrayMatches.length > 1) {
                    console.log("\uD83D\uDD04 Detected multiple JSON arrays in ".concat(context, ", merging them"));
                    try {
                        // 複数のJSONを配列として結合
                        var parsedArrays = jsonArrayMatches.map(function (match) { return JSON.parse(match); });
                        var mergedArray = parsedArrays.flat(); // 配列を平坦化
                        console.log("\uD83D\uDD04 Merged ".concat(jsonArrayMatches.length, " JSON arrays into one with ").concat(mergedArray.length, " items"));
                        return JSON.stringify(mergedArray);
                    }
                    catch (mergeError) {
                        console.log("\u274C Failed to merge multiple JSON arrays: ".concat(mergeError));
                        // 最初の有効なJSONを使用
                        return jsonArrayMatches[0];
                    }
                }
                // 単一のJSON配列またはオブジェクトの開始/終了を検出
                var arrayMatch = trimmed.match(/^\[[\s\S]*?\](?=\s*(?:\[|$))/);
                var objectMatch = trimmed.match(/^\{[\s\S]*?\}(?=\s*(?:\{|$))/);
                if (arrayMatch) {
                    console.log("\uD83D\uDD04 Detected JSON array in ".concat(context));
                    var cleanedArray = arrayMatch[0];
                    // 末尾カンマを事前に除去
                    cleanedArray = cleanedArray.replace(/,(\s*[\]\}])/g, '$1');
                    return cleanedArray;
                }
                if (objectMatch) {
                    console.log("\uD83D\uDD04 Detected JSON object in ".concat(context));
                    var cleanedObject = objectMatch[0];
                    // 末尾カンマを事前に除去
                    cleanedObject = cleanedObject.replace(/,(\s*[\]\}])/g, '$1');
                    return cleanedObject;
                }
                // より精密なJSON抽出を試行（ブラケットカウンティング）
                if (trimmed.includes('[') && trimmed.includes(']')) {
                    var startIdx = trimmed.indexOf('[');
                    var bracketCount = 0;
                    var inString = false;
                    var escapeNext = false;
                    var endIdx = -1;
                    for (var i = startIdx; i < trimmed.length; i++) {
                        var char = trimmed[i];
                        if (escapeNext) {
                            escapeNext = false;
                            continue;
                        }
                        if (char === '\\' && inString) {
                            escapeNext = true;
                            continue;
                        }
                        if (char === '"' && !escapeNext) {
                            inString = !inString;
                            continue;
                        }
                        if (!inString) {
                            if (char === '[') {
                                bracketCount++;
                            }
                            else if (char === ']') {
                                bracketCount--;
                                if (bracketCount === 0) {
                                    endIdx = i + 1;
                                    break;
                                }
                            }
                        }
                    }
                    if (endIdx > startIdx) {
                        var extracted = trimmed.substring(startIdx, endIdx);
                        console.log("\uD83D\uDD04 Extracted JSON array using bracket counting in ".concat(context));
                        return extracted;
                    }
                }
                if (trimmed.includes('{') && trimmed.includes('}')) {
                    var startIdx = trimmed.indexOf('{');
                    var braceCount = 0;
                    var inString = false;
                    var escapeNext = false;
                    var endIdx = -1;
                    for (var i = startIdx; i < trimmed.length; i++) {
                        var char = trimmed[i];
                        if (escapeNext) {
                            escapeNext = false;
                            continue;
                        }
                        if (char === '\\' && inString) {
                            escapeNext = true;
                            continue;
                        }
                        if (char === '"' && !escapeNext) {
                            inString = !inString;
                            continue;
                        }
                        if (!inString) {
                            if (char === '{') {
                                braceCount++;
                            }
                            else if (char === '}') {
                                braceCount--;
                                if (braceCount === 0) {
                                    endIdx = i + 1;
                                    break;
                                }
                            }
                        }
                    }
                    if (endIdx > startIdx) {
                        var extracted = trimmed.substring(startIdx, endIdx);
                        console.log("\uD83D\uDD04 Extracted JSON object using brace counting in ".concat(context));
                        return extracted;
                    }
                }
                return str;
            },
            // ステップ5: プレーンテキストの処理
            function (str) {
                // 既にJSON構造が検出されている場合はそのまま処理
                if (str.trim().startsWith('{') || str.trim().startsWith('[')) {
                    return str;
                }
                // すでにJSON文字列として適切にエンコードされている場合
                if (str.trim().startsWith('"') && str.trim().endsWith('"')) {
                    return str;
                }
                // JSONの開始文字がない場合、プレーンテキストとして扱う
                if (!str.startsWith('{') && !str.startsWith('[') && !str.startsWith('"')) {
                    console.log("\uD83D\uDD27 Treating as plain text in ".concat(context));
                    console.log("   Original: \"".concat(str.substring(0, 100), "...\""));
                    var encoded = JSON.stringify(str);
                    console.log("   Encoded: \"".concat(encoded.substring(0, 100), "...\""));
                    // エンコード結果をテスト
                    try {
                        JSON.parse(encoded);
                        console.log("\u2705 Plain text encoding verification passed");
                    }
                    catch (testError) {
                        console.error("\u274C Plain text encoding verification failed: ".concat(testError));
                    }
                    return encoded;
                }
                return str;
            },
            // ステップ6: 一般的なJSON構文エラーの修正
            function (str) {
                var fixed = str
                    .replace(/[\r\n\t]/g, ' ') // 改行・タブを半角スペースに
                    .replace(/\s+/g, ' ') // 連続スペースを単一に
                    .replace(/:\s*,/g, ': null,') // 空値をnullに
                    .replace(/"\s*:\s*"/g, '": "'); // クォート問題の修正
                // バッククォートのエスケープ処理（JSON文字列内）
                // JSON文字列内でバッククォートが含まれている場合、それをエスケープ
                fixed = fixed.replace(/"([^"]*`[^"]*)"/g, function (match, content) {
                    var escapedContent = content.replace(/`/g, '\\u0060');
                    console.log("\uD83D\uDD27 Escaping backticks in JSON string: \"".concat(content, "\" \u2192 \"").concat(escapedContent, "\""));
                    return "\"".concat(escapedContent, "\"");
                });
                // 末尾カンマの除去（改良版）
                // 配列とオブジェクトの両方に対応
                fixed = fixed
                    .replace(/,(\s*[\]\}])/g, '$1') // 基本的な末尾カンマ除去
                    .replace(/,(\s*)\]/g, '$1]') // 配列の末尾カンマ
                    .replace(/,(\s*)\}/g, '$1}') // オブジェクトの末尾カンマ
                    .replace(/,(\s*)(\n\s*[\]\}])/g, '$1$2'); // 改行を含む末尾カンマ
                return fixed;
            },
            // ステップ7: 不正な文字の修正
            function (str) { return str
                .replace(/'/g, '"') // シングルクォートをダブルクォートに
                .replace(/([{,]\s*)(\w+):/g, '$1"$2":'); } // プロパティ名をクォート
        ];
        var cleanedJson = jsonString;
        var lastError = null;
        // 各クリーンアップステップを順次適用
        for (var i = 0; i < cleanupSteps.length; i++) {
            try {
                var previousJson = cleanedJson;
                cleanedJson = cleanupSteps[i](cleanedJson);
                console.log("\uD83D\uDD04 JSON cleanup step ".concat(i + 1, " for ").concat(context, ": \"").concat(previousJson.substring(0, 50), "...\" \u2192 \"").concat(cleanedJson.substring(0, 50), "...\""));
                // デバッグ: JSON.parse前の詳細ログ
                console.log("\uD83D\uDD27 About to parse JSON in step ".concat(i + 1, ":"));
                console.log("   Length: ".concat(cleanedJson.length));
                console.log("   First 20 chars: \"".concat(cleanedJson.substring(0, 20), "\""));
                console.log("   Char codes: [".concat(cleanedJson.substring(0, 10).split('').map(function (c) { return c.charCodeAt(0); }).join(', '), "]"));
                // 各ステップ後にJSONパースを試行
                try {
                    var result = JSON.parse(cleanedJson);
                    console.log("\u2705 JSON parsed successfully at cleanup step ".concat(i + 1, " for ").concat(context));
                    return result;
                }
                catch (parseError) {
                    // このステップでの解析に失敗した場合、詳細ログを出力
                    console.log("\u274C JSON parse failed at step ".concat(i + 1, " for ").concat(context, ": ").concat(parseError instanceof Error ? parseError.message : String(parseError)));
                    console.log("   Cleaned content: \"".concat(cleanedJson.substring(0, 100), "...\""));
                    // エラー位置の詳細分析
                    if (parseError instanceof Error && parseError.message.includes('at position')) {
                        var posMatch = parseError.message.match(/at position (\d+)/);
                        if (posMatch) {
                            var errorPos = parseInt(posMatch[1]);
                            console.log("\uD83D\uDD0D Error position analysis:");
                            console.log("   Error at position: ".concat(errorPos));
                            console.log("   JSON length: ".concat(cleanedJson.length));
                            // エラー位置周辺の文字を詳細表示
                            var start = Math.max(0, errorPos - 10);
                            var end = Math.min(cleanedJson.length, errorPos + 10);
                            console.log("   Context (".concat(start, "-").concat(end, "):"));
                            for (var pos = start; pos < end; pos++) {
                                var char = cleanedJson[pos];
                                var charCode = char.charCodeAt(0);
                                var marker = pos === errorPos ? ' <-- ERROR' : '';
                                var charDesc = charCode < 32 ? "[CTRL-".concat(charCode, "]") : charCode > 126 ? "[EXTENDED-".concat(charCode, "]") : char;
                                console.log("     ".concat(pos, ": '").concat(charDesc, "' (").concat(charCode, ")").concat(marker));
                            }
                            // 特殊文字の全体スキャン
                            var specialChars = [];
                            for (var pos = 0; pos < cleanedJson.length; pos++) {
                                var charCode = cleanedJson.charCodeAt(pos);
                                if (charCode < 32 && charCode !== 10 && charCode !== 13 && charCode !== 9) { // 改行、復帰、タブ以外の制御文字
                                    specialChars.push({ pos: pos, char: cleanedJson[pos], code: charCode });
                                }
                                else if (charCode >= 127 && charCode <= 159) { // 拡張制御文字
                                    specialChars.push({ pos: pos, char: cleanedJson[pos], code: charCode });
                                }
                                else if (charCode >= 8192 && charCode <= 8303) { // Unicode空白・特殊文字
                                    specialChars.push({ pos: pos, char: cleanedJson[pos], code: charCode });
                                }
                            }
                            if (specialChars.length > 0) {
                                console.log("\uD83D\uDEA8 Found ".concat(specialChars.length, " special characters:"));
                                specialChars.slice(0, 10).forEach(function (sc) {
                                    console.log("     Position ".concat(sc.pos, ": charCode ").concat(sc.code));
                                });
                            }
                        }
                    }
                    // プレーンテキストの可能性を再チェック
                    if (i === 0 && this.looksLikePlainTextInstruction(cleanedJson)) {
                        console.log("\uD83D\uDD04 Content appears to be plain text instruction, returning as-is");
                        return cleanedJson;
                    }
                    throw parseError; // エラーを再スロー（次のステップへ）
                }
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                // このステップでは解析できない、次のステップへ
                console.log("\uD83D\uDD04 JSON cleanup step ".concat(i + 1, " failed for ").concat(context, ": ").concat(lastError.message));
                continue;
            }
        }
        // 全てのクリーンアップが失敗した場合
        console.error("\u274C All JSON cleanup attempts failed for ".concat(context, ":"), {
            originalLength: jsonString.length,
            cleanedLength: cleanedJson.length,
            originalPreview: jsonString.substring(0, 100),
            cleanedPreview: cleanedJson.substring(0, 100),
            charCodes: jsonString.substring(0, 20).split('').map(function (char) { return char.charCodeAt(0); }),
            lastError: (lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'Unknown error'
        });
        // 最後の手段：プレーンテキストとして返す
        console.log("\uD83D\uDD04 Final fallback for ".concat(context, ": treating as plain text"));
        try {
            return jsonString; // プレーンテキストとして返す
        }
        catch (fallbackError) {
            throw new Error("Failed to parse JSON after all cleanup attempts in ".concat(context, ": ").concat((lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'Unknown error'));
        }
    };
    /**
     * JSON構造の妥当性をチェックするヘルパーメソッド
     */
    LLMFlowController.prototype.isValidJsonStructure = function (content) {
        if (!content || content.trim().length === 0) {
            return false;
        }
        var trimmed = content.trim();
        // 基本的なJSON開始文字チェック
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            return false;
        }
        // 対応する終了文字をチェック
        if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
            return false;
        }
        if (trimmed.startsWith('[') && !trimmed.endsWith(']')) {
            return false;
        }
        // JSON特有のパターンをチェック
        var jsonPatterns = [
            /"[^"]*"\s*:\s*/, // キー:値のパターン
            /\{\s*"/, // オブジェクト開始パターン
            /\[\s*\{/, // オブジェクト配列パターン
            /"[^"]*"\s*,\s*"/, // 複数のキーパターン
        ];
        var hasJsonPattern = jsonPatterns.some(function (pattern) { return pattern.test(trimmed); });
        // 簡単なJSON解析テスト
        if (hasJsonPattern) {
            try {
                JSON.parse(trimmed);
                return true;
            }
            catch (e) {
                // パースエラーでも、基本的なJSON構造があれば修復可能とみなす
                return true;
            }
        }
        return false;
    };
    return LLMFlowController;
}());
exports.default = LLMFlowController;
