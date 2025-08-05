"use strict";
/**
 * メッセージ処理クラス
 * LLMとの会話とレスポンス解析を担当
 */
Object.defineProperty(exports, "__esModule", { value: true });
var MessageHandler = /** @class */ (function () {
    function MessageHandler() {
        this.messagesTemplate = [
            {
                role: 'system',
                content: "Fix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections."
            }
        ];
    }
    MessageHandler.prototype.attachMessages = function (role, messages) {
        // 新しいメッセージをテンプレートに追加
        this.messagesTemplate.push({
            role: role,
            content: messages
        });
        return this.messagesTemplate;
    };
    MessageHandler.prototype.analyzeMessages = function (messages) {
        var sections = {
            thought: null,
            plan: null,
            requiredFilepaths: [],
            requiredFileInfos: [], // 新しいフィールド
            modifiedDiff: '',
            commentText: '',
            has_fin_tag: false
        };
        // 生JSONの検出と直接処理
        var trimmedMessages = messages.trim();
        if ((trimmedMessages.startsWith('[') && trimmedMessages.endsWith(']')) ||
            (trimmedMessages.startsWith('{') && trimmedMessages.endsWith('}'))) {
            // JSON構造の指標をチェック
            var hasFileIndicators = trimmedMessages.includes('"path"') ||
                trimmedMessages.includes('"filePath"') ||
                trimmedMessages.includes('"action"');
            if (hasFileIndicators) {
                console.log('🔍 Detected standalone JSON with file indicators, processing directly...');
                try {
                    var parsed = JSON.parse(trimmedMessages);
                    if (Array.isArray(parsed)) {
                        var processedPaths = new Set(); // 重複を避けるため
                        for (var _i = 0, parsed_1 = parsed; _i < parsed_1.length; _i++) {
                            var item = parsed_1[_i];
                            if (typeof item === 'object' && (item.path || item.filePath)) {
                                var path = item.path || item.filePath;
                                // 重複チェック
                                if (!processedPaths.has(path)) {
                                    processedPaths.add(path);
                                    var fileInfo = {
                                        type: item.type === 'DIRECTORY_LISTING' ? 'DIRECTORY_LISTING' : 'FILE_CONTENT',
                                        path: path
                                    };
                                    sections.requiredFileInfos.push(fileInfo);
                                    sections.requiredFilepaths.push(path);
                                    console.log("\uD83D\uDCC4 Added file from standalone JSON: ".concat(path, " (").concat(fileInfo.type, ")"));
                                }
                                else {
                                    console.log("\u26A0\uFE0F Skipped duplicate file: ".concat(path));
                                }
                            }
                        }
                    }
                    // JSONがプランとして解釈できる場合はplanにも格納
                    if (parsed.length > 0 && parsed.every(function (item) { return item.action || item.step; })) {
                        sections.plan = JSON.stringify(parsed, null, 2);
                        console.log("\uD83D\uDCCB Stored JSON as plan with ".concat(parsed.length, " steps"));
                    }
                    console.log("\u2705 Standalone JSON processing completed. Extracted ".concat(sections.requiredFileInfos.length, " file(s)"));
                    return sections;
                }
                catch (jsonError) {
                    console.log("\u274C Failed to parse standalone JSON: ".concat(jsonError));
                    // タグベースの処理にフォールバック
                }
            }
        }
        // タグベースの処理（既存のロジック）
        var lines = messages.split('\n');
        var currentTag = null;
        var buffers = {
            thought: [],
            plan: [],
            modified: [],
            comment: [],
            required: []
        };
        for (var _a = 0, lines_1 = lines; _a < lines_1.length; _a++) {
            var line = lines_1[_a];
            var trimmed = line.trim();
            // 新しいタグ形式をサポート: %_Thought_%, %_Plan_%, %_Reply Required_%, %_Modified_%
            var tagMatch = trimmed.match(/^%_(.+?)_%$/);
            if (tagMatch) {
                var tagName = tagMatch[1];
                // タグ名の正規化
                if (tagName === 'Thought') {
                    currentTag = 'thought';
                }
                else if (tagName === 'Plan') {
                    currentTag = 'plan';
                }
                else if (tagName === 'Reply Required') {
                    currentTag = 'required';
                }
                else if (tagName === 'Modified') {
                    currentTag = 'modified';
                }
                else if (tagName === 'Comment') {
                    currentTag = 'comment';
                }
                else {
                    // 従来形式のサポート（小文字変換）
                    currentTag = tagName.toLowerCase().replace(/ /g, '_');
                    if (currentTag !== 'modified' && currentTag !== 'comment' && currentTag !== 'thought' && currentTag !== 'plan') {
                        currentTag = 'required'; // その他は required として扱う
                    }
                }
                console.log("\uD83C\uDFF7\uFE0F Detected tag: ".concat(tagName, " -> ").concat(currentTag));
                continue;
            }
            else if (trimmed === '%%_Fin_%%') {
                sections.has_fin_tag = true;
                console.log('🏁 Found %%_Fin_%% tag');
                break;
            }
            if (currentTag) {
                if (currentTag === 'required') {
                    // すべてのrequiredラインをバッファに追加（後で統一的に処理）
                    if (!buffers.required) {
                        buffers.required = [];
                    }
                    buffers.required.push(line);
                }
                else if (buffers[currentTag]) {
                    buffers[currentTag].push(line);
                }
            }
        }
        sections.thought = buffers.thought.join('\n').trim() || null;
        sections.plan = buffers.plan.join('\n').trim() || null;
        sections.modifiedDiff = buffers.modified.join('\n').trim();
        sections.commentText = buffers.comment.join('\n').trim();
        // プランセクションからファイル要求を自動抽出
        if (sections.plan && !sections.requiredFileInfos.length) {
            console.log('🔍 Extracting file requests from plan section...');
            this.extractFileRequestsFromPlan(sections.plan, sections);
        }
        // Required filesの後処理（統一的な解析）
        console.log('📊 Buffer contents summary:');
        console.log('  - thought:', buffers.thought.length, 'lines');
        console.log('  - plan:', buffers.plan.length, 'lines');
        console.log('  - modified:', buffers.modified.length, 'lines');
        console.log('  - comment:', buffers.comment.length, 'lines');
        console.log('  - required:', buffers.required.length, 'lines');
        if (buffers.required.length > 0) {
            console.log('📝 Required buffer first 3 lines:', buffers.required.slice(0, 3));
            console.log('📝 Required buffer last 3 lines:', buffers.required.slice(-3));
        }
        if (buffers.required && buffers.required.length > 0) {
            var requiredText = buffers.required.join('\n').trim();
            // デバッグ情報：解析対象のテキストを確認
            console.log('🔍 Required text to parse:', JSON.stringify(requiredText));
            console.log('🔍 Required text length:', requiredText.length);
            console.log('🔍 Required buffer length:', buffers.required.length);
            // 空文字列チェック
            if (!requiredText || requiredText.length === 0) {
                console.log('⚠️ Required text is empty, skipping parsing');
                return sections;
            }
            // まずJSON形式の判定を行う
            var trimmedText = requiredText.trim();
            console.log('🔍 JSON detection - trimmed length:', trimmedText.length);
            console.log('🔍 JSON detection - starts with:', JSON.stringify(trimmedText.substring(0, 20)));
            console.log('🔍 JSON detection - ends with:', JSON.stringify(trimmedText.substring(Math.max(0, trimmedText.length - 20))));
            // プレーンテキストの指示リストかチェック（JSON解析の前に実行）
            var isNumberedList = /^\s*\d+\.\s*/.test(trimmedText);
            var isBulletList = /^\s*[-*•]\s*/.test(trimmedText);
            var hasJSONStructure = /[\[\{]/.test(trimmedText) && /[\]\}]/.test(trimmedText);
            if ((isNumberedList || isBulletList) && !hasJSONStructure) {
                console.log('🔧 Detected plain text instruction list, skipping JSON parsing');
                console.log('📋 List content preview:', trimmedText.substring(0, 200) + '...');
                console.log('📋 List type:', isNumberedList ? 'numbered' : 'bullet');
                return sections; // プレーンテキストの場合は解析をスキップ
            }
            var startsWithJSON = trimmedText.startsWith('[') || trimmedText.startsWith('{');
            var endsWithJSON = trimmedText.endsWith(']') || trimmedText.endsWith('}');
            var hasJSONIndicators = trimmedText.includes('"path"') || trimmedText.includes('"type"');
            console.log('🔍 JSON detection - startsWithJSON:', startsWithJSON, 'endsWithJSON:', endsWithJSON, 'hasJSONIndicators:', hasJSONIndicators);
            var looksLikeJSON = (startsWithJSON && endsWithJSON) || hasJSONIndicators;
            if (looksLikeJSON) {
                console.log('🔄 Text appears to be JSON format, attempting JSON.parse...');
                console.log('📝 Text to parse (length:', requiredText.length, '):', requiredText.length > 200 ? requiredText.substring(0, 200) + '...' : requiredText);
                console.log('📝 Text starts with:', JSON.stringify(requiredText.substring(0, 50)));
                console.log('📝 Text ends with:', JSON.stringify(requiredText.substring(Math.max(0, requiredText.length - 50))));
                if (requiredText.length === 0) {
                    console.log('⚠️ Cannot parse empty text as JSON');
                    return sections;
                }
                try {
                    // JSON解析前の文字列クリーンアップ
                    var cleanedText = requiredText
                        .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // 全角スペースや特殊空白を通常スペースに変換
                        .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅文字を削除
                        .replace(/[""]/g, '"') // 全角クォートを半角に変換
                        .replace(/['']/g, "'") // 全角シングルクォートを半角に変換
                        .trim();
                    // マークダウンコードブロックの除去と JSON部分の抽出
                    cleanedText = cleanedText
                        .replace(/^```(?:json|javascript|js)?\s*\n?/i, '') // 開始コードブロック
                        .replace(/\n?```\s*$/i, '') // 終了コードブロック
                        .trim();
                    // JSON部分のみを抽出（複数の方法で試行）
                    var jsonText = cleanedText;
                    // 方法1: JSON配列またはオブジェクトの開始位置を探す
                    var jsonStartArray_1 = cleanedText.indexOf('[');
                    var jsonStartObject_1 = cleanedText.indexOf('{');
                    var jsonStart_1 = -1;
                    if (jsonStartArray_1 !== -1 && jsonStartObject_1 !== -1) {
                        jsonStart_1 = Math.min(jsonStartArray_1, jsonStartObject_1);
                    }
                    else if (jsonStartArray_1 !== -1) {
                        jsonStart_1 = jsonStartArray_1;
                    }
                    else if (jsonStartObject_1 !== -1) {
                        jsonStart_1 = jsonStartObject_1;
                    }
                    if (jsonStart_1 > 0) {
                        console.log('🔧 Found JSON start at position:', jsonStart_1);
                        jsonText = cleanedText.substring(jsonStart_1);
                        // 対応する終了位置を探す
                        var bracketCount = 0;
                        var inString = false;
                        var escapeNext = false;
                        var jsonEnd = -1;
                        var startChar = jsonText[0];
                        var endChar = startChar === '[' ? ']' : '}';
                        for (var i = 0; i < jsonText.length; i++) {
                            var char = jsonText[i];
                            if (escapeNext) {
                                escapeNext = false;
                                continue;
                            }
                            if (char === '\\') {
                                escapeNext = true;
                                continue;
                            }
                            if (char === '"' && !escapeNext) {
                                inString = !inString;
                                continue;
                            }
                            if (!inString) {
                                if (char === startChar) {
                                    bracketCount++;
                                }
                                else if (char === endChar) {
                                    bracketCount--;
                                    if (bracketCount === 0) {
                                        jsonEnd = i + 1;
                                        break;
                                    }
                                }
                            }
                        }
                        if (jsonEnd > 0) {
                            jsonText = jsonText.substring(0, jsonEnd);
                            console.log('🔧 Extracted JSON portion:', JSON.stringify(jsonText.substring(0, 100) + '...'));
                        }
                    }
                    console.log('🧹 Cleaned text for JSON parsing:', JSON.stringify(jsonText.substring(0, 100) + '...'));
                    var parsedRequired = JSON.parse(jsonText);
                    console.log('✅ JSON.parse successful, result:', parsedRequired);
                    if (Array.isArray(parsedRequired)) {
                        for (var _b = 0, parsedRequired_1 = parsedRequired; _b < parsedRequired_1.length; _b++) {
                            var item = parsedRequired_1[_b];
                            if (typeof item === 'object' && (item.path || item.filePath)) {
                                var path = item.path || item.filePath; // pathまたはfilePathフィールドをサポート
                                var fileInfo = {
                                    type: item.type === 'DIRECTORY_LISTING' ? 'DIRECTORY_LISTING' : 'FILE_CONTENT',
                                    path: path
                                };
                                sections.requiredFileInfos.push(fileInfo);
                                sections.requiredFilepaths.push(path);
                                console.log("\uD83D\uDCC4 Added file from JSON: ".concat(path, " (").concat(fileInfo.type, ")"));
                            }
                            else if (typeof item === 'string') {
                                var fileInfo = {
                                    type: 'FILE_CONTENT',
                                    path: item
                                };
                                sections.requiredFileInfos.push(fileInfo);
                                sections.requiredFilepaths.push(item);
                                console.log("\uD83D\uDCC4 Added file from JSON string: ".concat(item, " (FILE_CONTENT)"));
                            }
                        }
                    }
                    return sections; // JSON解析成功時は早期リターン
                }
                catch (e) {
                    var error = e;
                    console.log('❌ JSON parsing failed:', error.message);
                    console.log('📝 Failed text (first 500 chars):', requiredText.substring(0, 500));
                    console.log('📝 Failed text (last 500 chars):', requiredText.substring(Math.max(0, requiredText.length - 500)));
                    // エラーの詳細分析
                    console.log('🔍 Detailed error analysis:');
                    for (var i = 0; i < Math.min(requiredText.length, 100); i++) {
                        var char = requiredText[i];
                        var charCode = char.charCodeAt(0);
                        if (charCode > 127) { // 非ASCII文字
                            console.log("  Position ".concat(i, ": \"").concat(char, "\" (U+").concat(charCode.toString(16).toUpperCase().padStart(4, '0'), ")"));
                        }
                    }
                    // 不完全なJSONを修正してみる
                    var fixedText = requiredText
                        .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // 全角スペースや特殊空白を通常スペースに変換
                        .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅文字を削除
                        .replace(/[""]/g, '"') // 全角クォートを半角に変換
                        .replace(/['']/g, "'") // 全角シングルクォートを半角に変換
                        .trim();
                    // マークダウンコードブロックの除去
                    fixedText = fixedText
                        .replace(/^```(?:json|javascript|js)?\s*\n?/i, '') // 開始コードブロック
                        .replace(/\n?```\s*$/i, '') // 終了コードブロック
                        .trim();
                    // JSON部分のみを抽出
                    var jsonStartArray_2 = fixedText.indexOf('[');
                    var jsonStartObject_2 = fixedText.indexOf('{');
                    var jsonStart_2 = -1;
                    if (jsonStartArray_2 !== -1 && jsonStartObject_2 !== -1) {
                        jsonStart_2 = Math.min(jsonStartArray_2, jsonStartObject_2);
                    }
                    else if (jsonStartArray_2 !== -1) {
                        jsonStart_2 = jsonStartArray_2;
                    }
                    else if (jsonStartObject_2 !== -1) {
                        jsonStart_2 = jsonStartObject_2;
                    }
                    if (jsonStart_2 > 0) {
                        console.log('🔧 Found JSON start at position in fixed text:', jsonStart_2);
                        fixedText = fixedText.substring(jsonStart_2);
                    }
                    // 先頭の不正な文字を除去
                    if (!fixedText.startsWith('[') && !fixedText.startsWith('{')) {
                        var jsonStart_3 = Math.max(fixedText.indexOf('['), fixedText.indexOf('{'));
                        if (jsonStart_3 > 0) {
                            console.log('🔧 Removing prefix before JSON start at position:', jsonStart_3);
                            fixedText = fixedText.substring(jsonStart_3);
                        }
                    }
                    // 末尾の不正な文字を除去
                    if (!fixedText.endsWith(']') && !fixedText.endsWith('}')) {
                        var lastBrace = Math.max(fixedText.lastIndexOf(']'), fixedText.lastIndexOf('}'));
                        if (lastBrace > 0) {
                            console.log('🔧 Removing suffix after JSON end at position:', lastBrace);
                            fixedText = fixedText.substring(0, lastBrace + 1);
                        }
                    }
                    if (fixedText !== requiredText.trim()) {
                        console.log('🔧 Attempting to parse fixed JSON...');
                        try {
                            var parsedRequired = JSON.parse(fixedText);
                            console.log('✅ Fixed JSON.parse successful!');
                            if (Array.isArray(parsedRequired)) {
                                for (var _c = 0, parsedRequired_2 = parsedRequired; _c < parsedRequired_2.length; _c++) {
                                    var item = parsedRequired_2[_c];
                                    if (typeof item === 'object' && item.path) {
                                        var fileInfo = {
                                            type: item.type === 'DIRECTORY_LISTING' ? 'DIRECTORY_LISTING' : 'FILE_CONTENT',
                                            path: item.path
                                        };
                                        sections.requiredFileInfos.push(fileInfo);
                                        sections.requiredFilepaths.push(item.path);
                                    }
                                    else if (typeof item === 'string') {
                                        var fileInfo = {
                                            type: 'FILE_CONTENT',
                                            path: item
                                        };
                                        sections.requiredFileInfos.push(fileInfo);
                                        sections.requiredFilepaths.push(item);
                                    }
                                }
                            }
                            else if (typeof parsedRequired === 'object' && parsedRequired.path) {
                                var fileInfo = {
                                    type: parsedRequired.type === 'DIRECTORY_LISTING' ? 'DIRECTORY_LISTING' : 'FILE_CONTENT',
                                    path: parsedRequired.path
                                };
                                sections.requiredFileInfos.push(fileInfo);
                                sections.requiredFilepaths.push(parsedRequired.path);
                            }
                            return sections;
                        }
                        catch (fixedParseError) {
                            console.log('❌ Fixed JSON.parse also failed:', fixedParseError.message);
                        }
                    }
                    console.log('🔄 Falling back to manual parsing...');
                }
            }
            else {
                console.log('⚠️ Text does not appear to be JSON format, using manual parsing');
            }
            // フォールバック：手動パース
            console.log('🔄 Manual parsing of required text...');
            // テキストをクリーンアップ
            var cleanedRequiredText = requiredText
                .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // 全角スペースや特殊空白を通常スペースに変換
                .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅文字を削除
                .replace(/[""]/g, '"') // 全角クォートを半角に変換
                .replace(/['']/g, "'") // 全角シングルクォートを半角に変換
                .replace(/^```(?:json|javascript|js)?\s*\n?/i, '') // 開始コードブロック
                .replace(/\n?```\s*$/i, '') // 終了コードブロック
                .trim();
            // JSON部分のみを抽出
            var jsonStartArray = cleanedRequiredText.indexOf('[');
            var jsonStartObject = cleanedRequiredText.indexOf('{');
            var jsonStart = -1;
            if (jsonStartArray !== -1 && jsonStartObject !== -1) {
                jsonStart = Math.min(jsonStartArray, jsonStartObject);
            }
            else if (jsonStartArray !== -1) {
                jsonStart = jsonStartArray;
            }
            else if (jsonStartObject !== -1) {
                jsonStart = jsonStartObject;
            }
            if (jsonStart > 0) {
                console.log('🔧 Found JSON start at position in manual parsing:', jsonStart);
                cleanedRequiredText = cleanedRequiredText.substring(jsonStart);
            }
            // パターン1: 標準的なJSON配列形式 ["file1", "file2"]
            var arrayMatch = cleanedRequiredText.match(/\[(.*?)\]/);
            if (arrayMatch) {
                console.log('📋 Found array pattern in required text');
                try {
                    var jsonArray = JSON.parse("[".concat(arrayMatch[1], "]"));
                    if (Array.isArray(jsonArray)) {
                        for (var _d = 0, jsonArray_1 = jsonArray; _d < jsonArray_1.length; _d++) {
                            var item = jsonArray_1[_d];
                            if (typeof item === 'string') {
                                var fileInfo = { type: 'FILE_CONTENT', path: item };
                                sections.requiredFileInfos.push(fileInfo);
                                sections.requiredFilepaths.push(item);
                            }
                        }
                        return sections;
                    }
                }
                catch (e) {
                    console.log('❌ Array JSON parsing failed, trying line-by-line parsing');
                }
            }
            // パターン2: まずJSONパターンを試す
            var pathMatches = cleanedRequiredText.match(/"path":\s*"([^"]+)"/g);
            var typeMatches = cleanedRequiredText.match(/"type":\s*"([^"]+)"/g);
            console.log('🔍 pathMatches found:', pathMatches);
            console.log('🔍 typeMatches found:', typeMatches);
            if (pathMatches && pathMatches.length > 0) {
                console.log('✅ Using regex path extraction');
                for (var i = 0; i < pathMatches.length; i++) {
                    var pathMatch = pathMatches[i].match(/"path":\s*"([^"]+)"/);
                    var typeMatch = typeMatches && typeMatches[i] ? typeMatches[i].match(/"type":\s*"([^"]+)"/) : null;
                    if (pathMatch) {
                        var path = pathMatch[1];
                        var type = (typeMatch && typeMatch[1] === 'DIRECTORY_LISTING') ? 'DIRECTORY_LISTING' : 'FILE_CONTENT';
                        console.log("\uD83D\uDCC1 Extracted: ".concat(type, " - ").concat(path));
                        var fileInfo = { type: type, path: path };
                        sections.requiredFileInfos.push(fileInfo);
                        sections.requiredFilepaths.push(path);
                    }
                }
            }
            else {
                console.log('🔄 Using fallback string extraction');
                // 最後の手段：単純な文字列抽出
                var lines_3 = cleanedRequiredText.split('\n');
                for (var _e = 0, lines_2 = lines_3; _e < lines_2.length; _e++) {
                    var line = lines_2[_e];
                    var trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('[') && !trimmed.startsWith(']') &&
                        !trimmed.startsWith('{') && !trimmed.startsWith('}') &&
                        !trimmed.includes('"type"') && !trimmed.includes('"path"') &&
                        !trimmed.includes('FILE_CONTENT') && !trimmed.includes('DIRECTORY_LISTING') &&
                        trimmed !== ',' && trimmed !== '') {
                        // 引用符で囲まれた文字列を抽出
                        var quotedMatch = trimmed.match(/"([^"]+)"/);
                        if (quotedMatch) {
                            var path = quotedMatch[1];
                            console.log("\uD83D\uDCC4 Fallback extracted: ".concat(path));
                            var fileInfo = { type: 'FILE_CONTENT', path: path };
                            sections.requiredFileInfos.push(fileInfo);
                            sections.requiredFilepaths.push(path);
                        }
                        else if (trimmed.match(/^[a-zA-Z0-9_\-\/\.]+$/)) {
                            // 引用符なしのファイルパス形式
                            console.log("\uD83D\uDCC4 Fallback extracted (unquoted): ".concat(trimmed));
                            var fileInfo = { type: 'FILE_CONTENT', path: trimmed };
                            sections.requiredFileInfos.push(fileInfo);
                            sections.requiredFilepaths.push(trimmed);
                        }
                    }
                }
            }
        }
        console.log('✅ analyzeMessages completed');
        console.log('📋 Final requiredFileInfos:', sections.requiredFileInfos);
        console.log('📋 Final requiredFilepaths:', sections.requiredFilepaths);
        return sections;
    };
    /**
     * プランテキストからファイル要求を抽出する
     */
    MessageHandler.prototype.extractFileRequestsFromPlan = function (planText, sections) {
        console.log('🔍 Plan text analysis for file extraction...');
        // プランテキストから以下のパターンを抽出:
        // - "REVIEW_FILE_CONTENT: `filepath`"
        // - "REQUEST_FILE_CONTENT", "filePath": "path"
        // - バッククォートで囲まれたファイルパス
        var lines = planText.split('\n');
        var extractedFiles = new Set();
        for (var _i = 0, lines_4 = lines; _i < lines_4.length; _i++) {
            var line = lines_4[_i];
            // パターン1: REVIEW_FILE_CONTENT: `filepath`
            var reviewMatch = line.match(/REVIEW_FILE_CONTENT[:\s]+[`"']([^`"']+)[`"']/i);
            if (reviewMatch) {
                extractedFiles.add(reviewMatch[1]);
                console.log('📄 Found REVIEW_FILE_CONTENT request:', reviewMatch[1]);
                continue;
            }
            // パターン2: REQUEST_FILE_CONTENT", "filePath": "path"
            var requestMatch = line.match(/REQUEST_FILE_CONTENT.*["']filePath["']:\s*["']([^"']+)["']/i);
            if (requestMatch) {
                extractedFiles.add(requestMatch[1]);
                console.log('📄 Found REQUEST_FILE_CONTENT request:', requestMatch[1]);
                continue;
            }
            // パターン3: バッククォートで囲まれたファイルパス（一般的なパターン）
            var backtickMatches = line.match(/`([^`]+\.[a-zA-Z0-9]+)`/g);
            if (backtickMatches) {
                for (var _a = 0, backtickMatches_1 = backtickMatches; _a < backtickMatches_1.length; _a++) {
                    var match = backtickMatches_1[_a];
                    var filepath = match.slice(1, -1); // バッククォートを除去
                    // ファイル拡張子があり、一般的なファイルパスっぽいもの
                    if (filepath.includes('/') || filepath.includes('.')) {
                        extractedFiles.add(filepath);
                        console.log('📄 Found backtick file reference:', filepath);
                    }
                }
            }
            // パターン4: fortune/web/templates/index.tpl のような明示的なパス
            var pathMatches = line.match(/\b([\w\-]+\/[\w\-\/\.]+\.\w+)\b/g);
            if (pathMatches) {
                for (var _b = 0, pathMatches_1 = pathMatches; _b < pathMatches_1.length; _b++) {
                    var path = pathMatches_1[_b];
                    // 一般的なファイル拡張子を持つパスのみ
                    if (path.match(/\.(go|ts|js|tpl|yaml|yml|proto|py|java|cpp|h|c|json|xml|html|css)$/)) {
                        extractedFiles.add(path);
                        console.log('📄 Found explicit file path:', path);
                    }
                }
            }
        }
        // 抽出されたファイルをrequiredFileInfosに追加
        for (var _c = 0, extractedFiles_1 = extractedFiles; _c < extractedFiles_1.length; _c++) {
            var filepath = extractedFiles_1[_c];
            var fileInfo = {
                type: 'FILE_CONTENT',
                path: filepath
            };
            sections.requiredFileInfos.push(fileInfo);
            sections.requiredFilepaths.push(filepath);
        }
        if (extractedFiles.size > 0) {
            console.log("\u2705 Extracted ".concat(extractedFiles.size, " file requests from plan:"), Array.from(extractedFiles));
        }
        else {
            console.log('⚠️ No file requests found in plan text');
        }
    };
    return MessageHandler;
}());
exports.default = MessageHandler;
