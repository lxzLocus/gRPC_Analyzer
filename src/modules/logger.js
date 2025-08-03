import * as fs from 'fs';
export default class Logger {
    constructor() {
        this.interactionLogs = [];
        this.experimentMetadata = null;
    }
    // 古いメソッドは不要になるため削除またはコメントアウト
    // public logInteractionToFile(...) { ... }
    /**
     * 情報ログを出力（コンソール + ファイル出力対応）
     */
    logInfo(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[INFO ${timestamp}] ${message}`;
        console.log(logMessage);
        // TODO: ファイル出力機能を後で実装
        // this.writeLogToFile(logMessage);
    }
    /**
     * エラーログを出力
     */
    logError(message, error) {
        const timestamp = new Date().toISOString();
        const logMessage = `[ERROR ${timestamp}] ${message}`;
        if (error) {
            console.error(logMessage, error);
        }
        else {
            console.error(logMessage);
        }
        // TODO: ファイル出力機能を後で実装
    }
    /**
     * 警告ログを出力
     */
    logWarning(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[WARN ${timestamp}] ${message}`;
        console.warn(logMessage);
        // TODO: ファイル出力機能を後で実装
    }
    /**
     * インタラクションログを追加
     */
    addInteractionLog(turn, timestamp, llmRequest, llmResponse, systemAction) {
        this.interactionLogs.push({
            turn,
            timestamp,
            llm_request: llmRequest,
            llm_response: llmResponse,
            system_action: systemAction
        });
    }
    /**
     * 実験メタデータをセット
     */
    setExperimentMetadata(experimentId, startTime, endTime, status, totalTurns, promptTokens, completionTokens) {
        this.experimentMetadata = {
            experiment_id: experimentId,
            start_time: startTime,
            end_time: endTime,
            status,
            total_turns: totalTurns,
            total_tokens: {
                promptTokens,
                completionTokens,
                total: promptTokens + completionTokens
            }
        };
    }
    /**
     * 全てのログデータを結合して最終的なJSONオブジェクトとして取得
     */
    getFinalJSON() {
        if (!this.experimentMetadata)
            return null;
        return {
            experiment_metadata: this.experimentMetadata,
            interaction_log: this.interactionLogs
        };
    }
    /**
     * インタラクションログを取得
     */
    getInteractionLog() {
        return this.interactionLogs;
    }
    // =============================================================================
    // Phase 3-3: 詳細エラーログとパフォーマンス監視機能
    // =============================================================================
    /**
     * diff適用エラーの詳細ログ
     */
    logDiffApplicationError(error, diffContent, targetFiles, errorContext) {
        const timestamp = new Date().toISOString();
        const errorDetails = {
            type: 'DIFF_APPLICATION_ERROR',
            timestamp,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            diffMetadata: {
                diffSize: diffContent.length,
                diffPreview: diffContent.substring(0, 200) + (diffContent.length > 200 ? '...' : ''),
                affectedFiles: targetFiles,
                lineCount: diffContent.split('\n').length
            },
            context: errorContext,
            systemState: this.captureSystemState()
        };
        const logMessage = `[DIFF_ERROR ${timestamp}] ${error.message}`;
        console.error(logMessage, errorDetails);
        // ファイル出力用の詳細ログも保存
        this.writeDetailedLogToFile('diff_errors', errorDetails);
    }
    /**
     * LLM応答解析エラーの詳細ログ
     */
    logLLMParsingError(rawResponse, parsingStage, expectedFormat, actualFormat, error) {
        const timestamp = new Date().toISOString();
        const errorDetails = {
            type: 'LLM_PARSING_ERROR',
            timestamp,
            parsingStage,
            responseMetadata: {
                length: rawResponse.length,
                preview: rawResponse.substring(0, 300) + (rawResponse.length > 300 ? '...' : ''),
                hasValidTags: this.analyzeResponseTags(rawResponse),
                lineCount: rawResponse.split('\n').length
            },
            formatValidation: {
                expected: expectedFormat,
                actual: actualFormat,
                similarity: this.calculateStringSimilarity(expectedFormat, actualFormat)
            },
            error: error ? {
                message: error.message,
                stack: error.stack
            } : null,
            suggestions: this.generateParsingSuggestions(rawResponse, expectedFormat)
        };
        const logMessage = `[PARSING_ERROR ${timestamp}] Failed at stage: ${parsingStage}`;
        console.error(logMessage, errorDetails);
        this.writeDetailedLogToFile('parsing_errors', errorDetails);
    }
    /**
     * ファイル操作エラーの詳細ログ
     */
    logFileOperationError(operation, filePath, error, fileContext) {
        const timestamp = new Date().toISOString();
        const errorDetails = {
            type: 'FILE_OPERATION_ERROR',
            timestamp,
            operation,
            fileInfo: {
                path: filePath,
                relativePath: this.getRelativePath(filePath),
                exists: this.checkFileExists(filePath),
                size: this.getFileSize(filePath),
                permissions: this.checkFilePermissions(filePath)
            },
            error: {
                message: error.message,
                code: error.code || 'UNKNOWN',
                errno: error.errno || null,
                stack: error.stack
            },
            context: fileContext,
            recoveryOptions: this.generateFileErrorRecoveryOptions(error, operation)
        };
        const logMessage = `[FILE_ERROR ${timestamp}] ${operation} failed for ${this.getRelativePath(filePath)}: ${error.message}`;
        console.error(logMessage, errorDetails);
        this.writeDetailedLogToFile('file_errors', errorDetails);
    }
    /**
     * パフォーマンス測定の開始
     */
    startPerformanceTimer(operationName) {
        const timerId = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = process.hrtime.bigint();
        if (!this.performanceTimers) {
            this.performanceTimers = new Map();
        }
        this.performanceTimers.set(timerId, {
            operationName,
            startTime,
            memoryStart: process.memoryUsage()
        });
        this.logInfo(`⏱️ Performance timer started: ${operationName} [${timerId}]`);
        return timerId;
    }
    /**
     * パフォーマンス測定の終了とログ記録
     */
    endPerformanceTimer(timerId) {
        if (!this.performanceTimers || !this.performanceTimers.has(timerId)) {
            this.logWarning(`Performance timer not found: ${timerId}`);
            return;
        }
        const timerData = this.performanceTimers.get(timerId);
        const endTime = process.hrtime.bigint();
        const memoryEnd = process.memoryUsage();
        const duration = Number(endTime - timerData.startTime) / 1000000; // Convert to milliseconds
        const performanceLog = {
            operationName: timerData.operationName,
            timerId,
            duration: {
                milliseconds: duration,
                seconds: duration / 1000
            },
            memory: {
                start: timerData.memoryStart,
                end: memoryEnd,
                delta: {
                    rss: memoryEnd.rss - timerData.memoryStart.rss,
                    heapUsed: memoryEnd.heapUsed - timerData.memoryStart.heapUsed,
                    heapTotal: memoryEnd.heapTotal - timerData.memoryStart.heapTotal
                }
            },
            timestamp: new Date().toISOString()
        };
        this.logInfo(`⏱️ Performance: ${timerData.operationName} completed in ${duration.toFixed(2)}ms`);
        this.writeDetailedLogToFile('performance', performanceLog);
        this.performanceTimers.delete(timerId);
    }
    captureSystemState() {
        return {
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            platform: process.platform,
            nodeVersion: process.version,
            timestamp: new Date().toISOString()
        };
    }
    analyzeResponseTags(response) {
        const tags = ['%_Thought_%', '%_Plan_%', '%_Reply Required_%', '%_Modified_%', '%%_Fin_%%'];
        const found = tags.map(tag => ({
            tag,
            found: response.includes(tag),
            count: (response.match(new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        }));
        return {
            validTags: found.filter(t => t.found),
            invalidTags: found.filter(t => !t.found),
            totalTags: found.filter(t => t.found).length
        };
    }
    calculateStringSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0)
            return 1.0;
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }
    levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[str2.length][str1.length];
    }
    generateParsingSuggestions(response, expectedFormat) {
        const suggestions = [];
        if (!response.includes('%_')) {
            suggestions.push('Response does not contain any tag markers (%)');
        }
        if (response.includes('%_Thought_%') && !response.includes('%_Plan_%')) {
            suggestions.push('Missing %_Plan_% section after %_Thought_%');
        }
        if (response.length < 50) {
            suggestions.push('Response seems too short for a valid LLM response');
        }
        return suggestions;
    }
    getRelativePath(filePath) {
        // TODO: プロジェクトルートからの相対パスを計算
        return filePath.replace('/app/', '');
    }
    checkFileExists(filePath) {
        try {
            return fs.existsSync(filePath);
        }
        catch {
            return false;
        }
    }
    getFileSize(filePath) {
        try {
            return fs.statSync(filePath).size;
        }
        catch {
            return null;
        }
    }
    checkFilePermissions(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return {
                readable: true, // ファイルが存在すれば読めると仮定
                writable: true,
                executable: (stats.mode & parseInt('111', 8)) !== 0
            };
        }
        catch {
            return { readable: false, writable: false, executable: false };
        }
    }
    generateFileErrorRecoveryOptions(error, operation) {
        const options = [];
        const errorCode = error.code;
        switch (errorCode) {
            case 'ENOENT':
                options.push('Check if the file path is correct');
                options.push('Verify that the file has not been deleted or moved');
                break;
            case 'EACCES':
                options.push('Check file permissions');
                options.push('Run with appropriate user privileges');
                break;
            case 'EISDIR':
                options.push('Path points to a directory, not a file');
                break;
            default:
                options.push(`Investigate ${errorCode} error code`);
        }
        return options;
    }
    writeDetailedLogToFile(category, logData) {
        try {
            // ログディレクトリを作成
            const logDir = `/app/logs/${category}`;
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            // タイムスタンプ付きのファイル名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const logFile = `${logDir}/${timestamp}.json`;
            // ファイルに詳細ログを書き込み
            fs.writeFileSync(logFile, JSON.stringify(logData, null, 2), 'utf-8');
            // コンソールにも簡易版を出力
            console.log(`[DETAILED_LOG_${category.toUpperCase()}] Logged to: ${logFile}`);
        }
        catch (error) {
            // ファイル書き込みに失敗した場合はコンソールのみに出力
            console.log(`[DETAILED_LOG_${category.toUpperCase()}]`, JSON.stringify(logData, null, 2));
            console.error('Failed to write log to file:', error);
        }
    }
    /**
     * 統計情報の自動レポート生成
     */
    generateDetailedReport() {
        const metadata = this.experimentMetadata;
        const interactions = this.interactionLogs;
        if (!metadata) {
            return { error: 'No experiment metadata available' };
        }
        // エラー統計の計算
        const errorStats = this.calculateErrorStatistics(interactions);
        // パフォーマンス統計の計算  
        const performanceStats = this.calculatePerformanceStatistics(interactions);
        // 成功率の計算
        const successRate = this.calculateSuccessRate(interactions);
        return {
            summary: {
                experimentId: metadata.experiment_id,
                totalTurns: metadata.total_turns,
                totalTokens: metadata.total_tokens,
                duration: this.calculateDuration(metadata.start_time, metadata.end_time),
                status: metadata.status,
                successRate
            },
            errorAnalysis: errorStats,
            performanceAnalysis: performanceStats,
            recommendations: this.generateRecommendations(errorStats, performanceStats, successRate),
            generatedAt: new Date().toISOString()
        };
    }
    calculateErrorStatistics(interactions) {
        const errorsByType = {};
        const errorsByPhase = {};
        let totalErrors = 0;
        let recoveredErrors = 0;
        for (const interaction of interactions) {
            // システムアクションからエラーを検出
            if (interaction.system_action.type.includes('ERROR') ||
                interaction.system_action.details.toLowerCase().includes('error')) {
                totalErrors++;
                // エラータイプの分類
                if (interaction.system_action.type.includes('DIFF')) {
                    errorsByType['diff_application'] = (errorsByType['diff_application'] || 0) + 1;
                }
                else if (interaction.system_action.type.includes('PARSING')) {
                    errorsByType['response_parsing'] = (errorsByType['response_parsing'] || 0) + 1;
                }
                else if (interaction.system_action.type.includes('FILE')) {
                    errorsByType['file_operation'] = (errorsByType['file_operation'] || 0) + 1;
                }
                else {
                    errorsByType['other'] = (errorsByType['other'] || 0) + 1;
                }
                // フェーズ別の分類
                const turn = interaction.turn;
                if (turn <= 3) {
                    errorsByPhase['initial'] = (errorsByPhase['initial'] || 0) + 1;
                }
                else if (turn <= 10) {
                    errorsByPhase['middle'] = (errorsByPhase['middle'] || 0) + 1;
                }
                else {
                    errorsByPhase['late'] = (errorsByPhase['late'] || 0) + 1;
                }
            }
            // 次のターンで回復したかチェック（簡易版）
            if (totalErrors > recoveredErrors &&
                !interaction.system_action.details.toLowerCase().includes('error')) {
                recoveredErrors++;
            }
        }
        return {
            totalErrors,
            errorsByType,
            errorsByPhase,
            recoveryRate: totalErrors > 0 ? (recoveredErrors / totalErrors) * 100 : 100
        };
    }
    calculatePerformanceStatistics(interactions) {
        if (interactions.length === 0) {
            return {
                averageResponseTime: 0,
                tokenUsageEfficiency: 0,
                memoryUsage: {},
                turnDistribution: {}
            };
        }
        let totalTokens = 0;
        let totalResponseTime = 0;
        const turnDistribution = {};
        for (const interaction of interactions) {
            // トークン使用量の集計
            totalTokens += interaction.llm_response.usage.total;
            // レスポンス時間の推定（これは実際のタイムスタンプから計算すべき）
            // 現在は仮の値として処理
            totalResponseTime += 2000; // 2秒と仮定
            // ターン数の分布
            const turnRange = Math.floor(interaction.turn / 5) * 5; // 5ターンごとに分類
            const key = `${turnRange}-${turnRange + 4}`;
            turnDistribution[key] = (turnDistribution[key] || 0) + 1;
        }
        // 効率性の計算（トークン数に対するタスク完了率）
        const lastInteraction = interactions[interactions.length - 1];
        const hasFinTag = lastInteraction?.llm_response?.parsed_content?.has_fin_tag || false;
        const efficiency = hasFinTag ? (100 / totalTokens) * 1000 : 0; // 1000トークンあたりのスコア
        return {
            averageResponseTime: totalResponseTime / interactions.length,
            tokenUsageEfficiency: efficiency,
            memoryUsage: {
                estimatedPeakUsage: totalTokens * 0.004, // 1トークン ≈ 4バイトと仮定
                totalTokensProcessed: totalTokens
            },
            turnDistribution
        };
    }
    calculateSuccessRate(interactions) {
        if (interactions.length === 0)
            return 0;
        // 最後のインタラクションがFin_tagを持っているかチェック
        const lastInteraction = interactions[interactions.length - 1];
        return lastInteraction?.llm_response?.parsed_content?.has_fin_tag ? 100 : 0;
    }
    calculateDuration(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const durationMs = end.getTime() - start.getTime();
        return {
            milliseconds: durationMs,
            seconds: durationMs / 1000,
            minutes: durationMs / (1000 * 60)
        };
    }
    generateRecommendations(errorStats, performanceStats, successRate) {
        const recommendations = [];
        // 成功率に基づく推奨事項
        if (successRate < 100) {
            recommendations.push('Consider improving error handling and recovery mechanisms');
            if (successRate < 50) {
                recommendations.push('Review diff generation prompts for better accuracy');
            }
        }
        // エラー統計に基づく推奨事項
        if (errorStats.totalErrors > 0) {
            recommendations.push('Analyze error patterns to improve diff generation quality');
            if (errorStats.errorsByType.diff_application > 0) {
                recommendations.push('Improve diff format validation before application');
            }
            if (errorStats.errorsByType.response_parsing > 0) {
                recommendations.push('Enhance LLM response format constraints in prompts');
            }
            if (errorStats.errorsByType.file_operation > 0) {
                recommendations.push('Review file permission and path handling');
            }
            if (errorStats.recoveryRate < 70) {
                recommendations.push('Implement better error recovery strategies');
            }
        }
        // パフォーマンス統計に基づく推奨事項
        if (performanceStats.averageResponseTime > 5000) { // 5秒以上
            recommendations.push('Optimize prompts to reduce response time');
        }
        if (performanceStats.tokenUsageEfficiency < 0.1) {
            recommendations.push('Review prompt efficiency to reduce token usage');
        }
        // 一般的な推奨事項
        if (recommendations.length === 0) {
            recommendations.push('System is operating within expected parameters');
            recommendations.push('Consider running integration tests for comprehensive validation');
        }
        return recommendations;
    }
}
//# sourceMappingURL=logger.js.map