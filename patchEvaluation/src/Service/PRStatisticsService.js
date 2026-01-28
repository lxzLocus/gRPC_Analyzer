import fs from 'fs/promises';
import path from 'path';

/**
 * PRごとの統計情報を生成するサービス
 */
class PRStatisticsService {
    constructor() {
        this.projectRoot = '/app';
        this.outputDir = path.join(this.projectRoot, 'output');
    }

    /**
     * Accuracyラベルをスコアに変換（統計計算用）
     * @param {string} label - Accuracy label
     * @returns {number} Numeric score (0.0-1.0)
     */
    _labelToScore(label) {
        const labelToScore = {
            'IDENTICAL': 1.0,
            'SEMANTICALLY_EQUIVALENT': 0.85,
            'PARTIALLY_CORRECT': 0.5,
            'WRONG_APPROACH': 0.25,
            'NO_MATCH': 0.0
        };
        return labelToScore[label] || 0.0;
    }

    /**
     * PRごとの統計をレポートから生成
     * @param {Object} reportData - detailed_analysis_report のデータ
     * @returns {Object} PRごとの統計
     */
    generatePRStatistics(reportData) {
        const prStats = {};

        // 全ての評価レベルからPRを収集
        const allLevels = [
            ...(reportData.correctnessLevels?.identical || []),
            ...(reportData.correctnessLevels?.semanticallyEquivalent || []),
            ...(reportData.correctnessLevels?.plausibleButDifferent || []),
            ...(reportData.correctnessLevels?.incorrect || []),
            ...(reportData.correctnessLevels?.skipped || [])
        ];

        allLevels.forEach(entry => {
            const prKey = entry.datasetEntry || entry.pullRequestName;
            
            if (!prStats[prKey]) {
                prStats[prKey] = {
                    prName: entry.pullRequestName,
                    projectName: entry.projectName,
                    datasetEntry: entry.datasetEntry,
                    
                    // 基本統計
                    totalModifications: 0,
                    modifiedFiles: entry.modifiedFiles || 0,
                    modifiedLines: entry.modifiedLines || 0,
                    
                    // 評価結果
                    correctnessLevel: entry.correctnessLevel,
                    plausibilityLevel: entry.plausibilityLevel,
                    
                    // 4軸評価（新形式）
                    fourAxisEvaluation: entry.fourAxisEvaluation || null,
                    
                    // Repair Types
                    repairTypes: entry.repairTypes || [],
                    
                    // APR情報
                    aprProvider: entry.aprProvider,
                    aprModel: entry.aprModel,
                    
                    // 評価理由
                    evaluationReasoning: entry.evaluationReasoning || '',
                    
                    // タイムスタンプ
                    processedAt: entry.processedAt || new Date().toISOString()
                };
            }
            
            prStats[prKey].totalModifications++;
        });

        return prStats;
    }

    /**
     * プロジェクトごとの統計を生成
     * @param {Object} prStats - PR統計
     * @returns {Object} プロジェクトごとの統計
     */
    generateProjectStatistics(prStats) {
        const projectStats = {};

        Object.values(prStats).forEach(pr => {
            const projectName = pr.projectName || 'Unknown';
            
            if (!projectStats[projectName]) {
                projectStats[projectName] = {
                    projectName,
                    totalPRs: 0,
                    totalModifications: 0,
                    totalModifiedFiles: 0,
                    totalModifiedLines: 0,
                    
                    // 正確性レベル別の統計
                    correctnessBreakdown: {
                        IDENTICAL: 0,
                        SEMANTICALLY_EQUIVALENT: 0,
                        PLAUSIBLE_BUT_DIFFERENT: 0,
                        INCORRECT: 0
                    },
                    
                    // 4軸評価統計（新形式）
                    fourAxisStatistics: {
                        totalEvaluated: 0,
                        accuracyScores: [],
                        decisionSoundnessPass: 0,
                        directionalConsistencyPass: 0,
                        validityPass: 0
                    },
                    
                    // Repair Types統計
                    repairTypesBreakdown: {},
                    
                    // APRプロバイダー別統計
                    aprProviderBreakdown: {}
                };
            }
            
            const stats = projectStats[projectName];
            stats.totalPRs++;
            stats.totalModifications += pr.totalModifications;
            stats.totalModifiedFiles += pr.modifiedFiles;
            stats.totalModifiedLines += pr.modifiedLines;
            
            // 正確性レベル
            if (pr.correctnessLevel) {
                stats.correctnessBreakdown[pr.correctnessLevel] = 
                    (stats.correctnessBreakdown[pr.correctnessLevel] || 0) + 1;
            }
            
            // 4軸評価統計
            if (pr.fourAxisEvaluation) {
                stats.fourAxisStatistics.totalEvaluated++;
                
                // accuracy_score フィールドを優先的に使用
                if (pr.fourAxisEvaluation.accuracy_score !== undefined) {
                    stats.fourAxisStatistics.accuracyScores.push(pr.fourAxisEvaluation.accuracy_score);
                } else if (pr.fourAxisEvaluation.accuracy?.label !== undefined) {
                    // ラベルをスコアに変換して蓄積（統計用）
                    const accuracyScore = this._labelToScore(pr.fourAxisEvaluation.accuracy.label);
                    stats.fourAxisStatistics.accuracyScores.push(accuracyScore);
                } else if (pr.fourAxisEvaluation.accuracy?.score !== undefined) {
                    // 旧形式のスコアをそのまま使用
                    stats.fourAxisStatistics.accuracyScores.push(pr.fourAxisEvaluation.accuracy.score);
                }
                
                // Decision Soundness - decision_soundness_score を優先
                if (pr.fourAxisEvaluation.decision_soundness_score === 1.0 ||
                    pr.fourAxisEvaluation.decision_soundness?.label === 'SOUND' ||
                    pr.fourAxisEvaluation.decision_soundness?.score === 1.0) {
                    stats.fourAxisStatistics.decisionSoundnessPass++;
                }
                
                // Directional Consistency - directional_consistency_score を優先
                if (pr.fourAxisEvaluation.directional_consistency_score === 1.0 ||
                    pr.fourAxisEvaluation.directional_consistency?.label === 'CONSISTENT' ||
                    pr.fourAxisEvaluation.directional_consistency?.score === 1.0) {
                    stats.fourAxisStatistics.directionalConsistencyPass++;
                }
                
                // Validity - validity_score を優先
                if (pr.fourAxisEvaluation.validity_score === 1.0 ||
                    pr.fourAxisEvaluation.validity?.label === 'VALID' ||
                    pr.fourAxisEvaluation.validity?.score === 1.0) {
                    stats.fourAxisStatistics.validityPass++;
                }
            }
            
            // Repair Types統計
            if (pr.repairTypes && Array.isArray(pr.repairTypes)) {
                pr.repairTypes.forEach(type => {
                    stats.repairTypesBreakdown[type] = (stats.repairTypesBreakdown[type] || 0) + 1;
                });
            }
            
            // APRプロバイダー統計
            if (pr.aprProvider) {
                stats.aprProviderBreakdown[pr.aprProvider] = 
                    (stats.aprProviderBreakdown[pr.aprProvider] || 0) + 1;
            }
        });

        // 4軸評価の平均スコアを計算
        Object.values(projectStats).forEach(stats => {
            if (stats.fourAxisStatistics.accuracyScores.length > 0) {
                const sum = stats.fourAxisStatistics.accuracyScores.reduce((a, b) => a + b, 0);
                stats.fourAxisStatistics.averageAccuracy = 
                    sum / stats.fourAxisStatistics.accuracyScores.length;
            }
        });

        return projectStats;
    }

    /**
     * 統計情報を含む拡張レポートを生成
     * @param {string} sessionId - レポートセッションID
     * @returns {Promise<Object>} 拡張レポート
     */
    async generateEnhancedReport(sessionId) {
        try {
            const fileName = `detailed_analysis_report_${sessionId}.json`;
            const filePath = path.join(this.outputDir, fileName);
            
            const content = await fs.readFile(filePath, 'utf-8');
            const reportData = JSON.parse(content);
            
            // PR統計を生成
            const prStats = this.generatePRStatistics(reportData);
            
            // プロジェクト統計を生成
            const projectStats = this.generateProjectStatistics(prStats);
            
            // 拡張レポートの構築
            const enhancedReport = {
                ...reportData,
                
                // PR別統計を追加
                prStatistics: prStats,
                
                // プロジェクト別統計を追加
                projectStatistics: projectStats,
                
                // 全体サマリーを更新
                enhancedSummary: {
                    totalPRs: Object.keys(prStats).length,
                    totalProjects: Object.keys(projectStats).length,
                    totalModifications: Object.values(prStats).reduce((sum, pr) => sum + pr.totalModifications, 0),
                    totalModifiedFiles: Object.values(prStats).reduce((sum, pr) => sum + pr.modifiedFiles, 0),
                    totalModifiedLines: Object.values(prStats).reduce((sum, pr) => sum + pr.modifiedLines, 0),
                    
                    // 4軸評価のグローバル統計
                    globalFourAxisStatistics: this.calculateGlobalFourAxisStatistics(projectStats)
                }
            };
            
            return enhancedReport;
        } catch (error) {
            throw new Error(`Failed to generate enhanced report: ${error.message}`);
        }
    }

    /**
     * グローバル4軸評価統計を計算
     * @param {Object} projectStats - プロジェクト統計
     * @returns {Object} グローバル統計
     */
    calculateGlobalFourAxisStatistics(projectStats) {
        const global = {
            totalEvaluated: 0,
            allAccuracyScores: [],
            totalDecisionSoundnessPass: 0,
            totalDirectionalConsistencyPass: 0,
            totalValidityPass: 0
        };

        Object.values(projectStats).forEach(stats => {
            global.totalEvaluated += stats.fourAxisStatistics.totalEvaluated;
            global.allAccuracyScores.push(...stats.fourAxisStatistics.accuracyScores);
            global.totalDecisionSoundnessPass += stats.fourAxisStatistics.decisionSoundnessPass;
            global.totalDirectionalConsistencyPass += stats.fourAxisStatistics.directionalConsistencyPass;
            global.totalValidityPass += stats.fourAxisStatistics.validityPass;
        });

        // 平均スコアを計算
        if (global.allAccuracyScores.length > 0) {
            const sum = global.allAccuracyScores.reduce((a, b) => a + b, 0);
            global.averageAccuracy = sum / global.allAccuracyScores.length;
            global.minAccuracy = Math.min(...global.allAccuracyScores);
            global.maxAccuracy = Math.max(...global.allAccuracyScores);
        }

        return global;
    }

    /**
     * 統計情報をファイルに保存
     * @param {string} sessionId - レポートセッションID
     * @returns {Promise<string>} 保存されたファイルパス
     */
    async saveEnhancedReport(sessionId) {
        try {
            const enhancedReport = await this.generateEnhancedReport(sessionId);
            
            const fileName = `enhanced_report_${sessionId}.json`;
            const filePath = path.join(this.outputDir, fileName);
            
            await fs.writeFile(filePath, JSON.stringify(enhancedReport, null, 2), 'utf-8');
            
            console.log(`✅ Enhanced report saved: ${fileName}`);
            return filePath;
        } catch (error) {
            throw new Error(`Failed to save enhanced report: ${error.message}`);
        }
    }
}

export default new PRStatisticsService();
