const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

const githubToken = process.env.GITHUB_TOKEN;

/*settings*/
const csvFilePath = 'dataset/temp.csv';

// Issue取得拡張子定義
const programmingFileExtensions = [
    '.go', '.cs', '.java', '.scala', '.ts', '.py', '.c', '.js', '.sh',
    '.html', '.css', '.pl', '.cpp', '.rs', '.proto', '.protoc'
];

// メイン関数
async function processRepository(repoUrl) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const { fixedIssues, pullRequests } = await getFixedIssuesAndPullRequests(repoUrl, githubToken);

    console.log(`Found ${fixedIssues.length} fixed issues and ${pullRequests.length} closed pull requests for repository ${repoUrl}:`);

    let cloneableIssues = 0;
    let cloneablePullRequests = 0;

    // Process issues
    for (const issue of fixedIssues) {
        const commitId = await getPullRequestInfo(repoUrl, githubToken, issue.number);
        if (commitId) {
            const changedFiles = await getChangedFiles(repoUrl, githubToken, commitId);
            const programmingFiles = changedFiles.filter(isProgrammingFile);

            if (programmingFiles.length > 0) {
                cloneableIssues++;
            }
        }
    }

    // Process pull requests
    for (const pullRequest of pullRequests) {
        if (pullRequest.merged_at) {
            const commitId = pullRequest.merge_commit_sha;
            const changedFiles = await getChangedFiles(repoUrl, githubToken, commitId);
            const programmingFiles = changedFiles.filter(isProgrammingFile);

            if (programmingFiles.length > 0) {
                cloneablePullRequests++;
            }
        }
    }

    console.log(`Cloneable issues: ${cloneableIssues}`);
    console.log(`Cloneable pull requests: ${cloneablePullRequests}`);
}


// GitHub APIからクローズされたIssueとPull Requestを取得
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

    // クローズされたIssueを取得
    try {
        let page = 1;
        let response;

        do {
            response = await axios.get(`${issuesUrl}&page=${page}`, { headers });
            const issues = response.data;

            const fixed = issues.filter(issue => issue.pull_request === undefined);
            fixedIssues = fixedIssues.concat(fixed);
            page++;
        } while (response.data.length > 0);
    } catch (error) {
        console.error('Issueの取得エラー:', error);
    }

    // クローズされたPull Requestを取得
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
        console.error('Pull Requestの取得エラー:', error);
    }

    return { fixedIssues, pullRequests };
}

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

async function getChangedFiles(repoUrl, token, commitId) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${commitId}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
    };

    try {
        const response = await axios.get(commitUrl, { headers });
        const files = response.data.files;

        return files.map(file => file.filename);
    } catch (error) {
        console.error(`Error fetching changed files for commit ${commitId}:`, error);
        return [];
    }
}

function isProgrammingFile(file) {
    return programmingFileExtensions.some(ext => file.endsWith(ext));
}

// CSVファイルを読み込んでリポジトリを処理
function main() {
    const repoUrls = [];

    fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
            repoUrls.push(row.url);
        })
        .on('end', async () => {
            console.log('CSVファイルの処理が完了しました');
            for (const repoUrl of repoUrls) {
                await processRepository(repoUrl);
            }
        });
}

main();
