#!/usr/bin/env node
/**
 * データセット再構築プログラム
 * raw_clonedから正しい状態でpremergeとcommit_snapshotを作成
 *
 * 処理フロー:
 * 1. raw_clonedの各PRについて、premerge/mergeのgitリポジトリを読み込む
 * 2. premerge HEADの状態を保存
 * 3. merge HEADの第2親（プルリク側）の履歴で初めてprotoファイルが変更されたコミットを探す
 * 4. そのコミットをcommit_snapshot_XXXとして保存
 * 5. フィルタリング条件を適用（7ファイル以下、30行以下）
 * 6. 条件を満たすPRをfiltered_fewChangedに保存
 *
 * 使用方法:
 *   npm run rebuild-dataset
 *   または
 *   node --loader ts-node/esm src/utils/rebuildDatasetFromRawCloned.ts
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { CommitMessages, CommitInfo } from '../types/CommitMessages.js';

// ===== 設定 =====
const RAW_CLONED_DIR = '/app/dataset/raw_cloned';
const OUTPUT_DIR = '/app/dataset/filtered_fewChanged';
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_PROJECT = 'loop'; // テストモード時に処理するプロジェクト
const QUICK_MODE = process.argv.includes('--quick'); // 最初の3プロジェクト、各5PRのみ処理
const SKIP_EXISTING = process.argv.includes('--skip-existing'); // 既存のPRをスキップ

// フィルタリング条件
const MAX_CHANGED_FILES = 7;
const MAX_CHANGED_LINES_PER_FILE = 30;
const COUNT_DELETED_FILES = false;

// ===== 除外ルール（generatePrompt.tsと統一） =====

// gRPC自動生成ファイル
const GRPC_GEN_PATTERNS = [
  '.pb.', '_pb2.', '.pb2.', '.pb.go', '.pb.cc', '.pb.h',
  '.pb.rb', '.pb.swift', '.pb.m', '.pb-c.', '.pb-c.h', '.pb-c.c'
];

// 除外対象ファイル・ディレクトリ
const EXCLUDED_PATTERNS = [
  '.md', '.markdown', '.log', '.lock',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  'Dockerfile', 'docker-compose.yml', '.dockerignore',
  'LICENSE', '.github/', '.circleci/', '.vscode/', 'docs/'
];

/**
 * ファイルが自動生成ファイルかどうかを判定
 */
function isGeneratedFile(filePath: string): boolean {
  return GRPC_GEN_PATTERNS.some(pat => filePath.includes(pat));
}

/**
 * ファイルがテストファイルかどうかを判定
 */
function isTestFile(filePath: string): boolean {
  return filePath.toLowerCase().includes('test');
}

/**
 * ファイルが除外対象かどうかを判定
 */
function shouldExcludeFile(filePath: string): boolean {
  // 自動生成ファイル
  if (isGeneratedFile(filePath)) return true;
  
  // テストファイル
  if (isTestFile(filePath)) return true;
  
  // 除外パターン
  if (EXCLUDED_PATTERNS.some(pat => filePath.includes(pat))) return true;
  
  return false;
}

/**
 * gitリポジトリから特定のコミットをチェックアウトしてディレクトリにコピー
 */
function checkoutCommitToDirectory(gitRepoPath: string, commitHash: string, outputPath: string): void {
  // 一時ディレクトリを使用してチェックアウト
  const tempDir = path.join('/tmp', `checkout_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  
  try {
    // git archive を使用してクリーンなチェックアウト
    fs.mkdirSync(tempDir, { recursive: true });
    const archiveCmd = `cd "${gitRepoPath}" && git archive ${commitHash} | tar -x -C "${tempDir}"`;
    execSync(archiveCmd, { encoding: 'utf-8', stdio: 'pipe' });
    
    // 出力先にコピー
    fs.mkdirSync(outputPath, { recursive: true });
    execSync(`cp -r "${tempDir}/." "${outputPath}/"`, { encoding: 'utf-8', stdio: 'pipe' });
  } finally {
    // 一時ディレクトリを削除
    if (fs.existsSync(tempDir)) {
      execSync(`rm -rf "${tempDir}"`, { encoding: 'utf-8', stdio: 'pipe' });
    }
  }
}

/**
 * merge commitの第2親（プルリク側のブランチの先頭）を取得
 */
function getPullRequestBranch(gitRepoPath: string, mergeHead: string): string | null {
  try {
    // merge commitの親の数を確認
    const parentsCmd = `cd "${gitRepoPath}" && git rev-list --parents -n 1 ${mergeHead} 2>/dev/null || echo ""`;
    const parentsOutput = execSync(parentsCmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
    
    if (!parentsOutput) {
      return null;
    }
    
    const parents = parentsOutput.split(' ').slice(1); // 最初は自分自身のハッシュ
    
    if (parents.length < 2) {
      // 親が1つしかない = fast-forwardマージまたは通常のコミット
      console.log('      ℹ️  merge commitに第2親がありません（fast-forwardマージの可能性）');
      return null;
    }
    
    // 第2親（プルリク側のブランチの先頭）
    const prBranchHead = parents[1];
    
    return prBranchHead;
  } catch (error: any) {
    console.error(`      ⚠️ プルリクブランチ取得エラー: ${error.message}`);
    return null;
  }
}

/**
 * プルリク側のブランチで初めてprotoファイルが変更されたコミットを探す
 */
function findFirstProtoChangeCommit(
  gitRepoPath: string, 
  premergeHead: string, 
  mergeHead: string
): string | null {
  try {
    // merge commitの第2親（プルリク側の先頭）を取得
    const prBranchHead = getPullRequestBranch(gitRepoPath, mergeHead);
    
    if (!prBranchHead) {
      // 第2親がない場合は通常のコミット範囲で探す
      console.log('      ℹ️  通常のコミット範囲で検索します');
      return findProtoChangeInRange(gitRepoPath, premergeHead, mergeHead);
    }
    
    console.log(`      🔍 プルリクブランチ: ${prBranchHead.substring(0, 7)}`);
    
    // プルリク側のブランチ全体を取得（premerge..prBranchHead）
    const commitsCmd = `cd "${gitRepoPath}" && git rev-list --reverse ${premergeHead}..${prBranchHead}`;
    const commitsOutput = execSync(commitsCmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
    
    if (!commitsOutput) {
      console.log('      ⚠️  プルリク側にコミットが見つかりません');
      return null;
    }
    
    const commits = commitsOutput.split('\n');
    console.log(`      📋 ${commits.length}個のコミットを検査中...`);
    
    // 各コミットでprotoファイルが変更されているかチェック
    for (const commit of commits) {
      const diffCmd = `cd "${gitRepoPath}" && git diff --name-only ${commit}^ ${commit} 2>/dev/null || true`;
      const changedFiles = execSync(diffCmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
      
      if (changedFiles) {
        const files = changedFiles.split('\n');
        const protoFiles = files.filter(file => file.endsWith('.proto'));
        
        if (protoFiles.length > 0) {
          console.log(`      ✅ 初めてprotoが変更されたコミット: ${commit.substring(0, 7)}`);
          console.log(`         変更されたprotoファイル: ${protoFiles.join(', ')}`);
          
          // 内容が実際に変更されているか確認
          if (hasActualProtoChanges(gitRepoPath, commit, protoFiles, premergeHead)) {
            return commit;
          } else {
            console.log(`      ⚠️  protoファイルの内容に変更がありません（追加のみ）、次を検索...`);
          }
        }
      }
    }
    
    console.log('      ⚠️  protoファイルの変更が見つかりませんでした');
    return null;
  } catch (error: any) {
    console.error(`      ❌ エラー: ${error.message}`);
    return null;
  }
}

/**
 * 通常のコミット範囲でproto変更を探す（第2親がない場合）
 */
function findProtoChangeInRange(
  gitRepoPath: string,
  premergeHead: string,
  mergeHead: string
): string | null {
  try {
    const commitsCmd = `cd "${gitRepoPath}" && git rev-list --reverse ${premergeHead}..${mergeHead}`;
    const commitsOutput = execSync(commitsCmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
    
    if (!commitsOutput) {
      console.log('      ⚠️  コミットが見つかりません');
      return null;
    }
    
    const commits = commitsOutput.split('\n');
    console.log(`      📋 ${commits.length}個のコミットを検査中...`);
    
    for (const commit of commits) {
      const diffCmd = `cd "${gitRepoPath}" && git diff --name-only ${commit}^ ${commit} 2>/dev/null || true`;
      const changedFiles = execSync(diffCmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
      
      if (changedFiles) {
        const files = changedFiles.split('\n');
        const protoFiles = files.filter(file => file.endsWith('.proto'));
        
        if (protoFiles.length > 0) {
          console.log(`      ✅ 初めてprotoが変更されたコミット: ${commit.substring(0, 7)}`);
          
          if (hasActualProtoChanges(gitRepoPath, commit, protoFiles, premergeHead)) {
            return commit;
          }
        }
      }
    }
    
    return null;
  } catch (error: any) {
    console.error(`      ❌ エラー: ${error.message}`);
    return null;
  }
}

/**
 * protoファイルが実際に内容変更されているか確認
 */
function hasActualProtoChanges(
  gitRepoPath: string,
  commit: string,
  protoFiles: string[],
  premergeHead: string
): boolean {
  try {
    for (const protoFile of protoFiles) {
      // premerge時点でファイルが存在するか確認
      const premergeExistsCmd = `cd "${gitRepoPath}" && git cat-file -e ${premergeHead}:${protoFile} 2>/dev/null && echo "exists" || echo "new"`;
      const premergeExists = execSync(premergeExistsCmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
      
      if (premergeExists === 'new') {
        // 新規ファイルの場合は常にtrueを返す
        console.log(`         ${protoFile}: 新規追加`);
        return true;
      }
      
      // 差分を確認
      const diffCmd = `cd "${gitRepoPath}" && git diff ${premergeHead} ${commit} -- ${protoFile}`;
      const diff = execSync(diffCmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
      
      if (diff) {
        console.log(`         ${protoFile}: 内容変更あり`);
        return true;
      }
    }
    
    return false;
  } catch (error: any) {
    console.error(`      ⚠️ 差分確認エラー: ${error.message}`);
    return true; // エラー時は念のためtrueを返す
  }
}

/**
 * コミットメッセージとPR情報をJSON形式で保存
 */
function saveCommitMessages(
  gitRepoPath: string,
  premergeHead: string,
  mergeHead: string,
  protoChangeCommit: string,
  outputPath: string
): void {
  try {
    const data: CommitMessages = {
      premerge_head: premergeHead,
      merge_head: mergeHead,
      proto_change_commit: protoChangeCommit,
      merge_commit: {} as CommitInfo,
      proto_commit: {} as CommitInfo,
      all_commits: []
    };
    
    // === Merge Commit (PR マージ時のコミット) ===
    const mergeCommitInfo = execSync(
      `cd "${gitRepoPath}" && git log -1 --format="%H%n%an%n%ae%n%ad%n%s%n%b" ${mergeHead}`,
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim();
    
    const mergeLines = mergeCommitInfo.split('\n');
    data.merge_commit = {
      hash: mergeLines[0],
      author: mergeLines[1],
      email: mergeLines[2],
      date: mergeLines[3],
      subject: mergeLines[4] || '',
      body: mergeLines.slice(5).join('\n').trim()
    };
    
    // === Proto Change Commit (最初にprotoが変更されたコミット) ===
    const protoCommitInfo = execSync(
      `cd "${gitRepoPath}" && git log -1 --format="%H%n%an%n%ae%n%ad%n%s%n%b" ${protoChangeCommit}`,
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim();
    
    const protoLines = protoCommitInfo.split('\n');
    data.proto_commit = {
      hash: protoLines[0],
      author: protoLines[1],
      email: protoLines[2],
      date: protoLines[3],
      subject: protoLines[4] || '',
      body: protoLines.slice(5).join('\n').trim()
    };
    
    // === All Commits in PR (プルリク側のブランチ全体) ===
    // merge commitの第2親を取得
    const prBranchHead = getPullRequestBranch(gitRepoPath, mergeHead);
    
    let commitRange: string;
    if (prBranchHead) {
      // プルリク側のブランチの全コミット
      commitRange = `${premergeHead}..${prBranchHead}`;
    } else {
      // 第2親がない場合は通常の範囲
      commitRange = `${premergeHead}..${mergeHead}`;
    }
    
    const allCommitsInfo = execSync(
      `cd "${gitRepoPath}" && git log --format="%H%n%an%n%ae%n%ad%n%s%n%b%n---COMMIT_END---" ${commitRange}`,
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim();
    
    if (allCommitsInfo) {
      const commitBlocks = allCommitsInfo.split('---COMMIT_END---\n').filter(b => b.trim());
      
      for (const block of commitBlocks) {
        const lines = block.trim().split('\n');
        if (lines.length >= 5) {
          data.all_commits.push({
            hash: lines[0],
            author: lines[1],
            email: lines[2],
            date: lines[3],
            subject: lines[4] || '',
            body: lines.slice(5).join('\n').trim()
          });
        }
      }
    }
    
    // merge commitも追加（参考情報として）
    if (prBranchHead && data.merge_commit.hash !== prBranchHead) {
      data.all_commits.push({
        ...data.merge_commit,
        body: `${data.merge_commit.body}\n---COMMIT_END---`
      });
    }
    
    // JSON形式で保存
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    
  } catch (error: any) {
    console.error(`      ⚠️ コミットメッセージ保存エラー: ${error.message}`);
  }
}

/**
 * premergeとmergeのHEADコミットハッシュを取得
 */
function getHeadCommits(premergeDir: string, mergeDir: string): { premergeHead: string, mergeHead: string } | null {
  try {
    const premergeHead = execSync(`cd "${premergeDir}" && git rev-parse HEAD`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
    const mergeHead = execSync(`cd "${mergeDir}" && git rev-parse HEAD`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
    
    return { premergeHead, mergeHead };
  } catch (error: any) {
    console.error(`      ❌ HEADコミット取得エラー: ${error.message}`);
    return null;
  }
}

/**
 * 2つのディレクトリを比較して変更を分析
 */
function analyzeChanges(premergeDir: string, snapshotDir: string): {
  addedFiles: string[];
  modifiedFiles: { path: string; changedLines: number }[];
  totalChangedLines: number;
  meetsCriteria: boolean;
} {
  const analysis = {
    addedFiles: [] as string[],
    modifiedFiles: [] as { path: string; changedLines: number }[],
    totalChangedLines: 0,
    meetsCriteria: false
  };
  
  try {
    // 全ファイル一覧を取得
    const getAllFiles = (dir: string, baseDir: string = dir): string[] => {
      const files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== '.git') {
          files.push(...getAllFiles(fullPath, baseDir));
        } else if (entry.isFile()) {
          files.push(path.relative(baseDir, fullPath));
        }
      }
      
      return files;
    };
    
    const premergeFiles = new Set(getAllFiles(premergeDir));
    const snapshotFiles = new Set(getAllFiles(snapshotDir));
    
    // 追加されたファイル
    for (const file of snapshotFiles) {
      if (!premergeFiles.has(file) && !shouldExcludeFile(file)) {
        analysis.addedFiles.push(file);
      }
    }
    
    // ファイル数チェック
    if (analysis.addedFiles.length > MAX_CHANGED_FILES) {
      return analysis;
    }
    
    // 変更されたファイル
    for (const file of snapshotFiles) {
      if (premergeFiles.has(file) && !shouldExcludeFile(file)) {
        const premergeFile = path.join(premergeDir, file);
        const snapshotFile = path.join(snapshotDir, file);
        
        try {
          const premergeContent = fs.readFileSync(premergeFile, 'utf-8');
          const snapshotContent = fs.readFileSync(snapshotFile, 'utf-8');
          
          if (premergeContent !== snapshotContent) {
            // diff で変更行数を計算
            const diffCmd = `diff -u "${premergeFile}" "${snapshotFile}" 2>/dev/null || true`;
            const diffOutput = execSync(diffCmd, { encoding: 'utf-8', stdio: 'pipe' });
            
            let changedLines = 0;
            for (const line of diffOutput.split('\n')) {
              if ((line.startsWith('+') && !line.startsWith('+++')) ||
                  (line.startsWith('-') && !line.startsWith('---'))) {
                changedLines++;
              }
            }
            
            if (changedLines > MAX_CHANGED_LINES_PER_FILE) {
              return analysis;
            }
            
            analysis.modifiedFiles.push({ path: file, changedLines });
            analysis.totalChangedLines += changedLines;
          }
        } catch (error) {
          // バイナリファイルなどはスキップ
        }
      }
    }
    
    // 条件を満たすかチェック
    const totalFiles = analysis.addedFiles.length + analysis.modifiedFiles.length;
    analysis.meetsCriteria = totalFiles <= MAX_CHANGED_FILES &&
      analysis.modifiedFiles.every(f => f.changedLines <= MAX_CHANGED_LINES_PER_FILE);
    
  } catch (error: any) {
    console.error(`      ❌ 変更分析エラー: ${error.message}`);
  }
  
  return analysis;
}

/**
 * 既存の出力PRが正常に処理されているかチェック
 */
function isAlreadyProcessed(projectName: string, category: string, prName: string): { processed: boolean; needsReprocess: boolean } {
  const outputPrPath = path.join(OUTPUT_DIR, projectName, category, prName);
  
  // 出力ディレクトリが存在しない場合は未処理
  if (!fs.existsSync(outputPrPath)) {
    return { processed: false, needsReprocess: false };
  }
  
  // commit_messages.jsonが存在し、all_commitsが複数あれば正常処理済み
  const commitMessagesPath = path.join(outputPrPath, 'commit_messages.json');
  if (!fs.existsSync(commitMessagesPath)) {
    return { processed: false, needsReprocess: true };
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(commitMessagesPath, 'utf-8'));
    
    // all_commitsが2個以上あれば正常（プルリク側のコミット + merge commit）
    if (data.all_commits && data.all_commits.length >= 2) {
      console.log('      ✓ 既に正常処理済み（スキップ）');
      return { processed: true, needsReprocess: false };
    }
    
    // all_commitsが1個以下なら偽陰性の可能性（再処理が必要）
    console.log('      ⚠️  既存データが不完全（再処理）');
    return { processed: false, needsReprocess: true };
    
  } catch (error) {
    console.log('      ⚠️  commit_messages.json読み込みエラー（再処理）');
    return { processed: false, needsReprocess: true };
  }
}

/**
 * 単一PRを処理
 */
function processPR(projectName: string, category: string, prName: string, prPath: string): { success: boolean; alreadyProcessed: boolean; reprocessed: boolean } {
  console.log(`\n  📦 ${projectName}/${category}/${prName}`);
  
  // 既に正常処理済みかチェック
  const checkResult = isAlreadyProcessed(projectName, category, prName);
  if (!DRY_RUN && checkResult.processed) {
    return { success: true, alreadyProcessed: true, reprocessed: false };
  }
  
  const needsReprocess = checkResult.needsReprocess;
  
  // premergeとmergeディレクトリを探す
  const entries = fs.readdirSync(prPath, { withFileTypes: true });
  const premergeDir = entries.find(e => e.isDirectory() && (e.name.startsWith('premerge_') || e.name === 'premerge'));
  const mergeDir = entries.find(e => e.isDirectory() && (e.name.startsWith('merge_') || e.name === 'merge'));
  
  if (!premergeDir || !mergeDir) {
    console.log('      ⚠️  premerge または merge ディレクトリが見つかりません');
    return { success: false, alreadyProcessed: false, reprocessed: false };
  }
  
  const premergePath = path.join(prPath, premergeDir.name);
  const mergePath = path.join(prPath, mergeDir.name);
  
  // gitリポジトリかチェック
  if (!fs.existsSync(path.join(premergePath, '.git'))) {
    console.log('      ⚠️  premergeがgitリポジトリではありません');
    return { success: false, alreadyProcessed: false, reprocessed: false };
  }
  
  if (!fs.existsSync(path.join(mergePath, '.git'))) {
    console.log('      ⚠️  mergeがgitリポジトリではありません');
    return { success: false, alreadyProcessed: false, reprocessed: false };
  }
  
  // HEADコミットを取得
  const heads = getHeadCommits(premergePath, mergePath);
  if (!heads) {
    return { success: false, alreadyProcessed: false, reprocessed: false };
  }
  
  console.log(`      📌 Premerge HEAD: ${heads.premergeHead.substring(0, 7)}`);
  console.log(`      📌 Merge HEAD: ${heads.mergeHead.substring(0, 7)}`);
  
  // 初めてprotoが変更されたコミットを探す
  // mergeディレクトリのgitリポジトリを使用（全履歴がある）
  const protoChangeCommit = findFirstProtoChangeCommit(mergePath, heads.premergeHead, heads.mergeHead);
  
  if (!protoChangeCommit) {
    console.log('      ⏭️  スキップ: protoファイルの変更がありません');
    return { success: false, alreadyProcessed: false, reprocessed: false };
  }
  
  if (DRY_RUN) {
    console.log('      🔍 [DRY RUN] 処理対象として選択されました');
    return { success: true, alreadyProcessed: false, reprocessed: needsReprocess };
  }
  
  // 出力ディレクトリを準備
  const outputPrPath = path.join(OUTPUT_DIR, projectName, category, prName);
  fs.mkdirSync(outputPrPath, { recursive: true });
  
  // 1. premerge HEADをチェックアウトして保存
  const outputPremerge = path.join(outputPrPath, 'premerge');
  console.log(`      💾 premerge HEADを保存中...`);
  checkoutCommitToDirectory(premergePath, heads.premergeHead, outputPremerge);
  
  // 2. proto変更コミットをチェックアウトして保存
  const outputSnapshot = path.join(outputPrPath, `commit_snapshot_${protoChangeCommit.substring(0, 7)}`);
  console.log(`      💾 commit_snapshot_${protoChangeCommit.substring(0, 7)}を保存中...`);
  checkoutCommitToDirectory(mergePath, protoChangeCommit, outputSnapshot);
  
  // 2.5. コミットメッセージをJSON形式で保存
  const commitMessagesPath = path.join(outputPrPath, 'commit_messages.json');
  console.log(`      💾 コミットメッセージを保存中...`);
  saveCommitMessages(mergePath, heads.premergeHead, heads.mergeHead, protoChangeCommit, commitMessagesPath);
  
  // 3. 変更を分析してフィルタリング条件をチェック
  console.log(`      🔍 変更を分析中...`);
  const analysis = analyzeChanges(outputPremerge, outputSnapshot);
  
  if (!analysis.meetsCriteria) {
    console.log(`      ❌ フィルタリング条件を満たしません`);
    console.log(`         - 追加ファイル: ${analysis.addedFiles.length}件`);
    console.log(`         - 変更ファイル: ${analysis.modifiedFiles.length}件`);
    console.log(`         - 総変更行数: ${analysis.totalChangedLines}行`);
    
    // 作成したディレクトリを削除
    execSync(`rm -rf "${outputPrPath}"`, { encoding: 'utf-8', stdio: 'pipe' });
    return { success: false, alreadyProcessed: false, reprocessed: false };
  }
  
  console.log(`      ✅ 成功！`);
  console.log(`         - 追加ファイル: ${analysis.addedFiles.length}件`);
  console.log(`         - 変更ファイル: ${analysis.modifiedFiles.length}件`);
  console.log(`         - 総変更行数: ${analysis.totalChangedLines}行`);
  
  return { success: true, alreadyProcessed: false, reprocessed: needsReprocess };
}

/**
 * メイン処理
 */
async function main() {
  console.log('='.repeat(80));
  console.log('データセット再構築プログラム');
  console.log('='.repeat(80));
  console.log();
  console.log(`入力: ${RAW_CLONED_DIR}`);
  console.log(`出力: ${OUTPUT_DIR}`);
  console.log(`モード: ${DRY_RUN ? 'DRY RUN（実際の処理は行いません）' : '実行'}`);
  
  if (TEST_MODE) {
    console.log(`⚠️  テストモード: ${TEST_PROJECT} プロジェクトのみ処理`);
  }
  
  if (QUICK_MODE) {
    console.log(`⚡ クイックモード: 最初の3プロジェクト、各5PRのみ処理`);
  }
  
  if (SKIP_EXISTING) {
    console.log(`⏭️  既存スキップモード: 処理済みPRをスキップ`);
  }
  
  console.log();
  console.log('フィルタリング条件:');
  console.log(`  - 最大変更ファイル数: ${MAX_CHANGED_FILES}件`);
  console.log(`  - 最大変更行数/ファイル: ${MAX_CHANGED_LINES_PER_FILE}行`);
  console.log();
  
  if (!fs.existsSync(RAW_CLONED_DIR)) {
    console.error(`❌ エラー: ${RAW_CLONED_DIR} が見つかりません`);
    process.exit(1);
  }
  
  if (!DRY_RUN) {
    // 出力ディレクトリを準備
    if (fs.existsSync(OUTPUT_DIR)) {
      console.log(`⚠️  既存の ${OUTPUT_DIR} の中身を削除します...`);
      // コンテナのbindマウント対策: ディレクトリ自体ではなく中身だけ削除
      execSync(`rm -rf "${OUTPUT_DIR}"/*`, { encoding: 'utf-8', stdio: 'pipe' });
    } else {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  }
  
  // プロジェクト一覧を取得
  let projects = fs.readdirSync(RAW_CLONED_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
  
  // テストモードの場合は特定のプロジェクトのみ
  if (TEST_MODE) {
    projects = projects.filter(p => p === TEST_PROJECT);
    if (projects.length === 0) {
      console.error(`❌ エラー: テストプロジェクト '${TEST_PROJECT}' が見つかりません`);
      process.exit(1);
    }
  }
  
  // QUICKモードの場合は最初の3プロジェクトのみ
  if (QUICK_MODE && !TEST_MODE) {
    projects = projects.slice(0, 3);
  }
  
  console.log(`\n📂 ${projects.length}個のプロジェクトを処理します\n`);
  
  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalSkipped = 0;
  let totalAlreadyProcessed = 0;
  let totalReprocessed = 0;
  
  for (const projectName of projects) {
    const projectPath = path.join(RAW_CLONED_DIR, projectName);
    console.log(`\n🗂️  プロジェクト: ${projectName}`);
    
    // カテゴリ（issue/pullrequest）を走査
    const categories = fs.readdirSync(projectPath, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
    
    for (const category of categories) {
      const categoryPath = path.join(projectPath, category);
      
      // PR一覧を取得
      const prs = fs.readdirSync(categoryPath, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);
      
      console.log(`\n  📁 ${category}: ${prs.length}件のPR`);
      
      // QUICKモードの場合は最初の5PRのみ
      const prsToProcess = QUICK_MODE ? prs.slice(0, 5) : prs;
      
      for (const prName of prsToProcess) {
        totalProcessed++;
        const prPath = path.join(categoryPath, prName);
        
        const result = processPR(projectName, category, prName, prPath);
        
        if (result.success) {
          totalSuccess++;
          if (result.alreadyProcessed) {
            totalAlreadyProcessed++;
          } else if (result.reprocessed) {
            totalReprocessed++;
          }
        } else {
          totalSkipped++;
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('処理完了！');
  console.log('='.repeat(80));
  console.log(`総処理数: ${totalProcessed}件`);
  console.log(`成功: ${totalSuccess}件`);
  console.log(`  - 既に処理済み（スキップ）: ${totalAlreadyProcessed}件`);
  console.log(`  - 再処理: ${totalReprocessed}件`);
  console.log(`  - 新規処理: ${totalSuccess - totalAlreadyProcessed - totalReprocessed}件`);
  console.log(`スキップ（proto変更なし等）: ${totalSkipped}件`);
  console.log();
  
  if (!DRY_RUN) {
    console.log(`✅ データセットが ${OUTPUT_DIR} に保存されました`);
  } else {
    console.log(`🔍 DRY RUNモードで実行しました（実際の処理は行っていません）`);
    console.log(`   実際に実行する場合は --dry-run オプションを外してください`);
  }
}

// エラーハンドリング付き実行
main().catch(error => {
  console.error('❌ 致命的エラー:', error);
  process.exit(1);
});
