#!/bin/bash

# パッチ生成検証スクリプト（修正版）
# パッチファイルは /app/dataset/.../premerge/final_patch.diff に保存されている

if [ -z "$1" ]; then
    echo "Usage: $0 <batch_output_directory>"
    echo "Example: $0 /app/output/batch_20260122_004949"
    exit 1
fi

batch_dir="$1"

if [ ! -d "$batch_dir" ]; then
    echo "❌ Error: Batch directory not found: $batch_dir"
    exit 1
fi

echo "🔍 Verifying Patch Generation for: $batch_dir"
echo ""

# CSV header
csv_file="$batch_dir/patch_verification_detailed.csv"
echo "repository,category,pr_title,has_patch_file,has_old_log,has_new_log,no_patch_log,patch_file_path,log_message" > "$csv_file"

# Counters
total_prs=0
patch_files=0
no_patch_files=0
old_log_format=0
new_log_generated=0
new_log_not_found=0

# PRs where log says patch exists but file missing
log_yes_file_no=()

# Iterate through each PR
for pr_dir in "$batch_dir"/*/*/*/; do
    if [ ! -d "$pr_dir" ]; then
        continue
    fi
    
    ((total_prs++))
    
    # Extract repository/category/pr_title from path
    pr_path=$(echo "$pr_dir" | sed "s|$batch_dir/||" | sed 's|/$||')
    repository=$(echo "$pr_path" | cut -d'/' -f1)
    category=$(echo "$pr_path" | cut -d'/' -f2)
    pr_title=$(echo "$pr_path" | cut -d'/' -f3)
    
    # Check patch file in dataset
    dataset_patch="/app/dataset/tmp/$pr_path/premerge/final_patch.diff"
    
    has_patch_file=0
    if [ -f "$dataset_patch" ]; then
        has_patch_file=1
        ((patch_files++))
    else
        ((no_patch_files++))
    fi
    
    # Check log messages
    log_file="$pr_dir/execution.log"
    has_old_log=0
    has_new_log=0
    no_patch_log=0
    log_message=""
    
    if [ -f "$log_file" ]; then
        # Old format: "Patch saved to:"
        if grep -q "Patch saved to:" "$log_file" 2>/dev/null; then
            has_old_log=1
            ((old_log_format++))
            log_message=$(grep "Patch saved to:" "$log_file" | tail -1)
        fi
        
        # New format: "✅ Patch file generated:"
        if grep -q "✅ Patch file generated:" "$log_file" 2>/dev/null; then
            has_new_log=1
            ((new_log_generated++))
            log_message=$(grep "✅ Patch file generated:" "$log_file" | tail -1)
        fi
        
        # No patch found message
        if grep -q "⚠️  No patch content found" "$log_file" 2>/dev/null; then
            no_patch_log=1
            ((new_log_not_found++))
            log_message=$(grep "⚠️  No patch content found" "$log_file" | tail -1)
        fi
    fi
    
    # Record to CSV
    echo "$repository,$category,$pr_title,$has_patch_file,$has_old_log,$has_new_log,$no_patch_log,\"$dataset_patch\",\"$log_message\"" >> "$csv_file"
    
    # Track inconsistencies
    if [ $has_new_log -eq 1 ] && [ $has_patch_file -eq 0 ]; then
        log_yes_file_no+=("$pr_path")
    fi
done

# Calculate statistics
no_patch_at_all=$((total_prs - patch_files - ${#log_yes_file_no[@]}))
file_yes_log_no=0
consistent=$((patch_files))

# Print results
echo "📊 Verification Results:"
echo "📝 Total PRs Analyzed: $total_prs"
echo ""
echo "--- Patch File Status ---"
echo "✅ Has patch file (.diff):              $patch_files"
echo "❌ No patch file:                        $no_patch_files"
echo ""
echo "--- Log Message Status ---"
echo "📝 Old log format (\"Patch saved to:\"):  $old_log_format"
echo "✅ New log (\"✅ Patch file generated:\"): $new_log_generated"
echo "⚠️  New log (\"⚠️  No patch content\"):    $new_log_not_found"
echo ""
echo "--- Pattern Analysis ---"
echo "🔴 No patch at all (file & log):        $no_patch_at_all"
echo "🟡 Log says yes, file missing:          ${#log_yes_file_no[@]}"
echo "🟠 File exists, log missing:            $file_yes_log_no"
echo "🟢 Consistent (file & log match):       $consistent"
echo ""

# Calculate success rate
if [ $total_prs -gt 0 ]; then
    success_rate=$((patch_files * 100 / total_prs))
    no_patch_rate=$((no_patch_at_all * 100 / total_prs))
else
    success_rate=0
    no_patch_rate=0
fi

echo "--- Success Rate ---"
echo "Patch file generation rate: ${success_rate}%"
echo "No patch at all rate:       ${no_patch_rate}%"
echo ""

# List inconsistencies
if [ ${#log_yes_file_no[@]} -gt 0 ]; then
    echo "🟡 PRs where log says patch exists but file is missing:"
    for pr in "${log_yes_file_no[@]}"; do
        echo "- $pr"
    done
    echo ""
fi

echo "📄 Detailed results saved to: $csv_file"
