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
    
    // console.logを選択的に抑制またはProgressTrackerにリダイレクト
    console.log = (...args: any[]) => {
        const message = args.join(' ');
        
        // ProgressTrackerが利用可能な場合はログバッファに追加（Blessed TUI用）
        if (progressTrackerInstance && progressTrackerInstance.log) {
            // ProgressTrackerのログメソッドを使用（TUIのログ領域に表示）
            progressTrackerInstance.log(message);
            return;
        }
        
        // ProgressTrackerがない場合は重要なメッセージのみ表示
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
            
            // 最終統計
            message.includes('Success Rate:') ||
            message.includes('Total Duration:') ||
            
            // 初期化メッセージ
            message.includes('Controller loaded') ||
            message.includes('BatchProcessController initialized')
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
            return;
        }
        
        if (message.includes('Critical') || message.includes('Fatal')) {
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
            // カラーコード: 警告は黄色
            progressTrackerInstance.log(`\x1b[33m⚠️  ${firstLine}\x1b[0m`);
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
