/**
 * Task 4-1: 統合テストの実行
 * MockLLMTestRunnerを使用してループ動作を確認
 */

import MockLLMTestRunner from './app/module/mockLLMTestRunner.js';
import Logger from './app/module/logger.js';
import Config from './app/module/config.js';

async function runLoopTest() {
    console.log('🏁 Starting Loop Test - Phase 4-1');
    console.log('=====================================');

    // Loggerを初期化
    const logger = new Logger();
    
    try {
        // MockLLMTestRunnerを初期化
        const testConfig = new Config('/app/dataset/test');
        const mockRunner = new MockLLMTestRunner(testConfig, logger);

        // 全テストを実行
        await mockRunner.runAllTests();

        console.log('✅ Loop test completed successfully!');
        
    } catch (error) {
        console.error('❌ Loop test failed:', error);
        process.exit(1);
    }
}

// テストを実行
runLoopTest().catch(console.error);
