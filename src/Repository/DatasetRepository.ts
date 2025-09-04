/**
 * データセットリポジトリ
 * データセットファイルシステムへのアクセスを抽象化
 */

import * as fs from 'fs';
import * as path from 'path';
import { DatasetValidationResult } from '../types/BatchProcessTypes.js';

// Node.js型の宣言
declare const process: any;

export class DatasetRepository {
    
    /**
     * データセット構造の検証
     */
    async validateStructure(datasetDir: string): Promise<DatasetValidationResult> {
        const issues: string[] = [];

        if (!fs.existsSync(datasetDir)) {
            issues.push(`Dataset directory not found: ${datasetDir}`);
            return {
                isValid: false,
                repositoryCount: 0,
                totalPullRequests: 0,
                issues
            };
        }

        const repositories = this.getDirectories(datasetDir);
        let totalPullRequests = 0;

        for (const repo of repositories) {
            const repoPath = path.join(datasetDir, repo);
            const categories = this.getDirectories(repoPath);
            
            for (const category of categories) {
                const categoryPath = path.join(repoPath, category);
                const pullRequests = this.getDirectories(categoryPath);
                totalPullRequests += pullRequests.length;

                // premergeディレクトリの存在確認
                for (const pr of pullRequests) {
                    const prPath = path.join(categoryPath, pr);
                    const hasPremerge = await this.hasPremergeDirectory(prPath);
                    if (!hasPremerge) {
                        issues.push(`No premerge directory found in ${prPath}`);
                    }
                }
            }
        }

        return {
            isValid: issues.length === 0,
            repositoryCount: repositories.length,
            totalPullRequests,
            issues
        };
    }

    /**
     * リポジトリ一覧の取得
     */
    async getRepositoryList(datasetDir: string): Promise<string[]> {
        return this.getDirectories(datasetDir);
    }

    /**
     * カテゴリ一覧の取得
     */
    async getCategoryList(datasetDir: string, repositoryName: string): Promise<string[]> {
        const repositoryPath = path.join(datasetDir, repositoryName);
        return this.getDirectories(repositoryPath);
    }

    /**
     * プルリクエスト一覧の取得
     */
    async getPullRequestList(
        datasetDir: string,
        repositoryName: string,
        category: string
    ): Promise<string[]> {
        const categoryPath = path.join(datasetDir, repositoryName, category);
        return this.getDirectories(categoryPath);
    }

    /**
     * プルリクエストパスの取得
     */
    async getPullRequestPath(
        datasetDir: string,
        repositoryName: string,
        category: string,
        pullRequestTitle: string
    ): Promise<string> {
        return path.join(datasetDir, repositoryName, category, pullRequestTitle);
    }

    /**
     * premergeディレクトリの検索
     */
    async findPremergeDirectory(pullRequestPath: string): Promise<string | null> {
        try {
            const items = fs.readdirSync(pullRequestPath);
            for (const item of items) {
                const itemPath = path.join(pullRequestPath, item);
                if (fs.statSync(itemPath).isDirectory() && item.startsWith('premerge')) {
                    return itemPath;
                }
            }
            return null;
        } catch (error) {
            console.error(`Error finding premerge directory in ${pullRequestPath}:`, error);
            return null;
        }
    }

    /**
     * premergeディレクトリの存在確認
     */
    async hasPremergeDirectory(pullRequestPath: string): Promise<boolean> {
        try {
            const items = fs.readdirSync(pullRequestPath);
            return items.some((item: any) => {
                const itemPath = path.join(pullRequestPath, item);
                return fs.statSync(itemPath).isDirectory() && item.startsWith('premerge');
            });
        } catch (error) {
            return false;
        }
    }

    /**
     * ログファイルの存在確認と取得
     */
    async getLogFiles(repositoryName: string, category: string, pullRequestTitle: string): Promise<string[]> {
        try {
            const logDir = path.join('/app/log', repositoryName, category, pullRequestTitle);
            if (!fs.existsSync(logDir)) {
                return [];
            }

            return fs.readdirSync(logDir).filter((file: any) => file.endsWith('.log'));
        } catch (error) {
            console.error(`Error reading log files for ${pullRequestTitle}:`, error);
            return [];
        }
    }

    /**
     * ログファイルの内容取得
     */
    async readLogFile(repositoryName: string, category: string, pullRequestTitle: string, fileName: string): Promise<string | null> {
        try {
            const logFilePath = path.join('/app/log', repositoryName, category, pullRequestTitle, fileName);
            if (!fs.existsSync(logFilePath)) {
                return null;
            }

            return fs.readFileSync(logFilePath, 'utf-8');
        } catch (error) {
            console.error(`Error reading log file ${fileName} for ${pullRequestTitle}:`, error);
            return null;
        }
    }

    /**
     * ディレクトリ一覧の取得（ヘルパーメソッド）
     */
    private getDirectories(dirPath: string): string[] {
        try {
            return fs.readdirSync(dirPath).filter((item: any) => {
                return fs.statSync(path.join(dirPath, item)).isDirectory();
            });
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
            return [];
        }
    }

    /**
     * ファイルの存在確認
     */
    async fileExists(filePath: string): Promise<boolean> {
        try {
            return fs.existsSync(filePath);
        } catch (error) {
            return false;
        }
    }

    /**
     * ディレクトリの作成
     */
    async ensureDirectory(dirPath: string): Promise<void> {
        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        } catch (error) {
            console.error(`Error creating directory ${dirPath}:`, error);
            throw error;
        }
    }

    /**
     * ファイルの読み込み
     */
    async readFile(filePath: string): Promise<string> {
        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * ファイルの書き込み
     */
    async writeFile(filePath: string, content: string): Promise<void> {
        try {
            fs.writeFileSync(filePath, content, 'utf-8');
        } catch (error) {
            console.error(`Error writing file ${filePath}:`, error);
            throw error;
        }
    }
}
