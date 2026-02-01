import fs from 'fs';
import path from 'path';
import Logger from './Logger.js';

class RestoreDiff {
    private sourceCodePath: string;
    private logger: Logger;
    
    constructor(sourceCodePath: string) {
        this.sourceCodePath = sourceCodePath;
        this.logger = new Logger();
    }

    applyDiff(diffOutput: string): string {
        if (!diffOutput || typeof diffOutput !== 'string' || diffOutput.trim().length === 0) {
            console.error('Invalid diff input: empty or non-string');
            return '';
        }

        console.log(`🔧 RestoreDiff: Processing diff with ${diffOutput.length} characters`);
        console.log(`🔧 Source path: ${this.sourceCodePath}`);
        
        // デバッグ: diffの最初の10行を出力
        const firstLines = diffOutput.split('\n').slice(0, 10);
        console.log(`🔍 First 10 lines of diff:`);
        firstLines.forEach((line, idx) => {
            console.log(`  ${idx + 1}: ${line}`);
        });
        
        const lines = diffOutput.split('\n');
        let currentFile: string | null = null;
        let relativePath: string | null = null;
        let fileLines: string[] = [];
        let inHunk = false;
        let hunkIndex = 0;
        let result = ''; // すべての修正内容を文字列型でまとめる
        let processedFiles = 0;
        let errorCount = 0;

        lines.forEach((line, lineNumber) => {
            try {
                if (line.startsWith('--- ')) {
                    // 1つ前のファイルの内容をresultに追加
                    if (relativePath && fileLines.length > 0) {
                        result += `--- ${relativePath}\n`;
                        result += fileLines.join('\n') + '\n\n';
                        processedFiles++;
                    }

                    // 新しいファイルの処理を開始
                    relativePath = line.substring(4).trim().replace(/^a\//, '');
                    fileLines = []; // 新しいファイルの内容を初期化
                    console.log(`📁 Processing file: ${relativePath}`);
                } else if (line.startsWith('+++ ')) {
                    const newPath = line.substring(4).trim().replace(/^b\//, '');
                    
                    // ファイルパスの解決：premerge/サブディレクトリを優先
                    // 注意: commit_snapshot_*/ は正解データ（マージ後）なので使用しない
                    const pathCandidates = [
                        path.join(this.sourceCodePath, 'premerge', newPath),  // premergeを優先
                        path.join(this.sourceCodePath, newPath),              // 直接パス（フォールバック）
                    ];
                    
                    currentFile = null;
                    for (const candidate of pathCandidates) {
                        if (fs.existsSync(candidate)) {
                            currentFile = candidate;
                            console.log(`📄 Found file at: ${currentFile}`);
                            break;
                        }
                    }
                    
                    if (!currentFile) {
                        console.warn(`⚠️ File not found in any candidate path:`);
                        pathCandidates.forEach(p => console.warn(`   - ${p}`));
                        currentFile = pathCandidates[0]; // フォールバック用に最初の候補を設定
                    }

                    console.log(`📄 Reading file: ${currentFile}`);
                    if (fs.existsSync(currentFile)) {
                        try {
                            const content = fs.readFileSync(currentFile, 'utf-8');
                            fileLines = content.split('\n');
                            console.log(`✅ File read successfully: ${fileLines.length} lines`);
                        } catch (readError) {
                            const error = readError as Error;
                            console.error(`❌ Failed to read file ${currentFile}:`, error.message);
                            
                            // 詳細エラーログの記録
                            this.logger.logFileOperationError(
                                'readFile',
                                currentFile,
                                error,
                                {
                                    relativePath: newPath,
                                    sourceCodePath: this.sourceCodePath,
                                    diffProcessing: true
                                }
                            );
                            
                            fileLines = [];
                            errorCount++;
                        }
                    } else {
                        console.warn(`⚠️ File not found: ${currentFile}`);
                        fileLines = [];
                        errorCount++;
                    }

                    inHunk = false;
                    hunkIndex = 0;
                } else if (line.startsWith('@@')) {
                    // 標準的なdiff hunk headerの正規表現パターンを修正
                    // @@ -start,count +start,count @@ の形式
                    const match = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
                    if (match) {
                        inHunk = true;
                        hunkIndex = parseInt(match[3], 10) - 1; // +側の開始行番号
                        console.log(`🎯 Hunk starting at line ${hunkIndex + 1} (pattern: ${line})`);
                    } else {
                        // より柔軟なパターンを試行
                        const flexibleMatch = /@@ -\d+[^\+]*\+(\d+)[^@]*@@/.exec(line);
                        if (flexibleMatch) {
                            inHunk = true;
                            hunkIndex = parseInt(flexibleMatch[1], 10) - 1;
                            console.log(`🎯 Hunk starting at line ${hunkIndex + 1} (flexible pattern: ${line})`);
                        } else {
                            // LLMが生成する非標準的なhunk header を処理
                            // 例: "@@", "@@ func FunctionName(...) {", "@@ type StructName struct {"
                            
                            // コンテキスト情報を抽出（関数名、型名など）
                            const contextMatch = /^@@\s*(.+)$/.exec(line.replace(/@@$/, '').trim());
                            const contextHint = contextMatch ? contextMatch[1].trim() : '';
                            
                            if (contextHint && fileLines.length > 0) {
                                // コンテキスト情報でファイル内を検索
                                const searchPattern = contextHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                let foundIndex = -1;
                                
                                for (let i = 0; i < fileLines.length; i++) {
                                    if (fileLines[i].includes(contextHint) || 
                                        new RegExp(searchPattern.substring(0, 30)).test(fileLines[i])) {
                                        foundIndex = i;
                                        break;
                                    }
                                }
                                
                                if (foundIndex >= 0) {
                                    inHunk = true;
                                    hunkIndex = foundIndex;
                                    console.log(`🎯 Hunk found via context search at line ${hunkIndex + 1} (context: "${contextHint.substring(0, 50)}...")`);
                                } else {
                                    // 省略形 (@@ ... @@) の処理
                                    const ellipsisMatch = /^@@.*\.\.\..*@@$/.exec(line);
                                    if (ellipsisMatch) {
                                        console.log(`⚠️ Skipping ellipsis hunk header at line ${lineNumber}: ${line}`);
                                        inHunk = false;
                                    } else {
                                        // コンテキストが見つからない場合はファイルの先頭から開始
                                        console.warn(`⚠️ Context not found, starting from beginning: ${line}`);
                                        inHunk = true;
                                        hunkIndex = 0;
                                    }
                                }
                            } else if (line.trim() === '@@') {
                                // 単純な @@ のみの場合は先頭から開始
                                console.log(`⚠️ Simple @@ header, starting from beginning of file`);
                                inHunk = true;
                                hunkIndex = 0;
                            } else {
                                console.warn(`⚠️ Invalid hunk header at line ${lineNumber}: ${line}`);
                                inHunk = false;
                            }
                        }
                    }
                } else if (inHunk && currentFile !== null) {
                    if (line.startsWith('-')) {
                        const expectedLine = line.substring(1);
                        if (hunkIndex < fileLines.length && fileLines[hunkIndex] === expectedLine) {
                            fileLines.splice(hunkIndex, 1);
                            console.log(`➖ Removed line at ${hunkIndex}`);
                        } else {
                            console.warn(`⚠️ Line mismatch at ${hunkIndex}: expected "${expectedLine}", got "${fileLines[hunkIndex] || 'EOF'}"`);
                        }
                    } else if (line.startsWith('+')) {
                        const addedLine = line.substring(1);
                        fileLines.splice(hunkIndex, 0, addedLine);
                        console.log(`➕ Added line at ${hunkIndex}: "${addedLine.substring(0, 50)}..."`);
                        hunkIndex++;
                    } else if (line.startsWith(' ')) {
                        // Context line
                        hunkIndex++;
                    }
                }
            } catch (lineError) {
                const error = lineError as Error;
                console.error(`❌ Error processing line ${lineNumber}: "${line}"`, error.message);
                
                // 詳細エラーログの記録
                this.logger.logDiffApplicationError(
                    error,
                    diffOutput,
                    currentFile ? [currentFile] : [],
                    {
                        lineNumber,
                        line,
                        currentFile,
                        relativePath,
                        sourceCodePath: this.sourceCodePath,
                        inHunk,
                        hunkIndex
                    }
                );
                
                errorCount++;
            }
        });

        // 最後のファイルの内容をresultに追加
        if (relativePath && fileLines.length > 0) {
            result += `--- ${relativePath}\n`;
            result += fileLines.join('\n') + '\n';
            processedFiles++;
        }

        console.log(`🏁 RestoreDiff completed: ${processedFiles} files processed, ${errorCount} errors`);
        console.log(`📏 Result length: ${result.length} characters`);
        
        if (result.length === 0) {
            console.error('❌ RestoreDiff produced empty result');
            console.error('Input diff was:', diffOutput.substring(0, 500));
            
            // 詳細エラーログの記録
            const emptyResultError = new Error('RestoreDiff produced empty result');
            this.logger.logDiffApplicationError(
                emptyResultError,
                diffOutput,
                [],
                {
                    sourceCodePath: this.sourceCodePath,
                    processedFiles,
                    errorCount,
                    diffLength: diffOutput.length,
                    resultLength: result.length
                }
            );
            
            // フォールバック: 元のdiffをそのまま返す
            console.log('🔄 Fallback: returning original diff content');
            return diffOutput;
        }

        return result.trim(); // 余分な改行を削除して返す
    }
}

export default RestoreDiff;
