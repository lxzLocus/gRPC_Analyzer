import fs from 'fs/promises';
import path from 'path';
import * as Diff from 'diff';
import { APRLogService } from '../../src/Service/APRLogService.js';

const projectRoot = '/app';
const OUTPUT_DIR = path.join(projectRoot, 'output');

/**
 * レポートベースのログサービス
 * 構造: 評価レポート → PR別評価結果
 */
class ReportBasedLogService {
    /**
     * 利用可能な評価レポート一覧を取得
     */
    async getAvailableReports() {
        try {
            const files = await fs.readdir(OUTPUT_DIR);
            const reports = [];

            for (const file of files) {
                if (file.startsWith('detailed_analysis_report_') && file.endsWith('.json')) {
                    const filePath = path.join(OUTPUT_DIR, file);
                    const stats = await fs.stat(filePath);

                    // ファイル名からセッションIDを抽出
                    const match = file.match(/detailed_analysis_report_(\d+_\d+)\.json/);
                    const sessionId = match ? match[1] : null;

                    // レポートの内容を読み込んでPR数を取得
                    try {
                        const content = await fs.readFile(filePath, 'utf-8');
                        const data = JSON.parse(content);

                        // 最終カテゴリーレベルのPR数を合計（新形式: finalCategoryLevels）
                        const finalCategoryLevels = data.finalCategoryLevels || data.correctnessLevels;
                        const totalPRs =
                            (finalCategoryLevels?.CORRECT?.length || 0) +
                            (finalCategoryLevels?.PLAUSIBLE?.length || 0) +
                            (finalCategoryLevels?.INCORRECT?.length || 0) +
                            (finalCategoryLevels?.SKIPPED?.length || 0);

                        reports.push({
                            sessionId,
                            fileName: file,
                            timestamp: data.timestamp || sessionId,
                            modified: stats.mtime,
                            size: stats.size,
                            totalPRs,
                            finalCategoryBreakdown: {
                                CORRECT: finalCategoryLevels?.CORRECT?.length || 0,
                                PLAUSIBLE: finalCategoryLevels?.PLAUSIBLE?.length || 0,
                                INCORRECT: finalCategoryLevels?.INCORRECT?.length || 0,
                                SKIPPED: finalCategoryLevels?.SKIPPED?.length || 0
                            }
                        });
                    } catch (parseError) {
                        console.error(`Error parsing report ${file}:`, parseError.message);
                    }
                }
            }

            return reports.sort((a, b) => b.modified - a.modified);
        } catch (error) {
            console.error('❌ Error reading reports:', error);
            return [];
        }
    }

    /**
     * 特定レポート内のPR一覧を取得
     */
    async getPRsInReport(sessionId) {
        try {
            const fileName = `detailed_analysis_report_${sessionId}.json`;
            const filePath = path.join(OUTPUT_DIR, fileName);
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);

            const prs = [];

            // 最終カテゴリーレベルからPRを収集（新形式: finalCategoryLevels）
            const finalCategoryLevels = data.finalCategoryLevels || data.correctnessLevels;
            const categories = ['CORRECT', 'PLAUSIBLE', 'INCORRECT', 'SKIPPED'];

            for (const category of categories) {
                const entries = finalCategoryLevels?.[category] || [];

                entries.forEach(entry => {
                    prs.push({
                        prName: entry.pullRequestName || entry.datasetEntry,
                        projectName: entry.projectName,
                        datasetEntry: entry.datasetEntry,
                        finalCategory: entry.finalCategory || category.toUpperCase(),
                        status: entry.status,
                        modifiedFiles: entry.modifiedFiles,
                        modifiedLines: entry.modifiedLines,
                        aprProvider: entry.aprProvider,
                        aprModel: entry.aprModel,
                        // APRログの終了ステータス
                        aprStatus: entry.aprStatus,
                        // Intent Fulfillment評価情報も含める
                        intentFulfillmentEvaluation: entry.intentFulfillmentEvaluation,
                        // 4軸評価情報も含める（LLM_B評価）
                        fourAxisEvaluation: entry.fourAxisEvaluation
                    });
                });
            }

            return prs;
        } catch (error) {
            console.error(`❌ Error reading PRs in report ${sessionId}:`, error);
            return [];
        }
    }

    /**
     * 特定PRの評価結果詳細を取得
     */
    async getPREvaluationDetail(sessionId, datasetEntry) {
        try {
            const fileName = `detailed_analysis_report_${sessionId}.json`;
            const filePath = path.join(OUTPUT_DIR, fileName);
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);

            // 最終カテゴリーレベルからPRを検索（新形式: finalCategoryLevels）
            const finalCategoryLevels = data.finalCategoryLevels || data.correctnessLevels;
            const categories = ['CORRECT', 'PLAUSIBLE', 'INCORRECT', 'SKIPPED'];

            for (const category of categories) {
                const entries = finalCategoryLevels?.[category] || [];
                const entry = entries.find(e => e.datasetEntry === datasetEntry);

                if (entry) {
                    return entry;
                }
            }

            throw new Error(`PR ${datasetEntry} not found in report ${sessionId}`);
        } catch (error) {
            throw new Error(`Failed to read PR evaluation: ${error.message}`);
        }
    }

    /**
     * 統計情報を取得
     */
    async getStatistics() {
        try {
            const reports = await this.getAvailableReports();

            const stats = {
                totalReports: reports.length,
                totalPRs: 0,
                fourAxisEvaluation: {
                    totalEvaluated: 0,
                    accuracy: { scores: [], average: 0 },
                    decisionSoundness: { scores: [], average: 0 },
                    directionalConsistency: { scores: [], average: 0 },
                    validity: { scores: [], average: 0 }
                },
                finalCategoryBreakdown: {
                    CORRECT: 0,
                    PLAUSIBLE: 0,
                    INCORRECT: 0
                },
                latestReport: null
            };

            for (const report of reports) {
                stats.totalPRs += report.totalPRs;
                stats.finalCategoryBreakdown.CORRECT += report.finalCategoryBreakdown.CORRECT;
                stats.finalCategoryBreakdown.PLAUSIBLE += report.finalCategoryBreakdown.PLAUSIBLE;
                stats.finalCategoryBreakdown.INCORRECT += report.finalCategoryBreakdown.INCORRECT;
            }

            if (reports.length > 0) {
                stats.latestReport = reports[0];
            }

            return stats;
        } catch (error) {
            console.error('❌ Error getting statistics:', error);
            throw error;
        }
    }

    /**
     * 特定レポートの詳細統計を取得
     */
    async getReportStatistics(sessionId) {
        try {
            const fileName = `detailed_analysis_report_${sessionId}.json`;
            const filePath = path.join(OUTPUT_DIR, fileName);
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);

            const stats = {
                sessionId,
                timestamp: data.timestamp,
                // 最終カテゴリー分布（新形式: finalCategoryLevels）
                finalCategoryLevels: data.finalCategoryLevels || data.correctnessLevels,
                finalCategoryDistribution: {
                    CORRECT: (data.finalCategoryLevels?.CORRECT?.length || data.correctnessLevels?.identical?.length || 0),
                    PLAUSIBLE: (data.finalCategoryLevels?.PLAUSIBLE?.length || data.correctnessLevels?.plausibleButDifferent?.length || 0),
                    INCORRECT: (data.finalCategoryLevels?.INCORRECT?.length || data.correctnessLevels?.incorrect?.length || 0),
                    SKIPPED: (data.finalCategoryLevels?.SKIPPED?.length || data.correctnessLevels?.skipped?.length || 0)
                },
                totalPRs: 0,
                successRate: 0,
                aprProviders: {},
                aprModels: {},
                modificationStats: {
                    totalLines: 0,
                    averageLines: 0,
                    totalFiles: 0,
                    averageFiles: 0
                },
                evaluationStatus: {
                    evaluated: 0,
                    error: 0,
                    other: 0
                },
                skipBreakdown: {
                    aprSkip: 0,          // APR側でスキップ（修正なし）
                    llmSkip: 0,          // LLM評価側でスキップ
                    aprError: 0,         // APR側でエラー
                    llmEvaluationError: 0 // LLM評価側でエラー
                },
                fourAxisEvaluation: {
                    totalEvaluated: 0,
                    accuracy: { 
                        labelCounts: {}, 
                        goodRatio: 0, 
                        goodLabels: ['IDENTICAL', 'SEMANTICALLY_EQUIVALENT'] 
                    },
                    decisionSoundness: { 
                        labelCounts: {}, 
                        goodRatio: 0, 
                        goodLabels: ['SOUND'] 
                    },
                    directionalConsistency: { 
                        labelCounts: {}, 
                        goodRatio: 0, 
                        goodLabels: ['CONSISTENT'] 
                    },
                    validity: { 
                        labelCounts: {}, 
                        goodRatio: 0, 
                        goodLabels: ['VALID'] 
                    }
                },
                intentFulfillmentEvaluation: {
                    totalEvaluated: 0,
                    totalSkipped: 0,
                    totalError: 0,
                    // 4段階enumによる離散カテゴリカウント
                    levelCounts: {
                        INTENT_FULFILLED: 0,
                        INTENT_PARTIALLY_FULFILLED: 0,
                        INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED: 0,
                        INTENT_NOT_FULFILLED: 0
                    }
                },
                semanticSimilarity: {
                    scores: [],
                    average: 0,
                    min: 0,
                    max: 0
                },
                repairTypes: {},  // 修正タイプの統計
                aprStatusDistribution: {}  // APR終了ステータスの分布
            };

            // 全PRを収集して統計を計算（skippedも含む）
            const finalCategoryLevels = data.finalCategoryLevels || data.correctnessLevels;
            const categories = ['CORRECT', 'PLAUSIBLE', 'INCORRECT', 'SKIPPED'];
            const allPRs = [];

            for (const category of categories) {
                const entries = finalCategoryLevels?.[category] || [];
                allPRs.push(...entries);
            }

            stats.totalPRs = allPRs.length;
            
            // 実際に評価されたPR数（SKIPPED以外 = パッチが生成されたケース）
            const totalEvaluated = stats.finalCategoryDistribution.CORRECT + 
                                   stats.finalCategoryDistribution.PLAUSIBLE + 
                                   stats.finalCategoryDistribution.INCORRECT;
            stats.totalEvaluated = totalEvaluated;
            
            // パーセンテージは評価済みのみを母数とする
            stats.successRate = totalEvaluated > 0
                ? ((stats.finalCategoryDistribution.CORRECT) / totalEvaluated * 100).toFixed(1)
                : 0;

            // 安全性チェック：fourAxisEvaluationオブジェクトが存在することを確認
            if (!stats.fourAxisEvaluation) {
                stats.fourAxisEvaluation = {
                    totalEvaluated: 0,
                    accuracy: { 
                        labelCounts: {}, 
                        goodRatio: 0, 
                        goodLabels: ['IDENTICAL', 'SEMANTICALLY_EQUIVALENT'] 
                    },
                    decisionSoundness: { 
                        labelCounts: {}, 
                        goodRatio: 0, 
                        goodLabels: ['SOUND'] 
                    },
                    directionalConsistency: { 
                        labelCounts: {}, 
                        goodRatio: 0, 
                        goodLabels: ['CONSISTENT'] 
                    },
                    validity: { 
                        labelCounts: {}, 
                        goodRatio: 0, 
                        goodLabels: ['VALID'] 
                    }
                };
            }

            // 各PRの統計を収集
            allPRs.forEach(pr => {

                // APRプロバイダーとモデル
                if (pr.aprProvider) {
                    stats.aprProviders[pr.aprProvider] = (stats.aprProviders[pr.aprProvider] || 0) + 1;
                }
                if (pr.aprModel) {
                    stats.aprModels[pr.aprModel] = (stats.aprModels[pr.aprModel] || 0) + 1;
                }

                // 変更統計
                if (pr.modifiedLines != null) {
                    stats.modificationStats.totalLines += pr.modifiedLines;
                }
                if (pr.modifiedFiles != null) {
                    stats.modificationStats.totalFiles += pr.modifiedFiles;
                }

                // 評価ステータス
                if (pr.status === 'EVALUATED') {
                    stats.evaluationStatus.evaluated++;
                } else if (pr.status === 'ERROR') {
                    stats.evaluationStatus.error++;
                } else if (pr.status === 'SKIPPED') {
                    // スキップ元を区別
                    if (pr.skipSource === 'APR') {
                        stats.skipBreakdown.aprSkip++;
                    } else if (pr.skipSource === 'LLM_EVALUATION') {
                        stats.skipBreakdown.llmSkip++;
                    } else {
                        stats.evaluationStatus.other++;
                    }
                } else {
                    stats.evaluationStatus.other++;
                }

                // エラー元を区別
                if (pr.errorSource === 'APR') {
                    stats.skipBreakdown.aprError++;
                } else if (pr.errorSource === 'LLM_EVALUATION') {
                    stats.skipBreakdown.llmEvaluationError++;
                }

                // Intent Fulfillment評価の統計（離散カテゴリカウントのみ、スコアは使用しない）
                if (pr.intentFulfillmentEvaluation) {
                    const intentEval = pr.intentFulfillmentEvaluation;

                    // 評価完了ケース：labelに基づくカウント
                    // 構造が {status, data: {label, ...}} の場合と {label, ...} の場合に対応
                    const intentLabel = intentEval.data?.label || intentEval.label || intentEval.level;
                    if ((intentEval.status === 'evaluated' || intentLabel) && intentLabel) {
                        stats.intentFulfillmentEvaluation.totalEvaluated++;
                        
                        // 離散カテゴリごとのカウント（4段階enum）
                        if (stats.intentFulfillmentEvaluation.levelCounts[intentLabel] !== undefined) {
                            stats.intentFulfillmentEvaluation.levelCounts[intentLabel]++;
                        } else {
                            // 旧5段階形式から新4段階形式へのマッピング
                            const labelMapping = {
                                'FULLY_FULFILLED': 'INTENT_FULFILLED',
                                'SUBSTANTIALLY_FULFILLED': 'INTENT_FULFILLED',
                                'PARTIALLY_FULFILLED': 'INTENT_PARTIALLY_FULFILLED',
                                'MINIMALLY_FULFILLED': 'INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED',
                                'NOT_FULFILLED': 'INTENT_NOT_FULFILLED'
                            };
                            const mappedLabel = labelMapping[intentLabel];
                            if (mappedLabel && stats.intentFulfillmentEvaluation.levelCounts[mappedLabel] !== undefined) {
                                stats.intentFulfillmentEvaluation.levelCounts[mappedLabel]++;
                            }
                        }
                    } 
                    // スキップケース
                    else if (intentEval.status === 'skipped') {
                        stats.intentFulfillmentEvaluation.totalSkipped++;
                    } 
                    // エラーケース
                    else if (intentEval.status === 'error') {
                        stats.intentFulfillmentEvaluation.totalError++;
                    }
                }

                // 4軸評価（LLM_B）の統計
                if (pr.fourAxisEvaluation) {
                    const fourAxis = pr.fourAxisEvaluation;
                    stats.fourAxisEvaluation.totalEvaluated++;

                    // 安全性チェック：fourAxisEvaluationオブジェクトが正しく初期化されているか確認
                    if (!stats.fourAxisEvaluation.accuracy) {
                        stats.fourAxisEvaluation.accuracy = { 
                            labelCounts: {}, 
                            goodRatio: 0, 
                            goodLabels: ['IDENTICAL', 'SEMANTICALLY_EQUIVALENT'] 
                        };
                    }
                    if (!stats.fourAxisEvaluation.decisionSoundness) {
                        stats.fourAxisEvaluation.decisionSoundness = { 
                            labelCounts: {}, 
                            goodRatio: 0, 
                            goodLabels: ['SOUND'] 
                        };
                    }
                    if (!stats.fourAxisEvaluation.directionalConsistency) {
                        stats.fourAxisEvaluation.directionalConsistency = { 
                            labelCounts: {}, 
                            goodRatio: 0, 
                            goodLabels: ['CONSISTENT'] 
                        };
                    }
                    if (!stats.fourAxisEvaluation.validity) {
                        stats.fourAxisEvaluation.validity = { 
                            labelCounts: {}, 
                            goodRatio: 0, 
                            goodLabels: ['VALID'] 
                        };
                    }

                    // 各軸のラベルをカウント
                    if (fourAxis.accuracy?.label) {
                        const label = fourAxis.accuracy.label;
                        stats.fourAxisEvaluation.accuracy.labelCounts[label] = 
                            (stats.fourAxisEvaluation.accuracy.labelCounts[label] || 0) + 1;
                    }
                    if (fourAxis.decision_soundness?.label) {
                        const label = fourAxis.decision_soundness.label;
                        stats.fourAxisEvaluation.decisionSoundness.labelCounts[label] = 
                            (stats.fourAxisEvaluation.decisionSoundness.labelCounts[label] || 0) + 1;
                    }
                    if (fourAxis.directional_consistency?.label) {
                        const label = fourAxis.directional_consistency.label;
                        stats.fourAxisEvaluation.directionalConsistency.labelCounts[label] = 
                            (stats.fourAxisEvaluation.directionalConsistency.labelCounts[label] || 0) + 1;
                    }
                    if (fourAxis.validity?.label) {
                        const label = fourAxis.validity.label;
                        stats.fourAxisEvaluation.validity.labelCounts[label] = 
                            (stats.fourAxisEvaluation.validity.labelCounts[label] || 0) + 1;
                    }
                }

                // 修正タイプの統計
                if (pr.repairTypes && Array.isArray(pr.repairTypes)) {
                    pr.repairTypes.forEach(repairType => {
                        stats.repairTypes[repairType] = (stats.repairTypes[repairType] || 0) + 1;
                    });
                }

                // APRステータスの統計
                if (pr.aprStatus) {
                    stats.aprStatusDistribution[pr.aprStatus] = (stats.aprStatusDistribution[pr.aprStatus] || 0) + 1;
                }
            });

            // Intent Fulfillment評価：比率計算（連続スコアは使用しない）
            // 各レベルの件数を総評価数で割った比率のみを使用
            // averageScoreは計算しない（説明困難な統計的スコアを避けるため）

            // 4軸評価の「良いラベル」の割合を計算
            const calculateGoodRatio = (axisData) => {
                if (!axisData || !axisData.labelCounts || !axisData.goodLabels) return 0;
                
                const totalCount = Object.values(axisData.labelCounts).reduce((sum, count) => sum + count, 0);
                if (totalCount === 0) return 0;
                
                const goodCount = axisData.goodLabels.reduce((sum, label) => {
                    return sum + (axisData.labelCounts[label] || 0);
                }, 0);
                
                return ((goodCount / totalCount) * 100).toFixed(1);
            };

            stats.fourAxisEvaluation.accuracy.goodRatio = calculateGoodRatio(stats.fourAxisEvaluation.accuracy);
            stats.fourAxisEvaluation.decisionSoundness.goodRatio = calculateGoodRatio(stats.fourAxisEvaluation.decisionSoundness);
            stats.fourAxisEvaluation.directionalConsistency.goodRatio = calculateGoodRatio(stats.fourAxisEvaluation.directionalConsistency);
            stats.fourAxisEvaluation.validity.goodRatio = calculateGoodRatio(stats.fourAxisEvaluation.validity);

            // 意味的類似度の統計計算（安全性チェック追加）
            if (stats.semanticSimilarity && stats.semanticSimilarity.scores && stats.semanticSimilarity.scores.length > 0) {
                const scores = stats.semanticSimilarity.scores;
                stats.semanticSimilarity.average = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3);
                stats.semanticSimilarity.min = Math.min(...scores).toFixed(3);
                stats.semanticSimilarity.max = Math.max(...scores).toFixed(3);
            }

            // 変更統計の平均
            if (stats.totalPRs > 0) {
                stats.modificationStats.averageLines = (stats.modificationStats.totalLines / stats.totalPRs).toFixed(1);
                stats.modificationStats.averageFiles = (stats.modificationStats.totalFiles / stats.totalPRs).toFixed(1);
            }

            return stats;
        } catch (error) {
            console.error(`❌ Error in getReportStatistics for ${sessionId}:`, error);
            console.error(`Error details: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
            throw new Error(`Failed to get report statistics: ${error.message}`);
        }
    }

    /**
     * レポートファイルの内容全体を取得
     */
    async getReportContent(sessionId) {
        try {
            const fileName = `detailed_analysis_report_${sessionId}.json`;
            const filePath = path.join(OUTPUT_DIR, fileName);
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to read report: ${error.message}`);
        }
    }

    /**
     * APRログファイルのパスを取得
     * @param {string} datasetEntry - 例: "boulder/pullrequest/Allow_WFEv1_to_specify_which_issuer_to_use"
     * @returns {string|null} - APRログファイルのパス、見つからない場合はnull
     */
    async findAPRLogPath(datasetEntry) {
        try {
            const aprLogDir = path.join(projectRoot, 'apr-logs', datasetEntry);

            // ディレクトリの存在確認
            try {
                await fs.access(aprLogDir);
            } catch (e) {
                console.warn(`APR log directory not found: ${aprLogDir}`);
                return null;
            }

            // ログファイル一覧を取得（最新のものを使用）
            const files = await fs.readdir(aprLogDir);
            const logFiles = files.filter(f => f.endsWith('.log')).sort().reverse();

            if (logFiles.length === 0) {
                console.warn(`No log files found in ${aprLogDir}`);
                return null;
            }

            // 最新のログファイルを返す
            return path.join(aprLogDir, logFiles[0]);
        } catch (error) {
            console.error(`Error finding APR log path for ${datasetEntry}:`, error);
            return null;
        }
    }

    /**
     * APRログファイルからパッチを抽出
     * @param {string} aprLogPath - APRログファイルのパス
     * @param {string} mode - 比較モード
     * @returns {Object} { success: boolean, patches: [{fileName, diff}] }
     */
    async extractAPRPatches(aprLogPath, mode = 'premerge-apr') {
        try {
            const logContent = await fs.readFile(aprLogPath, 'utf-8');

            // JSONログからmodified_diffフィールドを抽出
            // より堅牢な正規表現を使用（エスケープされた引用符を考慮）
            const modifiedDiffRegex = /"modified_diff":\s*"((?:[^"\\]|\\.)*)"/g;
            const patches = [];
            let match;

            while ((match = modifiedDiffRegex.exec(logContent)) !== null) {
                // エスケープされたJSON文字列をアンエスケープ
                let diffContent = match[1];

                // JSON文字列のエスケープを解除
                try {
                    // JSON.parseを使用してエスケープを正しく処理
                    diffContent = JSON.parse('"' + diffContent + '"');
                } catch (e) {
                    console.warn('Failed to parse diff content, using manual unescape');
                    // フォールバック: 手動でエスケープ解除
                    diffContent = diffContent
                        .replace(/\\n/g, '\n')
                        .replace(/\\t/g, '\t')
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\');
                }

                // ```diff マーカーを削除
                diffContent = diffContent
                    .replace(/```diff\n?/g, '')
                    .replace(/```\n?$/gm, '')
                    .replace(/```$/g, '')
                    .trim();

                // 各ファイルごとにdiffを分割（モードを渡す）
                const fileDiffs = this._splitDiffByFile(diffContent, mode);
                patches.push(...fileDiffs);
            }

            if (patches.length === 0) {
                return {
                    success: false,
                    patches: [],
                    error: 'No patches found in APR log file'
                };
            }

            return {
                success: true,
                patches
            };
        } catch (error) {
            console.error(`Failed to extract APR patches from ${aprLogPath}:`, error);
            return {
                success: false,
                patches: [],
                error: error.message
            };
        }
    }

    /**
     * diff文字列をファイルごとに分割
     * @param {string} diffContent - 複数ファイルを含むdiff文字列
     * @param {string} mode - 比較モード
     * @returns {Array} [{fileName, diff}]
     */
    _splitDiffByFile(diffContent, mode = 'premerge-apr') {
        const files = [];
        const lines = diffContent.split('\n');
        let currentFile = null;
        let currentDiff = [];

        for (const line of lines) {
            // ファイル名の検出: --- a/path/to/file.ext または --- path/to/file.ext
            const fileMatch = line.match(/^---\s+(?:a\/)?(.+)$/);
            if (fileMatch) {
                // 前のファイルを保存
                if (currentFile && currentDiff.length > 0) {
                    const normalizedDiff = this._normalizeAPRDiff(currentFile, currentDiff.join('\n'), mode);
                    files.push({
                        fileName: currentFile,
                        diff: normalizedDiff
                    });
                }
                // 新しいファイル開始
                currentFile = fileMatch[1].trim();
                currentDiff = [line];
            } else if (currentFile) {
                currentDiff.push(line);
            }
        }

        // 最後のファイルを保存
        if (currentFile && currentDiff.length > 0) {
            const normalizedDiff = this._normalizeAPRDiff(currentFile, currentDiff.join('\n'), mode);
            files.push({
                fileName: currentFile,
                diff: normalizedDiff
            });
        }

        return files;
    }

    /**
     * APRが生成したdiffを標準的なUnified Diff形式に正規化
     * @param {string} fileName - ファイル名
     * @param {string} diff - 元のdiff文字列
     * @param {string} mode - 比較モード（ラベル追加用）
     * @returns {string} 正規化されたdiff
     */
    _normalizeAPRDiff(fileName, diff, mode = 'premerge-apr') {
        const lines = diff.split('\n');
        const normalized = [];
        let lineNum = 1;
        let oldLineNum = 1;
        let newLineNum = 1;

        // モードに応じたラベルを決定
        let leftLabel = 'premerge';
        let rightLabel = 'APR patch';
        if (mode === 'postmerge-apr') {
            leftLabel = 'postmerge (Ground Truth)';
            rightLabel = 'APR patch';
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // ファイルヘッダーをa/とb/プレフィックス付きに正規化（ラベル追加）
            if (line.startsWith('---')) {
                if (!line.includes('a/')) {
                    normalized.push(`--- a/${fileName}\t(${leftLabel})`);
                } else {
                    normalized.push(`${line}\t(${leftLabel})`);
                }
                continue;
            }
            if (line.startsWith('+++')) {
                if (!line.includes('b/')) {
                    normalized.push(`+++ b/${fileName}\t(${rightLabel})`);
                } else {
                    normalized.push(`${line}\t(${rightLabel})`);
                }
                continue;
            }

            // ハンクヘッダーの検出と正規化
            if (line.startsWith('@@')) {
                // 既に正しい形式かチェック
                if (/^@@\s+-\d+,\d+\s+\+\d+,\d+\s+@@/.test(line)) {
                    normalized.push(line);
                    // 行番号を解析
                    const match = line.match(/^@@\s+-(\d+),(\d+)\s+\+(\d+),(\d+)\s+@@/);
                    if (match) {
                        oldLineNum = parseInt(match[1]);
                        newLineNum = parseInt(match[3]);
                    }
                } else {
                    // 不完全なハンクヘッダーを修正
                    // @@ context @@の形式を@@ -line,count +line,count @@に変換
                    // コンテキスト部分は次の行として追加
                    const contextMatch = line.match(/^@@\s+(.*)$/);
                    const context = contextMatch ? contextMatch[1].trim() : '';

                    // 次の行から変更行数を推測
                    let oldCount = 3;
                    let newCount = 3;
                    for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
                        const nextLine = lines[j];
                        if (nextLine.startsWith('@@')) break;
                        if (nextLine.startsWith('-')) oldCount++;
                        else if (nextLine.startsWith('+')) newCount++;
                        else if (nextLine.trim() !== '') {
                            oldCount++;
                            newCount++;
                        }
                    }

                    // ハンクヘッダーのみを追加
                    normalized.push(`@@ -${oldLineNum},${oldCount} +${newLineNum},${newCount} @@`);

                    // コンテキストがあれば、それをコンテキスト行として追加
                    if (context) {
                        normalized.push(` ${context}`);
                    }
                }
                continue;
            }

            // 通常の行
            normalized.push(line);

            // 行番号を追跡
            if (line.startsWith('-')) {
                oldLineNum++;
            } else if (line.startsWith('+')) {
                newLineNum++;
            } else if (line.startsWith(' ') || (!line.startsWith('---') && !line.startsWith('+++'))) {
                oldLineNum++;
                newLineNum++;
            }
        }

        return normalized.join('\n');
    }

    /**
     * PRのDiff情報を取得
     * @param {string} datasetEntry - 例: "boulder/pullrequest/Allow_WFEv1_to_specify_which_issuer_to_use"
     * @param {string} mode - 比較モード: 'premerge-postmerge', 'premerge-apr', 'postmerge-apr'
     */
    async getPRDiffs(datasetEntry, mode = 'premerge-postmerge') {
        try {
            // データセットパスを構築（複数のデータセットを確認）
            const possiblePaths = [
                path.join(projectRoot, 'dataset', 'filtered_fewChanged', datasetEntry),
                path.join(projectRoot, 'dataset', 'filtered_confirmed', datasetEntry),
                path.join(projectRoot, 'dataset', 'filtered_commit', datasetEntry),
                path.join(projectRoot, 'dataset', 'filtered_protoChanged', datasetEntry)
            ];

            let datasetPath = null;
            for (const p of possiblePaths) {
                try {
                    await fs.access(p);
                    datasetPath = p;
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (!datasetPath) {
                throw new Error(`Dataset entry not found: ${datasetEntry}`);
            }

            // premergeとmerge/commit_snapshotディレクトリを探す
            const entries = await fs.readdir(datasetPath, { withFileTypes: true });

            let premergeDir = null;
            let postmergeDir = null;
            let aprDir = null;

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    if (entry.name.startsWith('premerge')) {
                        premergeDir = path.join(datasetPath, entry.name);
                    } else if (entry.name.startsWith('merge') || entry.name.startsWith('commit_snapshot')) {
                        postmergeDir = path.join(datasetPath, entry.name);
                    } else if (entry.name.startsWith('apr_patch') || entry.name.startsWith('apr_output')) {
                        aprDir = path.join(datasetPath, entry.name);
                    }
                }
            }

            // モードに応じて必要なディレクトリを確認
            if (mode === 'premerge-postmerge' && (!premergeDir || !postmergeDir)) {
                return {
                    available: false,
                    message: 'Premerge or postmerge directory not found'
                };
            } else if (mode === 'premerge-apr' && (!premergeDir || !aprDir)) {
                return {
                    available: false,
                    message: 'Premerge or APR patch directory not found (APR patches may not be available yet)'
                };
            } else if (mode === 'postmerge-apr' && (!postmergeDir || !aprDir)) {
                return {
                    available: false,
                    message: 'Postmerge or APR patch directory not found'
                };
            }

            // 変更ファイルリストを取得
            const fileChangesPath = path.join(datasetPath, '03_fileChanges.txt');
            let changedFiles = [];

            try {
                const fileChangesContent = await fs.readFile(fileChangesPath, 'utf-8');
                // JSON形式でパース
                try {
                    changedFiles = JSON.parse(fileChangesContent);
                } catch (jsonError) {
                    // JSON形式でない場合は行ごとに分割
                    changedFiles = fileChangesContent.split('\n')
                        .filter(line => line.trim() && !line.trim().startsWith('[') && !line.trim().startsWith(']'))
                        .map(line => line.trim().replace(/^"|",$|",$/g, ''));
                }
            } catch (e) {
                // ファイルがない場合は全ファイルを比較
                console.warn('fileChanges.txt not found, will compare all files');
            }

            return {
                available: true,
                premergeDir,
                postmergeDir,
                aprDir,
                changedFiles,
                datasetPath,
                mode
            };
        } catch (error) {
            throw new Error(`Failed to get PR diffs: ${error.message}`);
        }
    }

    /**
     * 特定ファイルのDiffを生成
     * @param {string} dir1 - 比較元ディレクトリ
     * @param {string} dir2 - 比較先ディレクトリ
     * @param {string} fileName - ファイル名
     * @param {number} contextLines - コンテキスト行数
     * @param {string} mode - 比較モード
     */
    async generateFileDiff(dir1, dir2, fileName, contextLines = 5, mode = 'premerge-postmerge') {
        console.log(`[generateFileDiff] fileName=${fileName}, contextLines=${contextLines}, mode=${mode}`);
        try {
            const file1Path = path.join(dir1, fileName);
            const file2Path = path.join(dir2, fileName);

            let content1 = '';
            let content2 = '';

            try {
                content1 = await fs.readFile(file1Path, 'utf-8');
            } catch (e) {
                content1 = ''; // ファイルが存在しない場合
            }

            try {
                content2 = await fs.readFile(file2Path, 'utf-8');
            } catch (e) {
                content2 = ''; // ファイルが存在しない場合
            }

            // unified diff形式を生成（モードを渡す）
            const result = this._createUnifiedDiff(content1, content2, fileName, contextLines, mode);
            console.log(`[generateFileDiff] Generated diff length: ${result.length} chars`);
            return result;
        } catch (error) {
            throw new Error(`Failed to generate diff for ${fileName}: ${error.message}`);
        }
    }

    /**
     * Unified diff形式を生成（diffライブラリ使用）
     * @param {string} oldContent - 古いコンテンツ
     * @param {string} newContent - 新しいコンテンツ
     * @param {string} fileName - ファイル名
     * @param {number} contextLines - コンテキスト行数
     * @param {string} mode - 比較モード
     */
    _createUnifiedDiff(oldContent, newContent, fileName, contextLines = 5, mode = 'premerge-postmerge') {
        // モードに応じたラベルを決定
        let oldLabel = 'premerge';
        let newLabel = 'postmerge (Ground Truth)';

        if (mode === 'premerge-apr') {
            oldLabel = 'premerge';
            newLabel = 'APR patch';
        } else if (mode === 'postmerge-apr') {
            oldLabel = 'postmerge (Ground Truth)';
            newLabel = 'APR patch';
        }

        const patch = Diff.createPatch(
            fileName,
            oldContent,
            newContent,
            oldLabel,
            newLabel,
            { context: contextLines }
        );
        return patch;
    }

    /**
     * APRログデータを取得
     * @param {string} sessionId - セッションID
     * @param {string} datasetEntry - データセットエントリ
     * @returns {Promise<Object>} APRログデータ
     */
    async getAPRLog(sessionId, datasetEntry) {
        try {
            console.log('[getAPRLog] sessionId:', sessionId, 'datasetEntry:', datasetEntry);
            
            // APRログのパスを検索
            const aprLogPath = await this.findAPRLogPath(datasetEntry);
            
            if (!aprLogPath) {
                throw new Error(`APR log not found for ${datasetEntry}`);
            }
            
            console.log('[getAPRLog] Found APR log at:', aprLogPath);
            
            // APRLogServiceをインスタンス化してログデータを取得
            const aprLogService = new APRLogService();
            const aprLogData = await aprLogService.getAPRLogData(aprLogPath);
            
            return {
                logPath: aprLogPath,
                fileName: path.basename(aprLogPath),
                ...aprLogData
            };
        } catch (error) {
            console.error('[getAPRLog] Error:', error.message);
            throw new Error(`Failed to get APR log: ${error.message}`);
        }
    }

    /**
     * APRログファイルのパスを検索
     * @param {string} datasetEntry - データセットエントリ
     * @returns {Promise<string|null>} ログファイルパス
     */
    async findAPRLogPath(datasetEntry) {
        const APR_LOGS_DIR = path.join(projectRoot, 'apr-logs');
        
        // datasetEntryから抽出: "boulder/pullrequest/publisher-_remove_storeSCT_from_proto"
        // 実際のディレクトリ構造: /app/apr-logs/boulder/pullrequest/publisher-_remove_storeSCT_from_proto/
        const prLogDir = path.join(APR_LOGS_DIR, datasetEntry);
        
        console.log('[findAPRLogPath] Searching in:', prLogDir);
        
        try {
            const files = await fs.readdir(prLogDir);
            
            // ログファイルを検索（タイムスタンプ付きのファイル名）
            // 例: 2026-01-22_16-46-22_JST.log
            const logFiles = files.filter(f => f.endsWith('.log'));
            
            console.log('[findAPRLogPath] Found log files:', logFiles);
            
            // 最新のログファイルを返す（タイムスタンプでソート）
            if (logFiles.length > 0) {
                logFiles.sort().reverse();
                const logPath = path.join(prLogDir, logFiles[0]);
                console.log('[findAPRLogPath] Selected log:', logPath);
                return logPath;
            }
            
            console.log('[findAPRLogPath] No log files found');
            return null;
        } catch (error) {
            console.error(`[findAPRLogPath] Error reading ${prLogDir}:`, error.message);
            return null;
        }
    }
}

export default new ReportBasedLogService();
