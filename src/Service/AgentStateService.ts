import { AgentStateMachine, TagParser } from '../modules/AgentStateMachine.js';
import { AgentStateRepository } from '../Repository/AgentStateRepository.js';
import { AgentState, ALLOWED_TAGS_BY_STATE } from '../types/AgentState.js';

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
  
  /** 再生成が必要か（corrective retryを実行すべきか） */
  requiresRegeneration: boolean;
  
  /** No Progress状態（LLMが意味的に行き詰まり、リトライしても改善しない） */
  isNoProgress?: boolean;
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
  
  // No Progress 検出用
  private lastState: AgentState | null = null;
  private lastEffectiveTags: string[] = [];
  private noProgressCount: number = 0;

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
   * タグ正規化: 現在の状態で有効なタグのみを抽出
   * LLMが複数フェーズのタグを同時出力しても、現在の状態に適したもののみ採用
   * @param detectedTags 検出されたすべてのタグ
   * @returns 正規化されたタグと無視されたタグ
   */
  private normalizeTagsForState(detectedTags: string[]): { 
    effectiveTags: string[], 
    ignoredTags: string[] 
  } {
    const currentState = this.stateMachine.getCurrentState();
    const allowedTags = ALLOWED_TAGS_BY_STATE[currentState];
    
    const effectiveTags: string[] = [];
    const ignoredTags: string[] = [];
    
    // 状態ごとの優先度ルール
    const priorityRules: Record<AgentState, string[]> = {
      [AgentState.ANALYSIS]: [
        '%_Reply Required_%',      // 最優先：情報要求
        '%_No_Changes_Needed_%',   // 次：修正不要
        '%_Plan_%',                // 次：計画完了
        '%_Correction_Goals_%',    // 次：修正目標
        '%_Thought_%'              // 最低：思考中
        // '%_Modified_%' は ANALYSIS では無視（次フェーズのタグ）
      ],
      [AgentState.MODIFYING]: [
        '%_Modified_%',            // 最優先：修正完了
        '%_Reply Required_%'       // 次：追加情報要求
      ],
      [AgentState.VERIFYING]: [
        '%_Verification_Report_%', // 最優先：検証完了
        '%_Modified_%',            // 次：追加修正
        '%_Thought_%'              // 最低：検証思考中
      ],
      [AgentState.AWAITING_INFO]: [
        '%_Thought_%'              // 内部状態：即座にANALYSISへ戻る
      ],
      [AgentState.READY_TO_FINISH]: [],
      [AgentState.FINISHED]: [],
      [AgentState.ERROR]: []
    };
    
    const priorities = priorityRules[currentState] || [];
    
    // 優先度順にタグを処理
    for (const priorityTag of priorities) {
      if (detectedTags.includes(priorityTag) && allowedTags.includes(priorityTag)) {
        effectiveTags.push(priorityTag);
      }
    }
    
    // 残りの許可タグを追加（優先度リストにないが許可されているもの）
    for (const tag of detectedTags) {
      if (allowedTags.includes(tag) && !effectiveTags.includes(tag)) {
        effectiveTags.push(tag);
      }
    }
    
    // 無視されたタグ（許可されていないが、エラーにしない）
    for (const tag of detectedTags) {
      if (!effectiveTags.includes(tag)) {
        ignoredTags.push(tag);
      }
    }
    
    // 無視されたタグがあれば警告ログ
    if (ignoredTags.length > 0) {
      console.log(`⚠️  FSM: Ignoring out-of-phase tags in ${currentState}: [${ignoredTags.join(', ')}]`);
      console.log(`✅ FSM: Using effective tags: [${effectiveTags.join(', ')}]`);
    }
    
    return { effectiveTags, ignoredTags };
  }

  /**
   * LLMレスポンスを検証
   * @param responseText LLMレスポンステキスト
   * @param context 追加のコンテキスト（modifiedLines等）
   * @returns 検証結果
   */
  validateLLMResponse(responseText: string, context?: Record<string, any>): LLMResponseValidation {
    const detectedTags = TagParser.detectTags(responseText);
    const currentState = this.stateMachine.getCurrentState();
    
    // タグ正規化: 現在の状態で有効なタグのみを抽出
    const { effectiveTags, ignoredTags } = this.normalizeTagsForState(detectedTags);
    
    // 有効なタグのみで検証
    const validation = this.stateMachine.validateTags(effectiveTags);
    
    const result: LLMResponseValidation = {
      valid: validation.isValid,
      detectedTags: effectiveTags,  // 正規化されたタグのみを返す
      allowedTags: validation.allowedTags,
      invalidTags: validation.invalidTags,
      requiresRegeneration: !validation.isValid && this.config.autoRetryOnInvalidTags === true
    };

    // 検出されたタグに基づいて推奨される次の状態を決定
    if (validation.isValid) {
      result.suggestedNextState = this.inferNextState(effectiveTags, context);
    }
    
    // 有効なタグがない場合（すべて無視された）
    if (effectiveTags.length === 0 && ignoredTags.length > 0) {
      console.warn(`⚠️  FSM: No effective tags after normalization (all tags were out-of-phase)`);
      result.valid = false;
      result.requiresRegeneration = false; // リトライではなく、No Progress扱い
    }
    
    // No Progress 検出: 状態もタグも変わっていない
    const stateUnchanged = (this.lastState === currentState);
    const tagsUnchanged = (
      effectiveTags.length === this.lastEffectiveTags.length &&
      effectiveTags.every(tag => this.lastEffectiveTags.includes(tag))
    );
    
    if (stateUnchanged && tagsUnchanged && effectiveTags.length > 0) {
      this.noProgressCount++;
      console.warn(`⚠️  FSM: No progress detected (${this.noProgressCount}/2) - same state and tags`);
      
      if (this.noProgressCount >= 2) {
        console.error(`❌ FSM: No progress threshold reached - LLM is semantically stuck`);
        result.valid = false;
        result.requiresRegeneration = false; // リトライは無意味
        result.isNoProgress = true;          // No Progress専用フラグ
        // suggestedNextStateは設定しない（llmFlowControllerでハンドリング）
      }
    } else {
      // 進捗があればカウンターリセット
      this.noProgressCount = 0;
    }
    
    // 次回の比較のために記録
    this.lastState = currentState;
    this.lastEffectiveTags = [...effectiveTags];

    if (this.config.debug) {
      console.log(`[AgentStateService] Validation result:`, result);
    }

    return result;
  }

  /**
   * 検出されたタグから次の状態を推測
   * @param tags 検出されたタグ
   * @param context 追加のコンテキスト（modifiedLines等）
   * @returns 推奨される次の状態
   * 
   * 優先順序（normalizeTagsForStateと一致）：
   * 1. %_Reply Required_%
   * 2. %_No_Changes_Needed_%
   * 3. %_Plan_%
   * 4. %_Modified_%
   * 5. %_Verification_Report_%
   */
  private inferNextState(tags: string[], context?: Record<string, any>): AgentState | undefined {
    const currentState = this.stateMachine.getCurrentState();

    // タグの種類に基づいて次の状態を推測（優先度順）

    // 1️⃣ 最優先: %_Reply Required_%タグの検出
    if (tags.includes('%_Reply Required_%')) {
      if (currentState === AgentState.ANALYSIS) {
        return AgentState.AWAITING_INFO;
      }
      if (currentState === AgentState.MODIFYING) {
        return AgentState.AWAITING_INFO;
      }
    }

    // 2️⃣ %_No_Changes_Needed_%タグ（ANALYSIS状態からVERIFYINGへ）
    if (tags.includes('%_No_Changes_Needed_%')) {
      if (currentState === AgentState.ANALYSIS) {
        console.log('✅ No changes needed detected, transitioning to VERIFYING for validation');
        return AgentState.VERIFYING;
      }
      console.warn(`⚠️  No_Changes_Needed tag detected in invalid state: ${currentState}`);
      return undefined;
    }

    // 3️⃣ %_Plan_%タグ（ANALYSIS状態でPlan完了時はMODIFYINGへ）
    if (tags.includes('%_Plan_%')) {
      if (currentState === AgentState.ANALYSIS) {
        return AgentState.MODIFYING;
      }
      return AgentState.AWAITING_INFO;
    }

    // 4️⃣ %_Modified_%タグ（MODIFYING状態からVERIFYINGへ）
    // NOTE: Modifiedタグの中身が空の場合もVERIFYINGを経由する（全ケースでVERIFYING必須）
    if (tags.includes('%_Modified_%')) {
      if (currentState === AgentState.MODIFYING) {
        // modifiedBufferの内容をチェック（0行の場合はNo Changes扱い）
        const modifiedLines = context?.modifiedLines ?? 0;
        if (modifiedLines === 0) {
          console.log('⚠️  Modified tag detected but content is empty (0 lines) - transitioning to VERIFYING for validation');
        } else {
          console.log(`✅ Modified diff detected in MODIFYING state (${modifiedLines} lines), transitioning to VERIFYING`);
        }
        return AgentState.VERIFYING;
      }
      console.warn(`⚠️  Modified tag detected in invalid state: ${currentState}`);
      return undefined;
    }

    // 5️⃣ %_Verification_Report_%タグ（検証完了）
    if (tags.includes('%_Verification_Report_%')) {
      console.log('✅ Verification complete, FSM will transition to FINISHED');
      return AgentState.READY_TO_FINISH;
    }

    // 廃止タグの警告
    if (tags.includes('%_Ready_For_Final_Check_%')) {
      console.warn(`⚠️  Deprecated Ready_For_Final_Check tag detected`);
      return undefined;
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
