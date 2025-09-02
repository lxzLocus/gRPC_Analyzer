import path from 'path';

/**
 * プロジェクト単位の処理を担当するControllerクラス
 */
export class ProjectProcessingController {
    constructor(datasetRepository, aprLogService, consoleView, stats) {
        this.datasetRepository = datasetRepository;
        this.aprLogService = aprLogService;
        this.consoleView = consoleView;
        this.stats = stats;
    }

    /**
     * プロジェクトの処理
     * @param {string} projectName - プロジェクト名
     * @param {string} datasetDir - データセットディレクトリのパス
     * @param {string} aprOutputPath - APRログディレクトリのパス
     * @returns {Promise<Object>} 処理結果
     */
    async processProject(projectName, datasetDir, aprOutputPath) {
        const projectPath = path.join(datasetDir, projectName);
        
        try {
            const categoryDirs = await this.datasetRepository.getCategoryDirectories(projectPath);
            
            const results = {
                projectName,
                categories: [],
                totalCategories: categoryDirs.length,
                successfulCategories: 0,
                errors: []
            };
            
            for (const category of categoryDirs) {
                const categoryResult = await this.processCategory(
                    projectName, 
                    category, 
                    projectPath, 
                    datasetDir, 
                    aprOutputPath
                );
                
                results.categories.push(categoryResult);
                
                if (categoryResult.success) {
                    results.successfulCategories++;
                } else {
                    results.errors.push({
                        category,
                        error: categoryResult.error
                    });
                }
            }

            return {
                success: results.errors.length === 0,
                data: results
            };

        } catch (error) {
            this.consoleView.showCategoryReadError(projectPath, error.message);
            this.stats.addErrorEntry({
                project: projectName,
                error: `Category read error: ${error.message}`
            });

            return {
                success: false,
                error: error.message,
                data: { projectName, categories: [] }
            };
        }
    }

    /**
     * カテゴリの処理
     * @param {string} projectName - プロジェクト名
     * @param {string} category - カテゴリ名
     * @param {string} projectPath - プロジェクトパス
     * @param {string} datasetDir - データセットディレクトリのパス
     * @param {string} aprOutputPath - APRログディレクトリのパス
     * @returns {Promise<Object>} 処理結果
     */
    async processCategory(projectName, category, projectPath, datasetDir, aprOutputPath) {
        const categoryPath = path.join(projectPath, category);
        
        try {
            const titleDirs = await this.datasetRepository.getTitleDirectories(categoryPath);
            
            const results = {
                category,
                pullRequests: [],
                totalPullRequests: titleDirs.length,
                successfulPullRequests: 0,
                errors: []
            };
            
            for (const pullRequestTitle of titleDirs) {
                const prResult = await this.processPullRequest(
                    projectName, 
                    category, 
                    pullRequestTitle, 
                    categoryPath, 
                    datasetDir, 
                    aprOutputPath
                );
                
                results.pullRequests.push(prResult);
                
                if (prResult.success) {
                    results.successfulPullRequests++;
                } else {
                    results.errors.push({
                        pullRequest: pullRequestTitle,
                        error: prResult.error
                    });
                }
            }

            return {
                success: results.errors.length === 0,
                data: results
            };

        } catch (error) {
            this.consoleView.showCategoryReadError(categoryPath, error.message);
            
            return {
                success: false,
                error: error.message,
                data: { category, pullRequests: [] }
            };
        }
    }

    /**
     * プルリクエストの処理
     * @param {string} projectName - プロジェクト名
     * @param {string} category - カテゴリ名
     * @param {string} pullRequestTitle - プルリクエストタイトル
     * @param {string} categoryPath - カテゴリパス
     * @param {string} datasetDir - データセットディレクトリのパス
     * @param {string} aprOutputPath - APRログディレクトリのパス
     * @returns {Promise<Object>} 処理結果
     */
    async processPullRequest(projectName, category, pullRequestTitle, categoryPath, datasetDir, aprOutputPath) {
        this.stats.incrementTotalEntries();
        
        const pullRequestPath = path.join(categoryPath, pullRequestTitle);
        const entryId = `${projectName}/${category}/${pullRequestTitle}`;

        this.consoleView.showProcessingEntry(this.stats.totalDatasetEntries, entryId);

        try {
            // パス情報の取得
            const paths = await this.datasetRepository.getPullRequestPaths(pullRequestPath);
            
            if (!paths.hasValidPaths) {
                this.consoleView.showPathErrors(Boolean(paths.premergePath), Boolean(paths.mergePath));
                return {
                    success: false,
                    error: 'Invalid paths',
                    data: { entryId, paths: null }
                };
            }

            // 変更ファイルの取得
            const changedFiles = await this.datasetRepository.getChangedFiles(
                paths.premergePath, 
                paths.mergePath, 
                null
            );

            // APRログの処理
            const aprLogRelativePath = this.datasetRepository.buildAPRLogPath(
                aprOutputPath, 
                datasetDir, 
                pullRequestPath
            );

            const aprResult = await this.processAPRLog(
                entryId, 
                aprLogRelativePath, 
                paths, 
                changedFiles
            );

            return {
                success: aprResult.success,
                data: {
                    entryId,
                    paths,
                    changedFiles,
                    aprResult: aprResult.data
                },
                error: aprResult.error
            };

        } catch (error) {
            this.consoleView.showDiffAnalysisError(error.message);
            
            return {
                success: false,
                error: error.message,
                data: { entryId }
            };
        }
    }

    /**
     * APRログの処理
     * @param {string} entryId - エントリーID
     * @param {string} aprLogPath - APRログパス
     * @param {Object} paths - premerge/mergeパス情報
     * @param {string[]} changedFiles - 変更ファイルリスト
     * @returns {Promise<Object>} 処理結果
     */
    async processAPRLog(entryId, aprLogPath, paths, changedFiles) {
        // APRログの存在確認
        const aprLogInfo = await this.aprLogService.checkAPRLogExistence(aprLogPath);
        
        if (!aprLogInfo.exists) {
            this.handleAPRLogNotFound(entryId, aprLogPath, paths, changedFiles, aprLogInfo.error);
            return {
                success: false,
                error: aprLogInfo.error,
                data: { exists: false }
            };
        }

        this.consoleView.showAPRLogFound(aprLogPath, aprLogInfo.logFiles.length);
        this.stats.incrementAprLogFound();

        // APRログの解析
        const analysisResult = await this.analyzeAPRLog(entryId, aprLogPath, aprLogInfo, paths, changedFiles);
        
        return {
            success: analysisResult.success,
            data: {
                exists: true,
                logInfo: aprLogInfo,
                analysis: analysisResult.data
            },
            error: analysisResult.error
        };
    }

    /**
     * APRログの解析実行
     * @param {string} entryId - エントリーID
     * @param {string} aprLogPath - APRログパス
     * @param {Object} aprLogInfo - APRログ情報
     * @param {Object} paths - パス情報
     * @param {string[]} changedFiles - 変更ファイルリスト
     * @returns {Promise<Object>} 解析結果
     */
    async analyzeAPRLog(entryId, aprLogPath, aprLogInfo, paths, changedFiles) {
        this.consoleView.showAPRLogAnalysisStart(entryId, aprLogInfo.logFiles.length);

        try {
            const parseResult = await this.aprLogService.parseAPRLog(aprLogPath);
            
            if (!parseResult.success) {
                this.handleAPRLogParseFailure(entryId, aprLogPath, paths, changedFiles, parseResult.error);
                return {
                    success: false,
                    error: parseResult.error,
                    data: null
                };
            }

            this.stats.incrementAprParseSuccess();
            this.consoleView.showAPRLogAnalysisSuccess();

            return {
                success: true,
                data: parseResult.data,
                error: null
            };

        } catch (error) {
            this.handleAPRLogParseError(entryId, aprLogPath, paths, changedFiles, error.message);
            
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * APRログ未発見時の処理
     */
    handleAPRLogNotFound(entryId, aprLogPath, paths, changedFiles, error) {
        if (error.includes('アクセスエラー')) {
            this.consoleView.showAPRLogAccessError(aprLogPath, error);
            this.stats.incrementAprLogAccessError();
        } else {
            this.consoleView.showAPRLogNotFound(error);
            this.stats.incrementAprLogNotFound();
        }

        this.stats.addUnmatchedEntry({
            datasetEntry: entryId,
            aprLogPath: aprLogPath,
            premergePath: paths.premergePath,
            mergePath: paths.mergePath,
            changedFiles: changedFiles,
            aprDiffFiles: [],
            reason: error
        });
    }

    /**
     * APRログ解析失敗時の処理
     */
    handleAPRLogParseFailure(entryId, aprLogPath, paths, changedFiles, error) {
        this.stats.incrementAprParseFailure();
        this.consoleView.showAPRLogParseFailure(aprLogPath);
        
        this.stats.addUnmatchedEntry({
            datasetEntry: entryId,
            aprLogPath: aprLogPath,
            premergePath: paths.premergePath,
            mergePath: paths.mergePath,
            changedFiles: changedFiles,
            aprDiffFiles: [],
            reason: 'APRログ解析失敗（空のデータまたは無効な形式）'
        });
    }

    /**
     * APRログ解析エラー時の処理
     */
    handleAPRLogParseError(entryId, aprLogPath, paths, changedFiles, errorMessage) {
        this.stats.incrementAprParseFailure();
        this.consoleView.showAPRLogParseError(entryId, errorMessage);
        
        this.stats.addErrorEntry({
            datasetEntry: entryId,
            aprLogPath: aprLogPath,
            premergePath: paths.premergePath,
            mergePath: paths.mergePath,
            changedFiles: changedFiles,
            aprDiffFiles: [],
            error: `解析エラー: ${errorMessage}`
        });
    }
}
