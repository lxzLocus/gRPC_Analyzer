/**
 * 既存の詳細分析レポートJSONファイルにaprStatusフィールドを追加する移行スクリプト
 * 
 * このスクリプトは：
 * 1. /app/output/detailed_analysis_report_*.json ファイルを読み込む
 * 2. 各エントリーのdatasetEntryからAPRログファイルを特定
 * 3. APRログのexperiment_metadata.statusを読み取ってaprStatusを補完
 * 4. correctnessLevels と matched_pairs の両方にaprStatusを追加
 * 5. 更新されたJSONを保存
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const APR_LOGS_DIR = path.join(__dirname, '..', 'apr-logs');

/**
 * APRログファイルからstatusを読み取る
 */
async function getAPRStatus(datasetEntry) {
    try {
        // datasetEntry: "boulder/issue/Implement_RA_method_for_unpausing_accounts"
        const parts = datasetEntry.split('/');
        if (parts.length < 3) return null;
        
        const projectName = parts[0];
        const categoryName = parts[1];
        const prName = parts.slice(2).join('/');
        
        const aprLogDir = path.join(APR_LOGS_DIR, projectName, categoryName, prName);
        
        // APRログディレクトリの存在確認
        try {
            await fs.access(aprLogDir);
        } catch {
            return null;
        }
        
        // ディレクトリ内の.logファイルを検索（最新のものを使用）
        const files = await fs.readdir(aprLogDir);
        const logFiles = files.filter(f => f.endsWith('.log'));
        
        if (logFiles.length === 0) {
            return null;
        }
        
        // 最新のログファイルを使用（ファイル名でソート）
        logFiles.sort().reverse();
        const logFilePath = path.join(aprLogDir, logFiles[0]);
        
        // ログファイルを読み込んでexperiment_metadata.statusを抽出
        const logContent = await fs.readFile(logFilePath, 'utf-8');
        const aprLogData = JSON.parse(logContent);
        
        return aprLogData.experiment_metadata?.status || null;
        
    } catch (error) {
        // エラーは無視（ログファイルが存在しない場合など）
        return null;
    }
}

async function migrateReportFiles() {
    console.log('🔄 APR Status移行スクリプト開始...\n');
    
    try {
        // detailed_analysis_report_*.json ファイルを検索
        const files = await fs.readdir(OUTPUT_DIR);
        const reportFiles = files.filter(f => 
            f.startsWith('detailed_analysis_report_') && f.endsWith('.json')
        );
        
        console.log(`📋 ${reportFiles.length}件のレポートファイルを発見\n`);
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        
        for (const fileName of reportFiles) {
            const filePath = path.join(OUTPUT_DIR, fileName);
            console.log(`📄 処理中: ${fileName}`);
            
            try {
                // JSONファイルを読み込む
                const content = await fs.readFile(filePath, 'utf-8');
                const data = JSON.parse(content);
                
                // datasetEntry -> aprStatusのマップを作成（APRログから読み取る）
                const aprStatusMap = new Map();
                const datasetEntries = new Set();
                
                // matched_pairsから全てのdatasetEntryを収集
                if (data.matched_pairs && Array.isArray(data.matched_pairs)) {
                    data.matched_pairs.forEach(pair => {
                        if (pair.datasetEntry) {
                            datasetEntries.add(pair.datasetEntry);
                        }
                    });
                }
                
                // correctnessLevelsからもdatasetEntryを収集
                const levels = ['identical', 'semanticallyEquivalent', 'plausibleButDifferent', 'incorrect', 'skipped'];
                for (const level of levels) {
                    const entries = data.correctnessLevels?.[level];
                    if (entries && Array.isArray(entries)) {
                        entries.forEach(entry => {
                            if (entry.datasetEntry) {
                                datasetEntries.add(entry.datasetEntry);
                            }
                        });
                    }
                }
                
                console.log(`   🔍 ${datasetEntries.size}件のdatasetEntryを検出`);
                
                // 各datasetEntryのAPRログからstatusを取得
                for (const datasetEntry of datasetEntries) {
                    const aprStatus = await getAPRStatus(datasetEntry);
                    if (aprStatus) {
                        aprStatusMap.set(datasetEntry, aprStatus);
                    }
                }
                
                console.log(`   🗺️  ${aprStatusMap.size}件のaprStatusを取得`);
                
                // matched_pairsを更新
                let matchedPairsUpdated = 0;
                if (data.matched_pairs && Array.isArray(data.matched_pairs)) {
                    data.matched_pairs.forEach(pair => {
                        if (!pair.aprStatus && pair.datasetEntry && aprStatusMap.has(pair.datasetEntry)) {
                            pair.aprStatus = aprStatusMap.get(pair.datasetEntry);
                            matchedPairsUpdated++;
                        }
                    });
                }
                
                // correctnessLevelsの各レベルを更新
                let correctnessLevelsUpdated = 0;
                let alreadyHasCount = 0;
                
                for (const level of levels) {
                    const entries = data.correctnessLevels?.[level];
                    if (!entries || !Array.isArray(entries)) continue;
                    
                    entries.forEach(entry => {
                        // aprStatusがあり、null以外の場合はスキップ
                        if (entry.aprStatus !== undefined && entry.aprStatus !== null) {
                            alreadyHasCount++;
                            return;
                        }
                        
                        // datasetEntryからaprStatusを取得（nullも含めて更新）
                        if (entry.datasetEntry && aprStatusMap.has(entry.datasetEntry)) {
                            entry.aprStatus = aprStatusMap.get(entry.datasetEntry);
                            correctnessLevelsUpdated++;
                        } else {
                            // aprStatusがない場合はnullに設定（既にnullの場合は更新しない）
                            if (entry.aprStatus === undefined) {
                                entry.aprStatus = null;
                            }
                        }
                    });
                }
                
                const totalUpdated = matchedPairsUpdated + correctnessLevelsUpdated;
                
                if (totalUpdated > 0) {
                    // 更新されたJSONを保存
                    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
                    console.log(`   ✅ ${totalUpdated}件更新 (matched_pairs: ${matchedPairsUpdated}, correctnessLevels: ${correctnessLevelsUpdated}, 既存: ${alreadyHasCount})`);
                    successCount++;
                } else if (alreadyHasCount > 0) {
                    console.log(`   ⏭️  スキップ（既に${alreadyHasCount}件のaprStatusが存在）`);
                    skipCount++;
                } else {
                    console.log(`   ⚠️  更新なし（APRログが見つからない）`);
                    skipCount++;
                }
                
            } catch (error) {
                console.error(`   ❌ エラー: ${error.message}`);
                errorCount++;
            }
            
            console.log('');
        }
        
        console.log('\n===========================================');
        console.log('🎉 移行完了!');
        console.log(`✅ 成功: ${successCount}ファイル`);
        console.log(`⏭️  スキップ: ${skipCount}ファイル`);
        console.log(`❌ エラー: ${errorCount}ファイル`);
        console.log('===========================================\n');
        
    } catch (error) {
        console.error('❌ 移行スクリプトエラー:', error);
        process.exit(1);
    }
}

// スクリプト実行
migrateReportFiles();
