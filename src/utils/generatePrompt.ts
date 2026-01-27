/*
npx tsx /app/src/utils/generatePrompt.ts

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
const PARALLEL_LIMIT = 10; // 同時実行数の上限

/* __MAIN__ */

/**
 * バッチ処理で並列実行を制御
 * @param items 処理対象の配列
 * @param batchSize バッチサイズ（同時実行数）
 * @param processFn 各アイテムを処理する関数
 */
async function processBatch<T>(items: T[], batchSize: number, processFn: (item: T) => Promise<void>) {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map(item => processFn(item).catch(err => {
            console.error(`Error processing item:`, err);
        })));
    }
}

/**
 * 単一のプルリクエストを処理
 */
async function processPullRequest(projectName: string, category: string, pullRequestTitle: string, pullRequestPath: string) {
    try {
        console.log(`Processing: ${projectName}/${category}/${pullRequestTitle}`);

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
                    return; // continueではなくreturnに変更
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
                    return; // continueではなくreturnに変更
                }
                console.log(`Generated optimized proto file list: ${relevantProtoFiles.length} full content files, ${otherProtoFilePaths.length} path-only files`);

                // ========================================================================
                // 02_protoFileChanges.txt の処理
                // ========================================================================

                try {
                    if (!premergePath || !mergePath) {
                        console.error('Premerge or merge path not found for proto file changes');
                        return; // continueではなくreturnに変更
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
                    return; // continueではなくreturnに変更
                }
            
                const changedFiles = await getChangedFiles(premergePath, mergePath, '');
                console.log('Changed Files:', changedFiles); // デバッグ用
                const fileChangesPath = path.join(pullRequestPath, '03_fileChanges.txt');

                // ファイルを書き込み（既存は上書き）
                try {
                    fs.writeFileSync(fileChangesPath, JSON.stringify(changedFiles, null, 2), 'utf8');
                } catch (err) {
                    console.error(`Error writing ${fileChangesPath}:`, err);
                    return; // continueではなくreturnに変更
                }

                // ========================================================================
                // 02a_stubFileChanges.txt の処理（gRPC生成ファイルのdiff）
                // 03_fileChanges.txtの後に生成（changedFilesを使用するため）
                // ========================================================================

                try {
                    if (!premergePath || !mergePath) {
                        console.error('Premerge or merge path not found for stub file changes');
                        return; // continueではなくreturnに変更
                    }
                    
                    // gRPC生成ファイルのパターン
                    const GRPC_GEN_PATTERNS = [
                        '.pb.go', '.pb.cc', '.pb.h',      // C++, Go
                        '_pb2.py', '_pb2.pyi', '.pb2.py', // Python
                        '_grpc.pb.go', '_grpc.pb.cc',     // gRPC service stubs
                        '.grpc.pb.cc', '.grpc.pb.h'
                    ];
                    
                    // 変更されたファイルからgRPC生成ファイルを抽出
                    const changedStubFiles = changedFiles.filter((file: string) => 
                        GRPC_GEN_PATTERNS.some(pattern => file.includes(pattern))
                    );
                    
                    const stubFileChangesPath = path.join(pullRequestPath, '02a_stubFileChanges.txt');
                    
                    if (changedStubFiles.length > 0) {
                        console.log(`Generating stub file changes for ${changedStubFiles.length} files...`);
                        
                        // getDiffsForSpecificFilesを使用
                        const stubDiffResults = await getDiffsForSpecificFiles(changedStubFiles, premergePath, mergePath);
                        
                        if (stubDiffResults.length > 0) {
                            // 全ての差分を一度に結合してから書き込み（既存は上書き）
                            let allStubDiffs = '';
                            for (const result of stubDiffResults) {
                                allStubDiffs += result.diff + '\n';
                            }
                            fs.writeFileSync(stubFileChangesPath, allStubDiffs, 'utf8');
                            console.log(`Generated stub file changes: ${stubDiffResults.length} diffs`);
                        } else {
                            fs.writeFileSync(stubFileChangesPath, '# No stub file changes detected', 'utf8');
                        }
                    } else {
                        fs.writeFileSync(stubFileChangesPath, '# No stub files were modified in this commit', 'utf8');
                        console.log('No stub files modified, placeholder written.');
                    }
                } catch (error: any) {
                    console.error(`Error processing stub file changes: ${error.message}`);
                }


                // ========================================================================
                // 04_surroundedFilePath.txt の処理
                // ========================================================================

                // ステップA: changedFilesを3つのカテゴリに分類
                const GRPC_KEYWORDS = ['service', 'client', 'server', 'handler', 'rpc', 'impl'];
                const GRPC_GEN_PATTERNS = ['.pb.', '_pb2.', '.pb2.', '.pb.go', '.pb.cc', '.pb.h', '.pb.rb', '.pb.swift', '.pb.m', '.pb-c.', '.pb-c.h', '.pb-c.c'];
                const EXCLUDED_PATTERNS = ['.md', '.markdown', '.log', '.lock', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 'Dockerfile', 'docker-compose.yml', '.dockerignore', 'LICENSE', '.github/', '.circleci/', '.vscode/', 'docs/'];
                const isGeneratedFile = (filePath: string) => GRPC_GEN_PATTERNS.some(pat => filePath.includes(pat));
                const isTestFile = (filePath: string) => filePath.toLowerCase().includes('test');
                const isExcludedFile = (filePath: string) => EXCLUDED_PATTERNS.some(pat => filePath.includes(pat));

                const protoFiles: string[] = [];
                const generatedFiles: string[] = [];
                const handwrittenFiles: string[] = [];

                changedFiles.forEach((file: string) => {
                    if (file.endsWith('.proto')) {
                        protoFiles.push(file);
                    } else if (isGeneratedFile(file)) {
                        generatedFiles.push(file);
                    } else if (!isExcludedFile(file) && !isTestFile(file)) {
                        handwrittenFiles.push(file);
                    }
                });

                console.log('Categorized Proto Files:', protoFiles);
                console.log('Categorized Generated Files:', generatedFiles);
                console.log('Categorized Handwritten Files:', handwrittenFiles);


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
                    return; // continueではなくreturnに変更
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
                    // outputLines.push(`Rank: ${rank}`);
                    // outputLines.push(`Score: ${file.score}`);
                    // outputLines.push(`File: ${file.filePath}`);

                    // --- 内容部分 ---
                    // 全てのファイルの変更前の内容を出力（上位3位の制限を撤廃）
                    if (premergePath) {
                        const premergeFilePath = path.join(premergePath, file.filePath);
                        if (fs.existsSync(premergeFilePath)) {
                            try {
                                const content = fs.readFileSync(premergeFilePath, 'utf8');
                                // unix diff ライクなヘッダー（相対パスのみ、先頭スラッシュなし）
                                outputLines.push(`--- ${file.filePath}`);
                                outputLines.push(content);
                                outputLines.push(''); // ファイル間の区切り
                            } catch (e: any) {
                                console.error(`Error reading file content for ${premergeFilePath}:`, e.message);
                                outputLines.push(`<< Error reading file content >>`);
                            }
                        } else {
                            outputLines.push(`<< File content not found in premerge directory >>`);
                        }
                    }
                });

                // 全ての行を結合して最終的なテキストを作成
                let finalOutputText = outputLines.join('\n');

                // 手書きファイルが存在しない場合、またはoutputLinesが空の場合の説明メッセージ
                if (handwrittenFiles.length === 0 || outputLines.length === 0) {
                    finalOutputText = `No handwritten files found. Only auto-generated files were modified.

In this pull request, only .proto files and their auto-generated files (.pb.go, etc.) 
were modified. No handwritten code files were changed.
Therefore, no suspected handwritten files exist for analysis.

File categorization of changes:
- Proto files: .proto files
- Generated files: Files matching patterns like .pb.go, .pb.cc, .pb.h, etc.
- Handwritten files: None (excluding excluded files, test files, and auto-generated files)`;
                }

                // ファイルに書き込み
                const suspectedFilesPath = path.join(pullRequestPath, '05_suspectedFiles.txt');
                fs.writeFileSync(suspectedFilesPath, finalOutputText, 'utf8');
                console.log(`Generated final suspected files list at: ${suspectedFilesPath}`);
                
                // デバッグ情報: 出力サイズを記録
                if (finalOutputText.length < 100) {
                    console.warn(`⚠️ Small suspected files output (${finalOutputText.length} bytes) for ${projectName}/${category}/${pullRequestTitle}`);
                }

    } catch (error: any) {
        console.error(`❌ Error processing ${pullRequestPath}:`, error.message);
    }
}

// main処理をasync関数でラップ
async function main() {
    const projectDirs = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());

    // プロジェクト単位で処理
    for (const projectName of projectDirs) {
        const projectPath = path.join(datasetDir, projectName);
        let categoryDirs = [];
        try {
            categoryDirs = fs.readdirSync(projectPath).filter(dir => fs.statSync(path.join(projectPath, dir)).isDirectory());
        } catch (err: any) {
            console.error(`❌ Error reading category directories in ${projectPath}:`, err.message);
            continue;
        }
        
        // カテゴリ単位で処理
        for (const category of categoryDirs) {
            const categoryPath = path.join(projectPath, category);

            const titleDirs = fs.readdirSync(categoryPath).filter(dir => fs.statSync(path.join(categoryPath, dir)).isDirectory());

            // プルリクエストのリストを作成
            const prTasks = titleDirs.map(pullRequestTitle => ({
                projectName,
                category,
                pullRequestTitle,
                pullRequestPath: path.join(categoryPath, pullRequestTitle)
            }));

            // 並列処理（バッチ処理で同時実行数を制御）
            console.log(`\n📦 Processing ${prTasks.length} pull requests in ${projectName}/${category} (parallel limit: ${PARALLEL_LIMIT})`);
            await processBatch(prTasks, PARALLEL_LIMIT, async (task) => {
                await processPullRequest(task.projectName, task.category, task.pullRequestTitle, task.pullRequestPath);
            });

            console.log(`✅ Completed processing ${projectName}/${category}\n`);
        }
    }
    
    console.log('\n🎉 All processing completed successfully!');
}
            
                

// スクリプトが直接実行された場合にmain関数を呼び出す
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(err => {
        console.error("An unexpected error occurred in main process:", err);
    });
}

// 他のファイルからインポートできるようにエクスポート
export { main };
