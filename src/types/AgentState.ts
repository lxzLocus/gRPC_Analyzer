/**
 * エージェントの状態を表す列挙型
 * FSM（有限状態機械）による状態管理に使用
 * 
 * 注意: プロンプトがまだ対応していないため、実際の処理には未使用
 * 将来のプロンプト対応時に有効化予定
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
 */
export const ALLOWED_TAGS_BY_STATE: Record<AgentState, string[]> = {
  [AgentState.ANALYSIS]: [
    '%_Thought_%',
    '%_Plan_%',
    '%_Reply Required_%'
  ],
  [AgentState.AWAITING_INFO]: [
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
