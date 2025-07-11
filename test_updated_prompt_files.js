/**
 * 更新されたプロンプトファイル名（04_surroundedFilePath.txt）でテストする
 */

import FileManager from './dist/js/modules/fileManager.js';
import Config from './dist/js/modules/config.js';
import Logger from './dist/js/modules/logger.js';

async function testUpdatedPromptFiles() {
    console.log('🧪 Testing updated prompt file names...');
    
    // テスト設定（実際のデータセットパスを使用）
    const testProjectDir = '/app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml/premerge_54';
    const config = new Config(testProjectDir);
    const logger = new Logger();
    
    console.log('📊 Test configuration:');
    console.log(`  - inputProjectDir: ${config.inputProjectDir}`);
    console.log(`  - promptDir: ${config.promptDir}`);
    
    const fileManager = new FileManager(config, logger);
    
    // 更新されたファイル名でテスト
    const testFiles = [
        '00_prompt.txt',
        '01_proto.txt',
        '02_protoFileChanges.txt',
        '03_fileChanges.txt',
        '04_surroundedFilePath.txt',  // 正しいファイル名（単数形）
        '05_suspectedFiles.txt'
    ];
    
    console.log('\n📁 Testing updated prompt file discovery...');
    
    for (const filename of testFiles) {
        console.log(`\n--- Testing: ${filename} ---`);
        
        try {
            // 実際に読み込みテスト（フォールバック内容付き）
            const content = fileManager['safeReadPromptFile'](filename, 'FALLBACK_CONTENT');
            const isFromDataset = content !== 'FALLBACK_CONTENT' && content.length > 0;
            const isFallback = content === 'FALLBACK_CONTENT';
            
            console.log(`  Content loaded: ${isFromDataset ? '✅ Success' : (isFallback ? '⚠️ Fallback' : '❓ Unknown')}`);
            console.log(`  Content length: ${content.length} chars`);
            
            if (content.length > 0 && content.length < 500) {
                console.log(`  Preview: ${content.substring(0, 100)}...`);
            }
            
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
        }
    }
    
    // readFirstPromptFileテスト
    console.log('\n📋 Testing readFirstPromptFile...');
    try {
        const prompt = fileManager.readFirstPromptFile();
        console.log('✅ Main prompt file read successfully');
        console.log(`   Length: ${prompt.length} chars`);
        
        // surroundedFilePathテンプレート変数が含まれているかチェック
        if (prompt.includes('{{surroundedFilePath}}')) {
            console.log('✅ Template variable {{surroundedFilePath}} found');
        } else {
            console.log('⚠️ Template variable {{surroundedFilePath}} NOT found');
        }
        
    } catch (error) {
        console.log(`❌ Error reading main prompt: ${error.message}`);
    }
}

// テスト実行
testUpdatedPromptFiles();
