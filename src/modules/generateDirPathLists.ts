/**
 * Generate directory tree structure
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

type DirectoryStructure = Record<string, any>;

/**
 * Get directory tree structure
 * @param rootPath - Root directory path
 * @param maxDepth - Maximum depth to traverse (default: 5)
 * @returns Nested object representing directory structure
 */
export default function getPathTree(
    rootPath: string,
    maxDepth: number = 5
): DirectoryStructure {
    try {
        // Use tree command for efficient directory listing
        
        // tree -L <depth> -J outputs JSON format
        // Fallback to manual structure if tree not available
        try {
            const treeOutput = execSync(
                `tree -L ${maxDepth} -J "${rootPath}" 2>/dev/null`,
                { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
            );
            
            const parsed = JSON.parse(treeOutput);
            if (parsed && parsed[0]) {
                return parsed[0].contents || {};
            }
        } catch (treeErr) {
            // tree command not available or failed, use find instead
            console.log('tree command not available, using find...');
            
            const findOutput = execSync(
                `find "${rootPath}" -maxdepth ${maxDepth} -type d 2>/dev/null | head -1000 || true`,
                { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
            );
            
            const structure: DirectoryStructure = {};
            const dirs = findOutput.trim().split('\n').filter(Boolean);
            
            // Build simple structure from directory list
            for (const dir of dirs) {
                const relativePath = path.relative(rootPath, dir);
                if (relativePath) {
                    const parts = relativePath.split(path.sep);
                    let current = structure;
                    for (const part of parts) {
                        if (!current[part]) {
                            current[part] = {};
                        }
                        current = current[part];
                    }
                }
            }
            
            return structure;
        }
    } catch (err) {
        console.error(`Error getting path tree for ${rootPath}:`, err);
    }
    
    return {};
}
