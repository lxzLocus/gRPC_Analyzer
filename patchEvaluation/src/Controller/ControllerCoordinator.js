/**
 * Controller間のコーディネーション（調整）を行うクラス
 * 複数のControllerの連携と情報の受け渡しを管理
 */
export class ControllerCoordinator {
    constructor() {
        this.controllers = new Map();
        this.eventBus = new EventBus();
        this.contextStore = new ContextStore();
    }

    /**
     * Controllerの登録
     * @param {string} name - Controller名
     * @param {Object} controller - Controllerインスタンス
     */
    registerController(name, controller) {
        this.controllers.set(name, controller);
        
        // イベントリスナーの設定
        if (controller.registerEventHandlers) {
            controller.registerEventHandlers(this.eventBus);
        }
    }

    /**
     * Controllerの取得
     * @param {string} name - Controller名
     * @returns {Object|null} Controllerインスタンス
     */
    getController(name) {
        return this.controllers.get(name) || null;
    }

    /**
     * 処理の実行とController間の連携
     * @param {string} operation - 実行する操作
     * @param {Object} context - 処理コンテキスト
     * @returns {Promise<Object>} 実行結果
     */
    async executeOperation(operation, context) {
        const operationPlan = this.createOperationPlan(operation, context);
        
        try {
            this.eventBus.emit('operation:start', { operation, context });
            
            const result = await this.executeOperationPlan(operationPlan, context);
            
            this.eventBus.emit('operation:complete', { operation, result });
            
            return result;
        } catch (error) {
            this.eventBus.emit('operation:error', { operation, error });
            throw error;
        }
    }

    /**
     * 操作プランの作成
     * @param {string} operation - 操作名
     * @param {Object} context - コンテキスト
     * @returns {Array} 操作ステップのリスト
     */
    createOperationPlan(operation, context) {
        const plans = {
            'analyze_dataset': [
                { controller: 'project', method: 'processProject', dependencies: [] },
                { controller: 'diff', method: 'processSuccessfulAnalysis', dependencies: ['project'] },
                { controller: 'llm', method: 'executeLLMEvaluation', dependencies: ['diff'] }
            ],
            'evaluate_modifications': [
                { controller: 'diff', method: 'createGroundTruthDiff', dependencies: [] },
                { controller: 'llm', method: 'executeLLMEvaluation', dependencies: ['diff'] }
            ],
            'process_apr_logs': [
                { controller: 'project', method: 'processAPRLog', dependencies: [] },
                { controller: 'diff', method: 'processSuccessfulAnalysis', dependencies: ['project'] }
            ]
        };

        return plans[operation] || [];
    }

    /**
     * 操作プランの実行
     * @param {Array} operationPlan - 実行プラン
     * @param {Object} context - コンテキスト
     * @returns {Promise<Object>} 実行結果
     */
    async executeOperationPlan(operationPlan, context) {
        const results = new Map();
        const executionOrder = this.resolveExecutionOrder(operationPlan);

        for (const step of executionOrder) {
            const controller = this.getController(step.controller);
            
            if (!controller) {
                throw new Error(`Controller not found: ${step.controller}`);
            }

            // 依存関係のある結果を取得
            const dependencyResults = this.gatherDependencyResults(step.dependencies, results);
            
            // コンテキストを更新
            const stepContext = {
                ...context,
                dependencies: dependencyResults,
                previous: Array.from(results.values())
            };

            // ステップの実行
            const stepResult = await this.executeStep(controller, step, stepContext);
            results.set(step.controller, stepResult);

            // イベント通知
            this.eventBus.emit('step:complete', {
                controller: step.controller,
                method: step.method,
                result: stepResult
            });
        }

        return {
            success: true,
            results: Object.fromEntries(results),
            executionOrder: executionOrder.map(step => step.controller)
        };
    }

    /**
     * 実行順序の解決（依存関係を考慮）
     * @param {Array} operationPlan - 操作プラン
     * @returns {Array} 解決された実行順序
     */
    resolveExecutionOrder(operationPlan) {
        const resolved = [];
        const remaining = [...operationPlan];

        while (remaining.length > 0) {
            const readySteps = remaining.filter(step => 
                step.dependencies.every(dep => 
                    resolved.some(r => r.controller === dep)
                )
            );

            if (readySteps.length === 0) {
                throw new Error('Circular dependency detected in operation plan');
            }

            // 並行実行可能なステップを特定
            const parallelSteps = readySteps.slice(0, this.getMaxParallelism());
            
            resolved.push(...parallelSteps);
            
            // 処理済みステップを削除
            parallelSteps.forEach(step => {
                const index = remaining.indexOf(step);
                remaining.splice(index, 1);
            });
        }

        return resolved;
    }

    /**
     * 最大並行度の取得
     * @returns {number} 最大並行実行数
     */
    getMaxParallelism() {
        return 3; // 設定可能にする
    }

    /**
     * 依存関係の結果を収集
     * @param {Array} dependencies - 依存関係リスト
     * @param {Map} results - 結果マップ
     * @returns {Object} 依存関係の結果
     */
    gatherDependencyResults(dependencies, results) {
        const dependencyResults = {};
        
        for (const dep of dependencies) {
            if (results.has(dep)) {
                dependencyResults[dep] = results.get(dep);
            }
        }
        
        return dependencyResults;
    }

    /**
     * ステップの実行
     * @param {Object} controller - Controllerインスタンス
     * @param {Object} step - 実行ステップ
     * @param {Object} context - コンテキスト
     * @returns {Promise<Object>} ステップ実行結果
     */
    async executeStep(controller, step, context) {
        const method = controller[step.method];
        
        if (!method || typeof method !== 'function') {
            throw new Error(`Method ${step.method} not found in controller ${step.controller}`);
        }

        try {
            // コンテキストの保存
            this.contextStore.saveContext(step.controller, context);
            
            // メソッドの実行
            const result = await method.call(controller, context);
            
            return {
                success: true,
                data: result,
                controller: step.controller,
                method: step.method,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                controller: step.controller,
                method: step.method,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * イベント監視の開始
     * @param {string} eventType - イベントタイプ
     * @param {Function} handler - イベントハンドラー
     */
    onEvent(eventType, handler) {
        this.eventBus.on(eventType, handler);
    }

    /**
     * 処理状況の取得
     * @returns {Object} 処理状況
     */
    getStatus() {
        return {
            controllers: Array.from(this.controllers.keys()),
            activeOperations: this.eventBus.getActiveOperations(),
            contextStore: this.contextStore.getStats()
        };
    }
}

/**
 * シンプルなイベントバス実装
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
        this.activeOperations = new Set();
    }

    on(eventType, handler) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(handler);
    }

    emit(eventType, data) {
        if (eventType.includes('start')) {
            this.activeOperations.add(data.operation);
        } else if (eventType.includes('complete') || eventType.includes('error')) {
            this.activeOperations.delete(data.operation);
        }

        const handlers = this.listeners.get(eventType) || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`Event handler error: ${error.message}`);
            }
        });
    }

    getActiveOperations() {
        return Array.from(this.activeOperations);
    }
}

/**
 * コンテキスト保存用ストア
 */
class ContextStore {
    constructor() {
        this.contexts = new Map();
        this.maxSize = 100; // 最大保存数
    }

    saveContext(key, context) {
        // サイズ制限のチェック
        if (this.contexts.size >= this.maxSize) {
            const firstKey = this.contexts.keys().next().value;
            this.contexts.delete(firstKey);
        }

        this.contexts.set(key, {
            ...context,
            timestamp: new Date().toISOString()
        });
    }

    getContext(key) {
        return this.contexts.get(key);
    }

    getStats() {
        return {
            totalContexts: this.contexts.size,
            maxSize: this.maxSize,
            keys: Array.from(this.contexts.keys())
        };
    }
}
