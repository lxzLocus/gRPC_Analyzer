/*
    入力データセットの中から，issue pullrequest からコミット単位で状態取得する
    トリガー：
    protoファイルが変更されたコミット

    比較対象は，premergeと最初のprotoが変更されたコミット
    ※すべてのprotoの変更されたコミットを取得する必要はない
*/
const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const fse = require('fs-extra');
const tar = require('tar');
const tar_stream = require('tar-stream');

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

const datasetDir = '/app/dataset/filtered'; // 実際の入力データセットパス
const outputDir = '/app/dataset/filtered_commit';  // 出力先ディレクトリ

/* __MAIN__ */
if (require.main === module) {

    const projectDirs = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());

    projectDirs.forEach(projectName => {
        const projectPath = path.join(datasetDir, projectName);
        const categoryDirs = fs.readdirSync(projectPath).filter(dir => fs.statSync(path.join(projectPath, dir)).isDirectory());

        categoryDirs.forEach(category => { // 'issue' or 'pullrequest'
            const categoryPath = path.join(projectPath, category);
            const titleDirs = fs.readdirSync(categoryPath).filter(dir => fs.statSync(path.join(categoryPath, dir)).isDirectory());

            titleDirs.forEach(async title => {
                const subDirPath = path.join(categoryPath, title);
                console.log(`Processing: ${projectName}/${category}/${title}`);

                const subDirOutputPath = path.join(outputDir, projectName, category, title);
                const premergeOutputPath = path.join(subDirOutputPath, 'premerge');
                const mergeOutputPath = path.join(subDirOutputPath, 'merge');

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
                                console.log(`✔️ Saved commit with proto: ${commitHash}`);
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

                // premerge, merge ディレクトリをコピー
                await fse.copy(premergePath, premergeOutputPath);
                await fse.copy(mergePath, mergeOutputPath);
                console.log(`✔️ Copied premerge and merge to: ${subDirOutputPath}`);
            });
        });
    });

}