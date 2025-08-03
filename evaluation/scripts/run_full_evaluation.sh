#!/bin/bash
# 全ログ評価実行スクリプト
# すべてのプロジェクトのログに対して評価を実行

echo "🔥 全APRログ評価システム - 完全実行"
echo "=================================="

# .envファイルから環境変数を読み込み
if [ -f "/app/.env" ]; then
    echo "📄 .envファイルが見つかりました。環境変数を読み込み中..."
    export $(grep -v '^#' /app/.env | xargs)
    echo "✅ .envファイルから環境変数を読み込みました"
    echo ""
fi

# OpenAI APIキーの確認
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OpenAI APIキーが設定されていません"
    echo ""
    echo "📋 MockLLMで全評価を実行します（テスト用）"
    PROVIDER="mock"
    MODEL="mock-gpt"
    echo "🎭 プロバイダー: ${PROVIDER}, モデル: ${MODEL}"
else
    echo "✅ OpenAI APIキーが設定されています"
    echo ""
    echo "💡 評価モードを選択してください:"
    echo "1. Mock LLM（テスト用・高速・無料）"
    echo "2. OpenAI gpt-4.1-mini（高品質・低コスト）"
    echo "3. OpenAI gpt-4.1（最高品質・高コスト）"
    echo ""
    read -p "選択 (1-3, デフォルト:1): " -n 1 -r
    echo
    
    case $REPLY in
        2)
            PROVIDER="openai"
            MODEL="gpt-4.1-mini"
            ;;
        3)
            PROVIDER="openai"
            MODEL="gpt-4.1"
            ;;
        *)
            PROVIDER="mock"
            MODEL="mock-gpt"
            ;;
    esac
    
    echo "🤖 選択されたプロバイダー: ${PROVIDER}"
    echo "🧠 選択されたモデル: ${MODEL}"
fi

echo ""

# 利用可能なプロジェクト一覧を取得
echo "📊 プロジェクト統計情報を取得中..."
cd /app && python3 -c "
import sys
sys.path.append('/app/src')
from utils.log_iterator import APRLogIterator

iterator = APRLogIterator('/app')
stats = iterator.get_statistics()

print(f'📈 総プロジェクト数: {stats[\"total_projects\"]}')
print(f'📈 総ログ数: {stats[\"overall\"][\"total_logs\"]}')
print()

print('📋 プロジェクト別ログ数:')
projects = []
for project_name, project_stats in sorted(stats['projects'].items()):
    log_count = project_stats['total_logs']
    print(f'  {project_name:20s}: {log_count:3d}ログ')
    projects.append((project_name, log_count))

import json
with open('/tmp/project_stats.json', 'w') as f:
    json.dump(projects, f)
"

# プロジェクト情報を読み込み
PROJECTS=$(python3 -c "
import json
with open('/tmp/project_stats.json', 'r') as f:
    projects = json.load(f)
print(' '.join([p[0] for p in projects]))
")

echo ""
echo "🚀 全プロジェクト評価を開始しますか？"
echo "対象プロジェクト: ${PROJECTS}"
echo "プロバイダー: ${PROVIDER} (${MODEL})"
echo ""
read -p "実行しますか? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "⏹️ 実行をキャンセルしました"
    exit 0
fi

# 開始時刻記録
START_TIME=$(date +%s)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo ""
echo "🔥 全APRログ評価開始 - ${TIMESTAMP}"
echo "======================================"

# ログ保存ディレクトリ構造を作成
BASE_LOG_DIR="/app/logs"
SESSION_DIR="${BASE_LOG_DIR}/full_evaluation_${TIMESTAMP}"
RESULTS_DIR="${SESSION_DIR}/results"
DETAILED_DIR="${SESSION_DIR}/detailed_responses"
SUMMARY_DIR="${SESSION_DIR}/summaries"

mkdir -p "${RESULTS_DIR}"
mkdir -p "${DETAILED_DIR}"
mkdir -p "${SUMMARY_DIR}"

# 統合ログファイル作成
LOG_FILE="${SESSION_DIR}/full_evaluation.log"
exec > >(tee -a "${LOG_FILE}")
exec 2>&1

echo "📁 セッション保存先: ${SESSION_DIR}"
echo "📋 統合ログ: ${LOG_FILE}"
echo "📊 評価結果: ${RESULTS_DIR}"
echo "🔍 詳細レスポンス: ${DETAILED_DIR}"
echo "📈 サマリー: ${SUMMARY_DIR}"
echo ""

# 各プロジェクトを順次評価
TOTAL_PROCESSED=0
TOTAL_SUCCESS=0
TOTAL_FAILED=0

for PROJECT in ${PROJECTS}; do
    echo ""
    echo "🔄 ================================"
    echo "🔄 プロジェクト: ${PROJECT}"
    echo "🔄 ================================"
    
    PROJECT_START=$(date +%s)
    
    # 評価実行
    if cd /app && python scripts/real_llm_evaluator.py --repo "${PROJECT}" --max-logs 999 --provider "${PROVIDER}" --model "${MODEL}"; then
        PROJECT_END=$(date +%s)
        PROJECT_TIME=$((PROJECT_END - PROJECT_START))
        
        echo "✅ ${PROJECT} 評価完了 (${PROJECT_TIME}秒)"
        ((TOTAL_SUCCESS++))
        
        # プロジェクト別ディレクトリ作成（APRログ構造に合わせる）
        PROJECT_RESULTS_DIR="${RESULTS_DIR}/${PROJECT}"
        PROJECT_DETAILED_DIR="${DETAILED_DIR}/${PROJECT}"
        mkdir -p "${PROJECT_RESULTS_DIR}"
        mkdir -p "${PROJECT_DETAILED_DIR}"
        
        # 評価結果ファイルを整理してコピー
        LATEST_RESULT=$(ls -t /app/verification_results/real_llm_analysis_${PROJECT}_*.json 2>/dev/null | head -1)
        if [ -n "${LATEST_RESULT}" ]; then
            # ファイル名から詳細情報を抽出してリネーム
            RESULT_BASENAME=$(basename "${LATEST_RESULT}")
            CLEAN_NAME="${RESULT_BASENAME#real_llm_analysis_${PROJECT}_}"
            cp "${LATEST_RESULT}" "${PROJECT_RESULTS_DIR}/evaluation_result_${CLEAN_NAME}"
            echo "📋 評価結果保存: ${PROJECT_RESULTS_DIR}/evaluation_result_${CLEAN_NAME}"
            
            # 各ログファイルを個別にAPR構造に分ける
            echo "🔍 ${PROJECT} の個別ログファイルを構造化..."
            python3 -c "
import json
import os
from pathlib import Path

# 評価結果を読み込み
with open('${LATEST_RESULT}', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 詳細結果から個別ログ情報を抽出
if 'Mock_LLM' in data:
    detailed_results = data['Mock_LLM'].get('detailed_results', [])
elif 'Real_OPENAI_Analysis' in data:
    detailed_results = data['Real_OPENAI_Analysis'].get('detailed_results', [])
else:
    detailed_results = data.get('detailed_results', [])

for result in detailed_results:
    log_path = result.get('log_path', '')
    if log_path:
        # ログパスから repository/category/pr_name を抽出
        # 例: /app/apr-logs/boulder/pullrequest/Add_validated_timestamp_to_challenges/...
        path_parts = Path(log_path).parts
        if len(path_parts) >= 5 and 'apr-logs' in path_parts:
            apr_idx = path_parts.index('apr-logs')
            repo = path_parts[apr_idx + 1] if apr_idx + 1 < len(path_parts) else 'unknown'
            category = path_parts[apr_idx + 2] if apr_idx + 2 < len(path_parts) else 'unknown' 
            pr_name = path_parts[apr_idx + 3] if apr_idx + 3 < len(path_parts) else 'unknown'
            
            if repo == '${PROJECT}':
                # カテゴリ別ディレクトリ作成
                category_dir = Path('${PROJECT_RESULTS_DIR}') / category / pr_name
                category_dir.mkdir(parents=True, exist_ok=True)
                
                # 個別評価結果を保存
                individual_result = {
                    'repository': repo,
                    'category': category,
                    'pr_name': pr_name,
                    'evaluation_result': result,
                    'log_path': log_path,
                    'timestamp': '$(date -Iseconds)'
                }
                
                output_file = category_dir / 'evaluation_result.json'
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(individual_result, f, indent=2, ensure_ascii=False)
                
                print(f'📁 保存: {output_file}')
"
        fi
        
        # 詳細ログを整理してコピー
        LATEST_LOG=$(ls -t /app/logs/llm_responses_*.json 2>/dev/null | head -1)
        if [ -n "${LATEST_LOG}" ]; then
            LOG_BASENAME=$(basename "${LATEST_LOG}")
            cp "${LATEST_LOG}" "${PROJECT_DETAILED_DIR}/detailed_responses_${LOG_BASENAME}"
            echo "🔍 詳細ログ保存: ${PROJECT_DETAILED_DIR}/detailed_responses_${LOG_BASENAME}"
        fi
        
        # プロジェクト別サマリー作成
        PROJECT_SUMMARY="${SUMMARY_DIR}/${PROJECT}_summary.json"
        cat > "${PROJECT_SUMMARY}" << EOF
{
  "project": "${PROJECT}",
  "evaluation_time": "${PROJECT_TIME}",
  "status": "success",
  "timestamp": "$(date -Iseconds)",
  "result_file": "${PROJECT_RESULTS_DIR}/evaluation_result_${CLEAN_NAME:-unknown}",
  "detailed_log": "${PROJECT_DETAILED_DIR}/detailed_responses_${LOG_BASENAME:-unknown}"
}
EOF
        echo "📈 プロジェクトサマリー: ${PROJECT_SUMMARY}"
        
    else
        PROJECT_END=$(date +%s)
        PROJECT_TIME=$((PROJECT_END - PROJECT_START))
        
        echo "❌ ${PROJECT} 評価失敗 (${PROJECT_TIME}秒)"
        ((TOTAL_FAILED++))
        
        # エラーログをプロジェクト別に保存
        ERROR_DIR="${SESSION_DIR}/errors"
        mkdir -p "${ERROR_DIR}"
        ERROR_LOG="${ERROR_DIR}/${PROJECT}_error.log"
        echo "Error in ${PROJECT} at $(date -Iseconds)" >> "${ERROR_LOG}"
        echo "Duration: ${PROJECT_TIME} seconds" >> "${ERROR_LOG}"
        
        # 失敗プロジェクトのサマリー作成
        PROJECT_SUMMARY="${SUMMARY_DIR}/${PROJECT}_summary.json"
        cat > "${PROJECT_SUMMARY}" << EOF
{
  "project": "${PROJECT}",
  "evaluation_time": "${PROJECT_TIME}",
  "status": "failed",
  "timestamp": "$(date -Iseconds)",
  "error_log": "${ERROR_LOG}"
}
EOF
        echo "❌ エラーログ保存: ${ERROR_LOG}"
    fi
    
    ((TOTAL_PROCESSED++))
done

# 終了時刻記録
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

echo "🎉 ================================"
echo "🎉 全APRログ評価完了!"
echo "🎉 ================================"
echo "⏱️  総実行時間: ${TOTAL_TIME}秒 ($(($TOTAL_TIME / 60))分)"
echo "📊 処理プロジェクト数: ${TOTAL_PROCESSED}"
echo "✅ 成功: ${TOTAL_SUCCESS}"
echo "❌ 失敗: ${TOTAL_FAILED}"
echo "📁 セッション保存先: ${SESSION_DIR}"
echo ""

# 全体サマリーファイル作成
OVERALL_SUMMARY="${SESSION_DIR}/evaluation_summary.json"
cat > "${OVERALL_SUMMARY}" << EOF
{
  "evaluation_session": {
    "timestamp": "${TIMESTAMP}",
    "start_time": "$(date -d @${START_TIME} -Iseconds)",
    "end_time": "$(date -d @${END_TIME} -Iseconds)",
    "total_duration_seconds": ${TOTAL_TIME},
    "provider": "${PROVIDER}",
    "model": "${MODEL}"
  },
  "results": {
    "total_projects_processed": ${TOTAL_PROCESSED},
    "successful_evaluations": ${TOTAL_SUCCESS},
    "failed_evaluations": ${TOTAL_FAILED},
    "success_rate": $(echo "scale=3; ${TOTAL_SUCCESS} * 100 / ${TOTAL_PROCESSED}" | bc)
  },
  "directory_structure": {
    "session_directory": "${SESSION_DIR}",
    "results_directory": "${RESULTS_DIR}",
    "detailed_responses_directory": "${DETAILED_DIR}",
    "summaries_directory": "${SUMMARY_DIR}",
    "log_file": "${LOG_FILE}"
  }
}
EOF

echo "📊 全体サマリーを保存: ${OVERALL_SUMMARY}"

# ディレクトリ構造表示
echo ""
echo "📂 生成されたディレクトリ構造:"
echo "├── ${SESSION_DIR}/"
echo "│   ├── full_evaluation.log                    # 統合ログ"
echo "│   ├── evaluation_summary.json                # 全体サマリー"
echo "│   ├── results/                               # プロジェクト別評価結果"
echo "│   │   ├── boulder/"
echo "│   │   │   ├── issue/                         # イシュー種別"
echo "│   │   │   │   └── [issue_name]/"
echo "│   │   │   │       └── evaluation_result.json"
echo "│   │   │   ├── pullrequest/                   # プルリクエスト種別"
echo "│   │   │   │   ├── [pr_name_1]/"
echo "│   │   │   │   │   └── evaluation_result.json"
echo "│   │   │   │   └── [pr_name_2]/"
echo "│   │   │   │       └── evaluation_result.json"
echo "│   │   │   └── evaluation_result_[timestamp].json  # プロジェクト全体結果"
echo "│   │   ├── daos/                              # 他のプロジェクト"
echo "│   │   │   ├── pullrequest/"
echo "│   │   │   │   ├── [pr_name_1]/"
echo "│   │   │   │   └── [pr_name_2]/"
echo "│   │   │   └── evaluation_result_[timestamp].json"
echo "│   │   └── [他のプロジェクト]/"
echo "│   ├── detailed_responses/                    # プロジェクト別詳細レスポンス"
echo "│   │   ├── boulder/detailed_responses_[timestamp].json"
echo "│   │   ├── daos/detailed_responses_[timestamp].json"
echo "│   │   └── [他のプロジェクト]/detailed_responses_[timestamp].json"
echo "│   ├── summaries/                             # プロジェクト別サマリー"
echo "│   │   ├── boulder_summary.json"
echo "│   │   ├── daos_summary.json"
echo "│   │   └── [他のプロジェクト]_summary.json"
echo "│   └── errors/                                # エラーログ（失敗時のみ）"
echo "│       ├── [project]_error.log"
echo "│       └── ..."
echo ""
echo "📈 結果確認方法:"
echo "  ls -la ${SESSION_DIR}/"
echo "  find ${SESSION_DIR}/results -name '*.json' | head -10"
echo "  python scripts/evaluation_log_viewer.py --latest"
echo "  cat ${OVERALL_SUMMARY}"
echo ""
echo "🎯 すべての評価が完了しました！"
