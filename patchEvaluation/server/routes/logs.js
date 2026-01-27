import express from 'express';
import logService from '../services/LogService.js';

const router = express.Router();

/**
 * GET /api/logs/sessions
 * 利用可能なセッション（日付別）の一覧を取得
 */
router.get('/sessions', async (req, res) => {
    try {
        const sessions = await logService.getAvailableSessions();
        res.json({
            success: true,
            count: sessions.length,
            sessions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/logs/sessions/:sessionName/bugs
 * 特定セッション内のバグ/PR一覧を取得
 */
router.get('/sessions/:sessionName/bugs', async (req, res) => {
    try {
        const { sessionName } = req.params;
        const bugs = await logService.getBugsInSession(sessionName);
        
        res.json({
            success: true,
            sessionName,
            count: bugs.length,
            bugs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/logs/sessions/:sessionName/bugs/:bugId/evaluations
 * 特定バグの評価結果ファイル一覧を取得
 */
router.get('/sessions/:sessionName/bugs/:bugId/evaluations', async (req, res) => {
    try {
        const { sessionName, bugId } = req.params;
        const files = await logService.getEvaluationFilesForBug(sessionName, bugId);
        
        res.json({
            success: true,
            sessionName,
            bugId,
            count: files.length,
            evaluations: files
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/logs/sessions/:sessionName/bugs/:bugId/evaluations/:fileName
 * 特定評価結果ファイルの内容を取得
 */
router.get('/sessions/:sessionName/bugs/:bugId/evaluations/:fileName', async (req, res) => {
    try {
        const { sessionName, bugId, fileName } = req.params;
        const content = await logService.getEvaluationFileContent(sessionName, bugId, fileName);
        
        res.json({
            success: true,
            sessionName,
            bugId,
            fileName,
            data: content
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/logs/statistics
 * 統計情報を取得
 */
router.get('/statistics', async (req, res) => {
    try {
        const stats = await logService.getStatistics();
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
 * GET /api/logs/reports
 * 詳細分析レポート一覧を取得
 */
router.get('/reports', async (req, res) => {
    try {
        const reports = await logService.getDetailedAnalysisReports();
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
 * GET /api/logs/reports/:sessionId
 * 特定の詳細分析レポートを取得
 */
router.get('/reports/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const report = await logService.getDetailedAnalysisReport(sessionId);
        
        res.json({
            success: true,
            sessionId,
            data: report
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
