// Segmentation fault デバッグ用スクリプト
import { config } from 'dotenv';
import path from 'path';

// 環境変数の設定
delete process.env.OPENAI_TOKEN;
delete process.env.OPENAI_API_KEY;
config({ path: path.join(process.cwd(), '.env') });

console.log('🔧 Starting segfault debugging...');
console.log('Memory usage at start:', process.memoryUsage());
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);

// プロセスの異常終了をキャッチ
process.on('SIGABRT', () => {
    console.log('❌ SIGABRT received');
});

process.on('SIGSEGV', () => {
    console.log('❌ SIGSEGV received');
});

process.on('uncaughtException', (error) => {
    console.log('❌ Uncaught Exception:', error.message);
    console.log('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('exit', (code) => {
    console.log(`🔚 Process exiting with code: ${code}`);
    console.log('Final memory usage:', process.memoryUsage());
});

process.on('beforeExit', (code) => {
    console.log(`🔄 Before exit with code: ${code}`);
});

try {
    console.log('📥 Importing modules step by step...');
    
    // Step 1: 基本モジュールのテスト
    console.log('  - Importing fs, path...');
    await import('fs');
    await import('path');
    console.log('  ✅ Basic modules imported');
    
    // Step 2: 外部依存関係のテスト
    console.log('  - Importing dotenv...');
    await import('dotenv');
    console.log('  ✅ dotenv imported');
    
    console.log('  - Importing openai...');
    const { default: OpenAI } = await import('openai');
    console.log('  ✅ openai imported');
    
    console.log('  - Testing OpenAI client creation...');
    const openaiClient = new OpenAI({ apiKey: 'test-key' });
    console.log('  ✅ OpenAI client created');
    
    console.log('  - Importing handlebars...');
    await import('handlebars');
    console.log('  ✅ handlebars imported');
    
    // Step 3: プロジェクトの各モジュールを個別にテスト
    console.log('  - Importing project modules...');
    
    console.log('    - config.js...');
    const { default: Config } = await import('./dist/js/modules/config.js');
    console.log('    ✅ Config imported');
    
    console.log('    - logger.js...');
    const { default: Logger } = await import('./dist/js/modules/logger.js');
    console.log('    ✅ Logger imported');
    
    console.log('    - openAIClient.js...');
    const { default: OpenAIClient } = await import('./dist/js/modules/openAIClient.js');
    console.log('    ✅ OpenAIClient imported');
    
    console.log('    - messageHandler.js...');
    const { default: MessageHandler } = await import('./dist/js/modules/messageHandler.js');
    console.log('    ✅ MessageHandler imported');
    
    console.log('    - fileManager.js...');
    const { default: FileManager } = await import('./dist/js/modules/fileManager.js');
    console.log('    ✅ FileManager imported');
    
    console.log('    - llmFlowController.js...');
    const { default: LLMFlowController } = await import('./dist/js/modules/llmFlowController.js');
    console.log('    ✅ LLMFlowController imported');
    
    console.log('Memory usage after all imports:', process.memoryUsage());
    
    // Step 4: インスタンス作成のテスト
    console.log('📱 Testing instance creation...');
    const testPath = '/app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml/premerge_54';
    const controller = new LLMFlowController(testPath);
    console.log('✅ Controller created');
    console.log('Memory usage after creation:', process.memoryUsage());

    // Step 5: 実行テスト
    console.log('🚀 Starting run()...');
    await controller.run();
    console.log('✅ Run completed successfully');
    console.log('Memory usage after run:', process.memoryUsage());

    console.log('🎉 All tests completed successfully!');

} catch (error) {
    console.error('❌ Error caught:', error.message);
    console.error('Stack trace:', error.stack);
    console.log('Memory usage at error:', process.memoryUsage());
}

console.log('🔚 Script completed, exiting...');
