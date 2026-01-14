// API Base URL
const API_BASE = '/api';

// 状態管理
const state = {
    currentReport: null,
    currentPR: null,
    statistics: null,
    currentDiffData: null  // 現在表示中のdiffデータを保持
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    try {
        await loadStatistics();
        await loadReports();
    } catch (error) {
        console.error('❌ Initialization error:', error);
        showError('初期化エラーが発生しました: ' + error.message);
    }
}

// 統計情報の読み込み
async function loadStatistics() {
    try {
        // 統計情報はレポート一覧から計算するため、ここではスキップ
        // updateStatsBarはloadReportsで呼び出す
    } catch (error) {
        console.error('❌ Statistics loading error:', error);
    }
}

// 統計バーの更新
function updateStatsBar(stats) {
    document.getElementById('statReports').textContent = stats.totalReports;
    document.getElementById('statPRs').textContent = stats.totalPRs;
    const correct = stats.correctnessBreakdown.identical + stats.correctnessBreakdown.semanticallyEquivalent;
    document.getElementById('statCorrect').textContent = correct;
}

// レポート一覧の読み込み
async function loadReports() {
    try {
        const response = await fetch(`${API_BASE}/reports`);
        const data = await response.json();
        
        if (data.success) {
            renderReports(data.reports);
            // レポートデータから統計を計算
            calculateAndUpdateStats(data.reports);
        }
    } catch (error) {
        console.error('❌ Reports loading error:', error);
        showError('レポートの読み込みに失敗しました');
    }
}

// レポートから統計を計算
function calculateAndUpdateStats(reports) {
    const stats = {
        totalReports: reports.length,
        totalPRs: 0,
        correctnessBreakdown: {
            identical: 0,
            semanticallyEquivalent: 0,
            plausibleButDifferent: 0,
            incorrect: 0
        }
    };
    
    reports.forEach(report => {
        stats.totalPRs += report.totalPRs || 0;
        if (report.correctnessBreakdown) {
            stats.correctnessBreakdown.identical += report.correctnessBreakdown.identical || 0;
            stats.correctnessBreakdown.semanticallyEquivalent += report.correctnessBreakdown.semanticallyEquivalent || 0;
            stats.correctnessBreakdown.plausibleButDifferent += report.correctnessBreakdown.plausibleButDifferent || 0;
            stats.correctnessBreakdown.incorrect += report.correctnessBreakdown.incorrect || 0;
        }
    });
    
    updateStatsBar(stats);
}

// レポートリストの描画
function renderReports(reports) {
    const listEl = document.getElementById('reportList');
    
    if (reports.length === 0) {
        listEl.innerHTML = '<li class="loading">レポートが見つかりません</li>';
        return;
    }
    
    listEl.innerHTML = reports.map(report => {
        const date = new Date(report.modified).toLocaleString('ja-JP');
        return `
            <li class="report-item" data-session-id="${report.sessionId}" onclick="selectReport('${report.sessionId}')">
                <div class="report-name">📄 ${report.sessionId}</div>
                <div class="report-info">${date}</div>
                <div class="report-stats">
                    <span class="stat-badge">📊 ${report.totalPRs} PR</span>
                    <span class="stat-badge">✅ ${report.correctnessBreakdown.identical}</span>
                    <span class="stat-badge">⚠️ ${report.correctnessBreakdown.plausibleButDifferent}</span>
                </div>
            </li>
        `;
    }).join('');
}

// レポートの選択
async function selectReport(sessionId) {
    state.currentReport = sessionId;
    state.currentPR = null;
    
    // アクティブ状態の更新
    document.querySelectorAll('.report-item').forEach(item => {
        item.classList.remove('active');
        // data属性でマッチする要素を探す
        if (item.dataset.sessionId === sessionId) {
            item.classList.add('active');
        }
    });
    
    // パンくずリストの更新
    updateBreadcrumb([
        { label: 'ホーム', action: () => resetView() },
        { label: sessionId, action: null }
    ]);
    
    // 統計情報を表示
    await loadReportStatistics(sessionId);
}

// レポート統計の読み込み
async function loadReportStatistics(sessionId) {
    const contentTitle = document.getElementById('contentTitle');
    const contentBody = document.getElementById('contentBody');
    
    contentTitle.textContent = `${sessionId} - 評価レポート統計`;
    contentBody.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch(`${API_BASE}/reports/${sessionId}/statistics`);
        const data = await response.json();
        
        if (data.success) {
            renderReportStatistics(data.statistics);
        }
    } catch (error) {
        console.error('❌ Report statistics loading error:', error);
        showError('統計情報の読み込みに失敗しました');
    }
}

// レポート統計の描画
function renderReportStatistics(stats) {
    const contentBody = document.getElementById('contentBody');
    
    const total = stats.totalPRs;
    const correctness = stats.correctnessDistribution;
    
    contentBody.innerHTML = `
        <div style="margin-bottom: 20px;">
            <button class="btn" onclick="loadPRs('${state.currentReport}')">
                📄 PR/Issue一覧を表示
            </button>
        </div>

        <div class="stats-overview">
            <div class="stat-card">
                <h3>📊 総PR/Issue数</h3>
                <div class="big-value">${total}</div>
                <div class="sub-value">LLM評価完了: ${stats.evaluationStatus.evaluated}</div>
                <div class="sub-value">スキップ: ${stats.correctnessDistribution.skipped || 0}</div>
            </div>
            
            <div class="stat-card">
                <h3>✅ 修正あり成功率</h3>
                <div class="big-value">${stats.successRate}%</div>
                <div class="sub-value">完全一致 + 意味的等価</div>
                <div class="sub-value" style="font-size: 0.8em; color: #6c757d;">※修正ありケースのみ</div>
            </div>
            
            <div class="stat-card">
                <h3>📊 平均変更行数</h3>
                <div class="big-value">${stats.modificationStats.averageLines}</div>
                <div class="sub-value">総計: ${stats.modificationStats.totalLines} 行</div>
            </div>
            
            <div class="stat-card">
                <h3>📊 平均類似度</h3>
                <div class="big-value">${stats.semanticSimilarity.average || 'N/A'}</div>
                <div class="sub-value">
                    Min: ${stats.semanticSimilarity.min || 'N/A'} | 
                    Max: ${stats.semanticSimilarity.max || 'N/A'}
                </div>
            </div>
        </div>

        <div class="stat-card" style="margin-bottom: 20px;">
            <h3>🎯 正確性レベル分布</h3>
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>✅ 完全一致</span>
                    <span><strong>${correctness.identical}</strong> (${(correctness.identical/total*100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-identical" style="width: ${correctness.identical/total*100}%"></div>
                </div>
            </div>
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>✅ 意味的等価</span>
                    <span><strong>${correctness.semanticallyEquivalent}</strong> (${(correctness.semanticallyEquivalent/total*100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-equivalent" style="width: ${correctness.semanticallyEquivalent/total*100}%"></div>
                </div>
            </div>
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>⚠️ 妥当だが異なる</span>
                    <span><strong>${correctness.plausibleButDifferent}</strong> (${(correctness.plausibleButDifferent/total*100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-plausible" style="width: ${correctness.plausibleButDifferent/total*100}%"></div>
                </div>
            </div>
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>❌ 不正解</span>
                    <span><strong>${correctness.incorrect}</strong> (${(correctness.incorrect/total*100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-incorrect" style="width: ${correctness.incorrect/total*100}%"></div>
                </div>
            </div>
            
            ${correctness.skipped > 0 ? `
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>⏭️ スキップ/エラー</span>
                    <span><strong>${correctness.skipped}</strong> (${(correctness.skipped/total*100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill" style="width: ${correctness.skipped/total*100}%; background: #6c757d;"></div>
                </div>
            </div>
            ` : ''}
        </div>

        ${stats.semanticSimilarity.scores.length > 0 ? `
        <div class="stat-card" style="margin-bottom: 20px;">
            <h3>📊 意味的類似度分布</h3>
            <div class="distribution-grid">
                <div class="distribution-item">
                    <div class="distribution-value">${stats.semanticSimilarity.distribution.low}</div>
                    <div class="distribution-label">🔴 低 (< 0.3)</div>
                </div>
                <div class="distribution-item">
                    <div class="distribution-value">${stats.semanticSimilarity.distribution.medium}</div>
                    <div class="distribution-label">🟡 中 (0.3-0.7)</div>
                </div>
                <div class="distribution-item">
                    <div class="distribution-value">${stats.semanticSimilarity.distribution.high}</div>
                    <div class="distribution-label">🟢 高 (> 0.7)</div>
                </div>
            </div>
        </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px;">
            ${Object.keys(stats.aprProviders).length > 0 ? `
            <div class="stat-card">
                <h3>🤖 APRプロバイダー</h3>
                <ul class="model-list">
                    ${Object.entries(stats.aprProviders).map(([provider, count]) => `
                        <li class="model-item">
                            <span class="model-name">${provider}</span>
                            <span class="model-count">${count}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${Object.keys(stats.aprModels).length > 0 ? `
            <div class="stat-card">
                <h3>🧠 APRモデル</h3>
                <ul class="model-list">
                    ${Object.entries(stats.aprModels).map(([model, count]) => `
                        <li class="model-item">
                            <span class="model-name">${model}</span>
                            <span class="model-count">${count}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}
        </div>

        <div class="stat-card">
            <h3>📋 LLM評価ステータス（正確性評価） <span style="cursor: help; color: #667eea;" title="LLM評価は修正ありケースのみ実行されます。修正なしケースはIntent評価で補完されます。">ℹ️</span></h3>
            <p style="font-size: 0.9em; color: #6c757d; margin-bottom: 15px;">
                ※修正なし（No-op）ケースはLLM評価がスキップされます。Intent評価は別途実行されます。
            </p>
            <div class="distribution-grid">
                <div class="distribution-item">
                    <div class="distribution-value">${stats.evaluationStatus.evaluated}</div>
                    <div class="distribution-label">✅ LLM評価完了</div>
                </div>
                <div class="distribution-item">
                    <div class="distribution-value">${stats.correctnessDistribution.skipped || 0}</div>
                    <div class="distribution-label" title="エージェントが修正を行わなかったケース（調査のみ、生成ファイルのみ、No Changes Needed等）">⏭️ スキップ（修正なし）</div>
                </div>
                <div class="distribution-item">
                    <div class="distribution-value">${stats.evaluationStatus.error}</div>
                    <div class="distribution-label">❌ エラー</div>
                </div>
            </div>
        </div>
        
        ${stats.intentFulfillmentEvaluation && stats.intentFulfillmentEvaluation.totalEvaluated > 0 ? `
        <div class="stat-card">
            <h3>🎯 Intent Fulfillment評価 (LLM_C)</h3>
            <div class="distribution-grid">
                <div class="distribution-item">
                    <div class="distribution-value">${stats.intentFulfillmentEvaluation.totalEvaluated}</div>
                    <div class="distribution-label">✅ 評価完了</div>
                </div>
                <div class="distribution-item">
                    <div class="distribution-value">${stats.intentFulfillmentEvaluation.totalSkipped}</div>
                    <div class="distribution-label">⏭️ スキップ</div>
                </div>
                <div class="distribution-item">
                    <div class="distribution-value">${stats.intentFulfillmentEvaluation.averageScore}</div>
                    <div class="distribution-label">📊 平均スコア</div>
                </div>
            </div>
            
            <div class="chart-bar" style="margin-top: 15px;">
                <div class="chart-bar-label">
                    <span>🎯 高スコア (≥0.9)</span>
                    <span><strong>${stats.intentFulfillmentEvaluation.highScore}</strong> (${((stats.intentFulfillmentEvaluation.highScore / stats.intentFulfillmentEvaluation.totalEvaluated) * 100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-identical" style="width: ${(stats.intentFulfillmentEvaluation.highScore / stats.intentFulfillmentEvaluation.totalEvaluated) * 100}%"></div>
                </div>
            </div>
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>✅ 中スコア (0.7-0.89)</span>
                    <span><strong>${stats.intentFulfillmentEvaluation.mediumScore}</strong> (${((stats.intentFulfillmentEvaluation.mediumScore / stats.intentFulfillmentEvaluation.totalEvaluated) * 100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-equivalent" style="width: ${(stats.intentFulfillmentEvaluation.mediumScore / stats.intentFulfillmentEvaluation.totalEvaluated) * 100}%"></div>
                </div>
            </div>
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>⚠️ 低スコア (0.4-0.69)</span>
                    <span><strong>${stats.intentFulfillmentEvaluation.lowScore}</strong> (${((stats.intentFulfillmentEvaluation.lowScore / stats.intentFulfillmentEvaluation.totalEvaluated) * 100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-plausible" style="width: ${(stats.intentFulfillmentEvaluation.lowScore / stats.intentFulfillmentEvaluation.totalEvaluated) * 100}%"></div>
                </div>
            </div>
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>❌ 極低スコア (<0.4)</span>
                    <span><strong>${stats.intentFulfillmentEvaluation.veryLowScore}</strong> (${((stats.intentFulfillmentEvaluation.veryLowScore / stats.intentFulfillmentEvaluation.totalEvaluated) * 100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-incorrect" style="width: ${(stats.intentFulfillmentEvaluation.veryLowScore / stats.intentFulfillmentEvaluation.totalEvaluated) * 100}%"></div>
                </div>
            </div>
        </div>
        ` : ''}
    `;
}

// PR一覧の読み込み
async function loadPRs(sessionId) {
    const contentTitle = document.getElementById('contentTitle');
    const contentBody = document.getElementById('contentBody');
    
    contentTitle.textContent = `${sessionId} の PR/Issue 一覧`;
    contentBody.innerHTML = '<div class="spinner"></div>';
    
    // パンくずリストを更新（統計サマリーへのリンクを追加）
    updateBreadcrumb([
        { label: 'ホーム', action: () => resetView() },
        { label: `${sessionId} 統計`, action: () => loadReportStatistics(sessionId) },
        { label: 'PR一覧', action: null }
    ]);
    
    try {
        const response = await fetch(`${API_BASE}/reports/${sessionId}/prs`);
        const data = await response.json();
        
        if (data.success) {
            renderPRs(data.prs);
        }
    } catch (error) {
        console.error('❌ PRs loading error:', error);
        showError('PR一覧の読み込みに失敗しました');
    }
}

// PR一覧の描画
function renderPRs(prs) {
    const contentBody = document.getElementById('contentBody');
    
    if (prs.length === 0) {
        contentBody.innerHTML = '<p class="loading">PR/Issueが見つかりません</p>';
        return;
    }
    
    contentBody.innerHTML = `
        <div style="margin-bottom: 20px;">
            <button class="btn" onclick="loadReportStatistics('${state.currentReport}')">
                ← 統計サマリーに戻る
            </button>
        </div>
        <div class="pr-grid">
            ${prs.map(pr => {
                const badgeClass = getCorrectnessClass(pr.correctnessLevel);
                const badgeText = getCorrectnessText(pr.correctnessLevel);
                
                // Intent Fulfillmentスコアのバッジ
                let intentBadge = '';
                if (pr.intentFulfillmentEvaluation) {
                    const intent = pr.intentFulfillmentEvaluation;
                    if (intent.status === 'evaluated') {
                        const scoreClass = intent.score >= 0.9 ? 'badge-identical' : 
                                          intent.score >= 0.7 ? 'badge-equivalent' :
                                          intent.score >= 0.4 ? 'badge-plausible' : 'badge-incorrect';
                        intentBadge = `<div class="pr-info"><span class="correctness-badge ${scoreClass}" style="font-size: 0.8em;">🎯 ${(intent.score * 100).toFixed(0)}%</span></div>`;
                    } else if (intent.status === 'skipped') {
                        intentBadge = '<div class="pr-info" style="color: #6c757d;">🎯 スキップ</div>';
                    } else if (intent.status === 'error') {
                        intentBadge = '<div class="pr-info" style="color: #dc3545;">🎯 エラー</div>';
                    }
                }
                
                return `
                    <div class="pr-card" onclick="selectPR('${encodeURIComponent(pr.datasetEntry)}')">
                        <h3>🐛 ${pr.prName}</h3>
                        <div class="pr-info">📦 ${pr.projectName}</div>
                        <div class="pr-info">📝 ${pr.modifiedLines} 行変更</div>
                        <div class="pr-info">🤖 ${pr.aprProvider} / ${pr.aprModel}</div>
                        ${pr.semanticSimilarityScore != null ? `<div class="pr-info">📊 類似度: ${pr.semanticSimilarityScore}</div>` : ''}
                        ${intentBadge}
                        <span class="correctness-badge ${badgeClass}">${badgeText}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// PRの選択
async function selectPR(encodedDatasetEntry) {
    const datasetEntry = decodeURIComponent(encodedDatasetEntry);
    state.currentPR = datasetEntry;
    
    // パンくずリストの更新
    updateBreadcrumb([
        { label: 'ホーム', action: () => resetView() },
        { label: `${state.currentReport} 統計`, action: () => loadReportStatistics(state.currentReport) },
        { label: 'PR一覧', action: () => loadPRs(state.currentReport) },
        { label: datasetEntry.split('/').pop(), action: null }
    ]);
    
    // PR詳細の読み込み
    await loadPRDetail(state.currentReport, datasetEntry);
}

// PR詳細の読み込み
async function loadPRDetail(sessionId, datasetEntry) {
    const contentTitle = document.getElementById('contentTitle');
    const contentBody = document.getElementById('contentBody');
    
    contentTitle.textContent = datasetEntry.split('/').pop();
    contentBody.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch(`${API_BASE}/reports/${sessionId}/prs/${encodeURIComponent(datasetEntry)}`);
        const data = await response.json();
        
        if (data.success) {
            await renderPRDetail(data.data, sessionId, datasetEntry);
        }
    } catch (error) {
        console.error('❌ PR detail loading error:', error);
        showError('PR詳細の読み込みに失敗しました');
    }
}

// PR詳細の描画
async function renderPRDetail(detail, sessionId, datasetEntry) {
    const contentBody = document.getElementById('contentBody');
    
    const badgeClass = getCorrectnessClass(detail.correctnessLevel);
    const badgeText = getCorrectnessText(detail.correctnessLevel);
    
    // Diff情報を非同期で取得（デフォルト5行）
    let diffsHtml = '';
    try {
        const diffResponse = await fetch(`${API_BASE}/reports/${sessionId}/prs/${encodeURIComponent(datasetEntry)}/diffs?context=5&mode=premerge-postmerge`);
        if (diffResponse.ok) {
            const diffData = await diffResponse.json();
            console.log('Initial diff data received:', diffData.diffs?.length, 'files');
            state.currentDiffData = diffData;  // diffデータを保存
            diffsHtml = renderDiffs(diffData);
        }
    } catch (error) {
        console.error('Failed to load diffs:', error);
        diffsHtml = '<div class="diff-error">Diff情報の読み込みに失敗しました</div>';
    }
    
    contentBody.innerHTML = `
        <div class="detail-view">
            <button class="btn" onclick="loadPRs('${state.currentReport}')">
                ← PR一覧に戻る
            </button>
            
            <div class="detail-section" style="margin-top: 20px;">
                <h3>基本情報</h3>
                <div class="detail-content">
                    <p><strong>プロジェクト:</strong> ${detail.projectName}</p>
                    <p><strong>PR/Issue:</strong> ${detail.pullRequestName || detail.datasetEntry}</p>
                    <p><strong>ステータス:</strong> ${detail.status}</p>
                    <p><strong>変更ファイル数:</strong> ${detail.modifiedFiles}</p>
                    <p><strong>変更行数:</strong> ${detail.modifiedLines}</p>
                    <p><strong>APRプロバイダー:</strong> ${detail.aprProvider}</p>
                    <p><strong>APRモデル:</strong> ${detail.aprModel}</p>
                    <p><strong>正確性レベル:</strong> <span class="correctness-badge ${badgeClass}">${badgeText}</span></p>
                    ${detail.semanticSimilarityScore != null ? `<p><strong>意味的類似度:</strong> ${detail.semanticSimilarityScore}</p>` : ''}
                </div>
            </div>
            
            ${detail.evaluationReasoning ? `
            <div class="detail-section">
                <h3>評価理由 (LLM評価)</h3>
                <div class="detail-content">
                    <p>${detail.evaluationReasoning}</p>
                </div>
            </div>
            ` : ''}
            
            ${detail.intentFulfillmentEvaluation ? renderIntentFulfillmentSection(detail.intentFulfillmentEvaluation) : ''}
            
            ${detail.similarityReasoning ? `
            <div class="detail-section">
                <h3>類似度の理由</h3>
                <div class="detail-content">
                    <p>${detail.similarityReasoning}</p>
                </div>
            </div>
            ` : ''}
            
            ${detail.plausibilityReasoning ? `
            <div class="detail-section">
                <h3>妥当性の理由</h3>
                <div class="detail-content">
                    <p>${detail.plausibilityReasoning}</p>
                </div>
            </div>
            ` : ''}
            
            ${detail.modificationTypes && detail.modificationTypes.length > 0 ? `
            <div class="detail-section">
                <h3>変更タイプ</h3>
                <div class="detail-content">
                    <p>${detail.modificationTypes.join(', ')}</p>
                </div>
            </div>
            ` : ''}
            
            ${diffsHtml}
            
            <div class="detail-section">
                <h3>完全なJSON データ</h3>
                <pre class="json-viewer">${JSON.stringify(detail, null, 2)}</pre>
            </div>
        </div>
    `;
    
    // Diff表示の初期化（DOMレンダリング完了後に実行）
    setTimeout(() => {
        initializeDiffViewer(5);  // デフォルト5行
    }, 0);
}

// パンくずリストの更新
function updateBreadcrumb(items) {
    const breadcrumbEl = document.getElementById('breadcrumb');
    
    breadcrumbEl.innerHTML = items.map((item, index) => {
        const html = item.action 
            ? `<span class="breadcrumb-item" onclick="(${item.action.toString()})()">${item.label}</span>`
            : `<span class="breadcrumb-item">${item.label}</span>`;
        
        return index < items.length - 1 
            ? html + '<span class="breadcrumb-separator">/</span>'
            : html;
    }).join('');
}

// Diff表示のレンダリング
function renderDiffs(diffData) {
    if (!diffData.available || !diffData.diffs || diffData.diffs.length === 0) {
        return '<div id="pr-diffs" class="diff-error">変更差分が利用できません</div>';
    }
    
    // APRパッチの生成状況を分析
    const aprMode = diffData.mode && diffData.mode.includes('apr');
    
    // 各ファイルのdiff状態を分析
    const fileStatuses = diffData.diffs.map(diff => {
        const isEmpty = !diff.diff || diff.diff.trim() === '' || 
                       diff.diff.includes('No newline at end of file') && diff.diff.split('\n').length <= 5;
        return {
            fileName: diff.fileName,
            isEmpty: isEmpty,
            hasContent: !isEmpty
        };
    });
    
    const identicalCount = fileStatuses.filter(f => f.isEmpty).length;
    const differentCount = fileStatuses.filter(f => f.hasContent).length;
    const totalChanged = diffData.changedFiles ? diffData.changedFiles.length : diffData.diffs.length;
    const missingCount = totalChanged - diffData.diffs.length;
    
    // APRが修正しなかったファイルを特定
    const modifiedFiles = diffData.diffs.map(d => d.fileName);
    const missingFiles = diffData.changedFiles ? 
        diffData.changedFiles.filter(f => !modifiedFiles.includes(f)) : [];
    
    // APR除外ファイルを判定する関数
    // 手書きファイル以外（除外対象）を判定：
    // - .protoファイル（protoFilesカテゴリ）
    // - 自動生成ファイル（generatedFilesカテゴリ）
    // - ドキュメント、テスト、設定ファイル等
    function isAPRExcludedFile(fileName) {
        const name = fileName.toLowerCase();
        const baseName = fileName.split('/').pop().toLowerCase();
        
        // .protoファイル（protoFilesカテゴリ - 手書きではない）
        if (name.endsWith('.proto')) return true;
        
        // 除外拡張子
        const excludedExtensions = ['.md', '.markdown', '.log', '.lock', 
            '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'];
        if (excludedExtensions.some(ext => name.endsWith(ext))) return true;
        
        // Docker関連
        if (baseName === 'dockerfile' || baseName === 'docker-compose.yml' || 
            baseName === '.dockerignore' || baseName === 'license') return true;
        
        // 除外ディレクトリ
        if (name.includes('/.github/') || name.includes('/.circleci/') || 
            name.includes('/.vscode/') || name.includes('/docs/') ||
            name.includes('/node_modules/')) return true;
        
        // 自動生成ファイル（Protocol Buffer関連）
        const autoGenPatterns = ['.pb.', '_pb2.', '.pb2.', '.pb.go', '.pb.cc', 
            '.pb.h', '.pb.rb', '.pb.swift', '.pb.m', '.pb-c.', '.pb-c.h', '.pb-c.c'];
        if (autoGenPatterns.some(pattern => name.includes(pattern))) return true;
        
        // テストファイル
        if (baseName.includes('test') || name.includes('/test/') || name.includes('_test.')) return true;
        
        return false;
    }
    
    // 修正漏れファイルを分類
    const handwrittenMissing = missingFiles.filter(f => !isAPRExcludedFile(f));
    const excludedMissing = missingFiles.filter(f => isAPRExcludedFile(f));
    
    // Ground Truth全体から手書きファイル（修正対象）を計算
    const allChangedFiles = diffData.changedFiles || [];
    const handwrittenTarget = allChangedFiles.filter(f => !isAPRExcludedFile(f));
    const excludedTarget = allChangedFiles.filter(f => isAPRExcludedFile(f));
    
    // APRが修正した手書きファイル数
    const handwrittenModified = handwrittenTarget.length - handwrittenMissing.length;
    
    // デバッグログ
    console.log('[renderDiffs] Debug Info:', {
        mode: diffData.mode,
        changedFilesCount: diffData.changedFiles ? diffData.changedFiles.length : 0,
        changedFiles: diffData.changedFiles,
        modifiedFilesCount: modifiedFiles.length,
        modifiedFiles,
        handwrittenTargetCount: handwrittenTarget.length,
        handwrittenTarget,
        excludedTargetCount: excludedTarget.length,
        handwrittenMissingCount: handwrittenMissing.length,
        handwrittenMissing,
        excludedMissingCount: excludedMissing.length,
        excludedMissing,
        identicalCount,
        differentCount
    });
    
    let fileStatusInfo = '';
    if (aprMode) {
        if (diffData.mode === 'postmerge-apr') {
            // Ground Truth vs APR比較の場合
            const missingFilesList = handwrittenMissing.length > 0 ? 
                `<details style="margin-top: 10px; color: #586069;" open>
                    <summary style="cursor: pointer; color: #d73a49; font-weight: 500;">
                        🔧 修正対象: ${handwrittenTarget.length}ファイル中 ${handwrittenMissing.length}ファイルが修正漏れ
                    </summary>
                    <div style="margin: 8px 0 0 0;">
                        <div style="margin-bottom: 10px;">
                            <strong style="color: #d73a49;">❌ 修正漏れファイル:</strong>
                            <ul style="margin: 4px 0 0 20px; padding: 0;">
                                ${handwrittenMissing.map(f => `<li style="margin: 4px 0;"><code style="color: #d73a49;">${f}</code></li>`).join('')}
                            </ul>
                        </div>
                        ${excludedMissing.length > 0 ? `
                        <div>
                            <label style="cursor: pointer; color: #586069; font-size: 0.95em;">
                                <input type="checkbox" id="show-excluded-files" style="margin-right: 5px;">
                                除外対象ファイルも表示（${excludedMissing.length}ファイル: 自動生成・テスト・ドキュメント）
                            </label>
                            <ul id="excluded-files-list" style="margin: 4px 0 0 20px; padding: 0; display: none;">
                                ${excludedMissing.map(f => `<li style="margin: 4px 0; color: #6a737d;"><code>${f}</code></li>`).join('')}
                            </ul>
                        </div>` : ''}
                    </div>
                </details>` : '';
            
            fileStatusInfo = `<div style="margin-bottom: 15px; padding: 10px; background: #e8f4f8; border-left: 4px solid #0366d6; border-radius: 4px;">
                <strong>📊 APRパッチの正確性:</strong>
                <div style="margin-top: 8px; display: flex; gap: 20px; flex-wrap: wrap;">
                    <span style="color: #0366d6;">🔧 修正対象: ${handwrittenTarget.length} ファイル</span>
                    ${identicalCount > 0 ? `<span style="color: #28a745;">✅ 完全一致: ${identicalCount} ファイル</span>` : ''}
                    ${differentCount > 0 ? `<span style="color: #e36209;">⚠️ 差分あり: ${differentCount} ファイル</span>` : ''}
                    ${handwrittenMissing.length > 0 ? `<span style="color: #d73a49;">❌ 修正漏れ: ${handwrittenMissing.length} ファイル</span>` : ''}
                </div>
                ${missingFilesList}
            </div>`;
        } else {
            // premerge-apr比較の場合
            const missingFilesList = handwrittenMissing.length > 0 ? 
                `<details style="margin-top: 10px; color: #586069;" open>
                    <summary style="cursor: pointer; color: #d73a49; font-weight: 500;">
                        🔧 修正対象: ${handwrittenTarget.length}ファイル中 ${handwrittenMissing.length}ファイルが修正漏れ
                    </summary>
                    <div style="margin: 8px 0 0 0;">
                        <div style="margin-bottom: 10px;">
                            <strong style="color: #d73a49;">❌ 修正漏れファイル:</strong>
                            <ul style="margin: 4px 0 0 20px; padding: 0;">
                                ${handwrittenMissing.map(f => `<li style="margin: 4px 0;"><code style="color: #d73a49;">${f}</code></li>`).join('')}
                            </ul>
                        </div>
                        ${excludedMissing.length > 0 ? `
                        <div>
                            <label style="cursor: pointer; color: #586069; font-size: 0.95em;">
                                <input type="checkbox" id="show-excluded-files-pre" style="margin-right: 5px;">
                                除外対象ファイルも表示（${excludedMissing.length}ファイル: 自動生成・テスト・ドキュメント）
                            </label>
                            <ul id="excluded-files-list-pre" style="margin: 4px 0 0 20px; padding: 0; display: none;">
                                ${excludedMissing.map(f => `<li style="margin: 4px 0; color: #6a737d;"><code>${f}</code></li>`).join('')}
                            </ul>
                        </div>` : ''}
                    </div>
                </details>` : '';
            
            fileStatusInfo = `<div style="margin-bottom: 15px; padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <strong>📊 APRパッチの分析:</strong>
                <div style="margin-top: 8px; display: flex; gap: 20px; flex-wrap: wrap;">
                    <span style="color: #0366d6;">🔧 修正対象: ${handwrittenTarget.length} ファイル</span>
                    ${identicalCount > 0 ? `<span style="color: #28a745;">✅ 適用可能: ${identicalCount} ファイル</span>` : ''}
                    ${differentCount > 0 ? `<span style="color: #e36209;">⚠️ 差分あり: ${differentCount} ファイル</span>` : ''}
                    ${handwrittenMissing.length > 0 ? `<span style="color: #d73a49;">❌ 修正漏れ: ${handwrittenMissing.length} ファイル</span>` : ''}
                </div>
                ${missingFilesList}
            </div>`;
        }
    }
    
    return `
        <div id="pr-diffs" class="detail-section">
            <h3>📝 変更差分</h3>
            ${fileStatusInfo}
            <div style="display: flex; gap: 15px; margin-bottom: 10px; align-items: center;">
                <div>
                    <label style="margin-right: 10px;">比較対象:</label>
                    <select id="comparisonModeSelector" onchange="updateComparisonMode(this.value)" style="padding: 5px 10px; border-radius: 4px; border: 1px solid #ddd; min-width: 200px;">
                        <option value="premerge-postmerge" ${diffData.mode === 'premerge-postmerge' ? 'selected' : ''}>Ground Truth (premerge ⟷ postmerge)</option>
                        <option value="premerge-apr" ${diffData.mode === 'premerge-apr' ? 'selected' : ''}>APRパッチ (premerge ⟷ APR)</option>
                        <option value="postmerge-apr" ${diffData.mode === 'postmerge-apr' ? 'selected' : ''}>Ground Truth vs APR (postmerge ⟷ APR)</option>
                    </select>
                </div>
                <div>
                    <label style="margin-right: 10px;">コンテキスト行数:</label>
                    <select id="contextLinesSelector" onchange="updateContextLines(this.value)" style="padding: 5px 10px; border-radius: 4px; border: 1px solid #ddd;">
                        <option value="3">3行</option>
                        <option value="5" selected>5行</option>
                        <option value="10">10行</option>
                        <option value="999999">全体表示</option>
                    </select>
                </div>
            </div>
            <div class="diff-tabs">
                ${diffData.diffs.map((diff, index) => {
                    const status = fileStatuses[index];
                    let icon = '';
                    if (diffData.mode === 'postmerge-apr') {
                        icon = status.isEmpty ? '✅ ' : '⚠️ ';
                    }
                    return `
                        <button class="diff-tab ${index === 0 ? 'active' : ''}" 
                                onclick="switchDiffTab(${index})">
                            ${icon}${diff.fileName}
                        </button>
                    `;
                }).join('')}
            </div>
            ${diffData.diffs.map((diff, index) => {
                const status = fileStatuses[index];
                return `
                    <div class="diff-container ${index === 0 ? 'active' : ''}" 
                         id="diff-${index}" 
                         data-index="${index}"
                         data-filename="${escapeHtml(diff.fileName)}"
                         data-is-empty="${status.isEmpty}"
                         data-mode="${diffData.mode || ''}">
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Diff Viewerの初期化
function initializeDiffViewer(contextLines = 5) {
    console.log('initializeDiffViewer called with contextLines:', contextLines);
    
    if (typeof Diff2HtmlUI === 'undefined') {
        console.error('Diff2Html library not loaded');
        return;
    }
    
    if (!state.currentDiffData || !state.currentDiffData.diffs) {
        console.error('No diff data available in state');
        return;
    }
    
    const containers = document.querySelectorAll('.diff-container');
    console.log('Found diff containers:', containers.length);
    
    containers.forEach((container, index) => {
        const diffIndex = parseInt(container.getAttribute('data-index'));
        const diffItem = state.currentDiffData.diffs[diffIndex];
        
        if (!diffItem) {
            console.warn(`No diff data for index ${diffIndex}`);
            return;
        }
        
        const diffString = diffItem.diff;
        const isEmpty = container.getAttribute('data-is-empty') === 'true';
        const mode = container.getAttribute('data-mode');
        const fileName = diffItem.fileName;
        
        console.log(`Container ${index}: fileName=${fileName}, isEmpty=${isEmpty}, mode=${mode}, diffLength=${diffString?.length}`);
        
        if (diffString) {
            try {
                const targetElement = document.getElementById(`diff-${index}`);
                
                if (!targetElement) {
                    console.error(`Target element diff-${index} not found`);
                    return;
                }
                
                // APR vs Ground Truth比較で差分がない場合の特別な表示
                if (isEmpty && mode === 'postmerge-apr') {
                    targetElement.innerHTML = `
                        <div style="padding: 60px 40px; text-align: center; background: linear-gradient(135deg, #f0fff4 0%, #e6f9f0 100%); border: 2px solid #28a745; border-radius: 12px; margin: 20px 0;">
                            <div style="font-size: 4rem; margin-bottom: 20px;">✅</div>
                            <h3 style="color: #155724; margin-bottom: 15px; font-size: 1.5rem;">APRパッチが完全一致</h3>
                            <p style="color: #155724; font-size: 1.1rem; margin-bottom: 10px;">
                                <strong>${fileName}</strong>
                            </p>
                            <p style="color: #28a745; font-size: 0.95rem;">
                                APRが生成したパッチとGround Truth（実際のコミット）が完全に一致しています。<br>
                                このファイルではAPRが正しい修正を自動生成できました。
                            </p>
                        </div>
                    `;
                    console.log(`Displayed success message for ${fileName}`);
                    return;
                }
                
                // 通常のdiff表示
                const configuration = {
                    drawFileList: false,
                    matching: 'lines',
                    outputFormat: 'side-by-side',
                    highlight: true,
                    renderNothingWhenEmpty: false,
                    matchWordsThreshold: 0.25,
                    matchingMaxComparisons: 2500
                };
                
                // Clear previous content
                targetElement.innerHTML = '';
                
                const diff2htmlUi = new Diff2HtmlUI(targetElement, diffString, configuration);
                diff2htmlUi.draw();
                console.log(`Drew diff for ${fileName}, result innerHTML length: ${targetElement.innerHTML.length}`);
            } catch (error) {
                console.error('Failed to render diff:', error);
                container.innerHTML = '<div class="diff-error">Diffの表示に失敗しました</div>';
            }
        } else {
            console.warn(`No diff string for container ${index}`);
        }
    });
    
    // 最初のタブとコンテナを強制的にアクティブにする
    console.log('Ensuring first tab is active');
    const firstTab = document.querySelector('.diff-tab');
    const firstContainer = document.querySelector('.diff-container');
    if (firstTab) {
        firstTab.classList.add('active');
        console.log('First tab activated');
    }
    if (firstContainer) {
        firstContainer.classList.add('active');
        console.log('First container activated, display:', window.getComputedStyle(firstContainer).display);
    }
    
    // 除外ファイル表示チェックボックスのイベントリスナー
    const showExcludedCheckbox = document.getElementById('show-excluded-files');
    const showExcludedCheckboxPre = document.getElementById('show-excluded-files-pre');
    const excludedFilesList = document.getElementById('excluded-files-list');
    const excludedFilesListPre = document.getElementById('excluded-files-list-pre');
    
    if (showExcludedCheckbox && excludedFilesList) {
        showExcludedCheckbox.addEventListener('change', (e) => {
            excludedFilesList.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    if (showExcludedCheckboxPre && excludedFilesListPre) {
        showExcludedCheckboxPre.addEventListener('change', (e) => {
            excludedFilesListPre.style.display = e.target.checked ? 'block' : 'none';
        });
    }
}

// コンテキスト行数を更新
async function updateContextLines(contextLines) {
    const currentSession = state.currentReport;
    const currentPR = state.currentPR;
    
    if (!currentSession || !currentPR) return;
    
    const prDiffsElement = document.getElementById('pr-diffs');
    if (!prDiffsElement) {
        console.warn('pr-diffs element not found. updateContextLines called from wrong context.');
        return;
    }
    
    const mode = document.getElementById('comparisonModeSelector')?.value || 'premerge-postmerge';
    
    // Diff情報を再取得
    try {
        const diffResponse = await fetch(`${API_BASE}/reports/${currentSession}/prs/${encodeURIComponent(currentPR)}/diffs?context=${contextLines}&mode=${mode}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        const diffData = await diffResponse.json();
        
        if (!diffResponse.ok || (diffData.isAPRError && !diffData.available)) {
            // APRエラーの場合は比較モードをGround Truthに戻す
            document.getElementById('comparisonModeSelector').value = 'premerge-postmerge';
            await updateComparisonMode('premerge-postmerge');
            return;
        }
        
        // diffデータを保存
        state.currentDiffData = diffData;
        
        // Diff HTMLを完全に再生成
        const diffHTML = renderDiffs(diffData);
        prDiffsElement.outerHTML = diffHTML;
        
        // Diff Viewerを初期化
        initializeDiffViewer(parseInt(contextLines));
        
        // セレクターの状態を維持（HTMLを再生成したので再設定）
        const modeSelector = document.getElementById('comparisonModeSelector');
        if (modeSelector) {
            modeSelector.value = mode;
        }
        const contextSelector = document.getElementById('contextLinesSelector');
        if (contextSelector) {
            contextSelector.value = contextLines;
        }
    } catch (error) {
        console.error('Failed to update context lines:', error);
    }
}

// 比較モードを更新
async function updateComparisonMode(mode) {
    const currentSession = state.currentReport;
    const currentPR = state.currentPR;
    
    if (!currentSession || !currentPR) return;
    
    const prDiffsElement = document.getElementById('pr-diffs');
    if (!prDiffsElement) {
        console.warn('pr-diffs element not found. updateComparisonMode called from wrong context.');
        return;
    }
    
    const contextLines = document.getElementById('contextLinesSelector')?.value || 5;
    
    // Diff情報を再取得
    try {
        const diffResponse = await fetch(`${API_BASE}/reports/${currentSession}/prs/${encodeURIComponent(currentPR)}/diffs?context=${contextLines}&mode=${mode}`, {
            cache: 'no-store',  // キャッシュを無効化
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        const diffData = await diffResponse.json();
        
        // APRエラーの場合
        if (!diffResponse.ok || (diffData.isAPRError && !diffData.available)) {
            const errorHTML = `
                <div id="pr-diffs" class="detail-section">
                    <h3>📝 変更差分</h3>
                    <div style="display: flex; gap: 15px; margin-bottom: 10px; align-items: center;">
                        <div>
                            <label style="margin-right: 10px;">比較対象:</label>
                            <select id="comparisonModeSelector" onchange="updateComparisonMode(this.value)" style="padding: 5px 10px; border-radius: 4px; border: 1px solid #ddd; min-width: 200px;">
                                <option value="premerge-postmerge" ${mode === 'premerge-postmerge' ? 'selected' : ''}>Ground Truth (premerge ⟷ postmerge)</option>
                                <option value="premerge-apr" ${mode === 'premerge-apr' ? 'selected' : ''}>APRパッチ (premerge ⟷ APR)</option>
                                <option value="postmerge-apr" ${mode === 'postmerge-apr' ? 'selected' : ''}>Ground Truth vs APR (postmerge ⟷ APR)</option>
                            </select>
                        </div>
                    </div>
                    <div class="diff-error" style="padding: 40px; text-align: center; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin: 20px 0;">
                        <div style="font-size: 3rem; margin-bottom: 15px;">⚠️</div>
                        <h4 style="color: #856404; margin-bottom: 10px;">APRパッチが利用できません</h4>
                        <p style="color: #856404; margin-bottom: 10px;">${diffData.message || 'APRパッチの生成に失敗したか、まだ生成されていません。'}</p>
                        <p style="color: #856404; font-size: 0.9em;">Ground Truth比較を選択してください。</p>
                    </div>
                </div>
            `;
            prDiffsElement.outerHTML = errorHTML;
            return;
        }
        
        // diffデータを保存
        state.currentDiffData = diffData;
        
        // Diff HTMLを完全に再生成
        const diffHTML = renderDiffs(diffData);
        prDiffsElement.outerHTML = diffHTML;
        
        // Diff Viewerを初期化
        initializeDiffViewer(parseInt(contextLines));
        
        // セレクターの状態を維持（HTMLを再生成したので再設定）
        const modeSelector = document.getElementById('comparisonModeSelector');
        if (modeSelector) {
            modeSelector.value = mode;
        }
        const contextSelector = document.getElementById('contextLinesSelector');
        if (contextSelector) {
            contextSelector.value = contextLines;
        }
    } catch (error) {
        console.error('Failed to update comparison mode:', error);
        const errorHTML = `
            <div id="pr-diffs" class="detail-section">
                <h3>📝 変更差分</h3>
                <div class="diff-error" style="padding: 40px; text-align: center; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">❌</div>
                    <h4 style="color: #721c24;">エラーが発生しました</h4>
                    <p style="color: #721c24;">${error.message}</p>
                </div>
            </div>
        `;
        prDiffsElement.innerHTML = errorHTML;
    }
}

// Diffタブの切り替え
function switchDiffTab(index) {
    // タブのアクティブ状態を更新
    document.querySelectorAll('.diff-tab').forEach((tab, i) => {
        if (i === index) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // コンテナの表示を更新
    document.querySelectorAll('.diff-container').forEach((container, i) => {
        if (i === index) {
            container.classList.add('active');
        } else {
            container.classList.remove('active');
        }
    });
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ビューのリセット
function resetView() {
    state.currentReport = null;
    state.currentPR = null;
    
    document.querySelectorAll('.report-item').forEach(item => {
        item.classList.remove('active');
    });
    
    updateBreadcrumb([{ label: 'ホーム', action: null }]);
    
    document.getElementById('contentTitle').textContent = '評価レポートを選択してください';
    document.getElementById('contentBody').innerHTML = `
        <p style="text-align: center; color: #6c757d; margin-top: 40px;">
            左のサイドバーから評価レポートを選択して、PR/Issue ごとの評価結果を閲覧できます。
        </p>
    `;
}

// ユーティリティ関数
function getCorrectnessClass(level) {
    const map = {
        'IDENTICAL': 'badge-identical',
        'SEMANTICALLY_EQUIVALENT': 'badge-equivalent',
        'PLAUSIBLE_BUT_DIFFERENT': 'badge-plausible',
        'INCORRECT': 'badge-incorrect'
    };
    return map[level] || 'badge-plausible';
}

function getCorrectnessText(level) {
    const map = {
        'IDENTICAL': '✅ 完全一致',
        'SEMANTICALLY_EQUIVALENT': '✅ 意味的等価',
        'PLAUSIBLE_BUT_DIFFERENT': '⚠️ 妥当だが異なる',
        'INCORRECT': '❌ 不正解',
        'SKIPPED': '⏭️ スキップ',
        'ERROR': '❌ エラー'
    };
    return map[level] || level;
}

// Intent Fulfillment評価セクションの描画
function renderIntentFulfillmentSection(intentEval) {
    if (!intentEval) return '';
    
    if (intentEval.status === 'evaluated') {
        // スコアに基づいたバッジクラス
        const scoreClass = intentEval.score >= 0.9 ? 'badge-identical' : 
                          intentEval.score >= 0.7 ? 'badge-equivalent' :
                          intentEval.score >= 0.4 ? 'badge-plausible' : 'badge-incorrect';
        const scoreEmoji = intentEval.score >= 0.9 ? '🎯' : 
                          intentEval.score >= 0.7 ? '✅' :
                          intentEval.score >= 0.4 ? '⚠️' : '❌';
        
        return `
            <div class="detail-section">
                <h3>🎯 Intent Fulfillment評価 (LLM_C)</h3>
                <div class="detail-content">
                    <p><strong>スコア:</strong> <span class="correctness-badge ${scoreClass}">${scoreEmoji} ${(intentEval.score * 100).toFixed(0)}%</span></p>
                    <p><strong>コミット意図の要約:</strong><br>${intentEval.commit_intent_summary || 'N/A'}</p>
                    <p><strong>エージェント出力の要約:</strong><br>${intentEval.agent_output_summary || 'N/A'}</p>
                    ${intentEval.alignment_analysis ? `<p><strong>整合性分析:</strong><br>${intentEval.alignment_analysis}</p>` : ''}
                    <p><strong>評価理由:</strong><br>${intentEval.reasoning || 'N/A'}</p>
                </div>
            </div>
        `;
    } else if (intentEval.status === 'skipped') {
        return `
            <div class="detail-section">
                <h3>🎯 Intent Fulfillment評価 (LLM_C)</h3>
                <div class="detail-content" style="background: #fff3cd; padding: 15px; border-radius: 5px;">
                    <p><strong>⏭️ スキップ:</strong> ${intentEval.reason === 'no_commit_messages' ? 'コミットメッセージが存在しないためスキップ' : intentEval.reason}</p>
                </div>
            </div>
        `;
    } else if (intentEval.status === 'error') {
        return `
            <div class="detail-section">
                <h3>🎯 Intent Fulfillment評価 (LLM_C)</h3>
                <div class="detail-content" style="background: #f8d7da; padding: 15px; border-radius: 5px;">
                    <p><strong>❌ エラー:</strong> ${intentEval.error}</p>
                </div>
            </div>
        `;
    }
    
    return '';
}

function showError(message) {
    const contentBody = document.getElementById('contentBody');
    contentBody.innerHTML = `<div class="error">❌ ${message}</div>`;
}
