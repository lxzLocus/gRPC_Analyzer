"use strict";
/**
 * OpenAI LLM Client
 * OpenAI APIとの通信を担当
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
exports.OpenAILLMClient = void 0;
var OpenAILLMClient = /** @class */ (function () {
    function OpenAILLMClient(config, apiKey) {
        this.isInitialized = false;
        this.config = config;
        // 環境変数から APIキーを取得
        var finalApiKey = apiKey || process.env.OPENAI_TOKEN || process.env.OPENAI_API_KEY || '';
        console.log("\uD83D\uDD11 OpenAILLMClient: Using API key length: ".concat(finalApiKey.length));
        console.log("\uD83D\uDD11 Available env vars: OPENAI_TOKEN=".concat(!!process.env.OPENAI_TOKEN, ", OPENAI_API_KEY=").concat(!!process.env.OPENAI_API_KEY));
        console.log("\uD83E\uDD16 OpenAILLMClient: Using model: ".concat(this.config.get('llm.model', 'gpt-4.1')));
        // OpenAIクライアントの初期化を非同期で行う
        this.initPromise = this.initializeClient(finalApiKey);
    }
    OpenAILLMClient.prototype.initializeClient = function (apiKey) {
        return __awaiter(this, void 0, void 0, function () {
            var OpenAI, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('openai'); })];
                    case 1:
                        OpenAI = (_a.sent()).default;
                        this.client = new OpenAI({
                            apiKey: apiKey,
                            timeout: this.config.get('llm.timeout', 30000)
                        });
                        this.isInitialized = true;
                        console.log('✅ OpenAI client initialized successfully');
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.error('❌ Failed to initialize OpenAI client:', error_1);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    OpenAILLMClient.prototype.waitForInitialization = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.initPromise];
            });
        });
    };
    OpenAILLMClient.prototype.isReady = function () {
        return this.isInitialized;
    };
    OpenAILLMClient.prototype.getProviderName = function () {
        return 'OpenAI';
    };
    OpenAILLMClient.prototype.generateContent = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var model, maxTokens, temperature, response, content, usage, error_2;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!!this.isInitialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.waitForInitialization()];
                    case 1:
                        _d.sent();
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 4, , 5]);
                        model = request.model || this.config.get('llm.model', 'gpt-4.1');
                        maxTokens = request.maxTokens || this.config.get('llm.maxTokens', 4000);
                        temperature = request.temperature || this.config.get('llm.temperature', 0.1);
                        console.log("\uD83D\uDE80 OpenAI request: model=".concat(model, ", maxTokens=").concat(maxTokens, ", temperature=").concat(temperature));
                        return [4 /*yield*/, this.client.chat.completions.create({
                                model: model,
                                messages: request.messages,
                                max_tokens: maxTokens,
                                temperature: temperature
                            })];
                    case 3:
                        response = _d.sent();
                        content = ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '';
                        usage = response.usage;
                        console.log("\u2705 OpenAI response: ".concat(content.length, " chars, usage: ").concat((usage === null || usage === void 0 ? void 0 : usage.total_tokens) || 0, " tokens"));
                        return [2 /*return*/, {
                                content: content,
                                usage: usage ? {
                                    promptTokens: usage.prompt_tokens,
                                    completionTokens: usage.completion_tokens,
                                    totalTokens: usage.total_tokens
                                } : undefined,
                                model: response.model,
                                finishReason: ((_c = response.choices[0]) === null || _c === void 0 ? void 0 : _c.finish_reason) || 'unknown'
                            }];
                    case 4:
                        error_2 = _d.sent();
                        console.error('❌ OpenAI API error:', error_2);
                        throw error_2;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return OpenAILLMClient;
}());
exports.OpenAILLMClient = OpenAILLMClient;
exports.default = OpenAILLMClient;
