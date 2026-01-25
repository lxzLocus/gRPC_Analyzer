/**
 * filtered_fewChangedデータセットを分析し、以下を調査:
 * 1. protoファイルのみ変更（スタブ未更新）のケース数
 * 2. proto + スタブ両方変更（スタブ更新済み）のケース数
 * 3. スタブのみ変更（protoなし）のケース数
 * 
 * 目的: LLMがno-opになる原因（proto変更だがスタブ未更新）を特定
 */

import fs from 'fs';
import path from 'path';

const datasetDir = '/app/dataset/filtered_fewChanged';

// スタブコード判定パターン
const STUB_PATTERNS = [
    '.pb.go',      // Go
    '.pb.cc',      // C++
    '.pb.h',       // C++
    '_pb2.py',     // Python
    '.pb2.py',     // Python (alternative)
    '_pb.rb',      // Ruby
    '.pb.swift',   // Swift
    '.pb.m',       // Objective-C
    '.pb-c.c',     // C
    '.pb-c.h',     // C
    '.pb.rs',      // Rust
    '_grpc.pb.go', // Go gRPC
    '_grpc_pb2.py' // Python gRPC
];

interface PRAnalysis {
    projectName: string;
    category: string;
    prName: string;
    fullPath: string;
    hasProtoChanges: boolean;
    hasStubChanges: boolean;
    protoFiles: string[];
    stubFiles: string[];
    totalChangedFiles: number;
    classification: 'proto_only' | 'stub_only' | 'both' | 'neither';
}

function isStubFile(filePath: string): boolean {
    return STUB_PATTERNS.some(pattern => filePath.includes(pattern));
}

function analyzePR(prPath: string, projectName: string, category: string, prName: string): PRAnalysis | null {
    const fileChangesPath = path.join(prPath, '03_fileChanges.txt');
    
    if (!fs.existsSync(fileChangesPath)) {
        console.warn(`⚠️  03_fileChanges.txt not found: ${prPath}`);
        return null;
    }

    let changedFiles: string[] = [];
    try {
        const content = fs.readFileSync(fileChangesPath, 'utf8');
        changedFiles = JSON.parse(content);
    } catch (err: any) {
        console.error(`❌ Error parsing 03_fileChanges.txt: ${fileChangesPath}`, err.message);
        return null;
    }

    const protoFiles = changedFiles.filter(f => f.endsWith('.proto'));
    const stubFiles = changedFiles.filter(f => isStubFile(f));

    const hasProtoChanges = protoFiles.length > 0;
    const hasStubChanges = stubFiles.length > 0;

    let classification: 'proto_only' | 'stub_only' | 'both' | 'neither';
    if (hasProtoChanges && hasStubChanges) {
        classification = 'both';
    } else if (hasProtoChanges && !hasStubChanges) {
        classification = 'proto_only';
    } else if (!hasProtoChanges && hasStubChanges) {
        classification = 'stub_only';
    } else {
        classification = 'neither';
    }

    return {
        projectName,
        category,
        prName,
        fullPath: prPath,
        hasProtoChanges,
        hasStubChanges,
        protoFiles,
        stubFiles,
        totalChangedFiles: changedFiles.length,
        classification
    };
}

async function main() {
    console.log('🔍 Analyzing filtered_fewChanged dataset for proto/stub update patterns...\n');

    const results: PRAnalysis[] = [];
    
    const projectDirs = fs.readdirSync(datasetDir).filter(dir => 
        fs.statSync(path.join(datasetDir, dir)).isDirectory()
    );

    for (const projectName of projectDirs) {
        const projectPath = path.join(datasetDir, projectName);
        const categoryDirs = fs.readdirSync(projectPath).filter(dir =>
            fs.statSync(path.join(projectPath, dir)).isDirectory()
        );

        for (const category of categoryDirs) {
            const categoryPath = path.join(projectPath, category);
            const prDirs = fs.readdirSync(categoryPath).filter(dir =>
                fs.statSync(path.join(categoryPath, dir)).isDirectory()
            );

            for (const prName of prDirs) {
                const prPath = path.join(categoryPath, prName);
                const analysis = analyzePR(prPath, projectName, category, prName);
                if (analysis) {
                    results.push(analysis);
                }
            }
        }
    }

    // 統計計算
    const protoOnlyCount = results.filter(r => r.classification === 'proto_only').length;
    const stubOnlyCount = results.filter(r => r.classification === 'stub_only').length;
    const bothCount = results.filter(r => r.classification === 'both').length;
    const neitherCount = results.filter(r => r.classification === 'neither').length;
    const total = results.length;

    // レポート出力
    console.log('═'.repeat(80));
    console.log('📊 ANALYSIS RESULTS');
    console.log('═'.repeat(80));
    console.log(`\n✅ Total PRs analyzed: ${total}\n`);

    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ Classification Breakdown                                │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ 🔴 Proto ONLY (stub未更新)         : ${protoOnlyCount.toString().padStart(3)} (${((protoOnlyCount/total)*100).toFixed(1)}%) │`);
    console.log(`│ 🟢 Both Proto + Stub (更新済み)    : ${bothCount.toString().padStart(3)} (${((bothCount/total)*100).toFixed(1)}%) │`);
    console.log(`│ 🟡 Stub ONLY (protoなし)           : ${stubOnlyCount.toString().padStart(3)} (${((stubOnlyCount/total)*100).toFixed(1)}%) │`);
    console.log(`│ ⚪ Neither (proto/stub変更なし)    : ${neitherCount.toString().padStart(3)} (${((neitherCount/total)*100).toFixed(1)}%) │`);
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // 問題ケースの詳細
    console.log('🔴 Proto ONLY Cases (LLMがno-opになる可能性が高い):');
    console.log('─'.repeat(80));
    const protoOnlyCases = results.filter(r => r.classification === 'proto_only');
    if (protoOnlyCases.length > 0) {
        protoOnlyCases.forEach((pr, idx) => {
            console.log(`${idx + 1}. ${pr.projectName}/${pr.category}/${pr.prName}`);
            console.log(`   Proto files (${pr.protoFiles.length}): ${pr.protoFiles.slice(0, 3).join(', ')}${pr.protoFiles.length > 3 ? '...' : ''}`);
            console.log(`   Total changed files: ${pr.totalChangedFiles}`);
        });
    } else {
        console.log('  (None found)');
    }

    console.log('\n🟢 Both Proto + Stub Cases (正常なケース):');
    console.log('─'.repeat(80));
    const bothCases = results.filter(r => r.classification === 'both');
    if (bothCases.length > 0) {
        bothCases.slice(0, 5).forEach((pr, idx) => {
            console.log(`${idx + 1}. ${pr.projectName}/${pr.category}/${pr.prName}`);
            console.log(`   Proto files: ${pr.protoFiles.length}, Stub files: ${pr.stubFiles.length}`);
        });
        if (bothCases.length > 5) {
            console.log(`   ... and ${bothCases.length - 5} more`);
        }
    } else {
        console.log('  (None found)');
    }

    // プロジェクト別統計
    console.log('\n📁 Project-wise Breakdown:');
    console.log('─'.repeat(80));
    const projectStats = new Map<string, { protoOnly: number; both: number; total: number }>();
    
    results.forEach(r => {
        if (!projectStats.has(r.projectName)) {
            projectStats.set(r.projectName, { protoOnly: 0, both: 0, total: 0 });
        }
        const stats = projectStats.get(r.projectName)!;
        stats.total++;
        if (r.classification === 'proto_only') stats.protoOnly++;
        if (r.classification === 'both') stats.both++;
    });

    projectStats.forEach((stats, projectName) => {
        const protoOnlyPct = ((stats.protoOnly / stats.total) * 100).toFixed(1);
        const bothPct = ((stats.both / stats.total) * 100).toFixed(1);
        console.log(`${projectName.padEnd(20)} | Total: ${stats.total.toString().padStart(2)} | Proto Only: ${stats.protoOnly.toString().padStart(2)} (${protoOnlyPct}%) | Both: ${stats.both.toString().padStart(2)} (${bothPct}%)`);
    });

    // JSON出力
    const outputPath = '/app/output/proto_stub_analysis.json';
    const reportData = {
        timestamp: new Date().toISOString(),
        summary: {
            total,
            proto_only: protoOnlyCount,
            stub_only: stubOnlyCount,
            both: bothCount,
            neither: neitherCount,
            percentages: {
                proto_only: ((protoOnlyCount/total)*100).toFixed(2),
                both: ((bothCount/total)*100).toFixed(2),
                stub_only: ((stubOnlyCount/total)*100).toFixed(2),
                neither: ((neitherCount/total)*100).toFixed(2)
            }
        },
        project_stats: Array.from(projectStats.entries()).map(([name, stats]) => ({
            project: name,
            ...stats
        })),
        proto_only_cases: protoOnlyCases.map(pr => ({
            project: pr.projectName,
            category: pr.category,
            pr_name: pr.prName,
            proto_files_count: pr.protoFiles.length,
            proto_files: pr.protoFiles,
            total_changed_files: pr.totalChangedFiles
        })),
        both_cases: bothCases.map(pr => ({
            project: pr.projectName,
            category: pr.category,
            pr_name: pr.prName,
            proto_files_count: pr.protoFiles.length,
            stub_files_count: pr.stubFiles.length
        }))
    };

    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2), 'utf8');
    console.log(`\n✅ Detailed report saved to: ${outputPath}\n`);

    // 結論
    console.log('═'.repeat(80));
    console.log('📌 CONCLUSION');
    console.log('═'.repeat(80));
    if (protoOnlyCount > 0) {
        console.log(`⚠️  WARNING: ${protoOnlyCount} PRs have proto changes WITHOUT stub updates!`);
        console.log(`   This explains why LLM generates no-op patches (${((protoOnlyCount/total)*100).toFixed(1)}% of dataset).`);
        console.log(`   These PRs provide inconsistent test cases where proto is changed`);
        console.log(`   but generated code still references old proto definitions.\n`);
    }
    if (bothCount > 0) {
        console.log(`✅ ${bothCount} PRs have both proto + stub updates (${((bothCount/total)*100).toFixed(1)}% of dataset).`);
        console.log(`   These are valid test cases where the commit includes regenerated stubs.\n`);
    }
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
