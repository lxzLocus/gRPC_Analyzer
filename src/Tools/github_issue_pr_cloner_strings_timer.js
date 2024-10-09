/*********
     for bug dataset
    GitHubの  issue前後のリポジトリを取得する
    プルリクエストの前後を取得する

    ファイルの中に文字列あったらクローンする

    5000req/h 守った版

    sudo git config --system core.longpaths true
    or
    .git/config [core] longpaths = true 追加
*********/
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
require('dotenv').config();

const githubToken = process.env.GITHUB_TOKEN;


/*settings*/
const rootPath = '/app/'
const csvFilePath = 'dataset/gRPC_reps_bigreps.csv';
const saveDir = 'dataset/clone';

//issue取得拡張子定義
const programmingFileExtensions = [
    '.go', '.cs', '.java', '.scala', '.ts', '.py', '.c', '.js', '.sh',
    '.html', '.css', '.pl', '.cpp', '.rs', '.proto', '.protoc'
];

const importStrings = [
    'import "google.golang.org/grpc"', 'using Grpc.Core;', 'import io.grpc.',
    'import * as grpc from', 'import grpc', '#include <grpc/grpc.h>',
    'const grpc = require(', 'syntax = "proto3"'
];

async function checkRateLimit(headers) {
    const remainingRequests = headers['x-ratelimit-remaining'];
    const resetTime = headers['x-ratelimit-reset'];

    if (remainingRequests == 0) {
        const currentTime = Math.floor(Date.now() / 1000);
        const waitTime = resetTime - currentTime;

        console.log(`Rate limit exceeded. Waiting for ${waitTime} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    }
}

//03
async function processRepository(repoUrl) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const { fixedIssues, pullRequests } = await getFixedIssuesAndPullRequests(repoUrl, githubToken);

    console.log(`Found ${fixedIssues.length} fixed issues and ${pullRequests.length} closed pull requests for repository ${repoUrl}:`);

    // Process issues
    for (const issue of fixedIssues) {
        console.log(`\n#${issue.number}: ${issue.title}`);

        const commitId = await getPullRequestInfo(repoUrl, githubToken, issue.number);
        if (commitId) {
            console.log(`Fix commit ID: ${commitId}`);

            const changedFiles = await getChangedFilesWithContent(repoUrl, githubToken, commitId);
            // 文字列がファイル内に含まれているかを確認
            const relevantFiles = changedFiles.filter(file => containsImportStrings(file.content));

            if (relevantFiles.length > 0) {
                console.log(`Relevant files: ${relevantFiles.map(file => file.filename).join(', ')}`);

                const repoDir = path.join(saveDir, repo);
                const sanitizedIssueTitle = sanitizeDirectoryName(issue.title);
                const issueDir = path.join(repoDir, 'issue', sanitizedIssueTitle);
                await createDirectory(repoDir);
                await createDirectory(path.join(repoDir, 'issue'));
                await createDirectory(issueDir);

                const mergeDir = path.join(issueDir, `merge_${issue.number}`);
                const premergeDir = path.join(issueDir, `premerge_${issue.number}`);

                try {
                    await cloneRepository(repoUrl, commitId, mergeDir);
                    console.log(`Repository state before merge saved in: ${mergeDir}`);

                    const defaultBranchName = await getDefaultBranch(repoUrl, githubToken);
                    const prevCommitId = await getPrevCommitId(mergeDir, commitId, defaultBranchName);
                    if (prevCommitId) {
                        try {
                            await cloneRepository(repoUrl, prevCommitId, premergeDir);
                            console.log(`Repository state after merge saved in: ${premergeDir}`);
                        } catch (e) {
                            console.error(`Failed to checkout the previous commit (${prevCommitId}):`, e);
                        }
                    } else {
                        console.error('Could not determine the previous commit.');
                    }
                } catch (e) {
                    console.error(`Failed to clone the repository or checkout the commit (${commitId}):`, e);
                }

            } else {
                console.log(`No relevant strings found in changed files for issue #${issue.number}`);
            }
        }
    }

    // Process pull requests
    for (const pullRequest of pullRequests) {
        if (pullRequest.merged_at) {
            const commitId = pullRequest.merge_commit_sha;
            console.log(`\nPull Request #${pullRequest.number}: ${pullRequest.title}`);
            console.log(`Merged commit ID: ${commitId}`);

            const changedFiles = await getChangedFilesWithContent(repoUrl, githubToken, commitId);
            const relevantFiles = changedFiles.filter(file => containsImportStrings(file.content));

            if (relevantFiles.length > 0) {
                console.log(`Relevant files: ${relevantFiles.map(file => file.filename).join(', ')}`);

                const repoDir = path.join(saveDir, repo);
                const sanitizedPrTitle = sanitizeDirectoryName(pullRequest.title);
                const prDir = path.join(repoDir, 'pullrequest', sanitizedPrTitle);
                await createDirectory(repoDir);
                await createDirectory(path.join(repoDir, 'pullrequest'));
                await createDirectory(prDir);

                const mergeDir = path.join(prDir, `merge_${pullRequest.number}`);
                const premergeDir = path.join(prDir, `premerge_${pullRequest.number}`);

                try {
                    await cloneRepository(repoUrl, commitId, mergeDir);
                    console.log(`Repository state before merge saved in: ${mergeDir}`);

                    // プルリクエストのマージ先ブランチを取得
                    const targetBranchName = await getPullRequestBaseBranch(repoUrl, githubToken, pullRequest.number);
                    const prevCommitId = await getPrevCommitId(mergeDir, commitId, targetBranchName);

                    if (prevCommitId) {
                        try {
                            await cloneRepository(repoUrl, prevCommitId, premergeDir);
                            console.log(`Repository state after merge saved in: ${premergeDir}`);
                        } catch (e) {
                            console.error(`Failed to checkout the previous commit (${prevCommitId}):`, e);
                        }
                    } else {
                        console.error('Could not determine the previous commit.');
                    }
                } catch (e) {
                    console.error(`Failed to clone the repository or checkout the commit (${commitId}):`, e);
                }
            } else {
                console.log(`No relevant strings found in changed files for pullRequest #${pullRequest.number}`);
            }
        }
    }

}


//04
async function getFixedIssuesAndPullRequests(repoUrl, token) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const issuesUrl = `https://api.github.com/repos/${owner}/${repo}/issues?state=closed&per_page=100`;
    const pullsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&per_page=100`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
    };

    let fixedIssues = [];
    let pullRequests = [];

    try {
        let page = 1;
        let response;

        do {
            response = await axios.get(`${issuesUrl}&page=${page}`, { headers });
            await checkRateLimit(response.headers); // レートリミットのチェック
            const issues = response.data;

            const fixed = issues.filter(issue => issue.pull_request === undefined);
            fixedIssues = fixedIssues.concat(fixed);
            page++;
        } while (response.data.length > 0);
    } catch (error) {
        console.error('Error fetching issues:', error);
    }

    try {
        let page = 1;
        let response;

        do {
            response = await axios.get(`${pullsUrl}&page=${page}`, { headers });
            await checkRateLimit(response.headers); // レートリミットのチェック
            const pulls = response.data;
            pullRequests = pullRequests.concat(pulls);
            page++;
        } while (response.data.length > 0);
    } catch (error) {
        console.error('Error fetching pull requests:', error);
    }

    return { fixedIssues, pullRequests };
}

//05
async function getPullRequestInfo(repoUrl, token, issueNumber) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const pullsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/events`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
    };

    try {
        const response = await axios.get(pullsUrl, { headers });
        const events = response.data;

        for (const event of events) {
            if (event.event === 'closed' && event.commit_id) {
                return event.commit_id;
            }
        }

    } catch (error) {
        console.error(`Error fetching pull request info for issue #${issueNumber}:`, error);
    }
    return null;
}

//06
async function getChangedFilesWithContent(repoUrl, token, commitId) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${commitId}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
    };

    try {
        const response = await axios.get(commitUrl, { headers });
        const files = response.data.files;

        // ファイルのパスとコンテンツを取得
        const fileContents = [];
        for (const file of files) {
            if (isProgrammingFile(file.filename)) {
                const rawFileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${commitId}/${file.filename}`;
                try {
                    const fileContentResponse = await axios.get(rawFileUrl);
                    fileContents.push({ filename: file.filename, content: fileContentResponse.data });
                } catch (error) {
                    console.error(`Error fetching content for file ${file.filename}:`, error);
                }
            }
        }

        return fileContents;
    } catch (error) {
        console.error(`Error fetching changed files for commit ${commitId}:`, error);
        return [];
    }
}


//07
function isProgrammingFile(file) {
    return programmingFileExtensions.some(ext => file.endsWith(ext));
}

//08
function sanitizeDirectoryName(name) {
    // 空白を"_"に置き換え、特殊文字を"-"に置き換え
    let sanitized = name
        .replace(/\s+/g, '_') // 空白を"_"に置き換え
        .replace(/[^a-zA-Z0-9-_ぁ-んァ-ン一-龥]/g, '-'); // 特殊文字を"-"に置き換え、日本語を許容

    // 15文字に制限
    // if (sanitized.length > 15) {
    //     sanitized = sanitized.substring(0, 15);
    // }

    return sanitized;
}

//09
async function createDirectory(dir) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch (error) {
        console.error(`Error creating directory ${dir}:`, error);
    }
}

//10
async function cloneRepository(repoUrl, commitId, directory) {
    try {
        if (fs.existsSync(directory)) {
            console.log(`Directory ${directory} already exists. Removing it.`);
            fs.rmdirSync(directory, { recursive: true });
        }

        console.log(`Cloning repository into ${directory}`);
        await execPromise(`git clone ${repoUrl} ${directory}`);

        console.log('Directory exists after git clone:', fs.existsSync(directory));

        console.log(`Checking out commit ${commitId}`);
        await execPromise(`git -C ${directory} checkout ${commitId}`);

        console.log('Repository state saved in:', directory);
    } catch (error) {
        console.error('Error cloning or checking out repository:', error);
        throw error;
    }
}

//11
async function getPrevCommitId(repoDir, commitId, branchName) {
    const cdPath = path.join(rootPath, repoDir);

    try {
        // Get the commit date
        const commitDateCommand = `cd ${cdPath} && git show -s --format=%ci ${commitId}`;
        const commitDateOutput = (await execPromise(commitDateCommand)).stdout.trim();

        // Calculate the date 1 seconds before
        const commitDate = new Date(commitDateOutput);
        commitDate.setSeconds(commitDate.getSeconds() - 1);
        const isoDate = commitDate.toISOString().replace('Z', '+00:00'); // Replace 'Z' with '+00:00' for compatibility

        // Get the previous commit ID
        const command = `cd ${cdPath} && git log ${branchName} --pretty=format:"%H" --before="${isoDate}" -n 1`;
        const result = (await execPromise(command)).stdout.trim();

        if (result && result !== commitId) {
            return result;
        } else {
            console.error(`No previous commit found before commit ID ${commitId} on branch ${branchName}, or the commit ID is the same.`);
            return null;
        }
    } catch (error) {
        console.error(`Error getting previous commit ID before ${commitId} on branch ${branchName}:`, error);
        return null;
    }
}

//12
async function getDefaultBranch(repoUrl, token) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const repoInfoUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
    };

    try {
        const response = await axios.get(repoInfoUrl, { headers });
        return response.data.default_branch;
    } catch (error) {
        console.error('Error fetching default branch:', error);
        return null;
    }
}

function containsImportStrings(content) {
    return importStrings.some(str => content.includes(str));
}

async function getPullRequestBaseBranch(repoUrl, token, pullRequestNumber) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const pullsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullRequestNumber}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
    };

    try {
        const response = await axios.get(pullsUrl, { headers });
        return response.data.base.ref;  // マージ先のブランチ名
    } catch (error) {
        console.error(`Error fetching pull request info for PR #${pullRequestNumber}:`, error);
        return null;
    }
}



//02
function main() {
    const repoUrls = [];

    fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
            repoUrls.push(row.url);
        })
        .on('end', async () => {
            console.log('CSV file successfully processed');
            for (const repoUrl of repoUrls) {
                await processRepository(repoUrl);
            }
        });
}

//01
main();