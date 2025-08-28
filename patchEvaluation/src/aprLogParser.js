/**
 * 
 * APRログパーサー
 * LLMとの対話ログを解析し、premergeとmergeの差分を取得する
 */

import fs from 'fs/promises';
import path from 'path';
import MessageHandler from './messageHandler.js';
import LLMClientFactory from './llmClientFactory.js';
import Config from './config.js';

class APRLogParser {
    constructor() {
        this.messageHandler = new MessageHandler();
    }

    /**
     * APRログディレクトリから対話ログを読み取り
     * @param {string} aprLogPath - APRログのパス
     * @returns {Promise<object>} 解析されたログデータ
     */
    async parseLogEntry(aprLogPath) {
        try {
            const logFiles = await fs.readdir(aprLogPath);
            const logFilesList = logFiles.filter(file => file.endsWith('.log'));
            
            if (logFilesList.length === 0) {
                console.log(`⚠️ APRログファイルが見つかりません: ${aprLogPath}`);
                return null;
            }

            // 最新のログファイルを選択（タイムスタンプでソート）
            const latestLogFile = logFilesList.sort().pop();
            const logFilePath = path.join(aprLogPath, latestLogFile);
            
            console.log(`📖 解析対象ログファイル: ${latestLogFile}`);

            const logContent = await fs.readFile(logFilePath, 'utf-8');
            
            // JSONが巨大なファイルの一部の場合があるので、JSONのバランスをチェック
            let logData;
            try {
                logData = JSON.parse(logContent);
            } catch (parseError) {
                // JSON解析に失敗した場合、先頭部分だけを取得してみる
                console.log(`⚠️ 完全なJSON解析に失敗、先頭部分を解析試行: ${parseError.message}`);
                
                // JSONが不完全な場合、experiment_metadataとinteraction_logの部分だけ抽出
                const lines = logContent.split('\n');
                let jsonLines = [];
                let braceCount = 0;
                let inJson = false;
                
                for (const line of lines) {
                    if (line.trim().startsWith('{') && !inJson) {
                        inJson = true;
                    }
                    
                    if (inJson) {
                        jsonLines.push(line);
                        braceCount += (line.match(/\{/g) || []).length;
                        braceCount -= (line.match(/\}/g) || []).length;
                        
                        // JSONが完結した場合
                        if (braceCount === 0 && jsonLines.length > 1) {
                            break;
                        }
                    }
                }
                
                const partialJson = jsonLines.join('\n');
                try {
                    logData = JSON.parse(partialJson);
                } catch (secondParseError) {
                    console.error(`❌ JSON解析完全失敗: ${secondParseError.message}`);
                    return null;
                }
            }

            return this.extractLLMDialogue(logData);

        } catch (error) {
            console.error(`❌ APRログ解析エラー (${aprLogPath}):`, error.message);
            return null;
        }
    }

    /**
     * ログデータからLLMとの対話を抽出
     * @param {object} logData - ログデータ
     * @returns {object} 抽出された対話データ
     */
    extractLLMDialogue(logData) {
        const dialogue = {
            experimentId: logData.experiment_metadata?.experiment_id || 'unknown',
            turns: [],
            totalTokens: logData.experiment_metadata?.total_tokens?.total || 0,
            status: logData.experiment_metadata?.status || 'unknown',
            modificationHistory: [],
            requestedFiles: new Set(),
            allThoughts: [],
            allPlans: []
        };

        // 対話履歴の処理
        if (logData.interaction_log && Array.isArray(logData.interaction_log)) {
            for (const turn of logData.interaction_log) {
                if (turn.llm_response && turn.llm_response.parsed_content) {
                    const parsed = turn.llm_response.parsed_content;
                    
                    const turnData = {
                        turnNumber: turn.turn || dialogue.turns.length + 1,
                        timestamp: turn.timestamp,
                        thought: parsed.thought,
                        plan: parsed.plan,
                        requiredFiles: parsed.reply_required || [],
                        modifiedDiff: parsed.modified_diff,
                        commentText: parsed.commentText,
                        hasFinTag: parsed.has_fin_tag,
                        usage: turn.llm_response.usage || {}
                    };

                    dialogue.turns.push(turnData);

                    // トークン数の累計
                    if (turnData.usage.total) {
                        dialogue.totalTokens += turnData.usage.total;
                    }

                    // 思考とプランの蓄積
                    if (turnData.thought) {
                        dialogue.allThoughts.push(turnData.thought);
                    }
                    if (turnData.plan) {
                        dialogue.allPlans.push(turnData.plan);
                    }

                    // 要求されたファイルの蓄積
                    if (turnData.requiredFiles) {
                        for (const fileReq of turnData.requiredFiles) {
                            if (fileReq.path) {
                                dialogue.requestedFiles.add(fileReq.path);
                            }
                        }
                    }

                    // 修正履歴の蓄積
                    if (turnData.modifiedDiff) {
                        dialogue.modificationHistory.push({
                            turn: turnData.turnNumber,
                            timestamp: turnData.timestamp,
                            diff: turnData.modifiedDiff
                        });
                    }
                }
            }
        }

        dialogue.requestedFiles = Array.from(dialogue.requestedFiles);

        console.log(`✅ LLM対話データ抽出完了:`);
        console.log(`  - 対話ターン数: ${dialogue.turns.length}`);
        console.log(`  - 総トークン数: ${dialogue.totalTokens}`);
        console.log(`  - 要求ファイル数: ${dialogue.requestedFiles.length}`);
        console.log(`  - 修正回数: ${dialogue.modificationHistory.length}`);
        console.log(`  - ステータス: ${dialogue.status}`);

        return dialogue;
    }

    /**
     * 対話データから差分情報を分析
     * @param {object} dialogue - 対話データ
     * @returns {object} 差分分析結果
     */
    analyzeDifferences(dialogue) {
        const analysis = {
            totalModifications: dialogue.modificationHistory.length,
            affectedFiles: new Set(),
            codeChanges: [],
            progressionAnalysis: {
                phases: [],
                keyInsights: [],
                problemSolvingPattern: []
            }
        };

        // 修正履歴の分析
        for (const modification of dialogue.modificationHistory) {
            try {
                // diff形式の簡易解析
                const diffLines = modification.diff.split('\n');
                const fileChanges = this.parseDiffContent(diffLines);
                
                analysis.codeChanges.push({
                    turn: modification.turn,
                    timestamp: modification.timestamp,
                    changes: fileChanges
                });

                // 影響を受けたファイルの収集
                for (const change of fileChanges) {
                    if (change.filePath) {
                        analysis.affectedFiles.add(change.filePath);
                    }
                }
            } catch (error) {
                console.warn(`⚠️ diff解析エラー (turn ${modification.turn}):`, error.message);
            }
        }

        // 進行パターンの分析
        analysis.progressionAnalysis = this.analyzeProgressionPattern(dialogue);
        analysis.affectedFiles = Array.from(analysis.affectedFiles);

        return analysis;
    }

    /**
     * diff内容の簡易解析
     * @param {string[]} diffLines - diffの行配列
     * @returns {object[]} ファイル変更情報
     */
    parseDiffContent(diffLines) {
        const changes = [];
        let currentFile = null;
        let addedLines = 0;
        let deletedLines = 0;

        for (const line of diffLines) {
            // ファイルヘッダーの検出
            if (line.startsWith('--- ') || line.startsWith('+++ ')) {
                if (line.startsWith('+++ ') && !line.includes('/dev/null')) {
                    const filePath = line.substring(4).trim();
                    if (currentFile && (addedLines > 0 || deletedLines > 0)) {
                        changes.push({
                            filePath: currentFile,
                            addedLines,
                            deletedLines,
                            netChange: addedLines - deletedLines
                        });
                    }
                    currentFile = filePath;
                    addedLines = 0;
                    deletedLines = 0;
                }
            }
            // 変更行のカウント
            else if (line.startsWith('+') && !line.startsWith('+++')) {
                addedLines++;
            }
            else if (line.startsWith('-') && !line.startsWith('---')) {
                deletedLines++;
            }
        }

        // 最後のファイルの処理
        if (currentFile && (addedLines > 0 || deletedLines > 0)) {
            changes.push({
                filePath: currentFile,
                addedLines,
                deletedLines,
                netChange: addedLines - deletedLines
            });
        }

        return changes;
    }

    /**
     * 問題解決の進行パターンを分析
     * @param {object} dialogue - 対話データ
     * @returns {object} 進行パターン分析
     */
    analyzeProgressionPattern(dialogue) {
        const pattern = {
            phases: [],
            keyInsights: [],
            problemSolvingPattern: []
        };

        let currentPhase = 'initial_analysis';
        let phaseStartTurn = 1;

        for (let i = 0; i < dialogue.turns.length; i++) {
            const turn = dialogue.turns[i];
            
            // フェーズの判定ロジック
            let newPhase = this.determinePhase(turn, i, dialogue.turns.length);
            
            if (newPhase !== currentPhase) {
                // 前のフェーズを記録
                pattern.phases.push({
                    phase: currentPhase,
                    startTurn: phaseStartTurn,
                    endTurn: turn.turnNumber - 1,
                    duration: turn.turnNumber - phaseStartTurn
                });
                
                currentPhase = newPhase;
                phaseStartTurn = turn.turnNumber;
            }

            // 重要な洞察の抽出
            if (turn.thought) {
                const insight = this.extractKeyInsight(turn.thought);
                if (insight) {
                    pattern.keyInsights.push({
                        turn: turn.turnNumber,
                        insight: insight,
                        phase: currentPhase
                    });
                }
            }

            // 問題解決パターンの記録
            if (turn.plan) {
                const problemSolvingStep = this.categorizeProblemSolvingStep(turn.plan);
                if (problemSolvingStep) {
                    pattern.problemSolvingPattern.push({
                        turn: turn.turnNumber,
                        step: problemSolvingStep,
                        hasImplementation: !!turn.modifiedDiff
                    });
                }
            }
        }

        // 最後のフェーズを記録
        if (dialogue.turns.length > 0) {
            pattern.phases.push({
                phase: currentPhase,
                startTurn: phaseStartTurn,
                endTurn: dialogue.turns[dialogue.turns.length - 1].turnNumber,
                duration: dialogue.turns[dialogue.turns.length - 1].turnNumber - phaseStartTurn + 1
            });
        }

        return pattern;
    }

    /**
     * 現在のフェーズを判定
     * @param {object} turn - 対話ターン
     * @param {number} index - ターンインデックス
     * @param {number} totalTurns - 総ターン数
     * @returns {string} フェーズ名
     */
    determinePhase(turn, index, totalTurns) {
        if (turn.hasFinTag) {
            return 'completion';
        }
        
        if (turn.modifiedDiff) {
            return 'implementation';
        }
        
        if (turn.requiredFiles && turn.requiredFiles.length > 0) {
            return 'information_gathering';
        }
        
        if (index < totalTurns * 0.3) {
            return 'initial_analysis';
        }
        
        if (index < totalTurns * 0.7) {
            return 'detailed_analysis';
        }
        
        return 'solution_refinement';
    }

    /**
     * 思考から重要な洞察を抽出
     * @param {string} thought - 思考内容
     * @returns {string|null} 抽出された洞察
     */
    extractKeyInsight(thought) {
        // 重要なキーワードを含む洞察を抽出
        const keywordPatterns = [
            /(?:発見|found|identified).*(?:問題|issue|error|bug)/i,
            /(?:原因|cause|reason).*(?:は|is|due to)/i,
            /(?:解決|solution|fix).*(?:方法|approach|way)/i,
            /(?:重要|important|critical|key).*(?:点|point|aspect)/i
        ];

        for (const pattern of keywordPatterns) {
            const match = thought.match(pattern);
            if (match) {
                // マッチした文を含む前後の文脈を抽出
                const sentences = thought.split(/[.。！!?？]/);
                for (const sentence of sentences) {
                    if (pattern.test(sentence)) {
                        return sentence.trim();
                    }
                }
            }
        }

        return null;
    }

    /**
     * プランから問題解決ステップを分類
     * @param {string|object} plan - プラン内容
     * @returns {string|null} 問題解決ステップのカテゴリ
     */
    categorizeProblemSolvingStep(plan) {
        const planText = typeof plan === 'string' ? plan : JSON.stringify(plan);
        
        const categories = {
            'analysis': /(?:分析|analyze|review|examine|investigate)/i,
            'file_exploration': /(?:ファイル|file|content|code).*(?:確認|check|read|view)/i,
            'problem_identification': /(?:問題|issue|error|bug).*(?:特定|identify|locate|find)/i,
            'solution_design': /(?:解決|solution|fix|修正).*(?:設計|design|plan|approach)/i,
            'implementation': /(?:実装|implement|apply|修正|modify|change)/i,
            'testing': /(?:テスト|test|verify|validation|確認)/i,
            'refinement': /(?:改善|improve|refine|optimize|調整)/i
        };

        for (const [category, pattern] of Object.entries(categories)) {
            if (pattern.test(planText)) {
                return category;
            }
        }

        return 'general';
    }

    /**
     * 対話データから最終的な修正内容を抽出
     * @param {object} dialogue - 対話データ
     * @returns {object} 最終修正内容
     */
    extractFinalModifications(dialogue) {
        const finalMods = {
            lastModification: null,
            allModifications: dialogue.modificationHistory,
            finalState: {
                hasImplementedSolution: dialogue.modificationHistory.length > 0,
                wasCompleted: dialogue.turns.some(turn => turn.hasFinTag),
                finalStatus: dialogue.status
            }
        };

        if (dialogue.modificationHistory.length > 0) {
            finalMods.lastModification = dialogue.modificationHistory[dialogue.modificationHistory.length - 1];
        }

        return finalMods;
    }

    /**
     * premergeとmergeの差分を比較分析
     * @param {string} premergeLogPath - premergeのAPRログパス
     * @param {string} mergeLogPath - mergeのAPRログパス  
     * @returns {Promise<object>} 比較分析結果
     */
    async comparePremergeAndMerge(premergeLogPath, mergeLogPath) {
        console.log(`🔄 premergeとmergeの比較分析を開始`);
        console.log(`  Premerge: ${premergeLogPath}`);
        console.log(`  Merge: ${mergeLogPath}`);

        const premergeDialogue = await this.parseAPRLog(premergeLogPath);
        const mergeDialogue = await this.parseAPRLog(mergeLogPath);

        if (!premergeDialogue && !mergeDialogue) {
            console.warn('⚠️ どちらのログも解析できませんでした');
            return null;
        }

        const comparison = {
            premerge: premergeDialogue,
            merge: mergeDialogue,
            differences: {},
            analysis: {}
        };

        // 基本統計の比較
        if (premergeDialogue && mergeDialogue) {
            comparison.differences = {
                turnCountDiff: mergeDialogue.turns.length - premergeDialogue.turns.length,
                tokenUsageDiff: mergeDialogue.totalTokens - premergeDialogue.totalTokens,
                modificationCountDiff: mergeDialogue.modificationHistory.length - premergeDialogue.modificationHistory.length,
                requestedFilesDiff: {
                    premergeOnly: premergeDialogue.requestedFiles.filter(f => !mergeDialogue.requestedFiles.includes(f)),
                    mergeOnly: mergeDialogue.requestedFiles.filter(f => !premergeDialogue.requestedFiles.includes(f)),
                    common: premergeDialogue.requestedFiles.filter(f => mergeDialogue.requestedFiles.includes(f))
                }
            };

            // 進行パターンの比較
            const premergeAnalysis = this.analyzeDifferences(premergeDialogue);
            const mergeAnalysis = this.analyzeDifferences(mergeDialogue);

            comparison.analysis = {
                premerge: premergeAnalysis,
                merge: mergeAnalysis,
                phaseComparison: this.comparePhases(premergeAnalysis.progressionAnalysis, mergeAnalysis.progressionAnalysis)
            };
        }

        console.log('✅ 比較分析完了');
        return comparison;
    }

    /**
     * フェーズの比較分析
     * @param {object} premergePhases - premergeのフェーズ情報
     * @param {object} mergePhases - mergeのフェーズ情報
     * @returns {object} フェーズ比較結果
     */
    comparePhases(premergePhases, mergePhases) {
        return {
            premergePhases: premergePhases.phases,
            mergePhases: mergePhases.phases,
            phaseDurationChanges: this.calculatePhaseDurationChanges(premergePhases.phases, mergePhases.phases),
            insightComparison: {
                premergeInsights: premergePhases.keyInsights.length,
                mergeInsights: mergePhases.keyInsights.length,
                commonInsights: this.findCommonInsights(premergePhases.keyInsights, mergePhases.keyInsights)
            }
        };
    }

    /**
     * フェーズ期間の変化を計算
     * @param {object[]} premergePhases - premergeのフェーズ
     * @param {object[]} mergePhases - mergeのフェーズ
     * @returns {object[]} 期間変化
     */
    calculatePhaseDurationChanges(premergePhases, mergePhases) {
        const changes = [];
        const phaseNames = ['initial_analysis', 'information_gathering', 'detailed_analysis', 'implementation', 'completion'];

        for (const phaseName of phaseNames) {
            const premergePhase = premergePhases.find(p => p.phase === phaseName);
            const mergePhase = mergePhases.find(p => p.phase === phaseName);

            changes.push({
                phase: phaseName,
                premergeDuration: premergePhase ? premergePhase.duration : 0,
                mergeDuration: mergePhase ? mergePhase.duration : 0,
                change: (mergePhase ? mergePhase.duration : 0) - (premergePhase ? premergePhase.duration : 0)
            });
        }

        return changes;
    }

    /**
     * 共通の洞察を見つける
     * @param {object[]} premergeInsights - premergeの洞察
     * @param {object[]} mergeInsights - mergeの洞察
     * @returns {object[]} 共通の洞察
     */
    findCommonInsights(premergeInsights, mergeInsights) {
        const commonInsights = [];
        
        for (const preInsight of premergeInsights) {
            for (const mergeInsight of mergeInsights) {
                // 簡易的な類似度チェック（実際の実装では更に洗練されたアルゴリズムを使用）
                if (this.calculateStringSimilarity(preInsight.insight, mergeInsight.insight) > 0.7) {
                    commonInsights.push({
                        premerge: preInsight,
                        merge: mergeInsight,
                        similarity: this.calculateStringSimilarity(preInsight.insight, mergeInsight.insight)
                    });
                }
            }
        }

        return commonInsights;
    }

    /**
     * 文字列の類似度を計算（簡易版）
     * @param {string} str1 - 文字列1
     * @param {string} str2 - 文字列2
     * @returns {number} 類似度（0-1）
     */
    calculateStringSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) {
            return 1.0;
        }
        
        const editDistance = this.calculateLevenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * レーベンシュタイン距離を計算
     * @param {string} str1 - 文字列1
     * @param {string} str2 - 文字列2
     * @returns {number} 編集距離
     */
    calculateLevenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) {
            matrix[0][i] = i;
        }

        for (let j = 0; j <= str2.length; j++) {
            matrix[j][0] = j;
        }

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1, // insertion
                    matrix[j - 1][i] + 1, // deletion
                    matrix[j - 1][i - 1] + indicator // substitution
                );
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * LLMを使用してパッチを評価する
     * @param {string} codeContext - コードの周辺コンテキスト
     * @param {string} groundTruthDiff - 正解のdiff
     * @param {string} agentGeneratedDiff - AIエージェントが生成したdiff
     * @param {string} agentThoughtProcess - AIエージェントの思考プロセス
     * @param {object} config - 設定オブジェクト
     * @returns {Promise<object>} LLM評価結果
     */
    async evaluateWithLLM(codeContext, groundTruthDiff, agentGeneratedDiff, agentThoughtProcess, config = null) {
        console.log('🤖 LLMを使用したパッチ評価を開始');

        try {
            // 設定の初期化（引数がない場合はデフォルト設定を使用）
            const evalConfig = config || new Config('/app/patchEvaluation');
            
            // LLMクライアントの作成
            const llmClient = LLMClientFactory.create(evalConfig);
            
            // プロンプトテンプレートの読み込み
            const promptTemplate = await this.loadEvaluationPrompt();
            
            // プロンプトの生成
            const evaluationPrompt = this.generateEvaluationPrompt(
                promptTemplate,
                codeContext,
                groundTruthDiff,
                agentGeneratedDiff,
                agentThoughtProcess
            );

            console.log('📝 評価プロンプト生成完了');
            console.log(`📏 プロンプト長: ${evaluationPrompt.length} 文字`);

            // LLMリクエストの準備
            const messages = [
                {
                    role: 'system',
                    content: 'You are an expert software engineering researcher specializing in Automated Program Repair (APR) evaluation. You must respond with valid JSON only.'
                },
                {
                    role: 'user',
                    content: evaluationPrompt
                }
            ];

            // LLMリクエストパラメータを準備
            const requestParams = {
                messages: messages,
                maxTokens: evalConfig.get('llm.maxTokens', 4000)
            };
            
            // gpt-5以外の場合のみtemperatureを設定
            const model = evalConfig.get('openai.model', 'gpt-4');
            if (model !== 'gpt-5') {
                requestParams.temperature = evalConfig.get('llm.temperature', 0.1);
            }

            // LLMに評価リクエストを送信
            console.log('🚀 LLMに評価リクエストを送信中...');
            const response = await llmClient.generateContent(requestParams);

            console.log('✅ LLM評価レスポンス受信完了');
            console.log(`📊 使用トークン数: ${response.usage?.totalTokens || 0}`);

            // レスポンスの解析
            const evaluationResult = this.parseEvaluationResponse(response.content);

            return {
                success: true,
                evaluation: evaluationResult,
                metadata: {
                    model: response.model || 'unknown',
                    usage: response.usage,
                    timestamp: new Date().toISOString(),
                    promptLength: evaluationPrompt.length
                }
            };

        } catch (error) {
            console.error('❌ LLM評価エラー:', error.message);
            return {
                success: false,
                error: error.message,
                evaluation: null,
                metadata: {
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * 評価プロンプトテンプレートを読み込み
     * @returns {Promise<string>} プロンプトテンプレート
     */
    async loadEvaluationPrompt() {
        try {
            const promptPath = '/app/prompt/00_evaluationPrompt.txt';
            return await fs.readFile(promptPath, 'utf-8');
        } catch (error) {
            console.warn('⚠️ メインプロンプトファイルが見つかりません、patchEvaluationディレクトリから読み込みます');
            try {
                const fallbackPath = '/app/patchEvaluation/prompt/00_evaluationPrompt.txt';
                return await fs.readFile(fallbackPath, 'utf-8');
            } catch (fallbackError) {
                throw new Error(`評価プロンプトファイルを読み込めませんでした: ${error.message}, ${fallbackError.message}`);
            }
        }
    }

    /**
     * プロンプトテンプレートに値を埋め込み、評価プロンプトを生成
     * @param {string} template - プロンプトテンプレート
     * @param {string} codeContext - コードコンテキスト
     * @param {string} groundTruthDiff - 正解diff
     * @param {string} agentGeneratedDiff - エージェント生成diff
     * @param {string} agentThoughtProcess - エージェントの思考プロセス
     * @returns {string} 生成された評価プロンプト
     */
    generateEvaluationPrompt(template, codeContext, groundTruthDiff, agentGeneratedDiff, agentThoughtProcess) {
        return template
            .replace(/\{\{code_context\}\}/g, codeContext || '(No code context provided)')
            .replace(/\{\{ground_truth_diff\}\}/g, groundTruthDiff || '(No ground truth diff provided)')
            .replace(/\{\{agent_generated_diff\}\}/g, agentGeneratedDiff || '(No agent generated diff provided)')
            .replace(/\{\{agent_thought_process\}\}/g, agentThoughtProcess || '(No thought process provided)');
    }

    /**
     * LLMレスポンスを解析してJSONオブジェクトに変換
     * @param {string} responseContent - LLMレスポンス内容
     * @returns {object} 解析された評価結果
     */
    parseEvaluationResponse(responseContent) {
        try {
            // レスポンスのクリーンアップ
            let cleanedContent = responseContent.trim();
            
            // Markdownコードブロックを除去
            cleanedContent = cleanedContent
                .replace(/^```(?:json)?\s*\n?/i, '')
                .replace(/\n?```\s*$/i, '')
                .trim();

            // JSON部分を抽出
            const jsonStart = cleanedContent.indexOf('{');
            const jsonEnd = cleanedContent.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                cleanedContent = cleanedContent.substring(jsonStart, jsonEnd + 1);
            }

            const evaluation = JSON.parse(cleanedContent);

            // 評価結果の妥当性チェック
            this.validateEvaluationResult(evaluation);

            console.log('✅ 評価結果の解析が成功しました');
            console.log(`📋 妥当性: ${evaluation.plausibility_evaluation?.is_plausible ? '✓' : '✗'}`);
            console.log(`📋 正確性: ${evaluation.correctness_evaluation?.is_correct ? '✓' : '✗'}`);
            console.log(`📋 等価レベル: ${evaluation.correctness_evaluation?.semantic_equivalence_level || 'N/A'}`);

            return evaluation;

        } catch (error) {
            console.error('❌ 評価レスポンス解析エラー:', error.message);
            console.log('📝 生レスポンス (最初の500文字):', responseContent.substring(0, 500));
            
            // フォールバック: 基本的な評価結果を返す
            return {
                plausibility_evaluation: {
                    is_plausible: false,
                    reasoning: `レスポンス解析エラー: ${error.message}`
                },
                correctness_evaluation: {
                    is_correct: false,
                    semantic_equivalence_level: "INCORRECT",
                    reasoning: "LLMレスポンスの解析に失敗しました",
                    semantic_similarity_rules_applied: []
                },
                parse_error: {
                    error: error.message,
                    raw_response: responseContent.substring(0, 1000)
                }
            };
        }
    }

    /**
     * 評価結果の妥当性をチェック
     * @param {object} evaluation - 評価結果オブジェクト
     */
    validateEvaluationResult(evaluation) {
        const requiredFields = [
            'plausibility_evaluation',
            'correctness_evaluation'
        ];

        for (const field of requiredFields) {
            if (!evaluation[field]) {
                throw new Error(`必須フィールドが不足しています: ${field}`);
            }
        }

        // plausibility_evaluationの妥当性チェック
        const plausibility = evaluation.plausibility_evaluation;
        if (typeof plausibility.is_plausible !== 'boolean') {
            throw new Error('plausibility_evaluation.is_plausible は boolean型である必要があります');
        }

        // correctness_evaluationの妥当性チェック
        const correctness = evaluation.correctness_evaluation;
        if (typeof correctness.is_correct !== 'boolean') {
            throw new Error('correctness_evaluation.is_correct は boolean型である必要があります');
        }

        const validLevels = ['IDENTICAL', 'SEMANTICALLY_EQUIVALENT', 'PLAUSIBLE_BUT_DIFFERENT', 'INCORRECT'];
        if (!validLevels.includes(correctness.semantic_equivalence_level)) {
            throw new Error(`無効な semantic_equivalence_level: ${correctness.semantic_equivalence_level}`);
        }
    }

    /**
     * 評価結果のサマリーを生成
     * @param {object} evaluationResult - 評価結果
     * @returns {object} サマリー
     */
    generateEvaluationSummary(evaluationResult) {
        if (!evaluationResult.success) {
            return {
                success: false,
                summary: 'LLM評価に失敗しました',
                error: evaluationResult.error
            };
        }

        const eval_data = evaluationResult.evaluation;
        const isPlausible = eval_data.plausibility_evaluation?.is_plausible || false;
        const isCorrect = eval_data.correctness_evaluation?.is_correct || false;
        const equivalenceLevel = eval_data.correctness_evaluation?.semantic_equivalence_level || 'UNKNOWN';
        const rulesApplied = eval_data.correctness_evaluation?.semantic_similarity_rules_applied || [];

        return {
            success: true,
            summary: {
                overall_assessment: isCorrect ? 'CORRECT' : (isPlausible ? 'PLAUSIBLE_BUT_INCORRECT' : 'INCORRECT'),
                is_plausible: isPlausible,
                is_correct: isCorrect,
                semantic_equivalence_level: equivalenceLevel,
                rules_applied: rulesApplied,
                rules_count: rulesApplied.length,
                confidence_indicators: {
                    has_detailed_reasoning: !!(eval_data.plausibility_evaluation?.reasoning && eval_data.correctness_evaluation?.reasoning),
                    rules_properly_applied: rulesApplied.length > 0 && isCorrect,
                    evaluation_consistent: isCorrect ? isPlausible : true // 正確なパッチは妥当である必要がある
                }
            },
            metadata: evaluationResult.metadata
        };
    }
}

export default APRLogParser;
