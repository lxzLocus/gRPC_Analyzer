/**
 * Progress Tracker with Terminal UI
 * ターミナル下部に進捗を固定表示し、上部にログを流す
 */

export interface ProgressStats {
    total: number;
    completed: number;
    success: number;
    failed: number;
    skipped: number;
    startTime: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    summaryTokens?: number; // 要約で消費したトークン数
}

export interface TokenStats {
    average: number;
    min: number;
    max: number;
    total: number;
    count: number;
}

export class ProgressTracker {
    private stats: ProgressStats;
    private progressBarHeight = 4; // 進捗バーの高さ（行数）を4に増加（統計情報追加のため）
    private terminalHeight: number;
    private logBuffer: string[] = [];
    private maxLogLines = 100;
    private isTTY: boolean;  // TUI有効フラグ
    
    // トークン統計用のデータ
    private tokenHistory: number[] = []; // 各PRのトークン消費量を記録

    constructor(total: number, forceTUI: boolean = false) {
        this.stats = {
            total,
            completed: 0,
            success: 0,
            failed: 0,
            skipped: 0,
            startTime: Date.now(),
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            summaryTokens: 0 // 要約トークン数を初期化
        };

        // TTY状態の確認（forceTUIが指定されている場合は強制有効化）
        const isTTY = forceTUI || process.stdout.isTTY || false;
        const terminalRows = process.stdout.rows || 24;
        const terminalCols = process.stdout.columns || 80;
        
        console.log('🖥️  Terminal Status:');
        if (forceTUI && !process.stdout.isTTY) {
            console.log(`   TTY: No (but TUI FORCED enabled)`);
        } else {
            console.log(`   TTY: ${isTTY ? 'Yes' : 'No (TUI disabled)'}`);
        }
        console.log(`   Rows: ${terminalRows}`);
        console.log(`   Cols: ${terminalCols}`);
        console.log(`   TERM: ${process.env.TERM || 'not set'}`);
        
        this.terminalHeight = terminalRows;
        this.isTTY = isTTY;
        
        // TTYでない場合はTUIを無効化（ただしforceTUIの場合は続行）
        if (!isTTY) {
            if (!forceTUI) {
                console.log('⚠️  TUI disabled: Not running in a TTY');
                console.log('💡 To enable TUI, run with: docker exec -it <container> node ...');
                return; // TUI機能をスキップ
            } else {
                console.log('⚠️  Not running in a TTY, but TUI FORCED - attempting to render anyway');
            }
        }
        
        // ターミナルリサイズイベント
        if (process.stdout.on) {
            process.stdout.on('resize', () => {
                this.terminalHeight = process.stdout.rows || 24;
                this.render();
            });
        }

        // 初期レンダリング
        this.clearScreen();
        this.render();
    }

    /**
     * PR処理完了を記録
     */
    public recordCompletion(status: 'success' | 'failed' | 'skipped', tokens?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
        summaryTokens?: number; // 要約トークン数を追加
    }): void {
        this.stats.completed++;
        
        if (status === 'success') this.stats.success++;
        else if (status === 'failed') this.stats.failed++;
        else if (status === 'skipped') this.stats.skipped++;

        // トークン数を追加（実際にリクエストが通った場合のみ）
        if (tokens && tokens.totalTokens && tokens.totalTokens > 0) {
            console.log('🔍 ProgressTracker Token Debug:');
            console.log(`   Received tokens:`, tokens);
            console.log(`   promptTokens: ${tokens.promptTokens}`);
            console.log(`   completionTokens: ${tokens.completionTokens}`);
            console.log(`   totalTokens: ${tokens.totalTokens}`);
            console.log(`   summaryTokens: ${tokens.summaryTokens || 0}`);
            
            this.stats.promptTokens += tokens.promptTokens || 0;
            this.stats.completionTokens += tokens.completionTokens || 0;
            this.stats.totalTokens += tokens.totalTokens || 0;
            this.stats.summaryTokens = (this.stats.summaryTokens || 0) + (tokens.summaryTokens || 0);
            
            // トークン履歴に記録（統計計算用）
            this.tokenHistory.push(tokens.totalTokens);
            
            console.log(`   Total accumulated: ${this.stats.totalTokens}`);
            console.log(`   Summary accumulated: ${this.stats.summaryTokens}`);
            console.log(`   Request count with tokens: ${this.tokenHistory.length}`);
        } else {
            console.log('⚠️  ProgressTracker: No tokens provided or zero tokens');
        }

        // TTYの場合のみTUI更新
        if (this.isTTY) {
            this.render();
        } else {
            // 非TTYの場合は進捗をシンプルに表示
            const percentage = this.stats.total > 0 
                ? ((this.stats.completed / this.stats.total) * 100).toFixed(1)
                : '0.0';
            console.log(`🎯 Progress: ${this.stats.completed}/${this.stats.total} (${percentage}%) | ✅ ${this.stats.success} ❌ ${this.stats.failed} ⏭️  ${this.stats.skipped}`);
        }
    }

    /**
     * ログメッセージを追加
     */
    public log(message: string): void {
        const timestamp = new Date().toLocaleTimeString('ja-JP');
        const logLine = `[${timestamp}] ${message}`;
        this.logBuffer.push(logLine);
        
        // バッファサイズ制限
        if (this.logBuffer.length > this.maxLogLines) {
            this.logBuffer.shift();
        }

        // TTYの場合のみTUI更新
        if (this.isTTY) {
            this.render();
        } else {
            // 非TTYの場合は直接コンソール出力
            console.log(logLine);
        }
    }

    /**
     * 経過時間を取得
     */
    private getElapsed(): string {
        const elapsed = Date.now() - this.stats.startTime;
        return this.formatDuration(elapsed);
    }

    /**
     * ETAを計算
     */
    private getETA(): string {
        if (this.stats.completed === 0) return '計算中...';
        
        const elapsed = Date.now() - this.stats.startTime;
        const avgTimePerItem = elapsed / this.stats.completed;
        const remaining = this.stats.total - this.stats.completed;
        const eta = avgTimePerItem * remaining;
        
        return this.formatDuration(eta);
    }

    /**
     * 時間をフォーマット
     */
    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
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
     * トークン数をフォーマット（カンマ区切り）
     */
    private formatTokens(tokens: number): string {
        return tokens.toLocaleString('en-US');
    }

    /**
     * トークン統計を計算
     */
    private calculateTokenStats(): TokenStats | null {
        if (this.tokenHistory.length === 0) {
            return null;
        }

        const total = this.tokenHistory.reduce((sum, tokens) => sum + tokens, 0);
        const average = total / this.tokenHistory.length;
        const min = Math.min(...this.tokenHistory);
        const max = Math.max(...this.tokenHistory);

        return {
            average: Math.round(average),
            min,
            max,
            total,
            count: this.tokenHistory.length
        };
    }

    /**
     * 残りの推定トークン数を計算
     */
    private getEstimatedRemainingTokens(): number | null {
        const stats = this.calculateTokenStats();
        if (!stats) return null;

        const remaining = this.stats.total - this.stats.completed;
        return Math.round(stats.average * remaining);
    }

    /**
     * 画面をクリア
     */
    private clearScreen(): void {
        process.stdout.write('\x1b[2J'); // 画面クリア
        process.stdout.write('\x1b[H');  // カーソルをホームに移動
    }

    /**
     * 画面を再描画
     */
    private render(): void {
        // カーソルをホームに移動
        process.stdout.write('\x1b[H');

        const logAreaHeight = this.terminalHeight - this.progressBarHeight - 1;
        
        // ログエリアを描画
        const visibleLogs = this.logBuffer.slice(-logAreaHeight);
        for (let i = 0; i < logAreaHeight; i++) {
            const log = visibleLogs[i] || '';
            // 行をクリアして出力
            process.stdout.write('\x1b[2K'); // 行クリア
            process.stdout.write(log + '\n');
        }

        // 区切り線
        const separator = '─'.repeat(process.stdout.columns || 80);
        process.stdout.write('\x1b[2K');
        process.stdout.write('\x1b[36m' + separator + '\x1b[0m\n'); // シアン色

        // 進捗バー
        this.renderProgressBar();
    }

    /**
     * 進捗バーを描画
     */
    private renderProgressBar(): void {
        const percentage = this.stats.total > 0 
            ? ((this.stats.completed / this.stats.total) * 100).toFixed(1)
            : '0.0';

        const elapsed = this.getElapsed();
        const eta = this.getETA();

        // 1行目: 進捗とETA
        process.stdout.write('\x1b[2K');
        process.stdout.write(
            `🎯 ${this.stats.completed}/${this.stats.total} (${percentage}%) | ` +
            `⏱️  ${elapsed} | ETA: ${eta}\n`
        );

        // 2行目: ステータス
        process.stdout.write('\x1b[2K');
        process.stdout.write(
            `✅ Success: ${this.stats.success} | ` +
            `❌ Failed: ${this.stats.failed} | ` +
            `⏭️  Skipped: ${this.stats.skipped}\n`
        );

        // 3行目: トークン消費
        process.stdout.write('\x1b[2K');
        process.stdout.write(
            `🎫 Tokens - Prompt: ${this.formatTokens(this.stats.promptTokens)} | ` +
            `Completion: ${this.formatTokens(this.stats.completionTokens)} | ` +
            `Total: ${this.formatTokens(this.stats.totalTokens)}\n`
        );

        // 4行目: トークン統計と予測
        process.stdout.write('\x1b[2K');
        const tokenStats = this.calculateTokenStats();
        if (tokenStats && tokenStats.count > 0) {
            const estimated = this.getEstimatedRemainingTokens();
            process.stdout.write(
                `📊 Avg/Request: ${this.formatTokens(tokenStats.average)} | ` +
                `Min: ${this.formatTokens(tokenStats.min)} | ` +
                `Max: ${this.formatTokens(tokenStats.max)} | ` +
                `Est. Remaining: ${estimated ? this.formatTokens(estimated) : 'N/A'} ` +
                `(${tokenStats.count} requests)\n`
            );
        } else {
            process.stdout.write('📊 統計情報を収集中...\n');
        }
    }

    /**
     * 終了処理
     */
    public finish(): void {
        // 最終レンダリング
        this.render();
        
        // カーソルを最下部に移動
        process.stdout.write('\n');
        
        console.log('\n' + '='.repeat(80));
        console.log('🎉 Processing Complete!');
        console.log('='.repeat(80));
        console.log(`📊 Results:`);
        console.log(`   Total: ${this.stats.total}`);
        console.log(`   ✅ Success: ${this.stats.success}`);
        console.log(`   ❌ Failed: ${this.stats.failed}`);
        console.log(`   ⏭️  Skipped: ${this.stats.skipped}`);
        console.log(`   ⏱️  Duration: ${this.getElapsed()}`);
        console.log(`   🎫 Total Tokens: ${this.formatTokens(this.stats.totalTokens)}`);
        console.log(`      - Prompt: ${this.formatTokens(this.stats.promptTokens)}`);
        console.log(`      - Completion: ${this.formatTokens(this.stats.completionTokens)}`);
        if (this.stats.summaryTokens && this.stats.summaryTokens > 0) {
            console.log(`      - Summary: ${this.formatTokens(this.stats.summaryTokens)}`);
            console.log(`   💰 Grand Total (incl. Summary): ${this.formatTokens(this.stats.totalTokens + this.stats.summaryTokens)}`);
        }
    }

    /**
     * 統計情報を取得
     */
    public getStats(): ProgressStats {
        return { ...this.stats };
    }
}

export default ProgressTracker;
