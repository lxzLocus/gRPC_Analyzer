/**
 * Generate diffs between files in two directories
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface DiffResult {
    filePath: string;
    diff: string;
}

interface FileDiffInfo {
    relativePath: string;
    diff: string;
}

/**
 * Get diffs for all files with specific extension
 * @param premergePath - Path to premerge directory
 * @param mergePath - Path to merge directory
 * @param extension - File extension filter (e.g., 'proto')
 * @returns Array of diff results
 */
export async function getFilesDiff(
    premergePath: string,
    mergePath: string,
    extension: string
): Promise<DiffResult[]> {
    const results: DiffResult[] = [];
    
    try {
        // Find all files with the extension
        const files = getAllFilesWithExt(premergePath, premergePath, `.${extension}`);
        
        for (const relativePath of files) {
            const prePath = path.join(premergePath, relativePath);
            const postPath = path.join(mergePath, relativePath);
            
            if (fs.existsSync(prePath) && fs.existsSync(postPath)) {
                try {
                    // Use diff command
                    const diff = execSync(
                        `diff -u "${prePath}" "${postPath}" || true`,
                        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
                    );
                    
                    if (diff.trim()) {
                        results.push({
                            filePath: relativePath,
                            diff: diff
                        });
                    }
                } catch (err) {
                    console.error(`Error diffing ${relativePath}:`, err);
                }
            }
        }
    } catch (err) {
        console.error('Error in getFilesDiff:', err);
    }
    
    return results;
}

/**
 * Get diffs for specific list of files
 * @param fileList - List of relative file paths
 * @param premergePath - Path to premerge directory
 * @param mergePath - Path to merge directory
 * @returns Array of file diff information
 */
export async function getDiffsForSpecificFiles(
    fileList: string[],
    premergePath: string,
    mergePath: string
): Promise<FileDiffInfo[]> {
    const results: FileDiffInfo[] = [];
    
    for (const relativePath of fileList) {
        const prePath = path.join(premergePath, relativePath);
        const postPath = path.join(mergePath, relativePath);
        
        try {
            let diff = '';
            
            if (fs.existsSync(prePath) && fs.existsSync(postPath)) {
                diff = execSync(
                    `diff -u "${prePath}" "${postPath}" || true`,
                    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
                );
            } else if (!fs.existsSync(prePath)) {
                diff = '(file added in merge)';
            } else {
                diff = '(file deleted in merge)';
            }
            
            results.push({
                relativePath,
                diff: diff.trim()
            });
        } catch (err) {
            console.error(`Error diffing ${relativePath}:`, err);
            results.push({
                relativePath,
                diff: `(error: ${err})`
            });
        }
    }
    
    return results;
}

function getAllFilesWithExt(dir: string, baseDir: string, ext: string): string[] {
    try {
        // Use find command for efficient file discovery
        const findOutput = execSync(
            `find "${dir}" -type f -name "*${ext}" 2>/dev/null || true`,
            { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
        );
        
        const files = findOutput.trim().split('\n').filter(Boolean);
        
        // Convert to relative paths
        return files.map(fullPath => path.relative(baseDir, fullPath));
    } catch (err) {
        console.error(`Error finding files with ext ${ext} in ${dir}:`, err);
        return [];
    }
}
