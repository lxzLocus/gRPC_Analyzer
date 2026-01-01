/**
 * Progress Tracker with Terminal UI
 * ターミナル下部に進捗を固定表示し、上部にログを流す
 */

import { ProgressView, ViewData } from '../views/ProgressView.js';

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
    private terminalWidth: number;
    private logBuffer: string[] = [];
    private maxLogLines = 100;
    private isTTY: boolean;  // TUI有効フラグ
    private quietMode: boolean;  // 詳細ログ抑制フラグ
    private useBlessedView: boolean; // blessedベースのView使用フラグ
    
    // カテゴリ別ログバッファ
    private currentTask: string = '待機中...';
    private llmLogs: string[] = [];
    private errorLogs: string[] = [];
    private warningLogs: string[] = [];
    private generalLogs: string[] = [];
    private maxCategoryLines = 2; // 各カテゴリの最大表示行数を2に減少
    
    // 自動更新タイマー
    private updateTimer: NodeJS.Timeout | null = null;
    
    // トークン統計用のデータ
    private tokenHistory: number[] = []; // 各PRのトークン消費量を記録
    
    // Blessed View インスタンス
    private progressView: ProgressView | null = null;

    constructor(total: number, forceTUI: boolean = false, quietMode: boolean = false, useBlessedView: boolean = false) {
        this.quietMode = quietMode;  // 初期化
        this.useBlessedView = useBlessedView; // Blessed View使用フラグ
        
        // デバッグ: パラメータ確認（process.stdoutを直接使用してloggerの影響を回避）
        process.stdout.write(`🔍 ProgressTracker Debug:\n`);
        process.stdout.write(`  Constructor Parameters:\n`);
        process.stdout.write(`    total: ${total}\n`);
        process.stdout.write(`    forceTUI: ${forceTUI}\n`);
        process.stdout.write(`    quietMode: ${quietMode}\n`);
        process.stdout.write(`    useBlessedView: ${useBlessedView}\n`);
        
        // TTY状態の確認（forceTUIが指定されている場合は強制有効化）
        const isTTY = forceTUI || process.stdout.isTTY || false;
        this.isTTY = isTTY;
        
        process.stdout.write(`  TTY Status:\n`);
        process.stdout.write(`    isTTY: ${isTTY}\n`);
        process.stdout.write(`    process.stdout.isTTY: ${process.stdout.isTTY}\n`);
        
        // Blessed Viewを使用する場合
        if (useBlessedView && isTTY) {
            process.stdout.write('🎨 Attempting to initialize Blessed TUI View...\n');
            try {
                this.progressView = new ProgressView();
                process.stdout.write('✅ Blessed TUI View initialized successfully\n');
            } catch (error) {
                process.stderr.write(`⚠️  Failed to initialize Blessed View, falling back to basic TUI: ${error}\n`);
                this.useBlessedView = false;
            }
        } else if (useBlessedView && !isTTY) {
            process.stdout.write('⚠️  Blessed View requested but TTY not available\n');
        }
        
        
        // quietMode時は画面クリアをスキップ（MainScriptで既にクリア済み）
        // TUIを使用する場合でquietModeでない場合のみ画面をクリア（Blessed使用時は除く）
        if ((isTTY || forceTUI) && !quietMode && !this.useBlessedView) {
            this.clearScreen();
        }
        
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

        const terminalRows = process.stdout.rows || 24;        this.terminalWidth = process.stdout.columns || 80;        const terminalCols = process.stdout.columns || 80;
        
        // Blessed View使用時は初期化メッセージをスキップ
        if (!this.useBlessedView) {
            // quietModeでも初期化情報は表示
            console.log('🖥️  Terminal Status:');
            if (forceTUI && !process.stdout.isTTY) {
                console.log(`   TTY: No (Enhanced progress display enabled)`);
            } else {
                console.log(`   TTY: ${isTTY ? 'Yes (Full TUI enabled)' : 'No (Basic progress display)'}`);
            }
            console.log(`   Rows: ${terminalRows}`);
            console.log(`   Cols: ${terminalCols}`);
            console.log(`   TERM: ${process.env.TERM || 'not set'}`);
        }
        
        this.terminalHeight = terminalRows;
        
        // TTYでない場合はTUIを無効化（ただしforceTUIの場合は続行）
        if (!isTTY) {
            if (!forceTUI) {
                if (!quietMode) {
                    console.log('⚠️  Progress display: Basic mode (no TUI)');
                    console.log('💡 To enable full TUI, run with: docker exec -it <container> node ...');
                }
                return; // TUI機能をスキップ
            } else {
                if (!quietMode) {
                    console.log('✅ Progress display: Enhanced mode (TUI rendering attempted)');
                    console.log('💡 Note: Full TUI requires interactive terminal (docker exec -it)');
                }
            }
        }
        
        // ターミナルリサイズイベント（Blessed使用時はスキップ）
        if (process.stdout.on && !this.useBlessedView) {
            process.stdout.on('resize', () => {
                this.terminalHeight = process.stdout.rows || 24;
                this.terminalWidth = process.stdout.columns || 80;
                this.render();
            });
        }

        // 初期レンダリング（既に画面クリア済み、Blessed使用時は初期データ送信）
        if (this.useBlessedView && this.progressView) {
            this.updateBlessedView();
        } else {
            this.render();
        }
        
        // 1秒ごとに自動更新（TUIモードの場合のみ）
        if (this.isTTY) {
            this.updateTimer = setInterval(() => {
                if (this.useBlessedView && this.progressView) {
                    this.updateBlessedView();
                } else {
                    this.render();
                }
            }, 1000);
        }
    }

    /**
     * Blessed View を更新
     */
    private updateBlessedView(): void {
        if (!this.progressView || this.progressView.destroyed) return;

        const viewData: ViewData = {
            stats: this.stats,
            currentTask: this.currentTask,
            llmLogs: [...this.llmLogs],
            errorLogs: [...this.errorLogs],
            warningLogs: [...this.warningLogs],
            generalLogs: [...this.generalLogs],
            tokenStats: this.calculateTokenStats() || undefined,
            estimatedRemaining: this.getEstimatedRemainingTokens() || undefined
        };

        this.progressView.update(viewData);
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
            if (!this.quietMode) {
                console.log('🔍 ProgressTracker Token Debug:');
                console.log(`   Received tokens:`, tokens);
                console.log(`   promptTokens: ${tokens.promptTokens}`);
                console.log(`   completionTokens: ${tokens.completionTokens}`);
                console.log(`   totalTokens: ${tokens.totalTokens}`);
                console.log(`   summaryTokens: ${tokens.summaryTokens || 0}`);
            }
            
            this.stats.promptTokens += tokens.promptTokens || 0;
            this.stats.completionTokens += tokens.completionTokens || 0;
            this.stats.totalTokens += tokens.totalTokens || 0;
            this.stats.summaryTokens = (this.stats.summaryTokens || 0) + (tokens.summaryTokens || 0);
            
            // トークン履歴に記録（統計計算用）
            this.tokenHistory.push(tokens.totalTokens);
            
            if (!this.quietMode) {
                console.log(`   Total accumulated: ${this.stats.totalTokens}`);
                console.log(`   Summary accumulated: ${this.stats.summaryTokens}`);
                console.log(`   Request count with tokens: ${this.tokenHistory.length}`);
            }
        } else {
            if (!this.quietMode) {
                console.log('⚠️  ProgressTracker: No tokens provided or zero tokens');
            }
        }

        // TTYの場合のみTUI更新
        if (this.isTTY) {
            if (this.useBlessedView && this.progressView) {
                this.updateBlessedView();
            } else {
                this.render();
            }
        } else {
            // 非TTYの場合でも詳細な進捗情報を表示
            const percentage = this.stats.total > 0 
                ? ((this.stats.completed / this.stats.total) * 100).toFixed(1)
                : '0.0';
            const elapsed = this.getElapsed();
            const tokenStats = this.calculateTokenStats();
            
            // 進捗情報
            console.log(
                `🎯 Progress: ${this.stats.completed}/${this.stats.total} (${percentage}%) | ` +
                `⏱️  ${elapsed} | ` +
                `✅ ${this.stats.success} ❌ ${this.stats.failed} ⏭️  ${this.stats.skipped}`
            );
            
            // トークン情報
            if (this.stats.totalTokens > 0) {
                console.log(
                    `🎫 Tokens: ${this.formatTokens(this.stats.totalTokens)} ` +
                    `(Prompt: ${this.formatTokens(this.stats.promptTokens)}, ` +
                    `Completion: ${this.formatTokens(this.stats.completionTokens)})`
                );
            }
            
            // トークン統計（データがあれば）
            if (tokenStats && tokenStats.count > 0) {
                const estimated = this.getEstimatedRemainingTokens();
                console.log(
                    `📊 Avg: ${this.formatTokens(tokenStats.average)}/request | ` +
                    `Min: ${this.formatTokens(tokenStats.min)} | ` +
                    `Max: ${this.formatTokens(tokenStats.max)} | ` +
                    `Est. Remaining: ${estimated ? this.formatTokens(estimated) : 'N/A'}`
                );
            }
        }
    }

    /**
     * ログメッセージを追加（カテゴリ別に振り分け）
     */
    public log(message: string): void {
        const timestamp = new Date().toLocaleTimeString('ja-JP');
        const logLine = `[${timestamp}] ${message}`;
        
        // カテゴリ別に振り分け
        this.categorizeLog(logLine);
        
        // 旧来の統合バッファにも追加（後方互換性）
        this.logBuffer.push(logLine);
        if (this.logBuffer.length > this.maxLogLines) {
            this.logBuffer.shift();
        }

        // Blessed View使用時はログバッファに追加するだけ（updateで表示）
        // TTYの場合のみTUI更新（Blessed使用時は除く）
        if (this.useBlessedView && this.progressView) {
            // update()経由で表示されるので何もしない
        } else if (this.isTTY) {
            this.render();
        } else {
            // 非TTYの場合は直接コンソール出力
            console.log(logLine);
        }
    }

    /**
     * 完了を記録し、自動更新を停止
     */
    public complete(): void {
        // 自動更新タイマーを停止
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        
        // 最終レンダリング
        if (this.useBlessedView && this.progressView) {
            this.updateBlessedView();
        } else if (this.isTTY) {
            this.render();
        }
    }

    /**
     * ログをカテゴリ別に振り分け
     */
    private categorizeLog(logLine: string): void {
        const message = logLine;
        
        // 現在の処理タスク（最優先）
        if (message.includes('🔄 Processing:') || 
            message.includes('Processing repository:') ||
            message.includes('📁 Category')) {
            // タイムスタンプとカラーコードを除去
            const clean = message
                .replace(/\[\d{1,2}:\d{2}:\d{2}\]\s*/, '')
                .replace(/\x1b\[[0-9;]*m/g, '');
            this.currentTask = clean;
        }
        // LLM通信ログ
        else if (message.includes('🚀 LLM') || 
                 message.includes('🚀 OpenAI') || 
                 message.includes('OpenAI request') ||
                 message.includes('attempt') ||
                 message.includes('OpenAI API')) {
            this.llmLogs.push(message);
            if (this.llmLogs.length > 10) { // バッファサイズを増やす
                this.llmLogs.shift();
            }
        }
        // エラーログ
        else if (message.includes('\x1b[31m') || 
                 message.includes('❌') || 
                 message.includes('Error') || 
                 message.includes('Failed') ||
                 message.includes('[ERROR')) {
            // 重複チェック: 同じメッセージが最後に追加されている場合はスキップ
            const lastError = this.errorLogs[this.errorLogs.length - 1];
            if (lastError === message) {
                return; // 重複エラーをスキップ
            }
            this.errorLogs.push(message);
            if (this.errorLogs.length > 10) {
                this.errorLogs.shift();
            }
        }
        // 警告ログ
        else if (message.includes('\x1b[33m') || 
                 message.includes('⚠️') || 
                 message.includes('Warning') || 
                 message.includes('Deprecation') ||
                 message.includes('[WARN')) {
            this.warningLogs.push(message);
            if (this.warningLogs.length > 10) {
                this.warningLogs.shift();
            }
        }
        // INFOログは一般ログへ
        else if (message.includes('[INFO') || 
                 message.includes('🛑') ||
                 message.includes('🔴') ||
                 message.includes('Completion Tag') ||
                 message.includes('File Requests')) {
            this.generalLogs.push(message);
            if (this.generalLogs.length > 50) {
                this.generalLogs.shift();
            }
        }
        // その他の一般ログ
        else {
            this.generalLogs.push(message);
            if (this.generalLogs.length > 50) {
                this.generalLogs.shift();
            }
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
        // ANSI エスケープシーケンスで画面全体をクリア
        process.stdout.write('\x1bc');  // 完全リセット
        process.stdout.write('\x1b[2J'); // 画面クリア
        process.stdout.write('\x1b[3J'); // スクロールバックもクリア
        process.stdout.write('\x1b[H');  // カーソルをホームに移動
        process.stdout.write('\x1b[0m'); // スタイルリセット
    }

    /**
     * 画面を再描画（カテゴリ別表示）
     */
    private render(): void {
        // カーソルをホームに移動
        process.stdout.write('\x1b[H');

        // 表示するカテゴリ数を計算
        const activeSections = [
            { name: '処理中', logs: [this.currentTask], color: '\x1b[36m', lines: 1 },
            { name: 'LLM', logs: this.llmLogs, color: '\x1b[35m', lines: Math.min(this.llmLogs.length, this.maxCategoryLines) },
            { name: 'エラー', logs: this.errorLogs, color: '\x1b[31m', lines: Math.min(this.errorLogs.length, this.maxCategoryLines) },
            { name: '警告', logs: this.warningLogs, color: '\x1b[33m', lines: Math.min(this.warningLogs.length, this.maxCategoryLines) }
        ].filter(section => section.logs.length > 0);

        // カテゴリセクションの高さを計算（ヘッダー1行 + コンテンツ行 + 空行1行）
        const categoryHeight = activeSections.reduce((sum, section) => sum + 1 + section.lines + 1, 0);
        const generalLogHeight = Math.max(3, this.terminalHeight - categoryHeight - this.progressBarHeight - 2);
        
        // アクティブなセクションを描画（セクション間に空行を追加）
        for (let i = 0; i < activeSections.length; i++) {
            const section = activeSections[i];
            this.renderSection(section.name, section.logs, section.color, section.lines);
            // セクション間に空行を追加（最後のセクション以外）
            if (i < activeSections.length - 1) {
                process.stdout.write('\x1b[2K\n');
            }
        }
        
        // 一般ログセクション（残りのスペース）
        if (activeSections.length > 0) {
            // カテゴリがある場合は区切り線を追加
            const separator = '┄'.repeat(this.terminalWidth);
            process.stdout.write('\x1b[2K');
            process.stdout.write('\x1b[90m' + separator + '\x1b[0m\n'); // グレー
        }
        
        const visibleGeneralLogs = this.generalLogs.slice(-generalLogHeight);
        for (let i = 0; i < generalLogHeight; i++) {
            const log = visibleGeneralLogs[i] || '';
            process.stdout.write('\x1b[2K');
            if (log) {
                // タイムスタンプを除去して見やすくする
                const cleanLog = log.replace(/\[\d{1,2}:\d{2}:\d{2}\]\s*/, '');
                process.stdout.write(cleanLog + '\n');
            } else {
                process.stdout.write('\n');
            }
        }

        // 区切り線
        const separator = '═'.repeat(this.terminalWidth);
        process.stdout.write('\x1b[2K');
        process.stdout.write('\x1b[36m' + separator + '\x1b[0m\n');

        // 進捗バー
        this.renderProgressBar();
    }

    /**
     * セクションを描画
     */
    private renderSection(title: string, logs: string[], color: string, maxLines: number = this.maxCategoryLines): void {
        // セクションヘッダー（短く）
        const width = this.terminalWidth;
        const headerText = ` ${title} `;
        const leftPad = '─'.repeat(2);
        const rightPad = '─'.repeat(Math.max(0, width - leftPad.length - headerText.length));
        
        process.stdout.write('\x1b[2K');
        process.stdout.write(color + leftPad + headerText + rightPad + '\x1b[0m\n');
        
        // ログ内容
        const displayLogs = logs.slice(-maxLines);
        for (let i = 0; i < maxLines; i++) {
            const log = displayLogs[i] || '';
            // タイムスタンプとANSIコードを除去
            const cleanLog = log
                .replace(/\[\d{1,2}:\d{2}:\d{2}\]\s*/, '')
                .replace(/\x1b\[[0-9;]*m/g, '');
            
            process.stdout.write('\x1b[2K');
            if (cleanLog) {
                // 長すぎる場合は切り詰め（ターミナル幅に応じて動的調整）
                const maxWidth = this.terminalWidth - 4; // インデント分を引く
                const truncated = cleanLog.length > maxWidth 
                    ? cleanLog.substring(0, maxWidth - 3) + '...'
                    : cleanLog;
                process.stdout.write('  ' + truncated + '\n');
            } else {
                process.stdout.write('\n');
            }
        }
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

        // 各行の情報を構築
        const line1 = `🎯 ${this.stats.completed}/${this.stats.total} (${percentage}%) | ⏱️  ${elapsed} | ETA: ${eta}`;
        const line2 = `✅ Success: ${this.stats.success} | ❌ Failed: ${this.stats.failed} | ⏭️  Skipped: ${this.stats.skipped}`;
        const line3 = `🎫 Tokens - Prompt: ${this.formatTokens(this.stats.promptTokens)} | Completion: ${this.formatTokens(this.stats.completionTokens)} | Total: ${this.formatTokens(this.stats.totalTokens)}`;

        // 1行目: 進捗とETA
        process.stdout.write('\x1b[2K');
        process.stdout.write(this.truncateToWidth(line1) + '\n');

        // 2行目: ステータス
        process.stdout.write('\x1b[2K');
        process.stdout.write(this.truncateToWidth(line2) + '\n');

        // 3行目: トークン消費
        process.stdout.write('\x1b[2K');
        process.stdout.write(this.truncateToWidth(line3) + '\n');

        // 4行目: トークン統計と予測
        process.stdout.write('\x1b[2K');
        const tokenStats = this.calculateTokenStats();
        if (tokenStats && tokenStats.count > 0) {
            const estimated = this.getEstimatedRemainingTokens();
            const line4 = `📊 Avg/Request: ${this.formatTokens(tokenStats.average)} | Min: ${this.formatTokens(tokenStats.min)} | Max: ${this.formatTokens(tokenStats.max)} | Est. Remaining: ${estimated ? this.formatTokens(estimated) : 'N/A'} (${tokenStats.count} requests)`;
            process.stdout.write(this.truncateToWidth(line4) + '\n');
        } else {
            process.stdout.write('📊 統計情報を収集中...\n');
        }
    }

    /**
     * テキストをターミナル幅に合わせて切り詰め
     */
    private truncateToWidth(text: string): string {
        if (text.length <= this.terminalWidth) {
            return text;
        }
        return text.substring(0, this.terminalWidth - 3) + '...';
    }

    /**
     * 終了処理
     */
    public finish(): void {
        // Blessed Viewを破棄
        if (this.progressView) {
            this.progressView.destroy();
            this.progressView = null;
        }
        
        // 最終レンダリング（Blessed使用時はスキップ）
        if (!this.useBlessedView) {
            this.render();
            
            // カーソルを最下部に移動
            process.stdout.write('\n');
        }
        
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
