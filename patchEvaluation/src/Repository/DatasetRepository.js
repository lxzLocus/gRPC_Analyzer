import fs from 'fs/promises';
import path from 'path';
import getChangedFiles, { getChangedFilesWithDiff } from '../GenerateFIleChanged.js';

/**
 * データセットファイルシステムへのアクセスを担当するRepositoryクラス
 */
export class DatasetRepository {
    /**
     * データセットディレクトリ内のプロジェクト一覧を取得
     * @param {string} datasetDir - データセットディレクトリのパス
     * @returns {Promise<string[]>} プロジェクト名の配列
     */
    async getProjectDirectories(datasetDir) {
        try {
            const entries = await fs.readdir(datasetDir, { withFileTypes: true });
            return entries
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
        } catch (error) {
            throw new Error(`プロジェクトディレクトリ取得エラー: ${error.message}`);
        }
    }

    /**
     * プロジェクト内のカテゴリディレクトリ一覧を取得
     * @param {string} projectPath - プロジェクトディレクトリのパス
     * @returns {Promise<string[]>} カテゴリ名の配列
     */
    async getCategoryDirectories(projectPath) {
        try {
            const entries = await fs.readdir(projectPath, { withFileTypes: true });
            return entries
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
        } catch (error) {
            throw new Error(`カテゴリディレクトリ取得エラー: ${error.message}`);
        }
    }

    /**
     * カテゴリ内のプルリクエストディレクトリ一覧を取得
     * @param {string} categoryPath - カテゴリディレクトリのパス
     * @returns {Promise<string[]>} プルリクエストディレクトリ名の配列
     */
    async getPullRequestDirectories(categoryPath) {
        try {
            const entries = await fs.readdir(categoryPath, { withFileTypes: true });
            return entries
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
        } catch (error) {
            throw new Error(`プルリクエストディレクトリ取得エラー: ${error.message}`);
        }
    }

    /**
     * premergeとmergeディレクトリのパスを取得
     * @param {string} pullRequestPath - プルリクエストディレクトリのパス
     * @returns {Promise<Object>} { premergePath, mergePath, hasValidPaths }
     */
    async getPullRequestPaths(pullRequestPath) {
        try {
            const entries = await fs.readdir(pullRequestPath, { withFileTypes: true });

            // premergeパスを取得
            const premergePath = entries
                .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('premerge'))
                .map(dirent => path.join(pullRequestPath, dirent.name))[0];

            // 先に"commit_snapshot_"で始まるサブディレクトリを探す
            let mergePath = entries
                .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('commit_snapshot_'))
                .map(dirent => path.join(pullRequestPath, dirent.name))[0];
            
            // "commit_snapshot_"がなければ"merge_"を探す
            if (!mergePath) {
                mergePath = entries
                    .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('merge'))
                    .map(dirent => path.join(pullRequestPath, dirent.name))[0];
            }

            return {
                premergePath,
                mergePath,
                hasValidPaths: Boolean(premergePath && mergePath)
            };
        } catch (error) {
            throw new Error(`プルリクエストパス取得エラー: ${error.message}`);
        }
    }

    /**
     * 変更されたファイルのパス一覧を取得
     * @param {string} premergePath - premergeディレクトリのパス
     * @param {string} mergePath - mergeディレクトリのパス
     * @param {string} fileExtension - 対象ファイル拡張子（オプション）
     * @returns {Promise<string[]>} 変更されたファイルパスの配列
     */
    async getChangedFiles(premergePath, mergePath, fileExtension = null) {
        if (!premergePath || !mergePath) {
            return [];
        }

        try {
            return await getChangedFiles(premergePath, mergePath, fileExtension);
        } catch (error) {
            console.error(`差分解析エラー: ${error.message}`);
            return [];
        }
    }

    /**
     * 変更されたファイルのパス一覧とdiffを同時に取得
     * @param {string} premergePath - premergeディレクトリのパス
     * @param {string} mergePath - mergeディレクトリのパス
     * @param {string} fileExtension - 対象ファイル拡張子（オプション）
     * @returns {Promise<Object>} { changedFiles: string[], groundTruthDiff: string }
     */
    async getChangedFilesWithDiff(premergePath, mergePath, fileExtension = null) {
        if (!premergePath || !mergePath) {
            return {
                changedFiles: [],
                groundTruthDiff: ''
            };
        }

        try {
            return await getChangedFilesWithDiff(premergePath, mergePath, fileExtension);
        } catch (error) {
            console.error(`差分解析エラー: ${error.message}`);
            return {
                changedFiles: [],
                groundTruthDiff: ''
            };
        }
    }

    /**
     * APRログディレクトリのパスを構築
     * @param {string} aprOutputPath - APRログルートパス
     * @param {string} datasetDir - データセットディレクトリのパス
     * @param {string} pullRequestPath - プルリクエストディレクトリのパス
     * @returns {string} APRログの相対パス
     */
    buildAPRLogPath(aprOutputPath, datasetDir, pullRequestPath) {
        return path.join(aprOutputPath, path.relative(datasetDir, pullRequestPath));
    }

    /**
     * ディレクトリ比較による変更ファイル検出の代替関数
     * @param {string} dir1 - 比較元ディレクトリ
     * @param {string} dir2 - 比較先ディレクトリ
     * @returns {Promise<string[]>} 変更されたファイルの配列
     */
    async compareDirectoriesForChanges(dir1, dir2) {
        const changedFiles = [];
        
        try {
            const files1 = await this.getAllFilesRecursive(dir1);
            const files2 = await this.getAllFilesRecursive(dir2);

            // dir1の各ファイルをdir2と比較
            for (const file1 of files1) {
                const relativePath = path.relative(dir1, file1);
                const file2 = path.join(dir2, relativePath);

                try {
                    if (await this.fileExists(file2)) {
                        const content1 = await fs.readFile(file1, 'utf8');
                        const content2 = await fs.readFile(file2, 'utf8');
                        
                        if (content1 !== content2) {
                            changedFiles.push(relativePath);
                        }
                    } else {
                        // dir2にファイルが存在しない場合は削除されたとみなす
                        changedFiles.push(relativePath);
                    }
                } catch (error) {
                    console.error(`ファイル比較エラー (${relativePath}): ${error.message}`);
                }
            }

            // dir2にのみ存在するファイル（新規追加）
            for (const file2 of files2) {
                const relativePath = path.relative(dir2, file2);
                const file1 = path.join(dir1, relativePath);

                if (!(await this.fileExists(file1))) {
                    changedFiles.push(relativePath);
                }
            }

        } catch (error) {
            console.error(`ディレクトリ比較エラー: ${error.message}`);
        }

        return [...new Set(changedFiles)]; // 重複除去
    }

    /**
     * ディレクトリ内のすべてのファイルを再帰的に取得
     * @param {string} dir - 検索対象ディレクトリ
     * @returns {Promise<string[]>} ファイルパスの配列
     */
    async getAllFilesRecursive(dir) {
        const files = [];
        
        async function scan(currentDir) {
            try {
                const entries = await fs.readdir(currentDir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(currentDir, entry.name);
                    
                    if (entry.isDirectory()) {
                        // 無視ディレクトリをスキップ
                        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                            await scan(fullPath);
                        }
                    } else {
                        files.push(fullPath);
                    }
                }
            } catch (error) {
                console.error(`ディレクトリスキャンエラー (${currentDir}): ${error.message}`);
            }
        }

        await scan(dir);
        return files;
    }

    /**
     * ファイルの存在確認
     * @param {string} filePath - 確認対象ファイルパス
     * @returns {Promise<boolean>} ファイルが存在するかどうか
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
