// デバッグ用の簡単なテストスクリプト
import { config } from 'dotenv';
import path from 'path';

// 既存の環境変数をクリア
delete process.env.OPENAI_TOKEN;
delete process.env.OPENAI_API_KEY;

// .envファイルを読み込み
config({ path: path.join(process.cwd(), '.env') });

console.log('🔧 Environment check:');
console.log('  OPENAI_TOKEN length:', (process.env.OPENAI_TOKEN || '').length);
console.log('  Working directory:', process.cwd());

// 単一のテストケースを実行
const testPath = '/app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml/premerge_54';
console.log(`\n🔄 Testing single case: ${testPath}`);

// コンパイル済みのJavaScriptファイルをインポート
const { default: LLMFlowController } = await import('./dist/js/modules/llmFlowController.js');

try {
    const controller = new LLMFlowController(testPath);
    console.log('✅ Controller created successfully');
    
    // run()を実行してデバッグ情報を確認
    console.log('🚀 Starting controller.run()...');
    await controller.run();
    console.log('✅ Controller finished successfully');
} catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
}
