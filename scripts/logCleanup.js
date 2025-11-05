#!/usr/bin/env node

/**
 * Log Cleanup Script for /app/log Directory
 * 
 * This script provides safe deletion of log files in /app/log directory
 * with various filtering and safety options.
 * 
 * Usage:
 *   node scripts/logCleanup.js [options]
 * 
 * Features:
 *   - Dry-run mode for safe preview
 *   - Date-based filtering
 *   - Repository-specific filtering
 *   - Category-based filtering (issue/pullrequest)
 *   - Interactive confirmation
 *   - Backup option before deletion
 *   - Progress reporting
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LogCleanup {
    constructor() {
        this.logDir = path.resolve(__dirname, '../log');
        this.logsDir = path.resolve(__dirname, '../logs');
        this.outputDir = path.resolve(__dirname, '../output');
        this.backupDir = path.resolve(__dirname, '../backups/log_cleanup');
        this.stats = {
            filesFound: 0,
            filesDeleted: 0,
            totalSizeDeleted: 0,
            errors: []
        };
    }

    /**
     * Parse command line arguments
     */
    parseArgs() {
        const args = process.argv.slice(2);
        const options = {
            dryRun: false,
            backup: false,
            interactive: true,
            dateFilter: null,
            repoFilter: null,
            categoryFilter: null,
            removeEmptyDirs: false,
            includeLogs: false,
            includeOutput: false,
            help: false
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            switch (arg) {
                case '--dry-run':
                case '-d':
                    options.dryRun = true;
                    break;
                case '--backup':
                case '-b':
                    options.backup = true;
                    break;
                case '--yes':
                case '-y':
                    options.interactive = false;
                    break;
                case '--date':
                    if (i + 1 < args.length) {
                        options.dateFilter = args[++i];
                    }
                    break;
                case '--repo':
                case '-r':
                    if (i + 1 < args.length) {
                        options.repoFilter = args[++i];
                    }
                    break;
                case '--category':
                case '-c':
                    if (i + 1 < args.length) {
                        options.categoryFilter = args[++i];
                    }
                    break;
                case '--remove-empty-dirs':
                case '--cleanup':
                    options.removeEmptyDirs = true;
                    break;
                case '--include-logs':
                case '--logs':
                    options.includeLogs = true;
                    break;
                case '--include-output':
                case '--output':
                    options.includeOutput = true;
                    break;
                case '--all':
                    options.includeLogs = true;
                    options.includeOutput = true;
                    break;
                case '--help':
                case '-h':
                    options.help = true;
                    break;
                default:
                    console.warn(`Unknown option: ${arg}`);
            }
        }

        return options;
    }

    /**
     * Display help information
     */
    showHelp() {
        console.log(`
Log Cleanup Script
================

Usage: node scripts/logCleanup.js [options]

Options:
  -d, --dry-run         Preview what would be deleted without actually deleting
  -b, --backup          Create compressed backup before deletion
  -y, --yes             Skip interactive confirmation
  --date <YYYY-MM-DD>   Delete logs older than specified date
  --repo <name>         Filter by repository name (e.g., boulder, daos)
  -c, --category <type> Filter by category (issue or pullrequest)
  --remove-empty-dirs   Remove empty directories after deleting log files
  --cleanup             Alias for --remove-empty-dirs
  --include-logs        Also clean /app/logs directory
  --logs                Alias for --include-logs
  --include-output      Also clean /app/output directory  
  --output              Alias for --include-output
  --all                 Clean all directories (/app/log, /app/logs, /app/output)
  -h, --help            Show this help message

Examples:
  node scripts/logCleanup.js --dry-run
  node scripts/logCleanup.js --date 2025-07-01 --backup
  node scripts/logCleanup.js --repo boulder --category issue
  node scripts/logCleanup.js --yes --date 2025-08-01
  node scripts/logCleanup.js --remove-empty-dirs --dry-run
  node scripts/logCleanup.js --include-logs --include-output --dry-run
  node scripts/logCleanup.js --all --date 2025-08-01 --backup

Date format for filtering:
  Logs with dates older than the specified date will be deleted.
  Date format should be YYYY-MM-DD (e.g., 2025-08-01)

Directory Management:
  By default, only log files are deleted and directory structure is preserved.
  Use --remove-empty-dirs to also remove empty directories after file deletion.
  
Extended Cleanup:
  --include-logs: Clean /app/logs directory (error logs, performance logs, etc.)
  --include-output: Clean /app/output directory (processing summaries, error reports)
  --all: Clean all three directories (/app/log, /app/logs, /app/output)
        `);
    }

    /**
     * Find all log files matching the criteria
     */
    async findLogFiles(options) {
        const files = [];
        
        // Process /app/log directory (original structured logs)
        await this.findStructuredLogFiles(files, options);
        
        // Process /app/logs directory if requested
        if (options.includeLogs) {
            await this.findLogsDirectoryFiles(files, options);
        }
        
        // Process /app/output directory if requested
        if (options.includeOutput) {
            await this.findOutputDirectoryFiles(files, options);
        }
        
        return files;
    }

    /**
     * Find structured log files in /app/log directory
     */
    async findStructuredLogFiles(files, options) {
        try {
            const repos = await fs.readdir(this.logDir, { withFileTypes: true });
            
            for (const repo of repos) {
                if (!repo.isDirectory()) continue;
                
                // Apply repository filter
                if (options.repoFilter && repo.name !== options.repoFilter) {
                    continue;
                }
                
                const repoPath = path.join(this.logDir, repo.name);
                const categories = await fs.readdir(repoPath, { withFileTypes: true });
                
                for (const category of categories) {
                    if (!category.isDirectory()) continue;
                    
                    // Apply category filter
                    if (options.categoryFilter && category.name !== options.categoryFilter) {
                        continue;
                    }
                    
                    const categoryPath = path.join(repoPath, category.name);
                    const items = await fs.readdir(categoryPath, { withFileTypes: true });
                    
                    for (const item of items) {
                        if (item.isDirectory()) {
                            // Handle nested directories (e.g., issue/task-name/)
                            const itemPath = path.join(categoryPath, item.name);
                            const logFiles = await fs.readdir(itemPath);
                            
                            for (const logFile of logFiles) {
                                if (logFile.endsWith('.log')) {
                                    const fullPath = path.join(itemPath, logFile);
                                    const stats = await fs.stat(fullPath);
                                    
                                    // Apply date filter
                                    if (this.shouldDeleteByDate(logFile, options.dateFilter)) {
                                        files.push({
                                            path: fullPath,
                                            relativePath: path.relative(path.resolve(__dirname, '..'), fullPath),
                                            size: stats.size,
                                            mtime: stats.mtime,
                                            repo: repo.name,
                                            category: category.name,
                                            name: logFile,
                                            type: 'structured-log'
                                        });
                                    }
                                }
                            }
                        } else if (item.name.endsWith('.log')) {
                            // Handle direct log files
                            const fullPath = path.join(categoryPath, item.name);
                            const stats = await fs.stat(fullPath);
                            
                            if (this.shouldDeleteByDate(item.name, options.dateFilter)) {
                                files.push({
                                    path: fullPath,
                                    relativePath: path.relative(path.resolve(__dirname, '..'), fullPath),
                                    size: stats.size,
                                    mtime: stats.mtime,
                                    repo: repo.name,
                                    category: category.name,
                                    name: item.name,
                                    type: 'structured-log'
                                });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            throw new Error(`Failed to scan log directory: ${error.message}`);
        }
    }

    /**
     * Find files in /app/logs directory
     */
    async findLogsDirectoryFiles(files, options) {
        try {
            await this.scanDirectoryRecursively(this.logsDir, files, options, 'logs');
        } catch (error) {
            console.warn(`Warning: Could not scan logs directory: ${error.message}`);
        }
    }

    /**
     * Find files in /app/output directory
     */
    async findOutputDirectoryFiles(files, options) {
        try {
            await this.scanDirectoryRecursively(this.outputDir, files, options, 'output');
        } catch (error) {
            console.warn(`Warning: Could not scan output directory: ${error.message}`);
        }
    }

    /**
     * Recursively scan directory for files
     */
    async scanDirectoryRecursively(dir, files, options, type) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                // Skip backup directories to avoid deleting our own backups
                if (entry.name === 'backups' || entry.name === 'log_cleanup') {
                    continue;
                }
                await this.scanDirectoryRecursively(fullPath, files, options, type);
            } else {
                const stats = await fs.stat(fullPath);
                
                // Apply date filter based on file modification time or filename
                let shouldDelete = true;
                if (options.dateFilter) {
                    shouldDelete = this.shouldDeleteByDateOrMtime(entry.name, stats.mtime, options.dateFilter);
                }
                
                if (shouldDelete) {
                    files.push({
                        path: fullPath,
                        relativePath: path.relative(path.resolve(__dirname, '..'), fullPath),
                        size: stats.size,
                        mtime: stats.mtime,
                        name: entry.name,
                        type: type
                    });
                }
            }
        }
    }

    /**
     * Check if file should be deleted based on date filter or modification time
     */
    shouldDeleteByDateOrMtime(filename, mtime, dateFilter) {
        if (!dateFilter) return true;
        
        // First try to extract date from filename
        const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
            const fileDate = new Date(dateMatch[1]);
            const filterDate = new Date(dateFilter);
            return fileDate < filterDate;
        }
        
        // Fall back to modification time
        const filterDate = new Date(dateFilter);
        return mtime < filterDate;
    }

    /**
     * Check if file should be deleted based on date filter
     */
    shouldDeleteByDate(filename, dateFilter) {
        if (!dateFilter) return true;
        
        // Extract date from filename (format: YYYY-MM-DD_HH-mm-ss_JST.log)
        const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
        if (!dateMatch) return false;
        
        const fileDate = new Date(dateMatch[1]);
        const filterDate = new Date(dateFilter);
        
        return fileDate < filterDate;
    }

    /**
     * Create backup of files before deletion
     */
    async createBackup(files) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.backupDir, `log_backup_${timestamp}.tar.gz`);
        
        console.log(`Creating backup at: ${backupPath}`);
        
        // Ensure backup directory exists
        await fs.mkdir(this.backupDir, { recursive: true });
        
        // Create backup using tar and gzip
        const { spawn } = await import('child_process');
        const { promisify } = await import('util');
        const execFile = promisify(spawn);
        
        try {
            // Create a list of files to backup
            const fileList = files.map(f => f.relativePath);
            const listFile = path.join(this.backupDir, `backup_list_${timestamp}.txt`);
            await fs.writeFile(listFile, fileList.join('\n'));
            
            // Use tar to create compressed backup
            const tar = spawn('tar', [
                '-czf', backupPath,
                '-C', this.logDir,
                '-T', listFile
            ]);
            
            await new Promise((resolve, reject) => {
                tar.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`tar process exited with code ${code}`));
                    }
                });
                tar.on('error', reject);
            });
            
            // Clean up temporary file list
            await fs.unlink(listFile);
            
            console.log(`✅ Backup created successfully: ${backupPath}`);
            return backupPath;
        } catch (error) {
            throw new Error(`Failed to create backup: ${error.message}`);
        }
    }

    /**
     * Remove empty directories recursively
     */
    async removeEmptyDirectories(startDir, options) {
        if (options.dryRun) {
            console.log(`\n🗂️  Would remove empty directories in: ${startDir}`);
            return;
        }

        console.log(`\n🗂️  Removing empty directories...`);
        
        const removedDirs = [];
        
        async function removeEmptyDirsRecursive(dir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                // Process subdirectories first
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const subDir = path.join(dir, entry.name);
                        await removeEmptyDirsRecursive(subDir);
                    }
                }
                
                // Check if directory is now empty
                const remainingEntries = await fs.readdir(dir);
                if (remainingEntries.length === 0 && dir !== startDir) {
                    await fs.rmdir(dir);
                    removedDirs.push(path.relative(this.logDir, dir));
                    console.log(`  Removed empty directory: ${path.relative(this.logDir, dir)}`);
                }
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn(`Warning: Could not process directory ${dir}: ${error.message}`);
                }
            }
        }
        
        await removeEmptyDirsRecursive(startDir);
        
        if (removedDirs.length > 0) {
            console.log(`✅ Removed ${removedDirs.length} empty directories`);
        } else {
            console.log(`✅ No empty directories to remove`);
        }
        
        return removedDirs;
    }

    /**
     * Format file size for display
     */
    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * Ask for user confirmation
     */
    async askConfirmation(message) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        return new Promise((resolve) => {
            rl.question(`${message} (y/N): `, (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
            });
        });
    }

    /**
     * Delete files with progress reporting
     */
    async deleteFiles(files, options) {
        console.log(`\n🗑️  Deleting ${files.length} log files...`);
        
        const progressInterval = Math.max(1, Math.floor(files.length / 10));
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                if (!options.dryRun) {
                    await fs.unlink(file.path);
                }
                
                this.stats.filesDeleted++;
                this.stats.totalSizeDeleted += file.size;
                
                if ((i + 1) % progressInterval === 0 || i === files.length - 1) {
                    const progress = Math.round(((i + 1) / files.length) * 100);
                    console.log(`Progress: ${progress}% (${i + 1}/${files.length})`);
                }
            } catch (error) {
                this.stats.errors.push({
                    file: file.relativePath,
                    error: error.message
                });
                console.error(`❌ Failed to delete ${file.relativePath}: ${error.message}`);
            }
        }
    }

    /**
     * Display summary of findings
     */
    displaySummary(files, options) {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        
        console.log(`\n📊 Summary:`);
        console.log(`  Files found: ${files.length}`);
        console.log(`  Total size: ${this.formatSize(totalSize)}`);
        
        if (options.repoFilter) {
            console.log(`  Repository filter: ${options.repoFilter}`);
        }
        if (options.categoryFilter) {
            console.log(`  Category filter: ${options.categoryFilter}`);
        }
        if (options.dateFilter) {
            console.log(`  Date filter: older than ${options.dateFilter}`);
        }
        
        // Show which directories are being cleaned
        const directories = ['log'];
        if (options.includeLogs) directories.push('logs');
        if (options.includeOutput) directories.push('output');
        console.log(`  Target directories: /app/${directories.join(', /app/')}`);
        
        if (files.length > 0) {
            console.log(`\n📁 Files to be ${options.dryRun ? 'deleted' : 'DELETED'}:`);
            
            // Group by file type
            const byType = {};
            files.forEach(file => {
                const type = file.type || 'structured-log';
                if (!byType[type]) byType[type] = [];
                byType[type].push(file);
            });
            
            Object.entries(byType).forEach(([type, typeFiles]) => {
                const typeSize = typeFiles.reduce((sum, f) => sum + f.size, 0);
                console.log(`\n  📂 ${type.toUpperCase()} (${typeFiles.length} files, ${this.formatSize(typeSize)}):`);
                
                if (type === 'structured-log') {
                    // Group structured logs by repository
                    const byRepo = {};
                    typeFiles.forEach(file => {
                        if (!byRepo[file.repo]) byRepo[file.repo] = [];
                        byRepo[file.repo].push(file);
                    });
                    
                    Object.entries(byRepo).forEach(([repo, repoFiles]) => {
                        console.log(`    ${repo}/ (${repoFiles.length} files, ${this.formatSize(repoFiles.reduce((sum, f) => sum + f.size, 0))})`);
                        repoFiles.slice(0, 3).forEach(file => {
                            console.log(`      - ${file.relativePath} (${this.formatSize(file.size)})`);
                        });
                        if (repoFiles.length > 3) {
                            console.log(`      ... and ${repoFiles.length - 3} more files`);
                        }
                    });
                } else {
                    // Show other file types directly
                    typeFiles.slice(0, 5).forEach(file => {
                        console.log(`    - ${file.relativePath} (${this.formatSize(file.size)})`);
                    });
                    if (typeFiles.length > 5) {
                        console.log(`    ... and ${typeFiles.length - 5} more files`);
                    }
                }
            });
        }
    }

    /**
     * Display final results
     */
    displayResults(options) {
        console.log(`\n✅ Operation completed!`);
        console.log(`  Files processed: ${this.stats.filesDeleted}`);
        console.log(`  Space ${options.dryRun ? 'would be' : ''} freed: ${this.formatSize(this.stats.totalSizeDeleted)}`);
        
        if (this.stats.errors.length > 0) {
            console.log(`\n⚠️  Errors encountered: ${this.stats.errors.length}`);
            this.stats.errors.forEach(error => {
                console.log(`  - ${error.file}: ${error.error}`);
            });
        }
    }

    /**
     * Main execution function
     */
    async run() {
        const options = this.parseArgs();
        
        if (options.help) {
            this.showHelp();
            return;
        }
        
        console.log(`🧹 Log Cleanup Script`);
        console.log(`Target directories:`);
        console.log(`  - /app/log (${this.logDir})`);
        if (options.includeLogs) {
            console.log(`  - /app/logs (${this.logsDir})`);
        }
        if (options.includeOutput) {
            console.log(`  - /app/output (${this.outputDir})`);
        }
        
        if (options.dryRun) {
            console.log(`🔍 DRY RUN MODE - No files will be actually deleted`);
        }
        
        try {
            // Find files to delete
            console.log(`\n🔍 Scanning for log files...`);
            const files = await this.findLogFiles(options);
            this.stats.filesFound = files.length;
            
            if (files.length === 0) {
                console.log(`✅ No log files found matching the criteria.`);
                return;
            }
            
            // Display summary
            this.displaySummary(files, options);
            
            // Confirmation
            if (options.interactive && !options.dryRun) {
                const confirmed = await this.askConfirmation(`\nProceed with deletion?`);
                if (!confirmed) {
                    console.log(`Operation cancelled.`);
                    return;
                }
            }
            
            // Create backup if requested
            if (options.backup && !options.dryRun) {
                await this.createBackup(files);
            }
            
            // Delete files
            if (!options.dryRun) {
                await this.deleteFiles(files, options);
            } else {
                this.stats.filesDeleted = files.length;
                this.stats.totalSizeDeleted = files.reduce((sum, file) => sum + file.size, 0);
            }
            
            // Remove empty directories if requested
            if (options.removeEmptyDirs) {
                await this.removeEmptyDirectories(this.logDir, options);
                if (options.includeLogs) {
                    await this.removeEmptyDirectories(this.logsDir, options);
                }
                if (options.includeOutput) {
                    await this.removeEmptyDirectories(this.outputDir, options);
                }
            }
            
            // Display results
            this.displayResults(options);
            
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            process.exit(1);
        }
    }
}

// Execute if running directly
if (process.argv[1] === __filename) {
    const cleanup = new LogCleanup();
    cleanup.run().catch(error => {
        console.error(`Fatal error: ${error.message}`);
        process.exit(1);
    });
}

export default LogCleanup;
