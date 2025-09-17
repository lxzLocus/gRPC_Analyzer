/**
 * LLM共通エラーハンドラー
 * 各プロバイダーのエラーを統一的に解析・処理
 */

export class LLMErrorHandler {
    constructor() {}

    /**
     * LLM関連エラーを統一的に解析する
     * @param {Error} error - エラーオブジェクト
     * @returns {Object} 解析結果
     */
    analyzeLLMError(error) {
        const analysis = {
            type: 'unknown',
            statusCode: null,
            message: error.message,
            retryable: false,
            suggestion: null,
            provider: error.provider || 'unknown',
            originalError: error
        };

        // HTTPステータスコード別の解析
        if (error.status || error.originalError?.status) {
            const status = error.status || error.originalError?.status;
            analysis.statusCode = status;
            
            switch (status) {
                case 400:
                    analysis.type = 'bad_request';
                    analysis.message = `不正なリクエスト: ${error.message}`;
                    analysis.suggestion = 'プロンプト内容やパラメータを確認してください';
                    break;
                    
                case 401:
                    analysis.type = 'authentication_error';
                    analysis.message = `認証エラー: ${this.getProviderName(error.provider)}APIキーが無効です`;
                    analysis.suggestion = `${this.getApiKeyEnvName(error.provider)}を確認してください`;
                    break;
                    
                case 403:
                    analysis.type = 'permission_denied';
                    analysis.message = `権限エラー: ${error.message}`;
                    analysis.suggestion = `${this.getProviderName(error.provider)}APIキーの権限設定を確認してください`;
                    break;
                    
                case 404:
                    analysis.type = 'not_found';
                    analysis.message = `リソース未発見: ${error.message}`;
                    analysis.suggestion = 'モデル名やエンドポイントを確認してください';
                    break;
                    
                case 429:
                    analysis.type = 'rate_limit_exceeded';
                    analysis.message = `レート制限に到達: ${error.message}`;
                    analysis.retryable = true;
                    analysis.suggestion = '少し待ってからリトライしてください';
                    break;
                    
                case 500:
                case 502:
                case 503:
                case 504:
                    analysis.type = 'server_error';
                    analysis.message = `サーバーエラー (${status}): ${error.message}`;
                    analysis.retryable = true;
                    analysis.suggestion = `${this.getProviderName(error.provider)}側の一時的な問題です。しばらく待ってからリトライしてください`;
                    break;
                    
                default:
                    analysis.type = 'http_error';
                    analysis.message = `HTTPエラー (${status}): ${error.message}`;
                    break;
            }
        } else if (error.message && error.message.includes('timeout')) {
            analysis.type = 'timeout';
            analysis.message = `APIタイムアウト: ${error.message}`;
            analysis.retryable = true;
            analysis.suggestion = 'タイムアウト値を増加させるか、リクエスト内容を簡略化してください';
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            analysis.type = 'network_error';
            analysis.message = `ネットワークエラー: ${error.message}`;
            analysis.retryable = true;
            analysis.suggestion = 'インターネット接続を確認してください';
        } else if (error.name === 'AbortError') {
            analysis.type = 'request_aborted';
            analysis.message = 'リクエストが中断されました';
            analysis.retryable = true;
            analysis.suggestion = 'リクエストを再実行してください';
        } else if (error.message && error.message.includes('ENOENT')) {
            analysis.type = 'file_not_found';
            analysis.message = 'プロンプトテンプレートファイルが見つかりません';
            analysis.suggestion = 'プロンプトテンプレートファイルのパスを確認してください';
        } else if (error.message && error.message.includes('template')) {
            analysis.type = 'template_error';
            analysis.suggestion = 'プロンプトテンプレートの構文を確認してください';
        } else if (error.message && (error.message.includes('parse') || error.message.includes('JSON'))) {
            analysis.type = 'response_parse_error';
            analysis.suggestion = 'LLMレスポンスの形式が期待される形式と異なります';
        }

        return analysis;
    }

    /**
     * プロバイダー名を取得
     * @param {string} provider - プロバイダー識別子
     * @returns {string} 表示用プロバイダー名
     */
    getProviderName(provider) {
        switch (provider) {
            case 'openai': return 'OpenAI ';
            case 'gemini': return 'Gemini ';
            default: return '';
        }
    }

    /**
     * APIキー環境変数名を取得
     * @param {string} provider - プロバイダー識別子
     * @returns {string} 環境変数名
     */
    getApiKeyEnvName(provider) {
        switch (provider) {
            case 'openai': return 'OPENAI_API_KEY';
            case 'gemini': return 'GEMINI_API_KEY';
            default: return 'API_KEY';
        }
    }

    /**
     * エラーの詳細情報をログ出力
     * @param {Object} errorAnalysis - エラー解析結果
     */
    logErrorDetails(errorAnalysis) {
        console.error('🔍 LLMエラー詳細分析:');
        console.error(`  - プロバイダー: ${errorAnalysis.provider}`);
        console.error(`  - エラータイプ: ${errorAnalysis.type}`);
        console.error(`  - ステータスコード: ${errorAnalysis.statusCode || 'N/A'}`);
        console.error(`  - メッセージ: ${errorAnalysis.message}`);
        console.error(`  - リトライ可能: ${errorAnalysis.retryable ? 'はい' : 'いいえ'}`);
        if (errorAnalysis.suggestion) {
            console.error(`  - 推奨対応: ${errorAnalysis.suggestion}`);
        }
    }

    /**
     * エラーが再試行可能かどうかを判定
     * @param {Object} errorAnalysis - エラー解析結果
     * @returns {boolean} 再試行可能かどうか
     */
    isRetryable(errorAnalysis) {
        return errorAnalysis.retryable === true;
    }

    /**
     * エラーを標準化されたエラーオブジェクトに変換
     * @param {Error} originalError - 元のエラー
     * @param {Object} errorAnalysis - エラー解析結果
     * @returns {Error} 標準化されたエラー
     */
    createStandardError(originalError, errorAnalysis) {
        const standardError = new Error(errorAnalysis.message);
        standardError.originalError = originalError;
        standardError.errorAnalysis = errorAnalysis;
        standardError.type = errorAnalysis.type;
        standardError.statusCode = errorAnalysis.statusCode;
        standardError.retryable = errorAnalysis.retryable;
        standardError.provider = errorAnalysis.provider;
        return standardError;
    }
}

export default LLMErrorHandler;
