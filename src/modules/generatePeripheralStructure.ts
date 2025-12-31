/**
 * Peripheral Directory Structure Generator
 * ディレクトリ構造の取得と周辺ファイル情報の生成
 */

import fs from 'fs';
import path from 'path';

/**
 * 指定されたディレクトリの直下の構造を取得（1階層のみ）
 * @param targetPath - 対象のディレクトリパス
 * @param maxDepth - 使用されません（後方互換性のため残してあります）
 * @param excludePatterns - 除外するパターン
 * @returns ディレクトリ構造情報（機械可読形式）
 */
export default function getSurroundingDirectoryStructure(
    targetPath: string, 
    maxDepth: number = 3,
    excludePatterns: string[] = [
        'node_modules',
        '.git',
        'dist',
        'build',
        'coverage',
        '.nyc_output',
        'logs',
        'tmp',
        'temp'
    ]
): { path: string; directories: string[]; files: string[]; note: string } {
    const directories: string[] = [];
    const files: string[] = [];
    
    try {
        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        
        // 除外パターンのフィルタリング
        const filteredItems = items.filter(item => 
            !excludePatterns.some(pattern => item.name.includes(pattern))
        );
        
        // ディレクトリとファイルを分離
        filteredItems.forEach((item) => {
            if (item.isDirectory()) {
                directories.push(item.name);
            } else if (item.isFile()) {
                files.push(item.name);
            }
        });
        
        // アルファベット順にソート
        directories.sort();
        files.sort();
        
    } catch (error) {
        console.warn(`Warning: Cannot read directory ${targetPath}:`, error);
        return {
            path: targetPath,
            directories: [],
            files: [],
            note: `Error: ${(error as Error).message}`
        };
    }
    
    return {
        path: targetPath,
        directories,
        files,
        note: "One-level listing only. Use DIRECTORY_LISTING again for deeper levels."
    };
}

/**
 * ファイル情報の詳細取得
 */
export function getFileDetails(filePath: string): {
    size: number;
    modified: Date;
    extension: string;
    isReadable: boolean;
} {
    try {
        const stats = fs.statSync(filePath);
        return {
            size: stats.size,
            modified: stats.mtime,
            extension: path.extname(filePath),
            isReadable: fs.constants.R_OK ? true : false
        };
    } catch (error) {
        return {
            size: 0,
            modified: new Date(0),
            extension: '',
            isReadable: false
        };
    }
}

/**
 * プロジェクトルートの検出
 */
export function findProjectRoot(startPath: string): string {
    let currentPath = startPath;
    
    while (currentPath !== path.dirname(currentPath)) {
        const packageJsonPath = path.join(currentPath, 'package.json');
        const gitPath = path.join(currentPath, '.git');
        
        if (fs.existsSync(packageJsonPath) || fs.existsSync(gitPath)) {
            return currentPath;
        }
        
        currentPath = path.dirname(currentPath);
    }
    
    return startPath; // プロジェクトルートが見つからない場合は開始パスを返す
}
