/**
 * プログレストラッカー - バッチ処理の進捗とETA表示
 * 
 * 責任:
 * - 進捗率の計算とリアルタイム表示
 * - ETA（予想残り時間）の計算
 * - 処理統計の追跡
 */

export interface ProgressStats {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
    startTime: number;
    currentTime?: number;
}

export class ProgressTracker {
    private stats: ProgressStats;
    private lastUpdateTime: number = 0;
    private updateIntervalMs: number = 1000; // 1秒ごとに更新
    private isTTY: boolean;

    constructor(total: number, forceTUI: boolean = false) {
        this.stats = {
            total,
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            startTime: Date.now()
        };
        // forceTUIが指定されている場合、またはTTYの場合にTUIを有効化
        this.isTTY = forceTUI || process.stdout.isTTY || false;
    }

    /**
     * 処理成功を記録
     */
    recordSuccess(): void {
        this.stats.processed++;
        this.stats.successful++;
        this.update();
    }

    /**
     * 処理失敗を記録
     */
    recordFailure(): void {
        this.stats.processed++;
        this.stats.failed++;
        this.update();
    }

    /**
     * スキップを記録
     */
    recordSkip(): void {
        this.stats.processed++;
        this.stats.skipped++;
        this.update();
    }

    /**
     * 進捗率を取得（0-100）
     */
    getProgress(): number {
        if (this.stats.total === 0) return 0;
        return Math.floor((this.stats.processed / this.stats.total) * 100);
    }

    /**
     * 経過時間を取得（ミリ秒）
     */
    getElapsedTime(): number {
        return Date.now() - this.stats.startTime;
    }

    /**
     * ETA（予想残り時間）を計算（ミリ秒）
     */
    getETA(): number {
        if (this.stats.processed === 0) return 0;
        
        const elapsed = this.getElapsedTime();
        const averageTimePerItem = elapsed / this.stats.processed;
        const remaining = this.stats.total - this.stats.processed;
        
        return Math.floor(averageTimePerItem * remaining);
    }

    /**
     * 時間を人間が読める形式にフォーマット
     */
    private formatTime(milliseconds: number): string {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * プログレスバーを生成
     */
    private generateProgressBar(percent: number, width: number = 30): string {
        const filled = Math.floor(width * percent / 100);
        const empty = width - filled;
        return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
    }

    /**
     * 進捗情報を表示
     */
    private update(): void {
        const now = Date.now();
        
        // 更新頻度を制限（1秒に1回）
        if (now - this.lastUpdateTime < this.updateIntervalMs && this.stats.processed < this.stats.total) {
            return;
        }
        
        this.lastUpdateTime = now;
        this.display();
    }

    /**
     * 進捗情報を画面に表示
     */
    display(): void {
        const progress = this.getProgress();
        const elapsed = this.formatTime(this.getElapsedTime());
        const eta = this.stats.processed > 0 ? this.formatTime(this.getETA()) : '---';
        
        const progressBar = this.generateProgressBar(progress);
        const stats = `${this.stats.processed}/${this.stats.total}`;
        const successRate = this.stats.processed > 0 
            ? `${Math.floor((this.stats.successful / this.stats.processed) * 100)}%` 
            : '---';

        const line = `\r🎯 ${progressBar} ${progress}% | ${stats} | ✅ ${this.stats.successful} ❌ ${this.stats.failed} ⏭️  ${this.stats.skipped} | Success: ${successRate} | Elapsed: ${elapsed} | ETA: ${eta}`;

        if (this.isTTY) {
            // TTYの場合は同じ行を上書き
            process.stdout.write(line);
        } else {
            // TTYでない場合（ログファイルなど）は進捗の節目だけ出力
            if (this.stats.processed % 10 === 0 || this.stats.processed === this.stats.total) {
                console.log(`Progress: ${stats} (${progress}%) | Success: ${successRate} | Elapsed: ${elapsed} | ETA: ${eta}`);
            }
        }
    }

    /**
     * 最終結果を表示
     */
    displayFinal(): void {
        if (this.isTTY) {
            // 改行して最終結果を表示
            process.stdout.write('\n');
        }
        
        const totalTime = this.formatTime(this.getElapsedTime());
        const successRate = this.stats.total > 0 
            ? `${Math.floor((this.stats.successful / this.stats.total) * 100)}%` 
            : '0%';
        
        console.log('\n📊 Final Statistics:');
        console.log('========================================');
        console.log(`✅ Successful: ${this.stats.successful}/${this.stats.total} (${successRate})`);
        console.log(`❌ Failed: ${this.stats.failed}`);
        console.log(`⏭️  Skipped: ${this.stats.skipped}`);
        console.log(`⏱️  Total Time: ${totalTime}`);
        
        if (this.stats.total > 0) {
            const avgTime = this.formatTime(this.getElapsedTime() / this.stats.total);
            console.log(`⏱️  Average Time per PR: ${avgTime}`);
        }
        
        console.log('========================================');
    }

    /**
     * 現在の統計を取得
     */
    getStats(): ProgressStats {
        return {
            ...this.stats,
            currentTime: Date.now()
        };
    }

    /**
     * 手動で進捗を表示（デバッグ用）
     */
    forceDisplay(): void {
        this.display();
    }
}

export default ProgressTracker;
