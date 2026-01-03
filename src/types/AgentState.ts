/**
 * エージェントの状態を表す列挙型
 * FSM（有限状態機械）による状態管理に使用
 * 
 * 統合状態: llmFlowControllerに統合済み（2026-01-02）
 * - プロンプト生成時にSystem State情報を埋め込み
 * - LLM応答時にタグ検証を実行
 * - MainScript.js, SinglePRScript.js の両方で有効
 */
export enum AgentState {
  /** 初期分析・計画フェーズ */
  ANALYSIS = 'ANALYSIS',
  
  /** FILE_CONTENT / DIRECTORY_LISTING 待ちフェーズ */
  AWAITING_INFO = 'AWAITING_INFO',
  
  /** パッチ生成中フェーズ */
  MODIFYING = 'MODIFYING',
  
  /** 自己検証・レビューフェーズ */
  VERIFYING = 'VERIFYING',
  
  /** Finを許可する直前フェーズ */
  READY_TO_FINISH = 'READY_TO_FINISH',
  
  /** 終了状態 */
  FINISHED = 'FINISHED',
  
  /** 異常系 */
  ERROR = 'ERROR'
}

/**
 * 各状態で許可されるLLMタグの定義
 * 
 * 注意: AWAITING_INFOは内部専用状態
 * - LLMはAWAITING_INFO状態を見ない
 * - ファイル取得後、即座にANALYSIS状態に戻す
 * - LLMから見ると常にANALYSIS状態として処理される
 */
export const ALLOWED_TAGS_BY_STATE: Record<AgentState, string[]> = {
  [AgentState.ANALYSIS]: [
    '%_Thought_%',
    '%_Plan_%',
    '%_Reply Required_%'
  ],
  [AgentState.AWAITING_INFO]: [
    // 内部専用状態：LLMはこの状態を見ない
    // ファイル取得後、即座にANALYSISに戻る
    '%_Thought_%'
  ],
  [AgentState.MODIFYING]: [
    '%_Modified_%',
    '%_Reply Required_%'
  ],
  [AgentState.VERIFYING]: [
    '%_Verification_Report_%',
    '%_Thought_%'
  ],
  [AgentState.READY_TO_FINISH]: [
    '%_Ready_For_Final_Check_%',
    '%%_Fin_%%'  // この状態でのみFinタグを許可
  ],
  [AgentState.FINISHED]: [
    // 終了状態 - タグ送信不要（既にFinを送信済み）
  ],
  [AgentState.ERROR]: [
    '%_Thought_%',
    '%_Reply Required_%'
  ]
};

/**
 * 状態遷移の定義
 * 各状態から遷移可能な次の状態を定義
 * 
 * 遷移ルール:
 * - ANALYSIS → AWAITING_INFO (Reply Required検出時)
 * - ANALYSIS → MODIFYING (Plan完了時)
 * - AWAITING_INFO → ANALYSIS (ホストが情報を返した後、必ずANALYSISを経由)
 * - MODIFYING → VERIFYING (Modified Patch検出時)
 * - MODIFYING → AWAITING_INFO (Reply Required検出時)
 * - VERIFYING → READY_TO_FINISH (検証パス時)
 * - VERIFYING → MODIFYING (追加修正が必要な時)
 * - READY_TO_FINISH → FINISHED (次のプロンプトでFinタグを送信)
 * 
 * 重要: %%_Fin_%%タグはREADY_TO_FINISH状態でのみ許可される
 */
export const STATE_TRANSITIONS: Record<AgentState, AgentState[]> = {
  [AgentState.ANALYSIS]: [
    AgentState.AWAITING_INFO,
    AgentState.MODIFYING,
    AgentState.ERROR
  ],
  [AgentState.AWAITING_INFO]: [
    AgentState.ANALYSIS,
    AgentState.ERROR
  ],
  [AgentState.MODIFYING]: [
    AgentState.VERIFYING,
    AgentState.AWAITING_INFO,
    AgentState.ERROR
  ],
  [AgentState.VERIFYING]: [
    AgentState.MODIFYING,
    AgentState.READY_TO_FINISH,
    AgentState.ERROR
  ],
  [AgentState.READY_TO_FINISH]: [
    AgentState.FINISHED,
    AgentState.ERROR
  ],
  [AgentState.FINISHED]: [],
  [AgentState.ERROR]: [
    AgentState.ANALYSIS // エラーから復帰する場合
  ]
};

/**
 * 状態遷移のメタデータ
 */
export interface StateTransitionMetadata {
  /** 遷移元の状態 */
  fromState: AgentState;
  
  /** 遷移先の状態 */
  toState: AgentState;
  
  /** 遷移のトリガー（例: タグ検出、エラー発生など） */
  trigger: string;
  
  /** 遷移発生時刻 */
  timestamp: Date;
  
  /** 追加のコンテキスト情報 */
  context?: Record<string, any>;
}

/**
 * 状態管理のコンテキスト
 */
export interface AgentStateContext {
  /** 現在の状態 */
  currentState: AgentState;
  
  /** 状態遷移の履歴 */
  transitionHistory: StateTransitionMetadata[];
  
  /** 最終更新時刻 */
  lastUpdated: Date;
  
  /** エラー情報（ERROR状態の場合） */
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

/**
 * FSM の現在の状態と許可タグをフォーマットして文字列を生成
 * プロンプトの System State セクションに埋め込むための関数
 * 
 * @param state 現在のエージェント状態
 * @returns フォーマットされたシステム状態文字列
 * 
 * @example
 * ```
 * const stateInfo = formatSystemState(AgentState.VERIFYING);
 * // Returns:
 * // current_state: VERIFYING
 * // allowed_tags:
 * //   - %_Verification_Report_%
 * //   - %_Thought_%
 * // Do not output any other tags.
 * ```
 */
export function formatSystemState(state: AgentState, tagViolationNote?: string): string {
  const allowedTags = ALLOWED_TAGS_BY_STATE[state];
  
  let result = `current_state: ${state}\n`;
  
  if (allowedTags.length > 0) {
    result += `allowed_tags:\n`;
    allowedTags.forEach(tag => {
      result += `  - ${tag}\n`;
    });
    result += `Do not output any other tags.`;
  } else {
    result += `allowed_tags: []\nNo tags are allowed in this state.`;
  }
  
  // 状態遷移のフローと%%_Fin_%%の使用条件を追加
  result += `\n\nstate_transition_flow:\n`;
  result += `  ANALYSIS → MODIFYING → VERIFYING → READY_TO_FINISH → FINISHED\n`;
  result += `\nIMPORTANT:\n`;
  result += `  - %%_Fin_%% tag can ONLY be used in READY_TO_FINISH state\n`;
  result += `  - To reach READY_TO_FINISH, you must:\n`;
  result += `    1. Complete modifications using %_Modified_%\n`;
  result += `    2. Verify changes using %_Verification_Report_%\n`;
  result += `    3. System will transition you to READY_TO_FINISH\n`;
  result += `  - Current state: ${state} ${state === AgentState.READY_TO_FINISH ? '(%%_Fin_%% is now allowed)' : '(%%_Fin_%% is NOT allowed yet)'}`;
  
  // タグ違反通知を追加
  if (tagViolationNote) {
    result += `\n\n${tagViolationNote}`;
  }
  
  return result;
}
