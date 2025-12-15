#!/usr/bin/env node

/**
 * キーワード検出でバグ修正と判定されたPRを /app/dataset/incorrect_few にコピー
 * 
 * 注: APR評価結果との積集合を取る場合は、APR評価結果ファイルを指定してください
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

// ===== 設定 =====
const KEYWORD_RESULTS_PATH = '/app/output/bug_fix_with_merge_results.json';
const RAW_CLONED_PATH = '/app/dataset/raw_cloned';
const OUTPUT_PATH = '/app/dataset/incorrect_few';

// モード設定
const MODE = process.argv[2] || 'keyword'; // 'keyword' or 'intersection'
const APR_RESULTS_PATH = process.argv[3] || null; // APR評価結果ファイルパス（オプション）

// ===== ヘルパー関数 =====

/**
 * キーワード検出結果を読み込み
 */
async function loadKeywordResults() {
    const content = await fs.readFile(KEYWORD_RESULTS_PATH, 'utf-8');
    return JSON.parse(content);
}

/**
 * APR評価結果を読み込み
 */
async function loadAPRResults(filePath) {
    if (!filePath) {
        return null;
    }
    
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`⚠️  APR評価結果ファイルの読み込みに失敗: ${error.message}`);
        return null;
    }
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
        console.log(`   ✅ ${pr.projectName}/${category}/${pr.prName}`);
        return true;
    } catch (error) {
        console.log(`   ❌ コピー失敗: ${pr.prName} - ${error.message}`);
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
    console.log('バグ修正PRコピーツール');
    console.log('='.repeat(70));
    console.log();
    
    // 1. キーワード検出結果を読み込み
    console.log('📄 キーワード検出結果を読み込み中...');
    const keywordResults = await loadKeywordResults();
    const keywordBugFixes = keywordResults.filter(pr => pr.hasBugFixSignals);
    console.log(`   キーワード検出バグ修正: ${keywordBugFixes.length}/${keywordResults.length} PR`);
    console.log();
    
    let targetPRs = keywordBugFixes;
    
    // 2. モード別処理
    if (MODE === 'intersection' && APR_RESULTS_PATH) {
        console.log('📄 APR評価結果を読み込み中...');
        const aprResults = await loadAPRResults(APR_RESULTS_PATH);
        
        if (aprResults) {
            // APR評価結果から'バグ修正'と判定されたPRを抽出
            const aprBugFixes = aprResults.filter(pr => pr.isBugFix === true);
            console.log(`   APR評価バグ修正: ${aprBugFixes.length} PR`);
            console.log();
            
            // 積集合を計算
            const aprSet = new Set(
                aprBugFixes.map(pr => `${pr.project}/${pr.category}/${pr.name}`)
            );
            
            targetPRs = keywordBugFixes.filter(pr => {
                const category = pr.prPath.includes('/issue/') ? 'issue' : 'pullrequest';
                const key = `${pr.projectName}/${category}/${pr.prName}`;
                return aprSet.has(key);
            });
            
            console.log(`🔍 積集合: ${targetPRs.length} PR`);
            console.log();
        }
    } else {
        console.log(`📋 モード: キーワード検出のみ（${keywordBugFixes.length}件をコピー）`);
        console.log();
    }
    
    if (targetPRs.length === 0) {
        console.log('⚠️  コピー対象のPRがありません。');
        return;
    }
    
    // 3. 出力ディレクトリをクリア
    await clearOutputDirectory();
    console.log();
    
    // 4. PRをコピー
    console.log('📦 PRをコピー中...');
    console.log();
    
    let successCount = 0;
    for (const pr of targetPRs) {
        const success = await copyPR(pr, OUTPUT_PATH);
        if (success) successCount++;
    }
    
    console.log();
    console.log('=' .repeat(70));
    console.log('✅ 処理完了');
    console.log('='.repeat(70));
    console.log(`対象PR数: ${targetPRs.length}`);
    console.log(`コピー成功: ${successCount}`);
    console.log(`コピー失敗: ${targetPRs.length - successCount}`);
    console.log(`出力先: ${OUTPUT_PATH}`);
    console.log('=' .repeat(70));
    console.log();
    console.log('使用方法:');
    console.log('  キーワード検出のみ: node copyBugFixes.mjs');
    console.log('  APR評価との積集合: node copyBugFixes.mjs intersection <APR結果ファイル>');
}

// 実行
main().catch(error => {
    console.error('❌ エラー:', error);
    process.exit(1);
});
