import * as fs from 'fs';

// --- 型定義を要求されたJSON形式に合わせて拡張 ---

type LLMRequestLog = {
  prompt_template: string;
  full_prompt_content: string;
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
};

export default class Logger {
  private interactionLogs: InteractionLogEntry[] = [];
  private experimentMetadata: ExperimentMetadataType | null = null;

  // 古いメソッドは不要になるため削除またはコメントアウト
  // public logInteractionToFile(...) { ... }

  /**
   * 情報ログを出力（コンソール + ファイル出力対応）
   */
  public logInfo(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[INFO ${timestamp}] ${message}`;
    console.log(logMessage);
    
    // TODO: ファイル出力機能を後で実装
    // this.writeLogToFile(logMessage);
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
    
    // TODO: ファイル出力機能を後で実装
  }

  /**
   * 警告ログを出力
   */
  public logWarning(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[WARN ${timestamp}] ${message}`;
    console.warn(logMessage);
    
    // TODO: ファイル出力機能を後で実装
  }

  /**
   * インタラクションログを追加
   */
  public addInteractionLog(
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
   * 実験メタデータをセット
   */
  public setExperimentMetadata(
    experimentId: string,
    startTime: string,
    endTime: string,
    status: string,
    totalTurns: number,
    promptTokens: number,
    completionTokens: number
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
      }
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

  // 既存のgetInteractionLogJSONとgetExperimentMetadataJSONは内部的には使えるが、
  // getFinalJSONで一つにまとめるのが便利。
}