/*
Docs

プロンプトに埋め込むための，txtファイルを出力するプログラム

対象
- 01_proto.txt
- 02_protoFileChanges.txt
- 03_fileChanges.txt
- 04_surroundedFilePath.txt
- 05_suspectedFiles.txt


リストとその内容
- 01_proto.txt

Diff
- 02_protoFileChanges.txt

変更されたファイルのリストのみ　　[と，その内容（premerge）]
- 03_fileChanges.txt

proto&自動生成ファイル，上下探索を含むディレクトリ構造
- 04_surroundedFilePath.txt

疑わしいファイルのリスト（手書きコードの可能性があるもの）
- 05_suspectedFiles.txt
*/

/*modules*/
import fs from 'fs';
import path from 'path';

// @ts-ignore: JS モジュールのため型チェックを無視
import getPullRequestPaths from '../modules/getPullRequestPaths.js';
// @ts-ignore: JS モジュールのため型チェックを無視
import findFiles from '../modules/generateFilePathContent.js';
// @ts-ignore: JS モジュールのため型チェックを無視
import copyFiles from '../modules/generateFileContent.js';
// @ts-ignore: JS モジュールのため型チェックを無視
import {getFilesDiff, getDiffsForSpecificFiles} from '../modules/generateContentDiff.js';
// @ts-ignore: JS モジュールのため型チェックを無視
import getChangedFiles from '../modules/generateFileChanged.js';
// @ts-ignore: JS モジュールのため型チェックを無視
import getPathTree from '../modules/generateDirPathLists.js';
// @ts-ignore: JS モジュールのため型チェックを無視
import {mergeStructures, findAllAndMergeProjectRoots} from '../modules/editFilePathStructure.js';

/*config*/
const datasetDir = '/app/dataset/filtered_confirmed';

/* __MAIN__ */
// main処理をasync関数でラップ
async function main() {
    const projectDirs = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());

    // forEach を for...of に変更
    for (const projectName of projectDirs) {
        const projectPath = path.join(datasetDir, projectName);
        let categoryDirs = [];
        try {
            categoryDirs = fs.readdirSync(projectPath).filter(dir => fs.statSync(path.join(projectPath, dir)).isDirectory());
        } catch (err: any) {
            console.error(`❌ Error reading category directories in ${projectPath}:`, err.message);
            continue; // 次のプロジェクトへ
        }
        
        // forEach を for...of に変更
        for (const category of categoryDirs) {
            const categoryPath = path.join(projectPath, category);

            const titleDirs = fs.readdirSync(categoryPath).filter(dir => fs.statSync(path.join(categoryPath, dir)).isDirectory());

            // forEach を for...of に変更
            for (const pullRequestTitle of titleDirs) {
                const pullRequestPath = path.join(categoryPath, pullRequestTitle);

                console.log(`Processing: ${projectName}/${pullRequestTitle}`);

                //"premerge_"で始まるサブディレクトリを取得
                const premergePath = fs.readdirSync(pullRequestPath)
                    .map(dir => path.join(pullRequestPath, dir))  // フルパスに変換
                    .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('premerge'));

                // "merge_"で始まるサブディレクトリを取得
                let mergePath = fs.readdirSync(pullRequestPath)
                    .map(dir => path.join(pullRequestPath, dir))
                    .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('merge'));
                // "merge_"がなければ"commit_snapshot_"を探す
                if (!mergePath) {
                    mergePath = fs.readdirSync(pullRequestPath)
                        .map(dir => path.join(pullRequestPath, dir))
                        .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('commit_snapshot_'));
                }

                // ========================================================================
                // 01_proto.txt の処理
                // ========================================================================

                if (!premergePath) {
                    console.error('Premerge path not found, skipping processing');
                    continue;
                }

                // 全protoファイルを取得
                const allProtoContentList: any = findFiles(premergePath, '.proto');
                console.log('allProtoContentList structure:', allProtoContentList);
                
                // 変更されたprotoファイルを特定
                const changedProtoFiles: string[] = [];
                if (premergePath && mergePath) {
                    const changedFilesResult = await getChangedFiles(premergePath, mergePath, '');
                    changedProtoFiles.push(...changedFilesResult.filter((file: string) => file.endsWith('.proto')));
                }
                
                console.log('Changed Proto Files:', changedProtoFiles);
                
                // 変更されたprotoファイルが直接importするファイルを抽出
                const importedProtoFiles = new Set<string>();
                
                /**
                 * protoファイル内容からimport文を抽出する
                 * @param {string} content - protoファイルの内容
                 * @returns {string[]} - importされているファイルパスのリスト
                 */
                function extractImports(content: string): string[] {
                    const imports: string[] = [];
                    const lines = content.split('\n');
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        // import "path/to/file.proto"; の形式を検出
                        const match = trimmed.match(/^\s*import\s+["']([^"']+\.proto)["']\s*;?/);
                        if (match) {
                            imports.push(match[1]);
                        }
                    }
                    return imports;
                }
                
                // 変更されたprotoファイルの内容を読み込み、import文を解析
                for (const changedProtoFile of changedProtoFiles) {
                    const protoInfo = allProtoContentList.proto_files?.find((proto: any) => proto.path === changedProtoFile);
                    if (protoInfo) {
                        const imports = extractImports(protoInfo.content);
                        imports.forEach(importPath => {
                            // 相対パスを正規化して追加
                            const normalizedPath = path.normalize(importPath).replace(/\\/g, '/');
                            importedProtoFiles.add(normalizedPath);
                        });
                    }
                }
                
                console.log('Imported Proto Files:', Array.from(importedProtoFiles));
                
                // 最終的な01_proto.txtの構造を作成
                const relevantProtoFiles: any[] = [];
                const otherProtoFilePaths: string[] = [];
                
                if (allProtoContentList.proto_files) {
                    for (const protoInfo of allProtoContentList.proto_files) {
                        const filePath = protoInfo.path;
                        const normalizedPath = path.normalize(filePath).replace(/\\/g, '/');
                        
                        // 変更されたファイルまたはimportされたファイルかチェック
                        const isChanged = changedProtoFiles.includes(filePath);
                        const isImported = importedProtoFiles.has(normalizedPath) || 
                                         importedProtoFiles.has(filePath) ||
                                         Array.from(importedProtoFiles).some(importPath => 
                                             normalizedPath.endsWith(importPath) || filePath.endsWith(importPath)
                                         );
                        
                        if (isChanged || isImported) {
                            // フル内容を含める
                            relevantProtoFiles.push({
                                path: filePath,
                                content: protoInfo.content,
                                reason: isChanged ? 'changed' : 'imported'
                            });
                        } else {
                            // パスのみ
                            otherProtoFilePaths.push(filePath);
                        }
                    }
                }
                
                // 最終的な出力構造
                const protoOutput = {
                    relevant_proto_files: relevantProtoFiles,
                    other_proto_file_paths: otherProtoFilePaths,
                    summary: {
                        total_proto_files: (allProtoContentList.proto_files?.length || 0),
                        relevant_files_count: relevantProtoFiles.length,
                        other_files_count: otherProtoFilePaths.length,
                        changed_files_count: changedProtoFiles.length,
                        imported_files_count: importedProtoFiles.size
                    }
                };
                
                const protoFilePath = path.join(pullRequestPath, '01_proto.txt');

                // ファイルを書き込み（既存ファイルは自動上書き）
                try {
                    fs.writeFileSync(protoFilePath, JSON.stringify(protoOutput, null, 2), 'utf8');
                } catch (err) {
                    console.error(`Error writing ${protoFilePath}:`, err);
                    continue;
                }
                console.log(`Generated optimized proto file list: ${relevantProtoFiles.length} full content files, ${otherProtoFilePaths.length} path-only files`);

                // ========================================================================
                // 02_protoFileChanges.txt の処理
                // ========================================================================

                try {
                    if (!premergePath || !mergePath) {
                        console.error('Premerge or merge path not found for proto file changes');
                        continue;
                    }
                    const diffResults = await getFilesDiff(premergePath, mergePath, 'proto');
                    const protoFileChangesPath = path.join(pullRequestPath, '02_protoFileChanges.txt');
                    
                    try {
                        if (diffResults.length > 0) {
                            // 新しいファイルを作成（既存は上書き）
                            let allDiffs = '';
                            for (const result of diffResults) {
                                allDiffs += result.diff + '\n';
                            }
                            fs.writeFileSync(protoFileChangesPath, allDiffs, 'utf8');
                        } else {
                            // 空配列を書き込む（変更がないことを明示）
                            fs.writeFileSync(protoFileChangesPath, '[]', 'utf8');
                            console.log('No proto file changes detected, empty array written.');
                        }
                    } catch (error) {
                        console.error(`Error writing ${protoFileChangesPath}:`, error);
                    }
                } catch (error: any) {
                    console.error(`Error processing proto file changes: ${error.message}`);
                }


                // ========================================================================
                // 03_fileChanges.txt の処理
                // ========================================================================

                if (!premergePath || !mergePath) {
                    console.error('Premerge or merge path not found for file changes');
                    continue;
                }
            
                const changedFiles = await getChangedFiles(premergePath, mergePath, '');
                console.log('Changed Files:', changedFiles); // デバッグ用
                const fileChangesPath = path.join(pullRequestPath, '03_fileChanges.txt');

                // ファイルを書き込み（既存は上書き）
                try {
                    fs.writeFileSync(fileChangesPath, JSON.stringify(changedFiles, null, 2), 'utf8');
                } catch (err) {
                    console.error(`Error writing ${fileChangesPath}:`, err);
                    continue;
                }


                // ========================================================================
                // 04_surroundedFilePath.txt の処理
                // ========================================================================

                // ステップA: changedFilesを3つのカテゴリに分類
                const GRPC_KEYWORDS = ['service', 'client', 'server', 'handler', 'rpc', 'impl'];
                const GRPC_GEN_PATTERNS = ['.pb.', '_pb2.', '.pb2.', '.pb.go', '.pb.cc', '.pb.h', '.pb.rb', '.pb.swift', '.pb.m', '.pb-c.', '.pb-c.h', '.pb-c.c'];
                const EXCLUDED_PATTERNS = ['.md', '.markdown', '.log', '.lock', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 'Dockerfile', 'docker-compose.yml', '.dockerignore', 'LICENSE', '.github/', '.circleci/', '.vscode/', 'docs/'];
                const isGeneratedFile = (filePath: string) => GRPC_GEN_PATTERNS.some(pat => filePath.includes(pat));
                const isTestFile = (filePath: string) => {
                    const lower = filePath.toLowerCase();
                    // より正確なテストファイル判定: test/, tests/, *_test.*, *_spec.*, test_*.* のみを対象
                    return lower.includes('/test/') || 
                           lower.includes('/tests/') || 
                           lower.includes('_test.') || 
                           lower.includes('_spec.') || 
                           lower.includes('test_');
                };
                const isExcludedFile = (filePath: string) => EXCLUDED_PATTERNS.some(pat => filePath.includes(pat));

                const protoFiles: string[] = [];
                const generatedFiles: string[] = [];
                const handwrittenFiles: string[] = [];
                const testFiles: string[] = []; // テストファイル用の配列を追加
                const excludedFiles: string[] = []; // 除外ファイル用の配列を追加

                changedFiles.forEach((file: string) => {
                    if (file.endsWith('.proto')) {
                        protoFiles.push(file);
                    } else if (isGeneratedFile(file)) {
                        generatedFiles.push(file);
                    } else if (isTestFile(file)) {
                        testFiles.push(file); // テストファイルを分離
                    } else if (isExcludedFile(file)) {
                        excludedFiles.push(file); // 除外ファイルを分離
                    } else {
                        handwrittenFiles.push(file); // 残りはhandwritten
                    }
                });

                console.log('Categorized Proto Files:', protoFiles);
                console.log('Categorized Generated Files:', generatedFiles);
                console.log('Categorized Handwritten Files:', handwrittenFiles);
                console.log('Categorized Test Files:', testFiles);
                console.log('Categorized Excluded Files:', excludedFiles);
                
                // デバッグ情報: handwrittenFilesが空の場合、詳細を出力
                if (handwrittenFiles.length === 0) {
                    console.warn('⚠️ No handwritten files found after categorization!');
                    console.warn('   Total changed files:', changedFiles.length);
                    console.warn('   Proto files:', protoFiles.length);
                    console.warn('   Generated files:', generatedFiles.length);
                    console.warn('   Test files:', testFiles.length);
                    console.warn('   Excluded files:', excludedFiles.length);
                }


                // ステップB: トップダウンでプロジェクト全体の詳細な構造を一度に取得
                // pullRequestPathの直下のcommit_snapshot_*またはmerge_*、premerge_*ディレクトリのみをスキャン
                const entries = fs.readdirSync(pullRequestPath);
                const projectRootDirs = entries.filter(entry => {
                    const fullPath = path.join(pullRequestPath, entry);
                    return fs.statSync(fullPath).isDirectory() && 
                           (entry.startsWith('commit_snapshot_') || entry.startsWith('merge_') || entry.startsWith('premerge'));
                });
                
                // 各プロジェクトルートの構造を取得してマージ
                let finalProjectStructure: any = {};
                for (const dir of projectRootDirs) {
                    const dirPath = path.join(pullRequestPath, dir);
                    const structure = getPathTree(dirPath);
                    // 構造を直接マージ
                    for (const key in structure) {
                        if (!finalProjectStructure[key]) {
                            finalProjectStructure[key] = structure[key];
                        }
                    }
                }


                // ステップC': LLM向け「要約構造」を生成
                /**
                 * LLM初期入力用の要約構造を生成
                 * - トップレベルディレクトリ一覧
                 * - 変更ファイル近傍のみ展開（maxDepth階層まで）
                 * @param fullStructure フル構造
                 * @param changedFiles 変更ファイルリスト
                 * @param maxDepth 展開する最大深度（デフォルト3）
                 */
                function buildLLMSummaryStructure(
                    fullStructure: any,
                    changedFiles: string[],
                    maxDepth: number = 3
                ): any {
                    const summary: any = {};

                    // トップレベルディレクトリをfullStructureから取得
                    const topLevelDirsSet = new Set<string>();
                    
                    // fullStructureの全トップレベルキー（ディレクトリのみ）を追加
                    if (fullStructure && typeof fullStructure === 'object') {
                        Object.keys(fullStructure).forEach(key => {
                            // ディレクトリのみを追加（値がnullでないもの=オブジェクトであるもの）
                            if (fullStructure[key] !== null && typeof fullStructure[key] === 'object') {
                                topLevelDirsSet.add(key);
                            }
                        });
                    }
                    
                    // 念のため変更ファイルからも抽出（fullStructureに含まれていない場合のフォールバック）
                    changedFiles.forEach(f => {
                        const firstDir = f.split('/')[0];
                        if (firstDir) {
                            topLevelDirsSet.add(firstDir);
                        }
                    });

                    summary.top_level = Array.from(topLevelDirsSet).sort();

                    // 変更点近傍の骨格を構築（パスのみ、深さmaxDepthまで）
                    summary.near_changed = {};
                    
                    changedFiles.forEach(filePath => {
                        const parts = filePath.split('/');
                        let currentLevel: any = summary.near_changed;
                        
                        // maxDepth階層まで、またはファイルの親ディレクトリまで
                        const depth = Math.min(maxDepth, parts.length - 1);
                        
                        for (let i = 0; i < depth; i++) {
                            const part = parts[i];
                            if (!currentLevel[part]) {
                                currentLevel[part] = {};
                            }
                            currentLevel = currentLevel[part];
                        }
                    });

                    // LLMへの明示的な注記
                    summary.note = "Partial project map focused on changed areas. Other directories exist at top_level. Use %_Reply Required_% for deeper exploration.";

                    return summary;
                }

                // 要約構造を生成
                const llmSummaryStructure = buildLLMSummaryStructure(
                    finalProjectStructure,
                    changedFiles,
                    3 // 変更点から3階層まで展開
                );


                // ステップD: 最終的な出力オブジェクトを構築
                const masterOutput = {
                    "directory_structure": llmSummaryStructure, // ← 要約構造を使用
                    "categorized_changed_files": {
                        "proto_files": protoFiles,
                        "generated_files": generatedFiles,
                        "handwritten_files": handwrittenFiles
                    }
                };


                // ステップE: 最終的な構造をファイルに書き込む
                const structureFilePath = path.join(pullRequestPath, '04_surroundedFilePath.txt');
                try {
                    fs.writeFileSync(structureFilePath, JSON.stringify(masterOutput, null, 2), 'utf8');
                    console.log(`Generated final data at: ${structureFilePath}`);
                } catch (err) {
                    console.error(`Error writing ${structureFilePath}:`, err);
                    continue;
                }

                // ========================================================================
                // 05_suspectedFiles.txt の処理
                // ========================================================================

                // --- ステップ1: handwrittenFilesの差分を取得 ---
                const diffsOfHandwrittenFiles = await getDiffsForSpecificFiles(handwrittenFiles, premergePath, mergePath);

                // --- ステップ2: 新スコアリングロジックの実装 ---

                /**
                 * .protoファイルの差分から、変更（追加/削除）されたメッセージ、サービス、RPC名などを抽出する
                 * @param {string} protoDiffContent - 02_protoFileChanges.txt の内容
                 * @returns {string[]} - 抽出された名前のリスト (e.g., ["Secrets", "GetSecrets"])
                 */
                function extractNamesFromProtoDiff(protoDiffContent: string): string[] {
                    const names = new Set<string>();
                    const regex = /^\s*(?:message|service|rpc)\s+([A-Za-z_][A-Za-z0-9_]*)/gm;

                    // 差分（+または-で始まる行）のみを対象
                    const changedLines = protoDiffContent.split('\n').filter(line => line.startsWith('+') || line.startsWith('-'));

                    for (const line of changedLines) {
                        let match;
                        while ((match = regex.exec(line)) !== null) {
                            names.add(match[1]);
                        }
                    }
                    return Array.from(names);
                }

                // 02_protoFileChanges.txtを読み込み、変更された名前を抽出
                const protoDiffContent = fs.readFileSync(path.join(pullRequestPath, '02_protoFileChanges.txt'), 'utf8');
                const changedProtoNames = extractNamesFromProtoDiff(protoDiffContent);
                console.log('Extracted names from proto diff:', changedProtoNames);

                // Type definitions for scoring
                interface FileInfo {
                    relativePath: string;
                    diff: string;
                }

                interface ScoredFile {
                    filePath: string;
                    score: number;
                    diff: string;
                }

                const calculateSuspicionScore = (fileInfo: FileInfo, protoFileNames: string[], changedProtoNames: string[]): number => {
                    let score = 0;
                    const { relativePath, diff } = fileInfo;
                    const fileName = path.basename(relativePath);

                    // ルール1: ファイル役割ボーナス
                    if (fileName.endsWith('main.go') || fileName.endsWith('server.go') || fileName.endsWith('client.go') || fileName.endsWith('app.py') || fileName.endsWith('index.js')) {
                        score += 20; // コアロジック
                    } else if (relativePath.includes('deployment') || relativePath.endsWith('.yaml')) {
                        score += 10; // K8sなどデプロイ関連
                    } else if (fileName === 'Tiltfile' || fileName === 'Dockerfile') {
                        score += 5;  // 開発環境・ビルド関連
                    }

                    // ルール2: Proto関連度ボーナス
                    // (A) ファイル名の一致
                    const fileNameWithoutExt = path.parse(fileName).name;
                    if (protoFileNames.some(protoFile => path.parse(protoFile).name === fileNameWithoutExt)) {
                        score += 15;
                    }
                    // (B) 内容の一致
                    for (const protoName of changedProtoNames) {
                        if (diff.includes(protoName)) {
                            score += 30; // 内容に直接的な関連語があれば、非常に高いスコア
                        }
                    }

                    // ルール3: 変更インパクトボーナス
                    if (diff) {
                        score += 5; // 差分が少しでもあれば、基礎点を与える
                    }

                    return score;
                };

                // --- ステップ3: 各ファイルのスコアを計算し、ソート ---
                const scoredFiles: ScoredFile[] = diffsOfHandwrittenFiles.map((fileInfo: FileInfo) => ({
                    filePath: fileInfo.relativePath,
                    score: calculateSuspicionScore(fileInfo, protoFiles, changedProtoNames),
                    diff: fileInfo.diff
                }));

                // スコアの高い順にソート
                scoredFiles.sort((a: ScoredFile, b: ScoredFile) => b.score - a.score);

                const outputLines: string[] = [];
                scoredFiles.forEach((file: ScoredFile, index: number) => {
                    const rank = index + 1;

                    // --- ヘッダー部分 ---
                    // 全てのファイルに共通で出力
                    //outputLines.push(`Rank: ${rank}`);
                    //outputLines.push(`Score: ${file.score}`);
                    //outputLines.push(`File: ${file.filePath}`);

                    // --- 内容部分 ---
                    // 上位3位までのファイルのみ、変更前の内容を出力
                    if (rank <= 3 && premergePath) {
                        const premergeFilePath = path.join(premergePath, file.filePath);
                        if (fs.existsSync(premergeFilePath)) {
                            try {
                                const content = fs.readFileSync(premergeFilePath, 'utf8');
                                // unix diff ライクなヘッダー（相対パスのみ、先頭スラッシュなし）
                                outputLines.push(`--- ${file.filePath}`);
                                outputLines.push(content);
                            } catch (e: any) {
                                console.error(`Error reading file content for ${premergeFilePath}:`, e.message);
                                outputLines.push(`<< Error reading file content >>`);
                            }
                        } else {
                            outputLines.push(`<< File content not found in premerge directory >>`);
                        }
                    }

                    // 各エントリ間にセパレータを挿入
                    //outputLines.push('---');
                });

                // 全ての行を結合して最終的なテキストを作成
                let finalOutputText = outputLines.join('\n');

                // 手書きファイルが存在しない場合の処理を改善
                if (handwrittenFiles.length === 0) {
                    console.warn('⚠️ No handwritten files detected - generating fallback suspected files');
                    
                    // フォールバック戦略1: テストファイルから推測
                    const inferredFiles: string[] = [];
                    
                    // テストファイルから実装ファイルを推測
                    testFiles.forEach(testFile => {
                        const fileName = path.basename(testFile);
                        const dirName = path.dirname(testFile);
                        
                        // _test.goパターン -> .go
                        if (fileName.endsWith('_test.go')) {
                            const implFile = fileName.replace('_test.go', '.go');
                            inferredFiles.push(`${dirName}/${implFile}`);
                        }
                        // test_*.pyパターン -> *.py
                        else if (fileName.startsWith('test_') && fileName.endsWith('.py')) {
                            const implFile = fileName.replace('test_', '');
                            inferredFiles.push(`${dirName}/${implFile}`);
                        }
                        // *_test.*パターン -> *.*
                        else if (fileName.includes('_test.')) {
                            const implFile = fileName.replace('_test.', '.');
                            inferredFiles.push(`${dirName}/${implFile}`);
                        }
                    });
                    
                    // フォールバック戦略2: proto名から推測
                    const protoBasedFiles: string[] = [];
                    changedProtoNames.forEach(protoName => {
                        // Go: service_name.go, service_name_handler.go
                        protoBasedFiles.push(`${protoName.toLowerCase()}.go`);
                        protoBasedFiles.push(`${protoName.toLowerCase()}_handler.go`);
                        // Python: service_name.py
                        protoBasedFiles.push(`${protoName.toLowerCase()}.py`);
                        // Java: ServiceName.java
                        protoBasedFiles.push(`${protoName}.java`);
                    });
                    
                    finalOutputText = `No handwritten files found in changed files, but proto modifications suggest potential impacts.

**File Categorization**:
- Proto files (${protoFiles.length}): ${protoFiles.join(', ') || 'none'}
- Auto-generated files (${generatedFiles.length}): ${generatedFiles.slice(0, 3).join(', ')}${generatedFiles.length > 3 ? ', ...' : ''}
- Test files (${testFiles.length}): ${testFiles.join(', ') || 'none'}
- Excluded files (${excludedFiles.length}): ${excludedFiles.slice(0, 3).join(', ')}${excludedFiles.length > 3 ? ', ...' : ''}

**Inferred Potentially Affected Files** (based on proto changes and test files):
${inferredFiles.length > 0 ? inferredFiles.map(f => `  - ${f}`).join('\n') : '  (none inferred from test files)'}

**Proto-based File Suggestions** (files that may handle these proto messages):
${protoBasedFiles.length > 0 ? protoBasedFiles.slice(0, 10).map(f => `  - ${f}`).join('\n') : '  (none)'}

**IMPORTANT**: 
The absence of handwritten files in the changeset does NOT necessarily mean no implementation is needed.
Please analyze:
1. Whether the proto changes require updates to existing server/client implementations
2. Whether new RPC methods need handler implementations
3. Whether data model changes affect serialization/deserialization code

If you determine no changes are needed, provide detailed justification explaining why the proto modifications do not require code updates.`;
                } else {
                    console.log(`✅ Generated suspected files list with ${scoredFiles.length} files (top 3 with content)`);
                }

                // ファイルに書き込み
                const suspectedFilesPath = path.join(pullRequestPath, '05_suspectedFiles.txt');
                fs.writeFileSync(suspectedFilesPath, finalOutputText, 'utf8');
                console.log(`Generated final suspected files list at: ${suspectedFilesPath}`);

            }
        }
    }
}
            
                

// スクリプトが直接実行された場合にmain関数を呼び出す
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(err => {
        console.error("An unexpected error occurred in main process:", err);
    });
}

// 他のファイルからインポートできるようにエクスポート
export { main };
