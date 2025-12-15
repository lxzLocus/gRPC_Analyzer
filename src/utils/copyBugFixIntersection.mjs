#!/usr/bin/env node

/**
 * APR評価 ∩ キーワード検出のPRを /app/dataset/incorrect_few にコピー
 * 
 * 目的: 両方の手法で「バグ修正」と判定されたPRのみを抽出
 * - APR評価: 手作業評価で69/86がバグ修正
 * - キーワード検出: コミットメッセージから23/86がバグ修正
 * 
 * 処理フロー:
 * 1. bug_fix_with_merge_results.json からキーワード検出バグ修正PRリストを取得
 * 2. APR評価バグ修正PRリスト（手動定義 or 外部ファイル）と照合
 * 3. 両方に含まれるPRを raw_cloned からコピー
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

// ===== 設定 =====
const KEYWORD_RESULTS_PATH = '/app/output/bug_fix_with_merge_results.json';
const RAW_CLONED_PATH = '/app/dataset/raw_cloned';
const OUTPUT_PATH = '/app/dataset/incorrect_few';

// APR評価でバグ修正と判定されたPRリスト（69件）
// 注: 実際のAPR評価結果ファイルがあれば、そこから読み込む
// ここでは仮のリストとして定義（実際のデータに置き換える必要があります）
const APR_BUG_FIX_PRS = [
    // TODO: 実際のAPR評価結果から取得
    // 形式: { project: 'boulder', category: 'issue', name: 'xxx' }
];

// ===== ヘルパー関数 =====

/**
 * キーワード検出結果を読み込み
 */
async function loadKeywordResults() {
    const content = await fs.readFile(KEYWORD_RESULTS_PATH, 'utf-8');
    return JSON.parse(content);
}

/**
 * APR評価結果を読み込み（外部ファイルから）
 * 未実装の場合は手動リストを返す
 */
async function loadAPREvaluation() {
    // TODO: APR評価結果ファイルがあれば、ここで読み込む
    // 例: /app/evaluation/apr-output/*.json
    
    // 暫定: 空配列を返す（実装後に置き換え）
    console.log('⚠️  APR評価結果ファイルが未指定です');
    console.log('   APR_BUG_FIX_PRS配列を手動で定義してください');
    return APR_BUG_FIX_PRS;
}

/**
 * 2つのPRリストの積集合を取得
 */
function getIntersection(keywordBugFixes, aprBugFixes) {
    const aprSet = new Set(
        aprBugFixes.map(pr => `${pr.project}/${pr.category}/${pr.name}`)
    );
    
    return keywordBugFixes.filter(pr => {
        const category = pr.prPath.includes('/issue/') ? 'issue' : 'pullrequest';
        const key = `${pr.projectName}/${category}/${pr.prName}`;
        return aprSet.has(key);
    });
}

/**
 * PRをraw_clonedからコピー
 */
async function copyPR(pr, outputPath) {
    const category = pr.prPath.includes('/issue/') ? 'issue' : 'pullrequest';
    const sourcePath = path.join(RAW_CLONED_PATH, pr.projectName, category, pr.prName);
    const destPath = path.join(outputPath, pr.projectName, category, pr.prName);
    
    // 送信元の存在確認
    try {
        await fs.access(sourcePath);
    } catch (error) {
        console.log(`   ⚠️  送信元が見つかりません: ${sourcePath}`);
        return false;
    }
    
    // 送信先ディレクトリを作成
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    
    // コピー実行（cpコマンド使用）
    try {
        execSync(`cp -r "${sourcePath}" "${destPath}"`, { encoding: 'utf-8' });
        console.log(`   ✅ コピー: ${pr.projectName}/${category}/${pr.prName}`);
        return true;
    } catch (error) {
        console.log(`   ❌ コピー失敗: ${error.message}`);
        return false;
    }
}

/**
 * 既存のincorrect_fewをクリア
 */
async function clearOutputDirectory() {
    try {
        await fs.rm(OUTPUT_PATH, { recursive: true, force: true });
        console.log(`🗑️  既存の ${OUTPUT_PATH} をクリアしました`);
    } catch (error) {
        // ディレクトリが存在しない場合は無視
    }
    
    await fs.mkdir(OUTPUT_PATH, { recursive: true });
}

// ===== メイン処理 =====

async function main() {
    console.log('=' .repeat(70));
    console.log('APR評価 ∩ キーワード検出 バグ修正PRコピーツール');
    console.log('='.repeat(70));
    console.log();
    
    // 1. キーワード検出結果を読み込み
    console.log('📄 キーワード検出結果を読み込み中...');
    const keywordResults = await loadKeywordResults();
    const keywordBugFixes = keywordResults.filter(pr => pr.hasBugFixSignals);
    console.log(`   キーワード検出: ${keywordBugFixes.length}/${keywordResults.length} PR`);
    console.log();
    
    // 2. APR評価結果を読み込み
    console.log('📄 APR評価結果を読み込み中...');
    const aprBugFixes = await loadAPREvaluation();
    console.log(`   APR評価: ${aprBugFixes.length} PR`);
    console.log();
    
    // APR評価結果が空の場合は警告
    if (aprBugFixes.length === 0) {
        console.log('=' .repeat(70));
        console.log('⚠️  APR評価結果が定義されていません');
        console.log('');
        console.log('次のいずれかの方法でAPR評価結果を指定してください:');
        console.log('');
        console.log('方法1: APR評価結果ファイルから読み込み');
        console.log('  - loadAPREvaluation()関数を実装');
        console.log('  - 評価結果JSONファイルのパスを指定');
        console.log('');
        console.log('方法2: 手動でPRリストを定義');
        console.log('  - APR_BUG_FIX_PRS配列に手動で追加');
        console.log('  - 形式: { project: "boulder", category: "issue", name: "xxx" }');
        console.log('=' .repeat(70));
        process.exit(1);
    }
    
    // 3. 積集合を計算
    console.log('🔍 積集合を計算中...');
    const intersection = getIntersection(keywordBugFixes, aprBugFixes);
    console.log(`   両方で検出: ${intersection.length} PR`);
    console.log();
    
    if (intersection.length === 0) {
        console.log('⚠️  積集合が空です。コピーするPRがありません。');
        return;
    }
    
    // 4. 出力ディレクトリをクリア
    await clearOutputDirectory();
    console.log();
    
    // 5. PRをコピー
    console.log('📦 PRをコピー中...');
    console.log();
    
    let successCount = 0;
    for (const pr of intersection) {
        const success = await copyPR(pr, OUTPUT_PATH);
        if (success) successCount++;
    }
    
    console.log();
    console.log('=' .repeat(70));
    console.log('✅ 処理完了');
    console.log('='.repeat(70));
    console.log(`コピー成功: ${successCount}/${intersection.length} PR`);
    console.log(`出力先: ${OUTPUT_PATH}`);
    console.log('=' .repeat(70));
}

// 実行
main().catch(error => {
    console.error('❌ エラー:', error);
    process.exit(1);
});
