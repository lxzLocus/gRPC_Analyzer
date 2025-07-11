/**
 * ファイル管理クラス
 * プロンプトファイルの読み込みとテンプレート処理を担当
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import Handlebars from 'handlebars';
import Config from './config.js';
import Logger from './logger.js';
import type { 
    RequiredFileInfo, 
    PromptTemplateContext, 
    PromptFileConfig,
    FileProcessingResult,
    FileProcessingSummary,
    FileOperationConfig
} from './types.js';
// @ts-ignore: 動的インポートのため型チェックを無視  
import getSurroundingDirectoryStructure from './generatePeripheralStructure.js';

// 非同期ファイル操作
const readFileAsync = promisify(fs.readFile);
const statAsync = promisify(fs.stat);

class FileManager {
    config: Config;
    logger: Logger;
    
    // デフォルトのプロンプトファイル設定
    private readonly defaultPromptFiles: PromptFileConfig = {
        promptTextfile: '00_prompt.txt',
        protoFile: '01_proto.txt',
        protoFileChanges: '02_protoFileChanges.txt',
        fileChanges: '03_fileChanges.txt',
        surroundedFilePath: '04_surroundedFilePath.txt',
        suspectedFiles: '05_suspectedFiles.txt'
    };

    // ファイル操作の設定
    private readonly fileOperationConfig: FileOperationConfig = {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        timeoutMs: 30000, // 30秒
        encoding: 'utf-8',
        enableSizeCheck: true,
        enableTimeoutCheck: true
    };

    constructor(config: Config, logger: Logger) {
        this.config = config;
        this.logger = logger;
    }

    /**
     * プロンプトファイルの存在確認
     * @param filename プロンプトファイル名
     * @returns ファイルが存在するかどうか
     */
    private checkPromptFileExists(filename: string): boolean {
        // 1. データセットディレクトリからの検索
        const datasetPromptPath = this.findPromptFileInDataset(filename);
        if (datasetPromptPath) {
            return true;
        }
        
        // 2. デフォルトのプロンプトディレクトリからの検索
        const filePath = path.join(this.config.promptDir, filename);
        return fs.existsSync(filePath);
    }

    /**
     * データセットディレクトリ内でプロンプトファイルを検索
     * @param filename プロンプトファイル名
     * @returns 見つかったファイルのパス（見つからない場合はnull）
     */
    private findPromptFileInDataset(filename: string): string | null {
        if (!this.config.inputProjectDir) {
            return null;
        }

        // inputProjectDirの親ディレクトリ（pullrequestディレクトリ）を取得
        const pullRequestDir = path.dirname(this.config.inputProjectDir);
        const datasetPromptPath = path.join(pullRequestDir, filename);
        
        if (fs.existsSync(datasetPromptPath)) {
            console.log(`📁 データセットプロンプトファイルを発見: ${datasetPromptPath}`);
            return datasetPromptPath;
        }
        
        return null;
    }

    /**
     * プロンプトファイルを安全に読み込み
     * @param filename プロンプトファイル名
     * @param fallbackContent フォールバック用のコンテンツ
     * @returns ファイル内容またはフォールバック内容
     */
    private safeReadPromptFile(filename: string, fallbackContent: string = ''): string {
        // 1. データセットディレクトリからの読み込みを試行
        const datasetPromptPath = this.findPromptFileInDataset(filename);
        if (datasetPromptPath) {
            try {
                const content = fs.readFileSync(datasetPromptPath, 'utf-8');
                console.log(`✅ データセットプロンプトファイルを読み込み: ${filename}`);
                return content;
            } catch (error) {
                console.warn(`⚠️  データセットプロンプトファイル読み込みエラー: ${filename}`, error);
            }
        }
        
        // 2. デフォルトディレクトリからの読み込みを試行
        const filePath = path.join(this.config.promptDir, filename);
        
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  プロンプトファイルが見つかりません: ${filename}`);
            console.warn(`   検索パス1: ${datasetPromptPath || 'データセット未指定'}`);
            console.warn(`   検索パス2: ${filePath}`);
            console.warn(`   フォールバック内容を使用します`);
            return fallbackContent;
        }

        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
            console.error(`❌ プロンプトファイル読み込みエラー: ${filename}`);
            console.error(`   エラー詳細: ${(error as Error).message}`);
            console.warn(`   フォールバック内容を使用します`);
            return fallbackContent;
        }
    }

    /**
     * テンプレート変数の検証
     * @param context テンプレートコンテキスト
     * @returns 検証結果とエラーメッセージ
     */
    private validateTemplateContext(context: PromptTemplateContext): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        const requiredFields: (keyof PromptTemplateContext)[] = [
            'protoFile', 'protoFileChanges', 'fileChanges', 'surroundedFilePath', 'suspectedFiles'
        ];

        requiredFields.forEach(field => {
            if (!context[field] || context[field].trim() === '') {
                errors.push(`テンプレート変数 '${field}' が空です`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    readFirstPromptFile(): string {
        console.log('📋 プロンプトファイルの読み込みを開始...');
        
        // メインプロンプトファイルの読み込み
        const promptText = this.safeReadPromptFile(
            this.config.promptTextfile,
            '# デフォルトプロンプト\n\nFix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections.\n\n{{protoFile}}\n{{protoFileChanges}}\n{{fileChanges}}\n{{surroundedFilePath}}\n{{suspectedFiles}}'
        );

        // 各プロンプトファイルの読み込み（フォールバック付き）
        const protoFileContent = this.safeReadPromptFile(
            this.defaultPromptFiles.protoFile,
            '# プロトファイル情報が利用できません'
        );
        const protoFileChanges = this.safeReadPromptFile(
            this.defaultPromptFiles.protoFileChanges,
            '# プロトファイル変更情報が利用できません'
        );
        const fileChangesContent = this.safeReadPromptFile(
            this.defaultPromptFiles.fileChanges,
            '# ファイル変更情報が利用できません'
        );
        const surroundedFilePath = this.safeReadPromptFile(
            this.defaultPromptFiles.surroundedFilePath,
            '# ファイルパス情報が利用できません'
        );
        const suspectedFiles = this.safeReadPromptFile(
            this.defaultPromptFiles.suspectedFiles,
            '# 疑わしいファイル情報が利用できません'
        );

        // テンプレートコンテキストの構築と検証
        const context: PromptTemplateContext = {
            protoFile: protoFileContent,
            protoFileChanges: protoFileChanges,
            fileChanges: fileChangesContent,
            surroundedFilePath: surroundedFilePath,
            suspectedFiles: suspectedFiles
        };

        const validation = this.validateTemplateContext(context);
        if (!validation.isValid) {
            console.warn('⚠️  テンプレート変数に問題があります:');
            validation.errors.forEach(error => console.warn(`   - ${error}`));
        }

        // Handlebarsテンプレートのコンパイルと実行
        try {
            const template = Handlebars.compile(promptText, { noEscape: true });
            const result = template(context);
            console.log('✅ プロンプトファイルの読み込み完了');
            return result;
        } catch (error) {
            console.error('❌ Handlebarsテンプレートのコンパイルエラー:', (error as Error).message);
            console.warn('⚠️  フォールバック: 変数展開なしのプロンプトテキストを返します');
            return promptText;
        }
    }

    /**
     * FILE_CONTENTタイプのリクエストを処理してファイル内容を取得（最適化版）
     * @param fileInfos - FILE_CONTENTタイプのRequiredFileInfo配列
     * @returns ファイル内容の文字列
     */
    async getFileContents(fileInfos: RequiredFileInfo[]): Promise<string> {
        const startTime = Date.now();
        console.log('📂 ファイル内容取得を開始...');

        const filePaths = fileInfos
            .filter(info => info.type === 'FILE_CONTENT')
            .map(info => path.join(this.config.inputProjectDir, info.path));

        if (filePaths.length === 0) {
            console.log('📂 処理対象ファイルなし');
            return '';
        }

        console.log(`📂 対象ファイル数: ${filePaths.length}`);

        // バッチでファイル存在確認とサイズチェック
        const fileChecks = await this.batchFileExistenceCheck(filePaths);
        
        // 統計情報の初期化
        const summary: FileProcessingSummary = {
            totalFiles: filePaths.length,
            successCount: 0,
            errorCount: 0,
            totalSize: 0,
            totalProcessingTime: 0,
            errors: []
        };

        const contents: string[] = [];
        const results: FileProcessingResult[] = [];

        // ファイルごとの処理
        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            const fileCheck = fileChecks[i];
            const relativePath = path.relative(this.config.inputProjectDir, filePath);
            const fileStartTime = Date.now();

            let result: FileProcessingResult = {
                success: false,
                path: filePath,
                relativePath: relativePath,
                processingTime: 0
            };

            try {
                if (!fileCheck.exists) {
                    // 類似ファイルを探す
                    const originalPath = fileInfos[i].path;
                    const suggestions = await this.findSimilarFiles(originalPath, this.config.inputProjectDir);
                    const suggestionText = suggestions.length > 0 
                        ? `\n\n類似ファイルの候補:\n${suggestions.slice(0, 5).map((s: string) => `  - ${s}`).join('\n')}`
                        : '';
                    
                    const errorMsg = `ファイルが見つかりません: ${fileCheck.error || 'File not found'}${suggestionText}`;
                    contents.push(`--- ${relativePath}\n[${errorMsg}]`);
                    result.error = errorMsg;
                    summary.errors.push({ path: relativePath, error: errorMsg });
                    summary.errorCount++;
                } else if (!fileCheck.isFile) {
                    const errorMsg = 'ディレクトリが指定されました（ファイルを期待）';
                    contents.push(`--- ${relativePath}\n[${errorMsg}]`);
                    result.error = errorMsg;
                    summary.errors.push({ path: relativePath, error: errorMsg });
                    summary.errorCount++;
                } else if (!this.isFileSizeWithinLimit(fileCheck.size)) {
                    const errorMsg = `ファイルサイズが制限を超えています: ${this.formatFileSize(fileCheck.size)} > ${this.formatFileSize(this.fileOperationConfig.maxFileSize)}`;
                    contents.push(`--- ${relativePath}\n[${errorMsg}]`);
                    result.error = errorMsg;
                    summary.errors.push({ path: relativePath, error: errorMsg });
                    summary.errorCount++;
                } else {
                    // ファイル読み込み
                    const content = await this.readFileWithTimeout(filePath);
                    contents.push(`--- ${relativePath}\n${content}`);
                    
                    result.success = true;
                    result.size = fileCheck.size;
                    summary.successCount++;
                    summary.totalSize += fileCheck.size;
                    
                    console.log(`  ✅ ${relativePath} (${this.formatFileSize(fileCheck.size)})`);
                }
            } catch (error) {
                const errorMsg = `ファイル読み込みエラー: ${(error as Error).message}`;
                contents.push(`--- ${relativePath}\n[${errorMsg}]`);
                result.error = errorMsg;
                summary.errors.push({ path: relativePath, error: errorMsg });
                summary.errorCount++;
                console.error(`  ❌ ${relativePath}: ${errorMsg}`);
                
                // 詳細なファイル操作エラーログを記録
                this.logger.logFileOperationError(
                    'READ_FILE',
                    filePath,
                    error as Error,
                    {
                        relativePath,
                        attemptedEncoding: this.fileOperationConfig.encoding,
                        maxFileSize: this.fileOperationConfig.maxFileSize,
                        timeout: this.fileOperationConfig.timeoutMs
                    }
                );
            }

            result.processingTime = Date.now() - fileStartTime;
            summary.totalProcessingTime += result.processingTime;
            results.push(result);
        }

        // 統計情報の出力
        const totalTime = Date.now() - startTime;
        console.log('\n📊 ファイル処理統計:');
        console.log(`   成功: ${summary.successCount}/${summary.totalFiles} ファイル`);
        console.log(`   エラー: ${summary.errorCount}/${summary.totalFiles} ファイル`);
        console.log(`   総サイズ: ${this.formatFileSize(summary.totalSize)}`);
        console.log(`   処理時間: ${totalTime}ms`);
        
        if (summary.errors.length > 0) {
            console.log('   ❌ エラー詳細:');
            summary.errors.forEach(err => console.log(`      - ${err.path}: ${err.error}`));
        }

        return contents.join('\n\n');
    }

    /**
     * DIRECTORY_LISTINGタイプのリクエストを処理してディレクトリ構造を取得（最適化版）
     * @param fileInfos - DIRECTORY_LISTINGタイプのRequiredFileInfo配列
     * @returns ディレクトリ構造のJSON文字列
     */
    async getDirectoryListings(fileInfos: RequiredFileInfo[]): Promise<string> {
        const startTime = Date.now();
        console.log('📁 ディレクトリ構造取得を開始...');

        const directoryPaths = fileInfos
            .filter(info => info.type === 'DIRECTORY_LISTING')
            .map(info => path.join(this.config.inputProjectDir, info.path));

        if (directoryPaths.length === 0) {
            console.log('📁 処理対象ディレクトリなし');
            return '';
        }

        console.log(`📁 対象ディレクトリ数: ${directoryPaths.length}`);

        // バッチでディレクトリ存在確認
        const dirChecks = await this.batchFileExistenceCheck(directoryPaths);
        
        const results: Record<string, any> = {};
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < directoryPaths.length; i++) {
            const dirPath = directoryPaths[i];
            const dirCheck = dirChecks[i];
            const relativePath = path.relative(this.config.inputProjectDir, dirPath);
            const dirStartTime = Date.now();

            try {
                if (!dirCheck.exists) {
                    const errorMsg = `ディレクトリが見つかりません: ${dirCheck.error || 'Directory not found'}`;
                    results[relativePath] = { error: errorMsg };
                    errorCount++;
                    console.error(`  ❌ ${relativePath}: ${errorMsg}`);
                } else if (dirCheck.isFile) {
                    const errorMsg = 'ファイルが指定されました（ディレクトリを期待）';
                    results[relativePath] = { error: errorMsg };
                    errorCount++;
                    console.error(`  ❌ ${relativePath}: ${errorMsg}`);
                } else {
                    // ディレクトリ構造の取得
                    const structure = getSurroundingDirectoryStructure(dirPath, 2);
                    results[relativePath] = structure;
                    successCount++;
                    
                    const processingTime = Date.now() - dirStartTime;
                    console.log(`  ✅ ${relativePath} (${processingTime}ms)`);
                }
            } catch (error) {
                const errorMsg = `ディレクトリ構造取得エラー: ${(error as Error).message}`;
                results[relativePath] = { error: errorMsg };
                errorCount++;
                console.error(`  ❌ ${relativePath}: ${errorMsg}`);
                
                // 詳細なファイル操作エラーログを記録
                this.logger.logFileOperationError(
                    'READ_DIRECTORY',
                    dirPath,
                    error as Error,
                    {
                        relativePath,
                        requestedDepth: 2,
                        operation: 'getSurroundingDirectoryStructure'
                    }
                );
            }
        }

        // 統計情報の出力
        const totalTime = Date.now() - startTime;
        console.log('\n📊 ディレクトリ処理統計:');
        console.log(`   成功: ${successCount}/${directoryPaths.length} ディレクトリ`);
        console.log(`   エラー: ${errorCount}/${directoryPaths.length} ディレクトリ`);
        console.log(`   処理時間: ${totalTime}ms`);

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

    /**
     * プロンプトディレクトリ内のファイル一覧を取得
     * @returns プロンプトファイル一覧
     */
    getPromptFilesList(): { available: string[]; missing: string[]; total: number } {
        const allPromptFiles = Object.values(this.defaultPromptFiles);
        const available: string[] = [];
        const missing: string[] = [];

        allPromptFiles.forEach(filename => {
            if (this.checkPromptFileExists(filename)) {
                available.push(filename);
            } else {
                missing.push(filename);
            }
        });

        return {
            available,
            missing,
            total: allPromptFiles.length
        };
    }

    /**
     * プロンプトファイルの状態をログ出力
     */
    logPromptFilesStatus(): void {
        const status = this.getPromptFilesList();
        console.log('📁 プロンプトファイル状態:');
        console.log(`   利用可能: ${status.available.length}/${status.total} ファイル`);
        
        if (status.available.length > 0) {
            console.log('   ✅ 利用可能ファイル:');
            status.available.forEach(file => console.log(`      - ${file}`));
        }
        
        if (status.missing.length > 0) {
            console.log('   ❌ 不足ファイル:');
            status.missing.forEach(file => console.log(`      - ${file}`));
        }
    }

    /**
     * ファイル操作設定の更新
     * @param config 新しい設定
     */
    updateFileOperationConfig(config: Partial<FileOperationConfig>): void {
        Object.assign(this.fileOperationConfig, config);
        console.log('⚙️  ファイル操作設定を更新しました:', {
            maxFileSize: this.formatFileSize(this.fileOperationConfig.maxFileSize),
            timeoutMs: `${this.fileOperationConfig.timeoutMs}ms`,
            encoding: this.fileOperationConfig.encoding,
            enableSizeCheck: this.fileOperationConfig.enableSizeCheck,
            enableTimeoutCheck: this.fileOperationConfig.enableTimeoutCheck
        });
    }

    /**
     * 現在のファイル操作設定を取得
     * @returns 現在の設定
     */
    getFileOperationConfig(): FileOperationConfig {
        return { ...this.fileOperationConfig };
    }

    /**
     * バッチでファイル存在確認とサイズチェック
     * @param filePaths ファイルパスの配列
     * @returns ファイル情報の配列
     */
    private async batchFileExistenceCheck(filePaths: string[]): Promise<Array<{
        path: string;
        exists: boolean;
        size: number;
        isFile: boolean;
        error?: string;
    }>> {
        const results = await Promise.allSettled(
            filePaths.map(async (filePath) => {
                try {
                    const stats = await statAsync(filePath);
                    return {
                        path: filePath,
                        exists: true,
                        size: stats.size,
                        isFile: stats.isFile(),
                        error: undefined
                    };
                } catch (error) {
                    return {
                        path: filePath,
                        exists: false,
                        size: 0,
                        isFile: false,
                        error: (error as Error).message
                    };
                }
            })
        );

        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return {
                    path: filePaths[index],
                    exists: false,
                    size: 0,
                    isFile: false,
                    error: result.reason?.message || 'Unknown error'
                };
            }
        });
    }

    /**
     * ファイルサイズが制限内かチェック
     * @param size ファイルサイズ（バイト）
     * @returns 制限内かどうか
     */
    private isFileSizeWithinLimit(size: number): boolean {
        return !this.fileOperationConfig.enableSizeCheck || size <= this.fileOperationConfig.maxFileSize;
    }

    /**
     * ファイルサイズを人間が読みやすい形式に変換
     * @param bytes バイト数
     * @returns フォーマットされた文字列
     */
    private formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * タイムアウト付きファイル読み込み
     * @param filePath ファイルパス
     * @returns ファイル内容
     */
    private async readFileWithTimeout(filePath: string): Promise<string> {
        if (!this.fileOperationConfig.enableTimeoutCheck) {
            return await readFileAsync(filePath, this.fileOperationConfig.encoding);
        }

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`File read timeout (${this.fileOperationConfig.timeoutMs}ms): ${filePath}`));
            }, this.fileOperationConfig.timeoutMs);

            readFileAsync(filePath, this.fileOperationConfig.encoding)
                .then((content) => {
                    clearTimeout(timeoutId);
                    resolve(content);
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }

    /**
     * 類似ファイルを検索する
     * @param targetPath - 検索対象のパス
     * @param searchDir - 検索ディレクトリ
     * @returns 類似ファイルのパス配列
     */
    private async findSimilarFiles(targetPath: string, searchDir: string): Promise<string[]> {
        try {
            const targetBasename = path.basename(targetPath);
            const targetExt = path.extname(targetPath);
            const targetNameWithoutExt = path.basename(targetPath, targetExt);
            
            const suggestions: Array<{ path: string; score: number }> = [];
            
            // ディレクトリを再帰的に検索
            const searchRecursively = async (dir: string, basePath: string = ''): Promise<void> => {
                try {
                    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                    
                    for (const entry of entries) {
                        // スキップするディレクトリ
                        if (entry.isDirectory() && 
                            (entry.name === 'node_modules' || entry.name === '.git' || 
                             entry.name === 'vendor' || entry.name.startsWith('.'))) {
                            continue;
                        }
                        
                        const fullPath = path.join(dir, entry.name);
                        const relativePath = path.join(basePath, entry.name);
                        
                        if (entry.isDirectory()) {
                            // 再帰的に検索（深さ制限あり）
                            if (basePath.split(path.sep).length < 5) {
                                await searchRecursively(fullPath, relativePath);
                            }
                        } else if (entry.isFile()) {
                            // ファイル名の類似度をチェック
                            const score = this.calculateFileNameSimilarity(targetPath, relativePath, targetBasename, targetExt, targetNameWithoutExt);
                            if (score > 0) {
                                suggestions.push({ path: relativePath, score });
                            }
                        }
                    }
                } catch (error) {
                    // ディレクトリアクセスエラーは無視
                }
            };
            
            await searchRecursively(searchDir);
            
            // スコア順にソートして上位を返す
            return suggestions
                .sort((a: any, b: any) => b.score - a.score)
                .slice(0, 10)
                .map((item: any) => item.path);
                
        } catch (error) {
            console.warn('Error finding similar files:', error);
            return [];
        }
    }
    
    /**
     * ファイル名の類似度を計算する
     * @param targetPath - ターゲットパス
     * @param candidatePath - 候補パス
     * @param targetBasename - ターゲットのベース名
     * @param targetExt - ターゲットの拡張子
     * @param targetNameWithoutExt - ターゲットの拡張子なし名前
     * @returns 類似度スコア（高いほど類似）
     */
    private calculateFileNameSimilarity(
        targetPath: string,
        candidatePath: string,
        targetBasename: string,
        targetExt: string,
        targetNameWithoutExt: string
    ): number {
        const candidateBasename = path.basename(candidatePath);
        const candidateExt = path.extname(candidatePath);
        const candidateNameWithoutExt = path.basename(candidatePath, candidateExt);
        
        let score = 0;
        
        // 完全一致
        if (candidateBasename === targetBasename) {
            score += 100;
        }
        
        // 拡張子一致
        if (candidateExt === targetExt && targetExt) {
            score += 50;
        }
        
        // 名前の部分一致
        if (targetNameWithoutExt && candidateNameWithoutExt.includes(targetNameWithoutExt)) {
            score += 30;
        }
        
        // パスの類似性（ディレクトリ構造）
        const targetDirs = path.dirname(targetPath).split(path.sep);
        const candidateDirs = path.dirname(candidatePath).split(path.sep);
        
        for (let i = 0; i < Math.min(targetDirs.length, candidateDirs.length); i++) {
            if (targetDirs[i] === candidateDirs[i]) {
                score += 10;
            }
        }
        
        // レーベンシュタイン距離による類似度（逆数でスコア化）
        const distance = this.levenshteinDistance(targetBasename.toLowerCase(), candidateBasename.toLowerCase());
        if (distance < targetBasename.length) {
            score += Math.max(0, 20 - distance * 2);
        }
        
        return score;
    }
    
    /**
     * レーベンシュタイン距離を計算する
     * @param str1 - 文字列1
     * @param str2 - 文字列2
     * @returns 距離
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = [];
        
        // 初期化
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        // 距離計算
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }
}

export default FileManager;
