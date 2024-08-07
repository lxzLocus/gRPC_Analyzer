/*********
 for bug dataset
 GitHubの  issue前後のリポジトリを取得する
 プルリクエストの前後を取得する
*********/
const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const csvFilePath = 'dataset/gRPC_reps_list.csv';
const saveDir = 'dataset/cloned_reps_issue';

const githubToken = process.env.GITHUB_TOKEN;

const programmingFileExtensions = [
    '.go', '.cs', '.java', '.scala', '.ts', '.py', '.c', '.js', '.sh',
    '.html', '.css', '.pl', '.cpp', '.rs'
];

async function getFixedIssues(repoUrl, token) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const issuesUrl = `https://api.github.com/repos/${owner}/${repo}/issues?state=closed&per_page=100`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
    };

    try {
        let page = 1;
        let fixedIssues = [];
        let response;

        do {
            response = await axios.get(`${issuesUrl}&page=${page}`, { headers });
            const issues = response.data;

            const fixed = issues.filter(issue => issue.pull_request === undefined);
            fixedIssues = fixedIssues.concat(fixed);
            page++;
        } while (response.data.length > 0);

        return fixedIssues;

    } catch (error) {
        console.error('Error fetching issues:', error);
        return [];
    }
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

async function cloneRepository(repoUrl, commitId, directory) {
    try {
        execSync(`git clone ${repoUrl} ${directory}`);
        process.chdir(directory);
        execSync(`git checkout ${commitId}`);
    } catch (error) {
        console.error('Error cloning or checking out repository:', error);
    }
}

function isProgrammingFile(file) {
    return programmingFileExtensions.some(ext => file.endsWith(ext));
}

async function createDirectory(dir) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch (error) {
        console.error(`Error creating directory ${dir}:`, error);
    }
}

async function processRepository(repoUrl) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const fixedIssues = await getFixedIssues(repoUrl, githubToken);

    console.log(`Found ${fixedIssues.length} fixed issues for repository ${repoUrl}:`);

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
                const issueDir = path.join(repoDir, 'issue', issue.title);

                // Create directories
                await createDirectory(repoDir);
                await createDirectory(path.join(repoDir, 'issue'));
                await createDirectory(issueDir);

                const preDir = path.join(issueDir, `repo_pre_${issue.number}`);
                const postDir = path.join(issueDir, `repo_post_${issue.number}`);

                await cloneRepository(repoUrl, commitId, preDir);

                console.log(`Repository state before merge saved in: ${preDir}`);

                await cloneRepository(repoUrl, 'main', postDir);

                console.log(`Repository state after merge saved in: ${postDir}`);

                // Cleanup directories
                try {
                    fs.rmdirSync(preDir, { recursive: true });
                    fs.rmdirSync(postDir, { recursive: true });
                } catch (err) {
                    console.error('Error removing directories:', err);
                }
            } else {
                console.log(`No programming files changed for issue #${issue.number}`);
            }
        }
    }
}


function run() {
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

run();
