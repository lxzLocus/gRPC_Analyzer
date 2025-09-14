import fs from 'fs/promises';
import path from 'path';
import APRLogParser from '../aprLogParser.js';

/**
 * APRログ処理に関するビジネスロジックを担当するサービスクラス
 */
export class APRLogService {
    constructor() {
        this.aprLogParser = new APRLogParser();
    }

    /**
     * APRログの存在確認と基本情報取得
     * @param {string} aprLogPath - APRログディレクトリのパス
     * @returns {Promise<Object>} APRログの存在情報
     */
    async checkAPRLogExistence(aprLogPath) {
        const result = {
            exists: false,
            accessible: false,
            logFiles: [],
            error: null
        };

        try {
            const aprLogStats = await fs.stat(aprLogPath);
            if (aprLogStats.isDirectory()) {
                let files;
                try {
                    files = await fs.readdir(aprLogPath);
                } catch (readdirError) {
                    if (readdirError.code === 'ENAMETOOLONG') {
                        result.error = 'APRログディレクトリのパス名が長すぎます';
                        return result;
                    }
                    throw readdirError;
                }
                
                result.logFiles = files.filter(file => file.endsWith('.log'));
                
                if (result.logFiles.length > 0) {
                    result.exists = true;
                    result.accessible = true;
                } else {
                    result.error = 'APRログディレクトリは存在するが.logファイルなし';
                }
            } else {
                result.error = 'APRログが存在しません（ディレクトリではない）';
            }
        } catch (error) {
            if (error.code === 'ENAMETOOLONG') {
                result.error = 'APRログパス名が長すぎます';
            } else {
                result.error = `APRログアクセスエラー: ${error.message}`;
            }
        }

        return result;
    }

    /**
     * APRログの解析実行
     * @param {string} aprLogPath - APRログディレクトリのパス
     * @returns {Promise<Object>} 解析結果
     */
    async parseAPRLog(aprLogPath) {
        try {
            const aprLogData = await this.aprLogParser.parseLogEntry(aprLogPath);
            
            if (!aprLogData || !aprLogData.turns || aprLogData.turns.length === 0) {
                return {
                    success: false,
                    error: 'APRログの解析に失敗: 空のデータまたは無効な形式',
                    data: null
                };
            }

            // 差分分析の実行
            const diffAnalysis = this.aprLogParser.analyzeDifferences(aprLogData);
            
            return {
                success: true,
                error: null,
                data: {
                    aprLogData,
                    diffAnalysis
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `APRログ解析エラー: ${error.message}`,
                data: null
            };
        }
    }

    /**
     * 最終修正内容の抽出と処理
     * テンプレート変数{{agent_generated_diff}}に格納されるdiffを抽出
     * @param {Object} aprLogData - APRログデータ
     * @returns {Object} 最終修正情報
     */
    extractFinalModifications(aprLogData) {
        const finalMods = this.aprLogParser.extractFinalModifications(aprLogData);
        
        if (!finalMods.lastModification) {
            return {
                hasModification: false,
                finalModInfo: null,
                aprDiffFiles: []
            };
        }

        // diffからファイルパスリストを抽出
        const aprDiffFiles = this.extractFilePathsFromDiff(finalMods.lastModification.diff);
        
        const finalModInfo = {
            turn: finalMods.lastModification.turn,
            timestamp: finalMods.lastModification.timestamp,
            diffLines: finalMods.lastModification.diff.split('\n').length,
            affectedFiles: aprDiffFiles,
            diff: finalMods.lastModification.diff  // ←このdiffが{{agent_generated_diff}}として使用される
        };

        return {
            hasModification: true,
            finalModInfo,
            aprDiffFiles
        };
    }

    /**
     * diffからファイルパスリストを抽出
     * @param {string} diffText - diff文字列
     * @returns {string[]} ファイルパスの配列
     */
    extractFilePathsFromDiff(diffText) {
        const filePaths = [];
        const diffLines = diffText.split('\n');
        
        for (const line of diffLines) {
            // diffのファイル開始行例: "diff --git a/src/foo.js b/src/foo.js"
            const match = line.match(/^diff --git a\/(.+?) b\//);
            if (match) {
                filePaths.push(match[1]);
            }
            // 追加: "--- a/path" や "+++ b/path" も考慮
            const match2 = line.match(/^--- a\/(.+)$/);
            if (match2) {
                filePaths.push(match2[1]);
            }
            const match3 = line.match(/^\+\+\+ b\/(.+)$/);
            if (match3) {
                filePaths.push(match3[1]);
            }
        }
        
        // 重複除去
        return [...new Set(filePaths)];
    }

    /**
     * Ground Truth Diffの作成
     * @param {string} premergePath - premergeディレクトリのパス
     * @param {string} mergePath - mergeディレクトリのパス
     * @param {string[]} targetFiles - 対象ファイルのリスト
     * @returns {Promise<string|null>} 作成されたdiff文字列
     */
    async createGroundTruthDiff(premergePath, mergePath, targetFiles) {
        if (!targetFiles || targetFiles.length === 0) {
            return null;
        }

        try {
            const { execSync } = await import('child_process');
            let combinedDiff = '';
            
            for (const filePath of targetFiles) {
                try {
                    const premergeFile = path.join(premergePath, filePath);
                    const mergeFile = path.join(mergePath, filePath);
                    
                    // ファイルの存在確認
                    const [premergeExists, mergeExists] = await Promise.allSettled([
                        fs.access(premergeFile),
                        fs.access(mergeFile)
                    ]);
                    
                    if (premergeExists.status === 'fulfilled' && mergeExists.status === 'fulfilled') {
                        // 両方のファイルが存在する場合、diffを作成
                        const diffCommand = `diff -u "${premergeFile}" "${mergeFile}" || true`;
                        const diffOutput = execSync(diffCommand, { encoding: 'utf8', stdio: 'pipe' });
                        
                        if (diffOutput.trim()) {
                            // diffヘッダーを統一フォーマットに変更
                            const formattedDiff = diffOutput
                                .replace(/^--- (.+)$/gm, `--- a/${filePath}`)
                                .replace(/^\+\+\+ (.+)$/gm, `+++ b/${filePath}`);
                            
                            combinedDiff += `diff --git a/${filePath} b/${filePath}\n${formattedDiff}\n`;
                        }
                    } else if (premergeExists.status === 'rejected' && mergeExists.status === 'fulfilled') {
                        // ファイルが新規追加された場合
                        const content = await fs.readFile(mergeFile, 'utf8');
                        const lines = content.split('\n');
                        combinedDiff += `diff --git a/${filePath} b/${filePath}\n`;
                        combinedDiff += `new file mode 100644\n`;
                        combinedDiff += `index 0000000..1234567\n`;
                        combinedDiff += `--- /dev/null\n`;
                        combinedDiff += `+++ b/${filePath}\n`;
                        combinedDiff += `@@ -0,0 +1,${lines.length} @@\n`;
                        lines.forEach(line => {
                            combinedDiff += `+${line}\n`;
                        });
                    } else if (premergeExists.status === 'fulfilled' && mergeExists.status === 'rejected') {
                        // ファイルが削除された場合
                        const content = await fs.readFile(premergeFile, 'utf8');
                        const lines = content.split('\n');
                        combinedDiff += `diff --git a/${filePath} b/${filePath}\n`;
                        combinedDiff += `deleted file mode 100644\n`;
                        combinedDiff += `index 1234567..0000000\n`;
                        combinedDiff += `--- a/${filePath}\n`;
                        combinedDiff += `+++ /dev/null\n`;
                        combinedDiff += `@@ -1,${lines.length} +0,0 @@\n`;
                        lines.forEach(line => {
                            combinedDiff += `-${line}\n`;
                        });
                    }
                } catch (fileError) {
                    console.error(`    ⚠️ ファイル差分作成エラー (${filePath}): ${fileError.message}`);
                    // 個別ファイルのエラーは継続
                }
            }
            
            return combinedDiff.trim() || null;
            
        } catch (error) {
            console.error(`  Ground Truth Diff作成エラー:`, error.message);
            return null;
        }
    }
}
