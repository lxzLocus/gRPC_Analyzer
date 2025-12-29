/**
 * 対話履歴要約マネージャー
 * 長い対話履歴を動的に要約し、トークン数制限を回避する
 * 
 * 4層トリガーシステム:
 * 1. TOKEN_THRESHOLD: メッセージ追加時のトークン閾値チェック
 * 2. PRE_SEND_CHECK: LLM送信直前の最終安全チェック
 * 3. TURN_COMPLETION: ターン完了時の非同期要約
 * 4. TASK_COMPLETION: タスク完了時のメタ要約
 */

import type { 
    ConversationSummary, 
    ConversationHistoryManager, 
    SummarizeRequest, 
    SummarizeResponse,
    SummarizationTriggerType
} from './types.js';
import Config from './config.js';
import OpenAIClient from './openAIClient.js';

class ConversationSummarizer {
    private config: Config;
    private openAIClient: OpenAIClient;
    private historyManager: ConversationHistoryManager;
    private correctionGoalsCallback: () => string; // correctionGoalsを取得するコールバック
    
    // 設定
    private readonly DEFAULT_SUMMARY_THRESHOLD = 30000; // デフォルトのトークン閾値
    private readonly TOKEN_ESTIMATION_RATIO = 4; // 1トークン ≈ 4文字の近似
    private readonly MODEL_HARD_LIMIT = 100000; // モデルの絶対上限（緊急要約トリガー）
    private readonly MIN_TURN_INTERVAL = 3; // 最小要約間隔（動的調整可能）
    private readonly TOKEN_GROWTH_THRESHOLD = 1.4; // トークン成長率閾値

    constructor(config: Config, openAIClient: OpenAIClient, correctionGoalsCallback: () => string) {
        this.config = config;
        this.openAIClient = openAIClient;
        this.correctionGoalsCallback = correctionGoalsCallback;
        
        this.historyManager = {
            messages: [],
            totalTokens: 0,
            summaryThreshold: this.config.get('llm.summaryThreshold', this.DEFAULT_SUMMARY_THRESHOLD),
            lastSummaryTurn: 0,
            summaryTokensUsed: 0,
            lastTokenAtSummary: 0,
            summarizationHistory: []
        };
        
        console.log(`📝 ConversationSummarizer initialized with threshold: ${this.historyManager.summaryThreshold} tokens`);
    }

    /**
     * メッセージを履歴に追加し、必要に応じて要約を実行
     * トリガー層1: TOKEN_THRESHOLD
     */
    async addMessage(role: string, content: string): Promise<Array<{ role: string, content: string }>> {
        // メッセージを追加
        this.historyManager.messages.push({ role, content });
        
        // トークン数を更新
        this.updateTokenCount();
        
        console.log(`📊 Current conversation: ${this.historyManager.messages.length} messages, ~${this.historyManager.totalTokens} tokens`);
        
        // トリガー層1: トークン閾値チェック（動的間隔調整付き）
        if (this.shouldSummarize('TOKEN_THRESHOLD')) {
            console.log(`🔄 [Trigger 1] Token threshold exceeded, starting dynamic summarization...`);
            return await this.performDynamicSummarization('TOKEN_THRESHOLD', 'Token count exceeded threshold');
        }
        
        return this.historyManager.messages;
    }

    /**
     * LLM送信直前の最終安全チェック
     * トリガー層2: PRE_SEND_CHECK
     */
    async preSendCheck(): Promise<Array<{ role: string, content: string }>> {
        // モデルの絶対上限チェック
        if (this.historyManager.totalTokens > this.MODEL_HARD_LIMIT) {
            console.log(`⚠️ [Trigger 2] Hard limit reached (${this.historyManager.totalTokens} > ${this.MODEL_HARD_LIMIT}), forcing compression...`);
            return await this.performDynamicSummarization('PRE_SEND_CHECK', 'Emergency: Model hard limit exceeded');
        }
        
        // 閾値超過しているが前回要約が最近すぎた場合の再チェック
        if (this.historyManager.totalTokens > this.historyManager.summaryThreshold * 0.9) {
            const messagesSinceLastSummary = this.historyManager.messages.length - this.historyManager.lastSummaryTurn;
            if (messagesSinceLastSummary >= 2) { // 最小間隔緩和
                console.log(`🔍 [Trigger 2] Pre-send safety check triggered (${this.historyManager.totalTokens} tokens, ${messagesSinceLastSummary} messages since last summary)`);
                return await this.performDynamicSummarization('PRE_SEND_CHECK', 'Pre-send safety check');
            }
        }
        
        return this.historyManager.messages;
    }

    /**
     * ターン完了時の要約チェック
     * トリガー層3: TURN_COMPLETION
     */
    async onTurnComplete(turnNumber: number): Promise<void> {
        // 一定ターン数ごとの要約チェック
        if (turnNumber % 5 === 0 && turnNumber > 0) {
            const messagesSinceLastSummary = this.historyManager.messages.length - this.historyManager.lastSummaryTurn;
            if (messagesSinceLastSummary >= 5 && this.historyManager.totalTokens > this.historyManager.summaryThreshold * 0.7) {
                console.log(`🔄 [Trigger 3] Turn completion check (Turn ${turnNumber}, preparing for next phase)`);
                // 非同期要約（次ターン準備）
                await this.performDynamicSummarization('TURN_COMPLETION', `Turn ${turnNumber} completed`);
            }
        }
    }

    /**
     * タスク完了時のメタ要約
     * トリガー層4: TASK_COMPLETION
     */
    async onTaskComplete(taskName: string): Promise<ConversationSummary | null> {
        if (this.historyManager.messages.length > 0) {
            console.log(`📋 [Trigger 4] Task completion meta-summary for: ${taskName}`);
            
            // メタ要約を生成（次タスクへの引き継ぎ用）
            const conversationHistory = this.formatConversationForSummary();
            const summarizePrompt = this.config.readPromptSummarizeFile(conversationHistory);
            
            const summaryResponse = await this.generateSummary({
                fullConversationHistory: summarizePrompt,
                model: this.config.get('llm.summaryModel', this.config.get('llm.model', 'gpt-4')),
                temperature: 0.1
            });
            
            if (summaryResponse.success) {
                // 要約履歴に記録
                this.recordSummarization('TASK_COMPLETION', `Task completed: ${taskName}`, this.historyManager.totalTokens, this.historyManager.messages.length);
                return summaryResponse.summary;
            }
        }
        
        return null;
    }

    /**
     * 現在の対話履歴を取得
     */
    getCurrentMessages(): Array<{ role: string, content: string }> {
        return this.historyManager.messages;
    }

    /**
     * 要約履歴を取得
     */
    getSummarizationHistory() {
        return this.historyManager.summarizationHistory;
    }

    /**
     * 要約統計を取得
     */
    getSummarizationStats() {
        return {
            totalSummarizations: this.historyManager.summarizationHistory.length,
            summaryTokensUsed: this.historyManager.summaryTokensUsed,
            currentTokens: this.historyManager.totalTokens,
            lastSummaryTurn: this.historyManager.lastSummaryTurn,
            triggers: this.historyManager.summarizationHistory.reduce((acc, item) => {
                acc[item.type] = (acc[item.type] || 0) + 1;
                return acc;
            }, {} as Record<SummarizationTriggerType, number>)
        };
    }

    /**
     * トークン数の推定値を更新
     */
    private updateTokenCount(): void {
        const totalText = this.historyManager.messages
            .map(msg => msg.content)
            .join(' ');
        
        // 簡易的なトークン数推定（実際のトークナイザーとは多少異なる）
        this.historyManager.totalTokens = Math.ceil(totalText.length / this.TOKEN_ESTIMATION_RATIO);
    }

    /**
     * 要約が必要かどうかを判定（動的間隔調整付き）
     */
    private shouldSummarize(triggerType: SummarizationTriggerType): boolean {
        const exceedsThreshold = this.historyManager.totalTokens > this.historyManager.summaryThreshold;
        const messagesSinceLastSummary = this.historyManager.messages.length - this.historyManager.lastSummaryTurn;
        
        // トークン成長率を計算
        let tokenGrowthRate = 1.0;
        if (this.historyManager.lastTokenAtSummary > 0) {
            tokenGrowthRate = this.historyManager.totalTokens / this.historyManager.lastTokenAtSummary;
        }
        
        // 動的間隔調整: 成長率が高い場合は早めに要約
        let minInterval = this.MIN_TURN_INTERVAL;
        if (tokenGrowthRate > this.TOKEN_GROWTH_THRESHOLD) {
            minInterval = Math.max(2, this.MIN_TURN_INTERVAL - 1);
            console.log(`📈 High token growth rate detected: ${tokenGrowthRate.toFixed(2)}x, reducing interval to ${minInterval}`);
        } else if (tokenGrowthRate < 1.2) {
            minInterval = this.MIN_TURN_INTERVAL + 2;
        }
        
        const enoughMessagesSinceLastSummary = messagesSinceLastSummary >= minInterval;
        
        return exceedsThreshold && enoughMessagesSinceLastSummary;
    }

    /**
     * 要約履歴を記録
     */
    private recordSummarization(
        type: SummarizationTriggerType,
        reason: string,
        tokenCount: number,
        messageCount: number
    ): void {
        this.historyManager.summarizationHistory.push({
            type,
            reason,
            timestamp: new Date().toISOString(),
            tokenCount,
            messageCount
        });
        
        console.log(`📊 Summarization recorded: [${type}] ${reason} (${tokenCount} tokens, ${messageCount} messages)`);
    }

    /**
     * 動的要約の実行
     */
    private async performDynamicSummarization(
        triggerType: SummarizationTriggerType,
        reason: string
    ): Promise<Array<{ role: string, content: string }>> {
        try {
            const beforeTokens = this.historyManager.totalTokens;
            const beforeMessages = this.historyManager.messages.length;
            
            // 1. 要約用のプロンプトを生成
            const conversationHistory = this.formatConversationForSummary();
            const summarizePrompt = this.config.readPromptSummarizeFile(conversationHistory);
            
            console.log(`📝 Sending ${summarizePrompt.length} characters to summarization...`);
            console.log(`   Trigger: [${triggerType}] ${reason}`);
            
            // 2. 別のLLMインスタンスで要約を生成
            const summaryResponse = await this.generateSummary({
                fullConversationHistory: summarizePrompt,
                model: this.config.get('llm.summaryModel', this.config.get('llm.model', 'gpt-4')),
                temperature: 0.1 // 要約には低い温度を使用
            });
            
            if (!summaryResponse.success) {
                console.error(`❌ Summarization failed: ${summaryResponse.error}`);
                return this.historyManager.messages; // 要約失敗時は元の履歴を返す
            }
            
            // 3. 最後のアクションの結果を特定
            const lastActionResult = this.extractLastActionResult();
            
            // 4. 対話再開用のプロンプトを生成
            const correctionGoals = this.correctionGoalsCallback();
            const resumePrompt = this.config.readPromptResumeFromSummaryFile(
                JSON.stringify(summaryResponse.summary, null, 2),
                lastActionResult,
                correctionGoals
            );
            
            // 5. 新しい短い対話履歴に置き換え（ただし、直前に追加された最新メッセージは保持）
            const systemMessage = this.historyManager.messages.find(msg => msg.role === 'system');
            
            // 要約が発動する直前に追加された最新のメッセージを保持（通常はファイル内容）
            // これにより、Turn 2でファイル内容が失われるバグを防ぐ
            const lastMessage = this.historyManager.messages[this.historyManager.messages.length - 1];
            
            this.historyManager.messages = [
                ...(systemMessage ? [systemMessage] : []),
                { role: 'user', content: resumePrompt },
                lastMessage  // 最新メッセージ（ファイル内容など）を保持
            ];
            
            // 6. 統計を更新
            this.historyManager.lastTokenAtSummary = beforeTokens; // 成長率計算用に保存
            this.historyManager.lastSummaryTurn = this.historyManager.messages.length;
            this.updateTokenCount();
            
            // 要約履歴を記録
            this.recordSummarization(triggerType, reason, beforeTokens, beforeMessages);
            
            const reductionRate = Math.round((1 - this.historyManager.totalTokens / beforeTokens) * 100);
            
            console.log(`✅ Dynamic summarization completed:`);
            console.log(`   Trigger: [${triggerType}] ${reason}`);
            console.log(`   Original: ${beforeTokens} tokens, ${beforeMessages} messages`);
            console.log(`   Compressed: ${this.historyManager.totalTokens} tokens, ${this.historyManager.messages.length} messages`);
            console.log(`   Reduction: ${reductionRate}%`);
            
            return this.historyManager.messages;
            
        } catch (error) {
            console.error(`❌ Error during dynamic summarization:`, error);
            return this.historyManager.messages; // エラー時は元の履歴を保持
        }
    }

    /**
     * 要約用に対話履歴をフォーマット
     */
    private formatConversationForSummary(): string {
        return this.historyManager.messages
            .map((msg, index) => `[Turn ${index + 1}] ${msg.role.toUpperCase()}: ${msg.content}`)
            .join('\n\n');
    }

    /**
     * LLMに要約リクエストを送信
     */
    private async generateSummary(request: SummarizeRequest): Promise<SummarizeResponse> {
        try {
            const summarizeMessages = [
                {
                    role: 'system',
                    content: 'You are a specialized AI assistant for summarizing technical conversations about code modifications.'
                },
                {
                    role: 'user',
                    content: request.fullConversationHistory
                }
            ];
            
            const response = await this.openAIClient.fetchOpenAPI(summarizeMessages);
            
            if (response && response.choices && response.choices[0]) {
                const summaryText = response.choices[0].message.content.trim();
                
                // 要約で消費したトークン数を記録
                const summaryUsage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
                this.historyManager.summaryTokensUsed += summaryUsage.total_tokens;
                
                console.log(`📊 Summary API usage - Prompt: ${summaryUsage.prompt_tokens}, Completion: ${summaryUsage.completion_tokens}, Total: ${summaryUsage.total_tokens}`);
                console.log(`📊 Cumulative summary tokens: ${this.historyManager.summaryTokensUsed}`);
                
                // デバッグ: レスポンスの最初の部分を表示
                console.log(`📊 Summary response preview (first 200 chars): ${summaryText.substring(0, 200)}`);
                
                // JSONパースを試行
                try {
                    const summary: ConversationSummary = JSON.parse(summaryText);
                    return {
                        summary,
                        success: true
                    };
                } catch (parseError) {
                    console.error(`❌ Failed to parse summary JSON:`, parseError);
                    console.error(`📝 Full response (first 500 chars):\n${summaryText.substring(0, 500)}`);
                    return {
                        summary: {
                            original_goal_summary: "Summary parsing failed",
                            progress_summary: ["Summary could not be parsed"],
                            current_status: "Unknown status due to parsing error",
                            open_correction_goals: ["Continue with original plan"]
                        },
                        success: false,
                        error: `JSON parsing failed: ${parseError}`
                    };
                }
            } else {
                return {
                    summary: {
                        original_goal_summary: "No summary generated",
                        progress_summary: ["Summary generation failed"],
                        current_status: "Unknown status",
                        open_correction_goals: ["Continue with original plan"]
                    },
                    success: false,
                    error: "No valid response from LLM"
                };
            }
            
        } catch (error) {
            console.error(`❌ Error generating summary:`, error);
            return {
                summary: {
                    original_goal_summary: "Summary generation error",
                    progress_summary: ["Summary could not be generated due to error"],
                    current_status: "Error occurred during summarization",
                    open_correction_goals: ["Continue with original plan"]
                },
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 最後のアクションの結果を抽出
     */
    private extractLastActionResult(): string {
        const lastFewMessages = this.historyManager.messages.slice(-3);
        
        // システムからの応答やファイル内容、diff適用結果などを探す
        for (const msg of lastFewMessages.reverse()) {
            if (msg.role === 'system' || msg.role === 'assistant') {
                // diff適用、ファイル取得、エラーなどの結果を含むメッセージを特定
                if (msg.content.includes('patch') || 
                    msg.content.includes('diff') || 
                    msg.content.includes('file content') ||
                    msg.content.includes('error') ||
                    msg.content.includes('applied')) {
                    return msg.content.substring(0, 500) + (msg.content.length > 500 ? '...' : '');
                }
            }
        }
        
        return 'Previous action completed successfully.';
    }

    /**
     * 統計情報を取得
     */
    getStats(): any {
        return {
            totalMessages: this.historyManager.messages.length,
            estimatedTokens: this.historyManager.totalTokens,
            summaryThreshold: this.historyManager.summaryThreshold,
            lastSummaryTurn: this.historyManager.lastSummaryTurn,
            timesExceededThreshold: this.historyManager.lastSummaryTurn > 0 ? 1 : 0,
            summaryTokensUsed: this.historyManager.summaryTokensUsed // 要約で消費したトークン数
        };
    }

    /**
     * 閾値を動的に調整
     */
    adjustThreshold(newThreshold: number): void {
        this.historyManager.summaryThreshold = newThreshold;
        console.log(`📊 Summary threshold adjusted to: ${newThreshold} tokens`);
    }
}

export default ConversationSummarizer;
