import fs from 'fs/promises';
import path from 'path';
import APRLogParser from '../src/aprLogParser.js';
import { config as dotenvConfig } from 'dotenv';

// 環境変数の読み込み
dotenvConfig({ path: '/app/.env' });

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

                // 優先度: commit_snapshot_ > merge_
                // 先に"commit_snapshot_"で始まるサブディレクトリを探す
                let mergePath = pullRequestContents
                    .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('commit_snapshot_'))
                    .map(dirent => path.join(pullRequestPath, dirent.name))[0];
                
                // "commit_snapshot_"がなければ"merge_"を探す
                if (!mergePath) {
                    mergePath = pullRequestContents
                        .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('merge'))
                        .map(dirent => path.join(pullRequestPath, dirent.name))[0];
                }

                // premergePathとmergePathの比較による変更ファイルリストの作成
                let changedFiles = [];
                let diffOutput = null;
                
                if (premergePath && mergePath) {
                    try {
                        console.log(`  🔍 差分解析を開始: premerge vs ${mergePath.includes('commit_snapshot_') ? 'commit_snapshot' : 'merge'}`);
                        
                        // git diffを使用して変更されたファイルを取得
                        const { execSync } = await import('child_process');
                        
                        // --name-onlyオプションで変更されたファイル名のみを取得
                        const diffCommand = `cd "${premergePath}" && git diff --name-only "${mergePath}"`;
                        
                        try {
                            diffOutput = execSync(diffCommand, { encoding: 'utf8', stdio: 'pipe' });
                            changedFiles = diffOutput.trim().split('\n').filter(file => file.length > 0);
                            
                            console.log(`  ✅ 変更ファイル検出: ${changedFiles.length} ファイル`);
                            if (changedFiles.length > 0) {
                                console.log(`    📁 変更ファイル:`, changedFiles.slice(0, 5)); // 最初の5つを表示
                                if (changedFiles.length > 5) {
                                    console.log(`    ... 他 ${changedFiles.length - 5} ファイル`);
                                }
                            }
                        } catch (gitError) {
                            // git diffが失敗した場合、ファイル比較による代替手段
                            console.log(`  ⚠️ git diff失敗、ファイル比較で代替: ${gitError.message}`);
                            changedFiles = await compareDirectoriesForChanges(premergePath, mergePath);
                            console.log(`  ✅ ファイル比較完了: ${changedFiles.length} ファイル変更検出`);
                        }
                    } catch (error) {
                        console.error(`  ❌ 差分解析エラー:`, error.message);
                        changedFiles = [];
                    }
                } else {
                    if (!premergePath) console.log(`  ⚠️ premergePathが見つかりません`);
                    if (!mergePath) console.log(`  ⚠️ mergePath (commit_snapshot/merge) が見つかりません`);
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
                        const aprLogData = await aprLogParser.parseLogEntry(aprLogRelativePath);
                        
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
                                
                                // LLM評価を実行（修正が存在する場合のみ）
                                if (finalMods.lastModification.diff && finalMods.lastModification.diff.trim().length > 0) {
                                    console.log(`  🤖 LLM評価を開始...`);
                                    try {
                                        const llmEvaluation = await aprLogParser.evaluateWithLLM(
                                            "", // codeContext - 空文字列を渡す（必要に応じて調整）
                                            "", // groundTruthDiff - 空文字列を渡す
                                            finalMods.lastModification.diff, // agentGeneratedDiff
                                            aprLogData.turns.map(turn => turn.content).join('\n\n') // agentThoughtProcess
                                        );
                                        
                                        if (llmEvaluation && llmEvaluation.success) {
                                            console.log(`  ✅ LLM評価完了: ${llmEvaluation.summary.overall_assessment}`);
                                            console.log(`    - 正確性: ${llmEvaluation.summary.is_correct ? '正しい' : '不正確'}`);
                                            console.log(`    - 妥当性: ${llmEvaluation.summary.is_plausible ? '妥当' : '妥当でない'}`);
                                            console.log(`    - セマンティック等価性: ${llmEvaluation.summary.semantic_equivalence_level}`);
                                            console.log(`    - 適用ルール数: ${llmEvaluation.summary.rules_count}`);
                                            
                                            // LLM評価結果をfinalModInfoに追加
                                            finalModInfo.llmEvaluation = llmEvaluation.summary;
                                        } else {
                                            console.log(`  ⚠️ LLM評価に失敗しました`);
                                            finalModInfo.llmEvaluation = null;
                                        }
                                    } catch (llmError) {
                                        console.error(`  ❌ LLM評価エラー:`, llmError.message);
                                        finalModInfo.llmEvaluation = { error: llmError.message };
                                    }
                                } else {
                                    console.log(`  ⏩ LLM評価をスキップ（修正内容なし）`);
                                    finalModInfo.llmEvaluation = { skipped: "no_modifications" };
                                }
                            } else {
                                console.log(`  ℹ️ 最終修正なし（最後に実行された修正が見つかりませんでした）`);
                            }
                            
                            // 成功したマッチングを記録
                            stats.matchedPairs.push({
                                datasetEntry: entryId,
                                aprLogPath: aprLogRelativePath,
                                logFiles: aprLogFiles,
                                latestLogFile: latestLogFile,
                                premergePath: premergePath,
                                mergePath: mergePath,
                                changedFiles: changedFiles, // 変更ファイルリストを追加
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
            const totalChangedFiles = stats.matchedPairs.reduce((sum, pair) => sum + (pair.changedFiles ? pair.changedFiles.length : 0), 0);
            
            const avgTurns = totalTurns / stats.matchedPairs.length;
            const avgTokens = totalTokens / stats.matchedPairs.length;
            const avgMods = totalMods / stats.matchedPairs.length;
            const avgAffectedFiles = totalAffectedFiles / stats.matchedPairs.length;
            const avgChangedFiles = totalChangedFiles / stats.matchedPairs.length;
            
            console.log(`  💬 平均対話ターン数: ${avgTurns.toFixed(1)} (合計: ${totalTurns})`);
            console.log(`  🔤 平均トークン数: ${avgTokens.toFixed(0)} (合計: ${totalTokens})`);
            console.log(`  🔧 平均修正回数: ${avgMods.toFixed(1)} (合計: ${totalMods})`);
            console.log(`  📁 平均影響ファイル数 (APRログ): ${avgAffectedFiles.toFixed(1)} (合計: ${totalAffectedFiles})`);
            console.log(`  📝 平均変更ファイル数 (データセット): ${avgChangedFiles.toFixed(1)} (合計: ${totalChangedFiles})`);
            
            // パス情報の統計
            const withPremergePath = stats.matchedPairs.filter(pair => pair.premergePath).length;
            const withMergePath = stats.matchedPairs.filter(pair => pair.mergePath).length;
            const withChangedFiles = stats.matchedPairs.filter(pair => pair.changedFiles && pair.changedFiles.length > 0).length;
            
            console.log(`  📂 premergePathあり: ${withPremergePath}/${stats.matchedPairs.length} (${(withPremergePath/stats.matchedPairs.length*100).toFixed(1)}%)`);
            console.log(`  📂 mergePathあり: ${withMergePath}/${stats.matchedPairs.length} (${(withMergePath/stats.matchedPairs.length*100).toFixed(1)}%)`);
            console.log(`  📝 変更ファイル検出: ${withChangedFiles}/${stats.matchedPairs.length} (${(withChangedFiles/stats.matchedPairs.length*100).toFixed(1)}%)`);
            
            // 最終修正情報を持つマッチングの数
            const withFinalMod = stats.matchedPairs.filter(pair => pair.finalModification !== null).length;
            const withLLMEval = stats.matchedPairs.filter(pair => pair.finalModification && pair.finalModification.llmEvaluation && !pair.finalModification.llmEvaluation.error).length;
            console.log(`  🎯 最終修正情報あり: ${withFinalMod}/${stats.matchedPairs.length} (${(withFinalMod/stats.matchedPairs.length*100).toFixed(1)}%)`);
            console.log(`  🤖 LLM評価成功: ${withLLMEval}/${stats.matchedPairs.length} (${(withLLMEval/stats.matchedPairs.length*100).toFixed(1)}%)`);
            
            // LLM評価結果の集計
            if (withLLMEval > 0) {
                const correctCount = stats.matchedPairs.filter(pair => 
                    pair.finalModification && 
                    pair.finalModification.llmEvaluation && 
                    pair.finalModification.llmEvaluation.is_correct
                ).length;
                const plausibleCount = stats.matchedPairs.filter(pair => 
                    pair.finalModification && 
                    pair.finalModification.llmEvaluation && 
                    pair.finalModification.llmEvaluation.is_plausible
                ).length;
                
                console.log(`  ✅ LLM評価結果:`)
                console.log(`    - 正確な修正: ${correctCount}/${withLLMEval} (${(correctCount/withLLMEval*100).toFixed(1)}%)`);
                console.log(`    - 妥当な修正: ${plausibleCount}/${withLLMEval} (${(plausibleCount/withLLMEval*100).toFixed(1)}%)`);
            }
        }    // エラーの詳細表示（最初の5件）
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
                
                // 変更ファイル情報を追加
                if (pair.changedFiles && pair.changedFiles.length > 0) {
                    console.log(`     📝 データセット変更: ${pair.changedFiles.length} ファイル (${pair.changedFiles.slice(0, 3).join(', ')}${pair.changedFiles.length > 3 ? '...' : ''})`);
                } else {
                    console.log(`     📝 データセット変更: 検出されず`);
                }
                
                if (pair.finalModification) {
                    console.log(`     最終修正: Turn ${pair.finalModification.turn}, ${pair.finalModification.affectedFiles.length} ファイル`);
                    if (pair.finalModification.llmEvaluation && !pair.finalModification.llmEvaluation.error) {
                        console.log(`     LLM評価: ${pair.finalModification.llmEvaluation.overall_assessment} (正確性: ${pair.finalModification.llmEvaluation.is_correct ? 'Yes' : 'No'})`);
                    }
                }
            });
            if (stats.matchedPairs.length > 3) {
                console.log(`  ... 他 ${stats.matchedPairs.length - 3} 件の成功マッチング`);
            }
        }    console.log('\n=================================================');
    console.log('📋 レポート完了');
    console.log('=================================================');
    
    return stats;
}

//個別テスト
if (import.meta.url === `file://${process.argv[1]}`) {
    const datasetPath = "/app/dataset/filtered_fewChanged";
    const aprOutputPath = "/app/apr-logs";  // 正しいAPRログパスに修正

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

// ディレクトリ比較による変更ファイル検出の代替関数
async function compareDirectoriesForChanges(dir1, dir2) {
    const changedFiles = [];
    
    try {
        // 両ディレクトリのファイル一覧を再帰的に取得
        const getFilesRecursively = async (dirPath, basePath = '') => {
            const files = [];
            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    const relativePath = path.join(basePath, entry.name);
                    
                    if (entry.isDirectory()) {
                        // .gitディレクトリは除外
                        if (entry.name !== '.git') {
                            files.push(...await getFilesRecursively(fullPath, relativePath));
                        }
                    } else if (entry.isFile()) {
                        files.push(relativePath);
                    }
                }
            } catch (error) {
                // ディレクトリアクセスエラーは無視
            }
            return files;
        };
        
        const [files1, files2] = await Promise.all([
            getFilesRecursively(dir1),
            getFilesRecursively(dir2)
        ]);
        
        const allFiles = new Set([...files1, ...files2]);
        
        for (const filePath of allFiles) {
            const file1Path = path.join(dir1, filePath);
            const file2Path = path.join(dir2, filePath);
            
            try {
                const [stat1, stat2] = await Promise.allSettled([
                    fs.stat(file1Path),
                    fs.stat(file2Path)
                ]);
                
                // ファイルの存在状況をチェック
                const exists1 = stat1.status === 'fulfilled';
                const exists2 = stat2.status === 'fulfilled';
                
                if (!exists1 || !exists2) {
                    // ファイルが片方にしか存在しない（追加/削除）
                    changedFiles.push(filePath);
                } else {
                    // 両方に存在する場合、サイズまたは変更時刻で比較
                    const size1 = stat1.value.size;
                    const size2 = stat2.value.size;
                    const mtime1 = stat1.value.mtime.getTime();
                    const mtime2 = stat2.value.mtime.getTime();
                    
                    if (size1 !== size2 || Math.abs(mtime1 - mtime2) > 1000) { // 1秒の誤差を許容
                        changedFiles.push(filePath);
                    }
                }
            } catch (error) {
                // ファイル比較エラーは無視
            }
        }
    } catch (error) {
        console.error(`  ディレクトリ比較エラー:`, error.message);
    }
    
    return changedFiles;
}

export { datasetLoop, extractFilePathsFromDiff };
