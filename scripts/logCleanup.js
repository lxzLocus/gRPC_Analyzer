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
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LogCleanup {
    constructor() {
        this.logDir = path.resolve(__dirname, '../log');
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
  -h, --help            Show this help message

Examples:
  node scripts/logCleanup.js --dry-run
  node scripts/logCleanup.js --date 2025-07-01 --backup
  node scripts/logCleanup.js --repo boulder --category issue
  node scripts/logCleanup.js --yes --date 2025-08-01

Date format for filtering:
  Logs with dates older than the specified date will be deleted.
  Date format should be YYYY-MM-DD (e.g., 2025-08-01)
        `);
    }

    /**
     * Find all log files matching the criteria
     */
    async findLogFiles(options) {
        const files = [];
        
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
                                            relativePath: path.relative(this.logDir, fullPath),
                                            size: stats.size,
                                            mtime: stats.mtime,
                                            repo: repo.name,
                                            category: category.name,
                                            name: logFile
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
                                    relativePath: path.relative(this.logDir, fullPath),
                                    size: stats.size,
                                    mtime: stats.mtime,
                                    repo: repo.name,
                                    category: category.name,
                                    name: item.name
                                });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            throw new Error(`Failed to scan log directory: ${error.message}`);
        }

        return files;
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
        
        if (files.length > 0) {
            console.log(`\n📁 Files to be ${options.dryRun ? 'deleted' : 'DELETED'}:`);
            
            // Group by repository for better display
            const byRepo = {};
            files.forEach(file => {
                if (!byRepo[file.repo]) byRepo[file.repo] = [];
                byRepo[file.repo].push(file);
            });
            
            Object.entries(byRepo).forEach(([repo, repoFiles]) => {
                console.log(`  ${repo}/ (${repoFiles.length} files, ${this.formatSize(repoFiles.reduce((sum, f) => sum + f.size, 0))})`);
                repoFiles.slice(0, 5).forEach(file => {
                    console.log(`    - ${file.relativePath} (${this.formatSize(file.size)})`);
                });
                if (repoFiles.length > 5) {
                    console.log(`    ... and ${repoFiles.length - 5} more files`);
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
        console.log(`Target directory: ${this.logDir}`);
        
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
