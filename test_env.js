import { config } from 'dotenv';
import path from 'path';

// 既存の環境変数をクリア
delete process.env.OPENAI_TOKEN;
delete process.env.OPENAI_API_KEY;

// .envファイルを読み込み
config({ path: path.join(process.cwd(), '.env') });

console.log('=== Environment Variables Debug ===');
console.log('Current working directory:', process.cwd());
console.log('OPENAI_TOKEN length:', (process.env.OPENAI_TOKEN || '').length);
console.log('OPENAI_TOKEN value:', process.env.OPENAI_TOKEN);
console.log('OPENAI_API_KEY length:', (process.env.OPENAI_API_KEY || '').length);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DEBUG_MODE:', process.env.DEBUG_MODE);

// .envファイルの存在確認
import fs from 'fs';
const envPath = path.join(process.cwd(), '.env');
console.log('.env file exists:', fs.existsSync(envPath));
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log('.env file first 200 chars:', envContent.substring(0, 200));
}
