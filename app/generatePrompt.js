/*
Docs

プロンプトに埋め込むための，txtファイルを出力するプログラム

対象
- 01_proto.txt
- 02_protoFileChanges.txt
- 03_fileChanges.txt
- 04_surroundedFilePaths.txt
- 05_suspectedFiles.txt


リストとその内容
- 01_proto.txt

Diff
- 02_protoFileChanges.txt

変更されたファイルのリストのみ　　[と，その内容（premerge）]
- 03_fileChanges.txt

proto&自動生成ファイル，上下探索を含むディレクトリ構造
- 04_surroundedFilePaths.txt

疑わしいファイルのリスト（手書きコードの可能性があるもの）
- 05_suspectedFiles.txt
*/

/*modules*/
import fs from 'fs';
import path from 'path';


import getPullRequestPaths from './module/getPullRequestPaths.js';
import findFiles from './module/generateFilePathContent.js';
import getFilesDiff from './module/generateContentDiff.js';
import getChangedFiles from './module/generateFileChanged.js';
import getPathTree from './module/generateDirPathLists.js';
import getSurroundingDirectoryStructure from './module/generatePeripheralStructure.js';
import {mergeStructures, findAllAndMergeProjectRoots} from './module/editFilePathStructure.js';


/*config*/
const datasetDir = '/app/dataset/test';





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
        } catch (err) {
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
                    .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('premerge_'));

                // "merge_"で始まるサブディレクトリを取得
                let mergePath = fs.readdirSync(pullRequestPath)
                    .map(dir => path.join(pullRequestPath, dir))
                    .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('merge_'));
                // "merge_"がなければ"commit_snapshot_"を探す
                if (!mergePath) {
                    mergePath = fs.readdirSync(pullRequestPath)
                        .map(dir => path.join(pullRequestPath, dir))
                        .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('commit_snapshot_'));
                }

                // ========================================================================
                // 01_proto.txt の処理
                // ========================================================================

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
                } catch (error) {
                    console.error(`Error processing proto file changes: ${error.message}`);
                }


                // ========================================================================
                // 03_fileChanges.txt の処理
                // ========================================================================

            
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


                /*fileChangesの中からproto関連なファイルを抽出*/
                const GRPC_GEN_PATTERNS = [
                    '.pb.', '_pb2.', '.pb2.', '.pb.go', '.pb.cc', '.pb.h',
                    '.pb.rb', '.pb.swift', '.pb.m', '.pb-c.', '.pb-c.h', '.pb-c.c'
                ];
                const GRPC_KEYWORDS = ['service', 'client', 'server', 'handler', 'rpc', 'impl'];

                const EXCLUDED_PATTERNS = [
                    // 拡張子
                    '.md', '.markdown', '.log', '.lock',
                    // 画像
                    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
                    // 完全一致するファイル名
                    'Dockerfile', 'docker-compose.yml', '.dockerignore', 'LICENSE',
                    // 特定のディレクトリ
                    '.github/', '.circleci/', '.vscode/', 'docs/',
                ];

                const isGeneratedFile = (filePath) => GRPC_GEN_PATTERNS.some(pat => filePath.includes(pat));
                const isTestFile = (filePath) => filePath.toLowerCase().includes('test');

                const isExcludedFile = (filePath) => {
                    // filePathの末尾や一部に除外パターンが含まれているかチェック
                    return EXCLUDED_PATTERNS.some(pat => filePath.includes(pat));
                };

                // 正規表現を使った、より厳密な判定の例
                const isExcludedFileWithRegex = (filePath) => {
                    const patterns = [
                        /\.md$/, /\.markdown$/,            // Markdown
                        /LICENSE$/, /\.gitignore$/,        // ドキュメント・Git設定
                        /package-lock\.json$/, /yarn\.lock$/, // Lockファイル
                        /^Dockerfile$/,                    // Dockerfile
                        /\.(png|jpe?g|gif|svg|ico)$/,      // 画像ファイル
                        /^\.github\//, /^\.circleci\//,      // CI/CD設定ディレクトリ
                    ];
                    return patterns.some(regex => regex.test(filePath));
                };

                /*changedFilesを3つのカテゴリに分類 */
                const protoFiles = [];
                const generatedFiles = [];
                const handwrittenFiles = [];

                changedFiles.forEach(file => {
                    if (file.endsWith('.proto')) {
                        protoFiles.push(file);
                    } else if (isGeneratedFile(file)) {
                        generatedFiles.push(file);
                    } else if (!isExcludedFile(file) && !isTestFile(file)) { 
                        handwrittenFiles.push(file);
                    }
                // 除外ファイルとテストファイルはどのカテゴリにも属さず、ここで除外される
                });

                console.log('Categorized Proto Files:', protoFiles);
                console.log('Categorized Generated Files:', generatedFiles);
                console.log('Categorized Handwritten Files:', handwrittenFiles);


                /*周辺ディレクトリ構造の生成*/
                
                // 探索の起点となるパス。PRディレクトリ自体を指定すると premerge/merge両方を取得できる
                const structureSourcePath = pullRequestPath; 
                // depthは必要に応じて調整。2程度あれば premerge/merge を捉えられる
                const rawStructure = getSurroundingDirectoryStructure(structureSourcePath, 3);

                // 1. rawStructureからpremerge_やmerge_等の中身をすべて探し、1つにマージする
                const mergedProjectRoot = findAllAndMergeProjectRoots(rawStructure);


                /**
                 * 与えられた構造オブジェクトがリポジトリのルートディレクトリらしいかを判定する。
                 * @param {object} structure - ファイル構造オブジェクト。
                 * @returns {boolean} - ルートディレクトリらしい場合はtrue。
                 */
                function isLikelyRepoRoot(structure) {
                    // ルートディレクトリによく存在するファイルやディレクトリのリスト
                    const rootIndicators = [
                        '.gitignore',
                        'LICENSE',
                        'README.md',
                        'Makefile',
                        'Tiltfile',
                        'go.mod',       // Goプロジェクト
                        'package.json', // Node.jsプロジェクト
                        'pyproject.toml', // Pythonプロジェクト
                        '.github',
                        '.circleci'
                    ];

                    // structureの直下のキーに、上記のいずれかが含まれているかチェック
                    return rootIndicators.some(indicator => Object.prototype.hasOwnProperty.call(structure, indicator));
                }

                const structureFilePath = path.join(pullRequestPath, '04_surroundedFilePath.txt');

                // 2. 既存のファイルを読み込み、追記の準備をする
                let masterStructure = {};
                if (fs.existsSync(structureFilePath)) {
                    try {
                        const existingContent = fs.readFileSync(structureFilePath, 'utf8');
                        if (existingContent) {
                            masterStructure = JSON.parse(existingContent);
                        }
                    } catch (e) {
                        console.error(`Could not parse existing structure file: ${structureFilePath}`, e);
                        masterStructure = {};
                    }
                }

                // 3. マージされたルートの内容に応じて処理を分岐
                if (Object.keys(mergedProjectRoot).length > 0) {
                    if (isLikelyRepoRoot(mergedProjectRoot)) {
                        // --- ケースA: ルートディレクトリと判定された場合 ---
                        console.log("Structure is likely a repository root. Wrapping with 'root' key.");
                        const newContribution = { "root": mergedProjectRoot };
                        masterStructure = mergeStructures(masterStructure, newContribution);

                    } else {
                        // --- ケースB: サブディレクトリと判定された場合 ---
                        console.log("Structure is likely a subdirectory. Merging directly.");
                        masterStructure = mergeStructures(masterStructure, mergedProjectRoot);
                    }
                }

                // 4. 最終的な構造をファイルに書き戻す
                fs.writeFileSync(structureFilePath, JSON.stringify(masterStructure, null, 2), 'utf8');
                console.log(`Updated directory structure at: ${structureFilePath}`);



                // ========================================================================
                // 05_suspectedFiles.txt の処理
                // ========================================================================

                // --- ステップ3: 手書きコードのスコアリング ---
                // Hunk/変更行数を取得する機能がまだないため、ここではキーワードのみでスコアリングします。
                // 将来的に getChangedFiles が { file: string, additions: number, deletions: number } 
                // のようなオブジェクトを返すようになれば、スコア計算に組み込めます。
                const calculateScore = 
                (filePath) => {
                    let score = 0;
                    // const changeCount = file.additions + file.deletions; // 将来的な拡張
                    // score += changeCount;

                    // gRPC関連キーワードが含まれていればスコアを加算
                    const keywordScore = GRPC_KEYWORDS.reduce((currentScore, keyword) => {
                        if (filePath.toLowerCase().includes(keyword)) {
                            return currentScore + 1;
                        }
                        return currentScore;
                    }, 0);
                    score += keywordScore;

                    return score;
                };

                const scoredHandwrittenFiles = handwrittenFiles.map(file => ({
                    file: file,
                    score: calculateScore(file)
                }));

                // スコアの高い順にソート
                scoredHandwrittenFiles.sort((a, b) => b.score - a.score);


                // --- ステップ4: 「疑わしいファイルリスト」を作成 ---
                // スコアが1以上のもの（キーワードに合致したもの）を抽出
                const suspectedFiles = scoredHandwrittenFiles
                    .filter(item => item.score > 0)
                    .map(item => item.file);

                console.log('Suspected Files (High-Impact):', suspectedFiles);

                // 05_suspectedFiles.txt として保存
                const suspectedFilesPath = path.join(pullRequestPath, '05_suspectedFiles.txt');
                if (fs.existsSync(suspectedFilesPath)) {
                    fs.unlinkSync(suspectedFilesPath);
                }
                fs.writeFileSync(suspectedFilesPath, JSON.stringify(suspectedFiles, null, 2), 'utf8');


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
