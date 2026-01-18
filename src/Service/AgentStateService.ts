import { AgentStateMachine, TagParser } from '../modules/AgentStateMachine.js';
import { AgentStateRepository } from '../Repository/AgentStateRepository.js';
import { AgentState } from '../types/AgentState.js';

/**
 * エージェント状態管理Serviceの設定
 */
export interface AgentStateServiceConfig {
  /** 自動状態保存を有効化 */
  autoSave?: boolean;
  
  /** タグ検証を有効化 */
  enableTagValidation?: boolean;
  
  /** 不正なタグ検出時に自動再生成をトリガー */
  autoRetryOnInvalidTags?: boolean;
  
  /** デバッグログを有効化 */
  debug?: boolean;
}

/**
 * LLMレスポンスの検証結果
 */
export interface LLMResponseValidation {
  /** 検証が成功したか */
  valid: boolean;
  
  /** 検出されたタグ */
  detectedTags: string[];
  
  /** 現在の状態で許可されているタグ */
  allowedTags: string[];
  
  /** 不正なタグ（許可されていないタグ） */
  invalidTags: string[];
  
  /** 推奨される次の状態 */
  suggestedNextState?: AgentState;
  
  /** 再生成が必要か */
  requiresRegeneration: boolean;
}

/**
 * エージェント状態管理Service
 * FSMの状態遷移ロジックとビジネスルールを管理
 * 
 * 統合状態: llmFlowControllerに統合済み（2026-01-02）
 * MainScript.js, SinglePRScript.js の両方で有効
 */
export class AgentStateService {
  private stateMachine: AgentStateMachine;
  private repository: AgentStateRepository;
  private config: AgentStateServiceConfig;
  private agentId: string;

  constructor(
    agentId: string,
    repository: AgentStateRepository,
    config: AgentStateServiceConfig = {}
  ) {
    this.agentId = agentId;
    this.repository = repository;
    this.config = {
      autoSave: true,
      enableTagValidation: true,
      autoRetryOnInvalidTags: true,
      debug: false,
      ...config
    };
    this.stateMachine = new AgentStateMachine();
  }

  /**
   * 既存の状態を読み込んで初期化
   */
  async initialize(): Promise<void> {
    const savedContext = await this.repository.load(this.agentId);
    
    if (savedContext) {
      // 保存された状態から復元
      this.stateMachine = new AgentStateMachine(savedContext.currentState);
      if (this.config.debug) {
        console.log(`[AgentStateService] Loaded state for ${this.agentId}:`, savedContext.currentState);
      }
    } else {
      // 新規エージェントとして初期化
      this.stateMachine = new AgentStateMachine(AgentState.ANALYSIS);
      if (this.config.autoSave) {
        await this.save();
      }
      if (this.config.debug) {
        console.log(`[AgentStateService] Initialized new state for ${this.agentId}`);
      }
    }
  }

  /**
   * 現在の状態を取得
   */
  getCurrentState(): AgentState {
    return this.stateMachine.getCurrentState();
  }

  /**
   * 状態を遷移
   * @param toState 遷移先の状態
   * @param trigger 遷移のトリガー
   * @param context 追加のコンテキスト
   */
  async transition(
    toState: AgentState,
    trigger: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      this.stateMachine.transition(toState, trigger, context);
      
      if (this.config.debug) {
        console.log(`[AgentStateService] Transitioned to ${toState} (trigger: ${trigger})`);
      }
      
      if (this.config.autoSave) {
        await this.save();
      }
    } catch (error) {
      console.error(`[AgentStateService] Transition failed:`, error);
      throw error;
    }
  }

  /**
   * ホストから情報が返された時の処理（AWAITING_INFO → ANALYSIS）
   * @param fileContents 返されたファイル内容
   */
  async onInfoReceived(fileContents: string): Promise<void> {
    const currentState = this.getCurrentState();
    
    if (currentState !== AgentState.AWAITING_INFO) {
      console.warn(`[AgentStateService] onInfoReceived called but current state is ${currentState}, not AWAITING_INFO`);
      return;
    }

    await this.transition(
      AgentState.ANALYSIS,
      'host_info_received',
      { fileContents }
    );

    if (this.config.debug) {
      console.log(`[AgentStateService] Info received, transitioned back to ANALYSIS`);
    }
  }

  /**
   * LLMレスポンスを検証
   * @param responseText LLMレスポンステキスト
   * @returns 検証結果
   */
  validateLLMResponse(responseText: string): LLMResponseValidation {
    const detectedTags = TagParser.detectTags(responseText);
    const validation = this.stateMachine.validateTags(detectedTags);
    
    const result: LLMResponseValidation = {
      valid: validation.isValid,
      detectedTags,
      allowedTags: validation.allowedTags,
      invalidTags: validation.invalidTags,
      requiresRegeneration: !validation.isValid && this.config.autoRetryOnInvalidTags === true
    };

    // 検出されたタグに基づいて推奨される次の状態を決定
    if (validation.isValid) {
      result.suggestedNextState = this.inferNextState(detectedTags);
    }

    if (this.config.debug) {
      console.log(`[AgentStateService] Validation result:`, result);
    }

    return result;
  }

  /**
   * 検出されたタグから次の状態を推測
   * @param tags 検出されたタグ
   * @returns 推奨される次の状態
   */
  private inferNextState(tags: string[]): AgentState | undefined {
    const currentState = this.stateMachine.getCurrentState();

    // タグの種類に基づいて次の状態を推測
    
    // %%_Fin_%%タグは廃止：LLMに終了判定させない
    if (tags.includes('%%_Fin_%%')) {
      console.warn(`⚠️  Deprecated Fin tag detected - FSM should handle completion automatically`);
      return undefined;
    }

    // %_No_Changes_Needed_%タグはANALYSIS状態からVERIFYINGへ
    if (tags.includes('%_No_Changes_Needed_%')) {
      if (currentState === AgentState.ANALYSIS) {
        console.log('✅ No changes needed, transitioning to VERIFYING for final check');
        return AgentState.VERIFYING;
      }
      console.warn(`⚠️  No_Changes_Needed tag detected in invalid state: ${currentState}`);
      return undefined;
    }

    // %_Ready_For_Final_Check_%タグは廃止：内部状態として扱う
    if (tags.includes('%_Ready_For_Final_Check_%')) {
      console.warn(`⚠️  Deprecated Ready_For_Final_Check tag detected`);
      return undefined;
    }

    if (tags.includes('%_Modified_%')) {
      return AgentState.VERIFYING;
    }

    if (tags.includes('%_Verification_Report_%')) {
      // 検証完了：FSMが自動的にFINISHEDへ遷移
      console.log('✅ Verification complete, FSM will transition to FINISHED');
      return AgentState.READY_TO_FINISH; // 内部的にREADY_TO_FINISHを経由してFINISHEDへ
    }

    // %_Reply Required_%タグの検出
    if (tags.includes('%_Reply Required_%')) {
      // ANALYSIS状態からAWAITING_INFOへ
      if (currentState === AgentState.ANALYSIS) {
        return AgentState.AWAITING_INFO;
      }
      // MODIFYING状態からAWAITING_INFOへ
      if (currentState === AgentState.MODIFYING) {
        return AgentState.AWAITING_INFO;
      }
    }

    if (tags.includes('%_Plan_%')) {
      // ANALYSIS状態でPlan完了時はMODIFYINGへ
      if (currentState === AgentState.ANALYSIS) {
        return AgentState.MODIFYING;
      }
      return AgentState.AWAITING_INFO;
    }

    return undefined;
  }

  /**
   * エラー状態に遷移
   * @param error エラー情報
   */
  async transitionToError(error: { message: string; code: string; details?: any }): Promise<void> {
    await this.transition(AgentState.ERROR, 'error_occurred', { error });
  }

  /**
   * 現在の状態をリポジトリに保存
   */
  async save(): Promise<void> {
    const context = this.stateMachine.getContext();
    await this.repository.save(this.agentId, context);
  }

  /**
   * エージェントが終了状態かチェック
   */
  isFinished(): boolean {
    return this.stateMachine.isFinished();
  }

  /**
   * エージェントがエラー状態かチェック
   */
  isError(): boolean {
    return this.stateMachine.isError();
  }

  /**
   * 遷移履歴を取得
   */
  getTransitionHistory() {
    return this.stateMachine.getTransitionHistory();
  }

  /**
   * 状態をリセット
   */
  async reset(): Promise<void> {
    this.stateMachine.reset();
    if (this.config.autoSave) {
      await this.save();
    }
  }

  /**
   * デバッグ情報を取得
   */
  getDebugInfo(): string {
    return this.stateMachine.toString();
  }
}

/**
 * エージェント状態管理の統計Serviceインターフェース
 */
export class AgentStateStatisticsService {
  private repository: AgentStateRepository;

  constructor(repository: AgentStateRepository) {
    this.repository = repository;
  }

  /**
   * 全体の統計情報を取得
   */
  async getOverallStatistics() {
    const stats = await this.repository.getStatistics();
    const total = await this.repository.count();

    return {
      total,
      byState: stats,
      percentages: Object.entries(stats).reduce((acc, [state, count]) => {
        acc[state as AgentState] = total > 0 ? (count / total) * 100 : 0;
        return acc;
      }, {} as Record<AgentState, number>)
    };
  }

  /**
   * エラー状態のエージェントを取得
   */
  async getErrorAgents() {
    return await this.repository.findByState(AgentState.ERROR);
  }

  /**
   * 完了したエージェントを取得
   */
  async getFinishedAgents() {
    return await this.repository.findByState(AgentState.FINISHED);
  }

  /**
   * 古い状態をクリーンアップ
   * @param olderThanHours 指定時間より古い状態を削除
   */
  async cleanupOldStates(olderThanHours: number = 24): Promise<number> {
    const olderThanMs = olderThanHours * 60 * 60 * 1000;
    return await this.repository.cleanup(olderThanMs);
  }
}
