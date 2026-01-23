import express from 'express';
import reportService from '../services/ReportBasedLogService.js';
// ✅ 修正: patchEvaluation内のサービスを参照（親ディレクトリへの依存を削除）
import prStatisticsService from '../../src/Service/PRStatisticsService.js';

const router = express.Router();

/**
 * GET /api/reports
 * 利用可能な評価レポート一覧を取得
 */
router.get('/', async (req, res) => {
    try {
        const reports = await reportService.getAvailableReports();
        res.json({
            success: true,
            count: reports.length,
            reports
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/reports/:sessionId/statistics
 * 特定レポートの詳細統計を取得
 */
router.get('/:sessionId/statistics', async (req, res) => {
    try {
        const { sessionId } = req.params;
        console.log(`📊 Getting statistics for sessionId: ${sessionId}, Full URL: ${req.url}`);
        const stats = await reportService.getReportStatistics(sessionId);

        res.json({
            success: true,
            sessionId,
            statistics: stats
        });
    } catch (error) {
        console.error(`❌ Error getting statistics for ${req.params.sessionId}:`, error.message);
        console.error(`Stack: ${error.stack}`);
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/reports/:sessionId/prs
 * 特定レポート内のPR一覧を取得
 */
router.get('/:sessionId/prs', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const prs = await reportService.getPRsInReport(sessionId);

        res.json({
            success: true,
            sessionId,
            count: prs.length,
            prs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/reports/:sessionId/prs/:datasetEntry(*)/diffs
 * 特定PRのDiff情報を取得
 */
router.get('/:sessionId/prs/:datasetEntry(*)/diffs', async (req, res) => {
    try {
        const { sessionId, datasetEntry } = req.params;
        const contextLines = parseInt(req.query.context) || 5;
        const mode = req.query.mode || 'premerge-postmerge'; // デフォルトはpremerge-postmerge
        const decodedEntry = decodeURIComponent(datasetEntry);

        console.log(`[DIFF API] Request: context=${req.query.context} (parsed: ${contextLines}), mode=${mode}, entry=${decodedEntry}`);

        // APRパッチモードの場合、ログファイルからパッチを抽出
        if (mode === 'premerge-apr' || mode === 'postmerge-apr') {
            const aprLogPath = await reportService.findAPRLogPath(decodedEntry);
            if (!aprLogPath) {
                return res.status(404).json({
                    error: 'APR log not found',
                    message: `APR log file not found for ${decodedEntry}. APR patches may not be available yet.`,
                    available: false,
                    mode,
                    isAPRError: true
                });
            }

            const aprResult = await reportService.extractAPRPatches(aprLogPath, mode);
            if (!aprResult.success) {
                return res.status(404).json({
                    error: 'Failed to extract APR patches',
                    message: aprResult.error || 'Could not extract patches from APR log file. APR may not have generated patches for this PR.',
                    available: false,
                    mode,
                    isAPRError: true
                });
            }

            // Ground Truthから必要なファイルリストを取得
            // APRモードでもファイルリストを取得するためにpremerge-postmergeモードで呼び出す
            const diffInfo = await reportService.getPRDiffs(decodedEntry, 'premerge-postmerge');
            const groundTruthChangedFiles = diffInfo.changedFiles || [];

            // キャッシュを無効化
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');

            console.log('[DIFF API] APR mode - Ground Truth files:', groundTruthChangedFiles.length, ', APR modified:', aprResult.patches.length);

            res.json({
                available: true,
                mode,
                source: 'apr_log',
                aprLogPath,
                changedFiles: groundTruthChangedFiles,  // Ground Truthのファイルリスト
                diffs: aprResult.patches
            });
            return;
        }

        // Ground Truth比較モード（従来の処理）
        const diffInfo = await reportService.getPRDiffs(decodedEntry, mode);

        if (!diffInfo.available) {
            return res.status(404).json({
                error: 'Diff not available',
                message: diffInfo.message
            });
        }

        // モードに応じて比較対象ディレクトリを決定
        let dir1, dir2, label1, label2;
        if (mode === 'premerge-postmerge') {
            dir1 = diffInfo.premergeDir;
            dir2 = diffInfo.postmergeDir;
            label1 = 'premerge';
            label2 = 'postmerge';
        } else if (mode === 'premerge-apr') {
            dir1 = diffInfo.premergeDir;
            dir2 = diffInfo.aprDir;
            label1 = 'premerge';
            label2 = 'apr_patch';
        } else if (mode === 'postmerge-apr') {
            dir1 = diffInfo.postmergeDir;
            dir2 = diffInfo.aprDir;
            label1 = 'postmerge';
            label2 = 'apr_patch';
        } else {
            return res.status(400).json({
                error: 'Invalid comparison mode',
                message: 'Valid modes are: premerge-postmerge, premerge-apr, postmerge-apr'
            });
        }

        // 変更されたファイルのDiffを生成
        const diffs = [];
        console.log('[DIFF API] changedFiles:', diffInfo.changedFiles ? diffInfo.changedFiles.length : 0, 'files');
        if (diffInfo.changedFiles && diffInfo.changedFiles.length > 0) {
            for (const fileName of diffInfo.changedFiles) {
                try {
                    const diff = await reportService.generateFileDiff(
                        dir1,
                        dir2,
                        fileName,
                        contextLines,
                        mode  // モードを渡す
                    );
                    diffs.push({
                        fileName,
                        diff
                    });
                } catch (error) {
                    console.error(`Failed to generate diff for ${fileName}:`, error);
                }
            }
        }

        // キャッシュを無効化
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        console.log('[DIFF API] Sending response with changedFiles:', diffInfo.changedFiles ? diffInfo.changedFiles.length : 0, 'files');
        res.json({
            available: true,
            mode,
            dir1: label1,
            dir2: label2,
            changedFiles: diffInfo.changedFiles,
            diffs
        });
    } catch (error) {
        console.error('Failed to get PR diffs:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/reports/:sessionId/prs/:datasetEntry
 * 特定PRの評価結果詳細を取得、または/aprlogサフィックスでAPRログを取得
 * datasetEntryはエンコードされた形式で渡される（例: boulder%2Fpullrequest%2FAllow_WFEv1...）
 */
router.get('/:sessionId/prs/:datasetEntry(*)', async (req, res) => {
    try {
        const { sessionId, datasetEntry } = req.params;

        // /aprlog サフィックスをチェック
        if (datasetEntry.endsWith('/aprlog')) {
            const actualDatasetEntry = datasetEntry.slice(0, -7); // '/aprlog' を削除
            const aprLogData = await reportService.getAPRLog(sessionId, actualDatasetEntry);

            return res.json({
                success: true,
                sessionId,
                datasetEntry: actualDatasetEntry,
                data: aprLogData
            });
        }

        // 通常のPR詳細取得
        const detail = await reportService.getPREvaluationDetail(sessionId, datasetEntry);

        res.json({
            success: true,
            sessionId,
            datasetEntry,
            data: detail
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/reports/statistics
 * 統計情報を取得
 */
router.get('/statistics/summary', async (req, res) => {
    try {
        const stats = await reportService.getStatistics();
        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/reports/:sessionId/pr-statistics
 * 特定レポートのPRごとの統計を取得
 */
router.get('/:sessionId/pr-statistics', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const enhancedReport = await prStatisticsService.generateEnhancedReport(sessionId);

        res.json({
            success: true,
            sessionId,
            prStatistics: enhancedReport.prStatistics
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/reports/:sessionId/project-statistics
 * 特定レポートのプロジェクトごとの統計を取得
 */
router.get('/:sessionId/project-statistics', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const enhancedReport = await prStatisticsService.generateEnhancedReport(sessionId);

        res.json({
            success: true,
            sessionId,
            projectStatistics: enhancedReport.projectStatistics,
            enhancedSummary: enhancedReport.enhancedSummary
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/reports/:sessionId
 * 特定レポートの完全な内容を取得
 * 注意: このルートは最後に配置（他の具体的なルートが優先される）
 */
router.get('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const content = await reportService.getReportContent(sessionId);

        res.json({
            success: true,
            sessionId,
            data: content
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
