/**
 * FileManagerのプロンプトファイル検索機能をテストする
 */

import FileManager from './dist/js/modules/fileManager.js';
import Config from './dist/js/modules/config.js';
import Logger from './dist/js/modules/logger.js';

async function testPromptFileSearch() {
    console.log('🧪 FileManager prompt file search test starting...');
    
    // テスト設定（実際のデータセットパスを使用）
    const testProjectDir = '/app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml/premerge_54';
    const config = new Config(testProjectDir);
    const logger = new Logger();
    
    console.log('📊 Test configuration:');
    console.log(`  - inputProjectDir: ${config.inputProjectDir}`);
    console.log(`  - promptDir: ${config.promptDir}`);
    
    const fileManager = new FileManager(config, logger);
    
    // テストするプロンプトファイル
    const testFiles = [
        '00_prompt.txt',
        '01_proto.txt',
        '02_protoFileChanges.txt',
        '03_fileChanges.txt',
        '04_allFilePaths.txt',
        '05_suspectedFiles.txt'
    ];
    
    console.log('\n📁 Testing prompt file discovery...');
    
    for (const filename of testFiles) {
        console.log(`\n--- Testing: ${filename} ---`);
        
        // プロンプトファイルリストの状態を確認
        const status = fileManager.getPromptFilesList();
        const isAvailable = status.available.includes(filename);
        
        console.log(`  Available in list: ${isAvailable}`);
        
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
    
    // ファイル状態のサマリー
    console.log('\n📊 Final prompt files status:');
    fileManager.logPromptFilesStatus();
}

// テスト実行
testPromptFileSearch();
