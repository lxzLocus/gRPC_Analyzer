#!/usr/bin/env node

/**
 * Phase 4-1 テストランナー
 * Mock LLM と Integration テストを実行
 */

import Config from './build/js/module/config.js';
import Logger from './build/js/module/logger.js';
import MockLLMTestRunner from './build/js/module/mockLLMTestRunner.js';
import IntegrationTestRunner from './build/js/module/integrationTestRunner.js';

async function runPhase4Tests() {
    const logger = new Logger();
    const config = new Config('/app/dataset/test');
    
    logger.logInfo('🚀 Phase 4-1: 統合テストシステムの実行開始');
    logger.logInfo('================================================');
    
    try {
        // Mock LLM テストの実行
        logger.logInfo('\n🤖 Mock LLM テストを開始...');
        const mockRunner = new MockLLMTestRunner(config, logger);
        await mockRunner.runAllTests();
        
        logger.logInfo('\n✅ Mock LLM テスト完了！');
        
        // Integration テストの実行
        logger.logInfo('\n🏗️ Integration テストを開始...');
        const integrationRunner = new IntegrationTestRunner(config, logger);
        await integrationRunner.runAllIntegrationTests();
        
        logger.logInfo('\n✅ Integration テスト完了！');
        
        // 全体サマリー
        logger.logInfo('\n🎉 Phase 4-1 テスト完了！');
        logger.logInfo('================================================');
        logger.logInfo('✅ Mock LLM テスト: 実行完了');
        logger.logInfo('✅ Integration テスト: 実行完了');
        logger.logInfo('📄 詳細レポートは /app/output/ に保存されました');
        
    } catch (error) {
        logger.logError('❌ Phase 4-1 テストでエラーが発生しました:', error);
        process.exit(1);
    }
}

// テスト実行
runPhase4Tests().catch(console.error);
