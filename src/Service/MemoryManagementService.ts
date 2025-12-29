/**
 * メモリ管理サービス
 * メモリ使用量の監視とガベージコレクションの管理
 */

import { BatchProcessingOptions, MemoryUsageInfo } from '../types/BatchProcessTypes.js';
import { consoleLogger } from '../modules/ConsoleLogger.js';

// Node.js型の宣言
declare const process: any;
declare const global: any;

export class MemoryManagementService {
    private options: BatchProcessingOptions;
    private processedCount: number = 0;

    constructor(options: BatchProcessingOptions) {
        this.options = options;
        this.startMemoryMonitoring();
    }

    /**
     * メモリクリーンアップが必要かどうかの判定
     */
    shouldCleanup(): boolean {
        this.processedCount++;
        return this.processedCount % (this.options.memoryCleanupInterval || 5) === 0;
    }

    /**
     * メモリ使用量の取得
     */
    getMemoryUsage(): MemoryUsageInfo {
        const memUsage = process.memoryUsage();
        return {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
        };
    }

    /**
     * ガベージコレクションの実行
     */
    performGarbageCollection(): MemoryUsageInfo | null {
        if (!this.options.enableGarbageCollection || !global.gc) {
            consoleLogger.warn('⚠️ Garbage collection not available. Start Node.js with --expose-gc flag for better memory management.');
            return null;
        }

        const beforeGC = this.getMemoryUsage();
        global.gc();
        const afterGC = this.getMemoryUsage();

        const rssDiff = afterGC.rss - beforeGC.rss;
        const heapDiff = afterGC.heapUsed - beforeGC.heapUsed;

        consoleLogger.log(`🗑️ Memory after GC: RSS=${afterGC.rss}MB (Δ${rssDiff}), Heap=${afterGC.heapUsed}MB (Δ${heapDiff})`);

        // メモリ使用量が高い場合の警告
        if (afterGC.rss > 4000) { // 4GB以上
            consoleLogger.warn(`⚠️ High memory usage detected: ${afterGC.rss}MB RSS`);
        }

        return afterGC;
    }

    /**
     * メモリ監視の開始
     */
    private startMemoryMonitoring(): void {
        // 定期的なメモリ監視（60秒ごと）
        setInterval(() => {
            const memoryInfo = this.getMemoryUsage();
            
            // メモリ使用量が異常に高い場合の警告
            if (memoryInfo.rss > 6000) { // 6GB以上
                consoleLogger.warn(`⚠️ CRITICAL: Very high memory usage detected: ${memoryInfo.rss}MB`);
                consoleLogger.warn(`⚠️ Consider terminating the process to prevent system instability`);
                
                // 緊急ガベージコレクション
                if (this.options.enableGarbageCollection && global.gc) {
                    consoleLogger.log('🚨 Running emergency garbage collection...');
                    global.gc();
                }
            } else if (memoryInfo.rss > 4000) { // 4GB以上
                consoleLogger.warn(`⚠️ High memory usage: ${memoryInfo.rss}MB - monitoring closely`);
            }
        }, 60000); // 60秒ごとにチェック
    }

    /**
     * メモリ情報の表示
     */
    displayMemoryInfo(label: string = 'Current'): void {
        const memoryInfo = this.getMemoryUsage();
        console.log(`💾 ${label} memory usage: RSS=${memoryInfo.rss}MB, Heap=${memoryInfo.heapUsed}/${memoryInfo.heapTotal}MB, External=${memoryInfo.external}MB`);
    }

    /**
     * メモリクリーンアップの実行
     */
    performCleanup(): MemoryUsageInfo | null {
        console.log('🗑️ Running memory management...');
        this.displayMemoryInfo('Before cleanup');
        
        const result = this.performGarbageCollection();
        
        if (result) {
            this.displayMemoryInfo('After cleanup');
        }
        
        return result;
    }

    /**
     * プロセスメモリ制限の確認
     */
    checkMemoryLimits(): void {
        const memoryInfo = this.getMemoryUsage();
        
        // プラットフォーム情報の表示
        if (process.platform === 'linux') {
            console.log(`🔧 Platform: ${process.platform} (containerized environment)`);
        }
        
        console.log(`💾 Initial Memory: RSS=${memoryInfo.rss}MB, Heap=${memoryInfo.heapUsed}MB`);
        console.log(`🗑️ Garbage Collection: ${global.gc ? 'Available' : 'Not Available (use --expose-gc)'}`);
    }
}
