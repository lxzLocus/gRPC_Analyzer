/**
 * Peripheral Directory Structure Generator
 * ディレクトリ構造の取得と周辺ファイル情報の生成
 */

import fs from 'fs';
import path from 'path';

/**
 * ファイル名からヒントを生成（静的ルールベース）
 * Priority 4: DIRECTORY_LISTINGの情報密度向上
 */
function generateFileHint(fileName: string, dirPath: string): string {
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    
    // テストファイル
    if (fileName.includes('_test.') || fileName.includes('.test.') || fileName.endsWith('_test.go') || fileName.endsWith('_test.ts')) {
        return 'test file (unlikely relevant)';
    }
    
    // モックファイル
    if (fileName.includes('mock') || baseName === 'mocks') {
        return 'test mocks (unlikely relevant)';
    }
    
    // protoファイル
    if (ext === '.proto') {
        return 'proto definition file';
    }
    
    // 生成ファイル
    if (fileName.endsWith('.pb.go') || fileName.endsWith('.pb.cc') || fileName.endsWith('.pb.h')) {
        return 'auto-generated protobuf code (do not edit)';
    }
    
    // gRPCハンドラー
    if (fileName.includes('grpc') || fileName.includes('server') || fileName.includes('client')) {
        return 'implements gRPC handlers or client';
    }
    
    // ラッパー
    if (fileName.includes('wrapper') || fileName.includes('adapter')) {
        return 'wrapper or adapter layer';
    }
    
    // インターフェース/型定義
    if (fileName.includes('interface') || fileName.includes('type') || baseName === 'types') {
        return 'interface or type definitions';
    }
    
    // コアロジック（RAやSAなど）
    if (baseName === 'ra' || baseName === 'sa' || baseName === 'ca' || baseName === 'wfe') {
        return 'main service implementation';
    }
    
    // 設定ファイル
    if (fileName.includes('config') || ext === '.yaml' || ext === '.json' || ext === '.toml') {
        return 'configuration file';
    }
    
    // ドキュメント
    if (ext === '.md' || ext === '.txt' || ext === '.rst') {
        return 'documentation';
    }
    
    // 実装ファイル（拡張子ベース）
    if (ext === '.go') {
        return 'Go implementation';
    }
    if (ext === '.ts' || ext === '.js') {
        return 'TypeScript/JavaScript implementation';
    }
    if (ext === '.py') {
        return 'Python implementation';
    }
    
    return 'source file';
}

/**
 * 指定されたディレクトリの直下の構造を取得（1階層のみ）
 * @param targetPath - 対象のディレクトリパス
 * @param maxDepth - 使用されません（後方互換性のため残してあります）
 * @param excludePatterns - 除外するパターン
 * @returns ディレクトリ構造情報（機械可読形式、ヒント付き）
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
): { 
    path: string; 
    directories: string[]; 
    files: Array<{name: string; hint: string}>; 
    note: string 
} {
    const directories: string[] = [];
    const files: Array<{name: string; hint: string}> = [];
    
    try {
        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        
        // 除外パターンのフィルタリング
        const filteredItems = items.filter(item => 
            !excludePatterns.some(pattern => item.name.includes(pattern))
        );
        
        // ディレクトリとファイルを分離（ファイルにはヒント付与）
        filteredItems.forEach((item) => {
            if (item.isDirectory()) {
                directories.push(item.name);
            } else if (item.isFile()) {
                files.push({
                    name: item.name,
                    hint: generateFileHint(item.name, targetPath)
                });
            }
        });
        
        // アルファベット順にソート
        directories.sort();
        files.sort((a, b) => a.name.localeCompare(b.name));
        
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
        note: "One-level listing with file hints. Use DIRECTORY_LISTING again for deeper levels."
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
