#!/usr/bin/env node

/**
 * Simplified Batch Runner - 複雑な機能を削除したバッチ処理
 * safeBatchRunner.mjsをベースに、タイムアウトを発生させる複雑な処理を削除
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module環境での __dirname の取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数の設定
config({ path: path.join(__dirname, '..', '.env') });

class SimpleBatchRunner {
    constructor() {
        this.stats = {
            totalPullRequests: 0,
            successfulPullRequests: 0,
            failedPullRequests: 0,
            skippedPullRequests: 0,
            startTime: new Date()
        };
        
        console.log(`🚀 SimpleBatchRunner initialized`);
        console.log(`🔑 LLM_PROVIDER: ${process.env.LLM_PROVIDER || 'undefined'}`);
    }

    /**
     * 単一のプルリクエストを処理
     */
    async processIndividualPR(repoName, category, prName, premergeDir) {
        try {
            console.log(`� Processing: ${repoName}/${category}/${prName}`);
            
            // LLMFlowControllerを使用
            const LLMFlowController = await import('../dist/js/modules/llmFlowController.js');
            const controller = new LLMFlowController.default(premergeDir);
            
            // シンプルに実行（複雑なリトライ処理なし）
            await controller.run();
            
            this.stats.successfulPullRequests++;
            console.log(`✅ Success: ${repoName}/${category}/${prName}`);
            return true;
            
        } catch (error) {
            this.stats.failedPullRequests++;
            console.error(`❌ Failed: ${repoName}/${category}/${prName} - ${error.message}`);
            return false;
        }
    }

    /**
     * データセットを処理
     */
    async processDataset(datasetDir) {
        console.log(`📁 Processing dataset directory: ${datasetDir}`);
        
        if (!fs.existsSync(datasetDir)) {
            throw new Error(`Dataset directory does not exist: ${datasetDir}`);
        }

        const repositories = fs.readdirSync(datasetDir).filter(dir => 
            fs.statSync(path.join(datasetDir, dir)).isDirectory()
        );
        
        console.log(`📊 Found ${repositories.length} repositories`);
        
        for (const repo of repositories) {
            const repoPath = path.join(datasetDir, repo);
            
            try {
                const categories = fs.readdirSync(repoPath).filter(dir => 
                    fs.statSync(path.join(repoPath, dir)).isDirectory()
                );
                
                for (const category of categories) {
                    const categoryPath = path.join(repoPath, category);
                    
                    const pullRequests = fs.readdirSync(categoryPath).filter(dir => 
                        fs.statSync(path.join(categoryPath, dir)).isDirectory()
                    );
                    
                    for (const pr of pullRequests) {
                        const prPath = path.join(categoryPath, pr);
                        
                        // premergeディレクトリを探す
                        const premergeDir = fs.readdirSync(prPath)
                            .map(dir => path.join(prPath, dir))
                            .find(filePath => 
                                fs.statSync(filePath).isDirectory() && 
                                path.basename(filePath).startsWith('premerge')
                            );
                        
                        if (!premergeDir) {
                            console.log(`⏭️ Skipping ${repo}/${category}/${pr} - no premerge directory`);
                            this.stats.skippedPullRequests++;
                            continue;
                        }
                        
                        this.stats.totalPullRequests++;
                        await this.processIndividualPR(repo, category, pr, premergeDir);
                        
                        // 進捗報告（10件ごと）
                        if (this.stats.totalPullRequests % 10 === 0) {
                            this.printProgress();
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ Error processing repository ${repo}: ${error.message}`);
            }
        }
    }

    /**
     * 進捗を表示
     */
    printProgress() {
        const { totalPullRequests, successfulPullRequests, failedPullRequests, skippedPullRequests } = this.stats;
        console.log(`📊 Progress: ${totalPullRequests} total, ${successfulPullRequests} success, ${failedPullRequests} failed, ${skippedPullRequests} skipped`);
    }

    /**
     * 最終結果を表示
     */
    printFinalResults() {
        const { totalPullRequests, successfulPullRequests, failedPullRequests, skippedPullRequests, startTime } = this.stats;
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);
        const successRate = totalPullRequests > 0 ? Math.round((successfulPullRequests / totalPullRequests) * 100) : 0;
        
        console.log(`\n🎯 Final Results:`);
        console.log(`   Total processed: ${totalPullRequests}`);
        console.log(`   Successful: ${successfulPullRequests}`);
        console.log(`   Failed: ${failedPullRequests}`);
        console.log(`   Skipped: ${skippedPullRequests}`);
        console.log(`   Success rate: ${successRate}%`);
        console.log(`   Duration: ${duration} seconds`);
    }
}

// メイン実行
async function main() {
    const datasetDir = process.argv[2] || "/app/dataset/test";
    
    console.log(`🎯 SimpleBatchRunner Starting...`);
    console.log(`📁 Dataset Directory: ${datasetDir}`);
    console.log(`💾 Node.js Version: ${process.version}`);
    
    const runner = new SimpleBatchRunner();
    
    try {
        await runner.processDataset(datasetDir);
        runner.printFinalResults();
        console.log("✅ Batch processing completed successfully.");
    } catch (error) {
        console.error("❌ Batch processing failed:", error.message);
        process.exit(1);
    }
}

// スクリプトが直接実行された場合のみメイン関数を実行
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error("❌ Unhandled error:", error);
        process.exit(1);
    });
}
