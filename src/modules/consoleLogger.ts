export type ConsoleLike = Pick<Console, 'log' | 'info' | 'warn' | 'error'>;

class ConsoleLogger {
    private enabled: boolean;
    private readonly target: ConsoleLike;
    private readonly prefix: string;

    constructor(enabled = true, target: ConsoleLike = console, prefix = '') {
        this.enabled = enabled;
        this.target = target;
        this.prefix = prefix;
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    log(...args: any[]): void {
        if (!this.enabled) return;
        // 通常ログは白色（デフォルト）
        const coloredArgs = this.withColor(args, '\x1b[37m');
        this.target.log(...this.withPrefix(coloredArgs));
    }

    info(...args: any[]): void {
        this.log(...args);
    }

    warn(...args: any[]): void {
        if (!this.enabled) return;
        // 警告は黄色
        const coloredArgs = this.withColor(args, '\x1b[33m');
        this.target.warn(...this.withPrefix(coloredArgs));
    }

    error(...args: any[]): void {
        // Do not suppress errors - エラーは赤色
        const coloredArgs = this.withColor(args, '\x1b[31m');
        this.target.error(...this.withPrefix(coloredArgs));
    }

    forceLog(...args: any[]): void {
        this.target.log(...this.withPrefix(args));
    }

    private withPrefix(args: any[]): any[] {
        return this.prefix ? [this.prefix, ...args] : args;
    }

    private withColor(args: any[], colorCode: string): any[] {
        // 最初の引数にカラーコードを追加し、最後にリセットコードを追加
        if (args.length === 0) return args;
        const colored = [...args];
        colored[0] = `${colorCode}${colored[0]}`;
        colored[colored.length - 1] = `${colored[colored.length - 1]}\x1b[0m`;
        return colored;
    }
}

const consoleLogger = new ConsoleLogger(true);

export { ConsoleLogger, consoleLogger };
export function configureConsoleLogger(enabled: boolean): void {
    consoleLogger.setEnabled(enabled);
}
export default consoleLogger;
