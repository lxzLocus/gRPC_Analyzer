/**
 * エージェント状態の列挙型
 * FSM（有限状態機械）による状態管理
 * 
 * 本ファイルは /app/src/types/AgentState.ts の評価用JavaScript版
 * 評価ツール（patchEvaluation）でAPRログの状態を判定するために使用
 */

/**
 * エージェント状態の定義
 */
export const AgentState = {
    /** 初期分析・計画フェーズ */
    ANALYSIS: 'ANALYSIS',
    
    /** FILE_CONTENT / DIRECTORY_LISTING 待ちフェーズ（内部専用） */
    AWAITING_INFO: 'AWAITING_INFO',
    
    /** パッチ生成中フェーズ */
    MODIFYING: 'MODIFYING',
    
    /** 自己検証・レビューフェーズ */
    VERIFYING: 'VERIFYING',
    
    /** Finを許可する直前フェーズ */
    READY_TO_FINISH: 'READY_TO_FINISH',
    
    /** 終了状態（正常終了） */
    FINISHED: 'FINISHED',
    
    /** 異常系（エラー終了） */
    ERROR: 'ERROR',
    
    /** 状態不明（ログ解析失敗など） */
    UNKNOWN: 'unknown'
};

/**
 * 全ての状態の配列
 */
export const ALL_AGENT_STATES = Object.values(AgentState);

/**
 * 終了状態の判定
 * @param {string} state - 判定する状態
 * @returns {boolean} 終了状態かどうか
 */
export function isTerminalState(state) {
    return state === AgentState.FINISHED || state === AgentState.ERROR;
}

/**
 * 正常終了の判定
 * @param {string} state - 判定する状態
 * @returns {boolean} 正常終了かどうか
 */
export function isSuccessfulCompletion(state) {
    return state === AgentState.FINISHED;
}

/**
 * エラー終了の判定
 * @param {string} state - 判定する状態
 * @returns {boolean} エラー終了かどうか
 */
export function isErrorCompletion(state) {
    return state === AgentState.ERROR;
}

/**
 * 有効な状態の検証
 * @param {string} state - 検証する状態
 * @returns {boolean} 有効な状態かどうか
 */
export function isValidAgentState(state) {
    return ALL_AGENT_STATES.includes(state);
}

/**
 * 状態の表示名を取得
 * @param {string} state - 状態
 * @returns {string} 表示名
 */
export function getStateDisplayName(state) {
    const displayNames = {
        [AgentState.ANALYSIS]: '分析中',
        [AgentState.AWAITING_INFO]: '情報待ち',
        [AgentState.MODIFYING]: '修正中',
        [AgentState.VERIFYING]: '検証中',
        [AgentState.READY_TO_FINISH]: '完了準備',
        [AgentState.FINISHED]: '完了',
        [AgentState.ERROR]: 'エラー',
        [AgentState.UNKNOWN]: '不明'
    };
    
    return displayNames[state] || state;
}

/**
 * 状態の絵文字を取得
 * @param {string} state - 状態
 * @returns {string} 絵文字
 */
export function getStateEmoji(state) {
    const emojis = {
        [AgentState.ANALYSIS]: '🔍',
        [AgentState.AWAITING_INFO]: '⏳',
        [AgentState.MODIFYING]: '🔧',
        [AgentState.VERIFYING]: '✅',
        [AgentState.READY_TO_FINISH]: '🎯',
        [AgentState.FINISHED]: '🏁',
        [AgentState.ERROR]: '❌',
        [AgentState.UNKNOWN]: '❓'
    };
    
    return emojis[state] || '📋';
}

/**
 * 状態の説明を取得
 * @param {string} state - 状態
 * @returns {string} 説明
 */
export function getStateDescription(state) {
    const descriptions = {
        [AgentState.ANALYSIS]: 'LLMが問題を分析し、修正計画を立案中',
        [AgentState.AWAITING_INFO]: 'ファイル内容やディレクトリ情報を取得中（内部状態）',
        [AgentState.MODIFYING]: 'コード修正パッチを生成中',
        [AgentState.VERIFYING]: '生成したパッチの検証とレビューを実施中',
        [AgentState.READY_TO_FINISH]: '全ての作業が完了し、終了準備完了',
        [AgentState.FINISHED]: '正常に処理が完了',
        [AgentState.ERROR]: 'エラーが発生して処理が中断',
        [AgentState.UNKNOWN]: '状態が不明（ログ解析失敗など）'
    };
    
    return descriptions[state] || '状態情報なし';
}

/**
 * 進捗率を計算（0.0 ~ 1.0）
 * @param {string} state - 状態
 * @returns {number} 進捗率
 */
export function getProgressRate(state) {
    const progressMap = {
        [AgentState.ANALYSIS]: 0.2,
        [AgentState.AWAITING_INFO]: 0.3,
        [AgentState.MODIFYING]: 0.5,
        [AgentState.VERIFYING]: 0.8,
        [AgentState.READY_TO_FINISH]: 0.95,
        [AgentState.FINISHED]: 1.0,
        [AgentState.ERROR]: 0.0,
        [AgentState.UNKNOWN]: 0.0
    };
    
    return progressMap[state] || 0.0;
}

export default AgentState;
