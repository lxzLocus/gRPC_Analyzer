#!/bin/sh
#
# 既存のバッチ実行結果の完了カテゴリを再評価
# パッチ抽出の成功/失敗を考慮して正しいカテゴリに修正
#
# 使い方:
#   sh scripts/reanalyze_completion_status.sh <batch_output_dir>
#
# 例:
#   sh scripts/reanalyze_completion_status.sh /app/output/batch_20260121_194002
#

set -e

# カラー出力
if command -v tput >/dev/null 2>&1 && [ -t 1 ]; then
    RED=$(tput setaf 1)
    GREEN=$(tput setaf 2)
    YELLOW=$(tput setaf 3)
    BLUE=$(tput setaf 4)
    CYAN=$(tput setaf 6)
    NC=$(tput sgr0)
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    CYAN=''
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
cecho "${GREEN}║      🔄 Completion Status Re-analysis Tool                ║${NC}"
cecho "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
cecho "${BLUE}📂 Target Directory: ${BATCH_DIR}${NC}"
echo ""

# 統計カウンター（一時ファイルで管理）
STATS_FILE=$(mktemp)
echo "0 0 0 0 0 0" > "$STATS_FILE"

# 変更レポート用
REPORT_FILE="${BATCH_DIR}/reanalysis_report.txt"
> "$REPORT_FILE"

{
    echo "==================================================="
    echo "Completion Status Re-analysis Report"
    echo "Batch Directory: ${BATCH_DIR}"
    echo "Analysis Time: $(date)"
    echo "==================================================="
    echo ""
} >> "$REPORT_FILE"

cecho "${YELLOW}🔍 Scanning execution logs...${NC}"
echo ""

# 各PRのexecution.logを解析
find "$BATCH_DIR" -type f -name "execution.log" | while read -r log_file; do
    # 統計を読み取り
    read TOTAL_PRS CHANGED_COUNT PATCH_GENERATED_COUNT LLM_NO_CHANGES_COUNT SYSTEM_NO_PROGRESS_COUNT ERROR_COUNT < "$STATS_FILE"
    
    TOTAL_PRS=$((TOTAL_PRS + 1))
    
    # PRディレクトリからリポジトリ/カテゴリ/PR名を抽出
    pr_dir=$(dirname "$log_file")
    pr_name=$(basename "$pr_dir")
    category_dir=$(dirname "$pr_dir")
    category=$(basename "$category_dir")
    repo_dir=$(dirname "$category_dir")
    repo=$(basename "$repo_dir")
    
    # 現在の完了カテゴリを取得
    old_status=$(grep "Type:" "$log_file" | tail -1 | awk '{print $2}')
    
    if [ -z "$old_status" ]; then
        cecho "${YELLOW}⚠️  Skipping (no status): ${repo}/${category}/${pr_name}${NC}"
        continue
    fi
    
    # パッチ生成の証拠を確認
    has_patch_generated=$(grep -c "✅ Patch file generated:" "$log_file" 2>/dev/null || echo 0)
    has_no_patch=$(grep -c "⚠️  No patch content found" "$log_file" 2>/dev/null || echo 0)
    has_verification=$(grep -c "Completed (Verified)" "$log_file" 2>/dev/null || echo 0)
    has_no_changes=$(grep -c "Completed (No Changes Needed)" "$log_file" 2>/dev/null || echo 0)
    
    # 新しい完了カテゴリを判定
    new_status="$old_status"
    
    if [ "$old_status" = "patch_generated" ]; then
        # patch_generatedだが実際にパッチが生成されていない場合
        if [ $has_patch_generated -eq 0 ]; then
            # パッチファイル生成ログがない
            if [ $has_no_patch -gt 0 ]; then
                # "No patch content found"がある → llm_no_changes
                new_status="llm_no_changes"
            elif [ $has_no_changes -gt 0 ]; then
                # "No Changes Needed"がある → llm_no_changes
                new_status="llm_no_changes"
            elif [ $has_verification -gt 0 ]; then
                # Verification Reportはあるがパッチコードがない → llm_no_changes
                new_status="llm_no_changes"
            fi
        fi
    fi
    
    # カテゴリ別カウント
    case "$new_status" in
        patch_generated) PATCH_GENERATED_COUNT=$((PATCH_GENERATED_COUNT + 1)) ;;
        llm_no_changes) LLM_NO_CHANGES_COUNT=$((LLM_NO_CHANGES_COUNT + 1)) ;;
        system_no_progress) SYSTEM_NO_PROGRESS_COUNT=$((SYSTEM_NO_PROGRESS_COUNT + 1)) ;;
        *) ERROR_COUNT=$((ERROR_COUNT + 1)) ;;
    esac
    
    # ステータスが変更された場合
    if [ "$old_status" != "$new_status" ]; then
        CHANGED_COUNT=$((CHANGED_COUNT + 1))
        
        cecho "${CYAN}🔄 ${repo}/${category}/${pr_name}${NC}"
        cecho "${YELLOW}   Old: ${old_status} → New: ${new_status}${NC}"
        
        # ログファイルを更新
        # "Type:" 行を置換（最後の出現）
        temp_file="${log_file}.tmp"
        awk -v new="$new_status" '
            /Type:/ {line=$0; gsub(/Type: [a-z_]+/, "Type: " new, line); last=NR; lastline=line}
            {lines[NR]=$0}
            END {
                for(i=1; i<=NR; i++) {
                    if(i==last) print lastline
                    else print lines[i]
                }
            }
        ' "$log_file" > "$temp_file"
        mv "$temp_file" "$log_file"
        
        # レポートに記録
        {
            echo "CHANGED: ${repo}/${category}/${pr_name}"
            echo "  Old Status: ${old_status}"
            echo "  New Status: ${new_status}"
            echo "  Has Patch Generated Log: ${has_patch_generated}"
            echo "  Has No Patch Log: ${has_no_patch}"
            echo "  Has Verification: ${has_verification}"
            echo ""
        } >> "$REPORT_FILE"
    else
        cecho "${GREEN}✓ ${repo}/${category}/${pr_name} (${new_status})${NC}"
    fi
    
    # 統計を保存
    echo "$TOTAL_PRS $CHANGED_COUNT $PATCH_GENERATED_COUNT $LLM_NO_CHANGES_COUNT $SYSTEM_NO_PROGRESS_COUNT $ERROR_COUNT" > "$STATS_FILE"
    
    printf "\r${YELLOW}📊 Progress: ${TOTAL_PRS} analyzed, ${CHANGED_COUNT} changed${NC}"
done

echo ""
echo ""

# 最終統計を読み取り
read TOTAL_PRS CHANGED_COUNT PATCH_GENERATED_COUNT LLM_NO_CHANGES_COUNT SYSTEM_NO_PROGRESS_COUNT ERROR_COUNT < "$STATS_FILE"
rm -f "$STATS_FILE"

# 統計を再計算してresults.csvを更新
if [ -f "${BATCH_DIR}/results.csv" ]; then
    cecho "${YELLOW}📝 Updating results.csv...${NC}"
    
    # CSVヘッダーを保持
    head -1 "${BATCH_DIR}/results.csv" > "${BATCH_DIR}/results.csv.new"
    
    # 各PRのステータスを再取得してCSVを更新
    find "$BATCH_DIR" -type f -name "execution.log" | while read -r log_file; do
        pr_dir=$(dirname "$log_file")
        pr_name=$(basename "$pr_dir")
        category_dir=$(dirname "$pr_dir")
        category=$(basename "$category_dir")
        repo_dir=$(dirname "$category_dir")
        repo=$(basename "$repo_dir")
        
        # CSVから対応する行を取得
        csv_line=$(grep ",$repo,$category,$pr_name," "${BATCH_DIR}/results.csv" 2>/dev/null || echo "")
        
        if [ -n "$csv_line" ]; then
            echo "$csv_line" >> "${BATCH_DIR}/results.csv.new"
        fi
    done
    
    mv "${BATCH_DIR}/results.csv.new" "${BATCH_DIR}/results.csv"
    cecho "${GREEN}✅ results.csv updated${NC}"
fi

# 最終統計を表示
echo ""
cecho "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
cecho "${GREEN}║         📊 Re-analysis Complete                            ║${NC}"
cecho "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
cecho "${BLUE}📊 Final Statistics:${NC}"
cecho "${BLUE}   📝 Total PRs Analyzed: ${TOTAL_PRS}${NC}"
cecho "${CYAN}   🔄 Statuses Changed: ${CHANGED_COUNT}${NC}"
echo ""
cecho "${BLUE}📊 Completion Categories:${NC}"
cecho "${GREEN}   ✅ patch_generated: ${PATCH_GENERATED_COUNT}${NC}"
cecho "${YELLOW}   ⚠️  llm_no_changes: ${LLM_NO_CHANGES_COUNT}${NC}"
cecho "${RED}   ❌ system_no_progress: ${SYSTEM_NO_PROGRESS_COUNT}${NC}"

if [ $ERROR_COUNT -gt 0 ]; then
    cecho "${RED}   ⚠️  errors/unknown: ${ERROR_COUNT}${NC}"
fi

echo ""
cecho "${BLUE}📁 Report saved to: ${REPORT_FILE}${NC}"

if [ $CHANGED_COUNT -gt 0 ]; then
    echo ""
    cecho "${YELLOW}🔍 Changed PRs Details:${NC}"
    grep -A 4 "CHANGED:" "$REPORT_FILE" | head -50
fi

echo ""
cecho "${GREEN}✨ Re-analysis completed successfully${NC}"
