/**
 * キャッシュ機能付きDatasetRepositoryクラス
 * 元のDatasetRepositoryにキャッシュ機能を統合
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import getChangedFiles, { 
    getChangedFilesWithDiff, 
    getCacheStats, 
    clearCache, 
    limitCacheSize 
} from '../GenerateFileChanged_Cached.js';

export class CachedDatasetRepository {
    constructor(datasetPath = null, aprLogRootPath = null, useCache = true) {
        this.datasetPath = datasetPath;
        this.aprLogRootPath = aprLogRootPath;
        this.useCache = useCache;
    }

    /**
     * データセットディレクトリ内のプロジェクト一覧を取得
     * @param {string} datasetDir - データセットディレクトリのパス
     * @returns {Promise<string[]>} プロジェクト名の配列
     */
    async getProjectDirectories(datasetDir) {
        try {
            let entries;
            try {
                entries = await fs.readdir(datasetDir, { withFileTypes: true });
            } catch (readdirError) {
                if (readdirError.code === 'ENAMETOOLONG') {
                    console.warn(`⚠️ データセットディレクトリパス名が長すぎます: ${datasetDir}`);
                    return [];
                }
                throw readdirError;
            }
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
            let entries;
            try {
                entries = await fs.readdir(projectPath, { withFileTypes: true });
            } catch (readdirError) {
                if (readdirError.code === 'ENAMETOOLONG') {
                    console.warn(`⚠️ プロジェクトディレクトリパス名が長すぎます: ${projectPath}`);
                    return [];
                }
                throw readdirError;
            }
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
            let entries;
            try {
                entries = await fs.readdir(categoryPath, { withFileTypes: true });
            } catch (readdirError) {
                if (readdirError.code === 'ENAMETOOLONG') {
                    console.warn(`⚠️ カテゴリディレクトリパス名が長すぎます: ${categoryPath}`);
                    return [];
                }
                throw readdirError;
            }
            return entries
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
        } catch (error) {
            throw new Error(`プルリクエストディレクトリ取得エラー: ${error.message}`);
        }
    }

    /**
     * プルリクエストのパス情報を取得
     * @param {string} pullRequestPath - プルリクエストのパス
     * @returns {Promise<Object>} パス情報とバリデーション結果
     */
    async getPullRequestPaths(pullRequestPath) {
        try {
            // ディレクトリの中身を取得
            let entries;
            try {
                entries = await fs.readdir(pullRequestPath, { withFileTypes: true });
            } catch (readdirError) {
                if (readdirError.code === 'ENAMETOOLONG') {
                    console.warn(`⚠️ プルリクエストパス名が長すぎます: ${pullRequestPath}`);
                    return {
                        premergePath: null,
                        mergePath: null,
                        hasValidPaths: false
                    };
                }
                throw readdirError;
            }

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

            console.log(`🔍 プルリクエストパス確認:`);
            console.log(`   pullRequestPath: ${pullRequestPath}`);
            console.log(`   premergePath: ${premergePath}`);
            console.log(`   mergePath: ${mergePath}`);

            return {
                premergePath,
                mergePath,
                hasValidPaths: Boolean(premergePath && mergePath)
            };
        } catch (error) {
            throw new Error(`プルリクエストパス取得エラー: ${error.message}`);
        }
    }    /**
     * パスの存在確認
     * @param {string} targetPath - 確認対象のパス
     * @returns {Promise<boolean>} パスが存在するかどうか
     */
    async pathExists(targetPath) {
        try {
            await fs.access(targetPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * キャッシュ機能付き変更ファイル検出
     * @param {string} premergePath - premergeディレクトリのパス
     * @param {string} mergePath - mergeディレクトリのパス
     * @param {string} fileExtension - 対象ファイル拡張子（オプション）
     * @returns {Promise<string[]>} 変更されたファイルの相対パスの配列
     */
    async getChangedFiles(premergePath, mergePath, fileExtension = null) {
        try {
            if (!(await this.pathExists(premergePath)) || !(await this.pathExists(mergePath))) {
                throw new Error('指定されたパスが存在しません');
            }

            return await getChangedFiles(premergePath, mergePath, fileExtension, this.useCache);
        } catch (error) {
            throw new Error(`変更ファイル取得エラー: ${error.message}`);
        }
    }

    /**
     * キャッシュ機能付き変更ファイル・diff統合取得
     * @param {string} premergePath - premergeディレクトリのパス
     * @param {string} mergePath - mergeディレクトリのパス
     * @param {string} fileExtension - 対象ファイル拡張子（オプション）
     * @returns {Promise<Object>} { changedFiles: string[], groundTruthDiff: string }
     */
    async getChangedFilesWithDiff(premergePath, mergePath, fileExtension = null) {
        try {
            if (!(await this.pathExists(premergePath)) || !(await this.pathExists(mergePath))) {
                throw new Error('指定されたパスが存在しません');
            }

            return await getChangedFilesWithDiff(premergePath, mergePath, fileExtension, this.useCache);
        } catch (error) {
            throw new Error(`変更ファイル・diff取得エラー: ${error.message}`);
        }
    }

    /**
     * APRログファイルの相対パスを構築
     * @param {string} project - プロジェクト名
     * @param {string} category - カテゴリ（issue/pullrequest）
     * @param {string} pullRequest - プルリクエスト名
     * @returns {string} APRログファイルの相対パス
     */
    buildAPRLogPath(project, category, pullRequest) {
        // まず元のカテゴリでパスを構築
        const originalPath = path.join(this.aprLogRootPath, project, category, pullRequest);
        
        console.log(`🔍 APRログパス構築:`);
        console.log(`   project: ${project}`);
        console.log(`   category: ${category}`);
        console.log(`   pullRequest: ${pullRequest}`);
        console.log(`   元のパス: ${originalPath}`);
        
        // 元のカテゴリのパスが存在する場合はそのまま使用
        if (fsSync.existsSync(originalPath)) {
            console.log(`   ✅ 元のカテゴリで発見: ${originalPath}`);
            return originalPath;
        }
        
        // カテゴリマッピング: issue -> pullrequest
        let mappedCategory = category;
        if (category === 'issue') {
            mappedCategory = 'pullrequest';
            const mappedPath = path.join(this.aprLogRootPath, project, mappedCategory, pullRequest);
            console.log(`   🔄 issue→pullrequest変換: ${mappedPath}`);
            
            if (fsSync.existsSync(mappedPath)) {
                console.log(`   ✅ 変換後のカテゴリで発見: ${mappedPath}`);
                return mappedPath;
            }
        }
        
        // どちらも見つからない場合は元のパスを返す（後続で類似検索が行われる）
        console.log(`   ⚠️ どちらのカテゴリでも未発見, 元のパスを返す: ${originalPath}`);
        return originalPath;
    }

    /**
     * APRログファイル一覧を取得
     * @param {string} aprLogPath - APRログディレクトリのパス
     * @returns {Promise<string[]>} APRログファイルのパス配列
     */
    async getAPRLogFiles(aprLogPath) {
        try {
            // まず厳密一致を試行
            if (await this.pathExists(aprLogPath)) {
                let entries;
                try {
                    entries = await fs.readdir(aprLogPath, { withFileTypes: true });
                } catch (readdirError) {
                    if (readdirError.code === 'ENAMETOOLONG') {
                        console.warn(`⚠️ APRログパス名が長すぎます: ${aprLogPath}`);
                        return [];
                    }
                    throw readdirError;
                }
                
                const logFiles = entries
                    .filter(dirent => dirent.isFile() && dirent.name.endsWith('.log'))
                    .map(dirent => path.join(aprLogPath, dirent.name))
                    .sort(); // ソートして安定した順序を保証
                
                if (logFiles.length > 0) {
                    return logFiles;
                }
            }

            // 厳密一致しない場合、類似ディレクトリを検索
            console.log(`🔍 厳密一致しないため、類似ディレクトリを検索: ${aprLogPath}`);
            const similarPath = await this.findSimilarAPRDirectory(aprLogPath);
            
            if (similarPath && await this.pathExists(similarPath)) {
                console.log(`✅ 類似ディレクトリを発見: ${similarPath}`);
                let entries;
                try {
                    entries = await fs.readdir(similarPath, { withFileTypes: true });
                } catch (readdirError) {
                    if (readdirError.code === 'ENAMETOOLONG') {
                        console.warn(`⚠️ 類似ディレクトリパス名が長すぎます: ${similarPath}`);
                        return [];
                    }
                    throw readdirError;
                }
                
                const logFiles = entries
                    .filter(dirent => dirent.isFile() && dirent.name.endsWith('.log'))
                    .map(dirent => path.join(similarPath, dirent.name))
                    .sort();
                return logFiles;
            }

            return [];
        } catch (error) {
            throw new Error(`APRログファイル取得エラー: ${error.message}`);
        }
    }

    /**
     * 類似のAPRディレクトリを検索
     * @param {string} targetPath - 検索対象パス
     * @returns {Promise<string|null>} 類似ディレクトリのパス（見つからない場合はnull）
     */
    async findSimilarAPRDirectory(targetPath) {
        try {
            const pathParts = targetPath.split(path.sep);
            const pullRequestName = pathParts[pathParts.length - 1]; // 最後のディレクトリ名
            const parentDir = pathParts.slice(0, -1).join(path.sep); // 親ディレクトリ
            
            console.log(`🔍 類似検索: parentDir=${parentDir}, targetName=${pullRequestName}`);
            
            if (!(await this.pathExists(parentDir))) {
                return null;
            }

            let entries;
            try {
                entries = await fs.readdir(parentDir, { withFileTypes: true });
            } catch (readdirError) {
                if (readdirError.code === 'ENAMETOOLONG') {
                    console.warn(`⚠️ 親ディレクトリパス名が長すぎます: ${parentDir}`);
                    return null;
                }
                throw readdirError;
            }
            const directories = entries.filter(dirent => dirent.isDirectory());
            
            // 戦略1: 完全一致（念のため）
            for (const dir of directories) {
                if (dir.name === pullRequestName) {
                    const exactPath = path.join(parentDir, dir.name);
                    console.log(`✅ 完全一致ディレクトリ発見: ${dir.name}`);
                    return exactPath;
                }
            }
            
            // 戦略2: 部分文字列マッチング（データセット名 includes APRログ名）
            for (const dir of directories) {
                if (pullRequestName.includes(dir.name) || dir.name.includes(pullRequestName)) {
                    const partialPath = path.join(parentDir, dir.name);
                    console.log(`🎯 部分一致ディレクトリ発見: ${dir.name} (検索: ${pullRequestName})`);
                    return partialPath;
                }
            }
            
            // 戦略3: 文字列類似度による検索（従来の方法）
            let bestMatch = null;
            let bestSimilarity = 0;
            
            for (const dir of directories) {
                const similarity = this.calculateSimilarity(pullRequestName, dir.name);
                if (similarity > bestSimilarity && similarity > 0.7) { // 閾値を0.8から0.7に下げる
                    bestSimilarity = similarity;
                    bestMatch = dir.name;
                }
            }
            
            if (bestMatch) {
                const similarPath = path.join(parentDir, bestMatch);
                console.log(`🎯 類似度マッチディレクトリ発見: ${bestMatch} (類似度: ${bestSimilarity.toFixed(2)})`);
                return similarPath;
            }
            
            // 戦略4: 最後の手段 - プレフィックスマッチング
            const basePrefix = pullRequestName.split('_')[0]; // 最初のセグメントを取得
            if (basePrefix && basePrefix.length > 5) { // 短すぎるプレフィックスは避ける
                for (const dir of directories) {
                    if (dir.name.startsWith(basePrefix)) {
                        const prefixPath = path.join(parentDir, dir.name);
                        console.log(`🎯 プレフィックスマッチディレクトリ発見: ${dir.name} (プレフィックス: ${basePrefix})`);
                        return prefixPath;
                    }
                }
            }
            
            console.log(`❌ 類似ディレクトリが見つかりませんでした`);
            return null;
        } catch (error) {
            console.error(`類似ディレクトリ検索エラー: ${error.message}`);
            return null;
        }
    }

    /**
     * 文字列の類似度を計算（Levenshtein距離ベース）
     * @param {string} str1 - 文字列1
     * @param {string} str2 - 文字列2
     * @returns {number} 類似度（0-1）
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) {
            return 1.0;
        }
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Levenshtein距離を計算
     * @param {string} str1 - 文字列1
     * @param {string} str2 - 文字列2
     * @returns {number} 編集距離
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * 最新のAPRログファイルを取得
     * @param {string} aprLogPath - APRログディレクトリのパス
     * @returns {Promise<string|null>} 最新のAPRログファイルのパス（存在しない場合はnull）
     */
    async getLatestAPRLogFile(aprLogPath) {
        try {
            const logFiles = await this.getAPRLogFiles(aprLogPath);
            if (logFiles.length === 0) {
                return null;
            }

            // ファイル名の後ろから順にソートして最新を取得
            return logFiles[logFiles.length - 1];
        } catch (error) {
            throw new Error(`最新APRログファイル取得エラー: ${error.message}`);
        }
    }

    /**
     * ログファイルの内容を読み取り
     * @param {string} logFilePath - ログファイルのパス
     * @returns {Promise<string>} ログファイルの内容
     */
    async readLogFile(logFilePath) {
        try {
            if (!(await this.pathExists(logFilePath))) {
                throw new Error(`ログファイルが存在しません: ${logFilePath}`);
            }

            const content = await fs.readFile(logFilePath, 'utf8');
            return content.trim();
        } catch (error) {
            throw new Error(`ログファイル読み取りエラー: ${error.message}`);
        }
    }

    /**
     * JSONファイルの内容を読み取り・パース
     * @param {string} jsonFilePath - JSONファイルのパス
     * @returns {Promise<Object>} パースされたJSONオブジェクト
     */
    async readJSONFile(jsonFilePath) {
        try {
            if (!(await this.pathExists(jsonFilePath))) {
                throw new Error(`JSONファイルが存在しません: ${jsonFilePath}`);
            }

            const content = await fs.readFile(jsonFilePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`JSONファイル読み取りエラー: ${error.message}`);
        }
    }

    /**
     * JSONファイルに書き込み
     * @param {string} jsonFilePath - JSONファイルのパス
     * @param {Object} data - 書き込むデータ
     * @param {boolean} prettyPrint - 整形して出力するか（デフォルト: true）
     */
    async writeJSONFile(jsonFilePath, data, prettyPrint = true) {
        try {
            // ディレクトリを確実に作成
            const dir = path.dirname(jsonFilePath);
            await fs.mkdir(dir, { recursive: true });

            const jsonString = prettyPrint 
                ? JSON.stringify(data, null, 2)
                : JSON.stringify(data);

            await fs.writeFile(jsonFilePath, jsonString, 'utf8');
        } catch (error) {
            throw new Error(`JSONファイル書き込みエラー: ${error.message}`);
        }
    }

    /**
     * キャッシュ統計を取得
     * @returns {Object} キャッシュの統計情報
     */
    getCacheStatistics() {
        if (!this.useCache) {
            return { message: 'キャッシュは無効です' };
        }
        return getCacheStats();
    }

    /**
     * キャッシュをクリア
     */
    async clearDiffCache() {
        if (!this.useCache) {
            console.log('⚠️ キャッシュは無効です');
            return;
        }
        await clearCache();
    }

    /**
     * キャッシュサイズを制限
     * @param {number} maxFiles - 最大キャッシュファイル数
     */
    async limitDiffCacheSize(maxFiles = 5000) {
        if (!this.useCache) {
            console.log('⚠️ キャッシュは無効です');
            return;
        }
        await limitCacheSize(maxFiles);
    }

    /**
     * キャッシュを有効/無効に切り替え
     * @param {boolean} enabled - キャッシュを有効にするか
     */
    setCacheEnabled(enabled) {
        this.useCache = enabled;
        console.log(`📈 Diffキャッシュ: ${enabled ? '有効' : '無効'}`);
    }
}
