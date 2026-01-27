/**
 * Proto file content generator
 * Finds all .proto files and returns their paths and contents
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface ProtoFile {
    path: string;
    content: string;
}

interface ProtoFileList {
    proto_files: ProtoFile[];
}

/**
 * Recursively find all files with a specific extension
 * @param dir - Directory to search
 * @param ext - File extension to find (e.g., '.proto')
 * @returns List of proto files with content
 */
export default function findFiles(dir: string, ext: string): ProtoFileList {
    const protoFiles: ProtoFile[] = [];
    
    try {
        // Use find command for efficient file discovery
        const findOutput = execSync(
            `find "${dir}" -type f -name "*${ext}" 2>/dev/null || true`,
            { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
        );
        
        const filePaths = findOutput.trim().split('\n').filter(Boolean);
        
        for (const fullPath of filePaths) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const relativePath = path.relative(dir, fullPath);
                
                protoFiles.push({
                    path: relativePath,
                    content: content
                });
            } catch (err) {
                console.error(`Error reading file ${fullPath}:`, err);
            }
        }
    } catch (err) {
        console.error(`Error finding files in ${dir}:`, err);
    }
    
    return {
        proto_files: protoFiles
    };
}
