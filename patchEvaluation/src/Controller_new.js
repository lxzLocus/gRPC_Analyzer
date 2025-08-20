import fs from 'fs/promises';
import path from 'path';
import APRLogParser from './aprLogParser.js';

async function datasetLoop(datasetDir, aprOutputPath) {
    const aprLogParser = new APRLogParser();
    
    // 統計情報を収集する変数
    const stats = {
        totalDatasetEntries: 0,
        aprLogFound: 0,
        aprLogNotFound: 0,
        aprLogAccessError: 0,
        aprParseSuccess: 0,
        aprParseFailure: 0,
        matchedPairs: [],
        unmatchedEntries: [],
        errorEntries: []
    };
    
    const projectDirs = (await fs.readdir(datasetDir, { withFileTypes: true }))
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    console.log(`🔍 データセット分析開始: ${projectDirs.length} プロジェクト`);
    console.log(`📂 データセットディレクトリ: ${datasetDir}`);
    console.log(`📁 APRログディレクトリ: ${aprOutputPath}`);
    console.log('================================================');

    // forEach を for...of に変更
    for (const projectName of projectDirs) {
        const projectPath = path.join(datasetDir, projectName);
        let categoryDirs = [];
        try {
            categoryDirs = (await fs.readdir(projectPath, { withFileTypes: true }))
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
        } catch (err) {
            console.error(`❌ Error reading category directories in ${projectPath}:`, err.message);
            stats.errorEntries.push({
                project: projectName,
                error: `Category read error: ${err.message}`
            });
            continue; // 次のプロジェクトへ
        }

        // forEach を for...of に変更
        for (const category of categoryDirs) {
            const categoryPath = path.join(projectPath, category);

            const titleDirs = (await fs.readdir(categoryPath, { withFileTypes: true }))
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            // forEach を for...of に変更
            for (const pullRequestTitle of titleDirs) {
                stats.totalDatasetEntries++; // データセットエントリー数をカウント
                
                const pullRequestPath = path.join(categoryPath, pullRequestTitle);
                const entryId = `${projectName}/${category}/${pullRequestTitle}`;

                console.log(`[${stats.totalDatasetEntries}] Processing: ${entryId}`);

                //"premerge_"で始まるサブディレクトリを取得
                const pullRequestContents = await fs.readdir(pullRequestPath, { withFileTypes: true });
                const premergePath = pullRequestContents
                    .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('premerge'))
                    .map(dirent => path.join(pullRequestPath, dirent.name))[0];

                // "merge_"で始まるサブディレクトリを取得
                let mergePath = pullRequestContents
                    .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('merge'))
                    .map(dirent => path.join(pullRequestPath, dirent.name))[0];
                
                // "merge_"がなければ"commit_snapshot_"を探す
                if (!mergePath) {
                    mergePath = pullRequestContents
                        .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('commit_snapshot_'))
                        .map(dirent => path.join(pullRequestPath, dirent.name))[0];
                }

                //APRログのパスの組み立て
                const aprLogRelativePath = path.join(aprOutputPath, path.relative(datasetDir, pullRequestPath));

                // APRログの存在確認
                let aprLogExists = false;
                let aprLogAccessible = false;
                let aprLogFiles = [];
                
                try {
                    const aprLogStats = await fs.stat(aprLogRelativePath);
                    if (aprLogStats.isDirectory()) {
                        // ディレクトリ内の.logファイルを探す
                        const files = await fs.readdir(aprLogRelativePath);
                        aprLogFiles = files.filter(file => file.endsWith('.log'));
                        
                        if (aprLogFiles.length > 0) {
                            aprLogExists = true;
                            aprLogAccessible = true;
                            stats.aprLogFound++;
                            console.log(`  ✅ APRログ発見: ${aprLogRelativePath} (${aprLogFiles.length} ファイル)`);
                        } else {
                            stats.aprLogNotFound++;
                            console.log(`  ⚠️ APRログディレクトリは存在するが.logファイルなし: ${aprLogRelativePath}`);
                        }
                    } else {
                        stats.aprLogNotFound++;
                        console.log(`  ❌ APRログが存在しません（ディレクトリではない）: ${aprLogRelativePath}`);
                    }
                } catch (error) {
                    stats.aprLogAccessError++;
                    console.log(`  ❌ APRログアクセスエラー: ${aprLogRelativePath} - ${error.message}`);
                    
                    stats.unmatchedEntries.push({
                        datasetEntry: entryId,
                        aprLogPath: aprLogRelativePath,
                        reason: `APRログアクセスエラー: ${error.message}`
                    });
                }

                // APRログが存在する場合のみ解析を試行
                if (aprLogExists && aprLogAccessible && aprLogFiles.length > 0) {
                    try {
                        console.log(`  🔍 APRログ解析を開始: ${entryId} (${aprLogFiles.length} ログファイル)`);
                        
                        // 最新のログファイルを選択（ファイル名でソート）
                        const latestLogFile = aprLogFiles.sort().pop();
                        const logFilePath = path.join(aprLogRelativePath, latestLogFile);
                        
                        console.log(`  📄 最新ログファイル: ${latestLogFile}`);
                        
                        // APRログの解析（LLMリクエストなし）
                        const aprLogData = await aprLogParser.parseAPRLog(aprLogRelativePath);
                        
                        if (aprLogData && aprLogData.turns && aprLogData.turns.length > 0) {
                            stats.aprParseSuccess++;
                            console.log(`  ✅ APRログ解析成功:`);
                            console.log(`    - 対話ターン数: ${aprLogData.turns.length}`);
                            console.log(`    - 総トークン数: ${aprLogData.totalTokens}`);
                            console.log(`    - 修正回数: ${aprLogData.modificationHistory.length}`);
                            
                            // 差分分析
                            const diffAnalysis = aprLogParser.analyzeDifferences(aprLogData);
                            console.log(`  📊 差分分析結果:`);
                            console.log(`    - 影響ファイル数: ${diffAnalysis.affectedFiles.length}`);
                            console.log(`    - フェーズ数: ${diffAnalysis.progressionAnalysis.phases.length}`);
                            
                            // 最終修正内容の抽出
                            const finalMods = aprLogParser.extractFinalModifications(aprLogData);
                            let finalModInfo = null;
                            if (finalMods.lastModification) {
                                console.log(`  🎯 最終修正 (Turn ${finalMods.lastModification.turn}):`);
                                console.log(`    - タイムスタンプ: ${finalMods.lastModification.timestamp}`);
                                console.log(`    - 修正行数: ${finalMods.lastModification.diff.split('\n').length}`);
                                
                                // diffからファイルパスリストを抽出
                                const filePaths = extractFilePathsFromDiff(finalMods.lastModification.diff);
                                console.log(`    - 影響ファイルパス:`, filePaths);
                                
                                finalModInfo = {
                                    turn: finalMods.lastModification.turn,
                                    timestamp: finalMods.lastModification.timestamp,
                                    diffLines: finalMods.lastModification.diff.split('\n').length,
                                    affectedFiles: filePaths
                                };
                                
                                // LLM評価をスキップ
                                console.log(`  🤖 LLM評価はスキップされました（統計収集モード）`);
                            }
                            
                            // 成功したマッチングを記録
                            stats.matchedPairs.push({
                                datasetEntry: entryId,
                                aprLogPath: aprLogRelativePath,
                                logFiles: aprLogFiles,
                                latestLogFile: latestLogFile,
                                aprLogData: {
                                    turns: aprLogData.turns.length,
                                    totalTokens: aprLogData.totalTokens,
                                    modifications: aprLogData.modificationHistory.length,
                                    affectedFiles: diffAnalysis.affectedFiles.length,
                                    phases: diffAnalysis.progressionAnalysis.phases.length
                                },
                                finalModification: finalModInfo
                            });
                            
                        } else {
                            stats.aprParseFailure++;
                            console.log(`  ❌ APRログの解析に失敗: ${aprLogRelativePath} (空のデータまたは無効な形式)`);
                            
                            stats.unmatchedEntries.push({
                                datasetEntry: entryId,
                                aprLogPath: aprLogRelativePath,
                                reason: 'APRログ解析失敗（空のデータまたは無効な形式）'
                            });
                        }
                        
                    } catch (parseError) {
                        stats.aprParseFailure++;
                        console.error(`  ❌ APRログ解析エラー (${entryId}):`, parseError.message);
                        
                        stats.errorEntries.push({
                            datasetEntry: entryId,
                            aprLogPath: aprLogRelativePath,
                            error: `解析エラー: ${parseError.message}`
                        });
                    }
                } else {
                    // APRログが存在しない場合
                    if (!aprLogExists) {
                        stats.unmatchedEntries.push({
                            datasetEntry: entryId,
                            aprLogPath: aprLogRelativePath,
                            reason: 'APRログディレクトリが存在しない'
                        });
                    } else if (aprLogFiles.length === 0) {
                        stats.unmatchedEntries.push({
                            datasetEntry: entryId,
                            aprLogPath: aprLogRelativePath,
                            reason: 'APRログファイル（.log）が存在しない'
                        });
                    }
                }
            }
        }
    }
    
    // 統計結果の表示
    console.log('\n');
    console.log('🔍=================================================');
    console.log('📊 APRログとデータセットのマッチング統計レポート');
    console.log('=================================================🔍');
    
    console.log('\n📈 基本統計:');
    console.log(`  📂 総データセットエントリー数: ${stats.totalDatasetEntries}`);
    console.log(`  ✅ APRログ発見数: ${stats.aprLogFound}`);
    console.log(`  ❌ APRログ未発見数: ${stats.aprLogNotFound}`);
    console.log(`  ⚠️  APRログアクセスエラー数: ${stats.aprLogAccessError}`);
    console.log(`  🎯 APRログ解析成功数: ${stats.aprParseSuccess}`);
    console.log(`  💥 APRログ解析失敗数: ${stats.aprParseFailure}`);
    
    const successRate = stats.totalDatasetEntries > 0 ? (stats.aprParseSuccess / stats.totalDatasetEntries * 100).toFixed(1) : 0;
    const aprFoundRate = stats.totalDatasetEntries > 0 ? (stats.aprLogFound / stats.totalDatasetEntries * 100).toFixed(1) : 0;
    
    console.log('\n📊 成功率:');
    console.log(`  🎯 APRログ発見率: ${aprFoundRate}% (${stats.aprLogFound}/${stats.totalDatasetEntries})`);
    console.log(`  ✅ 解析成功率: ${successRate}% (${stats.aprParseSuccess}/${stats.totalDatasetEntries})`);
    
    if (stats.aprLogFound > 0) {
        const parseSuccessFromFound = (stats.aprParseSuccess / stats.aprLogFound * 100).toFixed(1);
        console.log(`  🔍 発見済みAPRログからの解析成功率: ${parseSuccessFromFound}% (${stats.aprParseSuccess}/${stats.aprLogFound})`);
    }
    
    console.log('\n🔍 詳細内訳:');
    console.log(`  🟢 完全マッチング済み: ${stats.matchedPairs.length} ペア`);
    console.log(`  🟡 未マッチング: ${stats.unmatchedEntries.length} エントリー`);
    console.log(`  🔴 エラー発生: ${stats.errorEntries.length} エントリー`);
    
    // 成功したマッチングの詳細統計
    if (stats.matchedPairs.length > 0) {
        console.log('\n✅ 成功マッチングの詳細統計:');
        
        const totalTurns = stats.matchedPairs.reduce((sum, pair) => sum + pair.aprLogData.turns, 0);
        const totalTokens = stats.matchedPairs.reduce((sum, pair) => sum + pair.aprLogData.totalTokens, 0);
        const totalMods = stats.matchedPairs.reduce((sum, pair) => sum + pair.aprLogData.modifications, 0);
        const totalAffectedFiles = stats.matchedPairs.reduce((sum, pair) => sum + pair.aprLogData.affectedFiles, 0);
        
        const avgTurns = totalTurns / stats.matchedPairs.length;
        const avgTokens = totalTokens / stats.matchedPairs.length;
        const avgMods = totalMods / stats.matchedPairs.length;
        const avgAffectedFiles = totalAffectedFiles / stats.matchedPairs.length;
        
        console.log(`  💬 平均対話ターン数: ${avgTurns.toFixed(1)} (合計: ${totalTurns})`);
        console.log(`  🔤 平均トークン数: ${avgTokens.toFixed(0)} (合計: ${totalTokens})`);
        console.log(`  🔧 平均修正回数: ${avgMods.toFixed(1)} (合計: ${totalMods})`);
        console.log(`  📁 平均影響ファイル数: ${avgAffectedFiles.toFixed(1)} (合計: ${totalAffectedFiles})`);
        
        // 最終修正情報を持つマッチングの数
        const withFinalMod = stats.matchedPairs.filter(pair => pair.finalModification !== null).length;
        console.log(`  🎯 最終修正情報あり: ${withFinalMod}/${stats.matchedPairs.length} (${(withFinalMod/stats.matchedPairs.length*100).toFixed(1)}%)`);
    }
    
    // エラーの詳細表示（最初の5件）
    if (stats.errorEntries.length > 0) {
        console.log('\n🔴 エラー詳細 (最初の5件):');
        stats.errorEntries.slice(0, 5).forEach((error, index) => {
            console.log(`  ${index + 1}. ${error.datasetEntry}`);
            console.log(`     エラー: ${error.error}`);
            console.log(`     パス: ${error.aprLogPath}`);
        });
        if (stats.errorEntries.length > 5) {
            console.log(`  ... 他 ${stats.errorEntries.length - 5} 件のエラー`);
        }
    }
    
    // 未マッチングの理由別集計
    if (stats.unmatchedEntries.length > 0) {
        console.log('\n🟡 未マッチング理由別集計:');
        const reasonCount = {};
        stats.unmatchedEntries.forEach(entry => {
            reasonCount[entry.reason] = (reasonCount[entry.reason] || 0) + 1;
        });
        Object.entries(reasonCount).forEach(([reason, count]) => {
            console.log(`  - ${reason}: ${count} 件`);
        });
    }
    
    // 完全成功ペアのサンプル表示（最初の3件）
    if (stats.matchedPairs.length > 0) {
        console.log('\n🎯 成功マッチングサンプル (最初の3件):');
        stats.matchedPairs.slice(0, 3).forEach((pair, index) => {
            console.log(`  ${index + 1}. ${pair.datasetEntry}`);
            console.log(`     ターン数: ${pair.aprLogData.turns}, トークン: ${pair.aprLogData.totalTokens}, 修正: ${pair.aprLogData.modifications}`);
            console.log(`     ログファイル: ${pair.latestLogFile} (${pair.logFiles.length} ファイル中)`);
            if (pair.finalModification) {
                console.log(`     最終修正: Turn ${pair.finalModification.turn}, ${pair.finalModification.affectedFiles.length} ファイル`);
            }
        });
        if (stats.matchedPairs.length > 3) {
            console.log(`  ... 他 ${stats.matchedPairs.length - 3} 件の成功マッチング`);
        }
    }
    
    console.log('\n=================================================');
    console.log('📋 レポート完了');
    console.log('=================================================');
    
    return stats;
}

//個別テスト
if (import.meta.url === `file://${process.argv[1]}`) {
    const datasetPath = "/app/dataset/filtered_fewChanged";
    const aprOutputPath = "/app/log";  // /app/logが/app/apr-logsに相当

    console.log('🚀 APRログとデータセットのマッチング分析を開始');
    console.log(`📂 データセット: ${datasetPath}`);
    console.log(`📁 APRログ: ${aprOutputPath}`);
    console.log('=============================================\n');

    datasetLoop(datasetPath, aprOutputPath)
        .then((stats) => {
            console.log('\n🎉 分析が正常に完了しました！');
            console.log(`✅ ${stats.aprParseSuccess}/${stats.totalDatasetEntries} のマッチングペアが成功`);
            
            // 簡易サマリー
            if (stats.aprParseSuccess > 0) {
                console.log(`📊 成功率: ${(stats.aprParseSuccess/stats.totalDatasetEntries*100).toFixed(1)}%`);
            }
            if (stats.aprParseFailure > 0) {
                console.log(`⚠️ ${stats.aprParseFailure} 件のAPRログで解析エラーが発生`);
            }
            
            // 要約情報
            console.log('\n📋 最終サマリー:');
            console.log(`   総エントリー: ${stats.totalDatasetEntries}`);
            console.log(`   APRログ発見: ${stats.aprLogFound} (発見率: ${((stats.aprLogFound/stats.totalDatasetEntries)*100).toFixed(1)}%)`);
            console.log(`   解析成功: ${stats.aprParseSuccess} (成功率: ${((stats.aprParseSuccess/stats.totalDatasetEntries)*100).toFixed(1)}%)`);
            console.log(`   解析失敗: ${stats.aprParseFailure}`);
            console.log(`   エラー: ${stats.errorEntries.length}`);
        })
        .catch(err => {
            console.error("❌ マッチング分析中にエラーが発生:", err);
            console.error("スタックトレース:", err.stack);
        });
}

// diffからファイルパスリストを抽出する関数
function extractFilePathsFromDiff(diffText) {
    const filePaths = [];
    const diffLines = diffText.split('\n');
    for (const line of diffLines) {
        // diffのファイル開始行例: "diff --git a/src/foo.js b/src/foo.js"
        const match = line.match(/^diff --git a\/(.+?) b\//);
        if (match) {
            filePaths.push(match[1]);
        }
        // 追加: "--- a/path" や "+++ b/path" も考慮
        const match2 = line.match(/^--- a\/(.+)$/);
        if (match2) {
            filePaths.push(match2[1]);
        }
        const match3 = line.match(/^\+\+\+ b\/(.+)$/);
        if (match3) {
            filePaths.push(match3[1]);
        }
    }
    // 重複除去
    return [...new Set(filePaths)];
}
