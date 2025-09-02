/**
 * APRログからDiff抽出の実使用例
 */

import { APRLogService } from '../src/Service/APRLogService.js';
import APRLogParser from '../src/aprLogParser.js';

/**
 * 使用例1: APRLogServiceでDiffからファイルパス抽出
 */
async function example1_extractFilePathsFromDiff() {
    const aprLogService = new APRLogService();
    
    const sampleDiff = `
diff --git a/src/main/proto/user.proto b/src/main/proto/user.proto
index 1234567..abcdefg 100644
--- a/src/main/proto/user.proto
+++ b/src/main/proto/user.proto
@@ -10,6 +10,7 @@ message User {
   string name = 1;
   string email = 2;
+  int32 age = 3;
 }

diff --git a/src/main/proto/service.proto b/src/main/proto/service.proto
index 9876543..1a2b3c4 100644
--- a/src/main/proto/service.proto
+++ b/src/main/proto/service.proto
@@ -5,4 +5,5 @@ service UserService {
   rpc GetUser(GetUserRequest) returns (User);
   rpc CreateUser(CreateUserRequest) returns (User);
+  rpc UpdateUser(UpdateUserRequest) returns (User);
 }
    `;
    
    const filePaths = aprLogService.extractFilePathsFromDiff(sampleDiff);
    
    console.log('🔍 抽出されたファイルパス:');
    console.log(filePaths);
    // 出力: ['src/main/proto/user.proto', 'src/main/proto/service.proto']
    
    return filePaths;
}

/**
 * 使用例2: APRLogParserでログ全体からDiff解析
 */
async function example2_analyzeLogDifferences() {
    const aprLogParser = new APRLogParser();
    
    // APRログディレクトリを解析
    const aprLogPath = '/app/apr-logs/example-project/confirmed/PR-123';
    
    try {
        // ログエントリーを解析
        const logData = await aprLogParser.parseLogEntry(aprLogPath);
        
        if (logData) {
            // Diff分析を実行
            const diffAnalysis = aprLogParser.analyzeDifferences(logData);
            
            console.log('📊 Diff分析結果:');
            console.log('   - 総修正回数:', diffAnalysis.totalModifications);
            console.log('   - 影響ファイル数:', diffAnalysis.affectedFiles.length);
            console.log('   - 影響ファイル:', diffAnalysis.affectedFiles);
            
            // 各修正の詳細
            console.log('\n🔧 修正履歴:');
            diffAnalysis.codeChanges.forEach((change, index) => {
                console.log(`   Turn ${change.turn}:`);
                change.changes.forEach(fileChange => {
                    console.log(`     - ${fileChange.filePath}: +${fileChange.addedLines}/-${fileChange.deletedLines}`);
                });
            });
            
            return diffAnalysis;
        }
    } catch (error) {
        console.error('❌ ログ解析エラー:', error.message);
        return null;
    }
}

/**
 * 使用例3: 最終修正のDiff取得
 */
async function example3_getFinalDiff() {
    const aprLogService = new APRLogService();
    const aprLogPath = '/app/apr-logs/example-project/confirmed/PR-123';
    
    try {
        // APRログを解析
        const analysisResult = await aprLogService.analyzeAPRLog(aprLogPath);
        
        if (analysisResult.success && analysisResult.finalModsResult) {
            const finalDiff = analysisResult.finalModsResult.diff;
            const affectedFiles = analysisResult.finalModsResult.aprDiffFiles;
            
            console.log('🎯 最終修正Diff:');
            console.log('   - Diff行数:', finalDiff.split('\n').length);
            console.log('   - 影響ファイル:', affectedFiles);
            console.log('\n📄 Diff内容:');
            console.log(finalDiff);
            
            return {
                diff: finalDiff,
                affectedFiles: affectedFiles
            };
        }
    } catch (error) {
        console.error('❌ 最終Diff取得エラー:', error.message);
        return null;
    }
}

/**
 * 使用例4: 特定ターンのDiff抽出
 */
async function example4_extractTurnSpecificDiff() {
    const aprLogParser = new APRLogParser();
    const aprLogPath = '/app/apr-logs/example-project/confirmed/PR-123';
    
    try {
        const logData = await aprLogParser.parseLogEntry(aprLogPath);
        
        if (logData && logData.modificationHistory) {
            console.log('🔄 各ターンのDiff:');
            
            logData.modificationHistory.forEach((modification, index) => {
                console.log(`\n--- Turn ${modification.turn} ---`);
                console.log(`タイムスタンプ: ${modification.timestamp}`);
                
                // このターンのDiffからファイルパス抽出
                const aprLogService = new APRLogService();
                const filePaths = aprLogService.extractFilePathsFromDiff(modification.diff);
                
                console.log(`影響ファイル: ${filePaths.join(', ')}`);
                console.log(`Diff行数: ${modification.diff.split('\n').length}`);
                
                // Diff内容の一部表示（最初の5行）
                const diffLines = modification.diff.split('\n');
                console.log('Diff内容（先頭5行）:');
                diffLines.slice(0, 5).forEach(line => console.log(`  ${line}`));
                
                if (diffLines.length > 5) {
                    console.log(`  ... (他 ${diffLines.length - 5} 行)`);
                }
            });
            
            return logData.modificationHistory;
        }
    } catch (error) {
        console.error('❌ ターン別Diff抽出エラー:', error.message);
        return [];
    }
}

/**
 * 使用例5: カスタムDiff抽出クラス
 */
class APRDiffExtractor {
    constructor() {
        this.aprLogService = new APRLogService();
        this.aprLogParser = new APRLogParser();
    }
    
    /**
     * APRログからすべてのDiffを抽出
     * @param {string} aprLogPath - APRログディレクトリパス
     * @returns {Promise<Object>} 抽出されたDiff情報
     */
    async extractAllDiffs(aprLogPath) {
        try {
            const logData = await this.aprLogParser.parseLogEntry(aprLogPath);
            
            if (!logData) {
                return { success: false, error: 'ログデータなし' };
            }
            
            const result = {
                success: true,
                totalTurns: logData.turns?.length || 0,
                modifications: [],
                finalDiff: null,
                allAffectedFiles: new Set()
            };
            
            // 各修正のDiffを抽出
            if (logData.modificationHistory) {
                for (const modification of logData.modificationHistory) {
                    const filePaths = this.aprLogService.extractFilePathsFromDiff(modification.diff);
                    
                    result.modifications.push({
                        turn: modification.turn,
                        timestamp: modification.timestamp,
                        diff: modification.diff,
                        affectedFiles: filePaths,
                        diffLineCount: modification.diff.split('\n').length
                    });
                    
                    // 全体の影響ファイルリストに追加
                    filePaths.forEach(file => result.allAffectedFiles.add(file));
                }
            }
            
            // 最終修正のDiff
            if (logData.lastModification) {
                result.finalDiff = {
                    diff: logData.lastModification.diff,
                    affectedFiles: this.aprLogService.extractFilePathsFromDiff(logData.lastModification.diff),
                    diffLineCount: logData.lastModification.diff.split('\n').length
                };
            }
            
            result.allAffectedFiles = Array.from(result.allAffectedFiles);
            
            return result;
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 特定のファイルタイプのDiffのみ抽出
     * @param {string} aprLogPath - APRログディレクトリパス
     * @param {string} fileExtension - ファイル拡張子（例: '.proto'）
     * @returns {Promise<Object>} フィルタされたDiff情報
     */
    async extractDiffsByFileType(aprLogPath, fileExtension) {
        const allDiffs = await this.extractAllDiffs(aprLogPath);
        
        if (!allDiffs.success) {
            return allDiffs;
        }
        
        // ファイル拡張子でフィルタリング
        const filteredModifications = allDiffs.modifications.map(mod => ({
            ...mod,
            affectedFiles: mod.affectedFiles.filter(file => file.endsWith(fileExtension)),
            diff: this.filterDiffByFileType(mod.diff, fileExtension)
        })).filter(mod => mod.affectedFiles.length > 0);
        
        const filteredFinalDiff = allDiffs.finalDiff ? {
            ...allDiffs.finalDiff,
            affectedFiles: allDiffs.finalDiff.affectedFiles.filter(file => file.endsWith(fileExtension)),
            diff: this.filterDiffByFileType(allDiffs.finalDiff.diff, fileExtension)
        } : null;
        
        return {
            ...allDiffs,
            modifications: filteredModifications,
            finalDiff: filteredFinalDiff,
            allAffectedFiles: allDiffs.allAffectedFiles.filter(file => file.endsWith(fileExtension))
        };
    }
    
    /**
     * Diff内容を特定のファイルタイプでフィルタリング
     * @param {string} diffText - 元のDiff文字列
     * @param {string} fileExtension - ファイル拡張子
     * @returns {string} フィルタされたDiff文字列
     */
    filterDiffByFileType(diffText, fileExtension) {
        const lines = diffText.split('\n');
        const filteredLines = [];
        let inTargetFile = false;
        
        for (const line of lines) {
            if (line.startsWith('diff --git')) {
                inTargetFile = line.includes(fileExtension);
            }
            
            if (inTargetFile) {
                filteredLines.push(line);
            }
            
            // 次のファイルのdiffが始まったらリセット
            if (line.startsWith('diff --git') && !line.includes(fileExtension)) {
                inTargetFile = false;
            }
        }
        
        return filteredLines.join('\n');
    }
}

// エクスポート
export {
    example1_extractFilePathsFromDiff,
    example2_analyzeLogDifferences,
    example3_getFinalDiff,
    example4_extractTurnSpecificDiff,
    APRDiffExtractor
};

// 実行例
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🧪 APRログDiff抽出機能テスト');
    console.log('================================\n');
    
    await example1_extractFilePathsFromDiff();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await example2_analyzeLogDifferences();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await example3_getFinalDiff();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await example4_extractTurnSpecificDiff();
}
