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
                    // JSON形式の解析を試みる
                    if (trimmed.startsWith('[') || trimmed.startsWith('{') || trimmed.includes('"path"') || trimmed.includes('"type"') || trimmed.endsWith('}') || trimmed.endsWith(']')) {
                        // JSONバッファに追加
                        if (!buffers.required) {
                            buffers.required = [];
                        }
                        buffers.required.push(line);
                    } else {
                        // 従来の文字列マッチング
                        const match = trimmed.match(/"(.+?)"/);
                        if (match) {
                            sections.requiredFilepaths.push(match[1]);
                        } else if (trimmed && !trimmed.startsWith('[') && !trimmed.startsWith(']')) {
                            sections.requiredFilepaths.push(trimmed);
                        }
                    }
                } else if (buffers[currentTag]) {
                    buffers[currentTag].push(line);
                }
            }
        }

        sections.thought = buffers.thought.join('\n').trim() || null;
        sections.plan = buffers.plan.join('\n').trim() || null;
        sections.modifiedDiff = buffers.modified.join('\n').trim();
        sections.commentText = buffers.comment.join('\n').trim();

        // Required filesの後処理（JSON解析）
        if (buffers.required && buffers.required.length > 0) {
            const requiredText = buffers.required.join('\n').trim();
            try {
                // まずJSON全体として解析を試みる
                const parsedRequired = JSON.parse(requiredText);
                if (Array.isArray(parsedRequired)) {
                    for (const item of parsedRequired) {
                        if (typeof item === 'object' && item.path) {
                            const fileInfo: RequiredFileInfo = {
                                type: item.type === 'DIRECTORY_LISTING' ? 'DIRECTORY_LISTING' : 'FILE_CONTENT',
                                path: item.path
                            };
                            sections.requiredFileInfos.push(fileInfo);
                            // 後方互換性のため、pathも追加
                            sections.requiredFilepaths.push(item.path);
                        } else if (typeof item === 'string') {
                            // 文字列の場合はFILE_CONTENTとして扱う
                            const fileInfo: RequiredFileInfo = {
                                type: 'FILE_CONTENT',
                                path: item
                            };
                            sections.requiredFileInfos.push(fileInfo);
                            sections.requiredFilepaths.push(item);
                        }
                    }
                }
            } catch (e) {
                // JSONが不正な場合は、pathを直接抽出
                const pathMatches = requiredText.match(/"path":\s*"([^"]+)"/g);
                const typeMatches = requiredText.match(/"type":\s*"([^"]+)"/g);
                
                if (pathMatches) {
                    for (let i = 0; i < pathMatches.length; i++) {
                        const pathMatch = pathMatches[i].match(/"path":\s*"([^"]+)"/);
                        const typeMatch = typeMatches && typeMatches[i] ? typeMatches[i].match(/"type":\s*"([^"]+)"/) : null;
                        
                        if (pathMatch) {
                            const path = pathMatch[1];
                            const type = (typeMatch && typeMatch[1] === 'DIRECTORY_LISTING') ? 'DIRECTORY_LISTING' : 'FILE_CONTENT';
                            
                            const fileInfo: RequiredFileInfo = { type, path };
                            sections.requiredFileInfos.push(fileInfo);
                            sections.requiredFilepaths.push(path);
                        }
                    }
                } else {
                    // 最後の手段：単純な文字列抽出（FILE_CONTENTとして扱う）
                    const lines = requiredText.split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed && !trimmed.startsWith('[') && !trimmed.startsWith(']') && 
                            !trimmed.startsWith('{') && !trimmed.startsWith('}') && 
                            !trimmed.includes('"type"') && !trimmed.includes('"path"') && 
                            !trimmed.includes('FILE_CONTENT') && !trimmed.includes('DIRECTORY_LISTING') && trimmed !== ',') {
                            // 実際のファイルパスらしい文字列のみ抽出
                            const quotedMatch = trimmed.match(/"([^"]+)"/);
                            if (quotedMatch) {
                                const path = quotedMatch[1];
                                const fileInfo: RequiredFileInfo = { type: 'FILE_CONTENT', path };
                                sections.requiredFileInfos.push(fileInfo);
                                sections.requiredFilepaths.push(path);
                            }
                        }
                    }
                }
            }
        }

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