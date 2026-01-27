/**
 * commit_messages.json を扱うユーティリティサンプル
 * 
 * このファイルは commit_messages.json の読み込みと操作のサンプルです。
 */

import fs from 'fs';
import path from 'path';

/**
 * commit_messages.json を読み込む
 * @param {string} filePath - commit_messages.json のパス
 * @returns {import('./types/CommitMessages.js').CommitMessages}
 */
export function loadCommitMessages(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 指定されたディレクトリから commit_messages.json を探して読み込む
 * @param {string} prDirectory - PR のディレクトリパス
 * @returns {import('./types/CommitMessages.js').CommitMessages | null}
 */
export function findAndLoadCommitMessages(prDirectory) {
  const commitMessagesPath = path.join(prDirectory, 'commit_messages.json');
  
  if (fs.existsSync(commitMessagesPath)) {
    return loadCommitMessages(commitMessagesPath);
  }
  
  return null;
}

/**
 * コミット情報の要約を取得
 * @param {import('./types/CommitMessages.js').CommitMessages} commitMessages
 * @returns {Object}
 */
export function summarizeCommitMessages(commitMessages) {
  return {
    totalCommits: commitMessages.all_commits.length,
    mergeCommitHash: commitMessages.merge_commit.hash.substring(0, 7),
    protoChangeCommitHash: commitMessages.proto_commit.hash.substring(0, 7),
    authors: [...new Set(commitMessages.all_commits.map(c => c.author))],
    subjects: commitMessages.all_commits.map(c => c.subject)
  };
}

/**
 * バグ修正に関連するキーワードを含むコミットを抽出
 * @param {import('./types/CommitMessages.js').CommitMessages} commitMessages
 * @returns {import('./types/CommitMessages.js').CommitInfo[]}
 */
export function extractBugFixCommits(commitMessages) {
  const bugFixKeywords = ['fix', 'bug', 'issue', 'resolve', 'patch'];
  
  return commitMessages.all_commits.filter(commit => {
    const text = `${commit.subject} ${commit.body}`.toLowerCase();
    return bugFixKeywords.some(keyword => text.includes(keyword));
  });
}

/**
 * 使用例
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // 使用例を実行
  const examplePath = '/app/dataset/filtered_fewChanged/boulder/issue/Implement_RA_method_for_unpausing_accounts/commit_messages.json';
  
  if (fs.existsSync(examplePath)) {
    console.log('=== commit_messages.json 読み込みサンプル ===\n');
    
    const commitMessages = loadCommitMessages(examplePath);
    
    console.log('📊 要約:');
    const summary = summarizeCommitMessages(commitMessages);
    console.log(`  総コミット数: ${summary.totalCommits}`);
    console.log(`  マージコミット: ${summary.mergeCommitHash}`);
    console.log(`  Proto変更コミット: ${summary.protoChangeCommitHash}`);
    console.log(`  作成者: ${summary.authors.join(', ')}`);
    
    console.log('\n🔍 バグ修正関連コミット:');
    const bugFixes = extractBugFixCommits(commitMessages);
    bugFixes.forEach(commit => {
      console.log(`  - ${commit.hash.substring(0, 7)}: ${commit.subject}`);
    });
    
    console.log('\n📝 全コミット一覧:');
    commitMessages.all_commits.forEach((commit, index) => {
      console.log(`  ${index + 1}. ${commit.hash.substring(0, 7)} by ${commit.author}`);
      console.log(`     ${commit.subject}`);
    });
  } else {
    console.log('サンプルファイルが見つかりません');
  }
}
