"use strict";
/**
 * LLM Client Factory
 * 設定に基づいて適切なLLMクライアントを生成
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMClientFactory = void 0;
var openAILLMClient_js_1 = require("./openAILLMClient.js");
var geminiLLMClient_js_1 = require("./geminiLLMClient.js");
var LLMClientFactory = /** @class */ (function () {
    function LLMClientFactory() {
    }
    LLMClientFactory.create = function (config, provider) {
        // プロバイダーの決定（優先順位: 引数 > 設定 > デフォルト）
        var selectedProvider = provider ||
            config.get('llm.provider', 'openai');
        console.log("\uD83C\uDFED LLMClientFactory: Creating ".concat(selectedProvider, " client"));
        switch (selectedProvider) {
            case 'openai':
                return new openAILLMClient_js_1.default(config);
            case 'gemini':
                return new geminiLLMClient_js_1.default(config);
            default:
                console.warn("\u26A0\uFE0F  Unknown LLM provider: ".concat(selectedProvider, ", falling back to OpenAI"));
                return new openAILLMClient_js_1.default(config);
        }
    };
    /**
     * 利用可能なプロバイダーの一覧を取得
     */
    LLMClientFactory.getAvailableProviders = function () {
        return ['openai', 'gemini'];
    };
    /**
     * プロバイダーの自動選択（APIキーの有無で判定）
     */
    LLMClientFactory.autoSelectProvider = function (config) {
        var hasOpenAIKey = !!(process.env.OPENAI_TOKEN || process.env.OPENAI_API_KEY);
        var hasGeminiKey = !!process.env.GEMINI_API_KEY;
        console.log("\uD83D\uDD0D Auto-selecting provider: OpenAI=".concat(hasOpenAIKey, ", Gemini=").concat(hasGeminiKey));
        // 設定で明示的に指定されている場合はそれを優先
        var configuredProvider = config.get('llm.provider');
        if (configuredProvider) {
            console.log("\uD83D\uDCCB Using configured provider: ".concat(configuredProvider));
            return configuredProvider;
        }
        // APIキーの有無で自動選択
        if (hasGeminiKey && !hasOpenAIKey) {
            return 'gemini';
        }
        // デフォルトはOpenAI
        return 'openai';
    };
    return LLMClientFactory;
}());
exports.LLMClientFactory = LLMClientFactory;
exports.default = LLMClientFactory;
