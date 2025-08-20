/**
 * APRログパーサーの使用例
 * LLMとの対話ログを解析してパッチ評価を行うサンプル
 */

import APRLogParser from './aprLogParser.js';
import path from 'path';

async function exampleUsage() {
    console.log('🚀 APRログパーサー使用例');
    console.log('=' * 50);

    const parser = new APRLogParser();

    // 単一のAPRログを解析する例
    const exampleLogPath = '/app/apr-logs/servantes/issue123';
    
    try {
        console.log('\n📖 単一APRログの解析例:');
        console.log(`対象: ${exampleLogPath}`);
        
        const dialogueData = await parser.parseAPRLog(exampleLogPath);
        
        if (dialogueData) {
            console.log('✅ 解析成功:');
            console.log(`  実験ID: ${dialogueData.experimentId}`);
            console.log(`  対話ターン数: ${dialogueData.turns.length}`);
            console.log(`  総トークン数: ${dialogueData.totalTokens}`);
            console.log(`  要求ファイル数: ${dialogueData.requestedFiles.length}`);
            console.log(`  修正回数: ${dialogueData.modificationHistory.length}`);
            console.log(`  ステータス: ${dialogueData.status}`);

            // 差分の詳細分析
            console.log('\n📊 差分分析:');
            const diffAnalysis = parser.analyzeDifferences(dialogueData);
            console.log(`  影響を受けたファイル数: ${diffAnalysis.affectedFiles.length}`);
            console.log(`  フェーズ数: ${diffAnalysis.progressionAnalysis.phases.length}`);
            console.log(`  重要な洞察数: ${diffAnalysis.progressionAnalysis.keyInsights.length}`);

            // フェーズの詳細表示
            console.log('\n🔄 進行フェーズ:');
            for (const phase of diffAnalysis.progressionAnalysis.phases) {
                console.log(`  ${phase.phase}: Turn ${phase.startTurn}-${phase.endTurn} (${phase.duration}ターン)`);
            }

            // 重要な洞察の表示
            if (diffAnalysis.progressionAnalysis.keyInsights.length > 0) {
                console.log('\n💡 重要な洞察:');
                for (const insight of diffAnalysis.progressionAnalysis.keyInsights.slice(0, 3)) {
                    console.log(`  Turn ${insight.turn} [${insight.phase}]: ${insight.insight}`);
                }
            }

            // 最終修正内容
            const finalMods = parser.extractFinalModifications(dialogueData);
            if (finalMods.lastModification) {
                console.log('\n🎯 最終修正:');
                console.log(`  Turn: ${finalMods.lastModification.turn}`);
                console.log(`  タイムスタンプ: ${finalMods.lastModification.timestamp}`);
                console.log(`  修正行数: ${finalMods.lastModification.diff.split('\n').length}`);
            }
        }

    } catch (error) {
        console.error('❌ 解析エラー:', error.message);
    }

    // premergeとmergeの比較分析例
    console.log('\n🔄 premerge vs merge比較分析例:');
    const premergeLogPath = '/app/apr-logs/servantes/issue123_premerge';
    const mergeLogPath = '/app/apr-logs/servantes/issue123_merge';
    
    try {
        const comparison = await parser.comparePremergeAndMerge(premergeLogPath, mergeLogPath);
        
        if (comparison) {
            console.log('✅ 比較分析成功:');
            
            if (comparison.differences) {
                console.log('📈 統計比較:');
                console.log(`  ターン数差: ${comparison.differences.turnCountDiff}`);
                console.log(`  トークン使用量差: ${comparison.differences.tokenUsageDiff}`);
                console.log(`  修正回数差: ${comparison.differences.modificationCountDiff}`);
                
                console.log('📁 要求ファイル比較:');
                console.log(`  共通ファイル: ${comparison.differences.requestedFilesDiff.common.length}`);
                console.log(`  premergeのみ: ${comparison.differences.requestedFilesDiff.premergeOnly.length}`);
                console.log(`  mergeのみ: ${comparison.differences.requestedFilesDiff.mergeOnly.length}`);
            }

            if (comparison.analysis && comparison.analysis.phaseComparison) {
                console.log('\n⏱️ フェーズ期間比較:');
                for (const change of comparison.analysis.phaseComparison.phaseDurationChanges) {
                    if (change.change !== 0) {
                        console.log(`  ${change.phase}: ${change.premergeDuration} → ${change.mergeDuration} (${change.change > 0 ? '+' : ''}${change.change})`);
                    }
                }
            }
        }

    } catch (error) {
        console.log('⚠️ 比較分析をスキップ (ログファイルが存在しない可能性があります)');
    }

    console.log('\n✨ 使用例完了');
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
    exampleUsage()
        .then(() => console.log('\n🎉 APRログパーサー使用例が正常に完了しました'))
        .catch(error => console.error('\n❌ 使用例実行エラー:', error));
}

export default exampleUsage;
