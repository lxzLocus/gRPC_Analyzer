#!/bin/bash

################################################################################
# Batch PR Test Runner
#
# 複数のPRに対してLLMフローを順次または並列実行するバッチスクリプト
#
# Usage:
#   /app/scripts/batch.sh <dataset_dir> [parallel_jobs]
#
# Arguments:
#   dataset_dir    : データセットディレクトリ（例: /app/dataset/filtered_confirmed）
#   parallel_jobs  : 並列実行数（デフォルト: 1、推奨: 2）
#
# Examples:
#   /app/scripts/batch.sh /app/dataset/filtered_confirmed           # 順次実行
#   /app/scripts/batch.sh /app/dataset/filtered_confirmed 2         # 2並列
#   /app/scripts/batch.sh /app/dataset/filtered_confirmed 4         # 4並列
#
################################################################################

set -euo pipefail

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 引数チェック
if [ $# -lt 1 ]; then
    log_error "Usage: $0 <dataset_dir> [parallel_jobs]"
    exit 1
fi

DATASET_DIR="$1"
PARALLEL_JOBS="${2:-1}"

# ディレクトリ存在確認
if [ ! -d "$DATASET_DIR" ]; then
    log_error "Dataset directory not found: $DATASET_DIR"
    exit 1
fi

# 環境変数チェック
if [ ! -f "/app/.env" ]; then
    log_error ".env file not found. Please create /app/.env with API keys."
    exit 1
fi

# 環境変数読み込み
source /app/.env

if [ -z "${OPENAI_API_KEY:-}" ]; then
    log_error "OPENAI_API_KEY not set in .env"
    exit 1
fi

log_info "Dataset directory: $DATASET_DIR"
log_info "Parallel jobs: $PARALLEL_JOBS"

# PRディレクトリを収集
log_info "Collecting PR directories..."
PR_DIRS=()

# データセット構造を解析（repository/category/pr_name）
for repo_dir in "$DATASET_DIR"/*; do
    if [ ! -d "$repo_dir" ]; then
        continue
    fi
    
    for category_dir in "$repo_dir"/*; do
        if [ ! -d "$category_dir" ]; then
            continue
        fi
        
        for pr_dir in "$category_dir"/*; do
            if [ ! -d "$pr_dir" ]; then
                continue
            fi
            
            # 必須ファイルの存在確認
            if [ -f "$pr_dir/01_proto.txt" ] && [ -f "$pr_dir/05_suspectedFiles.txt" ]; then
                PR_DIRS+=("$pr_dir")
            else
                log_warning "Skipping incomplete PR: $(basename $pr_dir)"
            fi
        done
    done
done

TOTAL_PRS=${#PR_DIRS[@]}

if [ $TOTAL_PRS -eq 0 ]; then
    log_error "No valid PR directories found in $DATASET_DIR"
    exit 1
fi

log_success "Found $TOTAL_PRS PR directories"

# 統計変数
SUCCESS_COUNT=0
FAILURE_COUNT=0
START_TIME=$(date +%s)

# 結果ディレクトリ
RESULT_DIR="/app/output/batch_results/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULT_DIR"

log_info "Results will be saved to: $RESULT_DIR"

# プログレスログファイル
PROGRESS_LOG="$RESULT_DIR/progress.log"
ERROR_LOG="$RESULT_DIR/errors.log"
SUCCESS_LOG="$RESULT_DIR/success.log"

touch "$PROGRESS_LOG" "$ERROR_LOG" "$SUCCESS_LOG"

# 単一PR処理関数
process_pr() {
    local pr_path="$1"
    local pr_index="$2"
    local total="$3"
    
    local pr_name=$(basename "$pr_path")
    local repo_name=$(basename $(dirname $(dirname "$pr_path")))
    
    log_info "[$pr_index/$total] Processing: $repo_name/$pr_name"
    
    # タイムアウト設定（5分）
    local timeout_seconds=300
    
    # autoResponser.tsを直接実行（プロセス分離）
    if timeout $timeout_seconds npx tsx /app/src/utils/autoResponser.ts "$pr_path" >> "$PROGRESS_LOG" 2>&1; then
        log_success "[$pr_index/$total] ✅ $repo_name/$pr_name"
        echo "$pr_path" >> "$SUCCESS_LOG"
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log_error "[$pr_index/$total] ⏱️ TIMEOUT: $repo_name/$pr_name"
            echo "$pr_path (TIMEOUT)" >> "$ERROR_LOG"
        else
            log_error "[$pr_index/$total] ❌ FAILED: $repo_name/$pr_name (exit code: $exit_code)"
            echo "$pr_path (exit code: $exit_code)" >> "$ERROR_LOG"
        fi
        return 1
    fi
}

export -f process_pr log_info log_success log_error
export PROGRESS_LOG ERROR_LOG SUCCESS_LOG BLUE GREEN RED NC

# 並列実行
log_info "Starting batch processing with $PARALLEL_JOBS parallel jobs..."
echo "========================================" >> "$PROGRESS_LOG"
echo "Batch started at $(date)" >> "$PROGRESS_LOG"
echo "========================================" >> "$PROGRESS_LOG"

if [ "$PARALLEL_JOBS" -eq 1 ]; then
    # 順次実行
    for i in "${!PR_DIRS[@]}"; do
        pr_index=$((i + 1))
        if process_pr "${PR_DIRS[$i]}" "$pr_index" "$TOTAL_PRS"; then
            ((SUCCESS_COUNT++))
        else
            ((FAILURE_COUNT++))
        fi
    done
else
    # 並列実行（GNU parallel使用）
    if command -v parallel &> /dev/null; then
        log_info "Using GNU parallel for parallel execution"
        
        # PR一覧を一時ファイルに書き出し
        PR_LIST_FILE="$RESULT_DIR/pr_list.txt"
        printf "%s\n" "${PR_DIRS[@]}" > "$PR_LIST_FILE"
        
        # GNU parallelで並列実行
        parallel -j "$PARALLEL_JOBS" --line-buffer --tagstring "[{#}/$TOTAL_PRS]" \
            process_pr {} {#} "$TOTAL_PRS" :::: "$PR_LIST_FILE" || true
        
        # 成功・失敗カウント
        SUCCESS_COUNT=$(wc -l < "$SUCCESS_LOG" 2>/dev/null || echo 0)
        FAILURE_COUNT=$(wc -l < "$ERROR_LOG" 2>/dev/null || echo 0)
    else
        log_warning "GNU parallel not found. Falling back to sequential execution."
        PARALLEL_JOBS=1
        
        for i in "${!PR_DIRS[@]}"; do
            pr_index=$((i + 1))
            if process_pr "${PR_DIRS[$i]}" "$pr_index" "$TOTAL_PRS"; then
                ((SUCCESS_COUNT++))
            else
                ((FAILURE_COUNT++))
            fi
        done
    fi
fi

# 終了処理
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
DURATION_MIN=$((DURATION / 60))
DURATION_SEC=$((DURATION % 60))

echo "" | tee -a "$PROGRESS_LOG"
echo "========================================" | tee -a "$PROGRESS_LOG"
echo "🎉 Batch processing completed" | tee -a "$PROGRESS_LOG"
echo "========================================" | tee -a "$PROGRESS_LOG"
echo "Total PRs:       $TOTAL_PRS" | tee -a "$PROGRESS_LOG"
echo "✅ Success:      $SUCCESS_COUNT" | tee -a "$PROGRESS_LOG"
echo "❌ Failed:       $FAILURE_COUNT" | tee -a "$PROGRESS_LOG"
echo "⏱️  Duration:     ${DURATION_MIN}m ${DURATION_SEC}s" | tee -a "$PROGRESS_LOG"
echo "📊 Success Rate: $(awk "BEGIN {printf \"%.1f%%\", ($SUCCESS_COUNT/$TOTAL_PRS)*100}")" | tee -a "$PROGRESS_LOG"
echo "" | tee -a "$PROGRESS_LOG"
echo "📁 Results saved to: $RESULT_DIR" | tee -a "$PROGRESS_LOG"
echo "📄 Progress log: $PROGRESS_LOG" | tee -a "$PROGRESS_LOG"
echo "✅ Success log: $SUCCESS_LOG" | tee -a "$PROGRESS_LOG"
echo "❌ Error log: $ERROR_LOG" | tee -a "$PROGRESS_LOG"

# ログファイルをインタラクティブに表示
if [ -t 1 ]; then
    echo ""
    read -p "View error log? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -s "$ERROR_LOG" ]; then
            cat "$ERROR_LOG"
        else
            log_success "No errors!"
        fi
    fi
fi

# 終了コード
if [ $FAILURE_COUNT -eq 0 ]; then
    exit 0
else
    exit 1
fi
