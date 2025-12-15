#!/usr/bin/env node
/**
 * Dataset Filter Dry Run
 * データの確認のみを行い、実際のLLM呼び出しは行わない
 */

import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 Dataset Filtering - Dry Run (データ確認)');
console.log('━'.repeat(80));

const aprOutputDir = '/app/patchEvaluation/output';
const datasetDir = '/app/dataset/filtered_fewChanged';

// APR評価データ読み込み
console.log(`\n📂 APR評価データ読み込み: ${aprOutputDir}`);
const files = fs.readdirSync(aprOutputDir).filter(f => f.endsWith('.json'));
console.log(`  発見ファイル数: ${files.length}件`);

let totalEvaluations = 0;
const evaluationMap = new Map();

for (const file of files) {
    const filePath = path.join(aprOutputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    if (data.correctnessLevels) {
        Object.values(data.correctnessLevels).forEach((entries) => {
            if (Array.isArray(entries)) {
                entries.forEach(entry => {
                    evaluationMap.set(entry.pullRequestName, entry);
                    totalEvaluations++;
                });
            }
        });
    }
}

console.log(`  ✅ 読み込み完了: ${totalEvaluations}件のAPR評価データ`);
console.log(`  ユニークPR数: ${evaluationMap.size}件`);

// filtered_fewChangedのPRリスト取得
console.log(`\n📂 filtered_fewChangedデータセット読み込み: ${datasetDir}`);

const projects = fs.readdirSync(datasetDir).filter(p => {
    const projectPath = path.join(datasetDir, p);
    return fs.statSync(projectPath).isDirectory();
});

console.log(`  発見プロジェクト数: ${projects.length}個`);

let totalPRs = 0;
const prsByProject = {};
const prToProjectMap = new Map(); // PR名 -> プロジェクト名

for (const project of projects) {
    const projectPath = path.join(datasetDir, project);
    
    // issue/pullrequest ディレクトリを確認
    const subDirs = fs.readdirSync(projectPath).filter(d => {
        const subDirPath = path.join(projectPath, d);
        return fs.statSync(subDirPath).isDirectory();
    });
    
    let prCount = 0;
    for (const subDir of subDirs) {
        const subDirPath = path.join(projectPath, subDir);
        
        // この中にPR名のディレクトリがある
        const prs = fs.readdirSync(subDirPath).filter(pr => {
            const prPath = path.join(subDirPath, pr);
            return fs.statSync(prPath).isDirectory();
        });
        
        for (const pr of prs) {
            prToProjectMap.set(pr, project);
            prCount++;
            totalPRs++;
        }
    }
    
    prsByProject[project] = prCount;
    console.log(`    ${project}: ${prCount}件`);
}

console.log(`  ✅ 合計PR数: ${totalPRs}件`);

// マッチング確認
console.log(`\n🔗 APR評価データとのマッチング確認...`);
let matchedCount = 0;
let unmatchedPRs = [];

for (const [pr, project] of prToProjectMap.entries()) {
    if (evaluationMap.has(pr)) {
        matchedCount++;
    } else {
        unmatchedPRs.push(`${project}/${pr}`);
    }
}

console.log(`  ✅ マッチング成功: ${matchedCount}件`);
if (unmatchedPRs.length > 0) {
    console.log(`  ⚠️  マッチング失敗: ${unmatchedPRs.length}件`);
    console.log(`     (例: ${unmatchedPRs.slice(0, 5).join(', ')})`);
}

// サンプルデータ表示
console.log(`\n📋 サンプルAPR評価データ (最初の3件):`);
console.log('━'.repeat(80));

let count = 0;
for (const [prName, evaluation] of evaluationMap.entries()) {
    if (count >= 3) break;
    
    console.log(`\n[${count + 1}] PR名: ${prName}`);
    console.log(`  正確性レベル: ${evaluation.correctnessLevel}`);
    console.log(`  修正タイプ: [${evaluation.modificationTypes.slice(0, 5).join(', ')}${evaluation.modificationTypes.length > 5 ? ', ...' : ''}]`);
    console.log(`  評価理由 (抜粋): ${evaluation.evaluationReasoning.substring(0, 150)}...`);
    
    count++;
}

console.log('\n━'.repeat(80));
console.log('✅ データ確認完了');
console.log(`\n📝 次のステップ:`);
console.log(`  1. 環境変数 OPENAI_API_KEY を設定`);
console.log(`  2. npm run filter:dataset を実行`);
console.log(`  3. /app/output に結果ファイルが生成されます`);
console.log('━'.repeat(80));
