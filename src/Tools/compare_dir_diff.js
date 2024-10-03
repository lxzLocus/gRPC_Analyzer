/**
 ２つのディレクトリを指定し，git diffする
**/

const { execSync } = require('child_process');
const path = require('path');

// Gitリポジトリのディレクトリを指定
const preMergeDir = path.resolve('/app/dataset/test/Fix_grpc_test_proto_generation/premerge_5452');
const postMergeDir = path.resolve('/app/dataset/test/Fix_grpc_test_proto_generation/merge_5452');

// コミットIDを取得する関数
function getCommitId(directory) {
    try {
        // HEADのコミットIDを取得
        const commitId = execSync('git rev-parse HEAD', { cwd: directory }).toString().trim();
        return commitId;
    } catch (error) {
        console.error(`Failed to get commit ID for directory: ${directory}`);
        console.error(error.message);
        process.exit(1);
    }
}

// pre_merge_directory と post_merge_directory のコミットIDを取得
const preMergeCommitId = getCommitId(preMergeDir);
const postMergeCommitId = getCommitId(postMergeDir);

// git diffを実行する関数
function gitDiff(preMergeCommitId, postMergeCommitId, directory) {
    try {
        const diff = execSync(`git diff ${preMergeCommitId} ${postMergeCommitId}`, { cwd: directory }).toString();
        return diff;
    } catch (error) {
        console.error('Failed to execute git diff');
        console.error(error.message);
        process.exit(1);
    }
}

// 差分を表示
const diffOutput = gitDiff(preMergeCommitId, postMergeCommitId, preMergeDir);
console.log(diffOutput);
