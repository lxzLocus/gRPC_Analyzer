/**
 * キャッシュ機能付きファイル変更検出モジュール
 * 元の GenerateFIleChanged.js にキャッシュ機能を追加
 */
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import DiffCache from './Cache/DiffCache.js';

// キャッシュインスタンス（シングルトン）
let diffCacheInstance = null;

/**
 * キャッシュインスタンスを取得（初回のみ作成）
 */
function getDiffCacheInstance() {
    if (!diffCacheInstance) {
        // プロジェクトルートにキャッシュディレクトリを作成
        const cacheDir = '/app/cache/diff-cache';
        diffCacheInstance = new DiffCache(cacheDir, 2000, true);
    }
    return diffCacheInstance;
}

// 無視するフォルダや拡張子を定義
const ignore = {
    folders: ['.git', 'node_modules', '.git_disabled'], // 無視するフォルダ
    extensions: ['.log', '.tmp'], // 無視する拡張子
};

/**
 * キャッシュ機能付きメイン比較関数
 * @param {string} premergePath - premergeディレクトリのパス
 * @param {string} mergePath - mergeディレクトリのパス  
 * @param {string} extension - 対象ファイル拡張子（オプション）
 * @param {boolean} useCache - キャッシュを使用するか（デフォルト: true）
 * @returns {Promise<string[]>} 変更されたファイルの相対パスの配列
 */
export default async function getChangedFiles(premergePath, mergePath, extension, useCache = true) {
    try {
        // 2つのディレクトリから対象ファイルリストを取得（無視リストを考慮）
        const premergeFiles = getFilesRecursive(premergePath, extension, ignore);
        
        const diffResults = [];
        const cache = useCache ? getDiffCacheInstance() : null;
        let cacheHits = 0;
        let cacheMisses = 0;

        // premerge と merge ディレクトリ内で同名のファイルを diff
        for (const file1 of premergeFiles) {
            const relativePath = path.relative(premergePath, file1);
            const file2 = path.join(mergePath, relativePath);

            if (fs.existsSync(file2)) {
                try {
                    let diffResult;
                    
                    if (cache) {
                        // キャッシュから結果を取得
                        diffResult = await cache.get(file1, file2);
                        
                        if (diffResult !== null) {
                            cacheHits++;
                        } else {
                            // キャッシュにない場合は実際にdiffを実行
                            diffResult = await diffFiles(file1, file2);
                            // 結果をキャッシュに保存
                            await cache.set(file1, file2, diffResult);
                            cacheMisses++;
                        }
                    } else {
                        // キャッシュ無効の場合は常に実行
                        diffResult = await diffFiles(file1, file2);
                    }
                    
                    if (diffResult) {
                        diffResults.push(relativePath);
                    }
                } catch (err) {
                    console.error(`Error comparing files: ${err.message}`);
                }
            } else {
                console.log(`No corresponding file for ${file1} in merge directory`);
            }
        }

        // キャッシュ統計を表示
        if (cache && (cacheHits > 0 || cacheMisses > 0)) {
            const stats = cache.getStats();
            console.log(`📈 Diffキャッシュ統計: ヒット率 ${stats.hitRate} (${cacheHits}/${cacheHits + cacheMisses})`);
        }

        console.log('Diff Results:', diffResults); // デバッグ用
        return diffResults;
    } catch (error) {
        console.error(error.message);
        throw error;
    }
}

/**
 * キャッシュ機能付きファイル差分検出（boolean返却版）
 * @param {string} file1 - 比較元ファイルのパス
 * @param {string} file2 - 比較先ファイルのパス
 * @returns {Promise<boolean>} 差分があるかどうか
 */
function diffFiles(file1, file2) {
    return new Promise((resolve, reject) => {
        console.log(`Running diff between: ${file1} and ${file2}`); // デバッグ用
        exec(`diff -u "${file1}" "${file2}"`, (err, stdout, stderr) => {
            if (err && err.code === 1) {
                // 差分が見つかる場合
                resolve(true);
            } else if (err) {
                // 予期しないエラー
                reject(new Error(`Error comparing ${file1} and ${file2}: ${err.message}`));
            } else if (stderr) {
                // スタンダードエラー出力
                reject(new Error(`Stderr: ${stderr}`));
            } else {
                resolve(false); // 差分なし
            }
        });
    });
}

/**
 * 指定されたディレクトリから再帰的にファイルを探索する関数
 * @param {string} dir - 検索を開始するディレクトリのパス
 * @param {string} extension - 対象とするファイルの拡張子（例: '.proto'）
 * @param {Object} ignore - 無視するフォルダや拡張子の設定
 * @returns {string[]} - 対象ファイルのパスの配列
 */
function getFilesRecursive(dir, extension, ignore) {
    let results = [];
    let list;
    
    try {
        list = fs.readdirSync(dir);
    } catch (error) {
        if (error.code === 'ENAMETOOLONG') {
            console.warn(`⚠️ パス名が長すぎてスキップ: ${dir}`);
            return results; // 空の結果を返す
        }
        throw error; // その他のエラーは再スロー
    }

    list.forEach(file => {
        const filePath = path.join(dir, file);
        let stat;
        
        try {
            stat = fs.statSync(filePath);
        } catch (error) {
            if (error.code === 'ENAMETOOLONG') {
                console.warn(`⚠️ ファイルパス名が長すぎてスキップ: ${filePath}`);
                return; // このファイルをスキップ
            }
            throw error;
        }

        // 無視するフォルダをスキップ
        if (stat.isDirectory()) {
            if (!ignore.folders.includes(file)) {
                results = results.concat(getFilesRecursive(filePath, extension, ignore));
            }
        } else {
            // 無視する拡張子をスキップ
            const fileExt = path.extname(file);
            if (!ignore.extensions.includes(fileExt) && (!extension || file.endsWith(extension))) {
                results.push(filePath);
            }
        }
    });

    return results;
}

/**
 * キャッシュ機能付き詳細なdiff取得（diff文字列返却版）
 * @param {string} file1 - 比較元ファイルのパス
 * @param {string} file2 - 比較先ファイルのパス
 * @param {string} relativePath - 相対パス（diff表示用）
 * @param {boolean} useCache - キャッシュを使用するか（デフォルト: true）
 * @returns {Promise<string|null>} diff文字列（差分がない場合はnull）
 */
async function generateFileDiff(file1, file2, relativePath, useCache = true) {
    const cache = useCache ? getDiffCacheInstance() : null;
    
    if (cache) {
        // キャッシュキーにrelativePathも含める特別なキー生成
        const cacheKey = await cache.generateCacheKey(file1, file2) + ':diff:' + relativePath;
        
        // キャッシュから取得を試行
        const cached = cache.getFromMemory(cacheKey) || await cache.getFromDisk(cacheKey);
        if (cached !== null) {
            return cached;
        }
    }
    
    return new Promise((resolve, reject) => {
        exec(`diff -u "${file1}" "${file2}"`, async (err, stdout, stderr) => {
            let result;
            
            if (err && err.code === 1) {
                // 差分が見つかる場合
                // diffヘッダーを統一フォーマットに変更
                const formattedDiff = stdout
                    .replace(/^--- (.+)$/gm, `--- a/${relativePath}`)
                    .replace(/^\+\+\+ (.+)$/gm, `+++ b/${relativePath}`);
                
                result = `diff --git a/${relativePath} b/${relativePath}\n${formattedDiff}`;
            } else if (err) {
                // 予期しないエラー
                reject(new Error(`Error generating diff for ${file1} and ${file2}: ${err.message}`));
                return;
            } else if (stderr) {
                // スタンダードエラー出力
                reject(new Error(`Stderr: ${stderr}`));
                return;
            } else {
                result = null; // 差分なし
            }
            
            // 結果をキャッシュに保存
            if (cache) {
                const cacheKey = await cache.generateCacheKey(file1, file2) + ':diff:' + relativePath;
                cache.setToMemory(cacheKey, result);
                await cache.setToDisk(cacheKey, result);
            }
            
            resolve(result);
        });
    });
}

/**
 * キャッシュ機能付き統合diff生成
 * @param {string} premergePath - premergeディレクトリのパス
 * @param {string} mergePath - mergeディレクトリのパス
 * @param {string[]} changedFilePaths - 変更されたファイルの相対パスリスト
 * @param {boolean} useCache - キャッシュを使用するか（デフォルト: true）
 * @returns {Promise<string>} 統合されたdiff文字列
 */
export async function generateGroundTruthDiff(premergePath, mergePath, changedFilePaths, useCache = true) {
    if (!changedFilePaths || changedFilePaths.length === 0) {
        return '';
    }

    const diffParts = [];

    for (const relativePath of changedFilePaths) {
        try {
            const file1 = path.join(premergePath, relativePath);
            const file2 = path.join(mergePath, relativePath);

            // ファイルの存在確認
            const file1Exists = fs.existsSync(file1);
            const file2Exists = fs.existsSync(file2);

            if (file1Exists && file2Exists) {
                // 両方のファイルが存在する場合、通常のdiffを生成
                const diffResult = await generateFileDiff(file1, file2, relativePath, useCache);
                if (diffResult) {
                    diffParts.push(diffResult);
                }
            } else if (!file1Exists && file2Exists) {
                // ファイルが新規追加された場合
                const content = fs.readFileSync(file2, 'utf8');
                const lines = content.split('\n');
                let newFileDiff = `diff --git a/${relativePath} b/${relativePath}\n`;
                newFileDiff += `new file mode 100644\n`;
                newFileDiff += `index 0000000..1234567\n`;
                newFileDiff += `--- /dev/null\n`;
                newFileDiff += `+++ b/${relativePath}\n`;
                newFileDiff += `@@ -0,0 +1,${lines.length} @@\n`;
                lines.forEach(line => {
                    newFileDiff += `+${line}\n`;
                });
                diffParts.push(newFileDiff);
            } else if (file1Exists && !file2Exists) {
                // ファイルが削除された場合
                const content = fs.readFileSync(file1, 'utf8');
                const lines = content.split('\n');
                let deletedFileDiff = `diff --git a/${relativePath} b/${relativePath}\n`;
                deletedFileDiff += `deleted file mode 100644\n`;
                deletedFileDiff += `index 1234567..0000000\n`;
                deletedFileDiff += `--- a/${relativePath}\n`;
                deletedFileDiff += `+++ /dev/null\n`;
                deletedFileDiff += `@@ -1,${lines.length} +0,0 @@\n`;
                lines.forEach(line => {
                    deletedFileDiff += `-${line}\n`;
                });
                diffParts.push(deletedFileDiff);
            }
        } catch (error) {
            console.error(`⚠️ ファイル差分生成エラー (${relativePath}): ${error.message}`);
            // 個別ファイルのエラーは継続
        }
    }

    return diffParts.join('\n');
}

/**
 * キャッシュ機能付き変更ファイル・diff統合取得
 * @param {string} premergePath - premergeディレクトリのパス
 * @param {string} mergePath - mergeディレクトリのパス
 * @param {string} extension - 対象ファイル拡張子（オプション）
 * @param {boolean} useCache - キャッシュを使用するか（デフォルト: true）
 * @returns {Promise<Object>} { changedFiles: string[], groundTruthDiff: string }
 */
export async function getChangedFilesWithDiff(premergePath, mergePath, extension = null, useCache = true) {
    try {
        // 変更されたファイルパスを取得
        const changedFiles = await getChangedFiles(premergePath, mergePath, extension, useCache);
        
        // 統合されたdiffを生成
        const groundTruthDiff = await generateGroundTruthDiff(premergePath, mergePath, changedFiles, useCache);
        
        return {
            changedFiles,
            groundTruthDiff
        };
    } catch (error) {
        console.error(`変更ファイル・diff取得エラー: ${error.message}`);
        return {
            changedFiles: [],
            groundTruthDiff: ''
        };
    }
}

/**
 * キャッシュ統計を取得
 */
export function getCacheStats() {
    if (diffCacheInstance) {
        return diffCacheInstance.getStats();
    }
    // キャッシュが初期化されていない場合のデフォルト値
    return {
        hitRate: '0%',
        hits: 0,
        misses: 0,
        memoryCacheSize: 0,
        diskCacheSize: 0,
        message: 'キャッシュは初期化されていません'
    };
}

/**
 * キャッシュをクリア
 */
export async function clearCache() {
    if (diffCacheInstance) {
        await diffCacheInstance.clear();
        console.log('✅ Diffキャッシュをクリアしました');
    }
}

/**
 * キャッシュサイズを制限
 */
export async function limitCacheSize(maxFiles = 5000) {
    if (diffCacheInstance) {
        await diffCacheInstance.limitDiskCacheSize(maxFiles);
        console.log(`✅ キャッシュサイズを${maxFiles}ファイルに制限しました`);
    }
}
