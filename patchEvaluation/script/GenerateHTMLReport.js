#!/usr/bin/env node

/**
 * HTMLレポート生成スクリプト
 * 既存の分析結果からHTMLレポートを生成
 */

import { config as dotenvConfig } from 'dotenv';
import { DatasetAnalysisController } from '../src/Controller/DatasetAnalysisController.js';
import path from 'path';

// 環境変数の読み込み
dotenvConfig({ path: '/app/.env' });

/**
 * 使用方法を表示
 */
function showUsage() {
    console.log(`
📊 HTMLレポート生成ツール

使用方法:
  node script/GenerateHTMLReport.js [オプション]

オプション:
  --dataset <path>     データセットパス (必須)
  --apr-logs <path>    APRログパス (必須)
  --stats-only         統計レポートのみ生成
  --errors-only        エラーレポートのみ生成
  --with-details       詳細レポートも生成（最大10件）
  --help              このヘルプを表示

例:
  # 基本的な統計とエラーレポート生成
  node script/GenerateHTMLReport.js --dataset /app/dataset/filtered_fewChanged --apr-logs /app/apr-logs

  # 統計レポートのみ生成
  node script/GenerateHTMLReport.js --dataset /app/dataset/filtered_fewChanged --apr-logs /app/apr-logs --stats-only

  # 詳細レポート付きで生成
  node script/GenerateHTMLReport.js --dataset /app/dataset/filtered_fewChanged --apr-logs /app/apr-logs --with-details
`);
}

/**
 * コマンドライン引数の解析
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dataset: null,
        aprLogs: null,
        statsOnly: false,
        errorsOnly: false,
        withDetails: false,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--dataset':
                options.dataset = args[++i];
                break;
            case '--apr-logs':
                options.aprLogs = args[++i];
                break;
            case '--stats-only':
                options.statsOnly = true;
                break;
            case '--errors-only':
                options.errorsOnly = true;
                break;
            case '--with-details':
                options.withDetails = true;
                break;
            case '--help':
                options.help = true;
                break;
            default:
                console.error(`❌ 不明なオプション: ${args[i]}`);
                process.exit(1);
        }
    }

    return options;
}

/**
 * メイン実行関数
 */
async function main() {
    console.log('📊 HTMLレポート生成ツール');
    console.log('===============================\n');

    const options = parseArgs();

    if (options.help) {
        showUsage();
        return;
    }

    if (!options.dataset || !options.aprLogs) {
        console.error('❌ エラー: --dataset と --apr-logs は必須です。');
        showUsage();
        process.exit(1);
    }

    try {
        console.log(`📂 データセット: ${options.dataset}`);
        console.log(`📁 APRログ: ${options.aprLogs}`);
        console.log('');

        const controller = new DatasetAnalysisController();

        if (options.statsOnly) {
            // 統計レポートのみ生成モード
            console.log('🎯 統計レポートのみ生成モードで実行...\n');
            
            // まず分析を実行してデータを取得
            const stats = await controller.executeAnalysis(options.dataset, options.aprLogs, {
                generateHTMLReport: false
            });
            
            // 統計レポートのみ生成
            const reportResult = await controller.generateStatisticsHTMLReport();
            
            if (reportResult.success) {
                console.log('\n✅ 統計レポート生成完了!');
                console.log(`🔗 ブラウザで開く: file://${reportResult.htmlPath}`);
            }
            
        } else if (options.errorsOnly) {
            // エラーレポートのみ生成モード
            console.log('🎯 エラーレポートのみ生成モードで実行...\n');
            
            // まず分析を実行してデータを取得
            const stats = await controller.executeAnalysis(options.dataset, options.aprLogs, {
                generateHTMLReport: false
            });
            
            // エラーレポートのみ生成
            const reportResult = await controller.generateErrorHTMLReport();
            
            if (reportResult.success) {
                console.log('\n✅ エラーレポート生成完了!');
                console.log(`🔗 ブラウザで開く: file://${reportResult.htmlPath}`);
            } else if (reportResult.reason === 'No errors to report') {
                console.log('\nℹ️ エラーが発生していないため、エラーレポートは生成されませんでした。');
            }
            
        } else {
            // 包括的レポート生成モード
            console.log('🎯 包括的レポート生成モードで実行...\n');
            
            const reportOptions = {
                generateHTMLReport: true,
                generateErrorReport: true,
                generateDetailReports: options.withDetails
            };
            
            const stats = await controller.executeAnalysis(options.dataset, options.aprLogs, reportOptions);
            
            if (stats.htmlReportResult && stats.htmlReportResult.success) {
                console.log('\n✅ 包括的レポート生成完了!');
                console.log(`🆔 セッションID: ${stats.htmlReportResult.sessionId}`);
                console.log(`📄 生成レポート数: ${stats.htmlReportResult.totalReports}`);
                console.log(`📋 サマリーページ: file://${stats.htmlReportResult.summaryPath}`);
            }
        }

        console.log('\n🎉 処理完了!');

    } catch (error) {
        console.error('\n❌ エラーが発生しました:');
        console.error(error.message);
        console.error('\nスタックトレース:');
        console.error(error.stack);
        process.exit(1);
    }
}

// スクリプトが直接実行された場合のみ main を実行
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('❌ 予期しないエラー:', error);
        process.exit(1);
    });
}

export { main };
