/**
 * エージェント状態管理オーケストレーションController
 * FSMベースの状態遷移を管理し、LLM処理フローを制御
 * 
 * 注意: プロンプトがまだ対応していないため、実際の処理には未使用
 * 将来のプロンプト対応時に有効化予定
 */

import { AgentStateService, AgentStateServiceConfig, LLMResponseValidation } from '../Service/AgentStateService.js';
import { AgentStateRepository } from '../Repository/AgentStateRepository.js';
import { AgentState } from '../types/AgentState.js';

/**
 * FSMオーケストレーションControllerの設定
 */
export interface FSMOrchestrationConfig extends AgentStateServiceConfig {
  /** 最大再試行回数（不正なタグ検出時） */
  maxRetryAttempts?: number;
  
  /** タイムアウト時間（ミリ秒） */
  timeoutMs?: number;
  
  /** 状態遷移時のコールバック */
  onStateChange?: (fromState: AgentState, toState: AgentState) => void;
  
  /** タグ検証失敗時のコールバック */
  onValidationFailure?: (validation: LLMResponseValidation) => void;
}

/**
 * LLM処理結果
 */
export interface LLMProcessingResult {
  /** 処理が成功したか */
  success: boolean;
  
  /** LLMレスポンステキスト */
  responseText?: string;
  
  /** 検証結果 */
  validation?: LLMResponseValidation;
  
  /** 最終的な状態 */
  finalState: AgentState;
  
  /** 再試行回数 */
  retryCount: number;
  
  /** エラー情報 */
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

/**
 * FSMオーケストレーションController
 * 状態遷移とLLM処理の統合管理を担当
 */
export class FSMOrchestrationController {
  private repository: AgentStateRepository;
  private config: FSMOrchestrationConfig;
  private activeServices: Map<string, AgentStateService>;

  constructor(config: FSMOrchestrationConfig = {}) {
    this.repository = new AgentStateRepository();
    this.config = {
      autoSave: true,
      enableTagValidation: true,
      autoRetryOnInvalidTags: true,
      debug: false,
      maxRetryAttempts: 3,
      timeoutMs: 600000, // 10分
      ...config
    };
    this.activeServices = new Map();
  }

  /**
   * エージェント状態管理サービスを取得または作成
   * @param agentId エージェントID（例: リポジトリ名_PR番号）
   */
  async getOrCreateService(agentId: string): Promise<AgentStateService> {
    if (this.activeServices.has(agentId)) {
      return this.activeServices.get(agentId)!;
    }

    const service = new AgentStateService(agentId, this.repository, this.config);
    await service.initialize();
    this.activeServices.set(agentId, service);

    return service;
  }

  /**
   * LLMレスポンスを処理（FSMベース）
   * @param agentId エージェントID
   * @param responseText LLMレスポンステキスト
   * @returns 処理結果
   */
  async processLLMResponse(
    agentId: string,
    responseText: string
  ): Promise<LLMProcessingResult> {
    const service = await this.getOrCreateService(agentId);
    const currentState = service.getCurrentState();
    
    try {
      // レスポンスを検証
      const validation = service.validateLLMResponse(responseText);

      if (this.config.debug) {
        console.log(`[FSMOrchestration] Processing response for ${agentId}`);
        console.log(`  Current state: ${currentState}`);
        console.log(`  Validation:`, validation);
      }

      // 検証が失敗した場合
      if (!validation.valid) {
        if (this.config.onValidationFailure) {
          this.config.onValidationFailure(validation);
        }

        return {
          success: false,
          responseText,
          validation,
          finalState: currentState,
          retryCount: 0,
          error: {
            message: 'Invalid tags detected in LLM response',
            code: 'INVALID_TAGS',
            details: {
              detectedTags: validation.detectedTags,
              allowedTags: validation.allowedTags,
              invalidTags: validation.invalidTags
            }
          }
        };
      }

      // 検証成功 - 推奨される次の状態に遷移
      if (validation.suggestedNextState) {
        await service.transition(
          validation.suggestedNextState,
          'llm_response_processed',
          { validation }
        );

        if (this.config.onStateChange) {
          this.config.onStateChange(currentState, validation.suggestedNextState);
        }
      }

      return {
        success: true,
        responseText,
        validation,
        finalState: service.getCurrentState(),
        retryCount: 0
      };

    } catch (error: any) {
      await service.transitionToError({
        message: error.message,
        code: 'PROCESSING_ERROR',
        details: error
      });

      return {
        success: false,
        finalState: AgentState.ERROR,
        retryCount: 0,
        error: {
          message: error.message,
          code: 'PROCESSING_ERROR',
          details: error
        }
      };
    }
  }

  /**
   * リトライ付きLLM処理
   * @param agentId エージェントID
   * @param llmRequestFn LLMリクエスト関数
   * @returns 処理結果
   */
  async processWithRetry(
    agentId: string,
    llmRequestFn: () => Promise<string>
  ): Promise<LLMProcessingResult> {
    const maxRetries = this.config.maxRetryAttempts || 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const responseText = await llmRequestFn();
        const result = await this.processLLMResponse(agentId, responseText);

        // 成功した場合は結果を返す
        if (result.success) {
          result.retryCount = retryCount;
          return result;
        }

        // 再生成が必要な場合はリトライ
        if (result.validation?.requiresRegeneration) {
          retryCount++;
          
          if (this.config.debug) {
            console.log(`[FSMOrchestration] Retry ${retryCount}/${maxRetries} for ${agentId}`);
          }
          
          continue;
        }

        // 再生成不要なエラーの場合は即座に返す
        result.retryCount = retryCount;
        return result;

      } catch (error: any) {
        retryCount++;
        
        if (retryCount >= maxRetries) {
          const service = await this.getOrCreateService(agentId);
          await service.transitionToError({
            message: error.message,
            code: 'MAX_RETRIES_EXCEEDED',
            details: { retryCount, error }
          });

          return {
            success: false,
            finalState: AgentState.ERROR,
            retryCount,
            error: {
              message: `Max retries (${maxRetries}) exceeded`,
              code: 'MAX_RETRIES_EXCEEDED',
              details: error
            }
          };
        }
      }
    }

    // 理論上ここには到達しない
    return {
      success: false,
      finalState: AgentState.ERROR,
      retryCount: maxRetries,
      error: {
        message: 'Unexpected error in retry loop',
        code: 'UNEXPECTED_ERROR'
      }
    };
  }

  /**
   * エージェントの状態を取得
   * @param agentId エージェントID
   */
  async getAgentState(agentId: string): Promise<AgentState | null> {
    const context = await this.repository.load(agentId);
    return context ? context.currentState : null;
  }

  /**
   * エージェントを手動で遷移
   * @param agentId エージェントID
   * @param toState 遷移先の状態
   * @param trigger トリガー
   */
  async transitionAgent(
    agentId: string,
    toState: AgentState,
    trigger: string = 'manual'
  ): Promise<void> {
    const service = await this.getOrCreateService(agentId);
    const fromState = service.getCurrentState();
    
    await service.transition(toState, trigger);

    if (this.config.onStateChange) {
      this.config.onStateChange(fromState, toState);
    }
  }

  /**
   * エージェントをリセット
   * @param agentId エージェントID
   */
  async resetAgent(agentId: string): Promise<void> {
    const service = await this.getOrCreateService(agentId);
    await service.reset();
  }

  /**
   * エージェントを削除
   * @param agentId エージェントID
   */
  async removeAgent(agentId: string): Promise<void> {
    this.activeServices.delete(agentId);
    await this.repository.delete(agentId);
  }

  /**
   * 全エージェントの統計情報を取得
   */
  async getStatistics() {
    return await this.repository.getStatistics();
  }

  /**
   * エラー状態のエージェントを取得
   */
  async getErrorAgents() {
    return await this.repository.findByState(AgentState.ERROR);
  }

  /**
   * 古い状態をクリーンアップ
   * @param olderThanHours 指定時間より古い状態を削除
   */
  async cleanup(olderThanHours: number = 24): Promise<number> {
    const olderThanMs = olderThanHours * 60 * 60 * 1000;
    const deletedCount = await this.repository.cleanup(olderThanMs);

    // activeServicesからも削除
    const allAgentIds = await this.repository.getAllAgentIds();
    const validIds = new Set(allAgentIds);
    
    for (const [agentId] of this.activeServices) {
      if (!validIds.has(agentId)) {
        this.activeServices.delete(agentId);
      }
    }

    return deletedCount;
  }

  /**
   * デバッグ情報を取得
   * @param agentId エージェントID
   */
  async getDebugInfo(agentId: string): Promise<string | null> {
    const service = this.activeServices.get(agentId);
    return service ? service.getDebugInfo() : null;
  }
}
