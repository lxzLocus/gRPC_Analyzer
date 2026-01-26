#!/bin/sh
#
# バッチPR実行スクリプト
# 各PRを独立したnodeプロセスで実行し、接続エラーを回避
#
# 使い方: 
#   sh scripts/batch.sh [dataset_index] [--resume <repo> <cat> <pr>]
#
# 例:
#   sh scripts/batch.sh 0  # filtered_fewChanged（最初から）
#   sh scripts/batch.sh 5  # incorrect_few
#   sh scripts/batch.sh 0 --resume "boulder" "issue" "pr_title"  # 途中から再開
#
# 進捗確認:
#   sh scripts/check_batch_progress.sh  # 前回の進捗を確認してresumeコマンドを表示
#

set -e  # エラーで停止

# カラー出力（tputを使用してより互換性を高める）
if command -v tput >/dev/null 2>&1 && [ -t 1 ]; then
    RED=$(tput setaf 1)
    GREEN=$(tput setaf 2)
    YELLOW=$(tput setaf 3)
    BLUE=$(tput setaf 4)
    NC=$(tput sgr0)
else
    # tputが使えない、またはパイプの場合は色なし
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# カラー出力用ヘルパー関数
cecho() {
    printf "%s\n" "$1"
}

# データセット選択関数（配列の代わり）
get_dataset_path() {
    case $1 in
        0) echo "/app/dataset/filtered_fewChanged" ;;
        1) echo "/app/dataset/filtered_confirmed" ;;
        2) echo "/app/dataset/filtered_commit" ;;
        3) echo "/app/dataset/filtered_protoChanged" ;;
        4) echo "/app/dataset/filtered_bugs" ;;
        5) echo "/app/dataset/incorrect_few" ;;
        *) echo "" ;;
    esac
}

# デフォルトはインデックス0（filtered_fewChanged）
DATASET_INDEX=${1:-0}

# Resume機能のための変数
RESUME_MODE=false
RESUME_REPO=""
RESUME_CATEGORY=""
RESUME_PR=""
RESUME_FOUND=false

# 引数解析（--resume オプション）
shift_count=1
if [ "$2" = "--resume" ]; then
    RESUME_MODE=true
    RESUME_REPO="$3"
    RESUME_CATEGORY="$4"
    RESUME_PR="$5"
    shift_count=5
    
    if [ -z "$RESUME_REPO" ] || [ -z "$RESUME_CATEGORY" ] || [ -z "$RESUME_PR" ]; then
        cecho "${RED}❌ --resume requires 3 arguments: repository category pr_title${NC}"
        echo "Usage: sh $0 [dataset_index] --resume <repository> <category> <pr_title>"
        exit 1
    fi
    
    cecho "${YELLOW}🔄 Resume mode enabled${NC}"
    cecho "${YELLOW}   Will skip until after: ${RESUME_REPO}/${RESUME_CATEGORY}/${RESUME_PR}${NC}"
    echo ""
fi

# データセット選択の検証
DATASET_DIR=$(get_dataset_path $DATASET_INDEX)

if [ -z "$DATASET_DIR" ]; then
    cecho "${RED}❌ Invalid dataset index: ${DATASET_INDEX}${NC}"
    cecho "${BLUE}📂 Available datasets:${NC}"
    echo "   0: /app/dataset/filtered_fewChanged"
    echo "   1: /app/dataset/filtered_confirmed"
    echo "   2: /app/dataset/filtered_commit"
    echo "   3: /app/dataset/filtered_protoChanged"
    echo "   4: /app/dataset/filtered_bugs"
    echo "   5: /app/dataset/incorrect_few"
    exit 1
fi
OUTPUT_BASE="/app/output/batch_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="${OUTPUT_BASE}/batch_execution.log"
SUMMARY_FILE="${OUTPUT_BASE}/batch_summary.json"

# 出力ディレクトリ作成
mkdir -p "$OUTPUT_BASE"

# バッチ実行統計
TOTAL_PRS=0
SUCCESSFUL_PRS=0
FAILED_PRS=0
SKIPPED_PRS=0
START_TIME=$(date +%s)

cecho "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
cecho "${GREEN}║         🔬 gRPC Analyzer - Batch PR Execution              ║${NC}"
cecho "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
cecho "${BLUE}📂 Dataset: ${DATASET_DIR}${NC}"
cecho "${BLUE}📁 Output: ${OUTPUT_BASE}${NC}"
cecho "${BLUE}📝 Log: ${LOG_FILE}${NC}"
cecho "${BLUE}🐛 Process ID: $$${NC}"
echo ""

# ログ初期化
{
    echo "==================================================="
    echo "Batch PR Execution Started"
    echo "Dataset: ${DATASET_DIR}"
    echo "Output: ${OUTPUT_BASE}"
    echo "Start Time: $(date)"
    echo "==================================================="
    echo ""
} > "$LOG_FILE"

# データセット内のPRを検索して実行
find_and_execute_prs() {
    local dataset="$1"
    
    cecho "${YELLOW}🔍 Scanning dataset for PRs...${NC}"
    
    # データセット構造: dataset/repository/category/pr_title/
    for repo_dir in "$dataset"/*; do
        [ -d "$repo_dir" ] || continue
        
        repo_name=$(basename "$repo_dir")
        
        for category_dir in "$repo_dir"/*; do
            [ -d "$category_dir" ] || continue
            
            category_name=$(basename "$category_dir")
            
            for pr_dir in "$category_dir"/*; do
                [ -d "$pr_dir" ] || continue
                
                pr_title=$(basename "$pr_dir")
                
                # Resume機能: 指定されたPRまでスキップ
                if [ "$RESUME_MODE" = true ] && [ "$RESUME_FOUND" = false ]; then
                    if [ "$repo_name" = "$RESUME_REPO" ] && [ "$category_name" = "$RESUME_CATEGORY" ] && [ "$pr_title" = "$RESUME_PR" ]; then
                        cecho "${YELLOW}✓ Found resume point: ${repo_name}/${category_name}/${pr_title}${NC}" | tee -a "$LOG_FILE"
                        cecho "${YELLOW}  Starting from next PR...${NC}" | tee -a "$LOG_FILE"
                        RESUME_FOUND=true
                    fi
                    # まだresumeポイントに到達していないのでスキップ
                    continue
                fi
                
                # PRディレクトリ内に必要なファイルがあるか確認
                # target.diff, modified.diff または 01_proto.txt などの番号付きファイル
                TOTAL_PRS=$((TOTAL_PRS + 1))
                
                if [ ! -f "$pr_dir/target.diff" ] && [ ! -f "$pr_dir/modified.diff" ] && [ ! -f "$pr_dir/01_proto.txt" ]; then
                    cecho "${YELLOW}⏭️  Skipping (no data files): $repo_name/$category_name/$pr_title${NC}" | tee -a "$LOG_FILE"
                    SKIPPED_PRS=$((SKIPPED_PRS + 1))
                    continue
                fi
                
                echo "" | tee -a "$LOG_FILE"
                cecho "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"
                cecho "${GREEN}🚀 Processing PR #${TOTAL_PRS}${NC}" | tee -a "$LOG_FILE"
                cecho "${BLUE}   Repository: ${repo_name}${NC}" | tee -a "$LOG_FILE"
                cecho "${BLUE}   Category: ${category_name}${NC}" | tee -a "$LOG_FILE"
                cecho "${BLUE}   PR: ${pr_title}${NC}" | tee -a "$LOG_FILE"
                cecho "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"
                cecho "${YELLOW}⏳ Status: Initializing worker...${NC}"
                
                # 一時的なワーカースクリプトを作成
                WORKER_SCRIPT="${OUTPUT_BASE}/worker_${repo_name}_${category_name}_${pr_title}.js"
                
                cat > "$WORKER_SCRIPT" << 'EOF'
/**
 * 自動生成ワーカースクリプト - 単一PR実行
 */
import path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env') });

const TARGET_PR_CONFIG = {
    datasetDir: process.env.DATASET_DIR,
    repositoryName: process.env.REPO_NAME,
    category: process.env.CATEGORY_NAME,
    pullRequestTitle: process.env.PR_TITLE,
    outputDir: process.env.OUTPUT_DIR
};

const PROCESSING_OPTIONS = {
    baseOutputDir: TARGET_PR_CONFIG.outputDir,
    maxRetries: 3,
    memoryCleanupInterval: 5,
    timeoutMs: 15 * 60 * 1000,
    enableGarbageCollection: true,
    enablePreVerification: false,
    forceTUI: false,
    quietMode: true,
    targetPullRequest: {
        repositoryName: TARGET_PR_CONFIG.repositoryName,
        category: TARGET_PR_CONFIG.category,
        pullRequestTitle: TARGET_PR_CONFIG.pullRequestTitle
    }
};

async function main() {
    console.log(`\n🎯 Target PR: ${TARGET_PR_CONFIG.repositoryName}/${TARGET_PR_CONFIG.category}/${TARGET_PR_CONFIG.pullRequestTitle}`);
    
    const prPath = path.join(
        TARGET_PR_CONFIG.datasetDir,
        TARGET_PR_CONFIG.repositoryName,
        TARGET_PR_CONFIG.category,
        TARGET_PR_CONFIG.pullRequestTitle
    );
    
    if (!fs.existsSync(prPath)) {
        console.error(`❌ PR path does not exist: ${prPath}`);
        process.exit(1);
    }
    
    try {
        const { BatchProcessController } = await import('/app/dist/js/controllers/BatchProcessController.js');
        
        const controller = new BatchProcessController({
            generateReport: false,
            generateErrorReport: false,
            ...PROCESSING_OPTIONS
        });
        
        await controller.runBatchProcessing(TARGET_PR_CONFIG.datasetDir);
        
        console.log('\n✅ PR processing completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Critical error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('💥 Unhandled error:', error);
    console.error(error.stack);
    process.exit(1);
});
EOF
                
                # 環境変数を設定して実行
                export DATASET_DIR="$dataset"
                export REPO_NAME="$repo_name"
                export CATEGORY_NAME="$category_name"
                export PR_TITLE="$pr_title"
                export OUTPUT_DIR="${OUTPUT_BASE}/${repo_name}/${category_name}/${pr_title}"
                
                mkdir -p "$OUTPUT_DIR"
                
                # PRログファイル
                PR_LOG="${OUTPUT_DIR}/execution.log"
                
                # 実行時刻を記録
                PR_START_TIME=$(date +%s)
                echo "   ⏱️  Started at: $(date)" | tee -a "$LOG_FILE"
                cecho "${YELLOW}⏳ Status: Starting Node.js process...${NC}"
                
                # node プロセスを実行（バックグラウンドで独立したプロセス）
                node "$WORKER_SCRIPT" > "$PR_LOG" 2>&1 &
                NODE_PID=$!
                
                cecho "${YELLOW}⏳ Status: Node process started (PID: ${NODE_PID})${NC}"
                cecho "${YELLOW}🔄 Processing... (monitoring log for updates)${NC}"
                
                # プロセス監視ループ
                LAST_LOG_SIZE=0
                DOTS=""
                while kill -0 "$NODE_PID" 2>/dev/null; do
                    # ログファイルに新しい内容があるか確認
                    if [ -f "$PR_LOG" ]; then
                        CURRENT_LOG_SIZE=$(wc -c < "$PR_LOG" 2>/dev/null || echo 0)
                        if [ "$CURRENT_LOG_SIZE" -gt "$LAST_LOG_SIZE" ]; then
                            # 新しいログ内容を表示
                            NEW_CONTENT=$(tail -c +$((LAST_LOG_SIZE + 1)) "$PR_LOG" | head -n 5 | sed 's/^/     /')
                            if [ -n "$NEW_CONTENT" ]; then
                                cecho "${BLUE}📝 [LOG]:${NC}"
                                echo "$NEW_CONTENT"
                            fi
                            LAST_LOG_SIZE=$CURRENT_LOG_SIZE
                            DOTS=""
                        else
                            # ログに変化がない場合はドットを表示
                            DOTS="${DOTS}."
                            printf "\r${YELLOW}⏳ Waiting for response${DOTS}${NC}"
                            if [ ${#DOTS} -gt 10 ]; then
                                DOTS=""
                            fi
                        fi
                    fi
                    sleep 2
                done
                printf "\r\033[K"  # 行をクリア
                
                # プロセスの終了ステータスを取得
                wait "$NODE_PID"
                NODE_EXIT_CODE=$?
                
                if [ $NODE_EXIT_CODE -eq 0 ]; then
                    PR_END_TIME=$(date +%s)
                    PR_DURATION=$((PR_END_TIME - PR_START_TIME))
                    
                    SUCCESSFUL_PRS=$((SUCCESSFUL_PRS + 1))
                    cecho "${GREEN}✅ Status: Completed successfully${NC}"
                    cecho "${GREEN}   ✅ Success (${PR_DURATION}s)${NC}" | tee -a "$LOG_FILE"
                    
                    # サマリーに追記
                    {
                        echo "SUCCESS,$repo_name,$category_name,$pr_title,$PR_DURATION"
                    } >> "${OUTPUT_BASE}/results.csv"
                else
                    PR_END_TIME=$(date +%s)
                    PR_DURATION=$((PR_END_TIME - PR_START_TIME))
                    
                    FAILED_PRS=$((FAILED_PRS + 1))
                    cecho "${RED}❌ Status: Failed (Exit code: ${NODE_EXIT_CODE})${NC}"
                    cecho "${RED}   ❌ Failed (${PR_DURATION}s)${NC}" | tee -a "$LOG_FILE"
                    echo "   📋 See log: $PR_LOG" | tee -a "$LOG_FILE"
                    # エラーログの最後の数行を表示
                    cecho "${RED}📋 Last error lines:${NC}"
                    tail -n 10 "$PR_LOG" | sed 's/^/     /'
                    
                    # サマリーに追記
                    {
                        echo "FAILED,$repo_name,$category_name,$pr_title,$PR_DURATION"
                    } >> "${OUTPUT_BASE}/results.csv"
                fi
                
                # ワーカースクリプトを削除
                rm -f "$WORKER_SCRIPT"
                
                # 現在の統計を表示
                cecho "${YELLOW}   📊 Progress: ${SUCCESSFUL_PRS} success, ${FAILED_PRS} failed, ${SKIPPED_PRS} skipped / ${TOTAL_PRS} total${NC}"
                
                # 短い待機（API負荷軽減）
                sleep 2
            done
        done
    done
}

# CSV ヘッダー
echo "status,repository,category,pr_title,duration_seconds" > "${OUTPUT_BASE}/results.csv"

# PR実行
find_and_execute_prs "$DATASET_DIR"

# 終了時刻と統計
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo "" | tee -a "$LOG_FILE"
cecho "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}" | tee -a "$LOG_FILE"
cecho "${GREEN}║         🎉 Batch Execution Completed                       ║${NC}" | tee -a "$LOG_FILE"
cecho "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
cecho "${BLUE}📊 Final Statistics:${NC}" | tee -a "$LOG_FILE"
cecho "${GREEN}   ✅ Successful: ${SUCCESSFUL_PRS}${NC}" | tee -a "$LOG_FILE"
cecho "${RED}   ❌ Failed: ${FAILED_PRS}${NC}" | tee -a "$LOG_FILE"
cecho "${YELLOW}   ⏭️  Skipped: ${SKIPPED_PRS}${NC}" | tee -a "$LOG_FILE"
cecho "${BLUE}   📝 Total PRs: ${TOTAL_PRS}${NC}" | tee -a "$LOG_FILE"

if [ $TOTAL_PRS -gt 0 ]; then
    SUCCESS_RATE=$((SUCCESSFUL_PRS * 100 / TOTAL_PRS))
    cecho "${BLUE}   📈 Success Rate: ${SUCCESS_RATE}%${NC}" | tee -a "$LOG_FILE"
fi

HOURS=$((TOTAL_DURATION / 3600))
MINUTES=$(((TOTAL_DURATION % 3600) / 60))
SECONDS=$((TOTAL_DURATION % 60))

cecho "${BLUE}   ⏱️  Total Duration: ${HOURS}h ${MINUTES}m ${SECONDS}s${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
cecho "${BLUE}📁 Results saved to:${NC}" | tee -a "$LOG_FILE"
cecho "${BLUE}   - Summary CSV: ${OUTPUT_BASE}/results.csv${NC}" | tee -a "$LOG_FILE"
cecho "${BLUE}   - Log: ${LOG_FILE}${NC}" | tee -a "$LOG_FILE"
cecho "${BLUE}   - Output: ${OUTPUT_BASE}/${NC}" | tee -a "$LOG_FILE"

# 最後に処理したPRを記録（再開用）
if [ -n "$repo_name" ] && [ -n "$category_name" ] && [ -n "$pr_title" ]; then
    echo "" | tee -a "$LOG_FILE"
    cecho "${YELLOW}🔄 To resume from next PR (if interrupted):${NC}" | tee -a "$LOG_FILE"
    cecho "${YELLOW}   sh $0 $DATASET_INDEX --resume \"$repo_name\" \"$category_name\" \"$pr_title\"${NC}" | tee -a "$LOG_FILE"
fi

# JSON サマリー生成
cat > "$SUMMARY_FILE" << EOF
{
  "dataset": "${DATASET_DIR}",
  "startTime": "${START_TIME}",
  "endTime": "${END_TIME}",
  "durationSeconds": ${TOTAL_DURATION},
  "statistics": {
    "total": ${TOTAL_PRS},
    "successful": ${SUCCESSFUL_PRS},
    "failed": ${FAILED_PRS},
    "skipped": ${SKIPPED_PRS}
  },
  "outputDirectory": "${OUTPUT_BASE}",
  "logFile": "${LOG_FILE}",
  "resultsCSV": "${OUTPUT_BASE}/results.csv"
}
EOF

echo ""
cecho "${GREEN}✨ Batch execution summary saved to: ${SUMMARY_FILE}${NC}"

# 結果に応じて終了コード
if [ $FAILED_PRS -gt 0 ]; then
    exit 1
else
    exit 0
fi