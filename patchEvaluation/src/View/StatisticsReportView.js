/**
 * 統計レポートの表示を担当するViewクラス
 */
export class StatisticsReportView {
    /**
     * 統計レポートの表示
     * @param {Object} stats - ProcessingStatsオブジェクト
     */
    showStatisticsReport(stats) {
        this.showReportHeader();
        this.showBasicStats(stats);
        this.showSuccessRates(stats);
        this.showDetailBreakdown(stats);
        this.showDetailedMatchingStats(stats);
        this.showErrorDetails(stats);
        this.showUnmatchedReasons(stats);
        this.showSuccessfulSamples(stats);
        this.showReportFooter();
    }

    /**
     * レポートヘッダーの表示
     */
    showReportHeader() {
        console.log('\n');
        console.log('🔍=================================================');
        console.log('📊 APRログとデータセットのマッチング統計レポート');
        console.log('=================================================🔍');
    }

    /**
     * 基本統計の表示
     * @param {Object} stats - 統計情報
     */
    showBasicStats(stats) {
        console.log('\n📈 基本統計:');
        console.log(`  📂 総データセットエントリー数: ${stats.totalDatasetEntries}`);
        console.log(`  ✅ APRログ発見数: ${stats.aprLogFound}`);
        console.log(`  ❌ APRログ未発見数: ${stats.aprLogNotFound}`);
        console.log(`  ⚠️  APRログアクセスエラー数: ${stats.aprLogAccessError}`);
        console.log(`  🎯 APRログ解析成功数: ${stats.aprParseSuccess}`);
        console.log(`  💥 APRログ解析失敗数: ${stats.aprParseFailure}`);
    }

    /**
     * 成功率の表示
     * @param {Object} stats - 統計情報
     */
    showSuccessRates(stats) {
        console.log('\n📊 成功率:');
        console.log(`  🎯 APRログ発見率: ${stats.calculateAprFoundRate()}% (${stats.aprLogFound}/${stats.totalDatasetEntries})`);
        console.log(`  ✅ 解析成功率: ${stats.calculateSuccessRate()}% (${stats.aprParseSuccess}/${stats.totalDatasetEntries})`);
        
        if (stats.aprLogFound > 0) {
            console.log(`  🔍 発見済みAPRログからの解析成功率: ${stats.calculateParseSuccessFromFound()}% (${stats.aprParseSuccess}/${stats.aprLogFound})`);
        }
    }

    /**
     * 詳細内訳の表示
     * @param {Object} stats - 統計情報
     */
    showDetailBreakdown(stats) {
        console.log('\n🔍 詳細内訳:');
        console.log(`  🟢 完全マッチング済み: ${stats.matchedPairs.length} ペア`);
        console.log(`  🟡 未マッチング: ${stats.unmatchedEntries.length} エントリー`);
        console.log(`  🔴 エラー発生: ${stats.errorEntries.length} エントリー`);
    }

    /**
     * 成功したマッチングの詳細統計表示
     * @param {Object} stats - 統計情報
     */
    showDetailedMatchingStats(stats) {
        if (stats.matchedPairs.length === 0) return;

        console.log('\n✅ 成功マッチングの詳細統計:');
        
        const detailedStats = stats.calculateDetailedStats();
        if (detailedStats) {
            const { averages, totals } = detailedStats;
            
            console.log(`  💬 平均対話ターン数: ${averages.turns.toFixed(1)} (合計: ${totals.turns})`);
            console.log(`  🔤 平均トークン数: ${averages.tokens.toFixed(0)} (合計: ${totals.tokens})`);
            console.log(`  🔧 平均修正回数: ${averages.modifications.toFixed(1)} (合計: ${totals.modifications})`);
            console.log(`  📁 平均影響ファイル数 (APRログ): ${averages.affectedFiles.toFixed(1)} (合計: ${totals.affectedFiles})`);
            console.log(`  📝 平均変更ファイル数 (データセット): ${averages.changedFiles.toFixed(1)} (合計: ${totals.changedFiles})`);
            console.log(`  🎯 平均APR差分ファイル数: ${averages.aprDiffFiles.toFixed(1)} (合計: ${totals.aprDiffFiles})`);
        }

        this.showPathStatistics(stats);
        this.showLLMEvaluationStatistics(stats);
    }

    /**
     * パス情報の統計表示
     * @param {Object} stats - 統計情報
     */
    showPathStatistics(stats) {
        const withPremergePath = stats.matchedPairs.filter(pair => pair.premergePath).length;
        const withMergePath = stats.matchedPairs.filter(pair => pair.mergePath).length;
        const withChangedFiles = stats.matchedPairs.filter(pair => pair.changedFiles && pair.changedFiles.length > 0).length;
        const withAprDiffFiles = stats.matchedPairs.filter(pair => pair.aprDiffFiles && pair.aprDiffFiles.length > 0).length;
        
        console.log(`  📂 premergePathあり: ${withPremergePath}/${stats.matchedPairs.length} (${(withPremergePath/stats.matchedPairs.length*100).toFixed(1)}%)`);
        console.log(`  📂 mergePathあり: ${withMergePath}/${stats.matchedPairs.length} (${(withMergePath/stats.matchedPairs.length*100).toFixed(1)}%)`);
        console.log(`  📝 変更ファイル検出 (データセット): ${withChangedFiles}/${stats.matchedPairs.length} (${(withChangedFiles/stats.matchedPairs.length*100).toFixed(1)}%)`);
        console.log(`  🎯 APR差分ファイル検出: ${withAprDiffFiles}/${stats.matchedPairs.length} (${(withAprDiffFiles/stats.matchedPairs.length*100).toFixed(1)}%)`);
    }

    /**
     * LLM評価統計の表示
     * @param {Object} stats - 統計情報
     */
    showLLMEvaluationStatistics(stats) {
        const llmStats = stats.calculateLLMEvaluationStats();
        if (!llmStats) return;

        console.log(`  🎯 最終修正情報あり: ${llmStats.withFinalMod}/${stats.matchedPairs.length} (${(llmStats.withFinalMod/stats.matchedPairs.length*100).toFixed(1)}%)`);
        console.log(`  🤖 LLM評価成功: ${llmStats.withLLMEval}/${stats.matchedPairs.length} (${(llmStats.withLLMEval/stats.matchedPairs.length*100).toFixed(1)}%)`);
        
        console.log(`  ✅ LLM評価結果:`);
        console.log(`    - 正確な修正: ${llmStats.correctCount}/${llmStats.withLLMEval} (${llmStats.correctRate}%)`);
        console.log(`    - 妥当な修正: ${llmStats.plausibleCount}/${llmStats.withLLMEval} (${llmStats.plausibleRate}%)`);
    }

    /**
     * エラー詳細の表示
     * @param {Object} stats - 統計情報
     */
    showErrorDetails(stats) {
        if (stats.errorEntries.length === 0) return;

        console.log('\n🔴 エラー詳細 (最初の5件):');
        stats.errorEntries.slice(0, 5).forEach((error, index) => {
            console.log(`  ${index + 1}. ${error.datasetEntry}`);
            console.log(`     エラー: ${error.error}`);
            console.log(`     パス: ${error.aprLogPath}`);
        });
        if (stats.errorEntries.length > 5) {
            console.log(`  ... 他 ${stats.errorEntries.length - 5} 件のエラー`);
        }
    }

    /**
     * 未マッチング理由別集計の表示
     * @param {Object} stats - 統計情報
     */
    showUnmatchedReasons(stats) {
        if (stats.unmatchedEntries.length === 0) return;

        console.log('\n🟡 未マッチング理由別集計:');
        const reasonCount = {};
        stats.unmatchedEntries.forEach(entry => {
            reasonCount[entry.reason] = (reasonCount[entry.reason] || 0) + 1;
        });
        Object.entries(reasonCount).forEach(([reason, count]) => {
            console.log(`  - ${reason}: ${count} 件`);
        });
    }

    /**
     * 成功マッチングサンプルの表示
     * @param {Object} stats - 統計情報
     */
    showSuccessfulSamples(stats) {
        if (stats.matchedPairs.length === 0) return;

        console.log('\n🎯 成功マッチングサンプル (最初の3件):');
        stats.matchedPairs.slice(0, 3).forEach((pair, index) => {
            console.log(`  ${index + 1}. ${pair.datasetEntry}`);
            console.log(`     ターン数: ${pair.aprLogData.turns}, トークン: ${pair.aprLogData.totalTokens}, 修正: ${pair.aprLogData.modifications}`);
            console.log(`     ログファイル: ${pair.latestLogFile} (${pair.logFiles.length} ファイル中)`);
            
            // 変更ファイル情報を追加
            if (pair.changedFiles && pair.changedFiles.length > 0) {
                console.log(`     📝 データセット変更: ${pair.changedFiles.length} ファイル (${pair.changedFiles.slice(0, 3).join(', ')}${pair.changedFiles.length > 3 ? '...' : ''})`);
            } else {
                console.log(`     📝 データセット変更: 検出されず`);
            }
            
            // APR差分ファイル情報を追加
            if (pair.aprDiffFiles && pair.aprDiffFiles.length > 0) {
                console.log(`     🎯 APR差分ファイル: ${pair.aprDiffFiles.length} ファイル (${pair.aprDiffFiles.slice(0, 3).join(', ')}${pair.aprDiffFiles.length > 3 ? '...' : ''})`);
            } else {
                console.log(`     🎯 APR差分ファイル: 検出されず`);
            }
            
            if (pair.finalModification) {
                console.log(`     最終修正: Turn ${pair.finalModification.turn}, ${pair.finalModification.affectedFiles.length} ファイル`);
                if (pair.finalModification.llmEvaluation && !pair.finalModification.llmEvaluation.error) {
                    console.log(`     LLM評価: ${pair.finalModification.llmEvaluation.overall_assessment} (正確性: ${pair.finalModification.llmEvaluation.is_correct ? 'Yes' : 'No'})`);
                }
            }
        });
        if (stats.matchedPairs.length > 3) {
            console.log(`  ... 他 ${stats.matchedPairs.length - 3} 件の成功マッチング`);
        }
    }

    /**
     * レポートフッターの表示
     */
    showReportFooter() {
        console.log('\n=================================================');
        console.log('📋 レポート完了');
        console.log('=================================================');
    }

    /**
     * 最終サマリーの表示
     * @param {Object} stats - 統計情報
     */
    showFinalSummary(stats) {
        console.log('\n📋 最終サマリー:');
        console.log(`   総エントリー: ${stats.totalDatasetEntries}`);
        console.log(`   APRログ発見: ${stats.aprLogFound} (発見率: ${stats.calculateAprFoundRate()}%)`);
        console.log(`   解析成功: ${stats.aprParseSuccess} (成功率: ${stats.calculateSuccessRate()}%)`);
        console.log(`   解析失敗: ${stats.aprParseFailure}`);
        console.log(`   エラー: ${stats.errorEntries.length}`);
    }
}
