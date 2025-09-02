/**
 * コンソールへの表示処理を担当するViewクラス
 */
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
    showAPRLogFound(aprLogPath, fileCount) {
        console.log(`  ✅ APRログ発見: ${aprLogPath} (${fileCount} ファイル)`);
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
     * APRログ解析成功メッセージの表示
     */
    showAPRLogAnalysisSuccess() {
        console.log(`  ✅ APRログ解析成功:`);
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
        console.log(`  ✅ TemplateCompiler LLM評価完了: ${evaluationResult.overall_assessment}`);
        console.log(`    - 正確性: ${evaluationResult.is_correct ? '正しい' : '不正確'}`);
        console.log(`    - 妥当性: ${evaluationResult.is_plausible ? '妥当' : '妥当でない'}`);
    }

    /**
     * LLM評価失敗メッセージの表示
     */
    showLLMEvaluationFailure() {
        console.log(`  ⚠️ LLM評価に失敗しました`);
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
     */
    showLLMEvaluationError(errorMessage) {
        console.error(`  ❌ TemplateCompiler LLM評価エラー: ${errorMessage}`);
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
}
