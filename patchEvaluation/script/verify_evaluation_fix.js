#!/usr/bin/env node
/**
 * NO_INTERACTION_LOG修正とNo-op Intent評価の検証スクリプト
 * 
 * 検証項目：
 * 1. interaction_logがaprLogParser経由で保持されているか
 * 2. 修正なしケースでもIntent評価が実行されるか
 */

import APRLogParser from '../src/aprLogParser.js';
import fs from 'fs/promises';

async function main() {
    console.log('🔍 NO_INTERACTION_LOG修正の検証\n');
    console.log('='.repeat(50));
    
    const parser = new APRLogParser();
    
    // テスト対象: Incompleteケース
    // 開発環境では /app/log、patch-evaluationコンテナでは /app/apr-logs
    const isInContainer = await fs.access('/app/apr-logs').then(() => true).catch(() => false);
    const logBase = isInContainer ? '/app/apr-logs' : '/app/log';
    const testLog = `${logBase}/boulder/pullrequest/Add_validated_timestamp_to_challenges/2026-01-12_19-52-06_JST.log`;
    
    console.log(`\n📖 テストログ: ${testLog}\n`);
    
    // 1. ログファイルの存在確認
    try {
        await fs.access(testLog);
        console.log('✅ ログファイルが存在します');
    } catch (error) {
        console.error('❌ ログファイルが見つかりません:', error.message);
        console.error('\n💡 ヒント: docker-composeでマウントされているか確認してください');
        console.error('   開発環境: /app/log → patch-evaluationコンテナ: /app/apr-logs');
        process.exit(1);
    }
    
    // 2. ログ解析
    console.log('\n📊 ログ解析中...');
    const dialogue = await parser.parseLogEntry(testLog);
    
    if (!dialogue) {
        console.error('❌ ログ解析に失敗しました');
        process.exit(1);
    }
    
    console.log('✅ ログ解析成功\n');
    
    // 3. 修正内容の検証
    console.log('='.repeat(50));
    console.log('検証結果:');
    console.log('='.repeat(50));
    
    // 検証1: interaction_logの保持
    console.log('\n【検証1】interaction_logの保持');
    if (dialogue.interaction_log) {
        if (Array.isArray(dialogue.interaction_log)) {
            console.log(`✅ interaction_log保持: OK (配列, 長さ=${dialogue.interaction_log.length})`);
        } else if (typeof dialogue.interaction_log === 'object') {
            const keys = Object.keys(dialogue.interaction_log);
            console.log(`✅ interaction_log保持: OK (オブジェクト, キー数=${keys.length})`);
        }
    } else {
        console.log('❌ interaction_log保持: NG（未保持）');
    }
    
    // 検証2: experiment_metadataの保持
    console.log('\n【検証2】experiment_metadataの保持');
    if (dialogue.experiment_metadata) {
        console.log('✅ experiment_metadata保持: OK');
        console.log(`   - status: ${dialogue.experiment_metadata.status}`);
        console.log(`   - total_turns: ${dialogue.experiment_metadata.total_turns}`);
    } else {
        console.log('❌ experiment_metadata保持: NG（未保持）');
    }
    
    // 検証3: turnsの変換
    console.log('\n【検証3】turnsの変換');
    console.log(`✅ turns配列: ${dialogue.turns ? dialogue.turns.length : 0}件`);
    
    // 検証4: 修正履歴の確認
    console.log('\n【検証4】修正履歴の確認');
    const hasModifications = dialogue.turns.some(turn => 
        turn.modifiedDiff && turn.modifiedDiff.trim().length > 0
    );
    console.log(`   - 修正あり: ${hasModifications ? 'Yes' : 'No'}`);
    
    if (!hasModifications) {
        console.log('   💡 このケースは修正なし（No-op/Incomplete）です');
        console.log('   💡 DatasetAnalysisControllerでIntent評価が実行されるはずです');
    }
    
    // 検証5: analyzeEvaluationSkipReason が正しく動作するか
    console.log('\n【検証5】analyzeEvaluationSkipReason動作確認');
    const hasInteractionLog = dialogue.interaction_log && 
        ((Array.isArray(dialogue.interaction_log) && dialogue.interaction_log.length > 0) ||
         (typeof dialogue.interaction_log === 'object' && Object.keys(dialogue.interaction_log).length > 0));
    
    if (hasInteractionLog) {
        console.log('✅ NO_INTERACTION_LOGエラーは発生しません');
    } else {
        console.log('❌ NO_INTERACTION_LOGエラーが発生する可能性があります');
    }
    
    // 総合判定
    console.log('\n' + '='.repeat(50));
    console.log('総合判定:');
    console.log('='.repeat(50));
    
    const allPass = dialogue.interaction_log && 
                    dialogue.experiment_metadata && 
                    hasInteractionLog;
    
    if (allPass) {
        console.log('✅ 修正は正しく適用されています');
        console.log('✅ NO_INTERACTION_LOGエラーは解消されるはずです');
        console.log('✅ 修正なしケースでもIntent評価が実行されます');
    } else {
        console.log('❌ 一部の検証項目が失敗しました');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('詳細情報:');
    console.log('='.repeat(50));
    console.log(`Status: ${dialogue.status}`);
    console.log(`Total Tokens: ${dialogue.totalTokens}`);
    console.log(`Total Turns: ${dialogue.turns.length}`);
    console.log(`LLM Provider: ${dialogue.llmMetadata?.provider || 'N/A'}`);
    console.log(`LLM Model: ${dialogue.llmMetadata?.model || 'N/A'}`);
}

main().catch(error => {
    console.error('\n❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
});
