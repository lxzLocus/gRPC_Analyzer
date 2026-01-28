/**
 * キャッシュ機能付きControllerエントリーポイント
 * 既存のController.jsにキャッシュ機能を統合
 */
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { CachedDatasetAnalysisController } from './CachedDatasetAnalysisController.js';

// 環境変数の読み込み
dotenvConfig({ path: '/app/.env' });

/**
 * キャッシュ機能付きデータセット処理の統合関数
 * @param {string} datasetDir - データセットディレクトリのパス
 * @param {string} aprOutputPath - APRログディレクトリのパス
 * @param {Object} options - 実行オプション（HTMLレポート生成設定等）
 * @param {boolean} options.useCache - キャッシュ使用の有無 (default: true)
 * @param {boolean} options.clearCacheFirst - 実行前にキャッシュをクリアするか (default: false)
 * @param {number} options.concurrency - 並列処理数 (default: null 自動設定)
 * @returns {Promise<Object>} 解析結果の統計情報
 */
export async function cachedDatasetLoop(datasetDir, aprOutputPath, options = {}) {
    // キャッシュ機能をデフォルトで有効にする
    const {
        useCache = true,
        clearCacheFirst = false,
        concurrency = null,
        ...otherOptions
    } = options;

    // キャッシュ機能付きコントローラーを作成（並列処理対応）
    const controller = new CachedDatasetAnalysisController(null, useCache, concurrency);
    
    // キャッシュオプションを統合
    const fullOptions = {
        ...otherOptions,
        useCache,
        clearCacheFirst,
        concurrency
    };
    
    const stats = await controller.executeAnalysis(datasetDir, aprOutputPath, fullOptions);
    
    // HTMLレポート生成結果を統計に追加
    if (fullOptions.generateHTMLReport && stats.htmlReportResult) {
        stats.htmlReportResult = stats.htmlReportResult;
    }
    
    return stats;
}

/**
 * 後方互換性のためのレガシー関数（キャッシュ機能なし）
 * 既存のコードが動作するように元のDatasetAnalysisControllerを使用
 * @param {string} datasetDir - データセットディレクトリのパス
 * @param {string} aprOutputPath - APRログディレクトリのパス
 * @param {Object} options - 実行オプション（HTMLレポート生成設定等）
 * @returns {Promise<Object>} 解析結果の統計情報
 */
export async function datasetLoop(datasetDir, aprOutputPath, options = {}) {
    // 既存の実装を維持するため、元のControllerを動的にインポート
    const { DatasetAnalysisController } = await import('./DatasetAnalysisController.js');
    const controller = new DatasetAnalysisController();
    const stats = await controller.executeAnalysis(datasetDir, aprOutputPath, options);
    
    // HTMLレポート生成結果を統計に追加
    if (options.generateHTMLReport && stats.htmlReportResult) {
        stats.htmlReportResult = stats.htmlReportResult;
    }
    
    return stats;
}

/**
 * キャッシュ管理用ユーティリティ関数
 */
export class CacheManager {
    constructor() {
        this.controller = new CachedDatasetAnalysisController();
    }

    /**
     * キャッシュ統計を表示
     */
    async showCacheStats() {
        const stats = this.controller.getCacheStatistics();
        console.log('📈 現在のキャッシュ統計:');
        console.log(`   ヒット率: ${stats.hitRate}`);
        console.log(`   ヒット数: ${stats.hits}`);
        console.log(`   ミス数: ${stats.misses}`);
        console.log(`   メモリキャッシュサイズ: ${stats.memoryCacheSize}`);
        return stats;
    }

    /**
     * キャッシュをクリア
     */
    async clearCache() {
        console.log('🗑️ キャッシュをクリア中...');
        await this.controller.clearCache();
        console.log('✅ キャッシュをクリアしました');
    }

    /**
     * キャッシュサイズを制限
     * @param {number} maxFiles - 最大キャッシュファイル数
     */
    async limitCacheSize(maxFiles = 5000) {
        console.log(`📊 キャッシュサイズを${maxFiles}ファイルに制限中...`);
        await this.controller.limitCacheSize(maxFiles);
        console.log('✅ キャッシュサイズを制限しました');
    }

    /**
     * キャッシュ機能の有効/無効を切り替え
     * @param {boolean} enabled - キャッシュを有効にするか
     */
    setCacheEnabled(enabled) {
        this.controller.setCacheEnabled(enabled);
        console.log(`📈 キャッシュ機能: ${enabled ? '有効' : '無効'}`);
    }
}
