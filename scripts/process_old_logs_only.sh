#!/bin/sh

# 古いログのみ持つPRを再処理するための簡易スクリプト
# 11月13-14日のログがなく、古いログのみあるPRをリストアップ

DATASET_DIR="/app/dataset/filtered_fewChanged"
LOG_DIR="/app/log"
OUTPUT_FILE="/tmp/prs_to_reprocess.txt"

echo "🔍 Finding PRs with old logs only..."
echo "" > "$OUTPUT_FILE"

for project_dir in "$DATASET_DIR"/*; do
    [ -d "$project_dir" ] || continue
    project=$(basename "$project_dir")
    
    for category_dir in "$project_dir"/*; do
        [ -d "$category_dir" ] || continue
        category=$(basename "$category_dir")
        
        for pr_dir in "$category_dir"/*; do
            [ -d "$pr_dir" ] || continue
            pr=$(basename "$pr_dir")
            
            log_path="$LOG_DIR/$project/$category/$pr"
            
            if [ -d "$log_path" ]; then
                nov13_logs=$(find "$log_path" -name "2025-11-13*.log" 2>/dev/null | wc -l)
                nov14_logs=$(find "$log_path" -name "2025-11-14*.log" 2>/dev/null | wc -l)
                
                if [ $nov13_logs -eq 0 ] && [ $nov14_logs -eq 0 ]; then
                    echo "$project|$category|$pr" >> "$OUTPUT_FILE"
                fi
            fi
        done
    done
done

count=$(grep -c . "$OUTPUT_FILE")

echo ""
echo "✅ Found $count PRs to reprocess"
echo "📝 List saved to: $OUTPUT_FILE"
echo ""
echo "To process these PRs, run:"
echo "  node scripts/ProcessUnprocessedOnly.js"
