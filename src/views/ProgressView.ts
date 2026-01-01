/**
 * Progress View using Blessed TUI Library (Simplified)
 * グラフなし、シンプルなテキストベースTUI
 */

import blessed from 'blessed';
import { ProgressStats, TokenStats } from '../modules/ProgressTracker.js';

export interface ViewData {
    stats: ProgressStats;
    currentTask: string;
    llmLogs: string[];
    errorLogs: string[];
    warningLogs: string[];
    generalLogs: string[];
    tokenStats?: TokenStats;
    estimatedRemaining?: number;
}

export class ProgressView {
    private screen: blessed.Widgets.Screen;
    private statusBox: blessed.Widgets.BoxElement;
    private progressBar: blessed.Widgets.ProgressBarElement;
    private statsBox: blessed.Widgets.BoxElement;
    private llmLog: blessed.Widgets.Log;
    private errorLog: blessed.Widgets.Log;
    private warningLog: blessed.Widgets.Log;
    private generalLog: blessed.Widgets.Log;
    
    private isDestroyed: boolean = false;

    constructor() {
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'APR Processing Monitor',
            fullUnicode: true,  // Unicode絵文字を正しく表示
            dockBorders: true,
            autoPadding: true
        });

        // ステータス（左上）
        this.statusBox = blessed.box({
            parent: this.screen,
            top: 0,
            left: 0,
            width: '70%',
            height: 3,
            label: ' Status ',
            content: 'Initializing...',
            tags: true,
            border: { type: 'line' },
            style: { border: { fg: 'cyan' } }
        });

        // プログレスバー（右上）
        this.progressBar = blessed.progressbar({
            parent: this.screen,
            top: 0,
            left: '70%',
            width: '30%',
            height: 3,
            label: ' Progress ',
            border: { type: 'line' },
            style: {
                border: { fg: 'cyan' },
                bar: { bg: 'green' }
            },
            filled: 0
        });

        // LLMログ（左上）
        this.llmLog = blessed.log({
            parent: this.screen,
            top: 3,
            left: 0,
            width: '50%',
            height: '50%',
            label: ' LLM ',
            tags: true,
            border: { type: 'line' },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: { ch: ' ', style: { bg: 'blue' } },
            style: { border: { fg: 'blue' } }
        });

        // エラーログ（右上）
        this.errorLog = blessed.log({
            parent: this.screen,
            top: 3,
            left: '50%',
            width: '50%',
            height: '50%',
            label: ' Errors ',
            tags: true,
            border: { type: 'line' },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: { ch: ' ', style: { bg: 'red' } },
            style: { border: { fg: 'red' } }
        });

        // 警告ログ（左下）
        this.warningLog = blessed.log({
            parent: this.screen,
            top: '50%+3',
            left: 0,
            width: '50%',
            height: '50%-10',
            label: ' Warnings ',
            tags: true,
            border: { type: 'line' },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: { ch: ' ', style: { bg: 'yellow' } },
            style: { border: { fg: 'yellow' } }
        });

        // 一般ログ（右下）
        this.generalLog = blessed.log({
            parent: this.screen,
            top: '50%+3',
            left: '50%',
            width: '50%',
            height: '50%-10',
            label: ' General ',
            tags: true,
            border: { type: 'line' },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: { ch: ' ', style: { bg: 'white' } },
            style: { border: { fg: 'white' } }
        });

        // 統計情報（ショートカットの上）
        this.statsBox = blessed.box({
            parent: this.screen,
            bottom: 3,
            left: 0,
            width: '100%',
            height: 4,
            label: ' Statistics ',
            content: '',
            tags: true,
            border: { type: 'line' },
            style: { border: { fg: 'green' } }
        });

        // ショートカット（最下部）
        blessed.box({
            parent: this.screen,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 3,
            label: ' Shortcuts ',
            content: '{cyan-fg}[Q]{/cyan-fg} Quit  {cyan-fg}[UP/DOWN]{/cyan-fg} Scroll  {cyan-fg}[H]{/cyan-fg} Help  {cyan-fg}[R]{/cyan-fg} Refresh',
            tags: true,
            border: { type: 'line' },
            style: { border: { fg: 'magenta' } }
        });

        // キーバインド
        this.screen.key(['escape', 'q', 'C-c'], () => process.exit(0));
        this.screen.key(['r'], () => this.screen.render());
        this.screen.key(['h', '?'], () => this.showHelp());
        this.screen.key(['up'], () => { this.generalLog.scroll(-1); this.screen.render(); });
        this.screen.key(['down'], () => { this.generalLog.scroll(1); this.screen.render(); });

        this.screen.render();
    }

    private stripEmojis(text: string): string {
        return text
            // ANSIエスケープシーケンスを削除
            .replace(/\x1b\[[0-9;]*m/g, '')
            // 絵文字ブロック（包括的）
            .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
            // 追加の絵文字ブロック
            .replace(/[\u{2600}-\u{27BF}]/gu, '')
            // 異体字セレクタ
            .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
            // ゼロ幅文字
            .replace(/[\u{200D}\u{200C}]/gu, '')
            // 一般的な絵文字（フォールバック）
            .replace(/\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83D[\uDE80-\uDEFF]|[\u2600-\u27BF]/g, '')
            // Box Drawing Characters (囲み線)
            .replace(/[\u2500-\u257F]/g, '')
            // Block Elements
            .replace(/[\u2580-\u259F]/g, '')
            // 複数のスペースを1つに
            .replace(/ {2,}/g, ' ')
            .trim();
    }

    public update(data: ViewData): void {
        if (this.isDestroyed) return;

        try {
            const percentage = ((data.stats.completed / data.stats.total) * 100).toFixed(1);
            const elapsed = this.formatElapsed(Date.now() - data.stats.startTime);
            const eta = this.calculateETA(data.stats);

            this.statusBox.setContent(
                `{cyan-fg}Task:{/cyan-fg} {bold}${data.currentTask}{/bold}\n` +
                `{cyan-fg}Progress:{/cyan-fg} ${data.stats.completed}/${data.stats.total} ({green-fg}${percentage}%{/green-fg}) | ` +
                `{cyan-fg}Elapsed:{/cyan-fg} ${elapsed} | {cyan-fg}ETA:{/cyan-fg} ${eta}`
            );

            this.progressBar.setProgress(parseFloat(percentage));

            const statsText = this.formatTokenStats(data.stats, data.tokenStats, data.estimatedRemaining);
            this.statsBox.setContent(statsText);

            this.updateCategoryLogs(data);
            this.screen.render();
        } catch (error) {
            console.error('View update error:', error);
        }
    }

    private updateCategoryLogs(data: ViewData): void {
        data.llmLogs.slice(-10).forEach(log => {
            const cleaned = this.stripEmojis(log);
            this.llmLog.log(`{blue-fg}${cleaned}{/blue-fg}`);
        });

        data.errorLogs.slice(-10).forEach(log => {
            const cleaned = this.stripEmojis(log);
            this.errorLog.log(`{red-fg}${cleaned}{/red-fg}`);
        });

        data.warningLogs.slice(-10).forEach(log => {
            const cleaned = this.stripEmojis(log);
            this.warningLog.log(`{yellow-fg}${cleaned}{/yellow-fg}`);
        });

        data.generalLogs.slice(-10).forEach(log => {
            const cleaned = this.stripEmojis(log);
            this.generalLog.log(cleaned);
        });
    }

    private formatTokenStats(stats: ProgressStats, tokenStats?: TokenStats, estimatedRemaining?: number): string {
        const parts: string[] = [];

        parts.push(
            `{green-fg}Success:{/green-fg} ${stats.success}  ` +
            `{red-fg}Failed:{/red-fg} ${stats.failed}  ` +
            `{yellow-fg}Skipped:{/yellow-fg} ${stats.skipped}`
        );

        if (stats.totalTokens > 0) {
            parts.push(
                `{cyan-fg}Tokens:{/cyan-fg} ${this.formatTokens(stats.totalTokens)} total  ` +
                `{cyan-fg}Prompt:{/cyan-fg} ${this.formatTokens(stats.promptTokens)}  ` +
                `{cyan-fg}Completion:{/cyan-fg} ${this.formatTokens(stats.completionTokens)}`
            );
        }

        return parts.join('\n');
    }

    private formatTokens(tokens: number): string {
        if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
        if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
        return tokens.toString();
    }

    private formatElapsed(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    private calculateETA(stats: ProgressStats): string {
        if (stats.completed === 0) return 'N/A';
        const elapsed = Date.now() - stats.startTime;
        const avgTime = elapsed / stats.completed;
        const remaining = stats.total - stats.completed;
        const etaMs = avgTime * remaining;
        return this.formatElapsed(etaMs);
    }

    private showHelp(): void {
        const helpBox = blessed.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: '60%',
            height: '60%',
            label: ' Help ',
            content:
                '{cyan-fg}{bold}Keyboard Shortcuts:{/bold}{/cyan-fg}\n\n' +
                '{green-fg}[Q]{/green-fg} or {green-fg}[ESC]{/green-fg} - Quit application\n' +
                '{green-fg}[R]{/green-fg} - Refresh screen\n' +
                '{green-fg}[H]{/green-fg} or {green-fg}[?]{/green-fg} - Show this help\n' +
                '{green-fg}[UP/DOWN]{/green-fg} - Scroll logs\n\n' +
                'Press any key to close this help...',
            tags: true,
            border: { type: 'line' },
            style: { border: { fg: 'yellow' } }
        });

        helpBox.focus();
        helpBox.key(['escape', 'enter', 'space'], () => {
            helpBox.destroy();
            this.screen.render();
        });

        this.screen.render();
    }

    public destroy(): void {
        if (this.isDestroyed) return;
        this.isDestroyed = true;
        this.screen.destroy();
    }

    public get destroyed(): boolean {
        return this.isDestroyed;
    }
}
