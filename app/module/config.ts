/**
 * 設定管理クラス
 * プロンプトテンプレートやファイルパスの管理を行う
 */

import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';

//実行ファイルが置かれているパス
const APP_DIR: string = "/app/app/";

/**
 * Configuration class for managing file paths and prompt templates.
 * @pullRequestPath: プルリクエストのパス "/PATH/premerge_xxx"
 */
class Config {
    inputProjectDir: string;
    outputDir: string;
    inputDir: string;
    promptDir: string;
    promptTextfile: string;
    promptRefineTextfile: string;
    tmpDiffRestorePath: string;
    maxTokens: number;

    constructor(pullRequestPath: string) {
        this.inputProjectDir = pullRequestPath;
        this.outputDir = path.join(APP_DIR, 'output');
        this.inputDir = path.join(APP_DIR, 'input');
        this.promptDir = path.join(APP_DIR, 'prompt');
        this.promptTextfile = '00_prompt.txt';
        this.promptRefineTextfile = '00_promptRefine.txt';
        this.tmpDiffRestorePath = path.join(this.outputDir + 'tmpDiffRestore.txt');
        this.maxTokens = 128000;

        // 一時ファイルを削除
        if (fs.existsSync(this.tmpDiffRestorePath)) fs.unlinkSync(this.tmpDiffRestorePath);
    }

    readPromptReplyFile(filesRequested: string, modifiedDiff: string, commentText: string): string {
        const promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptReply.txt'), 'utf-8');

        const context = {
            filesToReview: filesRequested, // required section from previous message
            previousModifications: modifiedDiff, // diff from previous step
        };
        const template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    }

    readPromptModifiedFile(modifiedFiles: string): string {
        const promptRefineText = fs.readFileSync(path.join(this.promptDir, '00_promptModified.txt'), 'utf-8');

        const context = {
            modifiedFiles: modifiedFiles // diff that was just applied or restored
        };
        const template = Handlebars.compile(promptRefineText, { noEscape: true });
        return template(context);
    }
}

export default Config;
