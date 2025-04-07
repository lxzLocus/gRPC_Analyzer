/*
Docs

元ソースコードとDiffをマージする


*/


/*
modules
*/
const fs = require('fs');
const path = require('path');

const outputPath = '/app/app/experimentLLM_nonTreeWithdiff/output/diffMerge.txt';


if (require.main === module) {
    const sourceCodePath = '/app/dataset/modified_proto_reps/daos/pullrequest/DAOS-14214_control-_Fix_potential_missed_call_to_drpc_failure_handlers/premerge_12944/src/control/server/harness.go';
    const diffContentPath = 'app/experimentLLM_nonTreeWithdiff/module/diff.txt';

    mergeAndSave(sourceCodePath, diffContentPath, outputPath);
}

/**
 * ソースコードとDiffをマージして結果をファイルに保存する
 * @param {string} sourceCodePath ソースコードのファイルパス
 * @param {string} diffContentPath Diffのファイルパス
 * @param {string} outputPath 出力先のファイルパス
 */
function mergeAndSave(sourceCodePath, diffContentPath, outputPath) {
    try {
        // ソースコードとDiffを読み込む
        const sourceCode = fs.readFileSync(sourceCodePath, 'utf-8');
        const diffContent = fs.readFileSync(diffContentPath, 'utf-8');

        // applyDiffを適用してマージ
        const mergedCode = applyDiff(sourceCode, diffContent);

        // 結果をファイルに書き込む
        fs.writeFileSync(outputPath, mergedCode, 'utf-8');
        console.log(`Merged code written to ${outputPath}`);
    } catch (error) {
        console.error('Error during merge and save:', error);
    }
}

/**
 * ソースコードにDiffを適用する
 * @param {string} originalCode 元のソースコード
 * @param {string} diffOutput Diffの内容
 * @returns {string} マージ後のコード
 */
function applyDiff(originalCode, diffOutput) {
    const originalLines = originalCode.split('\n'); // 元のコードを行ごとに分割
    let resultLines = [...originalLines]; // 結果用のコード（最初は元のコードと同じ）

    // diffOutputを行ごとに分割
    const diffLines = diffOutput.split('\n');

    // 各diff行を処理
    diffLines.forEach(line => {
        if (line.startsWith('-')) {
            // `-` で始まる行は削除された行なので、元のコードから削除
            const lineNumber = resultLines.indexOf(line.slice(1).trim()); // 追加前の行
            if (lineNumber !== -1) {
                resultLines.splice(lineNumber, 1); // 該当行を削除
            }
        } else if (line.startsWith('+')) {
            // `+` で始まる行は追加された行なので、修正後のコードに追加
            const newLine = line.slice(1).trim(); // `+` 記号を削除して行を取得
            resultLines.push(newLine); // 結果に追加
        }
    });

    // 最終的に修正後のコードを行ごとに結合して返す
    return resultLines.join('\n');
}
