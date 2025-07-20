#!/usr/bin/env node

/**
 * 処理結果を%%_Fin_%%タグベースで再評価
 */

import fs from 'fs';
import path from 'path';

const LOG_BASE_DIR = '/app/log';

function analyzeProcessingResultStrict(repositoryName, category, pullRequestTitle) {
    try {
        const logDir = path.join(LOG_BASE_DIR, repositoryName, category, pullRequestTitle);
        
        if (!fs.existsSync(logDir)) {
            return { success: false, reason: 'Log directory not found', hasFinTag: false, status: 'Unknown' };
        }
        
        // .logファイルを検索
        const logFiles = fs.readdirSync(logDir).filter(file => file.endsWith('.log'));
        
        if (logFiles.length === 0) {
            return { success: false, reason: 'No log files found', hasFinTag: false, status: 'Unknown' };
        }
        
        // 最新のログファイルを確認
        const latestLogFile = logFiles.sort().pop();
        const logFilePath = path.join(logDir, latestLogFile);
        const logContent = fs.readFileSync(logFilePath, 'utf-8');
        
        let logData;
        try {
            logData = JSON.parse(logContent);
        } catch (jsonError) {
            return { success: false, reason: 'Invalid JSON in log file', hasFinTag: false, status: 'JSON Parse Error' };
        }
        
        const status = logData.experiment_metadata?.status || 'Unknown';
        
        // %%_Fin_%%タグの存在確認
        const hasFinTag = logContent.includes('%%_Fin_%%') || status.includes('%%_Fin_%%');
        
        // 明示的なエラーの確認
        const hasContextError = logContent.includes('400 This model\'s maximum context length');
        const hasJSONError = logContent.includes('JSON parse failed');
        const hasIncompleteStatus = status.includes('Incomplete');
        const hasErrorStatus = status.includes('Error') || status.includes('Failed');
        
        const hasErrors = hasContextError || hasJSONError || hasIncompleteStatus || hasErrorStatus;
        
        // 成功条件: %%_Fin_%%タグがあり、重大なエラーがない
        const isSuccess = hasFinTag && !hasErrors;
        
        return {
            success: isSuccess,
            status: status,
            hasFinTag: hasFinTag,
            hasContextError: hasContextError,
            hasJSONError: hasJSONError,
            hasIncompleteStatus: hasIncompleteStatus,
            hasErrorStatus: hasErrorStatus,
            reason: isSuccess ? 'Success with %%_Fin_%% tag' : 
                   (!hasFinTag ? 'Missing %%_Fin_%% tag' : 'Has critical errors')
        };
        
    } catch (error) {
        return { success: false, reason: `Analysis error: ${error.message}`, hasFinTag: false, status: 'Error' };
    }
}

function reevaluateAllResults() {
    const results = {
        totalRepositories: 0,
        totalCategories: 0,
        totalPullRequests: 0,
        strictSuccess: 0,
        strictFailed: 0,
        missingFinTag: 0,
        hasContextErrors: 0,
        hasJSONErrors: 0,
        hasIncompleteStatus: 0,
        repositories: {}
    };
    
    console.log('🔍 ===== 厳密な結果再評価開始 =====');
    console.log('基準: %%_Fin_%%タグの存在 + 重大エラーの不存在');
    console.log('');
    
    if (!fs.existsSync(LOG_BASE_DIR)) {
        console.log('❌ Log directory not found:', LOG_BASE_DIR);
        return results;
    }
    
    const repositories = fs.readdirSync(LOG_BASE_DIR).filter(item => 
        fs.statSync(path.join(LOG_BASE_DIR, item)).isDirectory()
    );
    
    results.totalRepositories = repositories.length;
    
    for (const repository of repositories) {
        const repoPath = path.join(LOG_BASE_DIR, repository);
        const categories = fs.readdirSync(repoPath).filter(item => 
            fs.statSync(path.join(repoPath, item)).isDirectory()
        );
        
        results.totalCategories += categories.length;
        results.repositories[repository] = { categories: {} };
        
        console.log(`📁 Repository: ${repository}`);
        
        for (const category of categories) {
            const categoryPath = path.join(repoPath, category);
            const pullRequests = fs.readdirSync(categoryPath).filter(item => 
                fs.statSync(path.join(categoryPath, item)).isDirectory()
            );
            
            results.totalPullRequests += pullRequests.length;
            results.repositories[repository].categories[category] = {
                total: pullRequests.length,
                strictSuccess: 0,
                strictFailed: 0,
                details: {}
            };
            
            console.log(`  📋 Category ${category}: ${pullRequests.length} pull requests`);
            
            for (const pullRequest of pullRequests) {
                const analysis = analyzeProcessingResultStrict(repository, category, pullRequest);
                
                if (analysis.success) {
                    results.strictSuccess++;
                    results.repositories[repository].categories[category].strictSuccess++;
                    console.log(`    ✅ ${pullRequest}`);
                } else {
                    results.strictFailed++;
                    results.repositories[repository].categories[category].strictFailed++;
                    
                    if (!analysis.hasFinTag) results.missingFinTag++;
                    if (analysis.hasContextError) results.hasContextErrors++;
                    if (analysis.hasJSONError) results.hasJSONErrors++;
                    if (analysis.hasIncompleteStatus) results.hasIncompleteStatus++;
                    
                    console.log(`    ❌ ${pullRequest} - ${analysis.reason}`);
                    console.log(`       Status: ${analysis.status}, FinTag: ${analysis.hasFinTag}`);
                }
                
                results.repositories[repository].categories[category].details[pullRequest] = analysis;
            }
        }
        console.log('');
    }
    
    return results;
}

function generateReport(results) {
    console.log('');
    console.log('🎯 ===== 厳密評価レポート =====');
    console.log(`📊 総リポジトリ数: ${results.totalRepositories}`);
    console.log(`📊 総カテゴリ数: ${results.totalCategories}`);
    console.log(`📊 総プルリクエスト数: ${results.totalPullRequests}`);
    console.log('');
    console.log(`✅ 厳密成功 (%%_Fin_%%タグあり): ${results.strictSuccess}`);
    console.log(`❌ 厳密失敗: ${results.strictFailed}`);
    console.log(`📈 厳密成功率: ${((results.strictSuccess / results.totalPullRequests) * 100).toFixed(1)}%`);
    console.log('');
    console.log('🔍 失敗理由の内訳:');
    console.log(`  ⚠️  %%_Fin_%%タグ不足: ${results.missingFinTag}`);
    console.log(`  🚫 コンテキスト長制限エラー: ${results.hasContextErrors}`);
    console.log(`  📝 JSONパースエラー: ${results.hasJSONErrors}`);
    console.log(`  ⏸️  Incompleteステータス: ${results.hasIncompleteStatus}`);
    console.log('=====================================');
    
    // 詳細レポートをファイルに保存
    const reportPath = `/app/output/strict_evaluation_report_${new Date().toISOString().replace(/:/g, '-').split('.')[0]}Z.json`;
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`📄 詳細レポート保存: ${reportPath}`);
    
    return reportPath;
}

// メイン実行
const results = reevaluateAllResults();
const reportPath = generateReport(results);

export { analyzeProcessingResultStrict, reevaluateAllResults, generateReport };
