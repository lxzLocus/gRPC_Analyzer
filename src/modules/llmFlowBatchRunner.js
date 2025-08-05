"use strict";
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
exports.runForAllDatasets = runForAllDatasets;
var fs_1 = require("fs");
var path_1 = require("path");
var dotenv_1 = require("dotenv");
var llmFlowController_js_1 = require("./llmFlowController.js");
// 既存の環境変数をクリア（他の設定が残っている場合）
delete process.env.OPENAI_TOKEN;
delete process.env.OPENAI_API_KEY;
// .envファイルを読み込み
(0, dotenv_1.config)({ path: path_1.default.join(process.cwd(), '.env') });
// グレースフルシャットダウンの実装
var isShuttingDown = false;
var gracefulShutdown = function (signal) {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    console.log("\uD83D\uDCE1 Received ".concat(signal, ". Starting graceful shutdown..."));
    // リソースのクリーンアップ
    console.log('🧹 Cleaning up resources...');
    // ガベージコレクション強制実行
    if (global.gc) {
        console.log('🗑️ Running garbage collection...');
        global.gc();
    }
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
    gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', function (reason, promise) {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});
if (import.meta.url === "file://".concat(process.argv[1])) {
    /*config*/
    var datasetDir_1 = "/app/dataset/test";
    (function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, runForAllDatasets(datasetDir_1)];
                case 1:
                    _a.sent();
                    console.log("✅ Batch processing completed.");
                    // 明示的なクリーンアップ
                    if (global.gc) {
                        console.log('🗑️ Final garbage collection...');
                        global.gc();
                    }
                    // 正常終了
                    process.exit(0);
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    console.error("❌ Error in batch processing:", error_1);
                    gracefulShutdown('error');
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); })();
}
/**
 * 指定したデータセットディレクトリ配下の全てのpullrequest/issueごとに
 * LLMFlowControllerのバグ修正フローを実行するバッチランナー
 * @param datasetDir 例: /app/dataset/filtered_commit や /app/dataset/test
 */
function runForAllDatasets(datasetDir) {
    return __awaiter(this, void 0, void 0, function () {
        var datasetDirs, _loop_1, _i, datasetDirs_1, repositoryName;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    datasetDirs = fs_1.default.readdirSync(datasetDir).filter(function (dir) { return fs_1.default.statSync(path_1.default.join(datasetDir, dir)).isDirectory(); });
                    _loop_1 = function (repositoryName) {
                        var savedRepositoryPath, categoryDirs, _loop_2, _b, categoryDirs_1, category;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    savedRepositoryPath = path_1.default.join(datasetDir, repositoryName);
                                    categoryDirs = [];
                                    try {
                                        categoryDirs = fs_1.default.readdirSync(savedRepositoryPath).filter(function (dir) { return fs_1.default.statSync(path_1.default.join(savedRepositoryPath, dir)).isDirectory(); });
                                    }
                                    catch (err) {
                                        console.error("\u274C Error reading category directories in ".concat(savedRepositoryPath, ":"), err.message);
                                        return [2 /*return*/, "continue"];
                                    }
                                    _loop_2 = function (category) {
                                        var categoryPath, titleDirs, _loop_3, _d, titleDirs_1, pullRequestTitle;
                                        return __generator(this, function (_e) {
                                            switch (_e.label) {
                                                case 0:
                                                    categoryPath = path_1.default.join(savedRepositoryPath, category);
                                                    titleDirs = fs_1.default.readdirSync(categoryPath).filter(function (dir) { return fs_1.default.statSync(path_1.default.join(categoryPath, dir)).isDirectory(); });
                                                    _loop_3 = function (pullRequestTitle) {
                                                        var pullRequestPath, premergeDir, controller;
                                                        return __generator(this, function (_f) {
                                                            switch (_f.label) {
                                                                case 0:
                                                                    pullRequestPath = path_1.default.join(categoryPath, pullRequestTitle);
                                                                    premergeDir = fs_1.default.readdirSync(pullRequestPath)
                                                                        .map(function (dir) { return path_1.default.join(pullRequestPath, dir); })
                                                                        .find(function (filePath) { return fs_1.default.statSync(filePath).isDirectory() && path_1.default.basename(filePath).startsWith('premerge'); });
                                                                    if (!premergeDir) {
                                                                        console.warn("No premerge directory found in ".concat(pullRequestPath));
                                                                        return [2 /*return*/, "continue"];
                                                                    }
                                                                    // 各プルリクエストの premerge ディレクトリを引数に渡して
                                                                    // LLMFlowControllerのインスタンスを生成する
                                                                    console.log("\uD83D\uDD04 Processing ".concat(pullRequestPath, "..."));
                                                                    controller = new llmFlowController_js_1.default(premergeDir);
                                                                    // run()を実行
                                                                    return [4 /*yield*/, controller.run()];
                                                                case 1:
                                                                    // run()を実行
                                                                    _f.sent();
                                                                    return [2 /*return*/];
                                                            }
                                                        });
                                                    };
                                                    _d = 0, titleDirs_1 = titleDirs;
                                                    _e.label = 1;
                                                case 1:
                                                    if (!(_d < titleDirs_1.length)) return [3 /*break*/, 4];
                                                    pullRequestTitle = titleDirs_1[_d];
                                                    return [5 /*yield**/, _loop_3(pullRequestTitle)];
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
                                    return [5 /*yield**/, _loop_2(category)];
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
                    _i = 0, datasetDirs_1 = datasetDirs;
                    _a.label = 1;
                case 1:
                    if (!(_i < datasetDirs_1.length)) return [3 /*break*/, 4];
                    repositoryName = datasetDirs_1[_i];
                    return [5 /*yield**/, _loop_1(repositoryName)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
