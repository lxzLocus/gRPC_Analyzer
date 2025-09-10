#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const MESSAGE = `No handwritten files found. Only auto-generated files were modified.

In this pull request, only .proto files and their auto-generated files (.pb.go, etc.) 
were modified. No handwritten code files were changed.
Therefore, no suspected handwritten files exist for analysis.

File categorization of changes:
- Proto files: .proto files
- Generated files: Files matching patterns like .pb.go, .pb.cc, .pb.h, etc.
- Handwritten files: None (excluding excluded files, test files, and auto-generated files)
`;

// Batch processing function with limited output
function updateFiles() {
    console.log('Processing dataset...');
    
    const command = 'find /app/dataset/filtered_commit -name "05_suspectedFiles.txt" -size 0';
    
    try {
        // Use child_process to execute the find command
        import('child_process').then(({ execSync }) => {
            const result = execSync(command, { encoding: 'utf8' }).trim();
            
            if (!result) {
                console.log('No empty files found.');
                return;
            }
            
            const emptyFiles = result.split('\n').filter(line => line.trim());
            console.log(`Found ${emptyFiles.length} empty files`);
            
            let updated = 0;
            for (const filePath of emptyFiles) {
                try {
                    fs.writeFileSync(filePath, MESSAGE, 'utf8');
                    updated++;
                    if (updated <= 3) {
                        console.log(`✓ Updated: ${filePath}`);
                    }
                } catch (error) {
                    console.error(`✗ Error: ${filePath}`);
                }
            }
            
            console.log(`\nCompleted: ${updated}/${emptyFiles.length} files updated`);
        });
    } catch (error) {
        console.error('Error:', error.message);
    }
}

updateFiles();
