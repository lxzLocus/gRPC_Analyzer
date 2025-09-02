import path from 'path';

/**
 * LLM評価処理専用のControllerクラス
 */
export class LLMEvaluationController {
    constructor(llmEvaluationService, datasetRepository, consoleView) {
        this.llmEvaluationService = llmEvaluationService;
        this.datasetRepository = datasetRepository;
        this.consoleView = consoleView;
    }

    /**
     * LLM評価の実行
     * @param {Object} finalModInfo - 最終修正情報
     * @param {Object} paths - パス情報
     * @param {string[]} aprDiffFiles - APR差分ファイル
     * @param {string} groundTruthDiff - Ground Truth Diff
     * @param {Object} aprLogData - APRログデータ
     * @returns {Promise<Object>} 評価結果
     */
    async executeLLMEvaluation(finalModInfo, paths, aprDiffFiles, groundTruthDiff, aprLogData) {
        // 修正内容の事前チェック
        const validationResult = this.validateModificationData(finalModInfo);
        if (!validationResult.isValid) {
            return this.handleValidationFailure(validationResult.reason);
        }

        this.consoleView.showLLMEvaluationStart();

        try {
            // 評価コンテキストの準備
            const evaluationContext = await this.prepareEvaluationContext(
                finalModInfo, 
                paths, 
                aprDiffFiles, 
                groundTruthDiff, 
                aprLogData
            );

            // LLM評価の実行
            const evaluationResult = await this.llmEvaluationService.evaluateWithTemplate(evaluationContext);

            // 結果の処理
            return this.processEvaluationResult(evaluationResult, finalModInfo);

        } catch (error) {
            return this.handleEvaluationError(error, finalModInfo);
        }
    }

    /**
     * 修正データの検証
     * @param {Object} finalModInfo - 最終修正情報
     * @returns {Object} 検証結果
     */
    validateModificationData(finalModInfo) {
        if (!finalModInfo) {
            return {
                isValid: false,
                reason: "修正情報が存在しません"
            };
        }

        if (!finalModInfo.diff || finalModInfo.diff.trim().length === 0) {
            return {
                isValid: false,
                reason: "修正内容が空です"
            };
        }

        // diffの形式チェック
        if (!this.isValidDiffFormat(finalModInfo.diff)) {
            return {
                isValid: false,
                reason: "無効なdiff形式です"
            };
        }

        return {
            isValid: true,
            reason: null
        };
    }

    /**
     * Diff形式の検証
     * @param {string} diff - Diff文字列
     * @returns {boolean} 有効なdiff形式かどうか
     */
    isValidDiffFormat(diff) {
        // 基本的なdiff形式チェック
        const diffPatterns = [
            /^diff --git/m,           // git diff header
            /^@@.*@@/m,               // hunk header
            /^[\+\-\s]/m             // change lines
        ];

        return diffPatterns.some(pattern => pattern.test(diff));
    }

    /**
     * 評価コンテキストの準備
     * @param {Object} finalModInfo - 最終修正情報
     * @param {Object} paths - パス情報
     * @param {string[]} aprDiffFiles - APR差分ファイル
     * @param {string} groundTruthDiff - Ground Truth Diff
     * @param {Object} aprLogData - APRログデータ
     * @returns {Promise<Object>} 評価コンテキスト
     */
    async prepareEvaluationContext(finalModInfo, paths, aprDiffFiles, groundTruthDiff, aprLogData) {
        // コードコンテキストの生成
        const codeContext = await this.generateCodeContext(paths, aprDiffFiles);
        
        // エージェントの思考プロセスの抽出
        const agentThoughtProcess = this.extractThoughtProcess(aprLogData);
        
        // メタデータの計算
        const metadata = this.calculateMetadata(aprLogData, groundTruthDiff, finalModInfo);

        return {
            // パス情報
            premergePath: paths.premergePath,
            mergePath: paths.mergePath,
            
            // ファイル情報
            aprDiffFiles,
            affectedFileCount: aprDiffFiles.length,
            
            // Diff情報
            groundTruthDiff,
            agentGeneratedDiff: finalModInfo.diff,
            
            // プロセス情報
            agentThoughtProcess,
            
            // コードコンテキスト
            codeContext,
            
            // メタデータ
            ...metadata
        };
    }

    /**
     * コードコンテキストの生成
     * @param {Object} paths - パス情報
     * @param {string[]} aprDiffFiles - APR差分ファイル
     * @returns {Promise<Object>} コードコンテキスト情報
     */
    async generateCodeContext(paths, aprDiffFiles) {
        const codeContext = {
            premergeFiles: {},
            mergeFiles: {},
            fileSummary: {
                totalFiles: aprDiffFiles.length,
                fileTypes: {},
                totalLines: 0
            }
        };

        try {
            const filePromises = aprDiffFiles.map(async (filePath) => {
                return await this.processFileForContext(filePath, paths, codeContext);
            });

            await Promise.allSettled(filePromises);

            // 統計情報の計算
            this.calculateFileSummary(codeContext);

            return codeContext;

        } catch (error) {
            console.error(`⚠️ コードコンテキスト生成エラー: ${error.message}`);
            return codeContext;
        }
    }

    /**
     * ファイルのコンテキスト処理
     * @param {string} filePath - ファイルパス
     * @param {Object} paths - パス情報
     * @param {Object} codeContext - コードコンテキスト（更新される）
     * @returns {Promise<void>}
     */
    async processFileForContext(filePath, paths, codeContext) {
        try {
            const premergeFilePath = path.join(paths.premergePath, filePath);
            const mergeFilePath = path.join(paths.mergePath, filePath);

            // 並行してファイルの存在確認
            const [premergeExists, mergeExists] = await Promise.allSettled([
                this.datasetRepository.fileExists(premergeFilePath),
                this.datasetRepository.fileExists(mergeFilePath)
            ]);

            // premergeファイルの処理
            if (premergeExists.status === 'fulfilled' && premergeExists.value) {
                codeContext.premergeFiles[filePath] = await this.readFileContent(premergeFilePath);
            }

            // mergeファイルの処理
            if (mergeExists.status === 'fulfilled' && mergeExists.value) {
                codeContext.mergeFiles[filePath] = await this.readFileContent(mergeFilePath);
            }

            // ファイルタイプの統計
            const fileExt = path.extname(filePath);
            codeContext.fileSummary.fileTypes[fileExt] = 
                (codeContext.fileSummary.fileTypes[fileExt] || 0) + 1;

        } catch (error) {
            console.error(`⚠️ ファイルコンテキスト処理エラー (${filePath}): ${error.message}`);
        }
    }

    /**
     * ファイル内容の読み取り
     * @param {string} filePath - ファイルパス
     * @returns {Promise<Object>} ファイル情報
     */
    async readFileContent(filePath) {
        try {
            const { readFile } = await import('fs/promises');
            const content = await readFile(filePath, 'utf8');
            
            return {
                content: content,
                lineCount: content.split('\n').length,
                size: content.length
            };
        } catch (error) {
            return { 
                error: `読み取りエラー: ${error.message}` 
            };
        }
    }

    /**
     * ファイル統計情報の計算
     * @param {Object} codeContext - コードコンテキスト
     */
    calculateFileSummary(codeContext) {
        codeContext.fileSummary.totalLines = Object.values(codeContext.mergeFiles)
            .reduce((total, file) => total + (file.lineCount || 0), 0);
    }

    /**
     * 思考プロセスの抽出
     * @param {Object} aprLogData - APRログデータ
     * @returns {string} 思考プロセステキスト
     */
    extractThoughtProcess(aprLogData) {
        if (!aprLogData.turns || aprLogData.turns.length === 0) {
            return "思考プロセスの情報がありません";
        }

        return aprLogData.turns.map(turn => {
            let content = [];
            if (turn.thought) content.push(`Thought: ${turn.thought}`);
            if (turn.plan) content.push(`Plan: ${turn.plan}`);
            if (turn.commentText) content.push(`Comment: ${turn.commentText}`);
            return `Turn ${turn.turnNumber}: ${content.join('\n')}`;
        }).join('\n\n');
    }

    /**
     * メタデータの計算
     * @param {Object} aprLogData - APRログデータ
     * @param {string} groundTruthDiff - Ground Truth Diff
     * @param {Object} finalModInfo - 最終修正情報
     * @returns {Object} メタデータ
     */
    calculateMetadata(aprLogData, groundTruthDiff, finalModInfo) {
        return {
            totalTurns: aprLogData.turns?.length || 0,
            modificationCount: aprLogData.modificationHistory?.length || 0,
            groundTruthLineCount: groundTruthDiff ? groundTruthDiff.split('\n').length : 0,
            agentDiffLineCount: finalModInfo.diff ? finalModInfo.diff.split('\n').length : 0
        };
    }

    /**
     * 検証失敗時の処理
     * @param {string} reason - 失敗理由
     * @returns {Object} 失敗結果
     */
    handleValidationFailure(reason) {
        this.consoleView.showLLMEvaluationSkipped();
        
        return {
            success: false,
            reason: 'validation_failed',
            error: reason,
            result: { skipped: reason }
        };
    }

    /**
     * 評価結果の処理
     * @param {Object} evaluationResult - LLM評価結果
     * @param {Object} finalModInfo - 最終修正情報
     * @returns {Object} 処理済み結果
     */
    processEvaluationResult(evaluationResult, finalModInfo) {
        if (evaluationResult.success) {
            this.consoleView.showPromptGenerated(evaluationResult.result.promptLength || 0);
            this.consoleView.showLLMEvaluationSuccess(evaluationResult.result);
            finalModInfo.llmEvaluation = evaluationResult.result;
            
            return {
                success: true,
                result: evaluationResult.result
            };
        } else {
            this.consoleView.showLLMEvaluationFailure();
            finalModInfo.llmEvaluation = { error: evaluationResult.error };
            
            return {
                success: false,
                error: evaluationResult.error,
                result: evaluationResult.result
            };
        }
    }

    /**
     * 評価エラー時の処理
     * @param {Error} error - エラーオブジェクト
     * @param {Object} finalModInfo - 最終修正情報
     * @returns {Object} エラー結果
     */
    handleEvaluationError(error, finalModInfo) {
        this.consoleView.showLLMEvaluationError(error.message);
        finalModInfo.llmEvaluation = { error: error.message, templateUsed: false };
        
        return {
            success: false,
            error: error.message,
            result: { error: error.message, templateUsed: false }
        };
    }
}
