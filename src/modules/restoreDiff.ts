import fs from 'fs';
import path from 'path';

class RestoreDiff {
    private sourceCodePath: string;
    
    constructor(sourceCodePath: string) {
        this.sourceCodePath = sourceCodePath;
    }

    applyDiff(diffOutput: string): string {
        if (!diffOutput || typeof diffOutput !== 'string' || diffOutput.trim().length === 0) {
            console.error('Invalid diff input: empty or non-string');
            return '';
        }

        console.log(`🔧 RestoreDiff: Processing diff with ${diffOutput.length} characters`);
        console.log(`🔧 Source path: ${this.sourceCodePath}`);
        
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
                    currentFile = path.join(this.sourceCodePath, newPath);

                    console.log(`📄 Reading file: ${currentFile}`);
                    if (fs.existsSync(currentFile)) {
                        try {
                            const content = fs.readFileSync(currentFile, 'utf-8');
                            fileLines = content.split('\n');
                            console.log(`✅ File read successfully: ${fileLines.length} lines`);
                        } catch (readError) {
                            console.error(`❌ Failed to read file ${currentFile}:`, (readError as Error).message);
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
                    const match = /@@ -(\d+),?\d* \+(\d+),?\d* @@/.exec(line);
                    if (match) {
                        inHunk = true;
                        hunkIndex = parseInt(match[2], 10) - 1;
                        console.log(`🎯 Hunk starting at line ${hunkIndex + 1}`);
                    } else {
                        console.warn(`⚠️ Invalid hunk header at line ${lineNumber}: ${line}`);
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
                console.error(`❌ Error processing line ${lineNumber}: "${line}"`, (lineError as Error).message);
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
            
            // フォールバック: 元のdiffをそのまま返す
            console.log('🔄 Fallback: returning original diff content');
            return diffOutput;
        }

        return result.trim(); // 余分な改行を削除して返す
    }
}

export default RestoreDiff;
