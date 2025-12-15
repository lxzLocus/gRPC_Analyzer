#!/usr/bin/env node
/**
 * Dataset Filter Main Entry Point
 * APR評価データを使用して、filtered_fewChangedデータセットを
 * バグ修正のみにフィルタリングする
 * 
 * 使用方法:
 *   npm run filter-dataset
 *   または
 *   node --loader ts-node/esm src/utils/filterDatasetMain.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import Config from '../modules/config.js';
import { LLMClientFactory } from '../modules/llmClientFactory.js';
import { ThreePhaseFilteringEngine } from './threePhaseFilteringEngine.js';
import { APREvaluation, ClassificationResult } from './datasetFilterClassifier.js';
import { getJSTFileTimestamp } from './timeUtils.js';

interface PRWithClassification {
    pullRequestName: string;
    project: string;
    evaluationReasoning: string;
    modificationTypes: string[];
    correctnessLevel: string;
    semanticSimilarityScore: number;
    classification: ClassificationResult;
}

/**
 * APR評価データを読み込み
 */
function loadAPREvaluations(aprOutputDir: string): Map<string, APREvaluation> {
    const evaluationMap = new Map<string, APREvaluation>();
    
    console.log(`📂 APR評価データ読み込み: ${aprOutputDir}`);
    
    const files = fs.readdirSync(aprOutputDir).filter(f => f.endsWith('.json'));
    console.log(`  発見ファイル数: ${files.length}件`);
    
    for (const file of files) {
        const filePath = path.join(aprOutputDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        // correctnessLevels配下の全エントリを展開
        if (data.correctnessLevels) {
            Object.values(data.correctnessLevels).forEach((entries: any) => {
                if (Array.isArray(entries)) {
                    entries.forEach(entry => {
                        evaluationMap.set(entry.pullRequestName, {
                            pullRequestName: entry.pullRequestName,
                            evaluationReasoning: entry.evaluationReasoning,
                            plausibilityReasoning: entry.plausibilityReasoning,
                            modificationTypes: entry.modificationTypes || [],
                            correctnessLevel: entry.correctnessLevel,
                            semanticSimilarityScore: entry.semanticSimilarityScore || 0
                        });
                    });
                }
            });
        }
    }
    
    console.log(`  ✅ 読み込み完了: ${evaluationMap.size}件のAPR評価データ`);
    return evaluationMap;
}

/**
 * filtered_fewChangedディレクトリからPRリストを取得
 */
function getFilteredFewChangedPRs(datasetDir: string): Map<string, string> {
    const prMap = new Map<string, string>(); // PR名 -> プロジェクト名
    
    console.log(`📂 filtered_fewChangedデータセット読み込み: ${datasetDir}`);
    
    if (!fs.existsSync(datasetDir)) {
        console.error(`❌ ディレクトリが存在しません: ${datasetDir}`);
        return prMap;
    }
    
    // プロジェクトディレクトリを走査
    const projects = fs.readdirSync(datasetDir).filter(p => {
        const projectPath = path.join(datasetDir, p);
        return fs.statSync(projectPath).isDirectory();
    });
    
    console.log(`  発見プロジェクト数: ${projects.length}個`);
    
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
                prMap.set(pr, project);
                prCount++;
            }
        }
        
        console.log(`    ${project}: ${prCount}件`);
    }
    
    console.log(`  ✅ 合計PR数: ${prMap.size}件`);
    return prMap;
}

/**
 * 結果をJSON形式で保存
 */
function saveResults(
    results: PRWithClassification[], 
    outputDir: string,
    stats: any
): void {
    const timestamp = getJSTFileTimestamp();
    const outputFile = path.join(outputDir, `dataset_filtering_results_JST_${timestamp}.json`);
    
    const output = {
        metadata: {
            timestamp: timestamp,
            totalPRs: results.length,
            filteringStats: stats
        },
        results: results
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n💾 結果を保存: ${outputFile}`);
}

/**
 * バグ修正のみを抽出して別ディレクトリに保存
 */
function saveBugFixOnly(
    results: PRWithClassification[],
    outputDir: string
): void {
    const bugFixResults = results.filter(r => r.classification.category === 'BUG_FIX');
    
    const timestamp = getJSTFileTimestamp();
    const outputFile = path.join(outputDir, `bug_fix_only_JST_${timestamp}.json`);
    
    const output = {
        metadata: {
            timestamp: timestamp,
            totalBugFixes: bugFixResults.length,
            confidenceDistribution: {
                high: bugFixResults.filter(r => r.classification.confidence >= 0.8).length,
                medium: bugFixResults.filter(r => r.classification.confidence >= 0.6 && r.classification.confidence < 0.8).length,
                low: bugFixResults.filter(r => r.classification.confidence < 0.6).length
            }
        },
        bugFixes: bugFixResults
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n🐛 バグ修正のみ抽出: ${outputFile}`);
    console.log(`   抽出件数: ${bugFixResults.length}件`);
}

/**
 * レビュー必要なケースを保存
 */
function saveManualReviewNeeded(
    results: PRWithClassification[],
    outputDir: string
): void {
    const reviewNeeded = results.filter(r => r.classification.requiresManualReview);
    
    if (reviewNeeded.length === 0) {
        console.log('\n👍 人間レビューが必要なケースはありません');
        return;
    }
    
    const timestamp = getJSTFileTimestamp();
    const outputFile = path.join(outputDir, `manual_review_needed_JST_${timestamp}.json`);
    
    const output = {
        metadata: {
            timestamp: timestamp,
            totalReviewNeeded: reviewNeeded.length
        },
        reviewCases: reviewNeeded
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n👁️  要レビューケース保存: ${outputFile}`);
    console.log(`   件数: ${reviewNeeded.length}件`);
}

/**
 * メイン処理
 */
async function main() {
    console.log('🚀 Dataset Filtering Tool - 3段階フィルタリング');
    console.log('━'.repeat(80));
    
    // 設定読み込み (Config は pullRequestPath を第一引数に取る)
    const config = new Config('/app/dataset/filtered_fewChanged', '/app/config/config_openai.json');
    
    const aprOutputDir = '/app/patchEvaluation/output';
    const datasetDir = '/app/dataset/filtered_fewChanged';
    const outputDir = '/app/output';
    
    // 出力ディレクトリ確認
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 1. APR評価データ読み込み
    const evaluationMap = loadAPREvaluations(aprOutputDir);
    
    // 2. filtered_fewChangedのPRリスト取得
    const prMap = getFilteredFewChangedPRs(datasetDir);
    
    // 3. マッチング確認
    console.log('\n🔗 APR評価データとのマッチング確認...');
    const matchedEvaluations: APREvaluation[] = [];
    const prToProjectMap = new Map<string, string>(); // PR名 -> プロジェクト名
    const unmatchedPRs: string[] = [];
    
    for (const [pr, project] of prMap.entries()) {
        const evaluation = evaluationMap.get(pr);
        if (evaluation) {
            matchedEvaluations.push(evaluation);
            prToProjectMap.set(pr, project);
        } else {
            unmatchedPRs.push(pr);
        }
    }
    
    console.log(`  ✅ マッチング成功: ${matchedEvaluations.length}件`);
    if (unmatchedPRs.length > 0) {
        console.log(`  ⚠️  マッチング失敗: ${unmatchedPRs.length}件`);
        console.log(`     (例: ${unmatchedPRs.slice(0, 3).join(', ')})`);
    }
    
    if (matchedEvaluations.length === 0) {
        console.error('❌ マッチングするPRが見つかりませんでした');
        process.exit(1);
    }
    
    // 4. LLMクライアント初期化
    console.log('\n🤖 LLMクライアント初期化中...');
    const llmClient = LLMClientFactory.create(config);
    await llmClient.waitForInitialization();
    console.log(`  ✅ ${llmClient.getProviderName()} クライアント準備完了`);
    
    const model = config.get('llm.model', 'gpt-5');
    const temperature = config.get('llm.temperature', 0.1);
    console.log(`  モデル: ${model}, Temperature: ${temperature}`);
    
    // 5. 3段階フィルタリング実行
    const engine = new ThreePhaseFilteringEngine(llmClient, model, temperature);
    const classificationResults = await engine.classifyBatch(matchedEvaluations);
    
    // 6. 結果を統合
    const finalResults: PRWithClassification[] = matchedEvaluations.map((evaluation, index) => {
        // プロジェクト名を取得
        const project = prToProjectMap.get(evaluation.pullRequestName) || 'unknown';
        
        return {
            pullRequestName: evaluation.pullRequestName,
            project: project,
            evaluationReasoning: evaluation.evaluationReasoning,
            modificationTypes: evaluation.modificationTypes,
            correctnessLevel: evaluation.correctnessLevel,
            semanticSimilarityScore: evaluation.semanticSimilarityScore,
            classification: classificationResults[index]
        };
    });
    
    // 7. 結果保存
    const stats = engine.getStats();
    saveResults(finalResults, outputDir, stats);
    saveBugFixOnly(finalResults, outputDir);
    saveManualReviewNeeded(finalResults, outputDir);
    
    console.log('\n✅ すべての処理が完了しました');
    console.log('━'.repeat(80));
}

// エラーハンドリング付き実行
main().catch(error => {
    console.error('❌ 致命的エラー:', error);
    process.exit(1);
});
