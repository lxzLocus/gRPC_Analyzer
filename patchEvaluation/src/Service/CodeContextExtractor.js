/**
 * コードコンテキスト抽出サービス
 * ground_truth_diffから変更箇所を特定し、周辺のコードスニペットを抽出します
 */
export class CodeContextExtractor {
    constructor() {
        this.contextLines = 15; // デフォルトの前後行数
    }

    /**
     * ground_truth_diffから変更箇所周辺のコードスニペットを抽出
     * @param {string} groundTruthDiff - ground truth diff文字列
     * @param {string} premergePath - premergeディレクトリのパス
     * @returns {Promise<string>} 抽出されたコードコンテキスト
     */
    async extractCodeContext(groundTruthDiff, premergePath) {
        if (!groundTruthDiff || !premergePath) {
            return "Insufficient information for code context extraction";
        }

        try {
            const changedFiles = this.parseChangedFilesFromDiff(groundTruthDiff);
            const codeSnippets = [];

            for (const fileChange of changedFiles) {
                const snippet = await this.extractFileSnippet(
                    fileChange, 
                    premergePath
                );
                if (snippet) {
                    codeSnippets.push(snippet);
                }
            }

            return this.formatCodeContext(codeSnippets);

        } catch (error) {
            console.error(`コードコンテキスト抽出エラー: ${error.message}`);
            return `Error occurred during code context extraction: ${error.message}`;
        }
    }

    /**
     * diffから変更されたファイルと行番号情報を解析
     * @param {string} diff - diff文字列
     * @returns {Array} 変更ファイル情報の配列
     */
    parseChangedFilesFromDiff(diff) {
        const changedFiles = [];
        const diffLines = diff.split('\n');
        let currentFile = null;
        let lineNumber = 0;

        for (const line of diffLines) {
            // ファイルヘッダーの検出 (--- a/file, +++ b/file)
            if (line.startsWith('--- a/') || line.startsWith('+++ b/')) {
                const filePath = line.substring(6); // "--- a/" または "+++ b/" を除去
                if (line.startsWith('+++ b/') && filePath !== '/dev/null') {
                    currentFile = {
                        filePath: filePath,
                        changes: []
                    };
                    changedFiles.push(currentFile);
                }
                continue;
            }

            // ハンクヘッダーの検出 (@@ -old_start,old_count +new_start,new_count @@)
            const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
            if (hunkMatch && currentFile) {
                const oldStart = parseInt(hunkMatch[1]);
                const newStart = parseInt(hunkMatch[3]);
                
                currentFile.changes.push({
                    oldStart: oldStart,
                    newStart: newStart,
                    contextStart: Math.max(1, oldStart - this.contextLines),
                    contextEnd: oldStart + this.contextLines
                });
                continue;
            }
        }

        return changedFiles;
    }

    /**
     * 特定ファイルのコードスニペットを抽出
     * @param {Object} fileChange - ファイル変更情報
     * @param {string} premergePath - premergeディレクトリのパス
     * @returns {Promise<Object|null>} ファイルスニペット情報
     */
    async extractFileSnippet(fileChange, premergePath) {
        const { readFile } = await import('fs/promises');
        const path = await import('path');

        try {
            const fullPath = path.join(premergePath, fileChange.filePath);
            const fileContent = await readFile(fullPath, 'utf8');
            const lines = fileContent.split('\n');

            // 全ての変更箇所のコンテキスト範囲を統合
            const allRanges = fileChange.changes.map(change => ({
                start: change.contextStart,
                end: Math.min(lines.length, change.contextEnd)
            }));

            // 重複する範囲をマージ
            const mergedRanges = this.mergeOverlappingRanges(allRanges);

            // 各範囲からコードスニペットを抽出
            const snippets = mergedRanges.map(range => {
                const snippetLines = lines.slice(range.start - 1, range.end)
                    .map((line, index) => `${(range.start + index).toString().padStart(4)}: ${line}`)
                    .join('\n');
                
                return {
                    startLine: range.start,
                    endLine: range.end,
                    content: snippetLines
                };
            });

            return {
                filePath: fileChange.filePath,
                snippets: snippets
            };

        } catch (error) {
            console.error(`ファイルスニペット抽出エラー (${fileChange.filePath}): ${error.message}`);
            return null;
        }
    }

    /**
     * 重複する行範囲をマージ
     * @param {Array} ranges - 行範囲の配列
     * @returns {Array} マージされた範囲の配列
     */
    mergeOverlappingRanges(ranges) {
        if (ranges.length === 0) return [];

        // 開始行でソート
        const sortedRanges = ranges.sort((a, b) => a.start - b.start);
        const merged = [sortedRanges[0]];

        for (let i = 1; i < sortedRanges.length; i++) {
            const current = sortedRanges[i];
            const last = merged[merged.length - 1];

            // 重複または隣接している場合はマージ
            if (current.start <= last.end + 1) {
                last.end = Math.max(last.end, current.end);
            } else {
                merged.push(current);
            }
        }

        return merged;
    }

    /**
     * コードコンテキストをフォーマット
     * @param {Array} codeSnippets - コードスニペットの配列
     * @returns {string} フォーマットされたコードコンテキスト
     */
    formatCodeContext(codeSnippets) {
        if (codeSnippets.length === 0) {
            return "No code context found around the changed areas";
        }

        const formattedSnippets = codeSnippets.map(fileSnippet => {
            const snippetTexts = fileSnippet.snippets.map(snippet => 
                `Lines ${snippet.startLine}-${snippet.endLine}:\n${snippet.content}`
            ).join('\n\n');

            return `File: ${fileSnippet.filePath}\n${snippetTexts}`;
        });

        return formattedSnippets.join('\n\n' + '='.repeat(80) + '\n\n');
    }

    /**
     * コンテキスト行数の設定
     * @param {number} lines - 前後に含める行数
     */
    setContextLines(lines) {
        this.contextLines = Math.max(5, Math.min(50, lines)); // 5-50行の範囲で制限
    }
}
