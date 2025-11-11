/**
 * Discord Webhook クライアント
 * 
 * 責任:
 * - Discord Webhookへのメッセージ送信
 * - 進捗状況と最終結果の通知
 */

import axios from 'axios';

export class DiscordWebhook {
    /**
     * @param {string} webhookUrl - Discord WebhookのURL
     */
    constructor(webhookUrl) {
        this.webhookUrl = webhookUrl;
        this.defaultUsername = 'gRPC Analyzer Bot';
        this.defaultAvatar = 'https://static-00.iconduck.com/assets.00/discord-icon-2048x2048-wooh9l0j.png';
    }

    /**
     * メッセージを送信
     * @param {string} message - 送信するメッセージ
     * @param {string} [username] - 送信者名（オプション）
     * @param {string} [avatarUrl] - アバターURL（オプション）
     * @returns {Promise<number>} ステータスコード
     */
    async sendMessage(message, username = null, avatarUrl = null) {
        try {
            const payload = {
                content: message,
                username: username || this.defaultUsername,
                avatar_url: avatarUrl || this.defaultAvatar,
            };

            const response = await axios.post(this.webhookUrl, payload);
            console.log(`📤 Discord webhook sent - Status: ${response.status}`);
            return response.status;
        } catch (error) {
            console.error(`❌ Discord webhook error: ${error.message}`);
            if (error.response) {
                console.error(`   Status: ${error.response.status}`);
                console.error(`   Data: ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }

    /**
     * 進捗状況メッセージを送信
     * @param {Object} stats - 進捗統計
     * @param {number} stats.total - 総数
     * @param {number} stats.processed - 処理済み数
     * @param {number} stats.successful - 成功数
     * @param {number} stats.failed - 失敗数
     * @param {number} stats.skipped - スキップ数
     * @param {number} stats.startTime - 開始時刻（ミリ秒）
     * @param {string} datasetName - データセット名
     */
    async sendProgress(stats, datasetName) {
        const progress = stats.total > 0 
            ? Math.floor((stats.processed / stats.total) * 100) 
            : 0;
        
        const elapsed = Date.now() - stats.startTime;
        const elapsedStr = this.formatTime(elapsed);
        
        const eta = stats.processed > 0 
            ? this.formatTime((elapsed / stats.processed) * (stats.total - stats.processed))
            : '---';
        
        const successRate = stats.processed > 0 
            ? Math.floor((stats.successful / stats.processed) * 100) 
            : 0;

        const progressBar = this.generateProgressBar(progress, 20);

        const message = [
            '**📊 処理進捗レポート**',
            '```',
            `Dataset: ${datasetName}`,
            `Progress: ${progressBar} ${progress}%`,
            `Status: ${stats.processed}/${stats.total}`,
            `✅ Success: ${stats.successful} (${successRate}%)`,
            `❌ Failed: ${stats.failed}`,
            `⏭️  Skipped: ${stats.skipped}`,
            `⏱️  Elapsed: ${elapsedStr}`,
            `⏳ ETA: ${eta}`,
            '```'
        ].join('\n');

        return await this.sendMessage(message);
    }

    /**
     * 最終結果メッセージを送信
     * @param {Object} stats - 最終統計
     * @param {string} datasetName - データセット名
     * @param {boolean} isSuccess - 正常終了かどうか
     */
    async sendFinalResult(stats, datasetName, isSuccess = true) {
        const successRate = stats.total > 0 
            ? Math.floor((stats.successful / stats.total) * 100) 
            : 0;
        
        const totalTime = this.formatTime(Date.now() - stats.startTime);
        const avgTime = stats.total > 0 
            ? this.formatTime((Date.now() - stats.startTime) / stats.total)
            : '---';

        const emoji = isSuccess ? '✅' : '⚠️';
        const status = isSuccess ? '正常終了' : '異常終了';

        const message = [
            `**${emoji} バッチ処理${status}**`,
            '```',
            `Dataset: ${datasetName}`,
            `Status: ${status}`,
            `Total Processed: ${stats.processed}/${stats.total}`,
            `✅ Successful: ${stats.successful} (${successRate}%)`,
            `❌ Failed: ${stats.failed}`,
            `⏭️  Skipped: ${stats.skipped}`,
            `⏱️  Total Time: ${totalTime}`,
            `⏱️  Average Time/PR: ${avgTime}`,
            '```',
            isSuccess ? '🎉 All tasks completed!' : '⚠️ Some errors occurred during processing.'
        ].join('\n');

        return await this.sendMessage(message);
    }

    /**
     * エラーメッセージを送信
     * @param {Error} error - エラーオブジェクト
     * @param {string} context - エラーコンテキスト
     */
    async sendError(error, context = 'Unknown') {
        const message = [
            '**❌ 致命的エラー発生**',
            '```',
            `Context: ${context}`,
            `Error Type: ${error.constructor.name}`,
            `Error Message: ${error.message}`,
            '```'
        ].join('\n');

        return await this.sendMessage(message);
    }

    /**
     * 時間を人間が読める形式にフォーマット
     * @private
     */
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * プログレスバーを生成
     * @private
     */
    generateProgressBar(percent, width = 20) {
        const filled = Math.floor(width * percent / 100);
        const empty = width - filled;
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
    }
}

export default DiscordWebhook;
