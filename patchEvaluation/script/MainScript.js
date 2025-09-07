import { config as dotenvConfig } from 'dotenv';

import { datasetLoop } from '../src/Controller/Controller.js';

// 環境変数の読み込み
dotenvConfig({ path: '/app/.env' });

if (import.meta.url === `file://${process.argv[1]}`) {
    // データセット選択（利用可能なデータセット）
    const availableDatasets = [
        "/app/dataset/filtered_fewChanged",     // 少数変更ファイル
        "/app/dataset/filtered_confirmed",     // 確認済み
        "/app/dataset/filtered_commit",        // コミット履歴
        "/app/dataset/filtered_protoChanged",   // プロトコル変更
        "/app/dataset/test_fewChanged"
    ];
    
    // 現在選択されているデータセット
    const selectedDataset = availableDatasets[0]; // filtered_fewChanged を選択
    const aprOutputPath = "/app/apr-logs";

    // HTMLレポート生成オプション
    const reportOptions = {
        generateHTMLReport: true,       // HTMLレポート生成
        generateErrorReport: true,      // エラーレポート生成
        generateDetailReports: false    // 詳細レポート生成（最初の10件）
    };

    console.log('🚀 データセット分析を開始');
    console.log(`📂 選択されたデータセット: ${selectedDataset}`);
    console.log(`📁 APRログパス: ${aprOutputPath}`);
    console.log(`📊 HTMLレポート生成: ${reportOptions.generateHTMLReport ? '有効' : '無効'}`);
    console.log(`❌ エラーレポート生成: ${reportOptions.generateErrorReport ? '有効' : '無効'}`);
    console.log(`📝 詳細レポート生成: ${reportOptions.generateDetailReports ? '有効' : '無効'}`);
    console.log('=============================================\n');

    datasetLoop(selectedDataset, aprOutputPath, reportOptions)
        .then((stats) => {
            console.log('\n🎉 分析が正常に完了しました！');
            console.log(`✅ ${stats.aprParseSuccess}/${stats.totalDatasetEntries} のマッチングペアが成功`);
            
            if (stats.aprParseSuccess > 0) {
                console.log(`📊 成功率: ${(stats.aprParseSuccess/stats.totalDatasetEntries*100).toFixed(1)}%`);
            }
            
            // HTMLレポート情報の表示
            if (stats.htmlReportResult && stats.htmlReportResult.success) {
                console.log('\n📊 HTMLレポート生成結果:');
                console.log(`🆔 セッションID: ${stats.htmlReportResult.sessionId}`);
                console.log(`📄 生成レポート数: ${stats.htmlReportResult.totalReports}`);
                console.log(`📋 サマリーページ: file://${stats.htmlReportResult.summaryPath}`);
                console.log('\n🔗 ブラウザでレポートを確認してください。');
            }
        })
        .catch(err => {
            console.error("❌ 分析中にエラーが発生:", err);
            console.error("スタックトレース:", err.stack);
        });
}

