"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var Logger = /** @class */ (function () {
    function Logger() {
        this.interactionLogs = [];
        this.experimentMetadata = null;
    }
    // 古いメソッドは不要になるため削除またはコメントアウト
    // public logInteractionToFile(...) { ... }
    /**
     * 情報ログを出力（コンソール + ファイル出力対応）
     */
    Logger.prototype.logInfo = function (message) {
        var timestamp = new Date().toISOString();
        var logMessage = "[INFO ".concat(timestamp, "] ").concat(message);
        console.log(logMessage);
        // TODO: ファイル出力機能を後で実装
        // this.writeLogToFile(logMessage);
    };
    /**
     * エラーログを出力
     */
    Logger.prototype.logError = function (message, error) {
        var timestamp = new Date().toISOString();
        var logMessage = "[ERROR ".concat(timestamp, "] ").concat(message);
        if (error) {
            console.error(logMessage, error);
        }
        else {
            console.error(logMessage);
        }
        // TODO: ファイル出力機能を後で実装
    };
    /**
     * 警告ログを出力
     */
    Logger.prototype.logWarning = function (message) {
        var timestamp = new Date().toISOString();
        var logMessage = "[WARN ".concat(timestamp, "] ").concat(message);
        console.warn(logMessage);
        // TODO: ファイル出力機能を後で実装
    };
    /**
     * インタラクションログを追加
     */
    Logger.prototype.addInteractionLog = function (turn, timestamp, llmRequest, llmResponse, systemAction) {
        this.interactionLogs.push({
            turn: turn,
            timestamp: timestamp,
            llm_request: llmRequest,
            llm_response: llmResponse,
            system_action: systemAction
        });
    };
    /**
     * 実験メタデータをセット
     */
    Logger.prototype.setExperimentMetadata = function (experimentId, startTime, endTime, status, totalTurns, promptTokens, completionTokens) {
        this.experimentMetadata = {
            experiment_id: experimentId,
            start_time: startTime,
            end_time: endTime,
            status: status,
            total_turns: totalTurns,
            total_tokens: {
                promptTokens: promptTokens,
                completionTokens: completionTokens,
                total: promptTokens + completionTokens
            }
        };
    };
    /**
     * 全てのログデータを結合して最終的なJSONオブジェクトとして取得
     */
    Logger.prototype.getFinalJSON = function () {
        if (!this.experimentMetadata)
            return null;
        return {
            experiment_metadata: this.experimentMetadata,
            interaction_log: this.interactionLogs
        };
    };
    /**
     * インタラクションログを取得
     */
    Logger.prototype.getInteractionLog = function () {
        return this.interactionLogs;
    };
    // =============================================================================
    // Phase 3-3: 詳細エラーログとパフォーマンス監視機能
    // =============================================================================
    /**
     * diff適用エラーの詳細ログ
     */
    Logger.prototype.logDiffApplicationError = function (error, diffContent, targetFiles, errorContext) {
        var timestamp = new Date().toISOString();
        var errorDetails = {
            type: 'DIFF_APPLICATION_ERROR',
            timestamp: timestamp,
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
        var logMessage = "[DIFF_ERROR ".concat(timestamp, "] ").concat(error.message);
        console.error(logMessage, errorDetails);
        // ファイル出力用の詳細ログも保存
        this.writeDetailedLogToFile('diff_errors', errorDetails);
    };
    /**
     * LLM応答解析エラーの詳細ログ
     */
    Logger.prototype.logLLMParsingError = function (rawResponse, parsingStage, expectedFormat, actualFormat, error) {
        var timestamp = new Date().toISOString();
        var errorDetails = {
            type: 'LLM_PARSING_ERROR',
            timestamp: timestamp,
            parsingStage: parsingStage,
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
        var logMessage = "[PARSING_ERROR ".concat(timestamp, "] Failed at stage: ").concat(parsingStage);
        console.error(logMessage, errorDetails);
        this.writeDetailedLogToFile('parsing_errors', errorDetails);
    };
    /**
     * ファイル操作エラーの詳細ログ
     */
    Logger.prototype.logFileOperationError = function (operation, filePath, error, fileContext) {
        var timestamp = new Date().toISOString();
        var errorDetails = {
            type: 'FILE_OPERATION_ERROR',
            timestamp: timestamp,
            operation: operation,
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
        var logMessage = "[FILE_ERROR ".concat(timestamp, "] ").concat(operation, " failed for ").concat(this.getRelativePath(filePath), ": ").concat(error.message);
        console.error(logMessage, errorDetails);
        this.writeDetailedLogToFile('file_errors', errorDetails);
    };
    /**
     * パフォーマンス測定の開始
     */
    Logger.prototype.startPerformanceTimer = function (operationName) {
        var timerId = "".concat(operationName, "_").concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
        var startTime = process.hrtime.bigint();
        if (!this.performanceTimers) {
            this.performanceTimers = new Map();
        }
        this.performanceTimers.set(timerId, {
            operationName: operationName,
            startTime: startTime,
            memoryStart: process.memoryUsage()
        });
        this.logInfo("\u23F1\uFE0F Performance timer started: ".concat(operationName, " [").concat(timerId, "]"));
        return timerId;
    };
    /**
     * パフォーマンス測定の終了とログ記録
     */
    Logger.prototype.endPerformanceTimer = function (timerId) {
        if (!this.performanceTimers || !this.performanceTimers.has(timerId)) {
            this.logWarning("Performance timer not found: ".concat(timerId));
            return;
        }
        var timerData = this.performanceTimers.get(timerId);
        var endTime = process.hrtime.bigint();
        var memoryEnd = process.memoryUsage();
        var duration = Number(endTime - timerData.startTime) / 1000000; // Convert to milliseconds
        var performanceLog = {
            operationName: timerData.operationName,
            timerId: timerId,
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
        this.logInfo("\u23F1\uFE0F Performance: ".concat(timerData.operationName, " completed in ").concat(duration.toFixed(2), "ms"));
        this.writeDetailedLogToFile('performance', performanceLog);
        this.performanceTimers.delete(timerId);
    };
    Logger.prototype.captureSystemState = function () {
        return {
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            platform: process.platform,
            nodeVersion: process.version,
            timestamp: new Date().toISOString()
        };
    };
    Logger.prototype.analyzeResponseTags = function (response) {
        var tags = ['%_Thought_%', '%_Plan_%', '%_Reply Required_%', '%_Modified_%', '%%_Fin_%%'];
        var found = tags.map(function (tag) { return ({
            tag: tag,
            found: response.includes(tag),
            count: (response.match(new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        }); });
        return {
            validTags: found.filter(function (t) { return t.found; }),
            invalidTags: found.filter(function (t) { return !t.found; }),
            totalTags: found.filter(function (t) { return t.found; }).length
        };
    };
    Logger.prototype.calculateStringSimilarity = function (str1, str2) {
        var longer = str1.length > str2.length ? str1 : str2;
        var shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0)
            return 1.0;
        var distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    };
    Logger.prototype.levenshteinDistance = function (str1, str2) {
        var matrix = [];
        for (var i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (var j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (var i = 1; i <= str2.length; i++) {
            for (var j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[str2.length][str1.length];
    };
    Logger.prototype.generateParsingSuggestions = function (response, expectedFormat) {
        var suggestions = [];
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
    };
    Logger.prototype.getRelativePath = function (filePath) {
        // TODO: プロジェクトルートからの相対パスを計算
        return filePath.replace('/app/', '');
    };
    Logger.prototype.checkFileExists = function (filePath) {
        try {
            return fs.existsSync(filePath);
        }
        catch (_a) {
            return false;
        }
    };
    Logger.prototype.getFileSize = function (filePath) {
        try {
            return fs.statSync(filePath).size;
        }
        catch (_a) {
            return null;
        }
    };
    Logger.prototype.checkFilePermissions = function (filePath) {
        try {
            var stats = fs.statSync(filePath);
            return {
                readable: true, // ファイルが存在すれば読めると仮定
                writable: true,
                executable: (stats.mode & parseInt('111', 8)) !== 0
            };
        }
        catch (_a) {
            return { readable: false, writable: false, executable: false };
        }
    };
    Logger.prototype.generateFileErrorRecoveryOptions = function (error, operation) {
        var options = [];
        var errorCode = error.code;
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
                options.push("Investigate ".concat(errorCode, " error code"));
        }
        return options;
    };
    Logger.prototype.writeDetailedLogToFile = function (category, logData) {
        try {
            // ログディレクトリを作成
            var logDir = "/app/logs/".concat(category);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            // タイムスタンプ付きのファイル名
            var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            var logFile = "".concat(logDir, "/").concat(timestamp, ".json");
            // ファイルに詳細ログを書き込み
            fs.writeFileSync(logFile, JSON.stringify(logData, null, 2), 'utf-8');
            // コンソールにも簡易版を出力
            console.log("[DETAILED_LOG_".concat(category.toUpperCase(), "] Logged to: ").concat(logFile));
        }
        catch (error) {
            // ファイル書き込みに失敗した場合はコンソールのみに出力
            console.log("[DETAILED_LOG_".concat(category.toUpperCase(), "]"), JSON.stringify(logData, null, 2));
            console.error('Failed to write log to file:', error);
        }
    };
    /**
     * 統計情報の自動レポート生成
     */
    Logger.prototype.generateDetailedReport = function () {
        var metadata = this.experimentMetadata;
        var interactions = this.interactionLogs;
        if (!metadata) {
            return { error: 'No experiment metadata available' };
        }
        // エラー統計の計算
        var errorStats = this.calculateErrorStatistics(interactions);
        // パフォーマンス統計の計算  
        var performanceStats = this.calculatePerformanceStatistics(interactions);
        // 成功率の計算
        var successRate = this.calculateSuccessRate(interactions);
        return {
            summary: {
                experimentId: metadata.experiment_id,
                totalTurns: metadata.total_turns,
                totalTokens: metadata.total_tokens,
                duration: this.calculateDuration(metadata.start_time, metadata.end_time),
                status: metadata.status,
                successRate: successRate
            },
            errorAnalysis: errorStats,
            performanceAnalysis: performanceStats,
            recommendations: this.generateRecommendations(errorStats, performanceStats, successRate),
            generatedAt: new Date().toISOString()
        };
    };
    Logger.prototype.calculateErrorStatistics = function (interactions) {
        var errorsByType = {};
        var errorsByPhase = {};
        var totalErrors = 0;
        var recoveredErrors = 0;
        for (var _i = 0, interactions_1 = interactions; _i < interactions_1.length; _i++) {
            var interaction = interactions_1[_i];
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
                var turn = interaction.turn;
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
            totalErrors: totalErrors,
            errorsByType: errorsByType,
            errorsByPhase: errorsByPhase,
            recoveryRate: totalErrors > 0 ? (recoveredErrors / totalErrors) * 100 : 100
        };
    };
    Logger.prototype.calculatePerformanceStatistics = function (interactions) {
        var _a, _b;
        if (interactions.length === 0) {
            return {
                averageResponseTime: 0,
                tokenUsageEfficiency: 0,
                memoryUsage: {},
                turnDistribution: {}
            };
        }
        var totalTokens = 0;
        var totalResponseTime = 0;
        var turnDistribution = {};
        for (var _i = 0, interactions_2 = interactions; _i < interactions_2.length; _i++) {
            var interaction = interactions_2[_i];
            // トークン使用量の集計
            totalTokens += interaction.llm_response.usage.total;
            // レスポンス時間の推定（これは実際のタイムスタンプから計算すべき）
            // 現在は仮の値として処理
            totalResponseTime += 2000; // 2秒と仮定
            // ターン数の分布
            var turnRange = Math.floor(interaction.turn / 5) * 5; // 5ターンごとに分類
            var key = "".concat(turnRange, "-").concat(turnRange + 4);
            turnDistribution[key] = (turnDistribution[key] || 0) + 1;
        }
        // 効率性の計算（トークン数に対するタスク完了率）
        var lastInteraction = interactions[interactions.length - 1];
        var hasFinTag = ((_b = (_a = lastInteraction === null || lastInteraction === void 0 ? void 0 : lastInteraction.llm_response) === null || _a === void 0 ? void 0 : _a.parsed_content) === null || _b === void 0 ? void 0 : _b.has_fin_tag) || false;
        var efficiency = hasFinTag ? (100 / totalTokens) * 1000 : 0; // 1000トークンあたりのスコア
        return {
            averageResponseTime: totalResponseTime / interactions.length,
            tokenUsageEfficiency: efficiency,
            memoryUsage: {
                estimatedPeakUsage: totalTokens * 0.004, // 1トークン ≈ 4バイトと仮定
                totalTokensProcessed: totalTokens
            },
            turnDistribution: turnDistribution
        };
    };
    Logger.prototype.calculateSuccessRate = function (interactions) {
        var _a, _b;
        if (interactions.length === 0)
            return 0;
        // 最後のインタラクションがFin_tagを持っているかチェック
        var lastInteraction = interactions[interactions.length - 1];
        return ((_b = (_a = lastInteraction === null || lastInteraction === void 0 ? void 0 : lastInteraction.llm_response) === null || _a === void 0 ? void 0 : _a.parsed_content) === null || _b === void 0 ? void 0 : _b.has_fin_tag) ? 100 : 0;
    };
    Logger.prototype.calculateDuration = function (startTime, endTime) {
        var start = new Date(startTime);
        var end = new Date(endTime);
        var durationMs = end.getTime() - start.getTime();
        return {
            milliseconds: durationMs,
            seconds: durationMs / 1000,
            minutes: durationMs / (1000 * 60)
        };
    };
    Logger.prototype.generateRecommendations = function (errorStats, performanceStats, successRate) {
        var recommendations = [];
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
    };
    return Logger;
}());
exports.default = Logger;
