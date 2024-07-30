import requests
import os
import shutil
from datetime import datetime
from git import Repo

import src/__config__

# GitHub APIトークンをここに設定してください
GITHUB_TOKEN = __config__.GITHUB_PERSONAL_ACCESS_TOKEN
REPO_OWNER = 'octocat'
REPO_NAME = 'Hello-World'
LABEL = 'fix'
CLONE_DIR = 'repos'

# 必要なディレクトリを作成
if not os.path.exists(CLONE_DIR):
    os.makedirs(CLONE_DIR)

def is_programming_file(filename):
    """ファイルがプログラミング言語で書かれているか確認する"""
    programming_file_extensions = ['.py', '.js', '.java', '.cpp', '.c', '.cs', '.rb', '.go', '.rs', '.ts', '.php', '.html', '.css']
    return any(filename.endswith(ext) for ext in programming_file_extensions)

def get_issues_with_label(owner, repo, label):
    """特定のラベルを持つイシューを取得する"""
    url = f'https://api.github.com/repos/{owner}/{repo}/issues'
    headers = {'Authorization': f'token {GITHUB_TOKEN}'}
    params = {'labels': label, 'state': 'closed'}
    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    return response.json()

def get_pull_request_files(owner, repo, pr_number):
    """プルリクエストの変更ファイルを取得する"""
    url = f'https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files'
    headers = {'Authorization': f'token {GITHUB_TOKEN}'}
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()

def get_pull_request_commits(owner, repo, pr_number):
    """プルリクエストのコミットを取得する"""
    url = f'https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/commits'
    headers = {'Authorization': f'token {GITHUB_TOKEN}'}
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()

def clone_repo_at_commit(repo_url, commit_sha, clone_path):
    """指定されたコミットSHAでリポジトリをクローンする"""
    if os.path.exists(clone_path):
        shutil.rmtree(clone_path)
    repo = Repo.clone_from(repo_url, clone_path)
    repo.git.checkout(commit_sha)

def main():
    issues = get_issues_with_label(REPO_OWNER, REPO_NAME, LABEL)
    repo_url = f'https://github.com/{REPO_OWNER}/{REPO_NAME}.git'

    for issue in issues:
        if 'pull_request' in issue:
            pr_number = issue['number']
            pr_files = get_pull_request_files(REPO_OWNER, REPO_NAME, pr_number)
            if any(is_programming_file(file['filename']) for file in pr_files):
                pr_commits = get_pull_request_commits(REPO_OWNER, REPO_NAME, pr_number)
                merge_commit_sha = pr_commits[-1]['sha']
                merged_at = datetime.strptime(issue['closed_at'], '%Y-%m-%dT%H:%M:%SZ')
                
                repo = Repo.clone_from(repo_url, os.path.join(CLONE_DIR, f'{REPO_NAME}-before-{issue["number"]}'))
                commits = list(repo.iter_commits('main'))
                for commit in commits:
                    if datetime.strptime(commit.committed_datetime.strftime('%Y-%m-%dT%H:%M:%SZ'), '%Y-%m-%dT%H:%M:%SZ') < merged_at:
                        last_commit_sha = commit.hexsha
                        break
                
                # クローンしてコミットチェックアウト
                clone_repo_at_commit(repo_url, last_commit_sha, os.path.join(CLONE_DIR, f'{REPO_NAME}-before-{issue["number"]}'))
                clone_repo_at_commit(repo_url, merge_commit_sha, os.path.join(CLONE_DIR, f'{REPO_NAME}-after-{issue["number"]}'))

if __name__ == '__main__':
    main()
