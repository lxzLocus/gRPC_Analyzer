/**
 * アクション検証エラー
 * LLMの%_Reply Required_%リクエストが不正な場合に使用
 * 
 * 目的:
 * - FILE_CONTENTをディレクトリに使用した場合の検出
 * - DIRECTORY_LISTINGをファイルに使用した場合の検出
 * - FSM状態で許可されていないアクション型の検出
 */
export class ValidationError extends Error {
  /** エラーの種類 */
  readonly type: 'INVALID_ACTION_FOR_PATH' | 'ACTION_NOT_ALLOWED_IN_STATE';
  
  /** リクエストされたアクション型 */
  readonly requestedAction: 'FILE_CONTENT' | 'DIRECTORY_LISTING';
  
  /** 対象パス */
  readonly path: string;
  
  /** 正しいアクション型のヒント（任意） */
  readonly hint?: 'FILE_CONTENT' | 'DIRECTORY_LISTING';
  
  /** 許可されているアクション型のリスト（状態エラーの場合） */
  readonly allowedActions?: string[];
  
  constructor(params: {
    type: 'INVALID_ACTION_FOR_PATH' | 'ACTION_NOT_ALLOWED_IN_STATE';
    requestedAction: 'FILE_CONTENT' | 'DIRECTORY_LISTING';
    path: string;
    hint?: 'FILE_CONTENT' | 'DIRECTORY_LISTING';
    allowedActions?: string[];
    message?: string;
  }) {
    const defaultMessage = params.message || 
      (params.type === 'INVALID_ACTION_FOR_PATH' 
        ? `Cannot use ${params.requestedAction} for "${params.path}"`
        : `Action ${params.requestedAction} is not allowed in current state`);
    
    super(defaultMessage);
    
    this.name = 'ValidationError';
    this.type = params.type;
    this.requestedAction = params.requestedAction;
    this.path = params.path;
    this.hint = params.hint;
    this.allowedActions = params.allowedActions;
    
    // スタックトレース維持
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
  
  /**
   * LLMへのフィードバックメッセージを生成
   * 「叱らない」「事実のみ」「正解を明示」
   */
  toFeedbackMessage(): string {
    if (this.type === 'INVALID_ACTION_FOR_PATH') {
      const isDirectory = this.requestedAction === 'FILE_CONTENT';
      const pathType = isDirectory ? 'directory' : 'file';
      const correctAction = this.hint || (isDirectory ? 'DIRECTORY_LISTING' : 'FILE_CONTENT');
      
      return `Note:\n` +
        `You requested ${this.requestedAction} for "${this.path}", which is a ${pathType}.\n` +
        `To inspect a ${pathType}, use ${correctAction} instead.\n` +
        `Please try again using the correct action type.`;
    } else {
      const allowedList = this.allowedActions?.join(', ') || 'none';
      return `Note:\n` +
        `Action type ${this.requestedAction} is not available in your current state.\n` +
        `Available action types: ${allowedList}\n` +
        `Please use one of the allowed action types.`;
    }
  }
}
