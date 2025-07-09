/**
 * @fileoverview 指定パスから「円が広がるように」指定距離内のディレクトリ構造を取得するモジュール
 */

import fs from 'fs';
import path from 'path';

// 探索から除外するディレクトリ名
const IGNORE_LIST = new Set(['.git', 'node_modules', 'dist', 'build', '.DS_Store']);

/**
 * 幅優先探索（BFS）を使い、開始パスから指定距離（radius）内にある全てのパスを収集する
 * @param {string} startPath - 探索を開始する絶対パス
 * @param {number} radius - 探索の半径（距離、depth）
 * @returns {Set<string>} - 条件を満たす全ての絶対パスのセット
 */
function findAllPathsInRadius(startPath, radius) {
    const queue = [{ p: startPath, dist: 0 }]; // キュー：{パス, 距離}
    const visited = new Set([startPath]);     // 訪問済みパスを記録

    for (let i = 0; i < queue.length; i++) {
        const { p: currentPath, dist: currentDist } = queue[i];

        if (currentDist >= radius) {
            continue; // 半径に達したら、そこからは広げない
        }

        // 隣接ノード（親と子）を取得
        const neighbors = [];

        // 1. 親を追加
        const parent = path.dirname(currentPath);
        if (parent !== currentPath) { // ルートディレクトリでなければ
            neighbors.push(parent);
        }

        // 2. 子を追加（ディレクトリの場合のみ）
        try {
            if (fs.statSync(currentPath).isDirectory()) {
                const children = fs.readdirSync(currentPath);
                for (const child of children) {
                    if (!IGNORE_LIST.has(child)) {
                        neighbors.push(path.join(currentPath, child));
                    }
                }
            }
        } catch (e) { /* アクセスできないディレクトリは無視 */ }

        // 未訪問の隣接ノードをキューに追加
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({ p: neighbor, dist: currentDist + 1 });
            }
        }
    }

    // 訪問したすべてのパスを返す
    return visited;
}

/**
 * パスのリストから、それらを内包する最小のツリー構造を構築する
 * @param {Set<string>} pathSet - 構造化したい絶対パスのセット
 * @returns {object} - ファイルツリー構造のオブジェクト
 */
function buildStructureFromPaths(pathSet) {
    if (pathSet.size === 0) {
        return {};
    }

    const paths = Array.from(pathSet);

    // 1. 全パスの共通の祖先（ルート）を見つける
    const firstPathParts = paths[0].split(path.sep);
    let commonAncestorParts = firstPathParts;
    for (let i = 1; i < paths.length; i++) {
        const currentPathParts = paths[i].split(path.sep);
        let j = 0;
        while (j < commonAncestorParts.length && j < currentPathParts.length && commonAncestorParts[j] === currentPathParts[j]) {
            j++;
        }
        commonAncestorParts = commonAncestorParts.slice(0, j);
    }
    const commonAncestor = commonAncestorParts.join(path.sep) || path.sep;

    // 2. 共通祖先からの相対パスを使ってツリーを構築
    const tree = {};
    for (const p of paths) {
        if (!p.startsWith(commonAncestor)) continue;

        const relativePath = path.relative(commonAncestor, p);
        if (relativePath === '') continue; // 共通祖先自体はキーにしない

        const parts = relativePath.split(path.sep);
        let currentNode = tree;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLastPart = i === parts.length - 1;

            if (isLastPart) {
                // パスの終点がディレクトリかファイルかを判定
                try {
                    currentNode[part] = fs.statSync(p).isDirectory() ? {} : null;
                } catch (e) {
                    currentNode[part] = null; // statに失敗した場合はファイルと見なす
                }
            } else {
                if (!currentNode[part]) {
                    currentNode[part] = {};
                }
                currentNode = currentNode[part];
            }
        }
    }

    // 共通祖先が1つのディレクトリだった場合、その中身を返す
    const rootKeys = Object.keys(tree);
    if (rootKeys.length === 1 && paths.every(p => p.startsWith(path.join(commonAncestor, rootKeys[0])))) {
        return tree[rootKeys[0]];
    }

    return tree;
}

/**
 * 指定パスから「円が広がるように」指定距離内のディレクトリ構造を取得します。
 * @param {string} targetPath - 探索の中心となるファイルまたはディレクトリのパス。
 * @param {number} depth - 探索の半径（距離）。
 * @returns {object} - ディレクトリ構造を表すツリーオブジェクト。
 */
export default function getSurroundingDirectoryStructure(targetPath, depth) {
    if (!fs.existsSync(targetPath)) {
        throw new Error(`Path not found: ${targetPath}`);
    }

    // 1. 開始パスから指定距離内にあるすべてのパスを収集
    const pathsInRadius = findAllPathsInRadius(targetPath, depth);

    // 2. 収集したパスからツリー構造を再構築
    return buildStructureFromPaths(pathsInRadius);
}