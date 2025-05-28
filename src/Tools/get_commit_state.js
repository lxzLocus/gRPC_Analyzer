const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const fse = require('fs-extra');
const tar = require('tar');

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

                for (const commit of log.all.reverse()) {
                    const commitHash = commit.hash;
                    const tempCheckoutDir = path.join(subDirOutputPath, `temp_commit_${commitHash.slice(0, 7)}`);

                    // 一時作業ディレクトリに中間コミットの内容を抽出
                    await fse.ensureDir(tempCheckoutDir);
                    await mergeGit.cwd(mergePath);
                        const archiveBuffer = await mergeGit.raw(['archive', commitHash]);

                        // アーカイブ解凍（バッファをファイルとして一時保存する必要あり）
                        const tempTarPath = path.join(tempCheckoutDir, 'temp.tar');
                        fs.writeFileSync(tempTarPath, archiveBuffer);
                        await tar.x({ file: tempTarPath, cwd: tempCheckoutDir });
                        await fse.remove(tempTarPath);

                    const files = fse.readdirSync(tempCheckoutDir, { recursive: true });
                    const protoFiles = files.filter(f => f.endsWith('.proto'));

                    if (protoFiles.length > 0) {
                            const saveDir = path.join(subDirOutputPath, `commit_snapshot_${commitHash.slice(0, 7)}`);
                        await fse.move(tempCheckoutDir, saveDir, { overwrite: true });
                            console.log(`✔️ Saved commit: ${commitHash}`);
                            break;
                    } else {
                            await fse.remove(tempCheckoutDir);
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