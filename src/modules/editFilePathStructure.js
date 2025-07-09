/**
 * 2つの構造オブジェクトを深くマージする。targetオブジェクトが変更される。（変更なし）
 * @param {object} target - マージ先のオブジェクト
 * @param {object} source - マージ元のオブジェクト
 * @returns {object} マージ後のtargetオブジェクト
 */
function mergeStructures(target, source) {
    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key]) &&
                target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                mergeStructures(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }
    return target;
}

/**
 * 構造ツリーを再帰的に探索し、すべてのプロジェクトルート候補の中身を
 * 1つのオブジェクトにマージして返す。（修正版）
 * @param {object} structure - 探索対象のディレクトリ構造オブジェクト
 * @returns {object} - すべてのルートがマージされた単一の構造オブジェクト
 */
function findAllAndMergeProjectRoots(structure) {
    const mergedRoot = {};

    function findAndMerge(node) {
        if (typeof node !== 'object' || node === null) {
            return;
        }

        for (const key in node) {
            if (Object.prototype.hasOwnProperty.call(node, key)) {
                const value = node[key];
                // ▼▼▼ この条件を修正 ▼▼▼
                const isProjectRoot =
                    key.startsWith('premerge_') ||
                    key.startsWith('merge_') ||
                    key.startsWith('commit_snapshot_');
                // ▲▲▲ pullrequest や issue を削除 ▲▲▲

                if (isProjectRoot && typeof value === 'object' && value !== null) {
                    mergeStructures(mergedRoot, value);
                } else {
                    findAndMerge(value);
                }
            }
        }
    }

    findAndMerge(structure);
    return mergedRoot;
}

export { mergeStructures, findAllAndMergeProjectRoots };