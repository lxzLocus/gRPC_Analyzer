/**
 * GenerateFIleChanged.jsの新機能使用例
 * {{ground_truth_diff}}テンプレート変数への組み込み例
 */

import { getChangedFilesWithDiff, generateGroundTruthDiff } from '../src/GenerateFIleChanged.js';
import { DatasetRepository } from '../src/Repository/DatasetRepository.js';
import path from 'path';

/**
 * 使用例1: 変更ファイルとdiffを同時取得
 */
async function example1_getChangedFilesWithDiff() {
    const premergePath = '/app/dataset/example-project/confirmed/PR-123/premerge';
    const mergePath = '/app/dataset/example-project/confirmed/PR-123/commit_snapshot_abc123';
    
    try {
        // ファイルパスとdiffを同時取得
        const result = await getChangedFilesWithDiff(premergePath, mergePath);
        
        console.log('🔄 変更されたファイル数:', result.changedFiles.length);
        console.log('📁 変更されたファイル:', result.changedFiles);
        console.log('\n📄 Ground Truth Diff:');
        console.log(result.groundTruthDiff);
        
        return result;
    } catch (error) {
        console.error('❌ エラー:', error.message);
        return { changedFiles: [], groundTruthDiff: '' };
    }
}

/**
 * 使用例2: 特定ファイルからdiff生成
 */
async function example2_generateSpecificDiff() {
    const premergePath = '/app/dataset/example-project/confirmed/PR-123/premerge';
    const mergePath = '/app/dataset/example-project/confirmed/PR-123/commit_snapshot_abc123';
    const specificFiles = [
        'src/main/proto/user.proto',
        'src/main/proto/service.proto'
    ];
    
    try {
        // 特定ファイルのみからdiff生成
        const groundTruthDiff = await generateGroundTruthDiff(
            premergePath, 
            mergePath, 
            specificFiles
        );
        
        console.log('🎯 指定ファイルのdiff:');
        console.log(groundTruthDiff);
        
        return groundTruthDiff;
    } catch (error) {
        console.error('❌ エラー:', error.message);
        return '';
    }
}

/**
 * 使用例3: DatasetRepositoryとの統合
 */
async function example3_withDatasetRepository() {
    const datasetRepo = new DatasetRepository();
    const pullRequestPath = '/app/dataset/example-project/confirmed/PR-123';
    
    try {
        // パス情報を取得
        const paths = await datasetRepo.getPullRequestPaths(pullRequestPath);
        
        if (!paths.hasValidPaths) {
            console.log('❌ 有効なpremerge/mergeパスが見つかりません');
            return;
        }
        
        // 変更ファイルとdiffを取得
        const result = await datasetRepo.getChangedFilesWithDiff(
            paths.premergePath, 
            paths.mergePath, 
            '.proto' // protoファイルのみ対象
        );
        
        console.log('🔧 Repository経由での取得結果:');
        console.log('📁 変更ファイル数:', result.changedFiles.length);
        console.log('📄 Diff行数:', result.groundTruthDiff.split('\n').length);
        
        return result;
    } catch (error) {
        console.error('❌ Repository統合エラー:', error.message);
        return { changedFiles: [], groundTruthDiff: '' };
    }
}

/**
 * 使用例4: LLMテンプレートへの組み込み
 */
async function example4_llmTemplateIntegration() {
    const premergePath = '/app/dataset/example-project/confirmed/PR-123/premerge';
    const mergePath = '/app/dataset/example-project/confirmed/PR-123/commit_snapshot_abc123';
    
    try {
        // diffデータを取得
        const result = await getChangedFilesWithDiff(premergePath, mergePath);
        
        // LLMテンプレート用のコンテキストオブジェクト作成
        const templateContext = {
            // 従来のデータ
            agent_generated_diff: "diff --git a/src/example.proto b/src/example.proto\n...",
            changed_files: result.changedFiles,
            
            // 新しく追加されるground_truth_diff
            ground_truth_diff: result.groundTruthDiff,
            
            // メタデータ
            total_changed_files: result.changedFiles.length,
            diff_line_count: result.groundTruthDiff.split('\n').length
        };
        
        console.log('🤖 LLMテンプレート用コンテキスト:');
        console.log('   - Agent Generated Diff: 準備済み');
        console.log('   - Changed Files:', templateContext.changed_files.length);
        console.log('   - Ground Truth Diff:', templateContext.diff_line_count, '行');
        
        // テンプレートでの使用例（疑似コード）
        const promptTemplate = `
以下の内容を比較・評価してください:

## エージェントが生成した差分:
{{agent_generated_diff}}

## 実際の変更内容（Ground Truth）:
{{ground_truth_diff}}

## 変更されたファイル一覧:
{{#each changed_files}}
- {{this}}
{{/each}}

変更ファイル数: {{total_changed_files}}
Ground Truth行数: {{diff_line_count}}

この比較に基づいて、エージェントの変更が適切かどうか評価してください。
        `;
        
        console.log('\n📝 テンプレート例:');
        console.log(promptTemplate);
        
        return templateContext;
    } catch (error) {
        console.error('❌ テンプレート統合エラー:', error.message);
        return {};
    }
}

/**
 * 使用例5: ファイル種別フィルタリング
 */
async function example5_fileTypeFiltering() {
    const premergePath = '/app/dataset/example-project/confirmed/PR-123/premerge';
    const mergePath = '/app/dataset/example-project/confirmed/PR-123/commit_snapshot_abc123';
    
    try {
        // protoファイルのみを対象
        const protoResult = await getChangedFilesWithDiff(premergePath, mergePath, '.proto');
        console.log('📂 protoファイルの変更:');
        console.log('   - ファイル数:', protoResult.changedFiles.length);
        console.log('   - Diff行数:', protoResult.groundTruthDiff.split('\n').length);
        
        // Javaファイルのみを対象
        const javaResult = await getChangedFilesWithDiff(premergePath, mergePath, '.java');
        console.log('\n☕ Javaファイルの変更:');
        console.log('   - ファイル数:', javaResult.changedFiles.length);
        console.log('   - Diff行数:', javaResult.groundTruthDiff.split('\n').length);
        
        // 全ファイルを対象
        const allResult = await getChangedFilesWithDiff(premergePath, mergePath);
        console.log('\n📋 全ファイルの変更:');
        console.log('   - ファイル数:', allResult.changedFiles.length);
        console.log('   - Diff行数:', allResult.groundTruthDiff.split('\n').length);
        
        return {
            proto: protoResult,
            java: javaResult,
            all: allResult
        };
    } catch (error) {
        console.error('❌ フィルタリングエラー:', error.message);
        return {};
    }
}

// エクスポート
export {
    example1_getChangedFilesWithDiff,
    example2_generateSpecificDiff,
    example3_withDatasetRepository,
    example4_llmTemplateIntegration,
    example5_fileTypeFiltering
};

// 実行例（このファイルが直接実行された場合）
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🧪 GenerateFIleChanged.js 新機能テスト実行');
    console.log('==========================================\n');
    
    // 各使用例を順番に実行
    await example1_getChangedFilesWithDiff();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await example2_generateSpecificDiff();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await example3_withDatasetRepository();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await example4_llmTemplateIntegration();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await example5_fileTypeFiltering();
}
