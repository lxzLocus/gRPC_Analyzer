import {
  AgentState,
  AgentStateContext,
  StateTransitionMetadata,
  ALLOWED_TAGS_BY_STATE,
  STATE_TRANSITIONS
} from '../types/AgentState.js';

/**
 * エージェント状態マシン
 * FSM（有限状態機械）による状態遷移を管理
 * 
 * 注意: プロンプトがまだ対応していないため、実際の処理には未使用
 * 将来のプロンプト対応時に有効化予定
 */
export class AgentStateMachine {
  private context: AgentStateContext;

  constructor(initialState: AgentState = AgentState.ANALYSIS) {
    this.context = {
      currentState: initialState,
      transitionHistory: [],
      lastUpdated: new Date()
    };
  }

  /**
   * 現在の状態を取得
   */
  getCurrentState(): AgentState {
    return this.context.currentState;
  }

  /**
   * 状態コンテキスト全体を取得
   */
  getContext(): AgentStateContext {
    return { ...this.context };
  }

  /**
   * 状態遷移履歴を取得
   */
  getTransitionHistory(): StateTransitionMetadata[] {
    return [...this.context.transitionHistory];
  }

  /**
   * 指定された状態への遷移が可能かチェック
   * @param toState 遷移先の状態
   * @returns 遷移可能な場合true
   */
  canTransitionTo(toState: AgentState): boolean {
    const allowedStates = STATE_TRANSITIONS[this.context.currentState];
    return allowedStates.includes(toState);
  }

  /**
   * 状態を遷移させる
   * @param toState 遷移先の状態
   * @param trigger 遷移のトリガー
   * @param context 追加のコンテキスト情報
   * @throws {Error} 不正な遷移の場合
   */
  transition(
    toState: AgentState,
    trigger: string,
    context?: Record<string, any>
  ): void {
    if (!this.canTransitionTo(toState)) {
      throw new Error(
        `Invalid state transition: ${this.context.currentState} -> ${toState}`
      );
    }

    const metadata: StateTransitionMetadata = {
      fromState: this.context.currentState,
      toState,
      trigger,
      timestamp: new Date(),
      context
    };

    this.context.transitionHistory.push(metadata);
    this.context.currentState = toState;
    this.context.lastUpdated = new Date();

    // ERRORステートへの遷移時はエラー情報を記録
    if (toState === AgentState.ERROR && context?.error) {
      this.context.error = context.error;
    }

    // ERROR以外への遷移時はエラー情報をクリア
    if (toState !== AgentState.ERROR) {
      delete this.context.error;
    }
  }

  /**
   * 現在の状態で許可されているタグを取得
   * @returns 許可されているタグの配列
   */
  getAllowedTags(): string[] {
    return [...ALLOWED_TAGS_BY_STATE[this.context.currentState]];
  }

  /**
   * 指定されたタグが現在の状態で許可されているかチェック
   * @param tag チェックするタグ
   * @returns 許可されている場合true
   */
  isTagAllowed(tag: string): boolean {
    const allowedTags = this.getAllowedTags();
    return allowedTags.includes(tag);
  }

  /**
   * LLMレスポンスから検出されたタグを検証
   * @param input 検出されたタグの配列、または検証するテキスト
   * @returns 検証結果
   */
  validateTags(input: string | string[]): {
    isValid: boolean;
    detectedTags: string[];
    invalidTags: string[];
    allowedTags: string[];
  } {
    // 文字列の場合はタグを検出
    const detectedTags = typeof input === 'string' 
      ? TagParser.detectTags(input)
      : input;
    
    const allowedTags = this.getAllowedTags();
    const invalidTags = detectedTags.filter(tag => !this.isTagAllowed(tag));

    return {
      isValid: invalidTags.length === 0,
      detectedTags,
      invalidTags,
      allowedTags
    };
  }

  /**
   * 状態マシンをリセット
   * @param initialState リセット後の初期状態（デフォルト: ANALYSIS）
   */
  reset(initialState: AgentState = AgentState.ANALYSIS): void {
    this.context = {
      currentState: initialState,
      transitionHistory: [],
      lastUpdated: new Date()
    };
  }

  /**
   * 終了状態に到達しているかチェック
   * @returns 終了状態の場合true
   */
  isFinished(): boolean {
    return this.context.currentState === AgentState.FINISHED;
  }

  /**
   * エラー状態に到達しているかチェック
   * @returns エラー状態の場合true
   */
  isError(): boolean {
    return this.context.currentState === AgentState.ERROR;
  }

  /**
   * エラー情報を取得
   * @returns エラー情報（エラー状態でない場合はundefined）
   */
  getError(): AgentStateContext['error'] | undefined {
    return this.context.error;
  }

  /**
   * デバッグ用: 現在の状態マシンの状態を文字列で取得
   */
  toString(): string {
    return `AgentStateMachine {
  currentState: ${this.context.currentState},
  transitionCount: ${this.context.transitionHistory.length},
  lastUpdated: ${this.context.lastUpdated.toISOString()},
  isFinished: ${this.isFinished()},
  isError: ${this.isError()}
}`;
  }
}

/**
 * タグ検出とパース用のユーティリティ
 */
export class TagParser {
  /**
   * テキストから特殊タグを検出
   * @param text 検出対象のテキスト
   * @returns 検出されたタグの配列
   */
  static detectTags(text: string): string[] {
    // タグのパターンを定義（%_XXX_%または%%_XXX_%%）
    const tagPattern = /%%?_([^_]+)_%%?/g;
    const matches = text.matchAll(tagPattern);
    const tags: string[] = [];

    for (const match of matches) {
      tags.push(match[0]); // フルマッチを追加
    }

    return [...new Set(tags)]; // 重複を除去
  }

  /**
   * タグの種類を判定
   * @param tag 判定するタグ
   * @returns タグの種類（Thought, Plan, Modified, etc.）
   */
  static getTagType(tag: string): string | null {
    const match = tag.match(/%%?_([^_]+)_%%?/);
    return match ? match[1] : null;
  }

  /**
   * タグからコンテンツを抽出
   * @param text 対象テキスト
   * @param tagType タグの種類（例: 'Thought', 'Plan'）
   * @returns 抽出されたコンテンツ（見つからない場合はnull）
   */
  static extractContentByTag(text: string, tagType: string): string | null {
    // 開始タグと終了タグのパターン
    const startTag = `%_${tagType}_%`;
    const endTag = `%_/${tagType}_%`;
    
    const startIndex = text.indexOf(startTag);
    if (startIndex === -1) return null;
    
    const contentStart = startIndex + startTag.length;
    const endIndex = text.indexOf(endTag, contentStart);
    
    if (endIndex === -1) return null;
    
    return text.substring(contentStart, endIndex).trim();
  }
}
