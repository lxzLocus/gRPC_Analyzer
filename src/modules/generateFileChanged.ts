/**
 * Generate list of changed files between two directories
 * Uses 'diff' command for efficiency with large directory trees
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Get list of changed files between premerge and merge directories
 * @param premergePath - Path to premerge directory
 * @param mergePath - Path to merge directory  
 * @param filterExt - Optional file extension filter (empty string = all files)
 * @returns Array of relative file paths that changed
 */
export default async function getChangedFiles(
    premergePath: string,
    mergePath: string,
    filterExt: string
): Promise<string[]> {
    const changedFiles: string[] = [];
    
    try {
        // Use diff command for efficient comparison, excluding vendor directories
        const diffOutput = execSync(
            `diff -qr -x vendor -x node_modules -x .git "${premergePath}" "${mergePath}" || true`,
            { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
        );
        
        const lines = diffOutput.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
            // Parse diff output: "Files <path1> and <path2> differ"
            // or "Only in <dir>: <file>"
            if (line.startsWith('Files ')) {
                const match = line.match(/Files (.+) and (.+) differ/);
                if (match) {
                    const file1 = match[1];
                    const relativePath = path.relative(premergePath, file1);
                    changedFiles.push(relativePath);
                }
            } else if (line.startsWith('Only in ')) {
                const match = line.match(/Only in (.+): (.+)/);
                if (match) {
                    const dir = match[1];
                    const file = match[2];
                    const fullPath = path.join(dir, file);
                    
                    // Try both directories to get relative path
                    let relativePath = path.relative(premergePath, fullPath);
                    if (relativePath.startsWith('..')) {
                        relativePath = path.relative(mergePath, fullPath);
                    }
                    
                    changedFiles.push(relativePath);
                }
            }
        }
        
        // Apply filter if specified
        if (filterExt) {
            return changedFiles.filter(f => f.endsWith(filterExt));
        }
        
        return changedFiles;
    } catch (err) {
        console.error('Error getting changed files:', err);
        return [];
    }
}
