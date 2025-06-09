/*
    入力データセットの中から，issue pullrequest からコミット単位で状態取得する
    トリガー：
    protoファイルが変更されたコミット

    比較対象は，premergeと最初のprotoが変更されたコミット
    ※すべてのprotoの変更されたコミットを取得する必要はない


    premergeコピーできてない
    tar消せてない
*/
const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const fse = require('fs-extra');
const tar = require('tar');
const tar_stream = require('tar-stream');



const datasetDir = '/app/dataset/filtered'; // 実際の入力データセットパス
const outputDir = '/app/dataset/filtered_commit';  // 出力先ディレクトリ



/* __MAIN__ */
if (require.main === module) {

    let projectDirs = [];
    try {
        projectDirs = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());
    } catch (err) {
        console.error(`❌ Error reading project directories:`, err.message);
    }

    projectDirs.forEach(projectName => {
        const projectPath = path.join(datasetDir, projectName);
        let categoryDirs = [];
        try {
            categoryDirs = fs.readdirSync(projectPath).filter(dir => fs.statSync(path.join(projectPath, dir)).isDirectory());
        } catch (err) {
            console.error(`❌ Error reading category directories in ${projectPath}:`, err.message);
            return;
        }

        categoryDirs.forEach(category => { // 'issue' or 'pullrequest'
            const categoryPath = path.join(projectPath, category);
            let titleDirs = [];
            try {
                titleDirs = fs.readdirSync(categoryPath).filter(dir => fs.statSync(path.join(categoryPath, dir)).isDirectory());
            } catch (err) {
                console.error(`❌ Error reading title directories in ${categoryPath}:`, err.message);
                return;
            }

            titleDirs.forEach(async title => {
                const subDirPath = path.join(categoryPath, title);
                console.log(`Processing: ${projectName}/${category}/${title}`);

                const subDirOutputPath = path.join(outputDir, projectName, category, title);
                const premergeOutputPath = path.join(subDirOutputPath, 'premerge');
                const mergeOutputPath = path.join(subDirOutputPath, 'commitSnapshot');

                await fse.ensureDir(premergeOutputPath);
                await fse.ensureDir(mergeOutputPath);

                const premergePath = fs.readdirSync(subDirPath)
                    .map(dir => path.join(subDirPath, dir))
                    .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('premerge_'));

                const mergePath = fs.readdirSync(subDirPath)
                    .map(dir => path.join(subDirPath, dir))
                    .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('merge_'));

                if (!premergePath || !mergePath) {
                    console.warn(`⚠️ Missing premerge or merge in ${subDirPath}`);
                    return;
                }

                // .git を復元
                const restoredPre = restoreGit(premergePath);
                const restoredMerge = restoreGit(mergePath);

                const preGit = simpleGit(premergePath);
                const mergeGit = simpleGit(mergePath);

                try {
                    const preCommit = (await preGit.revparse(['HEAD'])).trim();

                    // preCommit から HEAD までのコミットログ（新しい順）
                    const log = await mergeGit.log({ from: preCommit, to: 'HEAD' });

                    const seenHashes = new Set();

                    // 各コミットを1つずつチェックアウトして
                    // .protoファイルが存在するかを判定
                    for (const commit of log.all.reverse()) {
                        const commitHash = commit.hash;
                        if (seenHashes.has(commitHash)) continue; // 重複防止
                        seenHashes.add(commitHash);

                        const tempCheckoutDir = path.join(subDirOutputPath, `temp_commit_${commitHash.slice(0, 7)}`);
                        const archivePath = path.join(subDirOutputPath, `temp_${commitHash.slice(0, 7)}.tar`);

                        try {
                            await fse.ensureDir(tempCheckoutDir);

                            // 一時 tar ファイルとして書き出す
                            await mergeGit.cwd(mergePath);
                            await mergeGit.raw(['archive', '-o', archivePath, commitHash]);

                            // 展開
                            await tar.extract({ file: archivePath, cwd: tempCheckoutDir });

                            const allFiles = await fse.readdir(tempCheckoutDir, { recursive: true });
                            const protoFiles = allFiles.filter(f => f.endsWith('.proto'));

                            if (protoFiles.length > 0) {
                                const saveDir = path.join(subDirOutputPath, `commit_snapshot_${commitHash.slice(0, 7)}`);
                                await fse.move(tempCheckoutDir, saveDir, { overwrite: true });

                                if (isCommitProcessed(subDirOutputPath, commit.hash)) {
                                    console.log(`⏭️ Already processed: ${commit.hash}`);
                                    break; // 最初のproto変更コミットが保存済みなら処理不要
                                }

                            } else {
                                await fse.remove(tempCheckoutDir); // .proto 無ければ削除
                            }

                        } catch (err) {
                            console.warn(`⚠️ Failed to process commit ${commitHash}:`, err.message);
                            await fse.remove(tempCheckoutDir);
                        } finally {
                            await fse.remove(archivePath); // tarファイルを削除
                        }
                    }


                } catch (err) {
                    console.error(`❌ Error in ${projectName}/${category}/${title}:`, err);
                } finally {
                    // 復元した場合のみ戻す
                    if (restoredPre) disableGit(premergePath);
                    if (restoredMerge) disableGit(mergePath);
                }

                // premerge ディレクトリのみコピー済みならスキップ
                if (isPremergeOnlyCopied(premergeOutputPath)) {
                    console.log(`⏭️ Skipping copy (premerge already done): ${subDirOutputPath}`);
                } else {
                    await fse.copy(premergePath, premergeOutputPath);
                    console.log(`✔️ Copied premerge to: ${premergeOutputPath}`);
                }
            });
        });
    });

}

// `.git_disabled` → `.git` 復元
function restoreGit(dir) {
    const disabled = path.join(dir, '.git_disabled');
    const active = path.join(dir, '.git');
    if (fs.existsSync(disabled) && !fs.existsSync(active)) {
        fs.renameSync(disabled, active);
        console.log(`🛠️ Restored .git in ${dir}`);
        return true;
    }
    return false;
}

// `.git` → `.git_disabled` に戻す
function disableGit(dir) {
    const disabled = path.join(dir, '.git_disabled');
    const active = path.join(dir, '.git');
    if (fs.existsSync(active) && !fs.existsSync(disabled)) {
        fs.renameSync(active, disabled);
        console.log(`🔒 Disabled .git in ${dir}`);
    }
}

// コミットスナップショットの保存済みか確認
function isCommitProcessed(subDirOutputPath, commitHash) {
    const snapshotDir = path.join(subDirOutputPath, `commit_snapshot_${commitHash.slice(0, 7)}`);
    if (!fs.existsSync(snapshotDir)) return false;

    const protoFiles = fs.readdirSync(snapshotDir, { recursive: true }).filter(f => f.endsWith('.proto'));
    return protoFiles.length > 0; // protoファイルがあれば処理済みとみなす
}

// スキップ関数（premergeが存在すればOK）
function isPremergeOnlyCopied(premergeOutputPath) {
    return fs.existsSync(path.join(premergeOutputPath, 'package.json')) ||
        fs.existsSync(path.join(premergeOutputPath, '.git_disabled'));
}
