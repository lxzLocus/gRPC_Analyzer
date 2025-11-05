import * as fs from 'fs';

// --- 型定義を要求されたJSON形式に合わせて拡張 ---

type LLMRequestLog = {
  prompt_template: string;
  full_prompt_content: string;
  llm_metadata?: {
    provider: string;
    request_timestamp: string;
  };
};

type ParsedContentLog = {
  thought: string | null;
  plan: any[] | null;
  reply_required: Array<{ type: string; path: string }>;
  modified_diff: string | null;
  commentText: string | null;
  has_fin_tag: boolean;
};

type LLMResponseLog = {
  raw_content: string;
  parsed_content: ParsedContentLog;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total: number;
  };
  llm_metadata?: {
    provider: string;
    model: string;
    response_timestamp: string;
    request_timestamp: string;
  };
};

type SystemActionLog = {
  type: string;
  details: string;
};

type InteractionLogEntry = {
  turn: number;
  timestamp: string;
  llm_request: LLMRequestLog;
  llm_response: LLMResponseLog;
  system_action: SystemActionLog;
};

type ExperimentMetadataType = {
  experiment_id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_turns: number;
  total_tokens: {
    promptTokens: number;
    completionTokens: number;
    total: number;
  };
  llm_provider: string;
  llm_model: string;
  llm_config?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    [key: string]: any;
  };
};

export default class Logger {
  private interactionLogs: InteractionLogEntry[] = [];
  private experimentMetadata: ExperimentMetadataType | null = null;

  /**
   * 情報ログを出力（コンソール + ファイル出力対応）
   */
  public logInfo(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[INFO ${timestamp}] ${message}`;
    console.log(logMessage);
  }

  /**
   * エラーログを出力
   */
  public logError(message: string, error?: Error): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[ERROR ${timestamp}] ${message}`;
    if (error) {
      console.error(logMessage, error);
    } else {
      console.error(logMessage);
    }
  }

  /**
   * 警告ログを出力
   */
  public logWarning(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[WARN ${timestamp}] ${message}`;
    console.warn(logMessage);
  }

  /**
   * インタラクションログを追加
   */
  addInteractionLog(
    turn: number,
    timestamp: string,
    llmRequest: LLMRequestLog,
    llmResponse: LLMResponseLog,
    systemAction: SystemActionLog
  ): void {
    this.interactionLogs.push({
      turn,
      timestamp,
      llm_request: llmRequest,
      llm_response: llmResponse,
      system_action: systemAction
    });
  }

  /**
   * 実験メタデータを設定
   */
  setExperimentMetadata(
    experimentId: string,
    startTime: string,
    endTime: string,
    status: string,
    totalTurns: number,
    promptTokens: number,
    completionTokens: number,
    llmProvider: string,
    llmModel: string,
    llmConfig?: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      [key: string]: any;
    }
  ): void {
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
      },
      llm_provider: llmProvider,
      llm_model: llmModel,
      ...(llmConfig && { llm_config: llmConfig })
    };
  }

  /**
   * 全てのログデータを結合して最終的なJSONオブジェクトとして取得
   */
  public getFinalJSON(): object | null {
    if (!this.experimentMetadata) return null;

    return {
      experiment_metadata: this.experimentMetadata,
      interaction_log: this.interactionLogs
    };
  }

  /**
   * インタラクションログを取得
   */
  public getInteractionLog(): InteractionLogEntry[] {
    return this.interactionLogs;
  }

  // =============================================================================
  // 詳細エラーログとパフォーマンス監視機能
  // =============================================================================

  /**
   * diff適用エラーの詳細ログ
   */
  public logDiffApplicationError(
    error: Error,
    diffContent: string,
    targetFiles: string[],
    errorContext: any
  ): void {
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
  public logLLMParsingError(
    rawResponse: string,
    parsingStage: string,
    expectedFormat: string,
    actualFormat: string,
    error?: Error
  ): void {
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
  public logFileOperationError(
    operation: string,
    filePath: string,
    error: Error,
    fileContext?: any
  ): void {
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
        code: (error as any).code || 'UNKNOWN',
        errno: (error as any).errno || null,
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
  public startPerformanceTimer(operationName: string): string {
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
  public endPerformanceTimer(timerId: string): void {
    if (!this.performanceTimers || !this.performanceTimers.has(timerId)) {
      this.logWarning(`Performance timer not found: ${timerId}`);
      return;
    }

    const timerData = this.performanceTimers.get(timerId)!;
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

  // =============================================================================
  // プライベートヘルパーメソッド
  // =============================================================================

  private performanceTimers?: Map<string, any>;

  private writeDetailedLogToFile(category: string, logData: any): void {
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
    } catch (error) {
      // ファイル書き込みに失敗した場合はコンソールのみに出力
      console.log(`[DETAILED_LOG_${category.toUpperCase()}]`, JSON.stringify(logData, null, 2));
      console.error('Failed to write log to file:', error);
    }
  }

  private captureSystemState(): any {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      platform: process.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    };
  }

  private analyzeResponseTags(response: string): any {
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

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
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
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private generateParsingSuggestions(response: string, expectedFormat: string): string[] {
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

  private getRelativePath(filePath: string): string {
    return filePath.replace('/app/', '');
  }

  private checkFileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  private getFileSize(filePath: string): number | null {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return null;
    }
  }

  private checkFilePermissions(filePath: string): any {
    try {
      const stats = fs.statSync(filePath);
      return {
        readable: true,
        writable: true,
        executable: (stats.mode & parseInt('111', 8)) !== 0
      };
    } catch {
      return { readable: false, writable: false, executable: false };
    }
  }

  private generateFileErrorRecoveryOptions(error: Error, operation: string): string[] {
    const options = [];
    const errorCode = (error as any).code;
    
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
}
