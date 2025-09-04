/**
 * LLM処理サービス
 * LLMFlowController の実行とリトライ処理を管理
 */

import { DatasetRepository } from '../Repository/DatasetRepository.js';
import { BatchProcessingOptions, LLMControllerResult } from '../types/BatchProcessTypes.js';
import LLMFlowController from '../modules/llmFlowController.js';

// Node.js型の宣言
declare const process: any;

export class LLMProcessingService {
    private datasetRepository: DatasetRepository;
    private options: BatchProcessingOptions;
    private currentController: LLMFlowController | null = null;

    constructor(options: BatchProcessingOptions) {
        this.options = options;
        this.datasetRepository = new DatasetRepository();
    }

    /**
     * リトライ機能付きLLM処理実行
     */
    async processWithRetry(
        premergeDir: string,
        repositoryName: string,
        category: string,
        pullRequestTitle: string
    ): Promise<LLMControllerResult> {
        const maxRetries = this.options.maxRetries || 3;
        let lastError: Error | null = null;

        for (let retry = 0; retry <= maxRetries; retry++) {
            try {
                console.log(`🔄 Processing (attempt ${retry + 1}/${maxRetries + 1}): ${repositoryName}/${category}/${pullRequestTitle}`);
                
                const result = await this.executeLLMController(premergeDir);
                
                if (result.success) {
                    return result;
                } else if (!this.isRetryableError(result.errorMessage || '')) {
                    // リトライ不可能なエラーの場合は即座に返す
                    return result;
                }
                
                lastError = new Error(result.errorMessage);
                
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(`❌ Error in attempt ${retry + 1}/${maxRetries + 1} for ${pullRequestTitle}:`, lastError.message);
                
                if (!this.isRetryableError(lastError.message) || retry === maxRetries) {
                    break;
                }
                
                // 指数バックオフでリトライ待機
                const waitTime = Math.pow(2, retry) * 1000;
                console.log(`⏳ Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } finally {
                await this.cleanupController();
            }
        }

        return {
            success: false,
            processingTime: 0,
            errorMessage: lastError?.message || 'Unknown error after retries'
        };
    }

    /**
     * LLMFlowController の実行
     */
    private async executeLLMController(premergeDir: string): Promise<LLMControllerResult> {
        const startTime = Date.now();

        try {
            this.currentController = new LLMFlowController(premergeDir);
            
            // タイムアウト設定
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Process timeout after ${this.options.timeoutMs! / 1000}s`));
                }, this.options.timeoutMs);
            });

            // 実際の処理実行
            await Promise.race([
                this.currentController.run(),
                timeoutPromise
            ]);

            return {
                success: true,
                processingTime: Date.now() - startTime
            };

        } catch (error) {
            return {
                success: false,
                processingTime: Date.now() - startTime,
                errorMessage: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 処理結果の分析
     */
    async analyzeResult(
        repositoryName: string,
        category: string,
        pullRequestTitle: string,
        llmResult: LLMControllerResult
    ): Promise<boolean> {
        if (!llmResult.success) {
            return false;
        }

        try {
            // ログファイルの取得
            const logFiles = await this.datasetRepository.getLogFiles(repositoryName, category, pullRequestTitle);
            if (logFiles.length === 0) {
                console.log(`⚠️ No log files found for ${pullRequestTitle}`);
                return false;
            }

            // 最新のログファイルを確認
            const latestLogFile = logFiles.sort().pop();
            if (!latestLogFile) return false;

            const logContent = await this.datasetRepository.readLogFile(
                repositoryName, category, pullRequestTitle, latestLogFile
            );
            
            if (!logContent) return false;

            const logData = JSON.parse(logContent);

            // ステータスを確認（%%_Fin_%%タグベースの厳密な判定）
            const status = logData.experiment_metadata?.status || 'Unknown';
            
            // %%_Fin_%%タグの存在確認
            const hasFinTag = logContent.includes('%%_Fin_%%') || status.includes('%%_Fin_%%');
            
            // 明示的なエラーの確認
            const hasErrors = logContent.includes('400 This model\'s maximum context length') ||
                            logContent.includes('JSON parse failed') ||
                            status.includes('Incomplete') ||
                            status.includes('Error') ||
                            status.includes('Failed');

            // 成功条件: %%_Fin_%%タグがあり、重大なエラーがない
            const isSuccess = hasFinTag && !hasErrors;

            console.log(`📊 Processing result for ${pullRequestTitle}:`);
            console.log(`   Status: ${status}`);
            console.log(`   %%_Fin_%% tag: ${hasFinTag ? 'YES' : 'NO'}`);
            console.log(`   Has errors: ${hasErrors ? 'YES' : 'NO'}`);
            console.log(`   Final result: ${isSuccess ? 'SUCCESS' : 'FAILURE'}`);

            return isSuccess;

        } catch (error) {
            console.error(`❌ Error analyzing processing result for ${pullRequestTitle}:`, error);
            return false;
        }
    }

    /**
     * エラーがリトライ可能かどうかの判定
     */
    private isRetryableError(errorMessage: string): boolean {
        const retryablePatterns = [
            /network|timeout|connection/i,
            /rate.*limit/i,
            /temporary|temp/i,
            /502|503|504/i,
            /JSON.*parse/i,
            /SyntaxError/i,
            /unexpected/i
        ];

        const nonRetryablePatterns = [
            /401|403|404|413/i, // 認証・権限・見つからない・ペイロード過大
            /invalid.*request/i,
            /malformed/i,
            /file.*not.*found/i,
            /directory.*not.*found/i
        ];

        // 非リトライ対象のエラーをチェック
        const lowerErrorMessage = errorMessage.toLowerCase();
        for (const pattern of nonRetryablePatterns) {
            if (pattern.test(lowerErrorMessage)) {
                console.log(`🚫 Non-retryable error detected: ${errorMessage}`);
                return false;
            }
        }

        // リトライ対象のエラーをチェック
        for (const pattern of retryablePatterns) {
            if (pattern.test(lowerErrorMessage)) {
                console.log(`🔄 Retryable error detected: ${errorMessage}`);
                return true;
            }
        }

        // デフォルトはリトライ対象外
        console.log(`❓ Unknown error type, not retrying: ${errorMessage}`);
        return false;
    }

    /**
     * コントローラーのクリーンアップ
     */
    private async cleanupController(): Promise<void> {
        if (this.currentController) {
            try {
                // LLMFlowControllerにcleanupメソッドがある場合のみ呼び出し
                if (typeof (this.currentController as any).cleanup === 'function') {
                    await (this.currentController as any).cleanup();
                }
            } catch (cleanupError) {
                console.warn('⚠️ Controller cleanup failed:', cleanupError);
            }
        }
        this.currentController = null;

        // ガベージコレクション
        if (this.options.enableGarbageCollection && global.gc) {
            global.gc();
        }
    }

    /**
     * サービスのクリーンアップ
     */
    async cleanup(): Promise<void> {
        await this.cleanupController();
    }
}
