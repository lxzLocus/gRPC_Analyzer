/**
 * ファイル管理クラス
 * プロンプトファイルの読み込みとテンプレート処理を担当
 */
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { createRequire } from 'module';
// ESModule環境でCommonJS moduleをimportするためのrequire関数
const require = createRequire(import.meta.url);
const Handlebars = require('handlebars');
// @ts-ignore: 動的インポートのため型チェックを無視  
import getSurroundingDirectoryStructure from './generatePeripheralStructure.js';
// 非同期ファイル操作
const readFileAsync = promisify(fs.readFile);
const statAsync = promisify(fs.stat);
class FileManager {
    constructor(config, logger) {
        // デフォルトのプロンプトファイル設定
        this.defaultPromptFiles = {
            promptTextfile: '00_prompt_gem.txt', // Gemini用プロンプトに変更
            protoFile: '01_proto.txt',
            protoFileChanges: '02_protoFileChanges.txt',
            fileChanges: '03_fileChanges.txt',
            surroundedFilePath: '04_surroundedFilePath.txt',
            suspectedFiles: '05_suspectedFiles.txt'
        };
        // ファイル操作の設定
        this.fileOperationConfig = {
            maxFileSize: 50 * 1024 * 1024, // 50MB
            timeoutMs: 30000, // 30秒
            encoding: 'utf-8',
            enableSizeCheck: true,
            enableTimeoutCheck: true
        };
        this.config = config;
        this.logger = logger;
    }
    /**
     * プロンプトファイルの存在確認
     * @param filename プロンプトファイル名
     * @returns ファイルが存在するかどうか
     */
    checkPromptFileExists(filename) {
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
    findPromptFileInDataset(filename) {
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
    safeReadPromptFile(filename, fallbackContent = '') {
        // 1. データセットディレクトリからの読み込みを試行
        const datasetPromptPath = this.findPromptFileInDataset(filename);
        if (datasetPromptPath) {
            try {
                const content = fs.readFileSync(datasetPromptPath, 'utf-8');
                console.log(`✅ データセットプロンプトファイルを読み込み: ${filename}`);
                return content;
            }
            catch (error) {
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
        }
        catch (error) {
            console.error(`❌ プロンプトファイル読み込みエラー: ${filename}`);
            console.error(`   エラー詳細: ${error.message}`);
            console.warn(`   フォールバック内容を使用します`);
            return fallbackContent;
        }
    }
    /**
     * テンプレート変数の検証
     * @param context テンプレートコンテキスト
     * @returns 検証結果とエラーメッセージ
     */
    validateTemplateContext(context) {
        const errors = [];
        const requiredFields = [
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
    readFirstPromptFile() {
        console.log('📋 プロンプトファイルの読み込みを開始...');
        // メインプロンプトファイルの読み込み
        const promptText = this.safeReadPromptFile(this.config.promptTextfile, '# デフォルトプロンプト\n\nFix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections.\n\n{{protoFile}}\n{{protoFileChanges}}\n{{fileChanges}}\n{{surroundedFilePath}}\n{{suspectedFiles}}');
        // 各プロンプトファイルの読み込み（フォールバック付き）
        const protoFileContent = this.safeReadPromptFile(this.defaultPromptFiles.protoFile, '# プロトファイル情報が利用できません');
        const protoFileChanges = this.safeReadPromptFile(this.defaultPromptFiles.protoFileChanges, '# プロトファイル変更情報が利用できません');
        const fileChangesContent = this.safeReadPromptFile(this.defaultPromptFiles.fileChanges, '# ファイル変更情報が利用できません');
        const surroundedFilePath = this.safeReadPromptFile(this.defaultPromptFiles.surroundedFilePath, '# ファイルパス情報が利用できません');
        const suspectedFiles = this.safeReadPromptFile(this.defaultPromptFiles.suspectedFiles, '# 疑わしいファイル情報が利用できません');
        // テンプレートコンテキストの構築と検証
        const context = {
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
        }
        catch (error) {
            console.error('❌ Handlebarsテンプレートのコンパイルエラー:', error.message);
            console.warn('⚠️  フォールバック: 変数展開なしのプロンプトテキストを返します');
            return promptText;
        }
    }
    /**
     * FILE_CONTENTタイプのリクエストを処理してファイル内容を取得（最適化版）
     * @param fileInfos - FILE_CONTENTタイプのRequiredFileInfo配列
     * @returns ファイル内容の文字列
     */
    async getFileContents(fileInfos) {
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
        const summary = {
            totalFiles: filePaths.length,
            successCount: 0,
            errorCount: 0,
            totalSize: 0,
            totalProcessingTime: 0,
            errors: []
        };
        const contents = [];
        const results = [];
        // ファイルごとの処理
        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            const fileCheck = fileChecks[i];
            const relativePath = path.relative(this.config.inputProjectDir, filePath);
            const fileStartTime = Date.now();
            let result = {
                success: false,
                path: filePath,
                relativePath: relativePath,
                processingTime: 0
            };
            try {
                if (!fileCheck.exists) {
                    // .pb.goファイルの特別処理
                    if (relativePath.endsWith('.pb.go')) {
                        const errorMsg = this.generateProtobufFileErrorMessage(relativePath);
                        contents.push(`--- ${relativePath}\n${errorMsg}`);
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: 'Generated .pb.go file not found' });
                        summary.errorCount++;
                    }
                    else {
                        // 通常のファイル処理 - 類似ファイルを探す
                        const originalPath = fileInfos[i].path;
                        const suggestions = await this.findSimilarFiles(originalPath, this.config.inputProjectDir);
                        const suggestionText = suggestions.length > 0
                            ? `\n\n類似ファイルの候補:\n${suggestions.slice(0, 5).map((s) => `  - ${s}`).join('\n')}`
                            : '';
                        const errorMsg = `ファイルが見つかりません: ${fileCheck.error || 'File not found'}${suggestionText}`;
                        contents.push(`--- ${relativePath}\n[${errorMsg}]`);
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: errorMsg });
                        summary.errorCount++;
                    }
                }
                else if (!fileCheck.isFile) {
                    const errorMsg = 'ディレクトリが指定されました（ファイルを期待）';
                    contents.push(`--- ${relativePath}\n[${errorMsg}]`);
                    result.error = errorMsg;
                    summary.errors.push({ path: relativePath, error: errorMsg });
                    summary.errorCount++;
                }
                else if (!this.isFileSizeWithinLimit(fileCheck.size)) {
                    const errorMsg = `ファイルサイズが制限を超えています: ${this.formatFileSize(fileCheck.size)} > ${this.formatFileSize(this.fileOperationConfig.maxFileSize)}`;
                    contents.push(`--- ${relativePath}\n[${errorMsg}]`);
                    result.error = errorMsg;
                    summary.errors.push({ path: relativePath, error: errorMsg });
                    summary.errorCount++;
                }
                else {
                    // ファイル読み込み
                    const content = await this.readFileWithTimeout(filePath);
                    contents.push(`--- ${relativePath}\n${content}`);
                    result.success = true;
                    result.size = fileCheck.size;
                    summary.successCount++;
                    summary.totalSize += fileCheck.size;
                    console.log(`  ✅ ${relativePath} (${this.formatFileSize(fileCheck.size)})`);
                }
            }
            catch (error) {
                const errorMsg = `ファイル読み込みエラー: ${error.message}`;
                contents.push(`--- ${relativePath}\n[${errorMsg}]`);
                result.error = errorMsg;
                summary.errors.push({ path: relativePath, error: errorMsg });
                summary.errorCount++;
                console.error(`  ❌ ${relativePath}: ${errorMsg}`);
                // 詳細なファイル操作エラーログを記録
                this.logger.logFileOperationError('READ_FILE', filePath, error, {
                    relativePath,
                    attemptedEncoding: this.fileOperationConfig.encoding,
                    maxFileSize: this.fileOperationConfig.maxFileSize,
                    timeout: this.fileOperationConfig.timeoutMs
                });
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
    async getDirectoryListings(fileInfos) {
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
        const results = {};
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
                }
                else if (dirCheck.isFile) {
                    const errorMsg = 'ファイルが指定されました（ディレクトリを期待）';
                    results[relativePath] = { error: errorMsg };
                    errorCount++;
                    console.error(`  ❌ ${relativePath}: ${errorMsg}`);
                }
                else {
                    // ディレクトリ構造の取得
                    const structure = getSurroundingDirectoryStructure(dirPath, 2);
                    results[relativePath] = structure;
                    successCount++;
                    const processingTime = Date.now() - dirStartTime;
                    console.log(`  ✅ ${relativePath} (${processingTime}ms)`);
                }
            }
            catch (error) {
                const errorMsg = `ディレクトリ構造取得エラー: ${error.message}`;
                results[relativePath] = { error: errorMsg };
                errorCount++;
                console.error(`  ❌ ${relativePath}: ${errorMsg}`);
                // 詳細なファイル操作エラーログを記録
                this.logger.logFileOperationError('READ_DIRECTORY', dirPath, error, {
                    relativePath,
                    requestedDepth: 2,
                    operation: 'getSurroundingDirectoryStructure'
                });
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
    async processRequiredFileInfos(fileInfos) {
        const results = [];
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
    getPromptFilesList() {
        const allPromptFiles = Object.values(this.defaultPromptFiles);
        const available = [];
        const missing = [];
        allPromptFiles.forEach(filename => {
            if (this.checkPromptFileExists(filename)) {
                available.push(filename);
            }
            else {
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
    logPromptFilesStatus() {
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
    updateFileOperationConfig(config) {
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
    getFileOperationConfig() {
        return { ...this.fileOperationConfig };
    }
    /**
     * バッチでファイル存在確認とサイズチェック
     * @param filePaths ファイルパスの配列
     * @returns ファイル情報の配列
     */
    async batchFileExistenceCheck(filePaths) {
        const results = await Promise.allSettled(filePaths.map(async (filePath) => {
            try {
                const stats = await statAsync(filePath);
                return {
                    path: filePath,
                    exists: true,
                    size: stats.size,
                    isFile: stats.isFile(),
                    error: undefined
                };
            }
            catch (error) {
                return {
                    path: filePath,
                    exists: false,
                    size: 0,
                    isFile: false,
                    error: error.message
                };
            }
        }));
        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            else {
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
    isFileSizeWithinLimit(size) {
        return !this.fileOperationConfig.enableSizeCheck || size <= this.fileOperationConfig.maxFileSize;
    }
    /**
     * ファイルサイズを人間が読みやすい形式に変換
     * @param bytes バイト数
     * @returns フォーマットされた文字列
     */
    formatFileSize(bytes) {
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
    async readFileWithTimeout(filePath) {
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
    async findSimilarFiles(targetPath, searchDir) {
        try {
            const targetBasename = path.basename(targetPath);
            const targetExt = path.extname(targetPath);
            const targetNameWithoutExt = path.basename(targetPath, targetExt);
            const suggestions = [];
            // ディレクトリを再帰的に検索
            const searchRecursively = async (dir, basePath = '') => {
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
                        }
                        else if (entry.isFile()) {
                            // ファイル名の類似度をチェック
                            const score = this.calculateFileNameSimilarity(targetPath, relativePath, targetBasename, targetExt, targetNameWithoutExt);
                            if (score > 0) {
                                suggestions.push({ path: relativePath, score });
                            }
                        }
                    }
                }
                catch (error) {
                    // ディレクトリアクセスエラーは無視
                }
            };
            await searchRecursively(searchDir);
            // スコア順にソートして上位を返す
            return suggestions
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map((item) => item.path);
        }
        catch (error) {
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
    calculateFileNameSimilarity(targetPath, candidatePath, targetBasename, targetExt, targetNameWithoutExt) {
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
    levenshteinDistance(str1, str2) {
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
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1, // insertion
                    matrix[i - 1][j] + 1 // deletion
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }
    /**
     * 03_fileChanges.txtから変更されたファイルリストを読み取る
     * @returns 変更されたファイルパスの配列
     */
    async loadChangedFilesList() {
        try {
            const changedFilesContent = this.safeReadPromptFile(this.defaultPromptFiles.fileChanges, '');
            if (!changedFilesContent.trim()) {
                console.warn('⚠️  03_fileChanges.txt が空か見つかりません');
                return [];
            }
            // JSONか単純なリストかを判定
            let lines;
            try {
                // JSON形式の場合
                const parsed = JSON.parse(changedFilesContent);
                if (Array.isArray(parsed)) {
                    lines = parsed;
                }
                else {
                    throw new Error('Not an array');
                }
            }
            catch {
                // 単純なリスト形式の場合
                lines = changedFilesContent.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#')); // コメント行を除去
            }
            console.log(`📋 変更されたファイル数: ${lines.length}`);
            console.log(`📋 変更ファイルリスト: ${lines.join(', ')}`);
            return lines;
        }
        catch (error) {
            console.error('❌ 変更ファイルリスト読み込みエラー:', error);
            return [];
        }
    }
    /**
     * 要求されたファイルパスが変更リストに含まれているかを検知
     * @param requestedFilePath - LLMが要求するファイルパス
     * @param changedFiles - 変更されたファイルリスト
     * @returns 検知結果
     */
    detectFileChangeStatus(requestedFilePath, changedFiles) {
        // 正規化された形でチェック
        const normalizedRequestPath = requestedFilePath.replace(/^\/+/, '').replace(/\\/g, '/');
        console.log(`🔍 変更検知: "${normalizedRequestPath}" をチェック中...`);
        const isInChangeList = changedFiles.some(changedFile => {
            const normalizedChangedFile = changedFile.replace(/^\/+/, '').replace(/\\/g, '/');
            // 完全一致
            if (normalizedChangedFile === normalizedRequestPath) {
                console.log(`  ✅ 完全一致: ${normalizedChangedFile}`);
                return true;
            }
            // パスの末尾一致（ディレクトリ構造を考慮）
            if (normalizedChangedFile.endsWith('/' + normalizedRequestPath)) {
                console.log(`  ✅ 末尾一致: ${normalizedChangedFile}`);
                return true;
            }
            if (normalizedRequestPath.endsWith('/' + normalizedChangedFile)) {
                console.log(`  ✅ 前方一致: ${normalizedChangedFile}`);
                return true;
            }
            return false;
        });
        const status = isInChangeList ? 'CHANGED' : 'UNCHANGED';
        const templateToUse = isInChangeList ? 'TEMPLATE_5' : 'TEMPLATE_2';
        let message;
        if (isInChangeList) {
            message = `[NOTICE: File version mismatch] LLM expects post-change state, but system can only provide pre-change file content.`;
            console.log(`  🔄 変更検知結果: CHANGED - Template 5を使用`);
        }
        else {
            message = `[INFO] This file has not been changed before and after the commit.`;
            console.log(`  ✅ 変更検知結果: UNCHANGED - Template 2を使用`);
        }
        return {
            filePath: requestedFilePath,
            status,
            isInChangeList,
            templateToUse,
            message
        };
    }
    /**
     * ファイル変更検知を含む拡張版getFileContents
     * @param fileInfos - FILE_CONTENTタイプのRequiredFileInfo配列
     * @returns ファイル内容の文字列（変更検知情報付き）
     */
    async getFileContentsWithChangeDetection(fileInfos) {
        const startTime = Date.now();
        console.log('📂 ファイル内容取得を開始（変更検知有効）...');
        // 変更されたファイルリストを読み込み
        const changedFiles = await this.loadChangedFilesList();
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
        const summary = {
            totalFiles: filePaths.length,
            successCount: 0,
            errorCount: 0,
            totalSize: 0,
            totalProcessingTime: 0,
            errors: []
        };
        const contents = [];
        const results = [];
        // ファイルごとの処理
        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            const fileCheck = fileChecks[i];
            const relativePath = path.relative(this.config.inputProjectDir, filePath);
            const fileStartTime = Date.now();
            // 変更検知を実行
            const detectionResult = this.detectFileChangeStatus(fileInfos[i].path, changedFiles);
            let result = {
                success: false,
                path: filePath,
                relativePath: relativePath,
                processingTime: 0
            };
            try {
                if (!fileCheck.exists) {
                    // .pb.goファイルの特別処理
                    if (relativePath.endsWith('.pb.go')) {
                        const errorMsg = this.generateProtobufFileErrorMessage(relativePath);
                        contents.push(`--- ${relativePath}\n${errorMsg}`);
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: 'Generated .pb.go file not found' });
                        summary.errorCount++;
                    }
                    else {
                        // 通常のファイル処理 - 類似ファイルを探す
                        const originalPath = fileInfos[i].path;
                        const suggestions = await this.findSimilarFiles(originalPath, this.config.inputProjectDir);
                        const suggestionText = suggestions.length > 0
                            ? `\n\n類似ファイルの候補:\n${suggestions.slice(0, 5).map((s) => `  - ${s}`).join('\n')}`
                            : '';
                        const errorMsg = `ファイルが見つかりません: ${fileCheck.error || 'File not found'}${suggestionText}`;
                        contents.push(`--- ${relativePath}\n[${errorMsg}]`);
                        result.error = errorMsg;
                        summary.errors.push({ path: relativePath, error: errorMsg });
                        summary.errorCount++;
                    }
                }
                else if (!fileCheck.isFile) {
                    const errorMsg = 'ディレクトリが指定されました（ファイルを期待）';
                    contents.push(`--- ${relativePath}\n[${errorMsg}]`);
                    result.error = errorMsg;
                    summary.errors.push({ path: relativePath, error: errorMsg });
                    summary.errorCount++;
                }
                else if (!this.isFileSizeWithinLimit(fileCheck.size)) {
                    const errorMsg = `ファイルサイズが制限を超えています: ${this.formatFileSize(fileCheck.size)} > ${this.formatFileSize(this.fileOperationConfig.maxFileSize)}`;
                    contents.push(`--- ${relativePath}\n[${errorMsg}]`);
                    result.error = errorMsg;
                    summary.errors.push({ path: relativePath, error: errorMsg });
                    summary.errorCount++;
                }
                else {
                    // ファイル読み込み
                    const content = await this.readFileWithTimeout(filePath);
                    // 変更検知情報を付加してファイル内容を構築
                    const enhancedContent = `--- ${relativePath}\n${detectionResult.message}\n\n${content}`;
                    contents.push(enhancedContent);
                    result.success = true;
                    result.size = fileCheck.size;
                    summary.successCount++;
                    summary.totalSize += fileCheck.size;
                    // 変更検知結果をログ出力
                    const statusIcon = detectionResult.status === 'CHANGED' ? '🔄' : '✅';
                    console.log(`  ${statusIcon} ${relativePath} (${this.formatFileSize(fileCheck.size)}) - ${detectionResult.templateToUse}`);
                }
            }
            catch (error) {
                const errorMsg = `ファイル読み込みエラー: ${error.message}`;
                contents.push(`--- ${relativePath}\n[${errorMsg}]`);
                result.error = errorMsg;
                summary.errors.push({ path: relativePath, error: errorMsg });
                summary.errorCount++;
                console.error(`  ❌ ${relativePath}: ${errorMsg}`);
                // 詳細なファイル操作エラーログを記録
                this.logger.logFileOperationError('READ_FILE', filePath, error, {
                    relativePath,
                    attemptedEncoding: this.fileOperationConfig.encoding,
                    maxFileSize: this.fileOperationConfig.maxFileSize,
                    timeout: this.fileOperationConfig.timeoutMs
                });
            }
            result.processingTime = Date.now() - fileStartTime;
            summary.totalProcessingTime += result.processingTime;
            results.push(result);
        }
        // 統計情報の出力
        const totalTime = Date.now() - startTime;
        console.log('\n📊 ファイル処理統計（変更検知付き）:');
        console.log(`   成功: ${summary.successCount}/${summary.totalFiles} ファイル`);
        console.log(`   エラー: ${summary.errorCount}/${summary.totalFiles} ファイル`);
        console.log(`   総サイズ: ${this.formatFileSize(summary.totalSize)}`);
        console.log(`   処理時間: ${totalTime}ms`);
        console.log(`   変更検知対象: ${changedFiles.length} ファイル`);
        if (summary.errors.length > 0) {
            console.log('   ❌ エラー詳細:');
            summary.errors.forEach(err => console.log(`      - ${err.path}: ${err.error}`));
        }
        return contents.join('\n\n');
    }
    /**
     * Template 5（ファイルバージョン不整合）用のプロンプトを読み込み
     * @param requestedFileContent - 要求されたファイルの内容
     * @returns Template 5プロンプト文字列
     */
    readFileVersionMismatchPrompt(requestedFileContent) {
        console.log('📋 Template 5プロンプト読み込み開始...');
        const promptText = this.safeReadPromptFile(
        // this.defaultPromptFiles.fileVersionMismatch,
        'templates/fileVersionMismatch.txt', '# Template 5: Context Discrepancy Notification Prompt\n\n{{fileVersionMismatch}}\n\n{{protoFile}}\n{{fileChanges}}\n{{suspectedFiles}}');
        // 各プロンプトファイルの読み込み
        const protoFileContent = this.safeReadPromptFile(this.defaultPromptFiles.protoFile, '# Proto file information is not available');
        const protoFileChanges = this.safeReadPromptFile(this.defaultPromptFiles.protoFileChanges, '# Proto file change information is not available');
        const fileChangesContent = this.safeReadPromptFile(this.defaultPromptFiles.fileChanges, '# File change information is not available');
        const suspectedFiles = this.safeReadPromptFile(this.defaultPromptFiles.suspectedFiles, '# Suspected file information is not available');
        // テンプレートコンテキストの構築
        const context = {
            protoFile: protoFileContent,
            protoFileChanges: protoFileChanges,
            fileChanges: fileChangesContent,
            surroundedFilePath: '', // Template 5では使用しない
            suspectedFiles: suspectedFiles,
            fileVersionMismatch: requestedFileContent
        };
        // Handlebarsテンプレートの実行
        try {
            const template = Handlebars.compile(promptText, { noEscape: true });
            const result = template(context);
            console.log('✅ Template 5プロンプト読み込み完了');
            return result;
        }
        catch (error) {
            console.error('❌ Template 5プロンプトのコンパイルエラー:', error.message);
            console.warn('⚠️  フォールバック: 変数展開なしのプロンプトテキストを返します');
            return promptText;
        }
    }
    /**
     * 拡張版プロンプトファイル読み込み（Template 5サポート）
     * @param useFileVersionMismatchTemplate - Template 5を使用するかどうか
     * @param requestedFileContent - 要求されたファイルの内容（Template 5用）
     * @returns 適切なテンプレートが適用されたプロンプト文字列
     */
    readPromptFileWithChangeDetection(useFileVersionMismatchTemplate = false, requestedFileContent = '') {
        console.log('📋 プロンプトファイルの読み込みを開始（変更検知対応）...');
        // メインプロンプトファイルの決定
        const promptFileName = useFileVersionMismatchTemplate
            ? 'templates/fileVersionMismatch.txt' // Template 5
            : this.config.promptTextfile; // 通常のTemplate（Template 2等）
        // メインプロンプトファイルの読み込み
        const promptText = this.safeReadPromptFile(promptFileName, useFileVersionMismatchTemplate
            ? `# Template 5: Context Discrepancy Notification Prompt

## ⚠️ Context Warning: Discrepancy Between Provided Files and Expected State ##

The files you requested have been modified in this commit.
Due to my operational constraints, I can only provide file contents from the **pre-change state (premerge state)**.

{{protoFile}}
{{protoFileChanges}}
{{fileChanges}}
{{fileVersionMismatch}}
{{suspectedFiles}}

Leverage this constraint to maximize your differential reasoning capabilities.`
            : '# Default Prompt\n\nFix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections.\n\n{{protoFile}}\n{{protoFileChanges}}\n{{fileChanges}}\n{{surroundedFilePath}}\n{{suspectedFiles}}');
        // 各プロンプトファイルの読み込み（フォールバック付き）
        const protoFileContent = this.safeReadPromptFile(this.defaultPromptFiles.protoFile, '# Proto file information is not available');
        const protoFileChanges = this.safeReadPromptFile(this.defaultPromptFiles.protoFileChanges, '# Proto file change information is not available');
        const fileChangesContent = this.safeReadPromptFile(this.defaultPromptFiles.fileChanges, '# File change information is not available');
        const surroundedFilePath = this.safeReadPromptFile(this.defaultPromptFiles.surroundedFilePath, '# File path information is not available');
        const suspectedFiles = this.safeReadPromptFile(this.defaultPromptFiles.suspectedFiles, '# Suspected file information is not available');
        // Template 5用の要求されたファイル内容
        const fileVersionMismatchContent = useFileVersionMismatchTemplate && requestedFileContent
            ? requestedFileContent
            : '# Requested file content is not available';
        // テンプレートコンテキストの構築と検証
        const context = {
            protoFile: protoFileContent,
            protoFileChanges: protoFileChanges,
            fileChanges: fileChangesContent,
            surroundedFilePath: surroundedFilePath,
            suspectedFiles: suspectedFiles,
            ...(useFileVersionMismatchTemplate && { fileVersionMismatch: fileVersionMismatchContent })
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
            const templateType = useFileVersionMismatchTemplate ? 'Template 5 (コンテキスト不整合)' : 'Template 2 (通常)';
            console.log(`✅ プロンプトファイルの読み込み完了 - ${templateType}`);
            return result;
        }
        catch (error) {
            console.error('❌ Handlebarsテンプレートのコンパイルエラー:', error.message);
            console.warn('⚠️  フォールバック: 変数展開なしのプロンプトテキストを返します');
            return promptText;
        }
    }
    /**
     * ファイル変更検知を含む統合処理フローメソッド
     * @param fileInfos - RequiredFileInfo配列
     * @returns 適切なテンプレートが適用された結果
     */
    async processRequiredFileInfosWithChangeDetection(fileInfos) {
        console.log('🔄 統合処理フロー開始（変更検知有効）...');
        // 変更されたファイルリストを読み込み
        const changedFiles = await this.loadChangedFilesList();
        // FILE_CONTENTタイプのファイルに対する変更検知
        const fileContentInfos = fileInfos.filter(info => info.type === 'FILE_CONTENT');
        const changedFileDetections = fileContentInfos.map(info => this.detectFileChangeStatus(info.path, changedFiles));
        // Template 5を使用すべきかどうかを判定
        const hasChangedFiles = changedFileDetections.some(detection => detection.status === 'CHANGED');
        const templateToUse = hasChangedFiles ? 'TEMPLATE_5' : 'TEMPLATE_2';
        console.log(`📋 選択されたテンプレート: ${templateToUse}`);
        if (hasChangedFiles) {
            const changedFilePaths = changedFileDetections
                .filter(d => d.status === 'CHANGED')
                .map(d => d.filePath);
            console.log(`⚠️  変更されたファイル: ${changedFilePaths.join(', ')}`);
        }
        const results = [];
        // FILE_CONTENTタイプを処理（変更検知付き）
        if (fileContentInfos.length > 0) {
            const fileContents = await this.getFileContentsWithChangeDetection(fileContentInfos);
            if (fileContents) {
                // Template 5の場合、ファイル内容を{{fileVersionMismatch}}変数として処理
                if (templateToUse === 'TEMPLATE_5') {
                    // Template 5用のプロンプトを生成（ファイル内容を含む）
                    const template5Prompt = this.readPromptFileWithChangeDetection(true, fileContents);
                    results.push(template5Prompt);
                }
                else {
                    // Template 2の場合は通常の処理
                    results.push('=== FILE CONTENTS ===\n' + fileContents);
                }
            }
        }
        // DIRECTORY_LISTINGタイプを処理（通常通り）
        const directoryListingInfos = fileInfos.filter(info => info.type === 'DIRECTORY_LISTING');
        if (directoryListingInfos.length > 0) {
            const directoryListings = await this.getDirectoryListings(directoryListingInfos);
            if (directoryListings) {
                results.push('=== DIRECTORY STRUCTURES ===\n' + directoryListings);
            }
        }
        // 変更検知サマリー
        const changeDetectionSummary = {
            totalRequested: fileContentInfos.length,
            changedFiles: changedFileDetections.filter(d => d.status === 'CHANGED').length,
            unchangedFiles: changedFileDetections.filter(d => d.status === 'UNCHANGED').length,
            changedFilesList: changedFileDetections
                .filter(d => d.status === 'CHANGED')
                .map(d => d.filePath)
        };
        console.log('📊 変更検知サマリー:');
        console.log(`   要求ファイル総数: ${changeDetectionSummary.totalRequested}`);
        console.log(`   変更されたファイル: ${changeDetectionSummary.changedFiles}`);
        console.log(`   未変更ファイル: ${changeDetectionSummary.unchangedFiles}`);
        return {
            content: results.join('\n\n'),
            templateUsed: templateToUse,
            changeDetectionSummary
        };
    }
    /**
     * .pb.goファイル用の特別なエラーメッセージを生成
     */
    generateProtobufFileErrorMessage(relativePath) {
        const protoPath = relativePath.replace('.pb.go', '.proto');
        return `
⚠️  自動生成ファイルが見つかりません: ${relativePath}

このファイルは.protoファイルから自動生成されるファイルです。
現在のプロジェクト状態では、以下のいずれかの理由で存在しない可能性があります：

1. protoファイル (${protoPath}) からまだ生成されていない
2. ビルドプロセスが実行されていない
3. 生成コマンド (protoc) が実行されていない
4. ファイルパスが変更されている

🔍 推奨アクション:
- このファイルの内容を仮定して修正を行わないでください
- 代わりに、対応する.protoファイルの変更に基づいて修正を行ってください
- .pb.goファイルは.protoファイルから自動再生成されるため、直接編集は不要です

📝 対応する.protoファイル: ${protoPath}
`;
    }
}
export default FileManager;
