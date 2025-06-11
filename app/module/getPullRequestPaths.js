import fs from 'fs';
import path from 'path';

/**
 * 指定されたディレクトリから再帰的にプロジェクトとプルリクエストのフォルダパスを取得する
 * @param {string} baseDir - 検索を開始するディレクトリのパス
 * @returns {Array} - プロジェクトとプルリクエストのフォルダパスを含む配列
 */
export default function getPullRequestPaths(baseDir) {
    const projectDirs = fs.readdirSync(baseDir);
    const pullRequestPaths = [];

    projectDirs.forEach(project => {
        const projectPath = path.join(baseDir, project);
        if (fs.statSync(projectPath).isDirectory()) {
            const pullRequestDirs = fs.readdirSync(projectPath);
            pullRequestDirs.forEach(pr => {
                const prPath = path.join(projectPath, pr);
                if (fs.statSync(prPath).isDirectory()) {
                    pullRequestPaths.push(prPath);
                }
            });
        }
    });

    return pullRequestPaths;
}


