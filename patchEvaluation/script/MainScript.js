import fs from "fs";
import path from "path";
import { datasetLoop } from './Controller.js';
import { config as dotenvConfig } from 'dotenv';

// 環境変数の読み込み
dotenvConfig({ path: '/app/.env' });

if (import.meta.url === `file://${process.argv[1]}`) {
    // データセット選択（利用可能なデータセット）
    const availableDatasets = [
        "/app/dataset/filtered_fewChanged",     // 少数変更ファイル
        "/app/dataset/filtered_confirmed",     // 確認済み
        "/app/dataset/filtered_commit",        // コミット履歴
        "/app/dataset/filtered_protoChanged"   // プロトコル変更
    ];
    
    // 現在選択されているデータセット
    const selectedDataset = availableDatasets[0]; // filtered_fewChanged を選択
    const aprOutputPath = "/app/apr-logs";

    console.log('🚀 データセット分析を開始');
    console.log(`📂 選択されたデータセット: ${selectedDataset}`);
    console.log(`📁 APRログパス: ${aprOutputPath}`);
    console.log('=============================================\n');

    datasetLoop(selectedDataset, aprOutputPath)
        .then((stats) => {
            console.log('\n🎉 分析が正常に完了しました！');
            console.log(`✅ ${stats.aprParseSuccess}/${stats.totalDatasetEntries} のマッチングペアが成功`);
            
            if (stats.aprParseSuccess > 0) {
                console.log(`📊 成功率: ${(stats.aprParseSuccess/stats.totalDatasetEntries*100).toFixed(1)}%`);
            }
        })
        .catch(err => {
            console.error("❌ 分析中にエラーが発生:", err);
            console.error("スタックトレース:", err.stack);
        });
}

