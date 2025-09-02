/**
 * Diff処理専用のControllerクラス
 */
export class DiffProcessingController {
    constructor(datasetRepository, aprLogService, consoleView, stats) {
        this.datasetRepository = datasetRepository;
        this.aprLogService = aprLogService;
        this.consoleView = consoleView;
        this.stats = stats;
    }

    /**
     * 成功した解析の処理
     * @param {string} entryId - エントリーID
     * @param {string} aprLogPath - APRログパス
     * @param {Object} aprLogInfo - APRログ情報
     * @param {Object} analysisData - 解析データ
     * @param {Object} paths - パス情報
     * @param {string[]} changedFiles - 変更ファイルリスト
     * @returns {Promise<Object>} 処理結果
     */
    async processSuccessfulAnalysis(entryId, aprLogPath, aprLogInfo, analysisData, paths, changedFiles) {
        const { aprLogData, diffAnalysis } = analysisData;
        
        this.consoleView.showDiffAnalysisResult(diffAnalysis);

        try {
            // 最終修正内容の抽出
            const finalModsResult = this.aprLogService.extractFinalModifications(aprLogData);
            
            let finalModInfo = null;
            let groundTruthDiff = null;

            if (finalModsResult.hasModification) {
                finalModInfo = finalModsResult.finalModInfo;
                const aprDiffFiles = finalModsResult.aprDiffFiles;

                this.consoleView.showFinalModification(finalModInfo, aprDiffFiles);

                // Ground Truth Diffの作成
                if (paths.premergePath && paths.mergePath && aprDiffFiles.length > 0) {
                    groundTruthDiff = await this.createGroundTruthDiff(
                        paths.premergePath, 
                        paths.mergePath, 
                        aprDiffFiles
                    );
                }

                // 成功結果の記録
                this.recordSuccessfulMatch(
                    entryId, 
                    aprLogPath, 
                    aprLogInfo, 
                    paths, 
                    changedFiles, 
                    finalModsResult.aprDiffFiles, 
                    groundTruthDiff, 
                    aprLogData, 
                    diffAnalysis, 
                    finalModInfo
                );

                return {
                    success: true,
                    data: {
                        finalModInfo,
                        aprDiffFiles,
                        groundTruthDiff,
                        diffAnalysis,
                        hasModification: true
                    }
                };
            } else {
                this.consoleView.showNoFinalModification();
                
                return {
                    success: true,
                    data: {
                        finalModInfo: null,
                        aprDiffFiles: [],
                        groundTruthDiff: null,
                        diffAnalysis,
                        hasModification: false
                    }
                };
            }

        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Ground Truth Diffの作成
     * @param {string} premergePath - premergeパス
     * @param {string} mergePath - mergeパス
     * @param {string[]} aprDiffFiles - APR差分ファイルリスト
     * @returns {Promise<string|null>} 作成されたdiff
     */
    async createGroundTruthDiff(premergePath, mergePath, aprDiffFiles) {
        this.consoleView.showGroundTruthDiffStart(aprDiffFiles.length);
        
        try {
            // 新しい統合機能を使用
            const result = await this.datasetRepository.getChangedFilesWithDiff(
                premergePath, 
                mergePath, 
                null // 全ファイル対象
            );
            
            if (result.groundTruthDiff) {
                const diffLines = result.groundTruthDiff.split('\n').length;
                this.consoleView.showGroundTruthDiffSuccess(diffLines);
                this.consoleView.showGroundTruthDiffInfo(result.changedFiles.length, result.changedFiles);
            } else {
                this.consoleView.showGroundTruthDiffFailure();
            }
            
            return result.groundTruthDiff;
        } catch (error) {
            this.consoleView.showGroundTruthDiffError(error.message);
            return null;
        }
    }

    /**
     * Ground Truth Diffの作成（ファイルパス指定版）
     * @param {string} premergePath - premergeパス
     * @param {string} mergePath - mergeパス
     * @param {string[]} specificFiles - 対象ファイルパスリスト
     * @returns {Promise<Object>} { changedFiles, groundTruthDiff }
     */
    async createGroundTruthDiffForFiles(premergePath, mergePath, specificFiles) {
        this.consoleView.showGroundTruthDiffStart(specificFiles.length);
        
        try {
            // 指定されたファイルのみからdiffを生成
            const { generateGroundTruthDiff } = await import('../GenerateFIleChanged.js');
            const groundTruthDiff = await generateGroundTruthDiff(premergePath, mergePath, specificFiles);
            
            const result = {
                changedFiles: specificFiles,
                groundTruthDiff
            };
            
            if (groundTruthDiff) {
                const diffLines = groundTruthDiff.split('\n').length;
                this.consoleView.showGroundTruthDiffSuccess(diffLines);
                this.consoleView.showGroundTruthDiffInfo(specificFiles.length, specificFiles);
            } else {
                this.consoleView.showGroundTruthDiffFailure();
            }
            
            return result;
        } catch (error) {
            this.consoleView.showGroundTruthDiffError(error.message);
            return {
                changedFiles: [],
                groundTruthDiff: ''
            };
        }
    }

    /**
     * 複数の差分処理方式を提供するファクトリメソッド
     * @param {string} strategy - 処理戦略（'all', 'specific', 'optimized'）
     * @param {string} premergePath - premergeパス
     * @param {string} mergePath - mergeパス
     * @param {string[]} targetFiles - 対象ファイル（戦略によって使用）
     * @returns {Promise<Object>} 差分処理結果
     */
    async createDiffByStrategy(strategy, premergePath, mergePath, targetFiles = []) {
        const strategies = {
            'all': () => this.createGroundTruthDiff(premergePath, mergePath, []),
            'specific': () => this.createGroundTruthDiffForFiles(premergePath, mergePath, targetFiles),
            'optimized': () => this.createOptimizedDiff(premergePath, mergePath, targetFiles)
        };

        const strategyFunc = strategies[strategy];
        if (!strategyFunc) {
            throw new Error(`Unknown diff strategy: ${strategy}`);
        }

        try {
            const result = await strategyFunc();
            
            return {
                success: true,
                strategy,
                data: result
            };
        } catch (error) {
            return {
                success: false,
                strategy,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 最適化された差分作成
     * @param {string} premergePath - premergeパス
     * @param {string} mergePath - mergeパス
     * @param {string[]} targetFiles - 対象ファイル
     * @returns {Promise<Object>} 最適化された差分結果
     */
    async createOptimizedDiff(premergePath, mergePath, targetFiles) {
        // ファイルサイズや変更量に基づいて最適な処理方法を選択
        const fileAnalysis = await this.analyzeTargetFiles(premergePath, mergePath, targetFiles);
        
        if (fileAnalysis.totalSize > 1024 * 1024) { // 1MB以上
            this.consoleView.showMessage('🔄 大きなファイルを検出、最適化モードで処理します');
            return await this.createIncrementalDiff(premergePath, mergePath, targetFiles);
        } else {
            return await this.createGroundTruthDiffForFiles(premergePath, mergePath, targetFiles);
        }
    }

    /**
     * 対象ファイルの分析
     * @param {string} premergePath - premergeパス
     * @param {string} mergePath - mergeパス
     * @param {string[]} targetFiles - 対象ファイル
     * @returns {Promise<Object>} ファイル分析結果
     */
    async analyzeTargetFiles(premergePath, mergePath, targetFiles) {
        let totalSize = 0;
        let fileCount = 0;

        for (const filePath of targetFiles) {
            try {
                const { stat } = await import('fs/promises');
                const premergeFilePath = `${premergePath}/${filePath}`;
                const mergeFilePath = `${mergePath}/${filePath}`;

                const [premergeStats, mergeStats] = await Promise.allSettled([
                    stat(premergeFilePath),
                    stat(mergeFilePath)
                ]);

                if (premergeStats.status === 'fulfilled') {
                    totalSize += premergeStats.value.size;
                    fileCount++;
                }
                if (mergeStats.status === 'fulfilled') {
                    totalSize += mergeStats.value.size;
                    fileCount++;
                }
            } catch (error) {
                // ファイルが存在しない場合は無視
            }
        }

        return {
            totalSize,
            fileCount,
            averageSize: fileCount > 0 ? totalSize / fileCount : 0
        };
    }

    /**
     * インクリメンタル差分作成
     * @param {string} premergePath - premergeパス
     * @param {string} mergePath - mergeパス
     * @param {string[]} targetFiles - 対象ファイル
     * @returns {Promise<Object>} インクリメンタル差分結果
     */
    async createIncrementalDiff(premergePath, mergePath, targetFiles) {
        const chunks = this.chunkArray(targetFiles, 5); // 5ファイルずつ処理
        let combinedDiff = '';
        const processedFiles = [];

        for (const chunk of chunks) {
            try {
                const chunkResult = await this.createGroundTruthDiffForFiles(premergePath, mergePath, chunk);
                
                if (chunkResult.groundTruthDiff) {
                    combinedDiff += chunkResult.groundTruthDiff + '\n';
                    processedFiles.push(...chunk);
                }
            } catch (error) {
                this.consoleView.showMessage(`⚠️ チャンク処理エラー: ${error.message}`);
            }
        }

        return {
            changedFiles: processedFiles,
            groundTruthDiff: combinedDiff.trim()
        };
    }

    /**
     * 配列を指定サイズのチャンクに分割
     * @param {Array} array - 分割する配列
     * @param {number} chunkSize - チャンクサイズ
     * @returns {Array[]} チャンク配列
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * 成功したマッチングの記録
     */
    recordSuccessfulMatch(entryId, aprLogPath, aprLogInfo, paths, changedFiles, aprDiffFiles, groundTruthDiff, aprLogData, diffAnalysis, finalModInfo) {
        const latestLogFile = aprLogInfo.logFiles.sort().pop();
        
        this.stats.addMatchedPair({
            datasetEntry: entryId,
            aprLogPath: aprLogPath,
            logFiles: aprLogInfo.logFiles,
            latestLogFile: latestLogFile,
            premergePath: paths.premergePath,
            mergePath: paths.mergePath,
            changedFiles: changedFiles,
            aprDiffFiles: aprDiffFiles || [],
            groundTruthDiff: groundTruthDiff,
            aprLogData: {
                turns: aprLogData.turns.length,
                totalTokens: aprLogData.totalTokens,
                modifications: aprLogData.modificationHistory.length,
                affectedFiles: diffAnalysis.affectedFiles.length,
                phases: diffAnalysis.progressionAnalysis.phases.length
            },
            finalModification: finalModInfo
        });
    }
}
