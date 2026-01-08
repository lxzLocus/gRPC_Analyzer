/**
 * LLM処理サービス
 * LLMFlowController の実行とリトライ処理を管理
 */

import { DatasetRepository } from '../Repository/DatasetRepository.js';
import { BatchProcessingOptions, LLMControllerResult } from '../types/BatchProcessTypes.js';
import LLMFlowController from '../modules/llmFlowController.js';
import Logger from '../modules/Logger.js';

// Node.js型の宣言
declare const process: any;

export class LLMProcessingService {
    private datasetRepository: DatasetRepository;
    private options: BatchProcessingOptions;
    private currentController: LLMFlowController | null = null;
    private logger: Logger;

    constructor(options: BatchProcessingOptions) {
        this.options = options;
        this.datasetRepository = new DatasetRepository();
        this.logger = new Logger();
    }

    /**
     * リトライ機能付きLLM処理実行
     * Phase 1 (3回): OpenAIライブラリ使用
     * Phase 2 (3回): REST API直接呼び出し（フォールバック）
     */
    async processWithRetry(
        premergeDir: string,
        repositoryName: string,
        category: string,
        pullRequestTitle: string
    ): Promise<LLMControllerResult> {
        const maxRetriesPerPhase = this.options.maxRetries || 3;
        const totalMaxRetries = maxRetriesPerPhase * 2; // Phase 1 + Phase 2
        let lastError: Error | null = null;
        let useRestApiFallback = false;

        for (let retry = 0; retry < totalMaxRetries; retry++) {
            try {
                // Phase切り替え: 最初の3回が失敗したらREST APIフォールバックに切り替え
                if (retry >= maxRetriesPerPhase && !useRestApiFallback) {
                    console.log('\n🔄 ════════════════════════════════════════════════');
                    console.log('⚠️  OpenAI Library failed 3 times. Switching to REST API fallback...');
                    console.log('🔄 ════════════════════════════════════════════════\n');
                    useRestApiFallback = true;
                }

                const phase = useRestApiFallback ? 2 : 1;
                const phaseRetry = retry % maxRetriesPerPhase;
                const phaseAttempt = phaseRetry + 1;
                
                console.log(`🔄 Processing (Phase ${phase}, attempt ${phaseAttempt}/${maxRetriesPerPhase}): ${repositoryName}/${category}/${pullRequestTitle}`);
                
                const result = await this.executeLLMController(premergeDir, useRestApiFallback);
                
                if (result.success) {
                    if (useRestApiFallback) {
                        console.log('✅ Success using REST API fallback!');
                    }
                    return result;
                } else if (!this.isRetryableError(result.errorMessage || '')) {
                    // リトライ不可能なエラーの場合は即座に返す
                    return result;
                }
                
                lastError = new Error(result.errorMessage);
                
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                const phase = useRestApiFallback ? 2 : 1;
                const phaseRetry = retry % maxRetriesPerPhase;
                const phaseAttempt = phaseRetry + 1;
                
                // 詳細エラーログの記録
                this.logger.logLLMParsingError(
                    lastError.message || 'Unknown error',
                    'processWithRetry',
                    'Expected successful LLM processing',
                    `Failed at Phase ${phase}, attempt ${phaseAttempt}/${maxRetriesPerPhase}`,
                    lastError
                );
                
                console.error(`❌ Error in Phase ${phase}, attempt ${phaseAttempt}/${maxRetriesPerPhase} for ${pullRequestTitle}:`, lastError.message);
                
                if (!this.isRetryableError(lastError.message)) {
                    // リトライ不可能なエラーの場合
                    // ただし、Phase 1でネットワークエラーの場合はPhase 2へ
                    if (!useRestApiFallback && this.isNetworkError(lastError.message)) {
                        console.log('🔄 Network error detected in Phase 1. Will try Phase 2 (REST API)...');
                        retry = maxRetriesPerPhase - 1; // Phase 2に強制遷移
                        continue;
                    }
                    break;
                }
                
                // Phase内での最終リトライの場合、次のPhaseへ
                if (phaseAttempt >= maxRetriesPerPhase && !useRestApiFallback) {
                    console.log('⚠️  Phase 1 exhausted. Moving to Phase 2...');
                    continue; // 次のループでPhase 2開始
                }
                
                // リトライ待機（exponential backoff with jitter）
                // ネットワークエラーの場合は待機時間を延長
                const isNetworkErr = this.isNetworkError(lastError.message);
                const baseWaitTime = Math.pow(2, phaseRetry) * (isNetworkErr ? 2000 : 1000);
                // ジッターを追加して同時リトライの衝突を回避
                const jitter = Math.random() * 1000;
                const waitTime = baseWaitTime + jitter;
                console.log(`⏳ Waiting ${Math.round(waitTime)}ms before retry (network error: ${isNetworkErr})...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
            } finally {
                await this.cleanupController();
            }
        }

        return {
            success: false,
            processingTime: 0,
            errorMessage: lastError?.message || 'Unknown error after all retry phases'
        };
    }

    /**
     * LLMFlowController の実行
     * @param premergeDir プリマージディレクトリ
     * @param useRestApiFallback REST APIフォールバックを使用するか
     */
    private async executeLLMController(premergeDir: string, useRestApiFallback: boolean = false): Promise<LLMControllerResult> {
        const startTime = Date.now();

        try {
            // REST APIフォールバック時は環境変数で通知
            if (useRestApiFallback) {
                process.env.USE_OPENAI_REST_FALLBACK = 'true';
            } else {
                delete process.env.USE_OPENAI_REST_FALLBACK;
            }
            
            this.currentController = new LLMFlowController(premergeDir, {
                enablePreVerification: this.options.enablePreVerification ?? true
            });
            
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

            // トークン使用量を取得
            const tokenUsage = this.currentController.getTokenUsage();
            console.log('🎫 LLM Token Usage:', tokenUsage);

            return {
                success: true,
                processingTime: Date.now() - startTime,
                usage: tokenUsage
            };

        } catch (error) {
            // エラー時もトークン情報を返す（コントローラーが存在する場合）
            const tokenUsage = this.currentController ? this.currentController.getTokenUsage() : undefined;
            
            return {
                success: false,
                processingTime: Date.now() - startTime,
                errorMessage: error instanceof Error ? error.message : String(error),
                usage: tokenUsage
            };
        } finally {
            // 環境変数をクリーンアップ
            delete process.env.USE_OPENAI_REST_FALLBACK;
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
     * ネットワークエラーかどうかの判定
     */
    private isNetworkError(errorMessage: string): boolean {
        const networkPatterns = [
            /connection.*error/i,
            /APIConnectionError/i,
            /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i,
            /network/i,
            /timeout/i
        ];
        
        const lowerMessage = errorMessage.toLowerCase();
        return networkPatterns.some(pattern => pattern.test(lowerMessage));
    }

    /**
     *      console.log(`   Has errors: ${hasErrors ? 'YES' : 'NO'}`);
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
            // ネットワーク・接続エラー（リトライ可能）
            /connection.*error/i,
            /network|timeout|connection/i,
            /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i,
            
            // OpenAI API特有のリトライ可能エラー
            /rate.*limit/i,           // RateLimitError (429)
            /APITimeoutError/i,       // タイムアウト (408)
            /InternalServerError/i,   // サーバーエラー (500)
            /502|503|504/i,           // Bad Gateway, Service Unavailable, Gateway Timeout
            
            // 一時的なエラー
            /temporary|temp/i,
            /try.*again/i,
            
            // JSONパースエラー（LLMレスポンスの問題）
            /JSON.*parse/i,
            /SyntaxError/i,
            /unexpected/i
        ];

        const nonRetryablePatterns = [
            // OpenAI API特有のリトライ不可エラー
            /UnauthorizedError/i,            // 認証エラー (401)
            /BadRequestError/i,              // 不正なリクエスト (400) - 一部除く
            /NotFoundError/i,                // モデル未発見 (404)
            /UnprocessableEntityError/i,     // 処理不可 (422)
            /ConflictError/i,                // 競合 (409)
            
            // HTTPステータスコード
            /401|403|404|413|422/i,
            
            // 具体的なエラーメッセージ
            /authentication.*failed/i,
            /invalid.*api.*key/i,
            /model.*not.*found/i,
            /invalid.*request/i,
            /malformed/i,
            
            // ファイルシステムエラー
            /file.*not.*found/i,
            /directory.*not.*found/i,
            /permission.*denied/i
        ];

        const lowerErrorMessage = errorMessage.toLowerCase();
        
        // 特別なケース: BadRequestErrorでもトークン超過の場合はリトライ可能
        // （システムが自動的にサマライズして再試行する）
        if (/token|context_length/i.test(lowerErrorMessage) && /400|BadRequest/i.test(lowerErrorMessage)) {
            console.log(`🔄 Token limit error detected - System will summarize and retry: ${errorMessage}`);
            return true;
        }

        // 非リトライ対象のエラーをチェック（優先）
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
        console.log(`❓ Unknown error type (not retrying): ${errorMessage}`);
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
