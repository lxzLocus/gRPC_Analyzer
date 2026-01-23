#!/bin/sh
#
# パッチ生成検証スクリプト
# 各PRのexecution.logとパッチファイルを確認して実際の生成状況を分析
#
# 使い方: 
#   sh scripts/verify_patch_generation.sh <batch_output_dir>
#
# 例:
#   sh scripts/verify_patch_generation.sh /app/output/batch_20260121_194002
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
if [ $# -lt 1 ]; then
    cecho "${RED}❌ Usage: $0 <batch_output_directory>${NC}"
    echo "Example: $0 /app/output/batch_20260121_194002"
    exit 1
fi

BATCH_DIR="$1"

if [ ! -d "$BATCH_DIR" ]; then
    cecho "${RED}❌ Directory not found: ${BATCH_DIR}${NC}"
    exit 1
fi

# 一時ファイル
REPORT_FILE="${BATCH_DIR}/patch_verification_report.txt"
DETAILED_CSV="${BATCH_DIR}/patch_verification_detailed.csv"

# 統計カウンター
TOTAL_PRS=0
HAS_PATCH_FILE=0
HAS_PATCH_LOG_OLD=0          # 旧ログ形式: "Patch saved to:"
HAS_PATCH_LOG_NEW=0          # 新ログ形式: "✅ Patch file generated:"
NO_PATCH_LOG_NEW=0           # 新ログ形式: "⚠️  No patch content found"
NO_PATCH_FILE_BUT_LOG=0      # ログにはあるがファイルがない
HAS_PATCH_FILE_BUT_NO_LOG=0  # ファイルはあるがログにない
NO_PATCH_AT_ALL=0            # ファイルもログもない

cecho "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
cecho "${GREEN}║         🔍 Patch Generation Verification                   ║${NC}"
cecho "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
cecho "${BLUE}📂 Batch Directory: ${BATCH_DIR}${NC}"
echo ""
cecho "${YELLOW}🔍 Analyzing execution logs and patch files...${NC}"
echo ""

# CSV ヘッダー
echo "repository,category,pr_title,has_patch_file,has_old_log,has_new_log,no_patch_log,patch_file_path,log_message" > "$DETAILED_CSV"

# PRディレクトリをスキャン
for repo_dir in "$BATCH_DIR"/*; do
    [ -d "$repo_dir" ] || continue
    
    repo_name=$(basename "$repo_dir")
    
    for category_dir in "$repo_dir"/*; do
        [ -d "$category_dir" ] || continue
        
        category_name=$(basename "$category_dir")
        
        for pr_dir in "$category_dir"/*; do
            [ -d "$pr_dir" ] || continue
            
            pr_title=$(basename "$pr_dir")
            TOTAL_PRS=$((TOTAL_PRS + 1))
            
            # execution.log を確認
            exec_log="${pr_dir}/execution.log"
            
            # パッチファイルを検索（*.patch）
            patch_files=$(find "$pr_dir" -name "*.patch" -type f 2>/dev/null || true)
            patch_count=$(echo "$patch_files" | grep -c "\.patch$" 2>/dev/null || echo 0)
            
            has_patch_file=0
            has_old_log=0
            has_new_log=0
            no_patch_log=0
            patch_file_path=""
            log_message=""
            
            # パッチファイル存在チェック
            if [ $patch_count -gt 0 ]; then
                has_patch_file=1
                HAS_PATCH_FILE=$((HAS_PATCH_FILE + 1))
                patch_file_path=$(echo "$patch_files" | head -n 1)
            fi
            
            # ログメッセージチェック
            if [ -f "$exec_log" ]; then
                # 旧ログ形式: "Patch saved to:"
                if grep -q "Patch saved to:" "$exec_log" 2>/dev/null; then
                    has_old_log=1
                    HAS_PATCH_LOG_OLD=$((HAS_PATCH_LOG_OLD + 1))
                    log_message=$(grep "Patch saved to:" "$exec_log" | head -n 1 | sed 's/.*Patch saved to:/Patch saved to:/')
                fi
                
                # 新ログ形式: "✅ Patch file generated:"
                if grep -q "✅ Patch file generated:" "$exec_log" 2>/dev/null; then
                    has_new_log=1
                    HAS_PATCH_LOG_NEW=$((HAS_PATCH_LOG_NEW + 1))
                    log_message=$(grep "✅ Patch file generated:" "$exec_log" | head -n 1)
                fi
                
                # 新ログ形式: "⚠️  No patch content found"
                if grep -q "No patch content found" "$exec_log" 2>/dev/null; then
                    no_patch_log=1
                    NO_PATCH_LOG_NEW=$((NO_PATCH_LOG_NEW + 1))
                    log_message=$(grep "No patch content found" "$exec_log" | head -n 1)
                fi
            fi
            
            # パターン分類
            if [ $has_patch_file -eq 0 ] && [ $has_old_log -eq 0 ] && [ $has_new_log -eq 0 ]; then
                # ファイルもログもない
                NO_PATCH_AT_ALL=$((NO_PATCH_AT_ALL + 1))
            elif [ $has_patch_file -eq 0 ] && [ $has_old_log -eq 1 -o $has_new_log -eq 1 ]; then
                # ログにはあるがファイルがない
                NO_PATCH_FILE_BUT_LOG=$((NO_PATCH_FILE_BUT_LOG + 1))
            elif [ $has_patch_file -eq 1 ] && [ $has_old_log -eq 0 ] && [ $has_new_log -eq 0 ]; then
                # ファイルはあるがログにない
                HAS_PATCH_FILE_BUT_NO_LOG=$((HAS_PATCH_FILE_BUT_NO_LOG + 1))
            fi
            
            # CSV に記録
            echo "$repo_name,$category_name,$pr_title,$has_patch_file,$has_old_log,$has_new_log,$no_patch_log,\"$patch_file_path\",\"$log_message\"" >> "$DETAILED_CSV"
            
            printf "\r${YELLOW}📊 Progress: ${TOTAL_PRS} PRs analyzed${NC}"
        done
    done
done

echo ""
echo ""

# レポート生成
{
    echo "================================================================="
    echo "           🔍 Patch Generation Verification Report"
    echo "================================================================="
    echo ""
    echo "Batch Directory: ${BATCH_DIR}"
    echo "Analysis Date: $(date)"
    echo ""
    echo "================================================================="
    echo "           📊 Overall Statistics"
    echo "================================================================="
    echo ""
    echo "Total PRs Analyzed: ${TOTAL_PRS}"
    echo ""
    echo "--- Patch File Status ---"
    echo "✅ Has patch file (.patch):              ${HAS_PATCH_FILE}"
    echo "❌ No patch file:                        $((TOTAL_PRS - HAS_PATCH_FILE))"
    echo ""
    echo "--- Log Message Status ---"
    echo "📝 Old log format (\"Patch saved to:\"):  ${HAS_PATCH_LOG_OLD}"
    echo "✅ New log (\"✅ Patch file generated:\"): ${HAS_PATCH_LOG_NEW}"
    echo "⚠️  New log (\"⚠️  No patch content\"):    ${NO_PATCH_LOG_NEW}"
    echo ""
    echo "--- Pattern Analysis ---"
    echo "🔴 No patch at all (file & log):        ${NO_PATCH_AT_ALL}"
    echo "🟡 Log says yes, file missing:          ${NO_PATCH_FILE_BUT_LOG}"
    echo "🟠 File exists, log missing:            ${HAS_PATCH_FILE_BUT_NO_LOG}"
    echo "🟢 Consistent (file & log match):       $((HAS_PATCH_FILE - HAS_PATCH_FILE_BUT_NO_LOG))"
    echo ""
    if [ $TOTAL_PRS -gt 0 ]; then
        PATCH_FILE_RATE=$((HAS_PATCH_FILE * 100 / TOTAL_PRS))
        NO_PATCH_RATE=$((NO_PATCH_AT_ALL * 100 / TOTAL_PRS))
        echo "--- Success Rate ---"
        echo "Patch file generation rate: ${PATCH_FILE_RATE}%"
        echo "No patch at all rate:       ${NO_PATCH_RATE}%"
        echo ""
    fi
    echo "================================================================="
    echo ""
} > "$REPORT_FILE"

# 結果表示
cecho "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
cecho "${GREEN}║         📊 Verification Results                            ║${NC}"
cecho "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

cecho "${BLUE}📝 Total PRs Analyzed: ${TOTAL_PRS}${NC}"
echo ""

cecho "${CYAN}--- Patch File Status ---${NC}"
cecho "${GREEN}✅ Has patch file (.patch):              ${HAS_PATCH_FILE}${NC}"
cecho "${RED}❌ No patch file:                        $((TOTAL_PRS - HAS_PATCH_FILE))${NC}"
echo ""

cecho "${CYAN}--- Log Message Status ---${NC}"
cecho "${BLUE}📝 Old log format (\"Patch saved to:\"):  ${HAS_PATCH_LOG_OLD}${NC}"
cecho "${GREEN}✅ New log (\"✅ Patch file generated:\"): ${HAS_PATCH_LOG_NEW}${NC}"
cecho "${YELLOW}⚠️  New log (\"⚠️  No patch content\"):    ${NO_PATCH_LOG_NEW}${NC}"
echo ""

cecho "${CYAN}--- Pattern Analysis ---${NC}"
cecho "${RED}🔴 No patch at all (file & log):        ${NO_PATCH_AT_ALL}${NC}"
cecho "${YELLOW}🟡 Log says yes, file missing:          ${NO_PATCH_FILE_BUT_LOG}${NC}"
cecho "${MAGENTA}🟠 File exists, log missing:            ${HAS_PATCH_FILE_BUT_NO_LOG}${NC}"
cecho "${GREEN}🟢 Consistent (file & log match):       $((HAS_PATCH_FILE - HAS_PATCH_FILE_BUT_NO_LOG))${NC}"
echo ""

if [ $TOTAL_PRS -gt 0 ]; then
    PATCH_FILE_RATE=$((HAS_PATCH_FILE * 100 / TOTAL_PRS))
    NO_PATCH_RATE=$((NO_PATCH_AT_ALL * 100 / TOTAL_PRS))
    cecho "${CYAN}--- Success Rate ---${NC}"
    cecho "${BLUE}Patch file generation rate: ${PATCH_FILE_RATE}%${NC}"
    cecho "${BLUE}No patch at all rate:       ${NO_PATCH_RATE}%${NC}"
    echo ""
fi

cecho "${GREEN}✨ Verification completed${NC}"
echo ""
cecho "${BLUE}📁 Reports saved to:${NC}"
cecho "${BLUE}   - Summary: ${REPORT_FILE}${NC}"
cecho "${BLUE}   - Detailed CSV: ${DETAILED_CSV}${NC}"
echo ""

# 詳細CSV の一部を表示
if [ $NO_PATCH_AT_ALL -gt 0 ] || [ $NO_PATCH_FILE_BUT_LOG -gt 0 ]; then
    cecho "${YELLOW}⚠️  Issues detected. Sample entries:${NC}"
    echo ""
    
    if [ $NO_PATCH_AT_ALL -gt 0 ]; then
        cecho "${RED}🔴 PRs with no patch file and no log:${NC}"
        awk -F',' '$4==0 && $5==0 && $6==0 {print "   - " $1 "/" $2 "/" $3}' "$DETAILED_CSV" | head -n 5
        echo ""
    fi
    
    if [ $NO_PATCH_FILE_BUT_LOG -gt 0 ]; then
        cecho "${YELLOW}🟡 PRs where log says patch exists but file is missing:${NC}"
        awk -F',' '$4==0 && ($5==1 || $6==1) {print "   - " $1 "/" $2 "/" $3}' "$DETAILED_CSV" | head -n 5
        echo ""
    fi
fi

# 詳細CSVをインタラクティブに確認するためのコマンドを提示
cecho "${BLUE}💡 To view detailed results:${NC}"
cecho "${BLUE}   cat ${DETAILED_CSV}${NC}"
cecho "${BLUE}   # または${NC}"
cecho "${BLUE}   column -t -s',' ${DETAILED_CSV} | less -S${NC}"
