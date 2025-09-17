import { config as dotenvConfig } from 'dotenv';
import path from 'path';

import { datasetLoop } from '../src/Controller/Controller.js';

// 環境変数の読み込み
dotenvConfig({ path: '/app/.env' });

if (import.meta.url === `file://${process.argv[1]}`) {
    // コマンドライン引数の解析
    function parseArgs() {
        const args = process.argv.slice(2);
        const parsed = {};
        const positional = [];
        
        console.log('🔧 Raw args:', args);
        
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
                if (arg.includes('=')) {
                    // --key=value 形式
                    const [key, ...valueParts] = arg.slice(2).split('=');
                    const value = valueParts.join('=');
                    console.log(`🔧 Processing (=): ${key} = ${value}`);
                    parsed[key] = value;
                } else {
                    // --key value 形式
                    const key = arg.slice(2);
                    const value = args[i + 1];
                    console.log(`🔧 Processing (space): ${key} = ${value}`);
                    if (value && !value.startsWith('--')) {
                        parsed[key] = value;
                        i++; // Skip the value
                    } else {
                        // Boolean flag without value
                        parsed[key] = true;
                    }
                }
            } else {
                // Positional argument
                positional.push(arg);
                console.log(`🔧 Positional arg: ${arg}`);
            }
        }
        
        // 最初のpositional argumentをdatasetPathとして設定
        if (positional.length > 0) {
            parsed.datasetPath = positional[0];
        }
        
        return parsed;
    }
    
    const commandLineArgs = parseArgs();
    
    // プロジェクトルートを定義
    const projectRoot = '/app';
    
    // データセット選択（利用可能なデータセット）
    const availableDatasets = [
        path.join(projectRoot, "dataset", "filtered_fewChanged"),     // 少数変更ファイル
        path.join(projectRoot, "dataset", "filtered_confirmed"),     // 確認済み
        path.join(projectRoot, "dataset", "filtered_commit"),        // コミット履歴
        path.join(projectRoot, "dataset", "filtered_protoChanged"),   // プロトコル変更
        path.join(projectRoot, "dataset", "test_fewChanged")
    ];
    
    // 現在選択されているデータセット（コマンドライン引数または デフォルト）
    const selectedDataset = commandLineArgs.datasetPath || availableDatasets[0];
    const aprOutputPath = commandLineArgs.aprLogRootPath || commandLineArgs.aprOutputPath || path.join(projectRoot, "apr-logs");

    // デバッグ情報
    console.log('🔧 コマンドライン引数:', commandLineArgs);
    console.log('🔧 選択されたデータセット:', selectedDataset);
    console.log('🔧 APRログパス:', aprOutputPath);

    // HTMLレポート生成オプション
    const reportOptions = {
        generateHTMLReport: true,       // HTMLレポート生成
        generateErrorReport: true,      // エラーレポート生成
        generateDetailReports: false,   // 詳細レポート生成（最初の10件）
        generateDetailedAnalysis: true  // 詳細分析レポート生成（新機能）
    };

    console.log('🚀 データセット分析を開始');
    console.log(`📂 選択されたデータセット: ${selectedDataset}`);
    console.log(`📁 APRログパス: ${aprOutputPath}`);
    console.log(`📊 HTMLレポート生成: ${reportOptions.generateHTMLReport ? '有効' : '無効'}`);
    console.log(`❌ エラーレポート生成: ${reportOptions.generateErrorReport ? '有効' : '無効'}`);
    console.log(`📝 詳細レポート生成: ${reportOptions.generateDetailReports ? '有効' : '無効'}`);
    console.log(`🔬 詳細分析レポート生成: ${reportOptions.generateDetailedAnalysis ? '有効' : '無効'}`);
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

