#!/usr/bin/env node
/**
 * filtered_confirmed内の03_fileChanges.txt内の.protoと*.pb.*ファイルを
 * merge/commit_snapshotからpremergeへ上書きコピー
 */

import fs from 'fs';
import path from 'path';

const TARGET_DIR = '/app/dataset/filtered_confirmed';

interface CopyStats {
    totalPRs: number;
    processedPRs: number;
    totalFilesUpdated: number;
    errors: string[];
    details: Array<{
        prPath: string;
        protoFiles: string[];
        stubFiles: string[];
        source: 'merge' | 'commit_snapshot';
    }>;
}

const stats: CopyStats = {
    totalPRs: 0,
    processedPRs: 0,
    totalFilesUpdated: 0,
    errors: [],
    details: []
};

/**
 * 03_fileChanges.txtを読み取り、.protoと*.pb.*ファイルを抽出
 */
function extractProtoAndStubFiles(fileChangesPath: string): { protoFiles: string[], stubFiles: string[] } {
    if (!fs.existsSync(fileChangesPath)) {
        return { protoFiles: [], stubFiles: [] };
    }
    
    const content = fs.readFileSync(fileChangesPath, 'utf-8');
    const files: string[] = JSON.parse(content);
    
    const protoFiles: string[] = [];
    const stubFiles: string[] = [];
    
    for (const file of files) {
        if (file.endsWith('.proto')) {
            protoFiles.push(file);
        } else if (file.match(/\.pb\.(go|cc|h|java|py|rb|cs|php|js|ts)$/)) {
            stubFiles.push(file);
        }
    }
    
    return { protoFiles, stubFiles };
}

/**
 * mergeまたはcommit_snapshotディレクトリを探す
 */
function findMergeOrSnapshotDir(prDir: string): { dir: string, type: 'merge' | 'commit_snapshot' } | null {
    const items = fs.readdirSync(prDir);
    
    // mergeディレクトリを優先
    const mergeDir = items.find(item => 
        item.startsWith('merge') && fs.statSync(path.join(prDir, item)).isDirectory()
    );
    
    if (mergeDir) {
        return { dir: path.join(prDir, mergeDir), type: 'merge' };
    }
    
    // commit_snapshotディレクトリを探す
    const snapshotDir = items.find(item => 
        item.startsWith('commit_snapshot_') && fs.statSync(path.join(prDir, item)).isDirectory()
    );
    
    if (snapshotDir) {
        return { dir: path.join(prDir, snapshotDir), type: 'commit_snapshot' };
    }
    
    return null;
}

/**
 * premergeディレクトリを探す
 */
function findPremergeDir(prDir: string): string | null {
    const items = fs.readdirSync(prDir);
    const premergeDir = items.find(item => 
        item.startsWith('premerge') && fs.statSync(path.join(prDir, item)).isDirectory()
    );
    
    return premergeDir ? path.join(prDir, premergeDir) : null;
}

/**
 * ファイルを上書きコピー
 */
function copyFile(sourcePath: string, targetPath: string): boolean {
    try {
        if (!fs.existsSync(sourcePath)) {
            console.log(`  ⚠️  ソースファイル不在: ${sourcePath}`);
            return false;
        }
        
        // ターゲットディレクトリを作成
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        fs.copyFileSync(sourcePath, targetPath);
        return true;
    } catch (error) {
        console.error(`  ❌ コピー失敗: ${sourcePath} → ${targetPath}`, error);
        return false;
    }
}

/**
 * PRディレクトリ内のprotoとスタブファイルを更新
 */
function updateProtoAndStubFiles(prDir: string): void {
    const fileChangesPath = path.join(prDir, '03_fileChanges.txt');
    const { protoFiles, stubFiles } = extractProtoAndStubFiles(fileChangesPath);
    
    if (protoFiles.length === 0 && stubFiles.length === 0) {
        console.log(`  ℹ️  更新対象なし`);
        return;
    }
    
    // merge/commit_snapshotディレクトリを探す
    const mergeInfo = findMergeOrSnapshotDir(prDir);
    if (!mergeInfo) {
        console.log(`  ⚠️  merge/commit_snapshotディレクトリが見つかりません`);
        stats.errors.push(`${prDir}: merge/commit_snapshot not found`);
        return;
    }
    
    // premergeディレクトリを探す
    const premergeDir = findPremergeDir(prDir);
    if (!premergeDir) {
        console.log(`  ⚠️  premergeディレクトリが見つかりません`);
        stats.errors.push(`${prDir}: premerge not found`);
        return;
    }
    
    console.log(`  📁 ソース: ${mergeInfo.type} (${path.basename(mergeInfo.dir)})`);
    console.log(`  📁 ターゲット: ${path.basename(premergeDir)}`);
    console.log(`  📄 Proto: ${protoFiles.length}件, Stub: ${stubFiles.length}件`);
    
    let updatedCount = 0;
    const allFiles = [...protoFiles, ...stubFiles];
    
    for (const file of allFiles) {
        const sourcePath = path.join(mergeInfo.dir, file);
        const targetPath = path.join(premergeDir, file);
        
        if (copyFile(sourcePath, targetPath)) {
            updatedCount++;
            console.log(`    ✅ ${file}`);
        }
    }
    
    stats.totalFilesUpdated += updatedCount;
    stats.processedPRs++;
    
    stats.details.push({
        prPath: prDir,
        protoFiles,
        stubFiles,
        source: mergeInfo.type
    });
    
    console.log(`  🎉 ${updatedCount}/${allFiles.length} ファイル更新完了`);
}

/**
 * ディレクトリを再帰的に走査してPRディレクトリを処理
 */
function processDirectory(dir: string): void {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        
        if (!stat.isDirectory()) continue;
        
        // 03_fileChanges.txtが存在すればPRディレクトリ
        const fileChangesPath = path.join(itemPath, '03_fileChanges.txt');
        if (fs.existsSync(fileChangesPath)) {
            stats.totalPRs++;
            console.log(`\n📦 [${stats.totalPRs}] ${itemPath.replace(TARGET_DIR + '/', '')}`);
            updateProtoAndStubFiles(itemPath);
        } else {
            // 再帰的に探索
            processDirectory(itemPath);
        }
    }
}

/**
 * メイン処理
 */
function main() {
    console.log('='.repeat(80));
    console.log('🔧 Proto/Stub Update Tool');
    console.log('='.repeat(80));
    console.log();
    console.log('📋 Proto/Stubファイルの更新');
    console.log(`   Target: ${TARGET_DIR}`);
    console.log('   merge/commit_snapshot → premerge');
    console.log();
    
    processDirectory(TARGET_DIR);
    
    // 結果レポート
    console.log();
    console.log('='.repeat(80));
    console.log('📊 処理結果サマリー');
    console.log('='.repeat(80));
    console.log(`総PR数:              ${stats.totalPRs}`);
    console.log(`処理成功PR数:        ${stats.processedPRs}`);
    console.log(`更新ファイル総数:    ${stats.totalFilesUpdated}`);
    console.log(`エラー数:            ${stats.errors.length}`);
    console.log();
    
    if (stats.errors.length > 0) {
        console.log('⚠️  エラー詳細:');
        stats.errors.forEach((error, i) => {
            console.log(`  ${i + 1}. ${error}`);
        });
        console.log();
    }
    
    // 詳細レポートをJSON出力
    const reportPath = '/app/output/proto_stub_update_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
    console.log(`📄 詳細レポート: ${reportPath}`);
    console.log();
    
    // サマリー統計
    const protoCount = stats.details.reduce((sum, d) => sum + d.protoFiles.length, 0);
    const stubCount = stats.details.reduce((sum, d) => sum + d.stubFiles.length, 0);
    const mergeSource = stats.details.filter(d => d.source === 'merge').length;
    const snapshotSource = stats.details.filter(d => d.source === 'commit_snapshot').length;
    
    console.log('📈 ファイル種別統計:');
    console.log(`   Protoファイル:       ${protoCount}`);
    console.log(`   Stubファイル:        ${stubCount}`);
    console.log();
    console.log('📈 ソース種別統計:');
    console.log(`   mergeから更新:       ${mergeSource} PR`);
    console.log(`   commit_snapshotから: ${snapshotSource} PR`);
    console.log();
    
    console.log('✅ 完了！');
    console.log(`   ${TARGET_DIR} の準備ができました。`);
    console.log(`   premergeディレクトリはproto+stub更新済みで、手書きコードのみ修正が必要です。`);
}

// 実行
main();
