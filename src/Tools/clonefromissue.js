/*********
 for bug dataset
 GitHubの  issue前後のリポジトリを取得する
 プルリクエストの前後を取得する
*********/

const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const githubToken = process.env.GITHUB_TOKEN;
const repoUrl = 'https://github.com/phongnguyend/Practical.CleanArchitecture';

const programmingFileExtensions = [
    '.go', '.cs', '.java', '.scala', '.ts', '.py', '.c', '.js', '.sh',
    '.html', '.css', '.pl', '.cpp', '.rs'
];

/*02*/
async function getFixedIssues(repoUrl, token) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const issuesUrl = `https://api.github.com/repos/${owner}/${repo}/issues?state=closed&per_page=100`;
    const headers = {
        'Authorization': `token ${token}`,
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

/*03*/
async function getPullRequestInfo(repoUrl, token, issueNumber) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const pullsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/events`;
    const headers = {
        'Authorization': `token ${token}`,
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

/*04*/
async function getChangedFiles(repoUrl, token, commitId) {
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
    const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${commitId}`;
    const headers = {
        'Authorization': `token ${token}`,
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

/*05*/
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

/*01*/
async function run() {
    const fixedIssues = await getFixedIssues(repoUrl, githubToken);

    console.log(`Found ${fixedIssues.length} fixed issues:`);

    for (const issue of fixedIssues) {
        console.log(`\n#${issue.number}: ${issue.title}`);

        const commitId = await getPullRequestInfo(repoUrl, githubToken, issue.number);
        if (commitId) {
            console.log(`Fix commit ID: ${commitId}`);

            const changedFiles = await getChangedFiles(repoUrl, githubToken, commitId);
            const programmingFiles = changedFiles.filter(isProgrammingFile);

            if (programmingFiles.length > 0) {
                console.log(`Changed programming files: ${programmingFiles.join(', ')}`);

                const preDir = path.join(__dirname, `repo_pre_${issue.number}`);
                const postDir = path.join(__dirname, `repo_post_${issue.number}`);

                await cloneRepository(repoUrl, commitId, preDir);

                console.log(`Repository state before merge saved in: ${preDir}`);

                await cloneRepository(repoUrl, 'main', postDir);

                console.log(`Repository state after merge saved in: ${postDir}`);

                fs.rmdirSync(preDir, { recursive: true });
                fs.rmdirSync(postDir, { recursive: true });
            } else {
                console.log(`No programming files changed for issue #${issue.number}`);
            }
        }
    }
}

/*00*/
run();
