"use strict";
/*
Docs

プロンプトに埋め込むための，txtファイルを出力するプログラム

対象
- 01_proto.txt
- 02_protoFileChanges.txt
- 03_fileChanges.txt
- 04_surroundedFilePath.txt
- 05_suspectedFiles.txt


リストとその内容
- 01_proto.txt

Diff
- 02_protoFileChanges.txt

変更されたファイルのリストのみ　　[と，その内容（premerge）]
- 03_fileChanges.txt

proto&自動生成ファイル，上下探索を含むディレクトリ構造
- 04_surroundedFilePath.txt

疑わしいファイルのリスト（手書きコードの可能性があるもの）
- 05_suspectedFiles.txt
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
exports.main = main;
/*modules*/
var fs_1 = require("fs");
var path_1 = require("path");
// @ts-ignore: JS モジュールのため型チェックを無視
var generateFilePathContent_js_1 = require("../modules/generateFilePathContent.js");
// @ts-ignore: JS モジュールのため型チェックを無視
var generateContentDiff_js_1 = require("../modules/generateContentDiff.js");
// @ts-ignore: JS モジュールのため型チェックを無視
var generateFileChanged_js_1 = require("../modules/generateFileChanged.js");
// @ts-ignore: JS モジュールのため型チェックを無視
var generateDirPathLists_js_1 = require("../modules/generateDirPathLists.js");
/*config*/
var datasetDir = '/app/dataset/filtered_fewChanged';
/* __MAIN__ */
// main処理をasync関数でラップ
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var projectDirs, _loop_1, _i, projectDirs_1, projectName;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    projectDirs = fs_1.default.readdirSync(datasetDir).filter(function (dir) { return fs_1.default.statSync(path_1.default.join(datasetDir, dir)).isDirectory(); });
                    _loop_1 = function (projectName) {
                        var projectPath, categoryDirs, _loop_2, _d, categoryDirs_1, category;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    projectPath = path_1.default.join(datasetDir, projectName);
                                    categoryDirs = [];
                                    try {
                                        categoryDirs = fs_1.default.readdirSync(projectPath).filter(function (dir) { return fs_1.default.statSync(path_1.default.join(projectPath, dir)).isDirectory(); });
                                    }
                                    catch (err) {
                                        console.error("\u274C Error reading category directories in ".concat(projectPath, ":"), err.message);
                                        return [2 /*return*/, "continue"];
                                    }
                                    _loop_2 = function (category) {
                                        var categoryPath, titleDirs, _loop_3, _f, titleDirs_1, pullRequestTitle;
                                        return __generator(this, function (_g) {
                                            switch (_g.label) {
                                                case 0:
                                                    categoryPath = path_1.default.join(projectPath, category);
                                                    titleDirs = fs_1.default.readdirSync(categoryPath).filter(function (dir) { return fs_1.default.statSync(path_1.default.join(categoryPath, dir)).isDirectory(); });
                                                    _loop_3 = function (pullRequestTitle) {
                                                        /**
                                                         * protoファイル内容からimport文を抽出する
                                                         * @param {string} content - protoファイルの内容
                                                         * @returns {string[]} - importされているファイルパスのリスト
                                                         */
                                                        function extractImports(content) {
                                                            var imports = [];
                                                            var lines = content.split('\n');
                                                            for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                                                                var line = lines_1[_i];
                                                                var trimmed = line.trim();
                                                                // import "path/to/file.proto"; の形式を検出
                                                                var match = trimmed.match(/^\s*import\s+["']([^"']+\.proto)["']\s*;?/);
                                                                if (match) {
                                                                    imports.push(match[1]);
                                                                }
                                                            }
                                                            return imports;
                                                        }
                                                        // ステップC': LLM向け「要約構造」を生成
                                                        /**
                                                         * LLM初期入力用の要約構造を生成
                                                         * - トップレベルディレクトリ一覧
                                                         * - 変更ファイル近傍のみ展開（maxDepth階層まで）
                                                         * @param fullStructure フル構造
                                                         * @param changedFiles 変更ファイルリスト
                                                         * @param maxDepth 展開する最大深度（デフォルト3）
                                                         */
                                                        function buildLLMSummaryStructure(fullStructure, changedFiles, maxDepth) {
                                                            if (maxDepth === void 0) { maxDepth = 3; }
                                                            var summary = {};
                                                            // トップレベルディレクトリをfullStructureから取得
                                                            var topLevelDirsSet = new Set();
                                                            // fullStructureの全トップレベルキー（ディレクトリのみ）を追加
                                                            if (fullStructure && typeof fullStructure === 'object') {
                                                                Object.keys(fullStructure).forEach(function (key) {
                                                                    // ディレクトリのみを追加（値がnullでないもの=オブジェクトであるもの）
                                                                    if (fullStructure[key] !== null && typeof fullStructure[key] === 'object') {
                                                                        topLevelDirsSet.add(key);
                                                                    }
                                                                });
                                                            }
                                                            // 念のため変更ファイルからも抽出（fullStructureに含まれていない場合のフォールバック）
                                                            changedFiles.forEach(function (f) {
                                                                var firstDir = f.split('/')[0];
                                                                if (firstDir) {
                                                                    topLevelDirsSet.add(firstDir);
                                                                }
                                                            });
                                                            summary.top_level = Array.from(topLevelDirsSet).sort();
                                                            // 変更点近傍の骨格を構築（パスのみ、深さmaxDepthまで）
                                                            summary.near_changed = {};
                                                            changedFiles.forEach(function (filePath) {
                                                                var parts = filePath.split('/');
                                                                var currentLevel = summary.near_changed;
                                                                // maxDepth階層まで、またはファイルの親ディレクトリまで
                                                                var depth = Math.min(maxDepth, parts.length - 1);
                                                                for (var i = 0; i < depth; i++) {
                                                                    var part = parts[i];
                                                                    if (!currentLevel[part]) {
                                                                        currentLevel[part] = {};
                                                                    }
                                                                    currentLevel = currentLevel[part];
                                                                }
                                                            });
                                                            // LLMへの明示的な注記
                                                            summary.note = "Partial project map focused on changed areas. Other directories exist at top_level. Use %_Reply Required_% for deeper exploration.";
                                                            return summary;
                                                        }
                                                        // --- ステップ2: 新スコアリングロジックの実装 ---
                                                        /**
                                                         * .protoファイルの差分から、変更（追加/削除）されたメッセージ、サービス、RPC名などを抽出する
                                                         * @param {string} protoDiffContent - 02_protoFileChanges.txt の内容
                                                         * @returns {string[]} - 抽出された名前のリスト (e.g., ["Secrets", "GetSecrets"])
                                                         */
                                                        function extractNamesFromProtoDiff(protoDiffContent) {
                                                            var names = new Set();
                                                            var regex = /^\s*(?:message|service|rpc)\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
                                                            // 差分（+または-で始まる行）のみを対象
                                                            var changedLines = protoDiffContent.split('\n').filter(function (line) { return line.startsWith('+') || line.startsWith('-'); });
                                                            for (var _i = 0, changedLines_1 = changedLines; _i < changedLines_1.length; _i++) {
                                                                var line = changedLines_1[_i];
                                                                var match = void 0;
                                                                while ((match = regex.exec(line)) !== null) {
                                                                    names.add(match[1]);
                                                                }
                                                            }
                                                            return Array.from(names);
                                                        }
                                                        var pullRequestPath, premergePath, mergePath, allProtoContentList, changedProtoFiles, changedFilesResult, importedProtoFiles, _loop_4, _h, changedProtoFiles_1, changedProtoFile, relevantProtoFiles, otherProtoFilePaths, _loop_5, _j, _k, protoInfo, protoOutput, protoFilePath, diffResults, protoFileChangesPath, _l, diffResults_1, result, error_1, changedFiles, fileChangesPath, GRPC_KEYWORDS, GRPC_GEN_PATTERNS, EXCLUDED_PATTERNS, isGeneratedFile, isTestFile, isExcludedFile, protoFiles, generatedFiles, handwrittenFiles, entries, projectRootDirs, finalProjectStructure, _m, projectRootDirs_1, dir, dirPath, structure, key, llmSummaryStructure, masterOutput, structureFilePath, diffsOfHandwrittenFiles, protoDiffContent, changedProtoNames, calculateSuspicionScore, scoredFiles, outputLines, finalOutputText, suspectedFilesPath;
                                                        return __generator(this, function (_o) {
                                                            switch (_o.label) {
                                                                case 0:
                                                                    pullRequestPath = path_1.default.join(categoryPath, pullRequestTitle);
                                                                    console.log("Processing: ".concat(projectName, "/").concat(pullRequestTitle));
                                                                    premergePath = fs_1.default.readdirSync(pullRequestPath)
                                                                        .map(function (dir) { return path_1.default.join(pullRequestPath, dir); }) // フルパスに変換
                                                                        .find(function (filePath) { return fs_1.default.statSync(filePath).isDirectory() && path_1.default.basename(filePath).startsWith('premerge'); });
                                                                    mergePath = fs_1.default.readdirSync(pullRequestPath)
                                                                        .map(function (dir) { return path_1.default.join(pullRequestPath, dir); })
                                                                        .find(function (filePath) { return fs_1.default.statSync(filePath).isDirectory() && path_1.default.basename(filePath).startsWith('merge'); });
                                                                    // "merge_"がなければ"commit_snapshot_"を探す
                                                                    if (!mergePath) {
                                                                        mergePath = fs_1.default.readdirSync(pullRequestPath)
                                                                            .map(function (dir) { return path_1.default.join(pullRequestPath, dir); })
                                                                            .find(function (filePath) { return fs_1.default.statSync(filePath).isDirectory() && path_1.default.basename(filePath).startsWith('commit_snapshot_'); });
                                                                    }
                                                                    // ========================================================================
                                                                    // 01_proto.txt の処理
                                                                    // ========================================================================
                                                                    if (!premergePath) {
                                                                        console.error('Premerge path not found, skipping processing');
                                                                        return [2 /*return*/, "continue"];
                                                                    }
                                                                    allProtoContentList = (0, generateFilePathContent_js_1.default)(premergePath, '.proto');
                                                                    console.log('allProtoContentList structure:', allProtoContentList);
                                                                    changedProtoFiles = [];
                                                                    if (!(premergePath && mergePath)) return [3 /*break*/, 2];
                                                                    return [4 /*yield*/, (0, generateFileChanged_js_1.default)(premergePath, mergePath, '')];
                                                                case 1:
                                                                    changedFilesResult = _o.sent();
                                                                    changedProtoFiles.push.apply(changedProtoFiles, changedFilesResult.filter(function (file) { return file.endsWith('.proto'); }));
                                                                    _o.label = 2;
                                                                case 2:
                                                                    console.log('Changed Proto Files:', changedProtoFiles);
                                                                    importedProtoFiles = new Set();
                                                                    _loop_4 = function (changedProtoFile) {
                                                                        var protoInfo = (_a = allProtoContentList.proto_files) === null || _a === void 0 ? void 0 : _a.find(function (proto) { return proto.path === changedProtoFile; });
                                                                        if (protoInfo) {
                                                                            var imports = extractImports(protoInfo.content);
                                                                            imports.forEach(function (importPath) {
                                                                                // 相対パスを正規化して追加
                                                                                var normalizedPath = path_1.default.normalize(importPath).replace(/\\/g, '/');
                                                                                importedProtoFiles.add(normalizedPath);
                                                                            });
                                                                        }
                                                                    };
                                                                    // 変更されたprotoファイルの内容を読み込み、import文を解析
                                                                    for (_h = 0, changedProtoFiles_1 = changedProtoFiles; _h < changedProtoFiles_1.length; _h++) {
                                                                        changedProtoFile = changedProtoFiles_1[_h];
                                                                        _loop_4(changedProtoFile);
                                                                    }
                                                                    console.log('Imported Proto Files:', Array.from(importedProtoFiles));
                                                                    relevantProtoFiles = [];
                                                                    otherProtoFilePaths = [];
                                                                    if (allProtoContentList.proto_files) {
                                                                        _loop_5 = function (protoInfo) {
                                                                            var filePath = protoInfo.path;
                                                                            var normalizedPath = path_1.default.normalize(filePath).replace(/\\/g, '/');
                                                                            // 変更されたファイルまたはimportされたファイルかチェック
                                                                            var isChanged = changedProtoFiles.includes(filePath);
                                                                            var isImported = importedProtoFiles.has(normalizedPath) ||
                                                                                importedProtoFiles.has(filePath) ||
                                                                                Array.from(importedProtoFiles).some(function (importPath) {
                                                                                    return normalizedPath.endsWith(importPath) || filePath.endsWith(importPath);
                                                                                });
                                                                            if (isChanged || isImported) {
                                                                                // フル内容を含める
                                                                                relevantProtoFiles.push({
                                                                                    path: filePath,
                                                                                    content: protoInfo.content,
                                                                                    reason: isChanged ? 'changed' : 'imported'
                                                                                });
                                                                            }
                                                                            else {
                                                                                // パスのみ
                                                                                otherProtoFilePaths.push(filePath);
                                                                            }
                                                                        };
                                                                        for (_j = 0, _k = allProtoContentList.proto_files; _j < _k.length; _j++) {
                                                                            protoInfo = _k[_j];
                                                                            _loop_5(protoInfo);
                                                                        }
                                                                    }
                                                                    protoOutput = {
                                                                        relevant_proto_files: relevantProtoFiles,
                                                                        other_proto_file_paths: otherProtoFilePaths,
                                                                        summary: {
                                                                            total_proto_files: (((_b = allProtoContentList.proto_files) === null || _b === void 0 ? void 0 : _b.length) || 0),
                                                                            relevant_files_count: relevantProtoFiles.length,
                                                                            other_files_count: otherProtoFilePaths.length,
                                                                            changed_files_count: changedProtoFiles.length,
                                                                            imported_files_count: importedProtoFiles.size
                                                                        }
                                                                    };
                                                                    protoFilePath = path_1.default.join(pullRequestPath, '01_proto.txt');
                                                                    // 既存のファイルがあれば削除
                                                                    if (fs_1.default.existsSync(protoFilePath)) {
                                                                        fs_1.default.unlinkSync(protoFilePath);
                                                                    }
                                                                    fs_1.default.writeFileSync(protoFilePath, JSON.stringify(protoOutput, null, 2), 'utf8');
                                                                    console.log("Generated optimized proto file list: ".concat(relevantProtoFiles.length, " full content files, ").concat(otherProtoFilePaths.length, " path-only files"));
                                                                    _o.label = 3;
                                                                case 3:
                                                                    _o.trys.push([3, 5, , 6]);
                                                                    if (!premergePath || !mergePath) {
                                                                        console.error('Premerge or merge path not found for proto file changes');
                                                                        return [2 /*return*/, "continue"];
                                                                    }
                                                                    return [4 /*yield*/, (0, generateContentDiff_js_1.getFilesDiff)(premergePath, mergePath, 'proto')];
                                                                case 4:
                                                                    diffResults = _o.sent();
                                                                    protoFileChangesPath = path_1.default.join(pullRequestPath, '02_protoFileChanges.txt');
                                                                    if (diffResults.length > 0) {
                                                                        // 既存のファイルがあれば削除
                                                                        if (fs_1.default.existsSync(protoFileChangesPath)) {
                                                                            fs_1.default.unlinkSync(protoFileChangesPath);
                                                                        }
                                                                        // 新しいファイルを作成
                                                                        for (_l = 0, diffResults_1 = diffResults; _l < diffResults_1.length; _l++) {
                                                                            result = diffResults_1[_l];
                                                                            try {
                                                                                fs_1.default.appendFileSync(protoFileChangesPath, result.diff + '\n', 'utf8');
                                                                            }
                                                                            catch (error) {
                                                                                console.error("Error appending to file: ".concat(protoFileChangesPath), error);
                                                                            }
                                                                        }
                                                                    }
                                                                    else {
                                                                        // 既存のファイルがあれば削除
                                                                        if (fs_1.default.existsSync(protoFileChangesPath)) {
                                                                            fs_1.default.unlinkSync(protoFileChangesPath);
                                                                        }
                                                                        // 新しいファイルを作成
                                                                        try {
                                                                            fs_1.default.appendFileSync(protoFileChangesPath, '', 'utf8'); // 空の文字列を渡す
                                                                        }
                                                                        catch (error) {
                                                                            console.error("Error appending to file: ".concat(protoFileChangesPath), error);
                                                                        }
                                                                        console.log('No proto file changes detected, no file created.');
                                                                    }
                                                                    return [3 /*break*/, 6];
                                                                case 5:
                                                                    error_1 = _o.sent();
                                                                    console.error("Error processing proto file changes: ".concat(error_1.message));
                                                                    return [3 /*break*/, 6];
                                                                case 6:
                                                                    // ========================================================================
                                                                    // 03_fileChanges.txt の処理
                                                                    // ========================================================================
                                                                    if (!premergePath || !mergePath) {
                                                                        console.error('Premerge or merge path not found for file changes');
                                                                        return [2 /*return*/, "continue"];
                                                                    }
                                                                    return [4 /*yield*/, (0, generateFileChanged_js_1.default)(premergePath, mergePath, '')];
                                                                case 7:
                                                                    changedFiles = _o.sent();
                                                                    console.log('Changed Files:', changedFiles); // デバッグ用
                                                                    fileChangesPath = path_1.default.join(pullRequestPath, '03_fileChanges.txt');
                                                                    // 既存のファイルがあれば削除
                                                                    if (fs_1.default.existsSync(fileChangesPath)) {
                                                                        fs_1.default.unlinkSync(fileChangesPath);
                                                                    }
                                                                    fs_1.default.writeFileSync(fileChangesPath, JSON.stringify(changedFiles, null, 2), 'utf8');
                                                                    GRPC_KEYWORDS = ['service', 'client', 'server', 'handler', 'rpc', 'impl'];
                                                                    GRPC_GEN_PATTERNS = ['.pb.', '_pb2.', '.pb2.', '.pb.go', '.pb.cc', '.pb.h', '.pb.rb', '.pb.swift', '.pb.m', '.pb-c.', '.pb-c.h', '.pb-c.c'];
                                                                    EXCLUDED_PATTERNS = ['.md', '.markdown', '.log', '.lock', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 'Dockerfile', 'docker-compose.yml', '.dockerignore', 'LICENSE', '.github/', '.circleci/', '.vscode/', 'docs/'];
                                                                    isGeneratedFile = function (filePath) { return GRPC_GEN_PATTERNS.some(function (pat) { return filePath.includes(pat); }); };
                                                                    isTestFile = function (filePath) { return filePath.toLowerCase().includes('test'); };
                                                                    isExcludedFile = function (filePath) { return EXCLUDED_PATTERNS.some(function (pat) { return filePath.includes(pat); }); };
                                                                    protoFiles = [];
                                                                    generatedFiles = [];
                                                                    handwrittenFiles = [];
                                                                    changedFiles.forEach(function (file) {
                                                                        if (file.endsWith('.proto')) {
                                                                            protoFiles.push(file);
                                                                        }
                                                                        else if (isGeneratedFile(file)) {
                                                                            generatedFiles.push(file);
                                                                        }
                                                                        else if (!isExcludedFile(file) && !isTestFile(file)) {
                                                                            handwrittenFiles.push(file);
                                                                        }
                                                                    });
                                                                    console.log('Categorized Proto Files:', protoFiles);
                                                                    console.log('Categorized Generated Files:', generatedFiles);
                                                                    console.log('Categorized Handwritten Files:', handwrittenFiles);
                                                                    entries = fs_1.default.readdirSync(pullRequestPath);
                                                                    projectRootDirs = entries.filter(function (entry) {
                                                                        var fullPath = path_1.default.join(pullRequestPath, entry);
                                                                        return fs_1.default.statSync(fullPath).isDirectory() &&
                                                                            (entry.startsWith('commit_snapshot_') || entry.startsWith('merge_') || entry.startsWith('premerge'));
                                                                    });
                                                                    finalProjectStructure = {};
                                                                    for (_m = 0, projectRootDirs_1 = projectRootDirs; _m < projectRootDirs_1.length; _m++) {
                                                                        dir = projectRootDirs_1[_m];
                                                                        dirPath = path_1.default.join(pullRequestPath, dir);
                                                                        structure = (0, generateDirPathLists_js_1.default)(dirPath);
                                                                        // 構造を直接マージ
                                                                        for (key in structure) {
                                                                            if (!finalProjectStructure[key]) {
                                                                                finalProjectStructure[key] = structure[key];
                                                                            }
                                                                        }
                                                                    }
                                                                    llmSummaryStructure = buildLLMSummaryStructure(finalProjectStructure, changedFiles, 3 // 変更点から3階層まで展開
                                                                    );
                                                                    masterOutput = {
                                                                        "directory_structure": llmSummaryStructure, // ← 要約構造を使用
                                                                        "categorized_changed_files": {
                                                                            "proto_files": protoFiles,
                                                                            "generated_files": generatedFiles,
                                                                            "handwritten_files": handwrittenFiles
                                                                        }
                                                                    };
                                                                    structureFilePath = path_1.default.join(pullRequestPath, '04_surroundedFilePath.txt');
                                                                    if (fs_1.default.existsSync(structureFilePath)) {
                                                                        fs_1.default.unlinkSync(structureFilePath);
                                                                    }
                                                                    fs_1.default.writeFileSync(structureFilePath, JSON.stringify(masterOutput, null, 2), 'utf8');
                                                                    console.log("Generated final data at: ".concat(structureFilePath));
                                                                    return [4 /*yield*/, (0, generateContentDiff_js_1.getDiffsForSpecificFiles)(handwrittenFiles, premergePath, mergePath)];
                                                                case 8:
                                                                    diffsOfHandwrittenFiles = _o.sent();
                                                                    protoDiffContent = fs_1.default.readFileSync(path_1.default.join(pullRequestPath, '02_protoFileChanges.txt'), 'utf8');
                                                                    changedProtoNames = extractNamesFromProtoDiff(protoDiffContent);
                                                                    console.log('Extracted names from proto diff:', changedProtoNames);
                                                                    calculateSuspicionScore = function (fileInfo, protoFileNames, changedProtoNames) {
                                                                        var score = 0;
                                                                        var relativePath = fileInfo.relativePath, diff = fileInfo.diff;
                                                                        var fileName = path_1.default.basename(relativePath);
                                                                        // ルール1: ファイル役割ボーナス
                                                                        if (fileName.endsWith('main.go') || fileName.endsWith('server.go') || fileName.endsWith('client.go') || fileName.endsWith('app.py') || fileName.endsWith('index.js')) {
                                                                            score += 20; // コアロジック
                                                                        }
                                                                        else if (relativePath.includes('deployment') || relativePath.endsWith('.yaml')) {
                                                                            score += 10; // K8sなどデプロイ関連
                                                                        }
                                                                        else if (fileName === 'Tiltfile' || fileName === 'Dockerfile') {
                                                                            score += 5; // 開発環境・ビルド関連
                                                                        }
                                                                        // ルール2: Proto関連度ボーナス
                                                                        // (A) ファイル名の一致
                                                                        var fileNameWithoutExt = path_1.default.parse(fileName).name;
                                                                        if (protoFileNames.some(function (protoFile) { return path_1.default.parse(protoFile).name === fileNameWithoutExt; })) {
                                                                            score += 15;
                                                                        }
                                                                        // (B) 内容の一致
                                                                        for (var _i = 0, changedProtoNames_1 = changedProtoNames; _i < changedProtoNames_1.length; _i++) {
                                                                            var protoName = changedProtoNames_1[_i];
                                                                            if (diff.includes(protoName)) {
                                                                                score += 30; // 内容に直接的な関連語があれば、非常に高いスコア
                                                                            }
                                                                        }
                                                                        // ルール3: 変更インパクトボーナス
                                                                        if (diff) {
                                                                            score += 5; // 差分が少しでもあれば、基礎点を与える
                                                                        }
                                                                        return score;
                                                                    };
                                                                    scoredFiles = diffsOfHandwrittenFiles.map(function (fileInfo) { return ({
                                                                        filePath: fileInfo.relativePath,
                                                                        score: calculateSuspicionScore(fileInfo, protoFiles, changedProtoNames),
                                                                        diff: fileInfo.diff
                                                                    }); });
                                                                    // スコアの高い順にソート
                                                                    scoredFiles.sort(function (a, b) { return b.score - a.score; });
                                                                    outputLines = [];
                                                                    scoredFiles.forEach(function (file, index) {
                                                                        var rank = index + 1;
                                                                        // --- ヘッダー部分 ---
                                                                        // 全てのファイルに共通で出力
                                                                        //outputLines.push(`Rank: ${rank}`);
                                                                        //outputLines.push(`Score: ${file.score}`);
                                                                        //outputLines.push(`File: ${file.filePath}`);
                                                                        // --- 内容部分 ---
                                                                        // 上位3位までのファイルのみ、変更前の内容を出力
                                                                        if (rank <= 3 && premergePath) {
                                                                            var premergeFilePath = path_1.default.join(premergePath, file.filePath);
                                                                            if (fs_1.default.existsSync(premergeFilePath)) {
                                                                                try {
                                                                                    var content = fs_1.default.readFileSync(premergeFilePath, 'utf8');
                                                                                    // unix diff ライクなヘッダー
                                                                                    outputLines.push("--- /".concat(file.filePath));
                                                                                    outputLines.push(content);
                                                                                }
                                                                                catch (e) {
                                                                                    console.error("Error reading file content for ".concat(premergeFilePath, ":"), e.message);
                                                                                    outputLines.push("<< Error reading file content >>");
                                                                                }
                                                                            }
                                                                            else {
                                                                                outputLines.push("<< File content not found in premerge directory >>");
                                                                            }
                                                                        }
                                                                        // 各エントリ間にセパレータを挿入
                                                                        //outputLines.push('---');
                                                                    });
                                                                    finalOutputText = outputLines.join('\n');
                                                                    // 手書きファイルが存在しない場合の説明メッセージ
                                                                    if (handwrittenFiles.length === 0) {
                                                                        finalOutputText = "No handwritten files found. Only auto-generated files were modified.\n\nIn this pull request, only .proto files and their auto-generated files (.pb.go, etc.) \nwere modified. No handwritten code files were changed.\nTherefore, no suspected handwritten files exist for analysis.\n\nFile categorization of changes:\n- Proto files: .proto files\n- Generated files: Files matching patterns like .pb.go, .pb.cc, .pb.h, etc.\n- Handwritten files: None (excluding excluded files, test files, and auto-generated files)";
                                                                    }
                                                                    suspectedFilesPath = path_1.default.join(pullRequestPath, '05_suspectedFiles.txt');
                                                                    fs_1.default.writeFileSync(suspectedFilesPath, finalOutputText, 'utf8');
                                                                    console.log("Generated final suspected files list at: ".concat(suspectedFilesPath));
                                                                    return [2 /*return*/];
                                                            }
                                                        });
                                                    };
                                                    _f = 0, titleDirs_1 = titleDirs;
                                                    _g.label = 1;
                                                case 1:
                                                    if (!(_f < titleDirs_1.length)) return [3 /*break*/, 4];
                                                    pullRequestTitle = titleDirs_1[_f];
                                                    return [5 /*yield**/, _loop_3(pullRequestTitle)];
                                                case 2:
                                                    _g.sent();
                                                    _g.label = 3;
                                                case 3:
                                                    _f++;
                                                    return [3 /*break*/, 1];
                                                case 4: return [2 /*return*/];
                                            }
                                        });
                                    };
                                    _d = 0, categoryDirs_1 = categoryDirs;
                                    _e.label = 1;
                                case 1:
                                    if (!(_d < categoryDirs_1.length)) return [3 /*break*/, 4];
                                    category = categoryDirs_1[_d];
                                    return [5 /*yield**/, _loop_2(category)];
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
                    _i = 0, projectDirs_1 = projectDirs;
                    _c.label = 1;
                case 1:
                    if (!(_i < projectDirs_1.length)) return [3 /*break*/, 4];
                    projectName = projectDirs_1[_i];
                    return [5 /*yield**/, _loop_1(projectName)];
                case 2:
                    _c.sent();
                    _c.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// スクリプトが直接実行された場合にmain関数を呼び出す
if (import.meta.url === "file://".concat(process.argv[1])) {
    main().catch(function (err) {
        console.error("An unexpected error occurred in main process:", err);
    });
}
