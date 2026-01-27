import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';

// ルーターのインポート
import logsRouter from './routes/logs.js';
import sessionsRouter from './routes/sessions.js';
import reportsRouter from './routes/reports.js';

// 環境変数の読み込み
dotenvConfig({ path: '/app/.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = '/app';

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア設定
app.use(cors());
app.use(express.json());

// 静的ファイルの提供
app.use('/static', express.static(path.join(projectRoot, 'output')));
// キャッシュ無効化ミドルウェア
app.use('/public', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});
app.use('/public', express.static(path.join(__dirname, 'public')));

// APIルート
app.use('/api/logs', logsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/reports', reportsRouter);

// ヘルスチェック
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ルートエンドポイント - HTMLビューワーを提供
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404エラーハンドリング
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`
    });
});

// エラーハンドリング
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`\n🚀 APR Evaluation API Server`);
    console.log(`═══════════════════════════════════════`);
    console.log(`📡 Server running at: http://localhost:${PORT}`);
    console.log(`🌐 Web Viewer: http://localhost:${PORT}`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📊 API Base: http://localhost:${PORT}/api`);
    console.log(`═══════════════════════════════════════\n`);
});

export default app;
