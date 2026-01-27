/*modules*/
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';


/*config*/
const datasetDir = '/app/dataset/filtered_fewChanged';


// スクリプトが直接実行された場合にmain関数を呼び出す
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(err => {
        console.error("An unexpected error occurred in main process:", err);
    });
}


/* __MAIN__ */
// main処理をasync関数でラップ
async function main() {
    // Ground Truth Diffの基準に合わせたignore設定
    const ignore = {
        folders: ['.git', 'node_modules', '.git_disabled'],
        extensions: ['.log', '.tmp']
    };

    console.log('=== Ground Truth Diff カウンター ===');
    console.log('除外設定:');
    console.log('  - フォルダ:', ignore.folders.join(', '));
    console.log('  - 拡張子:', ignore.extensions.join(', '));
    console.log('');

    const projectDirs = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());

    let totalCases = 0;
    let casesWithDiff = 0;
    let casesWithoutDiff = 0;
    const results = [];

    // 各プロジェクトを処理
    for (const projectName of projectDirs) {
        const projectPath = path.join(datasetDir, projectName);
        let categoryDirs = [];
        try {
            categoryDirs = fs.readdirSync(projectPath).filter(dir => fs.statSync(path.join(projectPath, dir)).isDirectory());
        } catch (err) {
            console.error(`❌ Error reading category directories in ${projectPath}:`, err.message);
            continue;
        }

        // 各カテゴリを処理
        for (const category of categoryDirs) {
            const categoryPath = path.join(projectPath, category);
            const titleDirs = fs.readdirSync(categoryPath).filter(dir => fs.statSync(path.join(categoryPath, dir)).isDirectory());

            // 各テストケースを処理
            for (const pullRequestTitle of titleDirs) {
                const pullRequestPath = path.join(categoryPath, pullRequestTitle);
                totalCases++;

                const testCaseId = `${projectName}/${category}/${pullRequestTitle}`;
                console.log(`[${totalCases}] 処理中: ${testCaseId}`);

                // premergeディレクトリを取得
                const premergePath = fs.readdirSync(pullRequestPath)
                    .map(dir => path.join(pullRequestPath, dir))
                    .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('premerge'));

                // mergeまたはcommit_snapshotディレクトリを取得
                let mergePath = fs.readdirSync(pullRequestPath)
                    .map(dir => path.join(pullRequestPath, dir))
                    .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('merge'));
                
                if (!mergePath) {
                    mergePath = fs.readdirSync(pullRequestPath)
                        .map(dir => path.join(pullRequestPath, dir))
                        .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('commit_snapshot_'));
                }

                if (!premergePath || !mergePath) {
                    console.log(`  ⚠️  ディレクトリ不足 (premerge: ${!!premergePath}, merge: ${!!mergePath})`);
                    results.push({ testCase: testCaseId, changedFiles: -1, status: 'missing_dirs' });
                    continue;
                }

                // 変更ファイルを取得
                try {
                    const changedFiles = await getChangedFiles(premergePath, mergePath, null, ignore);
                    
                    if (changedFiles.length > 0) {
                        casesWithDiff++;
                        console.log(`  ✅ Ground Truth Diffあり: ${changedFiles.length}ファイル`);
                        results.push({ 
                            testCase: testCaseId, 
                            changedFiles: changedFiles.length, 
                            status: 'has_diff',
                            files: changedFiles.slice(0, 3)
                        });
                    } else {
                        casesWithoutDiff++;
                        console.log(`  ❌ Ground Truth Diffなし (変更ファイル0件)`);
                        results.push({ 
                            testCase: testCaseId, 
                            changedFiles: 0, 
                            status: 'no_diff' 
                        });
                    }
                } catch (error) {
                    console.log(`  ⚠️  エラー: ${error.message}`);
                    results.push({ 
                        testCase: testCaseId, 
                        changedFiles: -1, 
                        status: 'error',
                        error: error.message 
                    });
                }

                console.log('');
            }
        }
    }

    // 結果サマリー
    console.log('='.repeat(60));
    console.log('=== 集計結果 ===');
    console.log(`総テストケース数: ${totalCases}`);
    console.log(`Ground Truth Diffあり: ${casesWithDiff} (${(casesWithDiff/totalCases*100).toFixed(1)}%)`);
    console.log(`Ground Truth Diffなし: ${casesWithoutDiff} (${(casesWithoutDiff/totalCases*100).toFixed(1)}%)`);
    
    const errorCases = results.filter(r => r.status === 'error' || r.status === 'missing_dirs');
    console.log(`エラー: ${errorCases.length}`);
    console.log('');

    // Diffなしのケース詳細
    const noDiffCases = results.filter(r => r.status === 'no_diff');
    if (noDiffCases.length > 0) {
        console.log('=== Ground Truth Diffなしのケース ===');
        noDiffCases.forEach((r, i) => {
            console.log(`${i+1}. ${r.testCase}`);
        });
        console.log('');
    }

    // エラーケース詳細
    if (errorCases.length > 0) {
        console.log('=== エラーケース ===');
        errorCases.forEach((r, i) => {
            console.log(`${i+1}. ${r.testCase} (${r.status})`);
        });
        console.log('');
    }

    // 結果をJSONファイルに保存（問題があったケースのみ詳細記録）
    const outputPath = '/app/output/ground_truth_check_results.json';
    fs.writeFileSync(outputPath, JSON.stringify({
        summary: {
            total: totalCases,
            withDiff: casesWithDiff,
            withoutDiff: casesWithoutDiff,
            errors: errorCases.length,
            percentage: (casesWithDiff/totalCases*100).toFixed(1) + '%'
        },
        problematicCases: {
            noDiff: noDiffCases.map(c => ({
                testCase: c.testCase,
                reason: 'no_changed_files'
            })),
            errors: errorCases.map(c => ({
                testCase: c.testCase,
                reason: c.status === 'missing_dirs' ? 'missing_directories' : 'processing_error',
                error: c.error || 'unknown'
            }))
        }
    }, null, 2));
    console.log(`結果を保存しました: ${outputPath}`);
}



/**
 * 
 * @module generateFileChanged
 * @description ファイルの内容差分を出力するものではない
 * @example
 * // 使用例
 * const results = await getChangedFiles(inputDir, '');
 */
// メインの比較関数
export default async function getChangedFiles(premergePath, mergePath, extension, ignore) {
    try {
        // 2つのディレクトリから対象ファイルリストを取得（無視リストを考慮）
        const premergeFiles = getFilesRecursive(premergePath, extension, ignore);

        const diffResults = [];

        // premerge と merge ディレクトリ内で同名のファイルを diff
        for (const file1 of premergeFiles) {
            const relativePath = path.relative(premergePath, file1);
            const file2 = path.join(mergePath, relativePath);

            if (fs.existsSync(file2)) {
                try {
                    const diffResult = await diffFiles(file1, file2);
                    if (diffResult) {
                        //const content = fs.readFileSync(file1, 'utf8');
                        // diffResults.push({
                        //     path: relativePath,
                        //     content: content
                        // });
                        diffResults.push(relativePath);
                    }
                } catch (err) {
                    console.error(`Error comparing files: ${err.message}`);
                }
            } else {
                console.log(`No corresponding file for ${file1} in merge directory`);
            }
        }

        console.log('Diff Results:', diffResults); // デバッグ用
        return diffResults;
    } catch (error) {
        console.error(error.message);
        throw error;
    }
}


/**
 * 指定されたディレクトリから再帰的にファイルを探索する関数
 * @param {string} dir - 検索を開始するディレクトリのパス
 * @param {string} extension - 対象とするファイルの拡張子（例: '.proto'）
 * @param {Object} ignore - 無視するフォルダや拡張子の設定
 * @returns {string[]} - 対象ファイルのパスの配列
 */
function getFilesRecursive(dir, extension, ignore) {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // 無視するフォルダをスキップ
        if (stat.isDirectory()) {
            if (!ignore.folders.includes(file)) {
                results = results.concat(getFilesRecursive(filePath, extension, ignore));
            }
        } else {
            // 無視する拡張子をスキップ
            const fileExt = path.extname(file);
            if (!ignore.extensions.includes(fileExt) && (!extension || file.endsWith(extension))) {
                results.push(filePath);
            }
        }
    });

    return results;
}

// premerge と merge ディレクトリ内で同名の .proto ファイルを diff
function diffFiles(file1, file2) {
    return new Promise((resolve, reject) => {
        console.log(`Running diff between: ${file1} and ${file2}`); // デバッグ用
        exec(`diff -u "${file1}" "${file2}"`, (err, stdout, stderr) => {
            if (err && err.code === 1) {
                // 差分が見つかる場合
                resolve(true);
            } else if (err) {
                // 予期しないエラー
                reject(new Error(`Error comparing ${file1} and ${file2}: ${err.message}`));
            } else if (stderr) {
                // スタンダードエラー出力
                reject(new Error(`Stderr: ${stderr}`));
            } else {
                resolve(false); // 差分なし
            }
        });
    });
}
