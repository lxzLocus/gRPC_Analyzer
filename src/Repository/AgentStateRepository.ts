import { AgentStateContext, AgentState } from '../types/AgentState.js';

/**
 * エージェント状態の永続化を担当するRepository
 * 
 * 注意: プロンプトがまだ対応していないため、実際の処理には未使用
 * 将来のプロンプト対応時に有効化予定
 */
export class AgentStateRepository {
  private stateStore: Map<string, AgentStateContext>;

  constructor() {
    this.stateStore = new Map();
  }

  /**
   * エージェント状態を保存
   * @param agentId エージェントの一意識別子（例: リポジトリ名_PR番号）
   * @param context 状態コンテキスト
   */
  async save(agentId: string, context: AgentStateContext): Promise<void> {
    this.stateStore.set(agentId, {
      ...context,
      lastUpdated: new Date()
    });
  }

  /**
   * エージェント状態を取得
   * @param agentId エージェントの一意識別子
   * @returns 状態コンテキスト（存在しない場合はnull）
   */
  async load(agentId: string): Promise<AgentStateContext | null> {
    const context = this.stateStore.get(agentId);
    return context ? { ...context } : null;
  }

  /**
   * エージェント状態を削除
   * @param agentId エージェントの一意識別子
   * @returns 削除成功した場合true
   */
  async delete(agentId: string): Promise<boolean> {
    return this.stateStore.delete(agentId);
  }

  /**
   * 全エージェントIDを取得
   * @returns エージェントIDの配列
   */
  async getAllAgentIds(): Promise<string[]> {
    return Array.from(this.stateStore.keys());
  }

  /**
   * 特定の状態にあるエージェントを検索
   * @param state 検索する状態
   * @returns 該当するエージェントIDと状態コンテキストの配列
   */
  async findByState(state: AgentState): Promise<Array<{ agentId: string; context: AgentStateContext }>> {
    const results: Array<{ agentId: string; context: AgentStateContext }> = [];

    for (const [agentId, context] of this.stateStore.entries()) {
      if (context.currentState === state) {
        results.push({ agentId, context: { ...context } });
      }
    }

    return results;
  }

  /**
   * 古い状態を削除（クリーンアップ用）
   * @param olderThanMs 指定ミリ秒より古い状態を削除
   * @returns 削除されたエージェント数
   */
  async cleanup(olderThanMs: number): Promise<number> {
    const now = Date.now();
    let deletedCount = 0;

    for (const [agentId, context] of this.stateStore.entries()) {
      const age = now - context.lastUpdated.getTime();
      if (age > olderThanMs) {
        this.stateStore.delete(agentId);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * ストア内の状態数を取得
   * @returns 保存されている状態の数
   */
  async count(): Promise<number> {
    return this.stateStore.size;
  }

  /**
   * 全ての状態をクリア
   */
  async clear(): Promise<void> {
    this.stateStore.clear();
  }

  /**
   * エージェント状態の統計情報を取得
   * @returns 状態ごとのエージェント数
   */
  async getStatistics(): Promise<Record<AgentState, number>> {
    const stats: Record<AgentState, number> = {
      [AgentState.ANALYSIS]: 0,
      [AgentState.AWAITING_INFO]: 0,
      [AgentState.MODIFYING]: 0,
      [AgentState.VERIFYING]: 0,
      [AgentState.READY_TO_FINISH]: 0,
      [AgentState.FINISHED]: 0,
      [AgentState.ERROR]: 0
    };

    for (const context of this.stateStore.values()) {
      stats[context.currentState]++;
    }

    return stats;
  }
}
