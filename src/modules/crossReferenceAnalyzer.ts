/**
 * 相互参照コンテキスト生成モジュール
 * 修正されたファイルに関連する他のファイルのコード断片を検索して提供する
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CrossReferenceSnippet {
    filePath: string;
    functionName?: string;
    lineNumber: number;
    codeSnippet: string;
    relationshipType: 'calls' | 'called_by' | 'imports' | 'imported_by' | 'struct_usage';
}

export class CrossReferenceAnalyzer {
    private workspaceRoot: string;
    private gitIgnorePatterns: string[] = [
        'node_modules',
        '.git',
        'vendor',
        'logs',
        'output',
        'backups',
        'cache',
        'dataset',
        'evaluation',
        'patchEvaluation'
    ];

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * 修正されたファイルに関連するコード断片を検索
     */
    async findCrossReferences(modifiedFilePath: string, modifiedContent: string): Promise<CrossReferenceSnippet[]> {
        const snippets: CrossReferenceSnippet[] = [];
        
        try {
            // 修正されたファイルから関数名や構造体名を抽出
            const extractedElements = this.extractCodeElements(modifiedContent);
            
            // 各要素について関連コードを検索
            for (const element of extractedElements) {
                const relatedSnippets = await this.searchRelatedCode(element, modifiedFilePath);
                snippets.push(...relatedSnippets);
            }
            
            // 重複除去と関連度でソート
            return this.deduplicateAndSort(snippets);
        } catch (error) {
            console.error('Cross-reference analysis failed:', error);
            return [];
        }
    }

    /**
     * 修正されたコードから関数名、構造体名、インポートなどを抽出
     */
    private extractCodeElements(content: string): { type: string; name: string; pattern: string }[] {
        const elements: { type: string; name: string; pattern: string }[] = [];
        
        // Go言語の関数定義を抽出
        const functionMatches = content.match(/func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/g);
        if (functionMatches) {
            functionMatches.forEach(match => {
                const funcName = match.match(/func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/)?.[1];
                if (funcName) {
                    elements.push({
                        type: 'function',
                        name: funcName,
                        pattern: `\\b${funcName}\\s*\\(`
                    });
                }
            });
        }

        // 構造体定義を抽出
        const structMatches = content.match(/type\s+(\w+)\s+struct/g);
        if (structMatches) {
            structMatches.forEach(match => {
                const structName = match.match(/type\s+(\w+)\s+struct/)?.[1];
                if (structName) {
                    elements.push({
                        type: 'struct',
                        name: structName,
                        pattern: `\\b${structName}\\b`
                    });
                }
            });
        }

        // インターフェース定義を抽出
        const interfaceMatches = content.match(/type\s+(\w+)\s+interface/g);
        if (interfaceMatches) {
            interfaceMatches.forEach(match => {
                const interfaceName = match.match(/type\s+(\w+)\s+interface/)?.[1];
                if (interfaceName) {
                    elements.push({
                        type: 'interface',
                        name: interfaceName,
                        pattern: `\\b${interfaceName}\\b`
                    });
                }
            });
        }

        // 変数・定数定義を抽出（重要そうなもののみ）
        const varMatches = content.match(/(?:var|const)\s+(\w+)/g);
        if (varMatches) {
            varMatches.forEach(match => {
                const varName = match.match(/(?:var|const)\s+(\w+)/)?.[1];
                if (varName && varName.length > 3) { // 短すぎる変数名は除外
                    elements.push({
                        type: 'variable',
                        name: varName,
                        pattern: `\\b${varName}\\b`
                    });
                }
            });
        }

        return elements;
    }

    /**
     * 指定された要素に関連するコードを検索
     */
    private async searchRelatedCode(element: { type: string; name: string; pattern: string }, excludeFile: string): Promise<CrossReferenceSnippet[]> {
        const snippets: CrossReferenceSnippet[] = [];
        
        try {
            // git grep を使用して高速検索
            const grepCommand = `cd "${this.workspaceRoot}" && git grep -n -E "${element.pattern}" -- "*.go" | head -20`;
            const { stdout } = await execAsync(grepCommand);
            
            if (stdout.trim()) {
                const lines = stdout.trim().split('\n');
                
                for (const line of lines) {
                    const match = line.match(/^([^:]+):(\d+):(.*)$/);
                    if (!match) continue;
                    
                    const [, filePath, lineNumber, codeLine] = match;
                    const fullPath = path.resolve(this.workspaceRoot, filePath);
                    
                    // 除外ファイルをスキップ
                    if (fullPath === excludeFile) continue;
                    
                    // 除外パターンをチェック
                    if (this.shouldIgnoreFile(filePath)) continue;
                    
                    // コード断片を取得（前後数行を含む）
                    const snippet = await this.getCodeSnippet(fullPath, parseInt(lineNumber), 3);
                    if (snippet) {
                        snippets.push({
                            filePath: filePath,
                            functionName: this.extractFunctionContext(snippet),
                            lineNumber: parseInt(lineNumber),
                            codeSnippet: snippet,
                            relationshipType: this.determineRelationshipType(element, codeLine)
                        });
                    }
                }
            }
        } catch (error) {
            // git grep が失敗した場合は通常のファイル検索にフォールバック
            console.warn(`Git grep failed for ${element.name}, falling back to file search:`, error);
        }
        
        return snippets;
    }

    /**
     * ファイルを無視すべきかチェック
     */
    private shouldIgnoreFile(filePath: string): boolean {
        return this.gitIgnorePatterns.some(pattern => filePath.includes(pattern));
    }

    /**
     * 指定された行番号周辺のコード断片を取得
     */
    private async getCodeSnippet(filePath: string, lineNumber: number, contextLines: number): Promise<string | null> {
        try {
            if (!fs.existsSync(filePath)) return null;
            
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            
            const startLine = Math.max(0, lineNumber - contextLines - 1);
            const endLine = Math.min(lines.length - 1, lineNumber + contextLines - 1);
            
            const snippetLines = lines.slice(startLine, endLine + 1);
            
            // 行番号を付けて返す
            return snippetLines.map((line, index) => {
                const actualLineNumber = startLine + index + 1;
                const marker = actualLineNumber === lineNumber ? '>>>' : '   ';
                return `${marker} ${actualLineNumber.toString().padStart(4)}: ${line}`;
            }).join('\n');
        } catch (error) {
            return null;
        }
    }

    /**
     * コード断片から関数コンテキストを抽出
     */
    private extractFunctionContext(snippet: string): string | undefined {
        // 関数定義行を探す
        const lines = snippet.split('\n');
        for (const line of lines) {
            const funcMatch = line.match(/func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/);
            if (funcMatch) {
                return funcMatch[1];
            }
        }
        return undefined;
    }

    /**
     * 関係性のタイプを判定
     */
    private determineRelationshipType(element: { type: string; name: string; pattern: string }, codeLine: string): 'calls' | 'called_by' | 'imports' | 'imported_by' | 'struct_usage' {
        if (element.type === 'function') {
            if (codeLine.includes(`${element.name}(`)) {
                return 'calls';
            }
        }
        
        if (element.type === 'struct' || element.type === 'interface') {
            return 'struct_usage';
        }
        
        if (codeLine.includes('import')) {
            return 'imports';
        }
        
        return 'calls';
    }

    /**
     * 重複除去と関連度によるソート
     */
    private deduplicateAndSort(snippets: CrossReferenceSnippet[]): CrossReferenceSnippet[] {
        // ファイルパス + 行番号でユニークにする
        const uniqueSnippets = snippets.filter((snippet, index, array) => {
            return array.findIndex(s => s.filePath === snippet.filePath && s.lineNumber === snippet.lineNumber) === index;
        });
        
        // 関連度でソート（関数呼び出し > 構造体使用 > その他）
        return uniqueSnippets.sort((a, b) => {
            const typeWeight = {
                'calls': 3,
                'called_by': 3,
                'struct_usage': 2,
                'imports': 1,
                'imported_by': 1
            };
            
            return (typeWeight[b.relationshipType] || 0) - (typeWeight[a.relationshipType] || 0);
        }).slice(0, 10); // 最大10件に制限
    }

    /**
     * 相互参照情報をフォーマットして文字列として返す
     */
    formatCrossReferenceContext(snippets: CrossReferenceSnippet[]): string {
        if (snippets.length === 0) {
            return 'No cross-references found for the modified code.';
        }
        
        let formatted = '### Cross-Reference Context ###\n\n';
        formatted += `Found ${snippets.length} related code snippets in other files:\n\n`;
        
        snippets.forEach((snippet, index) => {
            formatted += `**${index + 1}. ${snippet.filePath}** (${snippet.relationshipType})\n`;
            if (snippet.functionName) {
                formatted += `   Function: ${snippet.functionName}\n`;
            }
            formatted += '```go\n';
            formatted += snippet.codeSnippet;
            formatted += '\n```\n\n';
        });
        
        return formatted;
    }
}
