/**
 * Peripheral Directory Structure Generator
 * ディレクトリ構造の取得と周辺ファイル情報の生成
 */

import fs from 'fs';
import path from 'path';

/**
 * 指定されたディレクトリの周辺構造を取得
 * @param targetPath - 対象のファイルまたはディレクトリパス
 * @param maxDepth - 最大探索深度（デフォルト: 3）
 * @param excludePatterns - 除外するパターン
 * @returns ディレクトリ構造情報
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
): { structure: string; files: string[] } {
    const basePath = path.dirname(targetPath);
    const files: string[] = [];
    
    /**
     * 再帰的にディレクトリ構造を取得
     */
    function buildStructure(dirPath: string, depth: number = 0, prefix: string = ''): string {
        if (depth > maxDepth) {
            return '';
        }
        
        let structure = '';
        
        try {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            
            // 除外パターンのフィルタリング
            const filteredItems = items.filter(item => 
                !excludePatterns.some(pattern => item.name.includes(pattern))
            );
            
            filteredItems.forEach((item, index) => {
                const isLast = index === filteredItems.length - 1;
                const currentPrefix = isLast ? '└── ' : '├── ';
                const nextPrefix = isLast ? '    ' : '│   ';
                
                structure += `${prefix}${currentPrefix}${item.name}\n`;
                
                const fullPath = path.join(dirPath, item.name);
                
                if (item.isDirectory()) {
                    structure += buildStructure(
                        fullPath, 
                        depth + 1, 
                        prefix + nextPrefix
                    );
                } else {
                    files.push(fullPath);
                }
            });
        } catch (error) {
            console.warn(`Warning: Cannot read directory ${dirPath}:`, error);
        }
        
        return structure;
    }
    
    const structure = buildStructure(basePath);
    
    return {
        structure: structure || 'No accessible directory structure found',
        files: files.slice(0, 100) // 最大100ファイルまで
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
