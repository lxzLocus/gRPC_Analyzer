import express from 'express';

const router = express.Router();

// セッション管理用のメモリストア（実際の運用ではRedisなどを使用）
const sessions = new Map();

/**
 * POST /api/sessions
 * 新しいセッションを作成（ユーザーの閲覧状態を保存）
 */
router.post('/', (req, res) => {
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const sessionData = {
        id: sessionId,
        createdAt: new Date().toISOString(),
        currentAPRSystem: null,
        currentSession: null,
        settings: req.body.settings || {}
    };
    
    sessions.set(sessionId, sessionData);
    
    res.json({
        success: true,
        session: sessionData
    });
});

/**
 * GET /api/sessions/:sessionId
 * セッション情報を取得
 */
router.get('/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Session not found'
        });
    }
    
    res.json({
        success: true,
        session
    });
});

/**
 * PUT /api/sessions/:sessionId
 * セッション情報を更新
 */
router.put('/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Session not found'
        });
    }
    
    // セッションデータを更新
    const updatedSession = {
        ...session,
        ...req.body,
        updatedAt: new Date().toISOString()
    };
    
    sessions.set(sessionId, updatedSession);
    
    res.json({
        success: true,
        session: updatedSession
    });
});

/**
 * DELETE /api/sessions/:sessionId
 * セッションを削除
 */
router.delete('/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const deleted = sessions.delete(sessionId);
    
    res.json({
        success: deleted,
        message: deleted ? 'Session deleted' : 'Session not found'
    });
});

export default router;
