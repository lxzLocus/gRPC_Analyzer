// Segmentation fault 対策のためのグレースフルシャットダウンテスト
import { config } from 'dotenv';
import path from 'path';

// 環境変数の設定
delete process.env.OPENAI_TOKEN;
delete process.env.OPENAI_API_KEY;
config({ path: path.join(process.cwd(), '.env') });

console.log('🔧 Starting graceful shutdown test...');

// グレースフルシャットダウンの実装
let isShuttingDown = false;

const gracefulShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log(`📡 Received ${signal}. Starting graceful shutdown...`);
    
    // 各種リソースのクリーンアップ
    console.log('🧹 Cleaning up resources...');
    
    // OpenAI クライアントの明示的なクリーンアップ
    if (global.openaiClient) {
        console.log('🤖 Cleaning up OpenAI client...');
        global.openaiClient = null;
    }
    
    // ファイルマネージャーのクリーンアップ
    if (global.fileManager) {
        console.log('📁 Cleaning up file manager...');
        global.fileManager = null;
    }
    
    // ガベージコレクション強制実行
    if (global.gc) {
        console.log('🗑️ Running garbage collection...');
        global.gc();
    }
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
};

// シグナルハンドラーの設定
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR1', () => gracefulShutdown('SIGUSR1'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

// 異常終了のキャッチ
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    console.error('Stack:', error.stack);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});

try {
    console.log('📥 Loading modules...');
    const { default: LLMFlowController } = await import('./dist/js/modules/llmFlowController.js');
    
    const testPath = '/app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml/premerge_54';
    console.log('📱 Creating controller...');
    const controller = new LLMFlowController(testPath);
    
    // グローバル参照を保持（デバッグ用）
    global.openaiClient = controller.openAIClient;
    global.fileManager = controller.fileManager;
    
    console.log('🚀 Running controller...');
    await controller.run();
    
    console.log('✅ Controller completed successfully');
    
    // 明示的なクリーンアップ
    console.log('🧹 Explicit cleanup...');
    global.openaiClient = null;
    global.fileManager = null;
    
    if (global.gc) {
        console.log('🗑️ Final garbage collection...');
        global.gc();
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
    gracefulShutdown('error');
}

console.log('🎉 Test completed, exiting gracefully...');
process.exit(0);
