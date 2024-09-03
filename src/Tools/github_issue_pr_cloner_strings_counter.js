/*********
 for bug dataset
 GitHubの  issue前後のリポジトリを取得する
 プルリクエストの前後を取得する

 ファイルの中に文字列あったらクローンする

  sudo git config --system core.longpaths true
  or
  .git/config [core] longpaths = true 追加
*********/
const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

const githubToken = process.env.GITHUB_TOKEN;


/*settings*/
const csvFilePath = 'dataset/temp.csv';

//issue取得拡張子定義
const programmingFileExtensions = [
    '.go', '.cs', '.java', '.scala', '.ts', '.py', '.c', '.js', '.sh',
    '.html', '.css', '.pl', '.cpp', '.rs', '.proto', '.protoc'
];

const importStrings = [
    'import "google.golang.org/grpc"', 'using Grpc.Core;', 'import io.grpc.',
    'import * as grpc from', 'import grpc', '#include <grpc/grpc.h>',
    'const grpc = require(', 'syntax = "proto3"', 'service '
];

//03
async function processRepository(repoUrl) {
    const { fixedIssues, pullRequests } = await getFixedIssuesAndPullRequests(repoUrl, githubToken);
    console.log(`FILTER Found ${fixedIssues.length} fixed issues and ${pullRequests.length} closed pull requests for repository ${repoUrl}:`);
    let relevantIssueCount = 0;
    let relevantPullRequestCount = 0;

    // Process issues
    for (const issue of fixedIssues) {
        const commitId = await getPullRequestInfo(repoUrl, githubToken, issue.number);
        if (commitId) {
            const changedFiles = await getChangedFilesWithContent(repoUrl, githubToken, commitId);
            const relevantFiles = changedFiles.filter(file => containsImportStrings(file.content));

            if (relevantFiles.length > 0) {
                relevantIssueCount++;
            }
        }
    }

    // Process pull requests
    for (const pullRequest of pullRequests) {
        if (pullRequest.merged_at) {
            const commitId = pullRequest.merge_commit_sha;
            const changedFiles = await getChangedFilesWithContent(repoUrl, githubToken, commitId);
            const relevantFiles = changedFiles.filter(file => containsImportStrings(file.content));

            if (relevantFiles.length > 0) {
                relevantPullRequestCount++;
            }
        }
    }
    console.log(`FILTER Cloneable issues: ${relevantIssueCount}`);
    console.log(`FILTER Cloneable pull requests: ${relevantPullRequestCount}`);

    return { relevantIssueCount, relevantPullRequestCount };
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
            response = await axios.get(`${issuesUrl}&page=${page}`, { headers });
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
function containsImportStrings(content) {
    return importStrings.some(str => content.includes(str));
}

//02
async function main() {
    const repoUrls = [];
    let totalIssues = 0;
    let totalPullRequests = 0;

    fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
            repoUrls.push(row.url);
        })
        .on('end', async () => {
            console.log('CSV file successfully processed');
            for (const repoUrl of repoUrls) {
                const { relevantIssueCount, relevantPullRequestCount } = await processRepository(repoUrl);
                totalIssues += relevantIssueCount;
                totalPullRequests += relevantPullRequestCount;
            }

            console.log(`Total relevant issues: ${totalIssues}`);
            console.log(`Total relevant pull requests: ${totalPullRequests}`);
        });
}

//01
main();
