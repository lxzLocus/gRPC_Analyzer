const fs = require('fs');
const path = require('path');

class RestoreDiff {
    constructor(sourceCodePath) {
        this.sourceCodePath = sourceCodePath;
    }

    applyDiff(diffOutput) {
        const lines = diffOutput.split('\n');
        let currentFile = null;
        let relativePath = null;
        let fileLines = [];
        let inHunk = false;
        let hunkIndex = 0;
        let result = ''; // すべての修正内容を文字列型でまとめる

        lines.forEach(line => {
            if (line.startsWith('--- ')) {
                // 1つ前のファイルの内容をresultに追加
                if (relativePath && fileLines.length > 0) {
                    result += `--- ${relativePath}\n`;
                    result += fileLines.join('\n') + '\n\n';
                }

                // 新しいファイルの処理を開始
                relativePath = line.substring(4).trim().replace(/^a\//, '');
                fileLines = []; // 新しいファイルの内容を初期化
            } else if (line.startsWith('+++ ')) {
                const newPath = line.substring(4).trim().replace(/^b\//, '');
                currentFile = path.join(this.sourceCodePath, newPath);

                if (fs.existsSync(currentFile)) {
                    fileLines = fs.readFileSync(currentFile, 'utf-8').split('\n');
                } else {
                    console.warn(`File not found: ${currentFile}`);
                    fileLines = [];
                }

                inHunk = false;
                hunkIndex = 0;
            } else if (line.startsWith('@@')) {
                const match = /@@ -(\d+),?\d* \+(\d+),?\d* @@/.exec(line);
                if (match) {
                    inHunk = true;
                    hunkIndex = parseInt(match[2], 10) - 1;
                }
            } else if (inHunk && currentFile !== null) {
                if (line.startsWith('-')) {
                    const expectedLine = line.substring(1);
                    if (fileLines[hunkIndex] === expectedLine) {
                        fileLines.splice(hunkIndex, 1);
                    }
                } else if (line.startsWith('+')) {
                    const addedLine = line.substring(1);
                    fileLines.splice(hunkIndex, 0, addedLine);
                    hunkIndex++;
                } else {
                    hunkIndex++;
                }
            }
        });

        // 最後のファイルの内容をresultに追加
        if (relativePath && fileLines.length > 0) {
            result += `--- ${relativePath}\n`;
            result += fileLines.join('\n') + '\n';
        }

        return result.trim(); // 余分な改行を削除して返す
    }
}

module.exports = RestoreDiff;
