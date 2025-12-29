/**
 * MockLLMTestRunner - OpenAI API呼び出しをモックしてループ動作をテスト
 * Phase 4-1: 統合テストの実装
 */

import path from 'path';
import fs from 'fs';
import LLMFlowController from './llmFlowController.js';
import Config from './Config.js';
import Logger from './Logger.js';

interface MockLLMResponse {
    id: string;
    content: string;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

interface TestScenario {
    name: string;
    description: string;
    mockResponses: MockLLMResponse[];
    expectedOutcome: 'success' | 'error' | 'timeout';
    expectedSteps: string[];
}

class MockLLMTestRunner {
    private config: Config;
    private logger: Logger;
    private mockResponseIndex = 0;
    private currentScenario: TestScenario | null = null;
    private testResults: Array<{
        scenario: string;
        success: boolean;
        error?: string;
        actualSteps: string[];
        executionTime: number;
    }> = [];

    constructor(config: Config, logger: Logger) {
        this.config = config;
        this.logger = logger;
    }

    /**
     * テストシナリオを定義
     */
    private getTestScenarios(): TestScenario[] {
        return [
            {
                name: 'basic_successful_flow',
                description: '基本的な成功フロー: ファイル要求→diff生成→適用→完了',
                mockResponses: [
                    {
                        id: 'mock_1',
                        content: `%_Thought_%
This is a simple bug fix scenario. I need to analyze the code first.
%_Plan_%
1. Request file contents to understand the issue
2. Generate a diff to fix the bug
3. Apply the fix
%_Reply Required_%
[
    {"type": "FILE_CONTENT", "path": "src/example.js"}
]
%_Modified_%
%_Comment_%
Requesting file content for analysis.`,
                        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
                    },
                    {
                        id: 'mock_2',
                        content: `%_Thought_%
Now I have the file content. I can see the issue and will generate a fix.
%_Plan_%
Generate a diff to fix the bug in the file.
%_Reply Required_%
%_Modified_%
--- src/example.js
+++ src/example.js
@@ -1,5 +1,5 @@
 function example() {
-    return "bug";
+    return "fixed";
 }
 
 module.exports = example;
%_Comment_%
Applied fix to resolve the bug.
%%_Fin_%%`,
                        usage: { prompt_tokens: 200, completion_tokens: 80, total_tokens: 280 }
                    }
                ],
                expectedOutcome: 'success',
                expectedSteps: ['SystemAnalyzeRequest', 'SystemApplyDiff', 'End']
            },
            {
                name: 'error_recovery_flow',
                description: 'エラー回復フロー: diff適用失敗→エラー解析→再試行→成功',
                mockResponses: [
                    {
                        id: 'mock_error_1',
                        content: `%_Thought_%
Let me create a diff with intentional formatting issues to test error recovery.
%_Plan_%
Generate a malformed diff to test error handling.
%_Reply Required_%
%_Modified_%
--- invalid_file.js
+++ invalid_file.js
@@ malformed diff format
 some changes
%_Comment_%
This diff has formatting issues.`,
                        usage: { prompt_tokens: 150, completion_tokens: 60, total_tokens: 210 }
                    },
                    {
                        id: 'mock_error_2',
                        content: `%_Thought_%
I see there was an error with the diff format. Let me correct it.
%_Plan_%
Generate a properly formatted diff.
%_Reply Required_%
%_Modified_%
--- src/example.js
+++ src/example.js
@@ -1,3 +1,3 @@
 function example() {
-    return "original";
+    return "corrected";
 }
%_Comment_%
Corrected the diff format.
%%_Fin_%%`,
                        usage: { prompt_tokens: 180, completion_tokens: 70, total_tokens: 250 }
                    }
                ],
                expectedOutcome: 'success',
                expectedSteps: ['SystemApplyDiff', 'SendErrorToLLM', 'LLMErrorReanalyze', 'SystemApplyDiff', 'End']
            },
            {
                name: 'parsing_error_flow',
                description: 'パース エラーフロー: 無効なタグ→再解析→成功',
                mockResponses: [
                    {
                        id: 'mock_parse_error_1',
                        content: `Invalid response without proper tags
This should cause a parsing error
Some random text`,
                        usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 }
                    },
                    {
                        id: 'mock_parse_error_2',
                        content: `%_Thought_%
Let me provide a properly formatted response.
%_Plan_%
Create a valid response with proper tags.
%_Reply Required_%
%_Modified_%
--- src/test.js
+++ src/test.js
@@ -1,1 +1,1 @@
-console.log("test");
+console.log("corrected");
%_Comment_%
Fixed the parsing issue.
%%_Fin_%%`,
                        usage: { prompt_tokens: 140, completion_tokens: 50, total_tokens: 190 }
                    }
                ],
                expectedOutcome: 'success',
                expectedSteps: ['LLMReanalyze', 'SystemApplyDiff', 'End']
            }
        ];
    }

    /**
     * OpenAI API呼び出しをモック
     */
    private mockOpenAICall(prompt: string): MockLLMResponse {
        if (!this.currentScenario) {
            throw new Error('No current scenario set');
        }

        const response = this.currentScenario.mockResponses[this.mockResponseIndex];
        if (!response) {
            throw new Error(`No more mock responses available (index: ${this.mockResponseIndex})`);
        }

        this.mockResponseIndex++;
        this.logger.logInfo(`📱 Mock LLM Response [${response.id}]: ${response.content.substring(0, 100)}...`);
        
        return response;
    }

    /**
     * LLMFlowControllerのOpenAI呼び出しをモックに置き換え
     */
    private injectMockIntoController(controller: LLMFlowController) {
        // OpenAIClientのメソッドをモックに置き換え
        const originalOpenAIClient = (controller as any).openAIClient;
        
        if (originalOpenAIClient) {
            // setMockResponseメソッドを使用してモックを設定
            originalOpenAIClient.setMockResponse = (response: any) => {
                originalOpenAIClient.client = {
                    chat: {
                        completions: {
                            create: async () => response
                        }
                    }
                };
            };

            // fetchOpenAPIメソッドをオーバーライド
            originalOpenAIClient.fetchOpenAPI = async (messages: Array<{ role: string, content: string }>) => {
                const mockResponse = this.mockOpenAICall(messages.map(m => m.content).join('\n'));
                
                // OpenAI APIのレスポンス形式に合わせて変換
                return {
                    id: mockResponse.id,
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'gpt-4-mock',
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: 'assistant',
                                content: mockResponse.content
                            },
                            finish_reason: 'stop'
                        }
                    ],
                    usage: mockResponse.usage
                };
            };
        }
    }

    /**
     * 単一テストシナリオを実行
     */
    private async runSingleScenario(scenario: TestScenario): Promise<void> {
        this.logger.logInfo(`🧪 Running test scenario: ${scenario.name}`);
        this.logger.logInfo(`📝 Description: ${scenario.description}`);
        
        this.currentScenario = scenario;
        this.mockResponseIndex = 0;
        const actualSteps: string[] = [];
        const startTime = Date.now();

        try {
            // テスト用の設定を作成
            const testConfig = new Config('/app/dataset/test');

            // LLMFlowControllerを作成
            const controller = new LLMFlowController('/app/dataset/test');
            
            // OpenAI呼び出しをモックに置き換え
            this.injectMockIntoController(controller);

            // 実際のループを実行
            await controller.run();

            // 実行時間を測定
            const executionTime = Date.now() - startTime;

            // テスト結果を記録
            this.testResults.push({
                scenario: scenario.name,
                success: true,
                actualSteps,
                executionTime
            });

            this.logger.logInfo(`✅ Test scenario '${scenario.name}' completed successfully in ${executionTime}ms`);

        } catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            this.testResults.push({
                scenario: scenario.name,
                success: false,
                error: errorMessage,
                actualSteps,
                executionTime
            });

            this.logger.logError(`❌ Test scenario '${scenario.name}' failed: ${errorMessage}`);
        }
    }

    /**
     * 全テストシナリオを実行
     */
    async runAllTests(): Promise<void> {
        this.logger.logInfo('🚀 Starting Mock LLM Test Runner');
        this.logger.logInfo('==========================================');

        const scenarios = this.getTestScenarios();
        
        for (const scenario of scenarios) {
            await this.runSingleScenario(scenario);
            
            // シナリオ間の待機時間
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // テスト結果のサマリーを出力
        this.printTestSummary();
    }

    /**
     * テスト結果のサマリーを出力
     */
    private printTestSummary(): void {
        this.logger.logInfo('\n📊 Test Summary');
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
            this.logger.logInfo(`${status} ${result.scenario} (${result.executionTime}ms)`);
            if (result.error) {
                this.logger.logError(`   Error: ${result.error}`);
            }
        });

        // 統計レポートの生成
        this.generateTestReport();
    }

    /**
     * 詳細なテストレポートを生成
     */
    private generateTestReport(): void {
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.testResults.length,
                successfulTests: this.testResults.filter(r => r.success).length,
                failedTests: this.testResults.filter(r => !r.success).length,
                averageExecutionTime: this.testResults.reduce((sum, r) => sum + r.executionTime, 0) / this.testResults.length
            },
            results: this.testResults,
            recommendations: this.generateTestRecommendations()
        };

        // レポートファイルを保存
        const reportPath = path.join('/app/output', 'mock_test_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        
        this.logger.logInfo(`📄 Test report saved to: ${reportPath}`);
    }

    /**
     * テスト結果に基づく改善提案を生成
     */
    private generateTestRecommendations(): string[] {
        const recommendations: string[] = [];
        
        const failedTests = this.testResults.filter(r => !r.success);
        if (failedTests.length > 0) {
            recommendations.push('Review failed test scenarios for potential improvements');
        }

        const avgExecutionTime = this.testResults.reduce((sum, r) => sum + r.executionTime, 0) / this.testResults.length;
        if (avgExecutionTime > 5000) {
            recommendations.push('Consider optimizing performance for faster execution');
        }

        if (recommendations.length === 0) {
            recommendations.push('All tests passed successfully - system is operating as expected');
        }

        return recommendations;
    }
}

export default MockLLMTestRunner;
