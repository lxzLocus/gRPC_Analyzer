/**
 * 対話履歴要約マネージャー
 * 長い対話履歴を動的に要約し、トークン数制限を回避する
 */

import type { 
    ConversationSummary, 
    ConversationHistoryManager, 
    SummarizeRequest, 
    SummarizeResponse 
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

    constructor(config: Config, openAIClient: OpenAIClient, correctionGoalsCallback: () => string) {
        this.config = config;
        this.openAIClient = openAIClient;
        this.correctionGoalsCallback = correctionGoalsCallback;
        
        this.historyManager = {
            messages: [],
            totalTokens: 0,
            summaryThreshold: this.config.get('llm.summaryThreshold', this.DEFAULT_SUMMARY_THRESHOLD),
            lastSummaryTurn: 0
        };
        
        console.log(`📝 ConversationSummarizer initialized with threshold: ${this.historyManager.summaryThreshold} tokens`);
    }

    /**
     * メッセージを履歴に追加し、必要に応じて要約を実行
     */
    async addMessage(role: string, content: string): Promise<Array<{ role: string, content: string }>> {
        // メッセージを追加
        this.historyManager.messages.push({ role, content });
        
        // トークン数を更新
        this.updateTokenCount();
        
        console.log(`📊 Current conversation: ${this.historyManager.messages.length} messages, ~${this.historyManager.totalTokens} tokens`);
        
        // 閾値チェック
        if (this.shouldSummarize()) {
            console.log(`🔄 Token threshold exceeded, starting dynamic summarization...`);
            return await this.performDynamicSummarization();
        }
        
        return this.historyManager.messages;
    }

    /**
     * 現在の対話履歴を取得
     */
    getCurrentMessages(): Array<{ role: string, content: string }> {
        return this.historyManager.messages;
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
     * 要約が必要かどうかを判定
     */
    private shouldSummarize(): boolean {
        const exceedsThreshold = this.historyManager.totalTokens > this.historyManager.summaryThreshold;
        const enoughMessagesSinceLastSummary = this.historyManager.messages.length - this.historyManager.lastSummaryTurn >= 5;
        
        return exceedsThreshold && enoughMessagesSinceLastSummary;
    }

    /**
     * 動的要約の実行
     */
    private async performDynamicSummarization(): Promise<Array<{ role: string, content: string }>> {
        try {
            // 1. 要約用のプロンプトを生成
            const conversationHistory = this.formatConversationForSummary();
            const summarizePrompt = this.config.readPromptSummarizeFile(conversationHistory);
            
            console.log(`📝 Sending ${conversationHistory.length} characters to summarization...`);
            
            // 2. 別のLLMインスタンスで要約を生成
            const summaryResponse = await this.generateSummary({
                fullConversationHistory: conversationHistory,
                model: this.config.get('llm.summaryModel', this.config.get('llm.model', 'gpt-4')),
                temperature: 0.1 // 要約には低い温度を使用
            });
            
            if (!summaryResponse.success) {
                console.error(`❌ Summarization failed: ${summaryResponse.error}`);
                return this.historyManager.messages; // 要約失敗時は元の履歴を返す
            }
            
            // 3. 最後のアクションの結果を特定
            const lastActionResult = this.extractLastActionResult();
            
            // 4. 対話再開用のプロンプトを生成（correctionGoalsを含める）
            const correctionGoals = this.correctionGoalsCallback();
            const resumePrompt = this.config.readPromptResumeFromSummaryFile(
                JSON.stringify(summaryResponse.summary, null, 2),
                lastActionResult,
                correctionGoals
            );
            
            // 5. 新しい短い対話履歴に置き換え
            const systemMessage = this.historyManager.messages.find(msg => msg.role === 'system');
            this.historyManager.messages = [
                ...(systemMessage ? [systemMessage] : []),
                { role: 'user', content: resumePrompt }
            ];
            
            // 6. 統計を更新
            this.historyManager.lastSummaryTurn = this.historyManager.messages.length;
            this.updateTokenCount();
            
            console.log(`✅ Dynamic summarization completed:`);
            console.log(`   Original: ${this.historyManager.totalTokens + conversationHistory.length / this.TOKEN_ESTIMATION_RATIO} tokens`);
            console.log(`   Compressed: ${this.historyManager.totalTokens} tokens`);
            console.log(`   Reduction: ${Math.round((1 - this.historyManager.totalTokens / (this.historyManager.totalTokens + conversationHistory.length / this.TOKEN_ESTIMATION_RATIO)) * 100)}%`);
            
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
                
                // JSONパースを試行（強化版）
                try {
                    const summary: ConversationSummary = this.extractJSON(summaryText);
                    return {
                        summary,
                        success: true
                    };
                } catch (parseError) {
                    console.error(`❌ Failed to parse summary JSON (enhanced parser):`, parseError);
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
     * LLM出力からJSONを抽出（強化パーサー - llmFlowController.safeParseJSONベース）
     */
    private extractJSON(text: string): any {
        if (!text || typeof text !== 'string') {
            throw new Error(`Invalid input for JSON parsing in conversationSummarizer`);
        }

        const trimmed = text.trim();

        // Step 1: 徹底的な文字クリーンアップ
        let cleaned = trimmed
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅文字
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, (match) => {
                const code = match.charCodeAt(0);
                if (code === 9 || code === 10 || code === 13) { // タブ、改行、復帰
                    return ' ';
                }
                return '';
            })
            .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // 特殊空白
            .replace(/[\u2028\u2029]/g, ' ') // ライン・パラグラフ区切り
            .replace(/[\uFFF0-\uFFFF]/g, '') // 特殊用途文字
            .replace(/\s+/g, ' ') // 連続空白を単一スペースに
            .trim();

        // Step 2: LLM内部タグを除去
        cleaned = cleaned.replace(/%_Thought_.*?%/g, '');
        cleaned = cleaned.replace(/%_Plan_.*?%/g, '');
        cleaned = cleaned.replace(/%_.*?_%/g, '');

        // Step 3: コードフェンスを除去
        cleaned = cleaned
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        // Step 4: 最も外側の完全なJSONオブジェクトを抽出（再帰的な括弧マッチング）
        let jsonCandidate = this.extractCompleteJSON(cleaned);
        
        if (!jsonCandidate) {
            throw new Error('No valid JSON object found in summary response');
        }

        // Step 5: 末尾カンマの除去
        jsonCandidate = jsonCandidate.replace(/,(\s*[\]\}])/g, '$1');

        // Step 6: JSONパース試行
        try {
            return JSON.parse(jsonCandidate);
        } catch (firstError) {
            console.log(`⚠️ First JSON parse attempt failed, trying repairs...`);

            // Step 7: 修復を試みる
            try {
                // シングルクォートをダブルクォートに変換
                let repaired = jsonCandidate.replace(/'/g, '"');

                // プロパティ名のクォートを修正
                repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');

                // 末尾カンマを再度除去
                repaired = repaired.replace(/,(\s*[\]\}])/g, '$1');

                return JSON.parse(repaired);
            } catch (secondError) {
                console.error(`❌ JSON repair failed for summary response`);
                console.error(`📝 Original text (first 500 chars):\n${text.substring(0, 500)}`);
                console.error(`📝 Cleaned text (first 500 chars):\n${cleaned.substring(0, 500)}`);
                console.error(`📝 Extracted JSON candidate (first 500 chars):\n${jsonCandidate.substring(0, 500)}`);
                throw new Error(`JSON parsing failed after repairs: ${secondError instanceof Error ? secondError.message : String(secondError)}`);
            }
        }
    }

    /**
     * 完全なJSONオブジェクトを抽出（括弧のバランスを考慮）
     */
    private extractCompleteJSON(text: string): string | null {
        // JSONオブジェクトまたは配列の開始位置を探す
        const startMatch = text.match(/[\[\{]/);
        if (!startMatch) {
            return null;
        }

        const startIndex = startMatch.index!;
        const startChar = text[startIndex];
        const endChar = startChar === '{' ? '}' : ']';
        
        let depth = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = startIndex; i < text.length; i++) {
            const char = text[i];

            // エスケープ処理
            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            // 文字列内の処理
            if (char === '"' && !escapeNext) {
                inString = !inString;
                continue;
            }

            if (inString) {
                continue;
            }

            // 括弧の深さをカウント
            if (char === startChar || (startChar === '{' && char === '[') || (startChar === '[' && char === '{')) {
                depth++;
            } else if (char === endChar || (startChar === '{' && char === ']' && depth > 0) || (startChar === '[' && char === '}' && depth > 0)) {
                depth--;
                
                // 最も外側の括弧が閉じられた
                if (depth === 0) {
                    const jsonStr = text.substring(startIndex, i + 1);
                    console.log(`✅ Extracted complete JSON: ${jsonStr.length} characters`);
                    return jsonStr;
                }
            }
        }

        // 括弧が閉じられなかった場合
        console.warn(`⚠️ Incomplete JSON detected, depth: ${depth}`);
        return null;
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
            timesExceededThreshold: this.historyManager.lastSummaryTurn > 0 ? 1 : 0
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
