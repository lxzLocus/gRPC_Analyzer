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
import getSurroundingDirectoryStructure from '../modules/generatePeripheralStructure.js';
// @ts-ignore: JS モジュールのため型チェックを無視
import {mergeStructures, findAllAndMergeProjectRoots} from '../modules/editFilePathStructure.js';

/*config*/
const datasetDir = '/app/dataset/filtered_commit';

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

                const protoContentList = await findFiles(premergePath, '.proto');
                const protoFilePath = path.join(pullRequestPath, '01_proto.txt');

                // 既存のファイルがあれば削除
                if (fs.existsSync(protoFilePath)) {
                    fs.unlinkSync(protoFilePath);
                }
                fs.writeFileSync(protoFilePath, JSON.stringify(protoContentList, null, 2), 'utf8');

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
                    if (diffResults.length > 0) {
                        // 既存のファイルがあれば削除
                        if (fs.existsSync(protoFileChangesPath)) {
                            fs.unlinkSync(protoFileChangesPath);
                        }
                        // 新しいファイルを作成
                        for (const result of diffResults) {
                            try {
                                fs.appendFileSync(protoFileChangesPath, result.diff + '\n', 'utf8');
                            } catch (error) {
                                console.error(`Error appending to file: ${protoFileChangesPath}`, error);
                            }
                        }
                    } else {

                        // 既存のファイルがあれば削除
                        if (fs.existsSync(protoFileChangesPath)) {
                            fs.unlinkSync(protoFileChangesPath);
                        }
                        // 新しいファイルを作成
                        
                        try {
                            fs.appendFileSync(protoFileChangesPath, '', 'utf8'); // 空の文字列を渡す
                        } catch (error) {
                            console.error(`Error appending to file: ${protoFileChangesPath}`, error);
                        }
                        

                        console.log('No proto file changes detected, no file created.');
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

                // 既存のファイルがあれば削除
                if (fs.existsSync(fileChangesPath)) {
                    fs.unlinkSync(fileChangesPath);
                }
                fs.writeFileSync(fileChangesPath, JSON.stringify(changedFiles, null, 2), 'utf8');


                // ========================================================================
                // 04_surroundedFilePaths.txt の処理
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
                const structureSourcePath = pullRequestPath;
                // ❗❗【最重要ポイント】❗❗
                // depthを十分に大きく設定 (5〜6程度あれば殆どのプロジェクトで詳細まで取得可能)
                // これにより、骨格と詳細の情報を一度で正確に取得します。
                const rawStructure = getSurroundingDirectoryStructure(structureSourcePath, 5);

                // rawStructureからpremerge_やmerge_等の中身をすべて探し、1つにマージする
                const finalProjectStructure = findAllAndMergeProjectRoots(rawStructure);


                // ステップC: 取得した構造がルートディレクトリか判定し、形式を整える
                function isLikelyRepoRoot(structure: any) {
                    const rootIndicators = ['.gitignore', 'LICENSE', 'README.md', 'Makefile', 'Tiltfile', 'go.mod', 'package.json', 'pyproject.toml', '.github', '.circleci'];
                    return rootIndicators.some(indicator => Object.prototype.hasOwnProperty.call(structure, indicator));
                }

                let directoryStructure = {};
                if (Object.keys(finalProjectStructure).length > 0) {
                    if (isLikelyRepoRoot(finalProjectStructure)) {
                        console.log("Final structure is likely a repository root. Wrapping with 'root' key.");
                        directoryStructure = { "root": finalProjectStructure };
                    } else {
                        console.log("Final structure is likely a subdirectory. Using as is.");
                        directoryStructure = finalProjectStructure;
                    }
                }


                // ステップD: 最終的な出力オブジェクトを構築
                const masterOutput = {
                    "directory_structure": directoryStructure,
                    "categorized_changed_files": {
                        "proto_files": protoFiles,
                        "generated_files": generatedFiles,
                        "handwritten_files": handwrittenFiles
                    }
                };


                // ステップE: 最終的な構造をファイルに書き込む
                const structureFilePath = path.join(pullRequestPath, '04_surroundedFilePath.txt');
                if (fs.existsSync(structureFilePath)) {
                    fs.unlinkSync(structureFilePath);
                }
                fs.writeFileSync(structureFilePath, JSON.stringify(masterOutput, null, 2), 'utf8');
                console.log(`Generated final data at: ${structureFilePath}`);

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
                                // unix diff ライクなヘッダー
                                outputLines.push(`--- /${file.filePath}`);
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
                const finalOutputText = outputLines.join('\n');

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
