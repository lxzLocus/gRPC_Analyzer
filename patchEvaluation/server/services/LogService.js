import fs from 'fs/promises';
import path from 'path';

const projectRoot = '/app';
const APR_LOGS_DIR = path.join(projectRoot, 'apr-logs');
const OUTPUT_DIR = path.join(projectRoot, 'output');

/**
 * ログサービス - APRログファイルの管理
 * 新構造: apr-logs/session_YYMMDD_HHMMSS/bug_id/evaluation_result.json
 */
class LogService {
    /**
     * 利用可能なセッション（日付別）の一覧を取得
     */
    async getAvailableSessions() {
        try {
            const entries = await fs.readdir(APR_LOGS_DIR, { withFileTypes: true });
            const sessions = [];
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const sessionPath = path.join(APR_LOGS_DIR, entry.name);
                    const stats = await fs.stat(sessionPath);
                    
                    // セッション内のバグ数をカウント
                    const bugs = await fs.readdir(sessionPath, { withFileTypes: true });
                    const bugCount = bugs.filter(b => b.isDirectory()).length;
                    
                    sessions.push({
                        name: entry.name,
                        timestamp: stats.mtime,
                        bugCount,
                        path: entry.name
                    });
                }
            }
            
            return sessions.sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.error('❌ Error reading sessions:', error);
            return [];
        }
    }

    /**
     * 特定セッション内のバグ/PR一覧を取得
     */
    async getBugsInSession(sessionName) {
        try {
            const sessionDir = path.join(APR_LOGS_DIR, sessionName);
            const entries = await fs.readdir(sessionDir, { withFileTypes: true });
            
            const bugs = [];
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const bugPath = path.join(sessionDir, entry.name);
                    const stats = await fs.stat(bugPath);
                    
                    // バグディレクトリ内の評価結果ファイル数をカウント
                    const files = await fs.readdir(bugPath);
                    const jsonFiles = files.filter(f => f.endsWith('.json'));
                    
                    bugs.push({
                        bugId: entry.name,
                        timestamp: stats.mtime,
                        fileCount: files.length,
                        evaluationCount: jsonFiles.length,
                        path: `${sessionName}/${entry.name}`
                    });
                }
            }
            
            return bugs.sort((a, b) => a.bugId.localeCompare(b.bugId));
        } catch (error) {
            console.error(`❌ Error reading bugs in session ${sessionName}:`, error);
            return [];
        }
    }

    /**
     * 特定バグの評価結果ファイル一覧を取得
     */
    async getEvaluationFilesForBug(sessionName, bugId) {
        try {
            const bugDir = path.join(APR_LOGS_DIR, sessionName, bugId);
            const files = await fs.readdir(bugDir);
            
            const evaluationFiles = [];
            for (const file of files) {
                const filePath = path.join(bugDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isFile()) {
                    // ファイル名からAPRツール名を抽出
                    const aprTool = file.replace('.json', '').replace('_evaluation', '');
                    
                    evaluationFiles.push({
                        name: file,
                        aprTool,
                        size: stats.size,
                        modified: stats.mtime,
                        type: this._getFileType(file),
                        path: `${sessionName}/${bugId}/${file}`
                    });
                }
            }
            
            return evaluationFiles.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error(`❌ Error reading evaluation files:`, error);
            return [];
        }
    }

    /**
     * 特定の評価結果ファイルの内容を取得
     */
    async getEvaluationFileContent(sessionName, bugId, fileName) {
        try {
            const filePath = path.join(APR_LOGS_DIR, sessionName, bugId, fileName);
            const content = await fs.readFile(filePath, 'utf-8');
            
            // JSONファイルの場合はパース
            if (fileName.endsWith('.json')) {
                try {
                    return JSON.parse(content);
                } catch (e) {
                    return { raw: content, parseError: e.message };
                }
            }
            
            return { content };
        } catch (error) {
            throw new Error(`Failed to read evaluation file: ${error.message}`);
        }
    }

    /**
     * 詳細分析レポート一覧を取得
     */
    async getDetailedAnalysisReports() {
        try {
            const files = await fs.readdir(OUTPUT_DIR);
            const reports = [];
            
            for (const file of files) {
                if (file.startsWith('detailed_analysis_report_') && 
                    (file.endsWith('.json') || file.endsWith('.html'))) {
                    const filePath = path.join(OUTPUT_DIR, file);
                    const stats = await fs.stat(filePath);
                    
                    // ファイル名からセッションIDを抽出
                    const match = file.match(/detailed_analysis_report_(\d+_\d+)/);
                    const sessionId = match ? match[1] : null;
                    
                    reports.push({
                        name: file,
                        sessionId,
                        size: stats.size,
                        modified: stats.mtime,
                        type: file.endsWith('.json') ? 'json' : 'html',
                        url: `/static/${file}`
                    });
                }
            }
            
            return reports.sort((a, b) => b.modified - a.modified);
        } catch (error) {
            console.error('❌ Error reading detailed analysis reports:', error);
            return [];
        }
    }

    /**
     * 特定の詳細分析レポート（JSON）を取得
     */
    async getDetailedAnalysisReport(sessionId) {
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
     * ファイルタイプを判定
     */
    _getFileType(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        const typeMap = {
            '.json': 'json',
            '.html': 'html',
            '.txt': 'text',
            '.log': 'log',
            '.md': 'markdown'
        };
        return typeMap[ext] || 'unknown';
    }

    /**
     * 統計情報を取得
     */
    async getStatistics() {
        try {
            const sessions = await this.getAvailableSessions();
            const stats = {
                totalSessions: sessions.length,
                totalBugs: 0,
                totalEvaluations: 0,
                sessions: {}
            };

            for (const session of sessions) {
                const bugs = await this.getBugsInSession(session.name);
                let totalEvaluations = 0;

                for (const bug of bugs) {
                    totalEvaluations += bug.evaluationCount;
                }

                stats.totalBugs += bugs.length;
                stats.totalEvaluations += totalEvaluations;
                
                stats.sessions[session.name] = {
                    bugCount: bugs.length,
                    totalEvaluations,
                    timestamp: session.timestamp
                };
            }

            const reports = await this.getDetailedAnalysisReports();
            stats.detailedReports = {
                total: reports.length,
                latestSessionId: reports[0]?.sessionId
            };

            return stats;
        } catch (error) {
            console.error('❌ Error getting statistics:', error);
            throw error;
        }
    }
}

export default new LogService();
