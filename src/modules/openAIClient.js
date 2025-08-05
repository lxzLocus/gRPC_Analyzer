"use strict";
/**
 * OpenAI API クライアント (レガシー互換性)
 * 新しいLLMクライアントシステムと既存コードの橋渡し
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
var llmClientFactory_js_1 = require("./llmClientFactory.js");
var OpenAIClient = /** @class */ (function () {
    function OpenAIClient(config, apiKey) {
        this.config = config;
        console.log("\uD83D\uDD11 OPENAI_TOKEN length: ".concat((process.env.OPENAI_TOKEN || '').length));
        console.log("\uD83D\uDD11 OPENAI_API_KEY length: ".concat((process.env.OPENAI_API_KEY || '').length));
        console.log("\uD83C\uDF0D NODE_ENV: ".concat(process.env.NODE_ENV || 'undefined'));
        console.log("\uFFFD DEBUG_MODE: ".concat(process.env.DEBUG_MODE || 'undefined'));
        // プロバイダーの自動選択または設定に基づく選択
        var provider = llmClientFactory_js_1.LLMClientFactory.autoSelectProvider(config);
        console.log("\uD83E\uDD16 Selected LLM provider: ".concat(provider));
        this.llmClient = llmClientFactory_js_1.LLMClientFactory.create(config, provider);
        this.initPromise = this.llmClient.waitForInitialization();
    }
    OpenAIClient.prototype.fetchOpenAPI = function (messages) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // 新しいLLMクライアントを使用してレスポンスを取得
                    return [4 /*yield*/, this.initPromise];
                    case 1:
                        // 新しいLLMクライアントを使用してレスポンスを取得
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.llmClient.generateContent({
                                messages: messages.map(function (msg) { return ({
                                    role: msg.role,
                                    content: msg.content
                                }); })
                            })];
                    case 3:
                        response = _a.sent();
                        // 既存のコードとの互換性のため、OpenAI形式のレスポンスを模倣
                        return [2 /*return*/, {
                                choices: [{
                                        message: {
                                            content: response.content,
                                            role: 'assistant'
                                        },
                                        finish_reason: response.finishReason || 'stop'
                                    }],
                                usage: response.usage ? {
                                    prompt_tokens: response.usage.promptTokens,
                                    completion_tokens: response.usage.completionTokens,
                                    total_tokens: response.usage.totalTokens
                                } : {
                                    prompt_tokens: 0,
                                    completion_tokens: 0,
                                    total_tokens: 0
                                },
                                model: response.model || 'unknown'
                            }];
                    case 4:
                        error_1 = _a.sent();
                        console.error('❌ LLM API error:', error_1);
                        throw error_1;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 使用中のLLMプロバイダー名を取得
     */
    OpenAIClient.prototype.getProviderName = function () {
        return this.llmClient.getProviderName();
    };
    /**
     * LLMクライアントが準備完了かチェック
     */
    OpenAIClient.prototype.isReady = function () {
        return this.llmClient.isReady();
    };
    /**
     * モック用メソッド: レスポンスを直接設定（互換性のため残す）
     */
    OpenAIClient.prototype.setMockResponse = function (response) {
        // 新しいシステムではモック機能は各クライアントで処理
        console.warn('⚠️  setMockResponse is deprecated in new LLM system');
    };
    return OpenAIClient;
}());
exports.default = OpenAIClient;
