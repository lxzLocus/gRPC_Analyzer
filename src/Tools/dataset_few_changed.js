/*
ファイルの追加・削除が指定件数以内 & コードの変更が各ファイル20行以内のデータセット
2つのリポジトリの状態を比較して，条件に当てはまる場合，指定したディレクトリにコピーするプログラム
LLMを使ったAPR実験用のフィルタリングルールを適用

削除されたファイルのカウント制御:
- countDeletedFiles = true: 削除ファイルも変更ファイル数にカウントする
- countDeletedFiles = false: 削除ファイルはカウントしない（デフォルト）
*/

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const inputDataSetDirPath = '/app/dataset/filtered_commit';
const outputDataSetDirPath = '/app/dataset/filtered_fewChanged';

// フィルタリング条件
const ignoredChangedFileNum = 7;
const ignoredChangedNum = 30;

// 削除されたファイルを変更数にカウントするかどうか
const countDeletedFiles = false;  // true: カウントする, false: カウントしない

// ===== APR実験用除外ルール =====
// APRが対象とする「論理的なバグの修正」に関係ないファイルを除外

// 1. 自動生成ファイル（Protocol Buffers関連）
const EXCLUDED_EXTENSIONS = [
    '.pb.go',           // protobuf生成ファイル
    '.pb.cc',
    '.pb.h',
    '_grpc.pb.go',      // gRPC生成ファイル
    '_grpc.pb.cc',
    '_grpc.pb.h',
    '.pb.java',
    '.pb.py'
];

// 2. 自動生成ファイル（その他）
const EXCLUDED_PATTERNS = [
    /generated/i,       // "generated"を含むパス
    /auto-generated/i,
    /_generated\./,     // "_generated."を含むファイル
    /\.gen\./,          // ".gen."を含むファイル
    /mock_.*\.go$/,     // Goのmockファイル
    /.*_mock\.go$/,
    /.*\.mock\./        // mockを含むファイル
];

// 3. 依存関係・設定ファイル
const EXCLUDED_DEPENDENCY_FILES = [
    'go.mod',
    'go.sum',
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pom.xml',
    'build.gradle',
    'requirements.txt',
    'Pipfile',
    'Pipfile.lock'
];

// 4. ドキュメント・設定ファイル
const EXCLUDED_DOC_CONFIG_EXTENSIONS = [
    '.md',              // Markdown
    '.txt',             // テキストファイル
    '.yml',             // YAML設定
    '.yaml',
    '.json',            // JSON設定（ただし重要な場合は個別判定）
    '.xml',             // XML設定
    '.toml',            // TOML設定
    '.ini',             // INI設定
    '.conf',            // 設定ファイル
    '.cfg'
];

// 5. ライセンス・法的文書
const EXCLUDED_LEGAL_FILES = [
    'LICENSE',
    'LICENCE',
    'COPYING',
    'COPYRIGHT',
    'NOTICE',
    'AUTHORS',
    'CONTRIBUTORS'
];

// 6. ベンダー・外部依存ディレクトリ
const EXCLUDED_VENDOR_PATHS = [
    'vendor/',
    'node_modules/',
    'third_party/',
    'external/',
    '.git/',
    '.github/',
    'dist/',
    'build/',
    'target/',
    'bin/',
    'obj/'
];

// 7. IDE・エディタ設定
const EXCLUDED_IDE_PATHS = [
    '.vscode/',
    '.idea/',
    '.eclipse/'
];

const EXCLUDED_IDE_FILES = [
    '.DS_Store',        // macOS Finder
    '.classpath',       // Eclipse
    '.project'          // Eclipse
];

// 8. CI/CD設定ファイル
const EXCLUDED_CI_FILES = [
    '.gitlab-ci.yml',
    'circle.yml',
    'travis.yml',
    'Jenkinsfile'
];

const EXCLUDED_CI_PATHS = [
    '.circleci/'
];

// 9. メディア・バイナリファイル
const EXCLUDED_MEDIA_EXTENSIONS = [
    // Images
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    // Video/Documents  
    '.mp4', '.mov', '.pdf',
    // Fonts
    '.woff', '.woff2', '.ttf', '.eot'
];

// 10. テストデータ・フィクスチャ（オプション）
const EXCLUDED_TEST_DATA_PATHS = [
    'testdata/',
    'fixtures/',
    'test/fixtures/'
];

/**
 * ファイルがAPR実験の対象外かどうかを判定する関数
 * @param {string} filePath - 相対ファイルパス
 * @returns {boolean} true: 除外対象, false: 対象に含める
 */
function shouldExcludeFile(filePath) {
    const fileName = path.basename(filePath);
    const lowerPath = filePath.toLowerCase();
    
    // 1. 自動生成ファイル（拡張子）
    for (const ext of EXCLUDED_EXTENSIONS) {
        if (fileName.endsWith(ext)) {
            return true;
        }
    }
    
    // 2. 自動生成ファイル（パターン）
    for (const pattern of EXCLUDED_PATTERNS) {
        if (pattern.test(filePath)) {
            return true;
        }
    }
    
    // 3. 依存関係ファイル
    if (EXCLUDED_DEPENDENCY_FILES.includes(fileName)) {
        return true;
    }
    
    // 4. ドキュメント・設定ファイル
    for (const ext of EXCLUDED_DOC_CONFIG_EXTENSIONS) {
        if (fileName.endsWith(ext)) {
            return true;
        }
    }
    
    // 5. ライセンス・法的文書
    for (const legalFile of EXCLUDED_LEGAL_FILES) {
        if (fileName.toUpperCase() === legalFile || 
            fileName.toUpperCase().startsWith(legalFile + '.')) {
            return true;
        }
    }
    
    // 6. ベンダー・外部依存ディレクトリ
    for (const vendorPath of EXCLUDED_VENDOR_PATHS) {
        if (lowerPath.includes(vendorPath.toLowerCase())) {
            return true;
        }
    }
    
    // 7. IDE・エディタ設定
    for (const idePath of EXCLUDED_IDE_PATHS) {
        if (lowerPath.includes(idePath.toLowerCase())) {
            return true;
        }
    }
    
    if (EXCLUDED_IDE_FILES.includes(fileName)) {
        return true;
    }
    
    // 8. CI/CD設定ファイル
    if (EXCLUDED_CI_FILES.includes(fileName)) {
        return true;
    }
    
    for (const ciPath of EXCLUDED_CI_PATHS) {
        if (lowerPath.includes(ciPath.toLowerCase())) {
            return true;
        }
    }
    
    // 9. メディア・バイナリファイル
    for (const ext of EXCLUDED_MEDIA_EXTENSIONS) {
        if (fileName.endsWith(ext)) {
            return true;
        }
    }
    
    // 10. テストデータ・フィクスチャ
    for (const testDataPath of EXCLUDED_TEST_DATA_PATHS) {
        if (lowerPath.includes(testDataPath.toLowerCase())) {
            return true;
        }
    }
    
    return false;
}

/**
 * ディレクトリを再帰的にコピーする関数
 */
function copyDirectoryRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        try {
            // entry.isDirectory()とfs.statの二重チェックで安全性を確保
            const srcStat = fs.statSync(srcPath);
            
            if (entry.isDirectory() && srcStat.isDirectory()) {
                copyDirectoryRecursive(srcPath, destPath);
            } else if (entry.isFile() && srcStat.isFile()) {
                fs.copyFileSync(srcPath, destPath);
            } else {
                console.warn(`スキップ: 想定外のファイルタイプ ${srcPath}`);
            }
            // シンボリックリンクや特殊ファイルはスキップ
        } catch (err) {
            console.error(`コピーエラー: ${srcPath} -> ${destPath}:`, err.message);
            // エラーがあってもコピー処理を続行
        }
    }
}

/**
 * ファイルの行数を数える関数
 */
function countLines(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n').length;
    } catch (err) {
        return 0;
    }
}

/**
 * ファイルの変更行数を計算する関数
 */
function calculateChangedLines(file1, file2) {
    try {
        // diffコマンドを使用して変更行数を計算
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
        return 999; // エラーの場合は大きな値を返す
    }
}

/**
 * 2つのディレクトリを比較して変更内容を分析する関数
 */
function compareDirectories(premergeDir, mergedDir) {
    const analysis = {
        addedFiles: [],
        removedFiles: [],
        modifiedFiles: [],
        totalChangedLines: 0,
        meetsCriteria: false
    };
    
    if (!fs.existsSync(premergeDir) || !fs.existsSync(mergedDir)) {
        return analysis;
    }
    
    // 両方のディレクトリのファイル一覧を取得
    const premergeFiles = getAllFiles(premergeDir);
    const mergedFiles = getAllFiles(mergedDir);
    
    // 相対パスのセットを作成
    const premergeRelative = new Set(premergeFiles.map(f => path.relative(premergeDir, f)));
    const mergedRelative = new Set(mergedFiles.map(f => path.relative(mergedDir, f)));
    
    // 追加されたファイル（除外対象をフィルタリング）
    for (const relativePath of mergedRelative) {
        if (!premergeRelative.has(relativePath)) {
            if (!shouldExcludeFile(relativePath)) {
                analysis.addedFiles.push(relativePath);
            }
        }
    }
    
    // 削除されたファイル（除外対象をフィルタリング）
    for (const relativePath of premergeRelative) {
        if (!mergedRelative.has(relativePath)) {
            if (!shouldExcludeFile(relativePath)) {
                analysis.removedFiles.push(relativePath);
            }
        }
    }
    
    // 追加・削除されたファイル数が上限を超えた場合は即座にスキップ
    const addedFileCount = analysis.addedFiles.length;
    const removedFileCount = countDeletedFiles ? analysis.removedFiles.length : 0;
    const totalFileChanges = addedFileCount + removedFileCount;
    
    if (totalFileChanges > ignoredChangedFileNum) {
        analysis.meetsCriteria = false;
        return analysis;
    }
    
    // 変更されたファイル（除外対象をフィルタリング）
    for (const relativePath of mergedRelative) {
        if (premergeRelative.has(relativePath)) {
            // 除外対象のファイルはスキップ
            if (shouldExcludeFile(relativePath)) {
                continue;
            }
            
            const premergeFile = path.join(premergeDir, relativePath);
            const mergedFile = path.join(mergedDir, relativePath);
            
            // ファイルの内容が異なるかチェック
            try {
                const premergeContent = fs.readFileSync(premergeFile, 'utf8');
                const mergedContent = fs.readFileSync(mergedFile, 'utf8');
                
                if (premergeContent !== mergedContent) {
                    const changedLines = calculateChangedLines(premergeFile, mergedFile);
                    
                    // 20行を超えた場合は即座にスキップ
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
                // バイナリファイルや読み取りエラーの場合は即座にスキップ
                analysis.meetsCriteria = false;
                return analysis;
            }
        }
    }
    
    // ここまで来たということは、追加・削除ファイル数が上限以下
    // かつ全ての変更ファイルが20行以下なので条件を満たす
    analysis.meetsCriteria = true;
    
    return analysis;
}

/**
 * ディレクトリ内のすべてのファイルを再帰的に取得する関数
 */
function getAllFiles(dirPath) {
    const files = [];
    
    function traverse(currentPath) {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            
            if (entry.isDirectory()) {
                traverse(fullPath);
            } else {
                files.push(fullPath);
            }
        }
    }
    
    traverse(dirPath);
    return files;
}

/**
 * メイン関数
 */
async function main() {
    console.log('=== APR実験用データセット比較プログラム ===');
    console.log('入力ディレクトリ:', inputDataSetDirPath);
    console.log('出力ディレクトリ:', outputDataSetDirPath);
    console.log('条件: ファイル変更数 <=', ignoredChangedFileNum, ', 行変更数 <=', ignoredChangedNum);
    console.log('\n除外対象:');
    console.log('- 自動生成ファイル (.pb.go, _grpc.pb.go など)');
    console.log('- 依存関係ファイル (go.mod, package.json など)'); 
    console.log('- ドキュメント (.md, .txt など)');
    console.log('- 設定ファイル (.yaml, .json など)');
    console.log('- ライセンス・法的文書 (LICENSE, COPYRIGHT など)');
    console.log('- ベンダーディレクトリ (vendor/, node_modules/ など)');
    console.log('- IDE・エディタ設定 (.vscode/, .idea/, .DS_Store など)');
    console.log('- CI/CD設定ファイル (.gitlab-ci.yml, Jenkinsfile など)');
    console.log('- メディア・バイナリファイル (.png, .pdf, .woff など)');
    console.log('- テストデータ (testdata/, fixtures/ など)');
    console.log('==========================================\n');
    
    // 出力ディレクトリを作成
    if (!fs.existsSync(outputDataSetDirPath)) {
        fs.mkdirSync(outputDataSetDirPath, { recursive: true });
    }
    
    let totalProcessed = 0;
    let totalCopied = 0;
    
    const datasetDirs = fs.readdirSync(inputDataSetDirPath).filter(dir => {
        const fullPath = path.join(inputDataSetDirPath, dir);
        return fs.statSync(fullPath).isDirectory();
    });
    
    for (const repositoryName of datasetDirs) {
        console.log('\n処理中のリポジトリ:', repositoryName);
        
        const savedRepositoryPath = path.join(inputDataSetDirPath, repositoryName);
        let categoryDirs = [];
        
        try {
            categoryDirs = fs.readdirSync(savedRepositoryPath).filter(dir => {
                const fullPath = path.join(savedRepositoryPath, dir);
                return fs.statSync(fullPath).isDirectory();
            });
        } catch (err) {
            console.error('カテゴリディレクトリの読み取りエラー in', savedRepositoryPath, ':', err.message);
            continue;
        }
        
        for (const category of categoryDirs) {
            const categoryPath = path.join(savedRepositoryPath, category);
            const titleDirs = fs.readdirSync(categoryPath).filter(dir => {
                const fullPath = path.join(categoryPath, dir);
                return fs.statSync(fullPath).isDirectory();
            });
            
            for (const pullRequestTitle of titleDirs) {
                totalProcessed++;
                const pullRequestPath = path.join(categoryPath, pullRequestTitle);
                
                // premergeディレクトリを取得
                const premergeDir = fs.readdirSync(pullRequestPath)
                    .map(dir => path.join(pullRequestPath, dir))
                    .find(filePath => {
                        try {
                            return fs.statSync(filePath).isDirectory() && 
                                   path.basename(filePath).startsWith('premerge');
                        } catch {
                            return false;
                        }
                    });
                
                if (!premergeDir) {
                    console.log('premergeディレクトリが見つかりません:', pullRequestPath);
                    continue;
                }
                
                // mergedまたはcommitで始まるディレクトリを取得
                let mergedDir = fs.readdirSync(pullRequestPath)
                    .map(dir => path.join(pullRequestPath, dir))
                    .find(filePath => {
                        try {
                            return fs.statSync(filePath).isDirectory() && 
                                   path.basename(filePath).startsWith('merged');
                        } catch {
                            return false;
                        }
                    });
                
                if (!mergedDir) {
                    mergedDir = fs.readdirSync(pullRequestPath)
                        .map(dir => path.join(pullRequestPath, dir))
                        .find(filePath => {
                            try {
                                return fs.statSync(filePath).isDirectory() && 
                                       path.basename(filePath).startsWith('commit');
                            } catch {
                                return false;
                            }
                        });
                }
                
                if (!mergedDir) {
                    console.log('merged/commitディレクトリが見つかりません:', pullRequestPath);
                    continue;
                }
                
                // ディレクトリの比較と分析
                console.log('比較中:', repositoryName + '/' + category + '/' + pullRequestTitle);
                const analysis = compareDirectories(premergeDir, mergedDir);
                
                console.log('   APR対象: 追加:', analysis.addedFiles.length, ', 削除:', analysis.removedFiles.length, `(${countDeletedFiles ? 'カウント対象' : 'カウント外'})`, ', 変更:', analysis.modifiedFiles.length);
                
                if (analysis.meetsCriteria) {
                    console.log('   ✓ 条件を満たしています。コピーします。');
                    
                    // 出力ディレクトリにコピー
                    const outputPath = path.join(outputDataSetDirPath, repositoryName, category, pullRequestTitle);
                    copyDirectoryRecursive(pullRequestPath, outputPath);
                    totalCopied++;
                } else {
                    const fileChanges = analysis.addedFiles.length + analysis.removedFiles.length;
                    if (fileChanges > ignoredChangedFileNum) {
                        console.log('   × スキップ: ファイル変更数が上限を超過 (' + fileChanges + ' > ' + ignoredChangedFileNum + ')');
                    } else {
                        console.log('   × スキップ: 20行を超える変更のファイルが存在');
                    }
                }
            }
        }
    }
    
    console.log('\n処理完了!');
    console.log('総処理数:', totalProcessed);
    console.log('コピー数:', totalCopied);
    console.log('出力先:', outputDataSetDirPath);
}

/**
 * 除外ルールのテスト関数
 */
function testExclusionRules() {
    const testFiles = [
        'main.go',                    // 対象
        'service.pb.go',              // 除外: protobuf
        'client_grpc.pb.go',          // 除外: gRPC
        'go.mod',                     // 除外: 依存関係
        'README.md',                  // 除外: ドキュメント
        'config.yaml',                // 除外: 設定
        'LICENSE',                    // 除外: ライセンス
        'vendor/github.com/lib.go',   // 除外: ベンダー
        'generated/proto.go',         // 除外: 自動生成
        'mock_service.go',            // 除外: mock
        'handler_test.go',            // 対象（テストは重要）
        // 新しく追加されたルール
        '.vscode/settings.json',      // 除外: IDE設定
        '.idea/workspace.xml',        // 除外: IDE設定
        '.DS_Store',                  // 除外: IDE設定
        '.classpath',                 // 除外: IDE設定
        '.gitlab-ci.yml',             // 除外: CI/CD
        'Jenkinsfile',                // 除外: CI/CD
        '.circleci/config.yml',       // 除外: CI/CD
        'logo.png',                   // 除外: 画像
        'document.pdf',               // 除外: ドキュメント
        'font.woff2',                 // 除外: フォント
        'testdata/sample.json',       // 除外: テストデータ
        'fixtures/mock_data.xml'      // 除外: テストデータ
    ];
    
    console.log('除外ルールテスト:');
    for (const file of testFiles) {
        const excluded = shouldExcludeFile(file);
        console.log(`  ${file}: ${excluded ? '除外' : '対象'}`);
    }
    console.log();
}

// プログラム実行
if (process.argv.includes('--test-rules')) {
    testExclusionRules();
} else {
    main().catch(console.error);
}

export { main, compareDirectories, copyDirectoryRecursive };
