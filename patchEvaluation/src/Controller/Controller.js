import path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { DatasetAnalysisController } from './DatasetAnalysisController.js';

// 環境変数の読み込み
dotenvConfig({ path: '/app/.env' });

/**
 * 後方互換性のためのexport関数
 * @param {string} datasetDir - データセットディレクトリのパス
 * @param {string} aprOutputPath - APRログディレクトリのパス
 * @returns {Promise<Object>} 解析結果の統計情報
 */
export async function datasetLoop(datasetDir, aprOutputPath) {
    const controller = new DatasetAnalysisController();
    return await controller.executeAnalysis(datasetDir, aprOutputPath);
}


