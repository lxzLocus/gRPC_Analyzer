import path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { DatasetAnalysisController } from './DatasetAnalysisController.js';

// 環境変数の読み込み
dotenvConfig({ path: '/app/.env' });

/**
 * 後方互換性のためのexport関数
 * @param {string} datasetDir - データセットディレクトリのパス
 * @param {string} aprOutputPath - APRログディレクトリのパス
 * @param {Object} options - 実行オプション（HTMLレポート生成設定等）
 * @returns {Promise<Object>} 解析結果の統計情報
 */
export async function datasetLoop(datasetDir, aprOutputPath, options = {}) {
    const controller = new DatasetAnalysisController();
    const stats = await controller.executeAnalysis(datasetDir, aprOutputPath, options);
    
    // HTMLレポート生成結果を統計に追加
    if (options.generateHTMLReport && stats.htmlReportResult) {
        stats.htmlReportResult = stats.htmlReportResult;
    }
    
    return stats;
}


