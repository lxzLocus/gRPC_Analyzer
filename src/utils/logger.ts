/**
 * Global Logger with Quiet Mode Support
 * quietModeが有効な場合、console.logを抑制
 */

let quietMode = false;
let originalConsoleLog: typeof console.log;
let originalConsoleError: typeof console.error;
let originalConsoleWarn: typeof console.warn;
let progressTrackerInstance: any = null; // ProgressTrackerのインスタンスを保持

/**
 * ProgressTrackerインスタンスを設定
 */
export function setProgressTracker(tracker: any): void {
    progressTrackerInstance = tracker;
}

/**
 * Quiet Modeを有効化
 */
export function enableQuietMode(): void {
    if (quietMode) return;
    
    quietMode = true;
    
    // 元のconsole関数を保存
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    
    // console.logを選択的に抑制（重要なログのみ残す）
    console.log = (...args: any[]) => {
        const message = args.join(' ');
        // 重要なメッセージは表示
        if (
            // 起動・完了メッセージ（最小限）
            message.includes('🚀') ||
            message.includes('🎉') ||
            message.includes('🎮') ||
            message.includes('📊 Found') ||
            message.includes('📊 Total Pull Requests') ||
            
            // エラー・警告
            message.includes('❌') ||
            message.includes('⚠️') ||
            message.includes('Critical error') ||
            message.includes('Error') ||
            
            // プログレスバー関連（━で始まる）
            message.includes('━━━') ||
            message.includes('🎯 Progress:') ||
            
            // ProgressTrackerからのログ（タイムスタンプ付き）
            message.match(/^\[\d{1,2}:\d{2}:\d{2}\]/) ||
            
            // 最終統計
            message.includes('Success Rate:') ||
            message.includes('Total Duration:') ||
            
            // デバッグ: 初期化関連とTUI
            message.includes('Terminal Status') ||
            message.includes('TUI') ||
            message.includes('Progress display')
        ) {
            originalConsoleLog(...args);
        }
        // その他の詳細ログは抑制
    };
    
    // console.errorとconsole.warnもquietMode時は抑制
    console.error = (...args: any[]) => {
        const message = args.join(' ');
        const firstLine = message.split('\n')[0];
        
        // ProgressTrackerが利用可能ならログバッファに追加
        if (progressTrackerInstance && progressTrackerInstance.log) {
            progressTrackerInstance.log(`❌ ${firstLine}`);
        } else if (message.includes('Critical') || message.includes('Fatal')) {
            // Criticalエラーは表示
            originalConsoleError(...args);
        } else {
            // その他は1行のみ
            originalConsoleError(firstLine);
        }
    };
    
    console.warn = (...args: any[]) => {
        const message = args.join(' ');
        const firstLine = message.split('\n')[0];
        
        // ProgressTrackerが利用可能ならログバッファに追加
        if (progressTrackerInstance && progressTrackerInstance.log) {
            progressTrackerInstance.log(`⚠️  ${firstLine}`);
        } else {
            // その他は1行のみ
            originalConsoleWarn(firstLine);
        }
    };
}

/**
 * Quiet Modeを無効化
 */
export function disableQuietMode(): void {
    if (!quietMode) return;
    
    quietMode = false;
    
    // 元のconsole関数を復元
    if (originalConsoleLog) {
        console.log = originalConsoleLog;
    }
    if (originalConsoleError) {
        console.error = originalConsoleError;
    }
    if (originalConsoleWarn) {
        console.warn = originalConsoleWarn;
    }
}

/**
 * Quiet Modeの状態を取得
 */
export function isQuietMode(): boolean {
    return quietMode;
}

/**
 * Quiet Mode時でも強制的にログを出力
 */
export function forceLog(...args: any[]): void {
    if (originalConsoleLog) {
        originalConsoleLog(...args);
    } else {
        console.log(...args);
    }
}

export default {
    enableQuietMode,
    disableQuietMode,
    isQuietMode,
    forceLog,
    setProgressTracker
};
