/**
 * コンソールへの表示処理を担当するViewクラス
 */
import { 
    getStateDisplayName, 
    getStateEmoji, 
    getStateDescription,
    isTerminalState,
    isSuccessfulCompletion,
    isErrorCompletion
} from '../types/AgentStates.js';

export class ConsoleView {
    /**
     * 分析開始メッセージの表示
     * @param {string} datasetPath - データセットパス
     * @param {string} aprOutputPath - APRログパス
     */
    showAnalysisStart(datasetPath, aprOutputPath) {
        console.log('🚀 APRログとデータセットのマッチング分析を開始');
        console.log(`📂 データセット: ${datasetPath}`);
        console.log(`📁 APRログ: ${aprOutputPath}`);
        console.log('=============================================\n');
    }

    /**
     * 処理開始メッセージの表示
     * @param {string} pullRequestKey - プルリクエストキー
     */
    showProcessingStart(pullRequestKey) {
        console.log(`\n🔄 処理開始: ${pullRequestKey}`);
    }

    /**
     * 処理中のエントリー情報表示
     * @param {number} entryNumber - エントリー番号
     * @param {string} entryId - エントリーID
     */
    showProcessingEntry(entryNumber, entryId) {
        console.log(`[${entryNumber}] Processing: ${entryId}`);
    }

    /**
     * Ground Truth Diff情報の表示
     * @param {number} fileCount - 変更されたファイル数
     * @param {string[]} fileList - 変更されたファイルリスト
     */
    showGroundTruthDiffInfo(fileCount, fileList) {
        console.log(`   📄 変更ファイル数: ${fileCount}`);
        if (fileList.length > 0) {
            console.log('   📝 変更されたファイル:');
            fileList.slice(0, 5).forEach(file => console.log(`      - ${file}`));
            if (fileList.length > 5) {
                console.log(`      ... (他 ${fileList.length - 5} ファイル)`);
            }
        }
    }

    /**
     * Ground Truth Diff生成エラーの表示
     * @param {string} errorMessage - エラーメッセージ
     */
    showGroundTruthDiffError(errorMessage) {
        console.log(`   ❌ Ground Truth Diff生成エラー: ${errorMessage}`);
    }
    /**
     * APRログ発見メッセージの表示
     * @param {string} aprLogPath - APRログパス
     * @param {number} fileCount - ファイル数
     */
    showAPRLogFound(aprLogPath, fileCount) {
        console.log(`  ✅ APRログ発見: ${aprLogPath} (${fileCount} ファイル)`);
    }

    /**
     * 複数APRログ発見メッセージの表示
     * @param {number} logCount - ログファイル数
     */
    showAPRLogsFound(logCount) {
        console.log(`  ✅ APRログ発見: ${logCount} ログファイル`);
    }

    /**
     * APRログ未発見メッセージの表示
     * @param {string} message - メッセージ
     */
    showAPRLogNotFound(message) {
        console.log(`  ⚠️ ${message}`);
    }

    /**
     * APRログアクセスエラーメッセージの表示
     * @param {string} aprLogPath - APRログパス
     * @param {string} errorMessage - エラーメッセージ
     */
    showAPRLogAccessError(aprLogPath, errorMessage) {
        console.log(`  ❌ APRログアクセスエラー: ${aprLogPath} - ${errorMessage}`);
    }

    /**
     * APRログ解析開始メッセージの表示
     * @param {string} entryId - エントリーID
     * @param {number} logFileCount - ログファイル数
     */
    showAPRLogAnalysisStart(entryId, logFileCount) {
        console.log(`  🔍 APRログ解析を開始: ${entryId} (${logFileCount} ログファイル)`);
    }

    /**
     * APR解析開始メッセージの表示
     * @param {string} pullRequestKey - プルリクエストキー
     * @param {number} logFileCount - ログファイル数
     */
    showAPRParsingStart(pullRequestKey, logFileCount) {
        console.log(`  🔍 APR解析を開始: ${pullRequestKey} (${logFileCount} ログファイル)`);
    }

    /**
     * 処理エラーメッセージの表示
     * @param {string} pullRequestKey - プルリクエストキー
     * @param {string} errorMessage - エラーメッセージ
     */
    showProcessingError(pullRequestKey, errorMessage) {
        console.log(`  ❌ 処理エラー [${pullRequestKey}]: ${errorMessage}`);
    }

    /**
     * APRログ構造解析成功メッセージの表示（ステップ1完了）
     */
    showAPRLogAnalysisSuccess() {
        console.log(`  ✅ ステップ1完了（APRログ構造解析＋差分抽出）:`);
    }

    /**
     * 差分分析結果の表示
     * @param {Object} diffAnalysis - 差分分析結果
     */
    showDiffAnalysisResult(diffAnalysis) {
        console.log(`  📊 差分分析結果:`);
        console.log(`    - 影響ファイル数: ${diffAnalysis.affectedFiles.length}`);
        console.log(`    - フェーズ数: ${diffAnalysis.progressionAnalysis.phases.length}`);
    }

    /**
     * 最終修正情報の表示
     * @param {Object} finalModInfo - 最終修正情報
     * @param {string[]} aprDiffFiles - APRログから抽出したファイルリスト
     */
    showFinalModification(finalModInfo, aprDiffFiles) {
        console.log(`  🎯 最終修正 (Turn ${finalModInfo.turn}):`);
        console.log(`    - タイムスタンプ: ${finalModInfo.timestamp}`);
        console.log(`    - 修正行数: ${finalModInfo.diffLines}`);
        console.log(`    - 影響ファイルパス (APRログ):`, aprDiffFiles);
    }

    /**
     * Ground Truth Diff作成開始メッセージの表示
     * @param {number} fileCount - 対象ファイル数
     */
    showGroundTruthDiffStart(fileCount) {
        console.log(`  📊 Ground Truth Diff作成開始 (${fileCount} ファイル)`);
    }

    /**
     * Ground Truth Diff作成完了メッセージの表示
     * @param {number} diffLines - diff行数
     */
    showGroundTruthDiffSuccess(diffLines) {
        console.log(`    ✅ Ground Truth Diff作成完了: ${diffLines} 行`);
    }

    /**
     * Ground Truth Diff作成失敗メッセージの表示
     */
    showGroundTruthDiffFailure() {
        console.log(`    ⚠️ Ground Truth Diff作成失敗`);
    }

    /**
     * LLM評価開始メッセージの表示
     */
    showLLMEvaluationStart() {
        console.log(`  🤖 TemplateCompilerを使用してLLM評価を開始...`);
    }

    /**
     * プロンプト生成完了メッセージの表示
     * @param {number} promptLength - プロンプト文字数
     */
    showPromptGenerated(promptLength) {
        console.log(`  📝 プロンプト生成完了 (${promptLength} 文字)`);
    }

    /**
     * LLM評価完了メッセージの表示
     * @param {Object} evaluationResult - 評価結果
     */
    showLLMEvaluationSuccess(evaluationResult) {
        const assessment = evaluationResult?.overall_assessment || evaluationResult?.semantic_equivalence_level || '評価結果不明';
        console.log(`  ✅ TemplateCompiler LLM評価完了: ${assessment}`);
        
        // 4軸評価形式（新形式）
        if (evaluationResult?.accuracy !== undefined) {
            // accuracy_score を優先的に使用（ラベル形式とスコア形式の両方に対応）
            const accuracyScore = evaluationResult.accuracy_score !== undefined
                ? evaluationResult.accuracy_score
                : (typeof evaluationResult.accuracy === 'object' 
                    ? (evaluationResult.accuracy.score || 0)
                    : (evaluationResult.accuracy || 0));
            const decisionScore = evaluationResult.decision_soundness_score !== undefined
                ? evaluationResult.decision_soundness_score
                : (typeof evaluationResult.decision_soundness === 'object'
                    ? (evaluationResult.decision_soundness.score || 0)
                    : (evaluationResult.decision_soundness || 0));
            const directionalScore = evaluationResult.directional_consistency_score !== undefined
                ? evaluationResult.directional_consistency_score
                : (typeof evaluationResult.directional_consistency === 'object'
                    ? (evaluationResult.directional_consistency.score || 0)
                    : (evaluationResult.directional_consistency || 0));
            const validityScore = evaluationResult.validity_score !== undefined
                ? evaluationResult.validity_score
                : (typeof evaluationResult.validity === 'object'
                    ? (evaluationResult.validity.score || 0)
                    : (evaluationResult.validity || 0));
            
            console.log(`    📊 4軸評価結果:`);
            console.log(`      - Accuracy: ${(accuracyScore * 100).toFixed(1)}%`);
            console.log(`      - Decision Soundness: ${decisionScore === 1.0 ? '✅ Pass' : '❌ Fail'}`);
            console.log(`      - Directional Consistency: ${directionalScore === 1.0 ? '✅ Pass' : '❌ Fail'}`);
            console.log(`      - Validity: ${validityScore === 1.0 ? '✅ Pass' : '❌ Fail'}`);
            
            // Repair Types表示
            if (evaluationResult.analysis_labels?.repair_types) {
                const repairTypes = evaluationResult.analysis_labels.repair_types;
                console.log(`    🏷️  Repair Types: ${repairTypes.join(', ')}`);
            }
        }
        // 2軸評価形式（旧形式・後方互換性）
        else {
            console.log(`    - 正確性: ${evaluationResult?.is_correct ? '正しい' : '不正確'}`);
            console.log(`    - 妥当性: ${evaluationResult?.is_plausible ? '妥当' : '妥当でない'}`);
        }
    }

    /**
     * LLM評価失敗メッセージの表示
     * @param {Object} errorAnalysis - エラー解析結果
     */
    showLLMEvaluationFailure(errorAnalysis = null) {
        console.log(`  ⚠️ LLM評価に失敗しました`);
        
        if (errorAnalysis) {
            console.log(`    - エラータイプ: ${errorAnalysis.type}`);
            if (errorAnalysis.statusCode) {
                console.log(`    - ステータスコード: ${errorAnalysis.statusCode}`);
            }
            if (errorAnalysis.retryable) {
                console.log(`    - リトライ推奨: はい`);
            }
            if (errorAnalysis.suggestion) {
                console.log(`    - 推奨対応: ${errorAnalysis.suggestion}`);
            }
        }
    }

    /**
     * LLM評価スキップメッセージの表示
     */
    showLLMEvaluationSkipped() {
        console.log(`  ⏩ LLM評価をスキップ（修正内容なし）`);
    }

    /**
     * LLM評価エラーメッセージの表示
     * @param {string} errorMessage - エラーメッセージ
     * @param {Object} errorAnalysis - エラー解析結果
     */
    showLLMEvaluationError(errorMessage, errorAnalysis = null) {
        console.error(`  ❌ TemplateCompiler LLM評価エラー: ${errorMessage}`);
        
        if (errorAnalysis) {
            console.error(`    - エラータイプ: ${errorAnalysis.type}`);
            if (errorAnalysis.statusCode) {
                console.error(`    - ステータスコード: ${errorAnalysis.statusCode}`);
            }
            if (errorAnalysis.retryable) {
                console.error(`    - リトライ可能: はい`);
            }
            if (errorAnalysis.suggestion) {
                console.error(`    - 推奨対応: ${errorAnalysis.suggestion}`);
            }
        }
    }

    /**
     * Intent Fulfillment評価結果の表示
     * @param {Object} intentResult - Intent Fulfillment評価結果
     */
    showIntentFulfillmentResult(intentResult) {
        if (!intentResult || intentResult.skipped || intentResult.error) {
            if (intentResult?.skipped) {
                const reason = intentResult.reason || 'unknown';
                console.log(`  ⏭️  Intent Fulfillment評価スキップ (${reason})`);
            } else if (intentResult?.error) {
                console.log(`  ❌ Intent Fulfillment評価エラー: ${intentResult.error}`);
            }
            return;
        }

        const score = intentResult.score || 0;
        const scorePercent = (score * 100).toFixed(1);
        
        // スコアに応じた絵文字
        let emoji = '❌';
        if (score >= 0.9) emoji = '🎯';
        else if (score >= 0.7) emoji = '✅';
        else if (score >= 0.4) emoji = '⚠️';
        
        console.log(`  ${emoji} Intent Fulfillment スコア: ${score.toFixed(2)} (${scorePercent}%)`);
        
        if (intentResult.reasoning) {
            console.log(`     理由: ${intentResult.reasoning}`);
        }
    }

    /**
     * 最終修正なしメッセージの表示
     */
    showNoFinalModification() {
        console.log(`  ℹ️ 最終修正なし（最後に実行された修正が見つかりませんでした）`);
    }

    /**
     * APRログ解析失敗メッセージの表示
     * @param {string} aprLogPath - APRログパス
     */
    showAPRLogParseFailure(aprLogPath) {
        console.log(`  ❌ APRログの解析に失敗: ${aprLogPath} (空のデータまたは無効な形式)`);
    }

    /**
     * APRログ解析エラーメッセージの表示
     * @param {string} entryId - エントリーID
     * @param {string} errorMessage - エラーメッセージ
     */
    showAPRLogParseError(entryId, errorMessage) {
        console.error(`  ❌ APRログ解析エラー (${entryId}): ${errorMessage}`);
    }

    /**
     * パスエラーメッセージの表示
     * @param {boolean} hasPremergePath - premergeパスの存在
     * @param {boolean} hasMergePath - mergeパスの存在
     */
    showPathErrors(hasPremergePath, hasMergePath) {
        if (!hasPremergePath) console.log(`  ⚠️ premergePathが見つかりません`);
        if (!hasMergePath) console.log(`  ⚠️ mergePath (commit_snapshot/merge) が見つかりません`);
    }

    /**
     * 差分解析エラーメッセージの表示
     * @param {string} errorMessage - エラーメッセージ
     */
    showDiffAnalysisError(errorMessage) {
        console.error(`  ❌ 差分解析エラー: ${errorMessage}`);
    }

    /**
     * カテゴリディレクトリ読み取りエラーメッセージの表示
     * @param {string} projectPath - プロジェクトパス
     * @param {string} errorMessage - エラーメッセージ
     */
    showCategoryReadError(projectPath, errorMessage) {
        console.error(`❌ Error reading category directories in ${projectPath}: ${errorMessage}`);
    }

    /**
     * 分析完了メッセージの表示
     * @param {Object} stats - 統計情報
     */
    showAnalysisComplete(stats) {
        console.log('\n🎉 分析が正常に完了しました！');
        console.log(`✅ ${stats.aprParseSuccess}/${stats.totalDatasetEntries} のマッチングペアが成功`);

        if (stats.aprParseSuccess > 0) {
            console.log(`📊 成功率: ${stats.calculateSuccessRate()}%`);
        }
        if (stats.aprParseFailure > 0) {
            console.log(`⚠️ ${stats.aprParseFailure} 件のAPRログで解析エラーが発生`);
        }
    }

    /**
     * 分析エラーメッセージの表示
     * @param {Error} error - エラーオブジェクト
     */
    showAnalysisError(error) {
        console.error("❌ マッチング分析中にエラーが発生:", error);
        console.error("スタックトレース:", error.stack);
    }

    /**
     * FSM状態情報の表示
     * @param {string} status - 状態値
     * @param {boolean} showDescription - 説明を表示するか（デフォルト: false）
     */
    showAgentState(status, showDescription = false) {
        const emoji = getStateEmoji(status);
        const displayName = getStateDisplayName(status);
        
        console.log(`  ${emoji} 状態: ${displayName} (${status})`);
        
        if (showDescription) {
            const description = getStateDescription(status);
            console.log(`     → ${description}`);
        }
        
        // 終了状態の場合は追加情報を表示
        if (isTerminalState(status)) {
            if (isSuccessfulCompletion(status)) {
                console.log(`     ✅ 正常に処理が完了しました`);
            } else if (isErrorCompletion(status)) {
                console.log(`     ⚠️ エラーが発生して処理が中断しました`);
            }
        }
    }

    /**
     * 対話データの状態情報を表示
     * @param {Object} dialogue - 対話データ
     */
    showDialogueStatus(dialogue) {
        if (!dialogue) return;
        
        console.log(`  📊 対話ステータス:`);
        
        if (dialogue.statusEmoji && dialogue.statusDisplayName) {
            console.log(`    ${dialogue.statusEmoji} ${dialogue.statusDisplayName} (${dialogue.status})`);
        } else {
            this.showAgentState(dialogue.status);
        }
        
        if (dialogue.isTerminalState !== undefined) {
            console.log(`    終了状態: ${dialogue.isTerminalState ? 'はい' : 'いいえ'}`);
        }
        
        // 正規化された場合は元の値も表示
        if (dialogue.rawStatus && dialogue.rawStatus !== dialogue.status) {
            console.log(`    ⚠️ 元の値: ${dialogue.rawStatus} → 正規化後: ${dialogue.status}`);
        }
    }
}
