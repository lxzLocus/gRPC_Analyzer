/**
 * ファイル管理クラス
 * プロンプトファイルの読み込みとテンプレート処理を担当
 */

import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import Config from './config.js';
import type { RequiredFileInfo } from './types.js';
// @ts-ignore: 動的インポートのため型チェックを無視  
import getSurroundingDirectoryStructure from './generatePeripheralStructure.js';

class FileManager {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    readFirstPromptFile(): string {
        const promptText = fs.readFileSync(path.join(this.config.promptDir, this.config.promptTextfile), 'utf-8');
        const protoFileContent = fs.readFileSync(path.join(this.config.promptDir, '01_proto.txt'), 'utf-8');
        const protoFileChanges = fs.readFileSync(path.join(this.config.promptDir, '02_protoFileChanges.txt'), 'utf-8');
        const fileChangesContent = fs.readFileSync(path.join(this.config.promptDir, '03_fileChanges.txt'), 'utf-8');
        const allFilePaths = fs.readFileSync(path.join(this.config.promptDir, '04_allFilePaths.txt'), 'utf-8');
        const suspectedFiles = fs.readFileSync(path.join(this.config.promptDir, '05_suspectedFiles.txt'), 'utf-8');

        const context = {
            protoFile: protoFileContent,
            protoFileChanges: protoFileChanges,
            fileChanges: fileChangesContent,
            allFilePaths: allFilePaths,
            suspectedFiles: suspectedFiles
        };
        const template = Handlebars.compile(promptText, { noEscape: true });
        return template(context);
    }

    /**
     * FILE_CONTENTタイプのリクエストを処理してファイル内容を取得
     * @param fileInfos - FILE_CONTENTタイプのRequiredFileInfo配列
     * @returns ファイル内容の文字列
     */
    async getFileContents(fileInfos: RequiredFileInfo[]): Promise<string> {
        const filePaths = fileInfos
            .filter(info => info.type === 'FILE_CONTENT')
            .map(info => path.join(this.config.inputProjectDir, info.path));

        if (filePaths.length === 0) {
            return '';
        }

        const contents: string[] = [];
        for (const filePath of filePaths) {
            try {
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const relativePath = path.relative(this.config.inputProjectDir, filePath);
                    contents.push(`--- ${relativePath}\n${content}`);
                } else {
                    const relativePath = path.relative(this.config.inputProjectDir, filePath);
                    contents.push(`--- ${relativePath}\n[ファイルが見つかりません]`);
                }
            } catch (e) {
                console.error(`Error reading file ${filePath}:`, e);
                const relativePath = path.relative(this.config.inputProjectDir, filePath);
                contents.push(`--- ${relativePath}\n[ファイル読み込みエラー: ${(e as Error).message}]`);
            }
        }
        return contents.join('\n\n');
    }

    /**
     * DIRECTORY_LISTINGタイプのリクエストを処理してディレクトリ構造を取得
     * @param fileInfos - DIRECTORY_LISTINGタイプのRequiredFileInfo配列
     * @returns ディレクトリ構造のJSON文字列
     */
    async getDirectoryListings(fileInfos: RequiredFileInfo[]): Promise<string> {
        const directoryPaths = fileInfos
            .filter(info => info.type === 'DIRECTORY_LISTING')
            .map(info => path.join(this.config.inputProjectDir, info.path));

        if (directoryPaths.length === 0) {
            return '';
        }

        const results: Record<string, any> = {};

        for (const dirPath of directoryPaths) {
            const relativePath = path.relative(this.config.inputProjectDir, dirPath);
            try {
                // generatePeripheralStructureを使用してディレクトリ構造を取得
                const structure = getSurroundingDirectoryStructure(dirPath, 2);
                results[relativePath] = structure;
            } catch (error) {
                console.error(`Error getting directory structure for ${dirPath}:`, error);
                results[relativePath] = { error: (error as Error).message };
            }
        }

        return JSON.stringify(results, null, 2);
    }

    /**
     * RequiredFileInfosを処理して適切な内容を取得
     * @param fileInfos - RequiredFileInfo配列
     * @returns 結合された結果文字列
     */
    async processRequiredFileInfos(fileInfos: RequiredFileInfo[]): Promise<string> {
        const results: string[] = [];

        // FILE_CONTENTタイプを処理
        const fileContentInfos = fileInfos.filter(info => info.type === 'FILE_CONTENT');
        if (fileContentInfos.length > 0) {
            const fileContents = await this.getFileContents(fileContentInfos);
            if (fileContents) {
                results.push('=== FILE CONTENTS ===\n' + fileContents);
            }
        }

        // DIRECTORY_LISTINGタイプを処理
        const directoryListingInfos = fileInfos.filter(info => info.type === 'DIRECTORY_LISTING');
        if (directoryListingInfos.length > 0) {
            const directoryListings = await this.getDirectoryListings(directoryListingInfos);
            if (directoryListings) {
                results.push('=== DIRECTORY STRUCTURES ===\n' + directoryListings);
            }
        }

        return results.join('\n\n');
    }
}

export default FileManager;
