/**
 * ワークフロー制御専用のControllerクラス
 * 処理の流れの制御のみに責任を持つ
 */
export class WorkflowController {
    constructor() {
        // 処理ステップの定義
        this.processingSteps = [
            'validateInputs',
            'loadProjectStructure', 
            'processProjects',
            'generateReport'
        ];
    }

    /**
     * メインワークフローの実行
     * @param {Object} context - 処理コンテキスト
     * @returns {Promise<Object>} 処理結果
     */
    async executeWorkflow(context) {
        const workflow = {
            steps: this.processingSteps,
            currentStep: 0,
            results: {},
            errors: []
        };

        try {
            for (const stepName of this.processingSteps) {
                workflow.currentStep++;
                
                const stepResult = await this.executeStep(stepName, context, workflow);
                workflow.results[stepName] = stepResult;
                
                // ステップ失敗時の処理
                if (!stepResult.success) {
                    workflow.errors.push({
                        step: stepName,
                        error: stepResult.error
                    });
                    
                    if (stepResult.critical) {
                        break;
                    }
                }
            }

            return {
                success: workflow.errors.length === 0,
                workflow,
                results: workflow.results
            };

        } catch (error) {
            workflow.errors.push({
                step: 'workflow',
                error: error.message
            });
            
            return {
                success: false,
                workflow,
                error: error.message
            };
        }
    }

    /**
     * 個別ステップの実行
     * @param {string} stepName - ステップ名
     * @param {Object} context - 処理コンテキスト
     * @param {Object} workflow - ワークフロー状態
     * @returns {Promise<Object>} ステップ実行結果
     */
    async executeStep(stepName, context, workflow) {
        const stepHandler = this.getStepHandler(stepName);
        
        if (!stepHandler) {
            return {
                success: false,
                error: `Unknown step: ${stepName}`,
                critical: true
            };
        }

        try {
            return await stepHandler(context, workflow);
        } catch (error) {
            return {
                success: false,
                error: error.message,
                critical: this.isStepCritical(stepName)
            };
        }
    }

    /**
     * ステップハンドラーの取得
     * @param {string} stepName - ステップ名
     * @returns {Function|null} ステップハンドラー
     */
    getStepHandler(stepName) {
        const handlers = {
            validateInputs: this.validateInputsStep.bind(this),
            loadProjectStructure: this.loadProjectStructureStep.bind(this),
            processProjects: this.processProjectsStep.bind(this),
            generateReport: this.generateReportStep.bind(this)
        };

        return handlers[stepName] || null;
    }

    /**
     * ステップの重要度判定
     * @param {string} stepName - ステップ名
     * @returns {boolean} 重要ステップかどうか
     */
    isStepCritical(stepName) {
        const criticalSteps = ['validateInputs', 'loadProjectStructure'];
        return criticalSteps.includes(stepName);
    }

    // ステップ実装（サンプル）
    async validateInputsStep(context, workflow) {
        // 入力値の検証ロジック
        return { success: true, data: 'validation_passed' };
    }

    async loadProjectStructureStep(context, workflow) {
        // プロジェクト構造の読み込みロジック
        return { success: true, data: 'structure_loaded' };
    }

    async processProjectsStep(context, workflow) {
        // プロジェクト処理のロジック
        return { success: true, data: 'projects_processed' };
    }

    async generateReportStep(context, workflow) {
        // レポート生成のロジック
        return { success: true, data: 'report_generated' };
    }
}
