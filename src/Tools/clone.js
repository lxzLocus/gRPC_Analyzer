/*********
 for bug dataset
 GitHubの  issue前後のリポジトリを取得する
 プルリクエストの前後を取得する

  sudo git config --system core.longpaths true
  or
  .git/config [core] longpaths = true 追加
*********/
const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const githubToken = process.env.GITHUB_TOKEN;


/*settings*/
const csvFilePath = 'dataset/temp.csv';
const saveDir = 'dataset/clone';
// const saveDir = 'dataset/cloned_reps_issue';

//issue取得拡張子定義
const programmingFileExtensions = [
    '.go', '.cs', '.java', '.scala', '.ts', '.py', '.c', '.js', '.sh',
    '.html', '.css', '.pl', '.cpp', '.rs', '.proto', '.protoc'
];

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

            const changedFiles = await getChangedFiles(repoUrl, githubToken, commitId);
            const programmingFiles = changedFiles.filter(isProgrammingFile);

            if (programmingFiles.length > 0) {
                console.log(`Changed programming files: ${programmingFiles.join(', ')}`);

                const repoDir = path.join(saveDir, repo);
                const sanitizedIssueTitle = sanitizeDirectoryName(issue.title); // ここでタイトルをサニタイズ
                const issueDir = path.join(repoDir, 'issue', sanitizedIssueTitle);
                await createDirectory(repoDir);
                await createDirectory(path.join(repoDir, 'issue'));
                await createDirectory(issueDir);

                const preDir = path.join(issueDir, `pre_${issue.number}`);
                const mergeDir = path.join(issueDir, `post_${issue.number}`);

                await cloneRepository(repoUrl, commitId, preDir);
                console.log(`Repository state before merge saved in: ${preDir}`);

                // Get the next commit after the pre-merge commit
                const nextCommitId = await getNextCommitId(preDir, commitId);
                if (nextCommitId) {
                    try {
                        await cloneRepository(repoUrl, nextCommitId, mergeDir);
                        console.log(`Repository state after merge saved in: ${mergeDir}`);
                    } catch (e) {
                        console.error(`Failed to checkout the next commit (${nextCommitId}):`, e);
                    }
                } else {
                    console.error('Could not determine the next commit.');
                }

            } else {
                console.log(`No programming files changed for issue #${issue.number}`);
            }
        }
    }

    // Process pull requests
    for (const pullRequest of pullRequests) {
        //マージされたかどうか判定
        if (pullRequest.merged_at) {
            const commitId = pullRequest.merge_commit_sha;
            console.log(`\nPull Request #${pullRequest.number}: ${pullRequest.title}`);
            console.log(`Merged commit ID: ${commitId}`);

            const changedFiles = await getChangedFiles(repoUrl, githubToken, commitId);
            const programmingFiles = changedFiles.filter(isProgrammingFile);

            if (programmingFiles.length > 0) {
                console.log(`Changed programming files: ${programmingFiles.join(', ')}¥n`);

                const repoDir = path.join(saveDir, repo);
                const sanitizedPrTitle = sanitizeDirectoryName(pullRequest.title); // ここでタイトルをサニタイズ
                const prDir = path.join(repoDir, 'pullrequest', sanitizedPrTitle);
                await createDirectory(repoDir);
                await createDirectory(path.join(repoDir, 'pullrequest'));
                await createDirectory(prDir);

                const preDir = path.join(prDir, `pre_${pullRequest.number}`);
                const mergeDir = path.join(prDir, `merge_${pullRequest.number}`);

                await cloneRepository(repoUrl, commitId, preDir);
                console.log(`Repository state before merge saved in: ${preDir}`);

                // Get the next commit after the pre-merge commit
                const nextCommitId = await getNextCommitId(preDir, commitId);
                if (nextCommitId) {
                    try {
                        await cloneRepository(repoUrl, nextCommitId, mergeDir);
                        console.log(`Repository state after merge saved in: ${mergeDir}`);
                    } catch (e) {
                        console.error(`Failed to checkout the next commit (${nextCommitId}):`, e);
                    }
                } else {
                    console.error('Could not determine the next commit.');
                }

            } else {
                console.log(`No programming files changed for pull request #${pullRequest.number}`);
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

    // Fetch closed issues
    try {
        let page = 1;
        let response;

        do {
            response = await axios.get(`${issuesUrl}&page=${page}`, { headers }, { timeout: 10000 });
            const issues = response.data;

            const fixed = issues.filter(issue => issue.pull_request === undefined);
            fixedIssues = fixedIssues.concat(fixed);
            page++;
        } while (response.data.length > 0);
    } catch (error) {
        console.error('Error fetching issues:', error);
    }

    // Fetch closed pull requests
    try {
        let page = 1;
        let response;

        do {
            response = await axios.get(`${pullsUrl}&page=${page}`, { headers }, { timeout: 10000 });
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
        const response = await axios.get(pullsUrl, { headers }, { timeout: 10000 });
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
async function getChangedFiles(repoUrl, token, commitId) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${commitId}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
    };

    try {
        const response = await axios.get(commitUrl, { headers }, { timeout: 10000 });
        const files = response.data.files;

        return files.map(file => file.filename);
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
        .replace(/[^a-zA-Z0-9-_]/g, '-'); // 特殊文字を"-"に置き換え

    // 15文字に制限
    if (sanitized.length > 15) {
        sanitized = sanitized.substring(0, 15);
    }

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
        // Check if the directory already exists
        if (fs.existsSync(directory)) {
            console.log(`Directory ${directory} already exists. Removing it.`);
            fs.rmdirSync(directory, { recursive: true });
        }

        // Clone the repository
        execSync(`git clone ${repoUrl} ${directory}`);
        console.log(`GITCLONENING : git clone ${repoUrl} ${directory}`);

        // Change to the cloned directory
        process.chdir(directory);

        // Checkout the specified commit
        execSync(`git checkout ${commitId}`);
        console.log(`GITCHECKOUT : git checkout ${commitId}`);
    } catch (error) {
        console.error('Error cloning or checking out repository:', error);
    }
}

//11
async function getNextCommitId(repoDir, commitId) {
    const command = `cd ${repoDir} && git log --pretty=format:"%H" --reverse ${commitId}..HEAD | head -n 1`;
    try {
        const result = execSync(command).toString().trim();
        return result;
    } catch (error) {
        console.error(`Error getting next commit ID after ${commitId}:`, error);
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
        const response = await axios.get(repoInfoUrl, { headers }, { timeout: 10000 });
        return response.data.default_branch;
    } catch (error) {
        console.error('Error fetching default branch:', error);
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