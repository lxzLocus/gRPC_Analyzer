// API Base URL
const API_BASE = '/api';

// 状態管理
const state = {
    currentReport: null,
    currentPR: null,
    statistics: null,
    currentDiffData: null,  // 現在表示中のdiffデータを保持
    sidebarCollapsed: false  // サイドバーの開閉状態
};

// サイドバーのトグル
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleIcon = document.getElementById('toggleIcon');
    const toggleText = document.getElementById('toggleText');

    state.sidebarCollapsed = !state.sidebarCollapsed;

    if (state.sidebarCollapsed) {
        sidebar.classList.add('collapsed');
        toggleIcon.textContent = '☰';
        toggleText.textContent = 'メニューを開く';
    } else {
        sidebar.classList.remove('collapsed');
        toggleIcon.textContent = '✕';
        toggleText.textContent = 'メニューを閉じる';
    }
}

// スクロール時のヘッダー表示/非表示制御
function initScrollHeaderBehavior() {
    const header = document.querySelector('header');

    if (!header) return;

    let lastScrollTop = 0;
    let ticking = false;

    // ページ全体のスクロールを監視
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

                // 下にスクロール（スクロール位置が50px以上）
                if (scrollTop > lastScrollTop && scrollTop > 50) {
                    header.classList.add('hidden');
                }
                // 上にスクロール
                else if (scrollTop < lastScrollTop) {
                    header.classList.remove('hidden');
                }

                lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
                ticking = false;
            });

            ticking = true;
        }
    }, { passive: true });
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();

    // モバイルデバイスではデフォルトでサイドバーを閉じる
    if (window.innerWidth <= 768) {
        toggleSidebar();
    }

    // スクロール時にヘッダーを非表示にする
    initScrollHeaderBehavior();
});

async function initializeApp() {
    try {
        await loadReports();
    } catch (error) {
        console.error('❌ Initialization error:', error);
        showError('初期化エラーが発生しました: ' + error.message);
    }
}

// レポート一覧の読み込み
async function loadReports() {
    try {
        const response = await fetch(`${API_BASE}/reports`);
        const data = await response.json();

        if (data.success) {
            renderReports(data.reports);
        }
    } catch (error) {
        console.error('❌ Reports loading error:', error);
        showError('レポートの読み込みに失敗しました');
    }
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
        const breakdown = report.finalCategoryBreakdown || {};
        return `
            <li class="report-item" data-session-id="${report.sessionId}" onclick="selectReport('${report.sessionId}')">
                <div class="report-name">📄 ${report.sessionId}</div>
                <div class="report-info">${date}</div>
                <div class="report-stats">
                    <span class="stat-badge">📊 ${report.totalPRs} PR</span>
                    <span class="stat-badge">✅ ${breakdown.CORRECT || 0}</span>
                    <span class="stat-badge">⚠️ ${breakdown.PLAUSIBLE || 0}</span>
                </div>
            </li>
        `;
    }).join('');
}

// レポートの選択
async function selectReport(sessionId) {
    state.currentReport = sessionId;
    state.currentPR = null;

    // モバイルデバイスではレポート選択時にサイドバーを閉じる
    if (window.innerWidth <= 768 && !state.sidebarCollapsed) {
        toggleSidebar();
    }

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
    const correctness = stats.finalCategoryDistribution || {};
    
    // 実際に評価されたPR数（SKIPPED以外 = パッチが生成されたケース）
    const totalEvaluated = stats.totalEvaluated || ((correctness.CORRECT || 0) + (correctness.PLAUSIBLE || 0) + (correctness.INCORRECT || 0));

    // 処理フロー統計を生成（APR終了ステータス分布を含む）
    const processingStatsHtml = renderProcessingFlowStats(stats);

    contentBody.innerHTML = `
        <div style="margin-bottom: 20px;">
            <button class="btn" onclick="loadPRs('${state.currentReport}')">
                📄 PR/Issue一覧を表示
            </button>
        </div>

        ${processingStatsHtml}

        <div class="stats-overview">
            <div class="stat-card">
                <h3>📊 総PR/Issue数</h3>
                <div class="big-value">${total}件</div>
                <div class="sub-value">評価対象（SKIPPED除外）: ${totalEvaluated}件</div>
                <div class="sub-value">Intent評価対象: ${stats.intentFulfillmentEvaluation?.totalEvaluated || 0}件</div>
            </div>
            
            <div class="stat-card">
                <h3>✅ 正解率（CORRECT/評価対象）</h3>
                <div class="big-value">${stats.successRate}%</div>
                <div class="sub-value">
                    評価対象: ${totalEvaluated}件（全${total}件 - SKIPPED ${correctness.SKIPPED || 0}件）<br>
                    正解（CORRECT）: ${stats.finalCategoryDistribution?.CORRECT || 0}件
                </div>
            </div>
            
            <div class="stat-card">
                <h3>📊 平均変更行数</h3>
                <div class="big-value">${stats.modificationStats.averageLines}</div>
                <div class="sub-value">総計: ${stats.modificationStats.totalLines} 行</div>
            </div>
        </div>

        ${stats.fourAxisEvaluation && stats.fourAxisEvaluation.totalEvaluated > 0 ? `
        <div class="stat-card" style="margin-bottom: 20px;">
            <h3>📊 4軸評価 (LLM_B) - パッチ結果ベース評価</h3>
            <p style="font-size: 0.9em; color: #6c757d; margin-bottom: 15px;">
                <strong>評価対象:</strong> ${stats.fourAxisEvaluation.totalEvaluated}件/${total}件（パッチ生成ケースのみ）<br>
                <span style="color: #495057;">🎯 <strong>評価内容:</strong> 生成されたパッチとGround Truthを比較し、コードレベルで評価</span><br>
                <span style="font-size: 0.85em; color: #6c757d;">※Accuracy（正確性）、Decision Soundness（判断妥当性）、<strong>Directional Consistency（方向性の非矛盾チェック）</strong>、Validity（有効性）</span>
            </p>
            
            <div class="distribution-grid" style="margin-bottom: 20px;">
                <div class="distribution-item">
                    <div class="distribution-value">${stats.fourAxisEvaluation.accuracy.goodRatio ?? ((stats.fourAxisEvaluation.accuracy.average ?? 0) * 100).toFixed(1)}%</div>
                    <div class="distribution-label">🎯 Accuracy (正確性)</div>
                    <div style="font-size: 0.8em; color: #6c757d; margin-top: 5px;">Ground Truthとの一致度</div>
                    <div style="font-size: 0.75em; color: #999; margin-top: 3px;">${stats.fourAxisEvaluation.accuracy.labelCounts ? '(IDENTICAL + SEMANTICALLY_EQUIVALENT)' : '(旧形式: 平均スコア)'}</div>
                </div>
                <div class="distribution-item">
                    <div class="distribution-value">${stats.fourAxisEvaluation.decisionSoundness.goodRatio ?? ((stats.fourAxisEvaluation.decisionSoundness.average ?? 0) * 100).toFixed(1)}%</div>
                    <div class="distribution-label">🧠 Decision Soundness</div>
                    <div style="font-size: 0.8em; color: #6c757d; margin-top: 5px;">判断の妥当性</div>
                    <div style="font-size: 0.75em; color: #999; margin-top: 3px;">${stats.fourAxisEvaluation.decisionSoundness.labelCounts ? '(SOUND)' : '(旧形式: 平均スコア)'}</div>
                </div>
                <div class="distribution-item">
                    <div class="distribution-value">${stats.fourAxisEvaluation.directionalConsistency.goodRatio ?? ((stats.fourAxisEvaluation.directionalConsistency.average ?? 0) * 100).toFixed(1)}%</div>
                    <div class="distribution-label">🧭 Directional Consistency</div>
                    <div style="font-size: 0.8em; color: #6c757d; margin-top: 5px;">人間修正と非矛盾か</div>
                    <div style="font-size: 0.75em; color: #999; margin-top: 3px;">${stats.fourAxisEvaluation.directionalConsistency.labelCounts ? '(CONSISTENT)' : '(旧形式: 平均スコア)'}</div>
                </div>
                <div class="distribution-item">
                    <div class="distribution-value">${stats.fourAxisEvaluation.validity.goodRatio ?? ((stats.fourAxisEvaluation.validity.average ?? 0) * 100).toFixed(1)}%</div>
                    <div class="distribution-label">✅ Validity (有効性)</div>
                    <div style="font-size: 0.8em; color: #6c757d; margin-top: 5px;">構文・ビルドの正当性</div>
                    <div style="font-size: 0.75em; color: #999; margin-top: 3px;">${stats.fourAxisEvaluation.validity.labelCounts ? '(VALID)' : '(旧形式: 平均スコア)'}</div>
                </div>
            </div>
            
            ${stats.fourAxisEvaluation.accuracy.labelCounts && Object.keys(stats.fourAxisEvaluation.accuracy.labelCounts).length > 0 ? `
            <div style="margin-top: 15px;">
                <h4 style="margin-bottom: 10px; color: #495057;">📊 ラベル分布詳細</h4>
                
                <div class="chart-bar">
                    <div class="chart-bar-label">
                        <span>🎯 Accuracy <span style="font-size: 0.85em; color: #6c757d;">（Ground Truthとの一致度）</span></span>
                        <span><strong>${stats.fourAxisEvaluation.accuracy.goodRatio}%</strong> (${Object.values(stats.fourAxisEvaluation.accuracy.labelCounts).reduce((a, b) => a + b, 0)}件)</span>
                    </div>
                    <div class="chart-bar-bg">
                        <div class="chart-bar-fill bar-identical" style="width: ${stats.fourAxisEvaluation.accuracy.goodRatio}%"></div>
                    </div>
                    <div style="font-size: 0.8em; color: #6c757d; margin-left: 10px; margin-top: 5px;">
                        ${Object.entries(stats.fourAxisEvaluation.accuracy.labelCounts).map(([label, count]) => `${label}: ${count}件`).join(', ')}
                    </div>
                </div>
                
                <div class="chart-bar">
                    <div class="chart-bar-label">
                        <span>🧠 Decision Soundness <span style="font-size: 0.85em; color: #6c757d;">（判断の妥当性）</span></span>
                        <span><strong>${stats.fourAxisEvaluation.decisionSoundness.goodRatio}%</strong> (${Object.values(stats.fourAxisEvaluation.decisionSoundness.labelCounts).reduce((a, b) => a + b, 0)}件)</span>
                    </div>
                    <div class="chart-bar-bg">
                        <div class="chart-bar-fill bar-equivalent" style="width: ${stats.fourAxisEvaluation.decisionSoundness.goodRatio}%"></div>
                    </div>
                    <div style="font-size: 0.8em; color: #6c757d; margin-left: 10px; margin-top: 5px;">
                        ${Object.entries(stats.fourAxisEvaluation.decisionSoundness.labelCounts).map(([label, count]) => `${label}: ${count}件`).join(', ')}
                    </div>
                </div>
                
                <div class="chart-bar">
                    <div class="chart-bar-label">
                        <span>🧭 Directional Consistency <span style="font-size: 0.85em; color: #6c757d;">（人間修正と非矛盾か）</span></span>
                        <span><strong>${stats.fourAxisEvaluation.directionalConsistency.goodRatio}%</strong> (${Object.values(stats.fourAxisEvaluation.directionalConsistency.labelCounts).reduce((a, b) => a + b, 0)}件)</span>
                    </div>
                    <div class="chart-bar-bg">
                        <div class="chart-bar-fill bar-plausible" style="width: ${stats.fourAxisEvaluation.directionalConsistency.goodRatio}%"></div>
                    </div>
                    <div style="font-size: 0.8em; color: #6c757d; margin-left: 10px; margin-top: 5px;">
                        ${Object.entries(stats.fourAxisEvaluation.directionalConsistency.labelCounts).map(([label, count]) => `${label}: ${count}件`).join(', ')}
                    </div>
                </div>
                
                <div class="chart-bar">
                    <div class="chart-bar-label">
                        <span>✅ Validity <span style="font-size: 0.85em; color: #6c757d;">（構文・ビルドの正当性）</span></span>
                        <span><strong>${stats.fourAxisEvaluation.validity.goodRatio}%</strong> (${Object.values(stats.fourAxisEvaluation.validity.labelCounts).reduce((a, b) => a + b, 0)}件)</span>
                    </div>
                    <div class="chart-bar-bg">
                        <div class="chart-bar-fill" style="width: ${stats.fourAxisEvaluation.validity.goodRatio}%; background: #28a745;"></div>
                    </div>
                    <div style="font-size: 0.8em; color: #6c757d; margin-left: 10px; margin-top: 5px;">
                        ${Object.entries(stats.fourAxisEvaluation.validity.labelCounts).map(([label, count]) => `${label}: ${count}件`).join(', ')}
                    </div>
                </div>
            </div>
            ` : (stats.fourAxisEvaluation.accuracy.scores && stats.fourAxisEvaluation.accuracy.scores.length > 0) ? `
            <div style="margin-top: 15px;">
                <h4 style="margin-bottom: 10px; color: #495057;">📈 スコア詳細（旧形式）</h4>
                <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin-bottom: 10px; border-radius: 4px;">
                    <p style="margin: 0; font-size: 0.85em; color: #856404;">
                        このデータは旧形式で保存されています。新しい評価を実行すると、ラベルベースの詳細が表示されます。
                    </p>
                </div>
                
                <div class="chart-bar">
                    <div class="chart-bar-label">
                        <span>🎯 Accuracy</span>
                        <span><strong>${(stats.fourAxisEvaluation.accuracy.average * 100).toFixed(1)}%</strong> (平均スコア)</span>
                    </div>
                    <div class="chart-bar-bg">
                        <div class="chart-bar-fill bar-identical" style="width: ${stats.fourAxisEvaluation.accuracy.average * 100}%"></div>
                    </div>
                </div>
                
                <div class="chart-bar">
                    <div class="chart-bar-label">
                        <span>🧠 Decision Soundness</span>
                        <span><strong>${(stats.fourAxisEvaluation.decisionSoundness.average * 100).toFixed(1)}%</strong> (平均スコア)</span>
                    </div>
                    <div class="chart-bar-bg">
                        <div class="chart-bar-fill bar-equivalent" style="width: ${stats.fourAxisEvaluation.decisionSoundness.average * 100}%"></div>
                    </div>
                </div>
                
                <div class="chart-bar">
                    <div class="chart-bar-label">
                        <span>🧭 Directional Consistency</span>
                        <span><strong>${(stats.fourAxisEvaluation.directionalConsistency.average * 100).toFixed(1)}%</strong> (平均スコア)</span>
                    </div>
                    <div class="chart-bar-bg">
                        <div class="chart-bar-fill bar-plausible" style="width: ${stats.fourAxisEvaluation.directionalConsistency.average * 100}%"></div>
                    </div>
                </div>
                
                <div class="chart-bar">
                    <div class="chart-bar-label">
                        <span>✅ Validity</span>
                        <span><strong>${(stats.fourAxisEvaluation.validity.average * 100).toFixed(1)}%</strong> (平均スコア)</span>
                    </div>
                    <div class="chart-bar-bg">
                        <div class="chart-bar-fill" style="width: ${stats.fourAxisEvaluation.validity.average * 100}%; background: #28a745;"></div>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
        ` : ''}

        <div class="stat-card" style="margin-bottom: 20px;">
            <h3>🎯 最終カテゴリー分布（4軸評価からの判定）</h3>
            <p style="font-size: 0.9em; color: #6c757d; margin-bottom: 15px;">
                <strong>対象:</strong> 全${total}件中、評価対象${totalEvaluated}件
                ${(() => {
                    const skipDetails = stats.skipDetails || stats.llmEvaluationResults?.skipDetails || {};
                    const noOpCount = skipDetails.noOpCount || 0;
                    const errorCount = skipDetails.errorCount || 0;
                    if (noOpCount > 0 || errorCount > 0) {
                        return `（🏁NO-OP ${noOpCount}件 + ❌ERROR ${errorCount}件 を除く）`;
                    }
                    return `（SKIPPED ${correctness.SKIPPED || 0}件を除く）`;
                })()}<br>
                <span style="font-size: 0.85em; color: #6c757d;">※Accuracyレベルに基づく3段階分類（CORRECT/PLAUSIBLE/INCORRECT）+ SKIPPED（NO-OP/ERROR）</span>
            </p>
            
            ${correctness.CORRECT === 0 && correctness.PLAUSIBLE === 0 && correctness.INCORRECT === 0 && correctness.SKIPPED === total ? `
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
                <p style="margin: 0; font-size: 0.9em; color: #856404;">
                    <strong>⚠️ 4軸評価（LLM_B）が実施されていません</strong><br>
                    <span style="font-size: 0.85em; margin-top: 5px; display: block;">
                    このデータセットでは4軸評価が未実施のため、CORRECT/PLAUSIBLE/INCORRECTの分類ができません。<br>
                    Intent Fulfillment評価（LLM_C）は実施済みです。下部のIntent Fulfillment評価セクションをご確認ください。
                    </span>
                </p>
            </div>
            ` : ''}
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>✅ 正解（CORRECT）</span>
                    <span><strong>${correctness.CORRECT}件/${totalEvaluated}件</strong> (${totalEvaluated > 0 ? (correctness.CORRECT / totalEvaluated * 100).toFixed(1) : 0}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-identical" style="width: ${totalEvaluated > 0 ? correctness.CORRECT / totalEvaluated * 100 : 0}%"></div>
                </div>
            </div>
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>⚠️ 妥当（PLAUSIBLE）</span>
                    <span><strong>${correctness.PLAUSIBLE}件/${totalEvaluated}件</strong> (${totalEvaluated > 0 ? (correctness.PLAUSIBLE / totalEvaluated * 100).toFixed(1) : 0}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-plausible" style="width: ${totalEvaluated > 0 ? correctness.PLAUSIBLE / totalEvaluated * 100 : 0}%"></div>
                </div>
            </div>
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>❌ 不正解（INCORRECT）</span>
                    <span><strong>${correctness.INCORRECT}件/${totalEvaluated}件</strong> (${totalEvaluated > 0 ? (correctness.INCORRECT / totalEvaluated * 100).toFixed(1) : 0}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-incorrect" style="width: ${totalEvaluated > 0 ? correctness.INCORRECT / totalEvaluated * 100 : 0}%"></div>
                </div>
            </div>
            
            ${correctness.SKIPPED > 0 ? `
            <!-- NO-OPとERRORを分離表示 -->
            ${(() => {
                const skipDetails = stats.skipDetails || stats.llmEvaluationResults?.skipDetails || {};
                const noOpCount = skipDetails.noOpCount || 0;
                const errorCount = skipDetails.errorCount || 0;
                const hasBreakdown = noOpCount > 0 || errorCount > 0;
                
                if (hasBreakdown) {
                    return `
                    <div class="chart-bar">
                        <div class="chart-bar-label">
                            <span>🏁 NO-OP（修正不要判断）</span>
                            <span><strong>${noOpCount}件/${total}件</strong> (${(noOpCount / total * 100).toFixed(1)}%)</span>
                        </div>
                        <div class="chart-bar-bg">
                            <div class="chart-bar-fill" style="width: ${noOpCount / total * 100}%; background: #17a2b8;"></div>
                        </div>
                    </div>
                    
                    <div class="chart-bar">
                        <div class="chart-bar-label">
                            <span>❌ APRエラー（失敗）</span>
                            <span><strong>${errorCount}件/${total}件</strong> (${(errorCount / total * 100).toFixed(1)}%)</span>
                        </div>
                        <div class="chart-bar-bg">
                            <div class="chart-bar-fill" style="width: ${errorCount / total * 100}%; background: #dc3545;"></div>
                        </div>
                    </div>
                    `;
                } else {
                    return `
                    <div class="chart-bar">
                        <div class="chart-bar-label">
                            <span>⏭️ スキップ/エラー</span>
                            <span><strong>${correctness.SKIPPED}件/${total}件</strong> (${(correctness.SKIPPED / total * 100).toFixed(1)}%)</span>
                        </div>
                        <div class="chart-bar-bg">
                            <div class="chart-bar-fill" style="width: ${correctness.SKIPPED / total * 100}%; background: #6c757d;"></div>
                        </div>
                    </div>
                    `;
                }
            })()}
            ` : ''}
            
            <div style="background-color: #f8f9fa; border-radius: 4px; padding: 15px; margin-top: 20px; font-size: 0.85em;">
                <h4 style="margin: 0 0 10px 0; color: #495057; font-size: 0.95em;">📋 カテゴリー判定基準</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #e9ecef;">
                            <th style="padding: 8px; text-align: left; border: 1px solid #dee2e6;">カテゴリー</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #dee2e6;">説明</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #dee2e6;"><strong>✅ CORRECT</strong></td>
                            <td style="padding: 8px; border: 1px solid #dee2e6;">Ground Truthと機能的に等価な修正（Accuracy: IDENTICAL, SEMANTICALLY_EQUIVALENT）</td>
                        </tr>
                        <tr style="background-color: #f8f9fa;">
                            <td style="padding: 8px; border: 1px solid #dee2e6;"><strong>⚠️ PLAUSIBLE</strong></td>
                            <td style="padding: 8px; border: 1px solid #dee2e6;">妥当だが異なるアプローチ（Accuracy: PARTIALLY_CORRECT, CORRECT_LOCUS）</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #dee2e6;"><strong>❌ INCORRECT</strong></td>
                            <td style="padding: 8px; border: 1px solid #dee2e6;">不正解な修正（Accuracy: WRONG_APPROACH, NO_MATCH）</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        ${stats.intentFulfillmentEvaluation ? `
        <div class="stat-card" style="margin-bottom: 20px;">
            <h3>🎯 Intent Fulfillment評価 (LLM_C) - 意図達成度評価</h3>
            <p style="font-size: 0.9em; color: #6c757d; margin-bottom: 15px;">
                <strong>評価対象:</strong> ${stats.intentFulfillmentEvaluation.totalEvaluated}件/${total}件（<strong>全ケース：パッチ生成＋No-op判定</strong>）<br>
                <span style="color: #495057;">🎯 <strong>評価内容:</strong> コミットメッセージ（自然言語）に基づき、<strong>最終判断の妥当性</strong>を評価</span><br>
                <span style="font-size: 0.85em; color: #6c757d;">※パッチ生成ケース＝実装が意図を満たすか / No-op判定ケース＝修正不要の判断が妥当か</span><br>
                <span style="font-size: 0.8em; color: #999; margin-top: 5px; display: block; font-style: italic;">📝 <strong>Directional Consistencyとの違い:</strong> DCは「人間コードとの非矛盾」、IFは「自然言語意図の達成度」</span>
            </p>
            
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin-bottom: 15px; border-radius: 4px;">
                <p style="margin: 0; font-size: 0.85em; color: #856404;">
                    <strong>📊 評価方式:</strong> 離散カテゴリ（5段階enum）による件数カウントのみ。スコアはラベルから自動決定。
                </p>
            </div>
            
            ${stats.intentFulfillmentEvaluation.totalEvaluated > 0 ? `
            
            <div class="chart-bar" style="margin-top: 15px;">
                <div class="chart-bar-label">
                    <span>🟢 INTENT_FULFILLED <span style="font-size: 0.85em; color: #6c757d;">- 意図を満たしている</span></span>
                    <span><strong>${stats.intentFulfillmentEvaluation.levelCounts?.INTENT_FULFILLED || 0}件/${stats.intentFulfillmentEvaluation.totalEvaluated}件</strong> (${(((stats.intentFulfillmentEvaluation.levelCounts?.INTENT_FULFILLED || 0) / stats.intentFulfillmentEvaluation.totalEvaluated) * 100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-identical" style="width: ${((stats.intentFulfillmentEvaluation.levelCounts?.INTENT_FULFILLED || 0) / stats.intentFulfillmentEvaluation.totalEvaluated) * 100}%"></div>
                </div>
            </div>
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>🟡 INTENT_PARTIALLY_FULFILLED <span style="font-size: 0.85em; color: #6c757d;">- 意図を部分的に満たす</span></span>
                    <span><strong>${stats.intentFulfillmentEvaluation.levelCounts?.INTENT_PARTIALLY_FULFILLED || 0}件/${stats.intentFulfillmentEvaluation.totalEvaluated}件</strong> (${(((stats.intentFulfillmentEvaluation.levelCounts?.INTENT_PARTIALLY_FULFILLED || 0) / stats.intentFulfillmentEvaluation.totalEvaluated) * 100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-plausible" style="width: ${((stats.intentFulfillmentEvaluation.levelCounts?.INTENT_PARTIALLY_FULFILLED || 0) / stats.intentFulfillmentEvaluation.totalEvaluated) * 100}%"></div>
                </div>
            </div>
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>🟠 INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED <span style="font-size: 0.85em; color: #6c757d;">- 意図を理解したが未達成</span></span>
                    <span><strong>${stats.intentFulfillmentEvaluation.levelCounts?. INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED || 0}件/${stats.intentFulfillmentEvaluation.totalEvaluated}件</strong> (${(((stats.intentFulfillmentEvaluation.levelCounts?.INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED || 0) / stats.intentFulfillmentEvaluation.totalEvaluated) * 100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill" style="background-color: #fd7e14; width: ${((stats.intentFulfillmentEvaluation.levelCounts?.INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED || 0) / stats.intentFulfillmentEvaluation.totalEvaluated) * 100}%"></div>
                </div>
            </div>
            
            <div class="chart-bar">
                <div class="chart-bar-label">
                    <span>🔴 INTENT_NOT_FULFILLED <span style="font-size: 0.85em; color: #6c757d;">- 意図を満たさない</span></span>
                    <span><strong>${stats.intentFulfillmentEvaluation.levelCounts?.INTENT_NOT_FULFILLED || 0}件/${stats.intentFulfillmentEvaluation.totalEvaluated}件</strong> (${(((stats.intentFulfillmentEvaluation.levelCounts?.INTENT_NOT_FULFILLED || 0) / stats.intentFulfillmentEvaluation.totalEvaluated) * 100).toFixed(1)}%)</span>
                </div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill bar-incorrect" style="width: ${((stats.intentFulfillmentEvaluation.levelCounts?.INTENT_NOT_FULFILLED || 0) / stats.intentFulfillmentEvaluation.totalEvaluated) * 100}%"></div>
                </div>
            </div>
            
            <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
                <p style="margin: 0; font-size: 0.85em; color: #6c757d;">
                    <strong>📋 評価対象外:</strong> スキップ ${stats.intentFulfillmentEvaluation.totalSkipped}件、エラー ${stats.intentFulfillmentEvaluation.totalError}件
                </p>
            </div>
            ` : `
            <div style="background-color: #f0f0f0; border-left: 4px solid #999; padding: 15px; margin-top: 15px; border-radius: 4px;">
                <p style="margin: 0; font-size: 0.9em; color: #495057;">
                    <strong>ℹ️ まだIntent Fulfillment評価が実行されていません</strong><br>
                    <span style="font-size: 0.85em; color: #6c757d; margin-top: 5px; display: block;">
                    評価を実行すると、4段階の離散カテゴリ（INTENT_FULFILLED / INTENT_PARTIALLY_FULFILLED / INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED / INTENT_NOT_FULFILLED）による統計が表示されます。
                    </span>
                </p>
            </div>
            `}
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
            
            ${Object.keys(stats.repairTypes || {}).length > 0 ? `
            <div class="stat-card">
                <h3>🔧 修正タイプ</h3>
                <ul class="model-list">
                    ${Object.entries(stats.repairTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) => `
                        <li class="model-item">
                            <span class="model-name" style="font-size: 0.85em;">${formatRepairType(type)}</span>
                            <span class="model-count">${count}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}
        </div>
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

    // 状態保存用
    if (!state.prFilters) {
        state.prFilters = {
            status: 'all',
            aprStatus: 'all',
            finalCategory: 'all',
            intentFulfillment: 'all',
            sortBy: 'default'
        };
    }

    // フィルター適用
    let filteredPRs = prs.filter(pr => {
        // 評価ステータスフィルター（NO-OP/APR-ERROR対応）
        if (state.prFilters.status !== 'all') {
            if (state.prFilters.status === 'NO-OP') {
                // NO-OP: SKIPPED + APR FINISHED
                if (!(pr.status === 'SKIPPED' && pr.aprStatus === 'FINISHED')) return false;
            } else if (state.prFilters.status === 'APR-ERROR') {
                // APR-ERROR: SKIPPED + APR ERROR
                if (!(pr.status === 'SKIPPED' && pr.aprStatus === 'ERROR')) return false;
            } else if (pr.status !== state.prFilters.status) {
                return false;
            }
        }
        if (state.prFilters.aprStatus !== 'all' && pr.aprStatus !== state.prFilters.aprStatus) return false;
        if (state.prFilters.finalCategory !== 'all' && pr.finalCategory !== state.prFilters.finalCategory) return false;
        
        // Intent Fulfillmentフィルター
        if (state.prFilters.intentFulfillment !== 'all') {
            const intent = pr.intentFulfillmentEvaluation;
            if (!intent || intent.status !== 'evaluated') {
                // 評価されていない場合は「評価なし」フィルターのみ通す
                if (state.prFilters.intentFulfillment !== 'none') return false;
            } else {
                // スコアによるフィルタリング
                const score = intent.score;
                if (state.prFilters.intentFulfillment === 'high' && score < 0.9) return false;
                if (state.prFilters.intentFulfillment === 'medium' && (score < 0.7 || score >= 0.9)) return false;
                if (state.prFilters.intentFulfillment === 'low' && (score < 0.4 || score >= 0.7)) return false;
                if (state.prFilters.intentFulfillment === 'very-low' && score >= 0.4) return false;
                if (state.prFilters.intentFulfillment === 'none') return false; // 評価ありは除外
            }
        }
        
        return true;
    });

    // ソート適用
    if (state.prFilters.sortBy === 'lines-desc') {
        filteredPRs.sort((a, b) => (b.modifiedLines || 0) - (a.modifiedLines || 0));
    } else if (state.prFilters.sortBy === 'lines-asc') {
        filteredPRs.sort((a, b) => (a.modifiedLines || 0) - (b.modifiedLines || 0));
    } else if (state.prFilters.sortBy === 'name') {
        filteredPRs.sort((a, b) => a.prName.localeCompare(b.prName));
    } else if (state.prFilters.sortBy === 'project') {
        filteredPRs.sort((a, b) => a.projectName.localeCompare(b.projectName));
    }

    // ユニークなAPRステータスリストを取得
    const uniqueAPRStatuses = [...new Set(prs.map(pr => pr.aprStatus).filter(Boolean))];

    contentBody.innerHTML = `
        <div style="margin-bottom: 20px;">
            <button class="btn" onclick="loadReportStatistics('${state.currentReport}')">
                ← 統計サマリーに戻る
            </button>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 15px 0;">🔍 フィルター & ソート</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">評価ステータス:</label>
                    <select id="filter-status" class="filter-select" onchange="updatePRFilters()" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ced4da;">
                        <option value="all">すべて (${prs.length})</option>
                        <option value="EVALUATED">✅ 評価完了 (${prs.filter(p => p.status === 'EVALUATED').length})</option>
                        <option value="SKIPPED">⏭️ 全スキップ (${prs.filter(p => p.status === 'SKIPPED').length})</option>
                        <option value="NO-OP">🏁 NO-OP (${prs.filter(p => p.status === 'SKIPPED' && p.aprStatus === 'FINISHED').length})</option>
                        <option value="APR-ERROR">❌ APRエラー (${prs.filter(p => p.status === 'SKIPPED' && p.aprStatus === 'ERROR').length})</option>
                        <option value="ERROR">❌ 評価エラー (${prs.filter(p => p.status === 'ERROR').length})</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">APR終了ステータス:</label>
                    <select id="filter-apr-status" class="filter-select" onchange="updatePRFilters()" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ced4da;">
                        <option value="all">すべて</option>
                        ${uniqueAPRStatuses.map(status => {
        const info = getAPRStatusInfo(status);
        return `<option value="${status}">${info.icon} ${info.text} (${prs.filter(p => p.aprStatus === status).length})</option>`;
    }).join('')}
                    </select>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">最終カテゴリー:</label>
                    <select id="filter-final-category" class="filter-select" onchange="updatePRFilters()" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ced4da;">
                        <option value="all">すべて</option>
                        <option value="CORRECT">✅ 正解 - ${prs.filter(p => p.finalCategory === 'CORRECT').length}件</option>
                        <option value="PLAUSIBLE">⚠️ 妥当 - ${prs.filter(p => p.finalCategory === 'PLAUSIBLE').length}件</option>
                        <option value="INCORRECT">❌ 不正解 - ${prs.filter(p => p.finalCategory === 'INCORRECT').length}件</option>
                        <option value="SKIPPED">⏭️ スキップ - ${prs.filter(p => p.finalCategory === 'SKIPPED').length}件</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">意図達成度 (LLM_C):</label>
                    <select id="filter-intent-fulfillment" class="filter-select" onchange="updatePRFilters()" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ced4da;">
                        <option value="all">すべて</option>
                        <option value="high">🎯 高 (≥90%) - ${prs.filter(p => p.intentFulfillmentEvaluation?.status === 'evaluated' && p.intentFulfillmentEvaluation.score >= 0.9).length}件</option>
                        <option value="medium">🎯 中 (70-89%) - ${prs.filter(p => p.intentFulfillmentEvaluation?.status === 'evaluated' && p.intentFulfillmentEvaluation.score >= 0.7 && p.intentFulfillmentEvaluation.score < 0.9).length}件</option>
                        <option value="low">🎯 低 (40-69%) - ${prs.filter(p => p.intentFulfillmentEvaluation?.status === 'evaluated' && p.intentFulfillmentEvaluation.score >= 0.4 && p.intentFulfillmentEvaluation.score < 0.7).length}件</option>
                        <option value="very-low">🎯 極低 (<40%) - ${prs.filter(p => p.intentFulfillmentEvaluation?.status === 'evaluated' && p.intentFulfillmentEvaluation.score < 0.4).length}件</option>
                        <option value="none">⏭️ 評価なし - ${prs.filter(p => !p.intentFulfillmentEvaluation || p.intentFulfillmentEvaluation.status !== 'evaluated').length}件</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">並び替え:</label>
                    <select id="sort-by" class="filter-select" onchange="updatePRFilters()" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ced4da;">
                        <option value="default">デフォルト順</option>
                        <option value="name">名前順</option>
                        <option value="project">プロジェクト順</option>
                        <option value="lines-desc">変更行数 (多→少)</option>
                        <option value="lines-asc">変更行数 (少→多)</option>
                    </select>
                </div>
            </div>
            <div style="margin-top: 10px; color: #6c757d; font-size: 0.9em;">
                表示中: <strong>${filteredPRs.length}</strong> / ${prs.length} 件
            </div>
        </div>
        
        <div class="pr-grid">
            ${filteredPRs.map(pr => {
        const badgeClass = getFinalCategoryClass(pr.finalCategory);
        const badgeText = getFinalCategoryText(pr.finalCategory);

        // 評価ステータスバッジ
        let statusBadge = '';
        if (pr.status) {
            const statusInfo = getStatusInfo(pr.status);
            statusBadge = `<div class="pr-info"><span class="status-badge ${statusInfo.class}">${statusInfo.icon} ${statusInfo.text}</span></div>`;
        }

        // APRステータスバッジ
        let aprStatusBadge = '';
        if (pr.aprStatus) {
            const aprInfo = getAPRStatusInfo(pr.aprStatus);
            aprStatusBadge = `<div class="pr-info"><span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 0.85em; background: ${aprInfo.color}; color: white; font-weight: 500;">${aprInfo.icon} ${aprInfo.text}</span></div>`;
        }

        // Intent Fulfillmentスコアのバッジ
        let intentBadge = '';
        if (pr.intentFulfillmentEvaluation) {
            const intent = pr.intentFulfillmentEvaluation;
            if (intent.status === 'evaluated') {
                const scoreClass = intent.score >= 0.9 ? 'badge-identical' :
                    intent.score >= 0.7 ? 'badge-equivalent' :
                        intent.score >= 0.4 ? 'badge-plausible' : 'badge-incorrect';
                intentBadge = `<div class="pr-info">意図達成度: <span class="correctness-badge ${scoreClass}" style="font-size: 0.8em;">🎯 ${(intent.score * 100).toFixed(0)}%</span></div>`;
            } else if (intent.status === 'skipped') {
                intentBadge = '<div class="pr-info" style="color: #6c757d;">意図達成度: 🎯 スキップ</div>';
            } else if (intent.status === 'error') {
                intentBadge = '<div class="pr-info" style="color: #dc3545;">意図達成度: 🎯 エラー</div>';
            }
        }

        return `
                    <div class="pr-card" onclick="selectPR('${encodeURIComponent(pr.datasetEntry)}')">
                        <h3 style="word-break: break-word; overflow-wrap: break-word; line-height: 1.4;">🐛 ${pr.prName}</h3>
                        <div class="pr-info">📦 ${pr.projectName}</div>
                        ${statusBadge}
                        ${aprStatusBadge}
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

    // フィルター状態を復元
    document.getElementById('filter-status').value = state.prFilters.status;
    document.getElementById('filter-apr-status').value = state.prFilters.aprStatus;
    document.getElementById('filter-final-category').value = state.prFilters.finalCategory;
    document.getElementById('filter-intent-fulfillment').value = state.prFilters.intentFulfillment;
    document.getElementById('sort-by').value = state.prFilters.sortBy;

    // 元のPRリストを保存
    state.allPRs = prs;
}

// PRフィルターの更新
function updatePRFilters() {
    state.prFilters = {
        status: document.getElementById('filter-status').value,
        aprStatus: document.getElementById('filter-apr-status').value,
        finalCategory: document.getElementById('filter-final-category').value,
        intentFulfillment: document.getElementById('filter-intent-fulfillment').value,
        sortBy: document.getElementById('sort-by').value
    };

    // PR一覧を再描画
    renderPRs(state.allPRs);
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
            // APRログデータも取得
            let aprLogData = null;
            try {
                const aprLogResponse = await fetch(`${API_BASE}/reports/${sessionId}/prs/${encodeURIComponent(datasetEntry)}/aprlog`);
                if (aprLogResponse.ok) {
                    const aprLogResult = await aprLogResponse.json();
                    if (aprLogResult.success) {
                        aprLogData = aprLogResult.data;
                    }
                }
            } catch (aprLogError) {
                console.warn('⚠️ APRログ取得失敗:', aprLogError);
            }

            await renderPRDetail(data.data, sessionId, datasetEntry, aprLogData);
        }
    } catch (error) {
        console.error('❌ PR detail loading error:', error);
        showError('PR詳細の読み込みに失敗しました');
    }
}

// PR詳細の描画
async function renderPRDetail(detail, sessionId, datasetEntry, aprLogData = null) {
    const contentBody = document.getElementById('contentBody');

    const badgeClass = getFinalCategoryClass(detail.finalCategory);
    const badgeText = getFinalCategoryText(detail.finalCategory);

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
            
            ${detail.skipSource || detail.errorSource ? renderErrorSkipSourceSection(detail) : ''}
            
            ${detail.evaluationReasoning ? `
            <div class="detail-section">
                <h3>評価理由 (LLM評価)</h3>
                <div class="detail-content">
                    <p>${detail.evaluationReasoning}</p>
                </div>
            </div>
            ` : ''}
            
            ${detail.fourAxisEvaluation ? renderFourAxisEvaluationSection(detail.fourAxisEvaluation) : ''}
            
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
            
            ${aprLogData ? renderAPRLogSection(aprLogData) : ''}
        </div>
    `;

    // Diff表示の初期化（DOMレンダリング完了後に実行）
    setTimeout(() => {
        initializeDiffViewer(5);  // デフォルト5行
        initializeAPRLogToggles();  // APRログのアコーディオン初期化
    }, 0);
}

// APRログセクションのレンダリング
function renderAPRLogSection(aprLogData) {
    if (!aprLogData || !aprLogData.dialogue) {
        return '<div class="detail-section"><h3>🤖 APRログ詳細</h3><p>APRログデータが利用できません</p></div>';
    }

    const dialogue = aprLogData.dialogue;
    const metadata = aprLogData.metadata || {};
    
    // ターン別詳細のHTML生成
    const turnsHtml = dialogue.turns && dialogue.turns.length > 0 ? dialogue.turns.map((turn, index) => {
        const turnId = `turn-${index}`;
        return `
            <div class="apr-turn-item" style="margin-bottom: 15px; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
                <button class="apr-log-toggle" aria-expanded="false" style="width: 100%; padding: 15px; background: #f8f9fa; border: none; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 500;">
                    <span>📊 ターン ${turn.turnNumber || index + 1} - ${turn.timestamp || 'N/A'}</span>
                    <span class="toggle-icon">▶</span>
                </button>
                <div class="apr-log-content" id="${turnId}" style="display: none; padding: 20px; background: white;">
                    ${turn.thought ? `
                        <div style="margin-bottom: 15px;">
                            <h4 style="color: #667eea; margin-bottom: 8px;">💭 思考プロセス</h4>
                            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; white-space: pre-wrap; word-break: break-word;">${escapeHtml(turn.thought)}</div>
                        </div>
                    ` : ''}
                    
                    ${turn.plan && turn.plan.length > 0 ? `
                        <div style="margin-bottom: 15px;">
                            <h4 style="color: #667eea; margin-bottom: 8px;">📋 実行計画</h4>
                            <ol style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 0;">
                                ${turn.plan.map(p => `<li style="margin-bottom: 8px;">${escapeHtml(JSON.stringify(p, null, 2))}</li>`).join('')}
                            </ol>
                        </div>
                    ` : ''}
                    
                    ${turn.requiredFiles && turn.requiredFiles.length > 0 ? `
                        <div style="margin-bottom: 15px;">
                            <h4 style="color: #667eea; margin-bottom: 8px;">📄 要求ファイル</h4>
                            <ul style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 0;">
                                ${turn.requiredFiles.map(f => `<li>${escapeHtml(f.path || f)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${turn.modifiedDiff ? `
                        <div style="margin-bottom: 15px;">
                            <h4 style="color: #667eea; margin-bottom: 8px;">🔧 修正内容</h4>
                            <pre style="background: #282c34; color: #abb2bf; padding: 15px; border-radius: 6px; overflow-x: auto; max-height: 300px;"><code>${escapeHtml(turn.modifiedDiff)}</code></pre>
                        </div>
                    ` : ''}
                    
                    ${turn.usage ? `
                        <div style="margin-bottom: 15px;">
                            <h4 style="color: #667eea; margin-bottom: 8px;">📊 トークン使用量</h4>
                            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px;">
                                <p style="margin: 4px 0;"><strong>Prompt:</strong> ${turn.usage.prompt_tokens?.toLocaleString() || 'N/A'}</p>
                                <p style="margin: 4px 0;"><strong>Completion:</strong> ${turn.usage.completion_tokens?.toLocaleString() || 'N/A'}</p>
                                <p style="margin: 4px 0;"><strong>Total:</strong> ${turn.usage.total_tokens?.toLocaleString() || 'N/A'}</p>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${turn.systemAction ? `
                        <div style="margin-bottom: 15px;">
                            <h4 style="color: #667eea; margin-bottom: 8px;">⚙️ システムアクション</h4>
                            <div style="background: #fff3cd; padding: 12px; border-radius: 6px;">
                                <p style="margin: 4px 0;"><strong>Type:</strong> ${turn.systemAction.type || 'N/A'}</p>
                                ${turn.systemAction.details ? `<p style="margin: 4px 0;"><strong>Details:</strong> ${escapeHtml(turn.systemAction.details)}</p>` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('') : '<p>ターンデータがありません</p>';

    return `
        <div class="detail-section" style="margin-top: 30px;">
            <h3>🤖 APRログ詳細</h3>
            <div class="detail-content">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9rem; color: #6c757d;">最終ステータス</div>
                        <div style="font-size: 1.3rem; font-weight: bold; color: #667eea; margin-top: 5px;">${metadata.statusDisplay || 'Unknown'}</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9rem; color: #6c757d;">総ターン数</div>
                        <div style="font-size: 1.3rem; font-weight: bold; color: #667eea; margin-top: 5px;">${metadata.totalTurns || 0}</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 0.9rem; color: #6c757d;">総トークン数</div>
                        <div style="font-size: 1.3rem; font-weight: bold; color: #667eea; margin-top: 5px;">${(metadata.totalTokens || 0).toLocaleString()}</div>
                    </div>
                </div>
            </div>
        </div>

        ${dialogue.allPlans && dialogue.allPlans.length > 0 ? `
        <div class="detail-section">
            <h3>📋 全計画の統合ビュー</h3>
            <div class="detail-content">
                ${dialogue.allPlans.map((plan, turnIdx) => {
                    // planが配列の場合（各ターンの計画がステップの配列）
                    if (Array.isArray(plan)) {
                        return `
                            <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
                                <div style="font-weight: bold; color: #667eea; margin-bottom: 12px; font-size: 1.05rem;">📌 ターン ${turnIdx + 1} の計画</div>
                                <div style="background: white; padding: 12px; border-radius: 6px;">
                                    ${plan.map((step, stepIdx) => `
                                        <div style="margin-bottom: ${stepIdx < plan.length - 1 ? '12px' : '0'}; padding-bottom: ${stepIdx < plan.length - 1 ? '12px' : '0'}; border-bottom: ${stepIdx < plan.length - 1 ? '1px solid #e9ecef' : 'none'};">
                                            <div style="display: flex; align-items: start; gap: 10px;">
                                                <div style="flex-shrink: 0; width: 24px; height: 24px; background: #667eea; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: bold;">${step.step || stepIdx + 1}</div>
                                                <div style="flex: 1;">
                                                    <div style="font-weight: 600; color: #495057; margin-bottom: 4px;">
                                                        ${step.action ? `🔧 ${step.action}` : 'アクション'}
                                                    </div>
                                                    ${step.filePath ? `
                                                        <div style="font-size: 0.9rem; color: #6c757d; margin-bottom: 4px;">
                                                            📄 <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">${step.filePath}</code>
                                                        </div>
                                                    ` : ''}
                                                    ${step.reason ? `
                                                        <div style="font-size: 0.9rem; color: #495057; margin-top: 6px;">
                                                            💡 ${escapeHtml(step.reason)}
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    } else {
                        // planがオブジェクトの場合
                        return `
                            <div style="margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 6px;">
                                <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 0.9rem;">${escapeHtml(JSON.stringify(plan, null, 2))}</pre>
                            </div>
                        `;
                    }
                }).join('')}
            </div>
        </div>
        ` : ''}

        ${dialogue.allThoughts && dialogue.allThoughts.length > 0 ? `
        <div class="detail-section">
            <h3>💭 全思考の統合ビュー</h3>
            <div class="detail-content">
                ${dialogue.allThoughts.map((thought, idx) => `
                    <div style="margin-bottom: 15px; padding: 12px; background: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">
                        <div style="font-weight: bold; color: #667eea; margin-bottom: 5px;">ターン ${idx + 1}</div>
                        <div style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(thought)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        ${dialogue.requestedFiles && dialogue.requestedFiles.length > 0 ? `
        <div class="detail-section">
            <h3>📄 要求ファイルリスト</h3>
            <div class="detail-content">
                <ul style="padding-left: 20px;">
                    ${dialogue.requestedFiles.map(file => `<li style="margin-bottom: 5px; word-break: break-word;">${escapeHtml(file.path || file)}</li>`).join('')}
                </ul>
            </div>
        </div>
        ` : ''}

        <div class="detail-section">
            <h3>📊 ターン別詳細</h3>
            <div class="detail-content">
                ${turnsHtml}
            </div>
        </div>
    `;
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

// APRログのアコーディオン機能を初期化
function initializeAPRLogToggles() {
    const toggleButtons = document.querySelectorAll('.apr-log-toggle');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const content = button.nextElementSibling;
            const icon = button.querySelector('.toggle-icon');
            
            if (content && content.classList.contains('apr-log-content')) {
                const isExpanded = content.style.display === 'block';
                
                if (isExpanded) {
                    content.style.display = 'none';
                    if (icon) icon.textContent = '▶';
                    button.setAttribute('aria-expanded', 'false');
                } else {
                    content.style.display = 'block';
                    if (icon) icon.textContent = '▼';
                    button.setAttribute('aria-expanded', 'true');
                }
            }
        });
    });
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
function getFinalCategoryClass(category) {
    const map = {
        'CORRECT': 'badge-identical',
        'PLAUSIBLE': 'badge-plausible',
        'INCORRECT': 'badge-incorrect',
        'SKIPPED': 'badge-plausible',
        'ERROR': 'badge-incorrect'
    };
    return map[category] || 'badge-plausible';
}

function getFinalCategoryText(category) {
    const map = {
        'CORRECT': '✅ 正解',
        'PLAUSIBLE': '⚠️ 妥当',
        'INCORRECT': '❌ 不正解',
        'SKIPPED': '⏭️ 評価スキップ',
        'ERROR': '❌ エラー'
    };
    return map[category] || category;
}

// 後方互換性のための旧関数（使用されなくなったが、念のため残す）
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
        'SKIPPED': '⏭️ 評価スキップ',
        'ERROR': '❌ エラー'
    };
    return map[level] || level;
}

// Intent Fulfillment評価セクションの描画
function renderIntentFulfillmentSection(intentEval) {
    if (!intentEval) return '';

    if (intentEval.status === 'evaluated') {
        // スコアに基づいたバッジクラスと基準ラベル
        const scoreClass = intentEval.score >= 0.9 ? 'badge-identical' :
            intentEval.score >= 0.7 ? 'badge-equivalent' :
                intentEval.score >= 0.4 ? 'badge-plausible' : 'badge-incorrect';

        let displayText = `${(intentEval.score * 100).toFixed(0)}%`;
        if (intentEval.score >= 0.9) {
            displayText = `${(intentEval.score * 100).toFixed(0)}% - 🎯 完全実装`;
        } else if (intentEval.score >= 0.7) {
            displayText = `${(intentEval.score * 100).toFixed(0)}% - ✅ 概ね実装`;
        } else if (intentEval.score >= 0.4) {
            displayText = `${(intentEval.score * 100).toFixed(0)}% - ⚠️ 部分実装`;
        } else {
            displayText = `${(intentEval.score * 100).toFixed(0)}% - ❌ 未対応`;
        }

        return `
            <div class="detail-section">
                <h3>🎯 Intent Fulfillment評価 (LLM_C)</h3>
                <div class="detail-content">
                    <p><strong>スコア:</strong> <span class="correctness-badge ${scoreClass}">${displayText}</span></p>
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

// 4軸評価セクションの描画
function renderFourAxisEvaluationSection(fourAxis) {
    if (!fourAxis) return '';

    // 各軸のスコアとラベル
    const axes = [
        {
            key: 'accuracy',
            label: 'Accuracy (正確性)',
            emoji: '🎯',
            description: 'Ground Truthとの一致度'
        },
        {
            key: 'decision_soundness',
            label: 'Decision Soundness (判断の妥当性)',
            emoji: '🧠',
            description: 'APRの意思決定の質'
        },
        {
            key: 'directional_consistency',
            label: 'Directional Consistency (方向性の一貫性)',
            emoji: '🧭',
            description: 'パッチ意図との整合性'
        },
        {
            key: 'validity',
            label: 'Validity (有効性)',
            emoji: '✅',
            description: '構文・ビルドの正当性'
        }
    ];

    // 各軸のスコアを表示
    let axesHtml = axes.map(axis => {
        const axisData = fourAxis[axis.key];
        if (!axisData) return '';

        // ラベルベースのシステムに対応（score または label を使用）
        const label = axisData.label;
        const score = axisData.score;
        
        let displayText = '';
        let badgeClass = '';

        if (label) {
            // 新しいラベルベースの評価システム
            if (axis.key === 'accuracy') {
                const labelMap = {
                    'IDENTICAL': { text: '🏆 完全一致', class: 'badge-identical' },
                    'SEMANTICALLY_EQUIVALENT': { text: '✨ 意味的等価', class: 'badge-equivalent' },
                    'PARTIALLY_CORRECT': { text: '⚠️ 部分的正解', class: 'badge-plausible' },
                    'LOCATION_ONLY': { text: '⚡ 位置のみ正確', class: 'badge-plausible' },
                    'DIFFERENT': { text: '❌ 不一致', class: 'badge-incorrect' }
                };
                const mapped = labelMap[label] || { text: label, class: 'badge-incorrect' };
                displayText = mapped.text;
                badgeClass = mapped.class;
            } else if (axis.key === 'decision_soundness') {
                const labelMap = {
                    'SOUND': { text: '✅ 妥当な判断', class: 'badge-identical' },
                    'UNSOUND': { text: '❌ 不適切な判断', class: 'badge-incorrect' }
                };
                const mapped = labelMap[label] || { text: label, class: 'badge-incorrect' };
                displayText = mapped.text;
                badgeClass = mapped.class;
            } else if (axis.key === 'directional_consistency') {
                const labelMap = {
                    'CONSISTENT': { text: '✅ 方向性一致', class: 'badge-identical' },
                    'INCONSISTENT': { text: '❌ 方向性矛盾', class: 'badge-incorrect' }
                };
                const mapped = labelMap[label] || { text: label, class: 'badge-incorrect' };
                displayText = mapped.text;
                badgeClass = mapped.class;
            } else if (axis.key === 'validity') {
                const labelMap = {
                    'VALID': { text: '✅ 有効なコード', class: 'badge-identical' },
                    'INVALID': { text: '❌ 無効なコード', class: 'badge-incorrect' }
                };
                const mapped = labelMap[label] || { text: label, class: 'badge-incorrect' };
                displayText = mapped.text;
                badgeClass = mapped.class;
            }
        } else if (score != null && !isNaN(score)) {
            // 旧スコアベースのシステム（互換性のため）
            const percentage = (score * 100).toFixed(0);
            badgeClass = score >= 0.9 ? 'badge-identical' :
                score >= 0.7 ? 'badge-equivalent' :
                    score >= 0.4 ? 'badge-plausible' : 'badge-incorrect';

            if (axis.key === 'accuracy') {
                if (score >= 1.0) {
                    displayText = `${percentage}% - 🏆 完全一致`;
                } else if (score >= 0.9) {
                    displayText = `${percentage}% - ✨ ほぼ完全`;
                } else if (score >= 0.7) {
                    displayText = `${percentage}% - ✅ 高類似性`;
                } else if (score >= 0.5) {
                    displayText = `${percentage}% - ⚠️ 部分一致`;
                } else if (score >= 0.2) {
                    displayText = `${percentage}% - ⚡ 位置正確`;
                } else {
                    displayText = `${percentage}% - ❌ 不一致`;
                }
            } else if (axis.key === 'decision_soundness') {
                displayText = score >= 1.0 ? `${percentage}% - ✅ 妥当な判断` : `${percentage}% - ❌ 不適切な判断`;
            } else if (axis.key === 'directional_consistency') {
                displayText = score >= 1.0 ? `${percentage}% - ✅ 方向性一致` : `${percentage}% - ❌ 方向性矛盾`;
            } else if (axis.key === 'validity') {
                displayText = score >= 1.0 ? `${percentage}% - ✅ 有効なコード` : `${percentage}% - ❌ 無効なコード`;
            }
        } else {
            // データなし
            displayText = 'N/A';
            badgeClass = 'badge-incorrect';
        }

        return `<div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;"><p style="margin: 0 0 8px 0;"><strong>${axis.emoji} ${axis.label}</strong> <span class="correctness-badge ${badgeClass}" style="margin-left: 10px;">${displayText}</span></p><p style="margin: 0 0 8px 0; font-size: 0.9em; color: #6c757d;">${axis.description}</p><p style="margin: 0; padding: 10px; background: white; border-radius: 5px; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap;">${axisData.reasoning || 'N/A'}</p></div>`;
    }).join('');

    // 全体評価
    const overallAssessment = fourAxis.overall_assessment || 'N/A';
    const assessmentBadgeClass = overallAssessment === 'IDENTICAL' ? 'badge-identical' :
        overallAssessment === 'SEMANTICALLY_EQUIVALENT' ? 'badge-equivalent' :
            overallAssessment === 'PLAUSIBLE' ? 'badge-plausible' : 'badge-incorrect';

    return `
        <div class="detail-section">
            <h3>📊 4軸評価 (LLM_B)</h3>
            <div class="detail-content">
                ${axesHtml}
                
                ${fourAxis.overall_assessment ? `<div style="margin-top: 15px; padding: 15px; background: #e7f3ff; border-radius: 8px;"><p style="margin: 0;"><strong>📋 総合評価:</strong> <span class="correctness-badge ${assessmentBadgeClass}" style="margin-left: 10px;">${overallAssessment}</span></p></div>` : ''}
                
                ${fourAxis.analysis_labels && fourAxis.analysis_labels.repair_types && fourAxis.analysis_labels.repair_types.length > 0 ? `<div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px;"><p style="margin: 0;"><strong>🔧 修正タイプ:</strong> ${fourAxis.analysis_labels.repair_types.join(', ')}</p></div>` : ''}
            </div>
        </div>
    `;
}

// エラー/スキップソースセクションの描画
function renderErrorSkipSourceSection(detail) {
    let html = '';

    // スキップソース
    if (detail.skipSource) {
        const isAPR = detail.skipSource === 'APR';
        const icon = isAPR ? '⏭️' : '⏯️';
        const title = isAPR ? 'APR側スキップ' : 'LLM評価側スキップ';
        const bgColor = isAPR ? '#fff3cd' : '#e7f3ff';

        html += `
            <div class="detail-section">
                <h3>${icon} ${title}</h3>
                <div class="detail-content" style="background: ${bgColor}; padding: 15px; border-radius: 5px;">
                    ${isAPR && detail.aprSkipReason ? `
                        <p><strong>スキップ理由:</strong> ${detail.aprSkipReason.reason || 'N/A'}</p>
                        ${detail.aprSkipReason.details ? `<p><strong>詳細:</strong> ${detail.aprSkipReason.details}</p>` : ''}
                        ${detail.aprSkipReason.metadata ? `<p style="font-size: 0.9em; color: #586069;"><strong>追加情報:</strong> ${JSON.stringify(detail.aprSkipReason.metadata)}</p>` : ''}
                    ` : ''}
                    ${!isAPR && detail.skipReason ? `<p><strong>スキップ理由:</strong> ${detail.skipReason}</p>` : ''}
                </div>
            </div>
        `;
    }

    // エラーソース
    if (detail.errorSource) {
        const isAPR = detail.errorSource === 'APR';
        const icon = '❌';
        const title = isAPR ? 'APR処理エラー' : 'LLM評価エラー';
        const bgColor = '#f8d7da';

        html += `
            <div class="detail-section">
                <h3>${icon} ${title}</h3>
                <div class="detail-content" style="background: ${bgColor}; padding: 15px; border-radius: 5px;">
                    ${detail.error ? `<p><strong>エラー内容:</strong> ${detail.error}</p>` : ''}
                    ${isAPR ? '<p>APR側の処理中にエラーが発生しました。エージェントが修正を生成できませんでした。</p>' :
                '<p>LLM評価の実行中にエラーが発生しました。</p>'}
                </div>
            </div>
        `;
    }

    return html;
}

// ステータス情報を取得するヘルパー関数
function getStatusInfo(status) {
    switch (status) {
        case 'EVALUATED':
            return { icon: '✅', text: '評価完了', class: 'status-evaluated' };
        case 'SKIPPED':
            return { icon: '⏭️', text: '評価スキップ', class: 'status-skipped' };
        case 'ERROR':
            return { icon: '❌', text: 'エラー', class: 'status-error' };
        case 'APR_NO_MODIFICATION':
            return { icon: '🚫', text: 'APR修正なし', class: 'status-no-mod' };
        case 'PENDING':
            return { icon: '⏳', text: '処理中', class: 'status-pending' };
        default:
            return { icon: '❓', text: status || 'N/A', class: 'status-unknown' };
    }
}

// APRステータス情報を取得するヘルパー関数
function getAPRStatusInfo(aprStatus) {
    if (!aprStatus) return null;

    // APRステータス定数マップ
    // ※ これらの定数は /app/patchEvaluation/src/types.js の APRStatus と同期している
    // ※ patchEvaluationは独立したコンテナで動作するため、親ディレクトリ(/app/src)からインポートできない
    const statusMap = {
        'FINISHED': { icon: '🏁', text: 'FINISHED', class: 'apr-status-finished', color: '#28a745' },
        'NO_CHANGES_NEEDED': { icon: '✓', text: 'NO_CHANGES_NEEDED', class: 'apr-status-no-changes', color: '#17a2b8' },
        'TIMEOUT': { icon: '⏱️', text: 'TIMEOUT', class: 'apr-status-timeout', color: '#ffc107' },
        'ERROR': { icon: '❌', text: 'ERROR', class: 'apr-status-error', color: '#dc3545' },
        'INVESTIGATION_PHASE': { icon: '🔍', text: 'INVESTIGATION_PHASE', class: 'apr-status-investigation', color: '#6f42c1' },
        'INCOMPLETE': { icon: '📊', text: 'NO_PROGRESS (推測)', class: 'apr-status-incomplete', color: '#17a2b8' }
    };

    // 新しいAPRシステムからの統一ステータスを直接使用
    // 後方互換性: 古いログファイルの文字列形式も受け入れる
    let normalizedStatus = aprStatus;
    if (!statusMap[aprStatus]) {
        // 古い形式の場合のみ正規化
        if (aprStatus.includes('Completed') && aprStatus.includes('No Changes')) {
            normalizedStatus = 'NO_CHANGES_NEEDED';
        } else if (aprStatus.includes('Completed')) {
            normalizedStatus = 'FINISHED';
        } else if (aprStatus.toLowerCase().includes('timeout')) {
            normalizedStatus = 'TIMEOUT';
        } else if (aprStatus.toLowerCase().includes('error')) {
            normalizedStatus = 'ERROR';
        } else if (aprStatus.toLowerCase().includes('investigation')) {
            normalizedStatus = 'INVESTIGATION_PHASE';
        } else if (aprStatus.includes('Incomplete')) {
            normalizedStatus = 'INCOMPLETE';
        }
    }

    return statusMap[normalizedStatus] || { icon: '❓', text: aprStatus, class: 'apr-status-unknown', color: '#6c757d' };
}

// 修正タイプをフォーマットするヘルパー関数
function formatRepairType(repairType) {
    const typeMap = {
        'INTERFACE_ADAPTATION': 'インターフェース適応',
        'PARTIAL_REPAIR': '部分的修正',
        'LOGIC_FIX': 'ロジック修正',
        'CONDITIONAL_CHANGE': '条件分岐変更',
        'SERIALIZATION_UPDATE': 'シリアル化更新',
        'FUNCTION_SIGNATURE_CHANGE': '関数シグネチャ変更',
        'ERROR_HANDLING_CHANGE': 'エラー処理変更',
        'SCHEMA_EVOLUTION': 'スキーマ進化',
        'TEST_ADAPTATION': 'テスト適応',
        'VALIDATION_ADDITION': 'バリデーション追加',
        'VARIABLE_REMOVAL': '変数削除',
        'DATA_TYPE_CHANGE': 'データ型変更',
        'CONTROL_FLOW_MODIFICATION': '制御フロー変更',
        'RESOURCE_MANAGEMENT': 'リソース管理',
        'CONCURRENCY_FIX': '並行性修正',
        'SECURITY_FIX': 'セキュリティ修正',
        'PERFORMANCE_OPTIMIZATION': 'パフォーマンス最適化',
        'CODE_REFACTORING': 'コードリファクタリング',
        'DEPENDENCY_UPDATE': '依存関係更新',
        'CONFIGURATION_CHANGE': '設定変更'
    };

    return typeMap[repairType] || repairType;
}

// 処理フロー統計の描画
function renderProcessingFlowStats(stats) {
    console.log('[renderProcessingFlowStats] Called with stats:', stats);

    const totalPRs = stats.totalPRs || 0;
    const evaluatedCount = stats.evaluationStatus?.evaluated || 0;
    const skippedCount = stats.correctnessDistribution?.skipped || 0;
    const errorCount = stats.evaluationStatus?.error || 0;
    
    // NO-OP/ERROR区別（skipDetailsから取得）- 両方のパスに対応
    const skipDetails = stats.skipDetails || stats.llmEvaluationResults?.skipDetails || {};
    const noOpCount = skipDetails.noOpCount || 0;
    const aprErrorInSkipCount = skipDetails.errorCount || 0;

    console.log('[renderProcessingFlowStats] Calculated values:', {
        totalPRs,
        evaluatedCount,
        skippedCount,
        errorCount,
        noOpCount,
        aprErrorInSkipCount
    });

    // APR処理成功数 = 評価完了 + スキップ（APR側）
    const aprSuccessCount = evaluatedCount + skippedCount;

    // 評価完了数（修正あり）
    const llmEvaluatedCount = evaluatedCount;

    // Intent Fulfillment評価数（スキップケース対象）
    const intentEvaluatedCount = stats.intentFulfillmentEvaluation?.totalEvaluated || 0;

    // 成功率計算
    const aprSuccessRate = totalPRs > 0 ? ((aprSuccessCount / totalPRs) * 100).toFixed(1) : 0;
    const llmEvaluationRate = aprSuccessCount > 0 ? ((llmEvaluatedCount / aprSuccessCount) * 100).toFixed(1) : 0;
    const intentEvaluationRate = aprSuccessCount > 0 ? ((intentEvaluatedCount / aprSuccessCount) * 100).toFixed(1) : 0;

    return `
        <div class="processing-flow-stats" style="margin-top: 20px;">
            <h3 style="margin-bottom: 15px; color: #495057;">📊 データセット処理フロー統計</h3>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <!-- ステップ1: データセット総数 -->
                <div class="flow-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 5px;">📦 データセット総数</div>
                    <div style="font-size: 2.5em; font-weight: bold;">${totalPRs}</div>
                    <div style="font-size: 0.85em; opacity: 0.8; margin-top: 5px;">件</div>
                </div>
                
                <!-- ステップ2: APR処理成功 -->
                <div class="flow-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 5px;">🤖 APR処理成功</div>
                    <div style="font-size: 2.5em; font-weight: bold;">${aprSuccessCount}</div>
                    <div style="font-size: 0.85em; opacity: 0.8; margin-top: 5px;">
                        ${totalPRs}件中 (${aprSuccessRate}%)
                    </div>
                </div>
                
                <!-- ステップ3: LLM_B評価完了 -->
                <div class="flow-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 5px;">✅ LLM_B評価完了</div>
                    <div style="font-size: 2.5em; font-weight: bold;">${llmEvaluatedCount}</div>
                    <div style="font-size: 0.85em; opacity: 0.8; margin-top: 5px;">
                        ${aprSuccessCount}件中 (${llmEvaluationRate}%)
                    </div>
                    <div style="font-size: 0.75em; opacity: 0.7; margin-top: 3px;">パッチが生成されたケース</div>
                </div>
                
                <!-- ステップ4: LLM_C評価完了 -->
                <div class="flow-card" style="background: linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%); color: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 5px;">🎯 LLM_C評価完了</div>
                    <div style="font-size: 2.5em; font-weight: bold;">${intentEvaluatedCount}</div>
                    <div style="font-size: 0.85em; opacity: 0.8; margin-top: 5px;">
                        ${aprSuccessCount}件中 (${intentEvaluationRate}%)
                    </div>
                    <div style="font-size: 0.75em; opacity: 0.7; margin-top: 3px;">全ケース対象（パッチ生成 + No Changes Needed）</div>
                </div>
            </div>
            
            <!-- 処理フロー図 -->
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #667eea;">
                <h4 style="margin-bottom: 15px; color: #495057;">🔄 処理フローの推移</h4>
                <p style="font-size: 0.85em; color: #6c757d; margin-bottom: 15px; background: #fff3cd; padding: 10px; border-radius: 5px; border-left: 3px solid #ffc107;">
                    💡 <strong>「APR成功」と「APR終了ステータス」の違い:</strong><br>
                    • <strong>APR成功</strong> = 評価システムでパッチ抽出に成功した件数（LLM_B評価 + SKIPPED）<br>
                    • <strong>APR終了ステータス(Fin)</strong> = APRエージェントが正常終了した件数（ログ解析失敗分を含む）
                </p>
                <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <div class="flow-step">
                        <div class="flow-label" style="font-size: 0.85em; color: #6c757d;">データセット</div>
                        <div class="flow-value" style="font-size: 1.8em; font-weight: bold; color: #667eea;">${totalPRs}</div>
                    </div>
                    <div class="flow-arrow" style="font-size: 2em; color: #adb5bd;">→</div>
                    <div class="flow-step">
                        <div class="flow-label" style="font-size: 0.85em; color: #6c757d;">APR成功</div>
                        <div class="flow-value" style="font-size: 1.8em; font-weight: bold; color: #43e97b;">${aprSuccessCount}</div>
                        <div class="flow-sublabel" style="font-size: 0.75em; color: #6c757d;">-${totalPRs - aprSuccessCount} 解析失敗</div>
                    </div>
                    <div class="flow-arrow" style="font-size: 2em; color: #adb5bd;">→</div>
                    <div class="flow-step">
                        <div class="flow-label" style="font-size: 0.85em; color: #6c757d;">パッチ生成</div>
                        <div class="flow-value" style="font-size: 1.8em; font-weight: bold; color: #fa709a;">${llmEvaluatedCount}</div>
                        <div class="flow-sublabel" style="font-size: 0.75em; color: #6c757d;">LLM_B評価</div>
                    </div>
                    <div class="flow-arrow" style="font-size: 2em; color: #adb5bd;">→</div>
                    <div class="flow-step">
                        <div class="flow-label" style="font-size: 0.85em; color: #6c757d;">LLM_C評価</div>
                        <div class="flow-value" style="font-size: 1.8em; font-weight: bold; color: #a6c1ee;">${intentEvaluatedCount}</div>
                        <div class="flow-sublabel" style="font-size: 0.75em; color: #6c757d;">全ケース対象</div>
                    </div>
                </div>
                
                <!-- NO-OP/ERROR詳細 -->
                ${(noOpCount > 0 || aprErrorInSkipCount > 0) ? `
                <div style="margin-top: 15px; padding: 15px; background: #e9ecef; border-radius: 5px;">
                    <h5 style="margin: 0 0 10px 0; color: #495057; font-size: 0.95em;">📊 SKIPPED詳細（NO-OP vs ERROR）</h5>
                    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 150px; background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #17a2b8;">
                            <div style="font-size: 0.85em; color: #6c757d;">🏁 NO-OP（正常）</div>
                            <div style="font-size: 1.8em; font-weight: bold; color: #17a2b8;">${noOpCount}</div>
                            <div style="font-size: 0.75em; color: #6c757d;">APR成功 + 修正不要判断</div>
                        </div>
                        <div style="flex: 1; min-width: 150px; background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #dc3545;">
                            <div style="font-size: 0.85em; color: #6c757d;">❌ APRエラー</div>
                            <div style="font-size: 1.8em; font-weight: bold; color: #dc3545;">${aprErrorInSkipCount}</div>
                            <div style="font-size: 0.75em; color: #6c757d;">APR処理失敗</div>
                        </div>
                    </div>
                    <p style="margin: 10px 0 0 0; font-size: 0.8em; color: #6c757d;">
                        💡 NO-OPケースはIntent Fulfillment評価で「修正不要判断が妥当か」を評価
                    </p>
                </div>
                ` : ''}
                
                ${(errorCount > 0 && noOpCount === 0 && aprErrorInSkipCount === 0) ? `
                <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px; border-left: 3px solid #ffc107;">
                    <span style="font-size: 0.9em; color: #856404;">⚠️ エラー: ${errorCount}件</span>
                </div>
                ` : ''}
                
                <!-- APR終了ステータス分布を統合 -->
                ${Object.keys(stats.aprStatusDistribution || {}).length > 0 ? `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <h5 style="margin-bottom: 12px; color: #495057; font-size: 1em;">🤖 APR終了ステータス分布</h5>
                    <p style="font-size: 0.85em; color: #6c757d; margin-bottom: 12px;">
                        APRエージェントが各ケースでどのステータスで終了したかの分布
                    </p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
                        ${Object.entries(stats.aprStatusDistribution).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
        const percentage = ((count / totalPRs) * 100).toFixed(1);
        let emoji = '📊';
        let color = '#667eea';

        if (status === 'Completed (No Changes Needed)') {
            emoji = '⏭️';
            color = '#6c757d';
        } else if (status === 'Completed (Implicit)') {
            emoji = '✅';
            color = '#28a745';
        } else if (status === 'Incomplete') {
            emoji = '⚠️';
            color = '#ffc107';
        } else if (status === 'Fin') {
            emoji = '✅';
            color = '#28a745';
        } else if (status === 'No Changes Need') {
            emoji = '⏭️';
            color = '#6c757d';
        } else if (status === 'Generated Files Only') {
            emoji = '📄';
            color = '#17a2b8';
        } else if (status === 'Investigation Only') {
            emoji = '🔍';
            color = '#ffc107';
        } else if (status.includes('Error') || status.includes('error')) {
            emoji = '❌';
            color = '#dc3545';
        }

        return `
                                <div style="background: white; padding: 12px; border-radius: 8px; text-align: center; border: 1px solid #e9ecef;">
                                    <div style="font-size: 1.8em; font-weight: bold; color: ${color};">${count}</div>
                                    <div style="font-size: 0.8em; color: #495057; margin-top: 4px;">${emoji} ${status}</div>
                                    <div style="font-size: 0.75em; color: #6c757d; margin-top: 3px;">${percentage}%</div>
                                </div>
                            `;
    }).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function showError(message) {
    const contentBody = document.getElementById('contentBody');
    contentBody.innerHTML = `<div class="error">❌ ${message}</div>`;
}
