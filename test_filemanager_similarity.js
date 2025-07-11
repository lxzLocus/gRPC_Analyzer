/**
 * FileManagerの類似ファイル検索機能をテストする
 */

import FileManager from './dist/js/modules/fileManager.js';
import Config from './dist/js/modules/config.js';
import Logger from './dist/js/modules/logger.js';

async function testSimilarFileSearch() {
    console.log('🧪 FileManager similar file search test starting...');
    
    // テスト設定
    const config = new Config();
    const logger = new Logger();
    
    // テスト用のプロジェクトディレクトリを設定
    config.inputProjectDir = '/app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml/premerge_54';
    
    const fileManager = new FileManager(config, logger);
    
    // テストケース: LLMが要求した存在しないファイル
    const testFileInfos = [
        {
            type: 'FILE_CONTENT',
            path: 'src/server/service_impl.go'
        },
        {
            type: 'FILE_CONTENT', 
            path: 'src/client/client.go'
        }
    ];
    
    console.log('📂 Test target files:');
    testFileInfos.forEach(info => {
        console.log(`  - ${info.path} (${info.type})`);
    });
    
    try {
        console.log('\n🔍 Processing file requests...');
        const result = await fileManager.processRequiredFileInfos(testFileInfos);
        
        console.log('\n📊 Result:');
        console.log(result);
        
    } catch (error) {
        console.error('❌ Error during test:', error);
    }
}

// テスト実行
testSimilarFileSearch();
