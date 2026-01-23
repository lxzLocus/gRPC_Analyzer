#!/bin/sh
#
# バッチ実行結果の統計分析ツール
# 完了カテゴリ、実行時間、成功率などの詳細統計を算出
#
# 使い方:
#   sh scripts/analyze_batch_results.sh <batch_output_dir>
#
# 例:
#   sh scripts/analyze_batch_results.sh /app/output/batch_20260121_194002
#

set -e

# カラー出力
if command -v tput >/dev/null 2>&1 && [ -t 1 ]; then
    RED=$(tput setaf 1)
    GREEN=$(tput setaf 2)
    YELLOW=$(tput setaf 3)
    BLUE=$(tput setaf 4)
    CYAN=$(tput setaf 6)
    MAGENTA=$(tput setaf 5)
    NC=$(tput sgr0)
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    CYAN=''
    MAGENTA=''
    NC=''
fi

cecho() {
    printf "%s\n" "$1"
}

# 引数チェック
if [ -z "$1" ]; then
    cecho "${RED}❌ Error: Batch output directory required${NC}"
    echo "Usage: sh $0 <batch_output_dir>"
    echo ""
    echo "Example:"
    echo "  sh $0 /app/output/batch_20260121_194002"
    exit 1
fi

BATCH_DIR="$1"

if [ ! -d "$BATCH_DIR" ]; then
    cecho "${RED}❌ Error: Directory does not exist: ${BATCH_DIR}${NC}"
    exit 1
fi

cecho "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
cecho "${GREEN}║        📊 Batch Results Statistical Analysis              ║${NC}"
cecho "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
cecho "${BLUE}📂 Target Directory: ${BATCH_DIR}${NC}"
echo ""

# 一時ファイル
STATS_FILE=$(mktemp)
REPO_STATS=$(mktemp)
CATEGORY_STATS=$(mktemp)

# 統計カウンター初期化
echo "0 0 0 0 0 0" > "$STATS_FILE"
# total patch_generated llm_no_changes system_no_progress incomplete error

cecho "${YELLOW}🔍 Analyzing execution logs...${NC}"
echo ""

# 各PRのexecution.logを解析
find "$BATCH_DIR" -type f -name "execution.log" | while read -r log_file; do
    # 統計を読み取り
    read TOTAL PATCH_GEN NO_CHANGES NO_PROGRESS INCOMPLETE ERROR < "$STATS_FILE"
    
    TOTAL=$((TOTAL + 1))
    
    # PRディレクトリからリポジトリ/カテゴリ/PR名を抽出
    pr_dir=$(dirname "$log_file")
    pr_name=$(basename "$pr_dir")
    category_dir=$(dirname "$pr_dir")
    category=$(basename "$category_dir")
    repo_dir=$(dirname "$category_dir")
    repo=$(basename "$repo_dir")
    
    # 完了カテゴリを取得
    completion_type=$(grep "Type:" "$log_file" 2>/dev/null | tail -1 | awk '{print $2}')
    
    if [ -z "$completion_type" ]; then
        completion_type="incomplete"
    fi
    
    # カテゴリ別カウント
    case "$completion_type" in
        patch_generated) PATCH_GEN=$((PATCH_GEN + 1)) ;;
        llm_no_changes) NO_CHANGES=$((NO_CHANGES + 1)) ;;
        system_no_progress) NO_PROGRESS=$((NO_PROGRESS + 1)) ;;
        incomplete) INCOMPLETE=$((INCOMPLETE + 1)) ;;
        *) ERROR=$((ERROR + 1)) ;;
    esac
    
    # カテゴリ別統計
    echo "$category $completion_type" >> "$CATEGORY_STATS"
    
    # 統計を保存
    echo "$TOTAL $PATCH_GEN $NO_CHANGES $NO_PROGRESS $INCOMPLETE $ERROR" > "$STATS_FILE"
    
    printf "\r${YELLOW}📊 Progress: ${TOTAL} PRs analyzed${NC}"
done

echo ""
echo ""

# 最終統計を読み取り
read TOTAL PATCH_GEN NO_CHANGES NO_PROGRESS INCOMPLETE ERROR < "$STATS_FILE"

# 実行時間統計（results.csvから直接集計）
if [ -f "${BATCH_DIR}/results.csv" ]; then
    # CSVファイルが存在することを確認
    :
fi

if [ $TOTAL -eq 0 ]; then
    cecho "${RED}❌ No execution logs found${NC}"
    rm -f "$STATS_FILE" "$REPO_STATS" "$CATEGORY_STATS"
    exit 1
fi

# 成功率計算
SUCCESSFUL=$((PATCH_GEN + NO_CHANGES))
SUCCESS_RATE=0
if [ $TOTAL -gt 0 ]; then
    SUCCESS_RATE=$((SUCCESSFUL * 100 / TOTAL))
fi

# パッチ生成率
PATCH_RATE=0
if [ $TOTAL -gt 0 ]; then
    PATCH_RATE=$((PATCH_GEN * 100 / TOTAL))
fi

# 実行時間統計（results.csvから直接集計）
if [ -f "${BATCH_DIR}/results.csv" ]; then
    # awk で集計（より確実）
    time_stats=$(awk -F',' '
        NR > 1 && $5 != "" && $5 > 0 {
            sum += $5
            count++
            if (min == 0 || $5 < min) min = $5
            if ($5 > max) max = $5
        }
        END {
            if (count > 0) {
                print sum, int(sum/count), min, max
            } else {
                print "0 0 0 0"
            }
        }
    ' "${BATCH_DIR}/results.csv")
    
    TOTAL_DUR=$(echo "$time_stats" | awk '{print $1}')
    AVG_DUR=$(echo "$time_stats" | awk '{print $2}')
    MIN_DUR=$(echo "$time_stats" | awk '{print $3}')
    MAX_DUR=$(echo "$time_stats" | awk '{print $4}')
fi

# 結果表示
cecho "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
cecho "${GREEN}║         📊 Overall Statistics                              ║${NC}"
cecho "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
cecho "${BLUE}📝 Total PRs Analyzed: ${TOTAL}${NC}"
cecho "${GREEN}✅ Successful: ${SUCCESSFUL} (${SUCCESS_RATE}%)${NC}"
cecho "${RED}❌ Failed: $((NO_PROGRESS + INCOMPLETE + ERROR))${NC}"
echo ""

cecho "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
cecho "${CYAN}║         🎯 Completion Categories                           ║${NC}"
cecho "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
cecho "${GREEN}✅ patch_generated:      ${PATCH_GEN} (${PATCH_RATE}%)${NC}"
cecho "${YELLOW}⚠️  llm_no_changes:      ${NO_CHANGES} ($((NO_CHANGES * 100 / TOTAL))%)${NC}"
cecho "${RED}❌ system_no_progress:  ${NO_PROGRESS} ($((NO_PROGRESS * 100 / TOTAL))%)${NC}"

if [ $INCOMPLETE -gt 0 ]; then
    cecho "${MAGENTA}⏸️  incomplete:          ${INCOMPLETE} ($((INCOMPLETE * 100 / TOTAL))%)${NC}"
fi

if [ $ERROR -gt 0 ]; then
    cecho "${RED}💥 error/unknown:       ${ERROR} ($((ERROR * 100 / TOTAL))%)${NC}"
fi

echo ""

# 実行時間統計
if [ $TOTAL_DUR -gt 0 ]; then
    cecho "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    cecho "${CYAN}║         ⏱️  Execution Time Statistics                      ║${NC}"
    cecho "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # 合計時間を時分秒に変換
    HOURS=$((TOTAL_DUR / 3600))
    MINUTES=$(((TOTAL_DUR % 3600) / 60))
    SECONDS=$((TOTAL_DUR % 60))
    
    cecho "${BLUE}⏱️  Total Duration:    ${HOURS}h ${MINUTES}m ${SECONDS}s${NC}"
    cecho "${BLUE}📊 Average:            ${AVG_DUR}s${NC}"
    cecho "${BLUE}⚡ Fastest:            ${MIN_DUR}s${NC}"
    cecho "${BLUE}🐌 Slowest:            ${MAX_DUR}s${NC}"
    echo ""
fi

# リポジトリ別統計
if [ -f "$REPO_STATS" ] && [ -s "$REPO_STATS" ]; then
    cecho "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    cecho "${CYAN}║         📦 Statistics by Repository                        ║${NC}"
    cecho "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # リポジトリごとに集計
    sort "$REPO_STATS" | awk '
    {
        repo=$1
        status=$2
        repo_total[repo]++
        repo_status[repo,status]++
    }
    END {
        for (repo in repo_total) {
            total = repo_total[repo]
            patch = repo_status[repo,"patch_generated"] + 0
            no_changes = repo_status[repo,"llm_no_changes"] + 0
            no_progress = repo_status[repo,"system_no_progress"] + 0
            
            patch_pct = (total > 0) ? int(patch * 100 / total) : 0
            
            printf "%-20s Total: %3d  | ✅ %2d  ⚠️  %2d  ❌ %2d  (patch: %2d%%)\n", 
                   repo, total, patch, no_changes, no_progress, patch_pct
        }
    }
    ' | sort -t':' -k2 -rn
    
    echo ""
fi

# カテゴリ別統計
if [ -f "$CATEGORY_STATS" ] && [ -s "$CATEGORY_STATS" ]; then
    cecho "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    cecho "${CYAN}║         📂 Statistics by Category                          ║${NC}"
    cecho "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # カテゴリごとに集計
    sort "$CATEGORY_STATS" | awk '
    {
        cat=$1
        status=$2
        cat_total[cat]++
        cat_status[cat,status]++
    }
    END {
        for (cat in cat_total) {
            total = cat_total[cat]
            patch = cat_status[cat,"patch_generated"] + 0
            no_changes = cat_status[cat,"llm_no_changes"] + 0
            no_progress = cat_status[cat,"system_no_progress"] + 0
            
            patch_pct = (total > 0) ? int(patch * 100 / total) : 0
            
            printf "%-15s Total: %3d  | ✅ %2d  ⚠️  %2d  ❌ %2d  (patch: %2d%%)\n", 
                   cat, total, patch, no_changes, no_progress, patch_pct
        }
    }
    ' | sort -t':' -k2 -rn
    
    echo ""
fi

# パッチ生成が少ないケースの詳細
if [ $NO_CHANGES -gt 0 ]; then
    cecho "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    cecho "${YELLOW}║         ⚠️  PRs with No Changes Needed                     ║${NC}"
    cecho "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    cecho "${YELLOW}Found ${NO_CHANGES} PRs where LLM determined no changes needed${NC}"
    echo ""
fi

if [ $NO_PROGRESS -gt 0 ]; then
    cecho "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    cecho "${RED}║         ❌ PRs with No Progress (System Fallback)          ║${NC}"
    cecho "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    cecho "${RED}Found ${NO_PROGRESS} PRs where system detected no progress${NC}"
    echo ""
    cecho "${CYAN}Listing PRs:${NC}"
    find "$BATCH_DIR" -type f -name "execution.log" -exec grep -l "Type: system_no_progress" {} \; | while read -r log; do
        pr_dir=$(dirname "$log")
        pr_name=$(basename "$pr_dir")
        category=$(basename $(dirname "$pr_dir"))
        repo=$(basename $(dirname $(dirname "$pr_dir")))
        echo "  - ${repo}/${category}/${pr_name}"
    done
    echo ""
fi

# クリーンアップ
rm -f "$STATS_FILE" "$REPO_STATS" "$CATEGORY_STATS"

cecho "${GREEN}✨ Analysis completed successfully${NC}"
