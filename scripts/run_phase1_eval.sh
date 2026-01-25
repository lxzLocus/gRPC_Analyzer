#!/bin/sh
# Phase 1評価実行スクリプト
# No Progress削減とFSM改善の効果測定

set -e

DATASET_DIR="/app/dataset/filtered_fewChanged"
OUTPUT_BASE="/app/output/phase1_eval_$(date +%Y%m%d_%H%M%S)"
REPORT_FILE="${OUTPUT_BASE}/phase1_evaluation_report.txt"

mkdir -p "$OUTPUT_BASE"

# Phase 1評価用ケース（filtered_fewChangedからランダムサンプリング）
CASES="
boulder:pullrequest:Remove_CertDER_from_GenerateOCSPRequest_proto
boulder:pullrequest:RA-_Add_GetAuthorization_method_to_filter_disabled_challenges
daos:pullrequest:DAOS-7807_control-_Add_label_to_pool_list_output
hmda-platform:pullrequest:Hmda_raw_serializr
boulder:pullrequest:Remove_-useV2authorizations-_boolean_flags-
daos:pullrequest:DAOS-14225_control-_Prevent_duplicate_call_to_SetRank
daos:pullrequest:DAOS-2242_control-_Add_dmg_reformat_support
boulder:pullrequest:Deprecate_ROCSPStage6_feature_flag
daos:pullrequest:DAOS-14334_control-_Fix_PoolCreateResp-leader
daos:pullrequest:DAOS-6079_dmg-bio-_Display_transport_ID_for_list-devices_command
"

echo "========================================"
echo "=== Phase 1 評価実行 ==="
echo "========================================"
echo ""
echo "対象: No Progress削減 + FSM改善"
echo "ケース数: 10件"
echo "出力先: $OUTPUT_BASE"
echo ""
echo "測定項目:"
echo "  1. completion_type分布"
echo "  2. VERIFYING経由率"
echo "  3. handleNoProgress()発動回数"
echo "  4. Ground Truthヒント提供回数"
echo "  5. リトライ成功率"
echo ""

# 開始時刻
START_TIME=$(date +%s)
TOTAL=10
COUNT=0
SUCCESS=0
FAILED=0

# 各ケースを実行
for CASE_LINE in $CASES; do
    if [ -z "$CASE_LINE" ]; then
        continue
    fi
    
    COUNT=$((COUNT + 1))
    
    # ケース情報を分解
    REPO=$(echo "$CASE_LINE" | cut -d: -f1)
    CATEGORY=$(echo "$CASE_LINE" | cut -d: -f2)
    PR=$(echo "$CASE_LINE" | cut -d: -f3)
    
    echo "[$COUNT/$TOTAL] $REPO/$CATEGORY/$PR"
    echo "  🚀 実行中..."
    
    # 出力ディレクトリ
    CASE_OUTPUT="$OUTPUT_BASE/$REPO/$CATEGORY/$PR"
    mkdir -p "$CASE_OUTPUT"
    
    # SinglePRScript実行
    LOG_FILE="$CASE_OUTPUT/execution.log"
    
    if node scripts/SinglePRScript.js \
        --dataset-dir "$DATASET_DIR" \
        --repo "$REPO" \
        --category "$CATEGORY" \
        --pr "$PR" \
        --output "$OUTPUT_BASE" \
        > "$LOG_FILE" 2>&1; then
        
        echo "  ✅ 実行成功"
        SUCCESS=$((SUCCESS + 1))
        
        # completion_typeを抽出
        COMPLETION=$(grep -o "Type: [a-z_]*" "$LOG_FILE" | tail -1 | cut -d' ' -f2 || echo "unknown")
        echo "  📊 完了タイプ: $COMPLETION"
        
        # Phase 1実装の効果を確認
        if grep -q "handleNoProgress" "$LOG_FILE" 2>/dev/null; then
            echo "  🔄 handleNoProgress発動: YES"
        fi
        
        if grep -q "groundTruthChangedFiles" "$LOG_FILE" 2>/dev/null; then
            echo "  💡 Ground Truthヒント提供: YES"
        fi
        
        if grep -q "noProgressRetried.*true" "$LOG_FILE" 2>/dev/null; then
            echo "  🔁 リトライ実行: YES"
        fi
        
    else
        echo "  ❌ 実行失敗"
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
done

# 終了時刻
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "========================================"
echo "=== Phase 1 評価完了 ==="
echo "========================================"
echo ""
echo "総ケース数: $TOTAL"
echo "実行成功: $SUCCESS"
echo "実行失敗: $FAILED"
echo "実行時間: ${DURATION}秒"
echo ""

# 評価指標を抽出
echo "=== 評価指標抽出中... ==="
echo ""

# 基本統計
PATCH_GEN=$(find "$OUTPUT_BASE" -name "*.log" -exec grep -l "Type: patch_generated" {} \; 2>/dev/null | wc -l)
LLM_NO_CHANGES=$(find "$OUTPUT_BASE" -name "*.log" -exec grep -l "Type: llm_no_changes" {} \; 2>/dev/null | wc -l)
SYSTEM_NO_PROGRESS=$(find "$OUTPUT_BASE" -name "*.log" -exec grep -l "Type: system_no_progress" {} \; 2>/dev/null | wc -l)

# FSM指標
VERIFYING_COUNT=$(find "$OUTPUT_BASE" -name "*.log" -exec grep -c "VERIFYING" {} \; 2>/dev/null | awk '{sum+=$1} END {print sum}')
NO_CHANGES_TAG=$(find "$OUTPUT_BASE" -name "*.log" -exec grep -c "No_Changes_Needed" {} \; 2>/dev/null | awk '{sum+=$1} END {print sum}')

# Phase 1実装効果
HANDLE_NO_PROGRESS=$(find "$OUTPUT_BASE" -name "*.log" -exec grep -c "handleNoProgress" {} \; 2>/dev/null | awk '{sum+=$1} END {print sum}')
GT_HINT=$(find "$OUTPUT_BASE" -name "*.log" -exec grep -c "groundTruthChangedFiles" {} \; 2>/dev/null | awk '{sum+=$1} END {print sum}')
RETRY_COUNT=$(find "$OUTPUT_BASE" -name "*.log" -exec grep -c "noProgressRetried.*true" {} \; 2>/dev/null | awk '{sum+=$1} END {print sum}')

# レポート生成
cat > "$REPORT_FILE" << EOF
Phase 1 評価レポート
===================

実行日時: $(date)
対象ケース数: $TOTAL
実行時間: ${DURATION}秒

基本統計
--------
patch_generated: $PATCH_GEN ($((PATCH_GEN * 100 / TOTAL))%)
llm_no_changes: $LLM_NO_CHANGES ($((LLM_NO_CHANGES * 100 / TOTAL))%)
system_no_progress: $SYSTEM_NO_PROGRESS ($((SYSTEM_NO_PROGRESS * 100 / TOTAL))%)

FSM指標
-------
VERIFYING遷移回数: $VERIFYING_COUNT
No_Changes_Neededタグ検出: $NO_CHANGES_TAG

Phase 1実装効果
---------------
handleNoProgress()発動: $HANDLE_NO_PROGRESS 回
Ground Truthヒント提供: $GT_HINT 回
リトライ実行: $RETRY_COUNT 回

詳細ログ
--------
各ケースのログは以下に保存:
$OUTPUT_BASE/[repo]/[category]/[pr]/execution.log

次のステップ
-----------
1. 定性評価（10件の手動分析）
2. Ground Truthヒント効果のA/B実験
3. Phase 1評価レポート作成
EOF

echo "📊 Phase 1評価指標"
echo "=================="
echo ""
echo "【基本統計】"
echo "  patch_generated: $PATCH_GEN / $TOTAL ($((PATCH_GEN * 100 / TOTAL))%)"
echo "  llm_no_changes: $LLM_NO_CHANGES / $TOTAL ($((LLM_NO_CHANGES * 100 / TOTAL))%)"
echo "  system_no_progress: $SYSTEM_NO_PROGRESS / $TOTAL ($((SYSTEM_NO_PROGRESS * 100 / TOTAL))%)"
echo ""
echo "【FSM指標】"
echo "  VERIFYING遷移: $VERIFYING_COUNT 回"
echo "  No_Changes_Neededタグ: $NO_CHANGES_TAG 回"
echo ""
echo "【Phase 1実装効果】"
echo "  handleNoProgress発動: $HANDLE_NO_PROGRESS 回"
echo "  Ground Truthヒント: $GT_HINT 回"
echo "  リトライ実行: $RETRY_COUNT 回"
echo ""
echo "✅ 評価完了"
echo ""
echo "📄 詳細レポート: $REPORT_FILE"
echo "📁 ログディレクトリ: $OUTPUT_BASE"
