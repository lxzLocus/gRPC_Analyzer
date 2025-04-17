const fs = require('fs');
const path = require('path');
const RestoreDiff = require('./module/restoreDiff');

const sourceCodePath = "/app/dataset/modified_proto_reps/daos/pullrequest/DAOS-14214_control-_Fix_potential_missed_call_to_drpc_failure_handlers/premerge_12944/"; // Adjust this path to your source code directory
const diffFilePath = "/app/app/experimentLLM_nonTreeWithdiff/output/premodified_diff.txt"; // Path to the diff input file
const outputDir = '/app/app/experimentLLM_nonTreeWithdiff/output';

function testRestoreDiff() {
    if (!fs.existsSync(diffFilePath)) {
        console.error(`Diff file not found: ${diffFilePath}`);
        return;
    }

    const diffOutput = fs.readFileSync(diffFilePath, 'utf-8');
    const restoreDiff = new RestoreDiff(sourceCodePath);

    const modifiedFiles = restoreDiff.applyDiff(diffOutput);

    // "%%_Fin_%%"が返された場合のみ処理を終了する（出力のみに厳密判定）
    const isFinTag =
        modifiedFiles.trim() === '%%_Fin_%%' ||
        modifiedFiles.split('\n').pop().trim() === '%%_Fin_%%';

    if (isFinTag) {
        console.log('終了タグ(%%_Fin_%%)が返されたため処理を終了します。');
        return;
    }

    fs.writeFileSync(path.join(outputDir, 'restored.txt'), modifiedFiles, 'utf-8');

    console.log('All diffs applied and written to one file successfully.');
}

testRestoreDiff();
