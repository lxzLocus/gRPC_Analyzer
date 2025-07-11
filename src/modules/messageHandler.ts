/**
 * メッセージ処理クラス
 * LLMとの会話とレスポンス解析を担当
 */

import type { LLMParsed, RequiredFileInfo } from './types.js';

class MessageHandler {
    messagesTemplate: Array<{ role: string, content: string }>;

    constructor() {
        this.messagesTemplate = [
            {
                role: 'system',
                content: "Fix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections."
            }
        ];
    }

    attachMessages(role: string, messages: string): Array<{ role: string, content: string }> {
        // 新しいメッセージをテンプレートに追加
        this.messagesTemplate.push({
            role: role,
            content: messages
        });
        return this.messagesTemplate;
    }

    analyzeMessages(messages: string): LLMParsed {
        const sections = {
            thought: null as string | null,
            plan: null as string | null,
            requiredFilepaths: [] as string[],
            requiredFileInfos: [] as RequiredFileInfo[], // 新しいフィールド
            modifiedDiff: '',
            commentText: '',
            has_fin_tag: false
        };

        const lines = messages.split('\n');
        let currentTag: string | null = null;
        const buffers: { [key: string]: string[] } = {
            thought: [],
            plan: [],
            modified: [],
            comment: [],
            required: []
        };

        for (const line of lines) {
            const trimmed = line.trim();
            const tagMatch = trimmed.match(/^%_(.+?)_%$/);

            if (tagMatch) {
                currentTag = tagMatch[1].toLowerCase().replace(/ /g, '_'); // e.g., "Reply Required" -> "reply_required"
                if (currentTag === 'modified' || currentTag === 'comment' || currentTag === 'thought' || currentTag === 'plan') {
                    // バッファを使用するタグ
                } else {
                    currentTag = 'required' // 'Reply Required'
                }
                continue;
            } else if (trimmed === '%%_Fin_%%') {
                sections.has_fin_tag = true;
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
                    const parsedRequired = JSON.parse(requiredText);
                    console.log('✅ JSON.parse successful, result:', parsedRequired);
                    
                    if (Array.isArray(parsedRequired)) {
                        for (const item of parsedRequired) {
                            if (typeof item === 'object' && item.path) {
                                const fileInfo: RequiredFileInfo = {
                                    type: item.type === 'DIRECTORY_LISTING' ? 'DIRECTORY_LISTING' : 'FILE_CONTENT',
                                    path: item.path
                                };
                                sections.requiredFileInfos.push(fileInfo);
                                sections.requiredFilepaths.push(item.path);
                            } else if (typeof item === 'string') {
                                const fileInfo: RequiredFileInfo = {
                                    type: 'FILE_CONTENT',
                                    path: item
                                };
                                sections.requiredFileInfos.push(fileInfo);
                                sections.requiredFilepaths.push(item);
                            }
                        }
                    }
                    return sections; // JSON解析成功時は早期リターン
                } catch (e) {
                    console.log('❌ JSON parsing failed:', (e as Error).message);
                    console.log('� Failed text (first 500 chars):', requiredText.substring(0, 500));
                    console.log('📝 Failed text (last 500 chars):', requiredText.substring(Math.max(0, requiredText.length - 500)));
                    
                    // 不完全なJSONを修正してみる
                    let fixedText = requiredText.trim();
                    
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
                                        const fileInfo: RequiredFileInfo = {
                                            type: item.type === 'DIRECTORY_LISTING' ? 'DIRECTORY_LISTING' : 'FILE_CONTENT',
                                            path: item.path
                                        };
                                        sections.requiredFileInfos.push(fileInfo);
                                        sections.requiredFilepaths.push(item.path);
                                    } else if (typeof item === 'string') {
                                        const fileInfo: RequiredFileInfo = {
                                            type: 'FILE_CONTENT',
                                            path: item
                                        };
                                        sections.requiredFileInfos.push(fileInfo);
                                        sections.requiredFilepaths.push(item);
                                    }
                                }
                            } else if (typeof parsedRequired === 'object' && parsedRequired.path) {
                                const fileInfo: RequiredFileInfo = {
                                    type: parsedRequired.type === 'DIRECTORY_LISTING' ? 'DIRECTORY_LISTING' : 'FILE_CONTENT',
                                    path: parsedRequired.path
                                };
                                sections.requiredFileInfos.push(fileInfo);
                                sections.requiredFilepaths.push(parsedRequired.path);
                            }
                            return sections;
                        } catch (fixedParseError) {
                            console.log('❌ Fixed JSON.parse also failed:', (fixedParseError as Error).message);
                        }
                    }
                    
                    console.log('�🔄 Falling back to manual parsing...');
                }
            } else {
                console.log('⚠️ Text does not appear to be JSON format, using manual parsing');
            }
            
            // フォールバック：手動パース
            console.log('🔄 Manual parsing of required text...');
            
            // まずJSONパターンを試す
            const pathMatches = requiredText.match(/"path":\s*"([^"]+)"/g);
            const typeMatches = requiredText.match(/"type":\s*"([^"]+)"/g);
            
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
                        const fileInfo: RequiredFileInfo = { type, path };
                        sections.requiredFileInfos.push(fileInfo);
                        sections.requiredFilepaths.push(path);
                    }
                }
            } else {
                console.log('🔄 Using fallback string extraction');
                // 最後の手段：単純な文字列抽出
                const lines = requiredText.split('\n');
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
                            const fileInfo: RequiredFileInfo = { type: 'FILE_CONTENT', path };
                            sections.requiredFileInfos.push(fileInfo);
                            sections.requiredFilepaths.push(path);
                        } else if (trimmed.match(/^[a-zA-Z0-9_\-\/\.]+$/)) {
                            // 引用符なしのファイルパス形式
                            console.log(`📄 Fallback extracted (unquoted): ${trimmed}`);
                            const fileInfo: RequiredFileInfo = { type: 'FILE_CONTENT', path: trimmed };
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
}

export default MessageHandler;




// このファイルが直接実行された場合のみ、以下のテストコードを実行
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log("Running MessageHandler in debug mode...");

    const testMessageHandler = () => {
        const handler = new MessageHandler();

        // --- Test case 1: analyzeMessages with various tags ---
        console.log("\n--- Testing analyzeMessages ---");
        const testMessage = `
%_Thought_%
The provided context indicates a significant change in ra.proto from proto2 to proto3. The most critical change is the removal of the optional keyword from fields in messages like NewAuthorizationRequest. In proto3, scalar fields are no longer pointers and cannot be nil. This means that code in ra / ra.go that likely checks for nil on these fields (e.g., if req.Authz != nil) will now cause a compile error or be logically incorrect.
My primary task is to identify and correct these nil checks. The provided content of ra / ra.go is the first place to look.
Additionally, the fileChanges list shows that wfe / wfe.go was also modified in the original commit. This strongly suggests that wfe / wfe.go also uses the changed proto messages and will require similar corrections. I do not have the content for this file, so I will need to request it.
My plan is to first review ra / ra.go and formulate the exact modifications. Then, I will request the content of wfe / wfe.go to analyze its impact. Modifying ra / ra.go can wait until I have a complete picture, but for now, I will create a plan that includes requesting the other necessary files.

%_Plan_%
[
  {
    "step": 1,
    "action": "REVIEW_FILE_CONTENT",
    "filePath": "ra/ra.go",
    "reason": "Analyze the provided content to confirm the impact of the optional field removal and identify specific lines to be modified."
  },
  {
    "step": 2,
    "action": "REQUEST_FILE_CONTENT",
    "filePath": "wfe/wfe.go",
    "reason": "This file was part of the original commit's changed file list, suggesting it is also affected by the proto changes. Its content is needed for a complete fix."
  },
  {
    "step": 3,
    "action": "MODIFY_FILE",
    "filePath": "ra/ra.go",
    "reason": "Apply corrections to ra / ra.go based on the analysis in step 1. This step will be executed after gathering all necessary information."
  },
  {
    "step": 4,
    "action": "MODIFY_FILE",
    "filePath": "wfe/wfe.go",
    "reason": "Apply corrections to wfe / wfe.go after analyzing its content from step 2."
  }
]

%_Reply Required_%
[
  {
    "type": "FILE_CONTENT",
    "path": "wfe/wfe.go"
  },
  {
    "type": "DIRECTORY_LISTING",
    "path": "src/controllers"
  }
]

%_Comment_%
I have analyzed the initial context and created a four-step plan. I am starting by requesting the content of wfe / wfe.go as it is essential for understanding the full scope of required changes. I will proceed with code modification once I have all necessary file contents.

%%_Fin_%%
`;

        const result = handler.analyzeMessages(testMessage);
        console.log("Analysis Result:");
        console.log(JSON.stringify(result, null, 2));

        // Required files の詳細確認
        console.log("\n--- Required Files Detail ---");
        console.log("requiredFilepaths (legacy):", result.requiredFilepaths);
        console.log("requiredFileInfos (new):", result.requiredFileInfos);
        
        // タイプ別の分類
        const fileContentRequests = result.requiredFileInfos.filter(info => info.type === 'FILE_CONTENT');
        const directoryListingRequests = result.requiredFileInfos.filter(info => info.type === 'DIRECTORY_LISTING');
        
        console.log("FILE_CONTENT requests:", fileContentRequests);
        console.log("DIRECTORY_LISTING requests:", directoryListingRequests);

        // --- Test case 2: attachMessages ---
        console.log("\n--- Testing attachMessages ---");
        const newMessages = handler.attachMessages("user", "Hello, this is a new message.");
        console.log("Updated Messages:");
        console.log(JSON.stringify(newMessages, null, 2));
    };

    testMessageHandler();
}