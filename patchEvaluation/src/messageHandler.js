/**
 * メッセージ処理クラス（JavaScript版）
 * LLMとの会話とレスポンス解析を担当
 */

import { createLLMParsed, createRequiredFileInfo } from './types.js';

class MessageHandler {
    constructor() {
        this.messagesTemplate = [
            {
                role: 'system',
                content: "Fix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections."
            }
        ];
    }

    attachMessages(role, messages) {
        // 新しいメッセージをテンプレートに追加
        this.messagesTemplate.push({
            role: role,
            content: messages
        });
        return this.messagesTemplate;
    }

    analyzeMessages(messages) {
        const sections = {
            thought: null,
            plan: null,
            requiredFilepaths: [],
            requiredFileInfos: [], // 新しいフィールド
            modifiedDiff: '',
            commentText: '',
            has_fin_tag: false
        };

        // 生JSONの検出と直接処理
        const trimmedMessages = messages.trim();
        if ((trimmedMessages.startsWith('[') && trimmedMessages.endsWith(']')) || 
            (trimmedMessages.startsWith('{') && trimmedMessages.endsWith('}'))) {
            
            // JSON構造の指標をチェック
            const hasFileIndicators = trimmedMessages.includes('"path"') || 
                                    trimmedMessages.includes('"filePath"') || 
                                    trimmedMessages.includes('"action"');
            
            if (hasFileIndicators) {
                console.log('🔍 Detected standalone JSON with file indicators, processing directly...');
                try {
                    const parsed = JSON.parse(trimmedMessages);
                    if (Array.isArray(parsed)) {
                        const processedPaths = new Set(); // 重複を避けるため
                        
                        for (const item of parsed) {
                            if (typeof item === 'object' && (item.path || item.filePath)) {
                                const path = item.path || item.filePath;
                                
                                // 重複チェック
                                if (!processedPaths.has(path)) {
                                    processedPaths.add(path);
                                    
                                    const fileInfo = createRequiredFileInfo(
                                        item.type === 'DIRECTORY_LISTING' ? 'DIRECTORY_LISTING' : 'FILE_CONTENT',
                                        path
                                    );
                                    sections.requiredFileInfos.push(fileInfo);
                                    sections.requiredFilepaths.push(path);
                                    console.log(`📄 Added file from standalone JSON: ${path} (${fileInfo.type})`);
                                } else {
                                    console.log(`⚠️ Skipped duplicate file: ${path}`);
                                }
                            }
                        }
                    }
                    
                    // JSONがプランとして解釈できる場合はplanにも格納
                    if (parsed.length > 0 && parsed.every(item => item.action || item.step)) {
                        sections.plan = JSON.stringify(parsed, null, 2);
                        console.log(`📋 Stored JSON as plan with ${parsed.length} steps`);
                    }
                    
                    console.log(`✅ Standalone JSON processing completed. Extracted ${sections.requiredFileInfos.length} file(s)`);
                    return sections;
                } catch (jsonError) {
                    console.log(`❌ Failed to parse standalone JSON: ${jsonError}`);
                    // タグベースの処理にフォールバック
                }
            }
        }

        // タグベースの処理（既存のロジック）
        const lines = messages.split('\n');
        let currentTag = null;
        const buffers = {
            thought: [],
            plan: [],
            modified: [],
            comment: [],
            required: []
        };

        for (const line of lines) {
            const trimmed = line.trim();
            
            // 新しいタグ形式をサポート: %_Thought_%, %_Plan_%, %_Reply Required_%, %_Modified_%
            const tagMatch = trimmed.match(/^%_(.+?)_%$/);

            if (tagMatch) {
                const tagName = tagMatch[1];
                // タグ名の正規化
                if (tagName === 'Thought') {
                    currentTag = 'thought';
                } else if (tagName === 'Plan') {
                    currentTag = 'plan';
                } else if (tagName === 'Reply Required') {
                    currentTag = 'required';
                } else if (tagName === 'Modified') {
                    currentTag = 'modified';
                } else if (tagName === 'Comment') {
                    currentTag = 'comment';
                } else {
                    // 従来形式のサポート（小文字変換）
                    currentTag = tagName.toLowerCase().replace(/ /g, '_');
                    if (currentTag !== 'modified' && currentTag !== 'comment' && currentTag !== 'thought' && currentTag !== 'plan') {
                        currentTag = 'required'; // その他は required として扱う
                    }
                }
                console.log(`🏷️ Detected tag: ${tagName} -> ${currentTag}`);
                continue;
            } else if (trimmed === '%%_Fin_%%') {
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
                } else if (buffers[currentTag]) {
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
            const requiredText = buffers.required.join('\n').trim();
            
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
            const trimmedText = requiredText.trim();
            console.log('🔍 JSON detection - trimmed length:', trimmedText.length);
            console.log('🔍 JSON detection - starts with:', JSON.stringify(trimmedText.substring(0, 20)));
            console.log('🔍 JSON detection - ends with:', JSON.stringify(trimmedText.substring(Math.max(0, trimmedText.length - 20))));
            
            // プレーンテキストの指示リストかチェック（JSON解析の前に実行）
            const isNumberedList = /^\s*\d+\.\s*/.test(trimmedText);
            const isBulletList = /^\s*[-*•]\s*/.test(trimmedText);
            const hasJSONStructure = /[\[\{]/.test(trimmedText) && /[\]\}]/.test(trimmedText);
            
            if ((isNumberedList || isBulletList) && !hasJSONStructure) {
                console.log('🔧 Detected plain text instruction list, skipping JSON parsing');
                console.log('📋 List content preview:', trimmedText.substring(0, 200) + '...');
                console.log('📋 List type:', isNumberedList ? 'numbered' : 'bullet');
                return sections; // プレーンテキストの場合は解析をスキップ
            }
            
            const startsWithJSON = trimmedText.startsWith('[') || trimmedText.startsWith('{');
            const endsWithJSON = trimmedText.endsWith(']') || trimmedText.endsWith('}');
            const hasJSONIndicators = trimmedText.includes('"path"') || trimmedText.includes('"type"');
            
            console.log('🔍 JSON detection - startsWithJSON:', startsWithJSON, 'endsWithJSON:', endsWithJSON, 'hasJSONIndicators:', hasJSONIndicators);
            
            const looksLikeJSON = (startsWithJSON && endsWithJSON) || hasJSONIndicators;
            
            if (looksLikeJSON) {
                console.log('🔄 Text appears to be JSON format, attempting JSON.parse...');
                console.log('📝 Text to parse (length:', requiredText.length, '):', 
                    requiredText.length > 200 ? requiredText.substring(0, 200) + '...' : requiredText);
                console.log('📝 Text starts with:', JSON.stringify(requiredText.substring(0, 50)));
                console.log('📝 Text ends with:', JSON.stringify(requiredText.substring(Math.max(0, requiredText.length - 50))));
                
                if (requiredText.length === 0) {
                    console.log('⚠️ Cannot parse empty text as JSON');
                    return sections;
                }
                
                try {
                    // JSON解析前の文字列クリーンアップ
                    let cleanedText = requiredText
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
                    let jsonText = cleanedText;
                    
                    // 方法1: JSON配列またはオブジェクトの開始位置を探す
                    const jsonStartArray = cleanedText.indexOf('[');
                    const jsonStartObject = cleanedText.indexOf('{');
                    let jsonStart = -1;
                    
                    if (jsonStartArray !== -1 && jsonStartObject !== -1) {
                        jsonStart = Math.min(jsonStartArray, jsonStartObject);
                    } else if (jsonStartArray !== -1) {
                        jsonStart = jsonStartArray;
                    } else if (jsonStartObject !== -1) {
                        jsonStart = jsonStartObject;
                    }
                    
                    if (jsonStart > 0) {
                        console.log('🔧 Found JSON start at position:', jsonStart);
                        jsonText = cleanedText.substring(jsonStart);
                        
                        // 対応する終了位置を探す
                        let bracketCount = 0;
                        let inString = false;
                        let escapeNext = false;
                        let jsonEnd = -1;
                        
                        const startChar = jsonText[0];
                        const endChar = startChar === '[' ? ']' : '}';
                        
                        for (let i = 0; i < jsonText.length; i++) {
                            const char = jsonText[i];
                            
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
                                } else if (char === endChar) {
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
                    
                    const parsedRequired = JSON.parse(jsonText);
                    console.log('✅ JSON.parse successful, result:', parsedRequired);
                    
                    if (Array.isArray(parsedRequired)) {
                        for (const item of parsedRequired) {
                            if (typeof item === 'object' && (item.path || item.filePath)) {
                                const path = item.path || item.filePath; // pathまたはfilePathフィールドをサポート
                                const fileInfo = createRequiredFileInfo(
                                    item.type === 'DIRECTORY_LISTING' ? 'DIRECTORY_LISTING' : 'FILE_CONTENT',
                                    path
                                );
                                sections.requiredFileInfos.push(fileInfo);
                                sections.requiredFilepaths.push(path);
                                console.log(`📄 Added file from JSON: ${path} (${fileInfo.type})`);
                            } else if (typeof item === 'string') {
                                const fileInfo = createRequiredFileInfo('FILE_CONTENT', item);
                                sections.requiredFileInfos.push(fileInfo);
                                sections.requiredFilepaths.push(item);
                                console.log(`📄 Added file from JSON string: ${item} (FILE_CONTENT)`);
                            }
                        }
                    }
                    return sections; // JSON解析成功時は早期リターン
                } catch (e) {
                    const error = e;
                    console.log('❌ JSON parsing failed:', error.message);
                    console.log('📝 Failed text (first 500 chars):', requiredText.substring(0, 500));
                    console.log('📝 Failed text (last 500 chars):', requiredText.substring(Math.max(0, requiredText.length - 500)));
                    
                    // エラーの詳細分析
                    console.log('🔍 Detailed error analysis:');
                    for (let i = 0; i < Math.min(requiredText.length, 100); i++) {
                        const char = requiredText[i];
                        const charCode = char.charCodeAt(0);
                        if (charCode > 127) { // 非ASCII文字
                            console.log(`  Position ${i}: "${char}" (U+${charCode.toString(16).toUpperCase().padStart(4, '0')})`);
                        }
                    }
                    
                    // 不完全なJSONを修正してみる
                    let fixedText = requiredText
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
                    const jsonStartArray = fixedText.indexOf('[');
                    const jsonStartObject = fixedText.indexOf('{');
                    let jsonStart = -1;
                    
                    if (jsonStartArray !== -1 && jsonStartObject !== -1) {
                        jsonStart = Math.min(jsonStartArray, jsonStartObject);
                    } else if (jsonStartArray !== -1) {
                        jsonStart = jsonStartArray;
                    } else if (jsonStartObject !== -1) {
                        jsonStart = jsonStartObject;
                    }
                    
                    if (jsonStart > 0) {
                        console.log('🔧 Found JSON start at position in fixed text:', jsonStart);
                        fixedText = fixedText.substring(jsonStart);
                    }
                    
                    // 先頭の不正な文字を除去
                    if (!fixedText.startsWith('[') && !fixedText.startsWith('{')) {
                        const jsonStart = Math.max(fixedText.indexOf('['), fixedText.indexOf('{'));
                        if (jsonStart > 0) {
                            console.log('🔧 Removing prefix before JSON start at position:', jsonStart);
                            fixedText = fixedText.substring(jsonStart);
                        }
                    }
                    
                    // 末尾の不正な文字を除去
                    if (!fixedText.endsWith(']') && !fixedText.endsWith('}')) {
                        const lastBrace = Math.max(fixedText.lastIndexOf(']'), fixedText.lastIndexOf('}'));
                        if (lastBrace > 0) {
                            console.log('🔧 Removing suffix after JSON end at position:', lastBrace);
                            fixedText = fixedText.substring(0, lastBrace + 1);
                        }
                    }
                    
                    if (fixedText !== requiredText.trim()) {
                        console.log('🔧 Attempting to parse fixed JSON...');
                        try {
                            const parsedRequired = JSON.parse(fixedText);
                            console.log('✅ Fixed JSON.parse successful!');
                            
                            if (Array.isArray(parsedRequired)) {
                                for (const item of parsedRequired) {
                                    if (typeof item === 'object' && item.path) {
                                        const fileInfo = createRequiredFileInfo(
                                            item.type === 'DIRECTORY_LISTING' ? 'DIRECTORY_LISTING' : 'FILE_CONTENT',
                                            item.path
                                        );
                                        sections.requiredFileInfos.push(fileInfo);
                                        sections.requiredFilepaths.push(item.path);
                                    } else if (typeof item === 'string') {
                                        const fileInfo = createRequiredFileInfo('FILE_CONTENT', item);
                                        sections.requiredFileInfos.push(fileInfo);
                                        sections.requiredFilepaths.push(item);
                                    }
                                }
                            } else if (typeof parsedRequired === 'object' && parsedRequired.path) {
                                const fileInfo = createRequiredFileInfo(
                                    parsedRequired.type === 'DIRECTORY_LISTING' ? 'DIRECTORY_LISTING' : 'FILE_CONTENT',
                                    parsedRequired.path
                                );
                                sections.requiredFileInfos.push(fileInfo);
                                sections.requiredFilepaths.push(parsedRequired.path);
                            }
                            return sections;
                        } catch (fixedParseError) {
                            console.log('❌ Fixed JSON.parse also failed:', fixedParseError.message);
                        }
                    }
                    
                    console.log('🔄 Falling back to manual parsing...');
                }
            } else {
                console.log('⚠️ Text does not appear to be JSON format, using manual parsing');
            }
            
            // フォールバック：手動パース
            console.log('🔄 Manual parsing of required text...');
            
            // テキストをクリーンアップ
            let cleanedRequiredText = requiredText
                .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // 全角スペースや特殊空白を通常スペースに変換
                .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅文字を削除
                .replace(/[""]/g, '"') // 全角クォートを半角に変換
                .replace(/['']/g, "'") // 全角シングルクォートを半角に変換
                .replace(/^```(?:json|javascript|js)?\s*\n?/i, '') // 開始コードブロック
                .replace(/\n?```\s*$/i, '') // 終了コードブロック
                .trim();
            
            // JSON部分のみを抽出
            const jsonStartArray = cleanedRequiredText.indexOf('[');
            const jsonStartObject = cleanedRequiredText.indexOf('{');
            let jsonStart = -1;
            
            if (jsonStartArray !== -1 && jsonStartObject !== -1) {
                jsonStart = Math.min(jsonStartArray, jsonStartObject);
            } else if (jsonStartArray !== -1) {
                jsonStart = jsonStartArray;
            } else if (jsonStartObject !== -1) {
                jsonStart = jsonStartObject;
            }
            
            if (jsonStart > 0) {
                console.log('🔧 Found JSON start at position in manual parsing:', jsonStart);
                cleanedRequiredText = cleanedRequiredText.substring(jsonStart);
            }
            
            // パターン1: 標準的なJSON配列形式 ["file1", "file2"]
            let arrayMatch = cleanedRequiredText.match(/\[(.*?)\]/);
            if (arrayMatch) {
                console.log('📋 Found array pattern in required text');
                try {
                    const jsonArray = JSON.parse(`[${arrayMatch[1]}]`);
                    if (Array.isArray(jsonArray)) {
                        for (const item of jsonArray) {
                            if (typeof item === 'string') {
                                const fileInfo = createRequiredFileInfo('FILE_CONTENT', item);
                                sections.requiredFileInfos.push(fileInfo);
                                sections.requiredFilepaths.push(item);
                            }
                        }
                        return sections;
                    }
                } catch (e) {
                    console.log('❌ Array JSON parsing failed, trying line-by-line parsing');
                }
            }
            
            // パターン2: まずJSONパターンを試す
            const pathMatches = cleanedRequiredText.match(/"path":\s*"([^"]+)"/g);
            const typeMatches = cleanedRequiredText.match(/"type":\s*"([^"]+)"/g);
            
            console.log('🔍 pathMatches found:', pathMatches);
            console.log('🔍 typeMatches found:', typeMatches);
            
            if (pathMatches && pathMatches.length > 0) {
                console.log('✅ Using regex path extraction');
                for (let i = 0; i < pathMatches.length; i++) {
                    const pathMatch = pathMatches[i].match(/"path":\s*"([^"]+)"/);
                    const typeMatch = typeMatches && typeMatches[i] ? typeMatches[i].match(/"type":\s*"([^"]+)"/) : null;
                    
                    if (pathMatch) {
                        const path = pathMatch[1];
                        const type = (typeMatch && typeMatch[1] === 'DIRECTORY_LISTING') ? 'DIRECTORY_LISTING' : 'FILE_CONTENT';
                        
                        console.log(`📁 Extracted: ${type} - ${path}`);
                        const fileInfo = createRequiredFileInfo(type, path);
                        sections.requiredFileInfos.push(fileInfo);
                        sections.requiredFilepaths.push(path);
                    }
                }
            } else {
                console.log('🔄 Using fallback string extraction');
                // 最後の手段：単純な文字列抽出
                const lines = cleanedRequiredText.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('[') && !trimmed.startsWith(']') && 
                        !trimmed.startsWith('{') && !trimmed.startsWith('}') && 
                        !trimmed.includes('"type"') && !trimmed.includes('"path"') && 
                        !trimmed.includes('FILE_CONTENT') && !trimmed.includes('DIRECTORY_LISTING') && 
                        trimmed !== ',' && trimmed !== '') {
                        
                        // 引用符で囲まれた文字列を抽出
                        const quotedMatch = trimmed.match(/"([^"]+)"/);
                        if (quotedMatch) {
                            const path = quotedMatch[1];
                            console.log(`📄 Fallback extracted: ${path}`);
                            const fileInfo = createRequiredFileInfo('FILE_CONTENT', path);
                            sections.requiredFileInfos.push(fileInfo);
                            sections.requiredFilepaths.push(path);
                        } else if (trimmed.match(/^[a-zA-Z0-9_\-\/\.]+$/)) {
                            // 引用符なしのファイルパス形式
                            console.log(`📄 Fallback extracted (unquoted): ${trimmed}`);
                            const fileInfo = createRequiredFileInfo('FILE_CONTENT', trimmed);
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
    }

    /**
     * プランテキストからファイル要求を抽出する
     */
    extractFileRequestsFromPlan(planText, sections) {
        console.log('🔍 Plan text analysis for file extraction...');
        
        // プランテキストから以下のパターンを抽出:
        // - "REVIEW_FILE_CONTENT: `filepath`"
        // - "REQUEST_FILE_CONTENT", "filePath": "path"
        // - バッククォートで囲まれたファイルパス
        
        const lines = planText.split('\n');
        const extractedFiles = new Set();
        
        for (const line of lines) {
            // パターン1: REVIEW_FILE_CONTENT: `filepath`
            const reviewMatch = line.match(/REVIEW_FILE_CONTENT[:\s]+[`"']([^`"']+)[`"']/i);
            if (reviewMatch) {
                extractedFiles.add(reviewMatch[1]);
                console.log('📄 Found REVIEW_FILE_CONTENT request:', reviewMatch[1]);
                continue;
            }
            
            // パターン2: REQUEST_FILE_CONTENT", "filePath": "path"
            const requestMatch = line.match(/REQUEST_FILE_CONTENT.*["']filePath["']:\s*["']([^"']+)["']/i);
            if (requestMatch) {
                extractedFiles.add(requestMatch[1]);
                console.log('📄 Found REQUEST_FILE_CONTENT request:', requestMatch[1]);
                continue;
            }
            
            // パターン3: バッククォートで囲まれたファイルパス（一般的なパターン）
            const backtickMatches = line.match(/`([^`]+\.[a-zA-Z0-9]+)`/g);
            if (backtickMatches) {
                for (const match of backtickMatches) {
                    const filepath = match.slice(1, -1); // バッククォートを除去
                    // ファイル拡張子があり、一般的なファイルパスっぽいもの
                    if (filepath.includes('/') || filepath.includes('.')) {
                        extractedFiles.add(filepath);
                        console.log('📄 Found backtick file reference:', filepath);
                    }
                }
            }
            
            // パターン4: fortune/web/templates/index.tpl のような明示的なパス
            const pathMatches = line.match(/\b([\w\-]+\/[\w\-\/\.]+\.\w+)\b/g);
            if (pathMatches) {
                for (const path of pathMatches) {
                    // 一般的なファイル拡張子を持つパスのみ
                    if (path.match(/\.(go|ts|js|tpl|yaml|yml|proto|py|java|cpp|h|c|json|xml|html|css)$/)) {
                        extractedFiles.add(path);
                        console.log('📄 Found explicit file path:', path);
                    }
                }
            }
        }
        
        // 抽出されたファイルをrequiredFileInfosに追加
        for (const filepath of extractedFiles) {
            const fileInfo = createRequiredFileInfo('FILE_CONTENT', filepath);
            sections.requiredFileInfos.push(fileInfo);
            sections.requiredFilepaths.push(filepath);
        }
        
        if (extractedFiles.size > 0) {
            console.log(`✅ Extracted ${extractedFiles.size} file requests from plan:`, Array.from(extractedFiles));
        } else {
            console.log('⚠️ No file requests found in plan text');
        }
    }
}

export default MessageHandler;
