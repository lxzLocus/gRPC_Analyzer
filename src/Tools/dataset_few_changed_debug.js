/*
APR実験用データセット比較プログラム - デバッグ版
除外ルールの詳細な動作を確認できるバージョン
*/

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const inputDataSetDirPath = '/app/dataset/filtered_commit';
const outputDataSetDirPath = '/app/dataset/filtered_fewChanged';

const ignoredChangedFileNum = 3;
const ignoredChangedNum = 20;

// ===== APR実験用除外ルール =====
const EXCLUDED_EXTENSIONS = ['.pb.go', '.pb.cc', '.pb.h', '_grpc.pb.go', '_grpc.pb.cc', '_grpc.pb.h', '.pb.java', '.pb.py'];
const EXCLUDED_PATTERNS = [/generated/i, /auto-generated/i, /_generated\./, /\.gen\./, /mock_.*\.go$/, /.*_mock\.go$/, /.*\.mock\./];
const EXCLUDED_DEPENDENCY_FILES = ['go.mod', 'go.sum', 'package.json', 'package-lock.json', 'yarn.lock', 'pom.xml', 'build.gradle', 'requirements.txt', 'Pipfile', 'Pipfile.lock'];
const EXCLUDED_DOC_CONFIG_EXTENSIONS = ['.md', '.txt', '.yml', '.yaml', '.json', '.xml', '.toml', '.ini', '.conf', '.cfg'];
const EXCLUDED_LEGAL_FILES = ['LICENSE', 'LICENCE', 'COPYING', 'COPYRIGHT', 'NOTICE', 'AUTHORS', 'CONTRIBUTORS'];
const EXCLUDED_VENDOR_PATHS = ['vendor/', 'node_modules/', 'third_party/', 'external/', '.git/', '.github/', 'dist/', 'build/', 'target/', 'bin/', 'obj/'];

function shouldExcludeFile(filePath) {
    const fileName = path.basename(filePath);
    const lowerPath = filePath.toLowerCase();
    
    for (const ext of EXCLUDED_EXTENSIONS) {
        if (fileName.endsWith(ext)) return true;
    }
    for (const pattern of EXCLUDED_PATTERNS) {
        if (pattern.test(filePath)) return true;
    }
    if (EXCLUDED_DEPENDENCY_FILES.includes(fileName)) return true;
    for (const ext of EXCLUDED_DOC_CONFIG_EXTENSIONS) {
        if (fileName.endsWith(ext)) return true;
    }
    for (const legalFile of EXCLUDED_LEGAL_FILES) {
        if (fileName.toUpperCase() === legalFile || fileName.toUpperCase().startsWith(legalFile + '.')) return true;
    }
    for (const vendorPath of EXCLUDED_VENDOR_PATHS) {
        if (lowerPath.includes(vendorPath.toLowerCase())) return true;
    }
    
    return false;
}

function getAllFiles(dirPath) {
    const files = [];
    function traverse(currentPath) {
        try {
            const entries = fs.readdirSync(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    traverse(fullPath);
                } else {
                    files.push(fullPath);
                }
            }
        } catch (err) {
            console.error('ファイル取得エラー:', currentPath, err.message);
        }
    }
    traverse(dirPath);
    return files;
}

function calculateChangedLines(file1, file2) {
    try {
        const diffOutput = execSync(`diff -u "${file1}" "${file2}" 2>/dev/null || true`, { encoding: 'utf8' });
        const lines = diffOutput.split('\n');
        let addedLines = 0;
        let removedLines = 0;
        for (const line of lines) {
            if (line.startsWith('+') && !line.startsWith('+++')) {
                addedLines++;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                removedLines++;
            }
        }
        return Math.max(addedLines, removedLines);
    } catch (err) {
        return 999;
    }
}

function compareDirectoriesDebug(premergeDir, mergedDir) {
    const analysis = {
        addedFiles: [],
        removedFiles: [],
        modifiedFiles: [],
        excludedFiles: [],
        totalChangedLines: 0,
        meetsCriteria: false
    };
    
    if (!fs.existsSync(premergeDir) || !fs.existsSync(mergedDir)) {
        return analysis;
    }
    
    const premergeFiles = getAllFiles(premergeDir);
    const mergedFiles = getAllFiles(mergedDir);
    const premergeRelative = new Set(premergeFiles.map(f => path.relative(premergeDir, f)));
    const mergedRelative = new Set(mergedFiles.map(f => path.relative(mergedDir, f)));
    
    // 追加されたファイル
    for (const relativePath of mergedRelative) {
        if (!premergeRelative.has(relativePath)) {
            if (shouldExcludeFile(relativePath)) {
                analysis.excludedFiles.push({type: 'added', path: relativePath});
            } else {
                analysis.addedFiles.push(relativePath);
            }
        }
    }
    
    // 削除されたファイル
    for (const relativePath of premergeRelative) {
        if (!mergedRelative.has(relativePath)) {
            if (shouldExcludeFile(relativePath)) {
                analysis.excludedFiles.push({type: 'removed', path: relativePath});
            } else {
                analysis.removedFiles.push(relativePath);
            }
        }
    }
    
    // 早期終了チェック
    const totalFileChanges = analysis.addedFiles.length + analysis.removedFiles.length;
    if (totalFileChanges > ignoredChangedFileNum) {
        analysis.meetsCriteria = false;
        return analysis;
    }
    
    // 変更されたファイル
    for (const relativePath of mergedRelative) {
        if (premergeRelative.has(relativePath)) {
            if (shouldExcludeFile(relativePath)) {
                analysis.excludedFiles.push({type: 'modified', path: relativePath});
                continue;
            }
            
            const premergeFile = path.join(premergeDir, relativePath);
            const mergedFile = path.join(mergedDir, relativePath);
            
            try {
                const premergeContent = fs.readFileSync(premergeFile, 'utf8');
                const mergedContent = fs.readFileSync(mergedFile, 'utf8');
                
                if (premergeContent !== mergedContent) {
                    const changedLines = calculateChangedLines(premergeFile, mergedFile);
                    
                    if (changedLines > ignoredChangedNum) {
                        analysis.meetsCriteria = false;
                        return analysis;
                    }
                    
                    analysis.modifiedFiles.push({
                        path: relativePath,
                        changedLines: changedLines
                    });
                    analysis.totalChangedLines += changedLines;
                }
            } catch (err) {
                analysis.meetsCriteria = false;
                return analysis;
            }
        }
    }
    
    analysis.meetsCriteria = true;
    return analysis;
}

// 1つのサンプルをテスト
async function testSingle() {
    console.log('=== APR実験用データセット比較プログラム（デバッグ版） ===');
    
    const repositoryName = 'boulder';
    const category = 'pullrequest';
    const savedRepositoryPath = path.join(inputDataSetDirPath, repositoryName);
    const categoryPath = path.join(savedRepositoryPath, category);
    
    if (!fs.existsSync(categoryPath)) {
        console.log('カテゴリパスが存在しません:', categoryPath);
        return;
    }
    
    const titleDirs = fs.readdirSync(categoryPath).filter(dir => {
        const fullPath = path.join(categoryPath, dir);
        return fs.statSync(fullPath).isDirectory();
    }).slice(0, 3); // 最初の3つのみテスト
    
    for (const pullRequestTitle of titleDirs) {
        const pullRequestPath = path.join(categoryPath, pullRequestTitle);
        console.log('\n=== テスト対象:', pullRequestTitle, '===');
        
        // premergeとmergedディレクトリを取得
        const dirs = fs.readdirSync(pullRequestPath);
        const premergeDir = dirs.find(d => d.startsWith('premerge'));
        const mergedDir = dirs.find(d => d.startsWith('merged') || d.startsWith('commit'));
        
        if (!premergeDir || !mergedDir) {
            console.log('premergeまたはmergedディレクトリが見つかりません');
            continue;
        }
        
        const preMergePath = path.join(pullRequestPath, premergeDir);
        const mergedPath = path.join(pullRequestPath, mergedDir);
        
        const analysis = compareDirectoriesDebug(preMergePath, mergedPath);
        
        console.log('結果:');
        console.log('  APR対象: 追加', analysis.addedFiles.length, ', 削除', analysis.removedFiles.length, ', 変更', analysis.modifiedFiles.length);
        console.log('  除外:', analysis.excludedFiles.length, 'ファイル');
        console.log('  条件を満たす:', analysis.meetsCriteria ? 'YES' : 'NO');
        
        if (analysis.excludedFiles.length > 0) {
            console.log('  除外されたファイル:');
            analysis.excludedFiles.forEach(f => {
                console.log(`    [${f.type}] ${f.path}`);
            });
        }
        
        if (analysis.modifiedFiles.length > 0) {
            console.log('  変更ファイルの詳細:');
            analysis.modifiedFiles.forEach(f => {
                console.log(`    ${f.path} (${f.changedLines}行変更)`);
            });
        }
        
        if (analysis.addedFiles.length > 0) {
            console.log('  追加ファイル:', analysis.addedFiles.join(', '));
        }
        
        if (analysis.removedFiles.length > 0) {
            console.log('  削除ファイル:', analysis.removedFiles.join(', '));
        }
    }
}

testSingle().catch(console.error);
