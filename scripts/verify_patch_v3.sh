#!/bin/sh

batch_dir="$1"
[ -z "$batch_dir" ] && { echo "Usage: $0 <batch_dir>"; exit 1; }

echo "🔍 Verifying: $batch_dir"
echo ""

total_prs=0
patch_files=0
new_log_generated=0
new_log_not_found=0

for pr_dir in "$batch_dir"/*/*/*/; do
    [ ! -d "$pr_dir" ] && continue
    
    total_prs=$((total_prs + 1))
    
    pr_path=$(echo "$pr_dir" | sed "s|$batch_dir/||" | sed 's|/$||')
    dataset_patch="/app/dataset/tmp/$pr_path/premerge/final_patch.diff"
    
    if [ -f "$dataset_patch" ]; then
        patch_files=$((patch_files + 1))
        echo "✅ $pr_path"
    fi
    
    log_file="$pr_dir/execution.log"
    if [ -f "$log_file" ]; then
        if grep -q "✅ Patch file generated:" "$log_file" 2>/dev/null; then
            new_log_generated=$((new_log_generated + 1))
        fi
        if grep -q "⚠️  No patch content found" "$log_file" 2>/dev/null; then
            new_log_not_found=$((new_log_not_found + 1))
        fi
    fi
done

echo ""
echo "📊 Results:"
echo "Total: $total_prs"
echo "Patch files found: $patch_files"
echo "Log 'generated': $new_log_generated"
echo "Log 'not found': $new_log_not_found"

if [ $total_prs -gt 0 ]; then
    rate=$((patch_files * 100 / total_prs))
    echo "Success rate: ${rate}%"
fi
