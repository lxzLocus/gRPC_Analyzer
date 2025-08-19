import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module環境での __dirname の取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数の設定 - 正しいパスで .env ファイルを読み込み
config({ path: path.join(__dirname, '..', '..', '.env') });

// Gemini APIクライアントを動的インポート
async function createLLMController(premergeDir) {
    try {
        console.log(`🔧 Creating LLM Controller for: ${premergeDir}`);
        console.log(`🔍 LLM_PROVIDER: ${process.env.LLM_PROVIDER}`);
        
        // プロバイダーに応じて適切なクライアントを作成
        if (process.env.LLM_PROVIDER === 'gemini') {
            // Gemini用の簡易コントローラー
            return {
                run: async () => {
                    console.log(`🤖 Running Gemini processing for ${premergeDir}`);
                    console.log(`📝 Simulating LLM processing...`);
                    
                    // シミュレートされた処理時間
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    console.log(`✅ Gemini processing completed for ${premergeDir}`);
                    return { success: true, provider: 'gemini' };
                },
                cleanup: async () => {
                    console.log(`🧹 Cleaning up Gemini controller for ${premergeDir}`);
                }
            };
        } else if (process.env.LLM_PROVIDER === 'openai') {
            // OpenAI用の簡易コントローラー
            return {
                run: async () => {
                    console.log(`🤖 Running OpenAI processing for ${premergeDir}`);
                    console.log(`📝 Simulating LLM processing...`);
                    
                    // シミュレートされた処理時間
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    console.log(`✅ OpenAI processing completed for ${premergeDir}`);
                    return { success: true, provider: 'openai' };
                },
                cleanup: async () => {
                    console.log(`🧹 Cleaning up OpenAI controller for ${premergeDir}`);
                }
            };
        } else {
            throw new Error(`Unsupported LLM provider: ${process.env.LLM_PROVIDER}`);
        }
    } catch (error) {
        console.error(`❌ Error creating LLM controller: ${error.message}`);
        throw error;
    }
}

export default createLLMController;
