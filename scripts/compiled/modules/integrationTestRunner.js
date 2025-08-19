/**
 * IntegrationTestRunner - 実際のプロジェクトでの統合テスト
 * Phase 4-1: 統合テストの実装
 */
import path from 'path';
import fs from 'fs';
import LLMFlowController from './llmFlowController.js';
class IntegrationTestRunner {
    constructor(config, logger) {
        this.testResults = [];
        this.config = config;
        this.logger = logger;
    }
    /**
     * テスト対象プロジェクトの定義
     */
    getTestProjects() {
        return [
            {
                projectPath: '/app/dataset/test/servantes',
                testDescription: 'Servantes プロジェクトでの統合テスト',
                expectedFiles: ['src/main.go', 'go.mod', 'README.md'],
                timeout: 30000, // 30秒
                skipLLMCalls: false
            },
            {
                projectPath: '/app/dataset/test/src',
                testDescription: 'Source ディレクトリでの統合テスト',
                expectedFiles: ['*.js', '*.ts', '*.py'],
                timeout: 20000, // 20秒
                skipLLMCalls: false
            }
        ];
    }
    /**
     * 単一プロジェクトでの統合テストを実行
     */
    async runSingleIntegrationTest(testConfig) {
        this.logger.logInfo(`🏗️ Running integration test: ${testConfig.testDescription}`);
        this.logger.logInfo(`📂 Project path: ${testConfig.projectPath}`);
        const stepsExecuted = [];
        const filesProcessed = [];
        const startTime = Date.now();
        try {
            // プロジェクトの存在確認
            if (!fs.existsSync(testConfig.projectPath)) {
                throw new Error(`Test project not found: ${testConfig.projectPath}`);
            }
            // 期待されるファイルの確認
            const missingFiles = this.checkExpectedFiles(testConfig.projectPath, testConfig.expectedFiles);
            if (missingFiles.length > 0) {
                this.logger.logWarning(`Missing expected files: ${missingFiles.join(', ')}`);
            }
            // LLMFlowControllerを作成
            const controller = new LLMFlowController(testConfig.projectPath);
            // タイムアウト設定
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Test timeout')), testConfig.timeout);
            });
            // 実際のフローを実行
            await Promise.race([
                controller.run(),
                timeoutPromise
            ]);
            // 実行時間を測定
            const executionTime = Date.now() - startTime;
            // テスト結果を記録
            this.testResults.push({
                success: true,
                projectPath: testConfig.projectPath,
                executionTime,
                stepsExecuted,
                filesProcessed,
                finalStatus: 'completed'
            });
            this.logger.logInfo(`✅ Integration test completed successfully in ${executionTime}ms`);
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.testResults.push({
                success: false,
                projectPath: testConfig.projectPath,
                executionTime,
                stepsExecuted,
                filesProcessed,
                finalStatus: 'failed',
                error: errorMessage
            });
            this.logger.logError(`❌ Integration test failed: ${errorMessage}`);
        }
    }
    /**
     * 期待されるファイルの存在確認
     */
    checkExpectedFiles(projectPath, expectedFiles) {
        const missingFiles = [];
        for (const expectedFile of expectedFiles) {
            if (expectedFile.includes('*')) {
                // glob pattern support (simplified)
                const extension = expectedFile.replace('*', '');
                const hasMatchingFile = this.hasFilesWithExtension(projectPath, extension);
                if (!hasMatchingFile) {
                    missingFiles.push(expectedFile);
                }
            }
            else {
                const fullPath = path.join(projectPath, expectedFile);
                if (!fs.existsSync(fullPath)) {
                    missingFiles.push(expectedFile);
                }
            }
        }
        return missingFiles;
    }
    /**
     * 指定された拡張子のファイルが存在するかチェック
     */
    hasFilesWithExtension(projectPath, extension) {
        try {
            const files = fs.readdirSync(projectPath, { recursive: true });
            return files.some(file => typeof file === 'string' && file.endsWith(extension));
        }
        catch {
            return false;
        }
    }
    /**
     * 全統合テストを実行
     */
    async runAllIntegrationTests() {
        this.logger.logInfo('🚀 Starting Integration Test Runner');
        this.logger.logInfo('==========================================');
        const testProjects = this.getTestProjects();
        for (const testConfig of testProjects) {
            await this.runSingleIntegrationTest(testConfig);
            // テスト間の待機時間
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        // テスト結果のサマリーを出力
        this.printIntegrationTestSummary();
    }
    /**
     * 統合テスト結果のサマリーを出力
     */
    printIntegrationTestSummary() {
        this.logger.logInfo('\n📊 Integration Test Summary');
        this.logger.logInfo('==========================================');
        const totalTests = this.testResults.length;
        const successfulTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - successfulTests;
        this.logger.logInfo(`Total Tests: ${totalTests}`);
        this.logger.logInfo(`Successful: ${successfulTests}`);
        this.logger.logInfo(`Failed: ${failedTests}`);
        this.logger.logInfo(`Success Rate: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);
        // 詳細結果
        this.logger.logInfo('\n📋 Detailed Results:');
        this.testResults.forEach(result => {
            const status = result.success ? '✅' : '❌';
            this.logger.logInfo(`${status} ${path.basename(result.projectPath)} (${result.executionTime}ms)`);
            if (result.error) {
                this.logger.logError(`   Error: ${result.error}`);
            }
        });
        // 統計レポートの生成
        this.generateIntegrationTestReport();
    }
    /**
     * 詳細な統合テストレポートを生成
     */
    generateIntegrationTestReport() {
        const reportData = {
            timestamp: new Date().toISOString(),
            testType: 'integration',
            summary: {
                totalTests: this.testResults.length,
                successfulTests: this.testResults.filter(r => r.success).length,
                failedTests: this.testResults.filter(r => !r.success).length,
                averageExecutionTime: this.testResults.reduce((sum, r) => sum + r.executionTime, 0) / this.testResults.length
            },
            results: this.testResults,
            recommendations: this.generateIntegrationTestRecommendations()
        };
        // レポートファイルを保存
        const reportPath = path.join('/app/output', 'integration_test_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        this.logger.logInfo(`📄 Integration test report saved to: ${reportPath}`);
    }
    /**
     * 統合テスト結果に基づく改善提案を生成
     */
    generateIntegrationTestRecommendations() {
        const recommendations = [];
        const failedTests = this.testResults.filter(r => !r.success);
        if (failedTests.length > 0) {
            recommendations.push('Review failed integration tests for environment or configuration issues');
        }
        const avgExecutionTime = this.testResults.reduce((sum, r) => sum + r.executionTime, 0) / this.testResults.length;
        if (avgExecutionTime > 10000) {
            recommendations.push('Consider performance optimizations for faster integration test execution');
        }
        const timeoutErrors = this.testResults.filter(r => r.error?.includes('timeout'));
        if (timeoutErrors.length > 0) {
            recommendations.push('Consider increasing timeout values or optimizing slow operations');
        }
        if (recommendations.length === 0) {
            recommendations.push('All integration tests passed successfully - system is ready for production use');
        }
        return recommendations;
    }
}
export default IntegrationTestRunner;
//# sourceMappingURL=integrationTestRunner.js.map