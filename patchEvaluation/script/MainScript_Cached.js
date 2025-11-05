/**
 * キャッシュ機能付きMainScriptエントリーポイント
 * オリジナルのMainScript.jsにキャッシュ機能を統合
 */
import { config as dotenvConfig } from 'dotenv';
import path from 'path';

import { cachedDatasetLoop, CacheManager } from '../src/Controller/CachedController.js';

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
        path.join(projectRoot, "dataset", "incorrect"),         // 小規模テストデータセット（利用可能）
        path.join(projectRoot, "dataset", "filtered_fewChanged"),     // 少数変更ファイル（アンマウント）
        path.join(projectRoot, "dataset", "filtered_confirmed"),     // 確認済み（アンマウント）
        path.join(projectRoot, "dataset", "filtered_commit"),        // コミット履歴（アンマウント）
        path.join(projectRoot, "dataset", "filtered_protoChanged"),   // プロトコル変更（アンマウント）
    ];
    
    // 現在選択されているデータセット（コマンドライン引数または デフォルト）
    const selectedDataset = commandLineArgs.datasetPath || availableDatasets[0];
    const aprOutputPath = commandLineArgs.aprLogRootPath || commandLineArgs.aprOutputPath || path.join(projectRoot, "apr-logs");

    // キャッシュオプションの解析
    const useCache = commandLineArgs.cache !== 'false' && commandLineArgs.noCache !== 'true'; // デフォルト: true
    const clearCacheFirst = commandLineArgs.clearCache === 'true' || commandLineArgs.clearCacheFirst === 'true';
    
    // レポート生成オプションの解析
    const generateDetailReports = commandLineArgs.detailReports === 'true' || 
                                  commandLineArgs.generateDetailReports === 'true' ||
                                  commandLineArgs.details === 'true'; // デフォルト: false（処理時間考慮）
    
    const maxDetailReports = parseInt(commandLineArgs.maxDetailReports) || 
                            parseInt(commandLineArgs.maxDetails) || 10; // デフォルト: 10件

    const generateDetailedAnalysis = commandLineArgs.detailedAnalysis !== 'false' && 
                                   commandLineArgs.noDetailedAnalysis !== 'true'; // デフォルト: true
    
    // キャッシュ管理コマンドの処理（CacheManagerは必要な時のみ作成）
    if (commandLineArgs.showCacheStats) {
        console.log('📈 キャッシュ統計を表示中...');
        const cacheManager = new CacheManager();
        await cacheManager.showCacheStats();
        process.exit(0);
    }
    
    if (commandLineArgs.clearCache) {
        console.log('🗑️ キャッシュクリアを実行中...');
        const cacheManager = new CacheManager();
        await cacheManager.clearCache();
        console.log('✅ キャッシュをクリアしました');
        process.exit(0);
    }
    
    if (commandLineArgs.limitCache) {
        const maxFiles = parseInt(commandLineArgs.limitCache) || 5000;
        console.log(`📊 キャッシュサイズを${maxFiles}ファイルに制限中...`);
        const cacheManager = new CacheManager();
        await cacheManager.limitCacheSize(maxFiles);
        process.exit(0);
    }

    // デバッグ情報
    console.log('🔧 コマンドライン引数:', commandLineArgs);
    console.log('🔧 選択されたデータセット:', selectedDataset);
    console.log('🔧 APRログパス:', aprOutputPath);
    console.log('🔧 キャッシュ機能:', useCache ? '有効' : '無効');
    if (clearCacheFirst) {
        console.log('🔧 実行前キャッシュクリア: 有効');
    }

    // HTMLレポート生成オプション + キャッシュオプション
    const reportOptions = {
        generateHTMLReport: true,           // HTMLレポート生成
        generateErrorReport: true,          // エラーレポート生成
        generateDetailReports,              // 詳細レポート生成（コマンドライン引数で制御）
        generateDetailedAnalysis,           // 詳細分析レポート生成
        maxDetailReports,                   // 詳細レポート生成数
        useCache,                          // キャッシュ使用
        clearCacheFirst                    // 実行前キャッシュクリア

    };

    console.log('🚀 データセット分析を開始（キャッシュ機能付き）');
    console.log(`📂 選択されたデータセット: ${selectedDataset}`);
    console.log(`📁 APRログパス: ${aprOutputPath}`);
    console.log(`📊 HTMLレポート生成: ${reportOptions.generateHTMLReport ? '有効' : '無効'}`);
    console.log(`❌ エラーレポート生成: ${reportOptions.generateErrorReport ? '有効' : '無効'}`);
    console.log(`📝 詳細レポート生成: ${reportOptions.generateDetailReports ? '有効' : '無効'}${reportOptions.generateDetailReports ? ` (最大${reportOptions.maxDetailReports}件)` : ''}`);
    console.log(`� 詳細分析レポート生成: ${reportOptions.generateDetailedAnalysis ? '有効' : '無効'}`);
    console.log(`�📈 キャッシュ機能: ${reportOptions.useCache ? '有効' : '無効'}`);
    if (reportOptions.clearCacheFirst) {
        console.log(`🗑️ 実行前キャッシュクリア: 有効`);
    }
    console.log('=============================================\n');

    cachedDatasetLoop(selectedDataset, aprOutputPath, reportOptions)
        .then((stats) => {
            console.log('\n🎉 分析が正常に完了しました！');
            console.log(`✅ ${stats.aprParseSuccess}/${stats.totalDatasetEntries} のマッチングペアが成功`);
            
            if (stats.aprParseSuccess > 0) {
                console.log(`📊 成功率: ${(stats.aprParseSuccess/stats.totalDatasetEntries*100).toFixed(1)}%`);
            }
            
            // キャッシュ使用時の統計表示
            if (reportOptions.useCache) {
                console.log('\n📈 キャッシュパフォーマンス概要:');
                console.log('   - キャッシュファイルは /app/cache/diff-cache に保存されました');
                console.log('   - 次回実行時はキャッシュにより高速化されます');
                console.log('   - キャッシュ統計: --showCacheStats で確認可能');
                console.log('   - キャッシュクリア: --clearCache で実行可能');
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
