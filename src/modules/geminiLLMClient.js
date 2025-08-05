"use strict";
/**
 * Gemini LLM Client
 * Google Gemini APIとの通信を担当
 */
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
exports.GeminiLLMClient = void 0;
var GeminiLLMClient = /** @class */ (function () {
    function GeminiLLMClient(config, apiKey) {
        this.isInitialized = false;
        this.config = config;
        // 環境変数から APIキーを取得
        var finalApiKey = apiKey || process.env.GEMINI_API_KEY || '';
        console.log("\uD83D\uDD11 GeminiLLMClient: Using API key length: ".concat(finalApiKey.length));
        console.log("\uD83D\uDD11 Available env vars: GEMINI_API_KEY=".concat(!!process.env.GEMINI_API_KEY));
        console.log("\uD83E\uDD16 GeminiLLMClient: Using model: ".concat(this.config.get('gemini.model', 'gemini-2.5-pro')));
        // Geminiクライアントの初期化を非同期で行う
        this.initPromise = this.initializeClient(finalApiKey);
    }
    GeminiLLMClient.prototype.initializeClient = function (apiKey) {
        return __awaiter(this, void 0, void 0, function () {
            var GoogleGenAI, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('@google/genai'); })];
                    case 1:
                        GoogleGenAI = (_a.sent()).GoogleGenAI;
                        this.client = new GoogleGenAI({
                            apiKey: apiKey
                        });
                        this.isInitialized = true;
                        console.log('✅ Gemini client initialized successfully');
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.error('❌ Failed to initialize Gemini client:', error_1);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    GeminiLLMClient.prototype.waitForInitialization = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.initPromise];
            });
        });
    };
    GeminiLLMClient.prototype.isReady = function () {
        return this.isInitialized;
    };
    GeminiLLMClient.prototype.getProviderName = function () {
        return 'Gemini';
    };
    GeminiLLMClient.prototype.formatMessagesForGemini = function (messages) {
        // Geminiは単一のプロンプトを期待するため、メッセージを統合
        return messages.map(function (msg) {
            switch (msg.role) {
                case 'system':
                    return "System: ".concat(msg.content);
                case 'user':
                    return "User: ".concat(msg.content);
                case 'assistant':
                    return "Assistant: ".concat(msg.content);
                default:
                    return msg.content;
            }
        }).join('\n\n');
    };
    GeminiLLMClient.prototype.generateContent = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var model, temperature, prompt_1, response, content, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.isInitialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.waitForInitialization()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        model = request.model || this.config.get('gemini.model', 'gemini-2.5-pro');
                        temperature = request.temperature || this.config.get('gemini.temperature', 0.1);
                        console.log("\uD83D\uDE80 Gemini request: model=".concat(model, ", temperature=").concat(temperature));
                        prompt_1 = this.formatMessagesForGemini(request.messages);
                        return [4 /*yield*/, this.client.models.generateContent({
                                model: model,
                                contents: prompt_1,
                                generationConfig: {
                                    temperature: temperature,
                                    maxOutputTokens: request.maxTokens || this.config.get('gemini.maxTokens', 4000)
                                }
                            })];
                    case 3:
                        response = _a.sent();
                        content = response.text || '';
                        console.log("\u2705 Gemini response: ".concat(content.length, " chars"));
                        return [2 /*return*/, {
                                content: content,
                                usage: {
                                    promptTokens: 0, // Gemini APIはトークン数を提供しない場合がある
                                    completionTokens: 0,
                                    totalTokens: 0
                                },
                                model: model,
                                finishReason: 'stop'
                            }];
                    case 4:
                        error_2 = _a.sent();
                        console.error('❌ Gemini API error:', error_2);
                        throw error_2;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return GeminiLLMClient;
}());
exports.GeminiLLMClient = GeminiLLMClient;
exports.default = GeminiLLMClient;
