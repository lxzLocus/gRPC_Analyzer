#!/bin/sh
#
# Phase 2テスト実行スクリプト
# Modified検出失敗ケース10件で自動リカバリーの効果を測定
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Phase 2: Modified自動リカバリーテスト ==="
echo ""
echo "対象: Modified検出失敗ケース 10件"
echo "データセット: /app/dataset/tmp"
echo ""

# 出力ディレクトリ
OUTPUT_BASE="/app/output/phase2_test_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUTPUT_BASE"

echo "出力先: $OUTPUT_BASE"
echo ""

# テスト対象ケース
CASES="
Implement_RA_method_for_unpausing_accounts
Add_certificateProfileName_to_RA-_SA-_and_Core_order_protos
Add_IssuerID_field_to_CertificateStatus_proto
Add_validated_timestamp_to_challenges
akamai-purger-_move_to_proto3
Allow_reading_incident_rows_with_NULL_columns
Allow_WFEv1_to_specify_which_issuer_to_use
CA-_gRPC_plumbing_for_multiple_certificate_profiles
Deprecate_ROCSPStage6_feature_flag
GRPC-_Replace_CountByNames_MapElement_with_a_real_map
"

# 統計
TOTAL=0
SUCCESS=0
PATCH_GENERATED=0
AUTO_RECOVERY=0
FAILED=0

echo "🚀 テスト開始..."
echo ""

for CASE in $CASES; do
    TOTAL=$((TOTAL + 1))
    
    echo "[$TOTAL/10] $CASE"
    
    # 出力ディレクトリ
    CASE_OUTPUT="$OUTPUT_BASE/$CASE"
    mkdir -p "$CASE_OUTPUT"
    
    # SinglePRScript.jsを実行
    cd "$PROJECT_ROOT"
    
    # 一時的な設定ファイルを作成
    cat > /tmp/phase2_config.json << EOF
{
    "datasetDir": "/app/dataset/tmp",
    "repositoryName": ".",
    "category": ".",
    "pullRequestTitle": "$CASE",
    "outputDir": "$OUTPUT_BASE",
    "logDir": "$OUTPUT_BASE/logs"
}
EOF
    
    # 実行
    LOG_FILE="$CASE_OUTPUT/execution.log"
    node scripts/SinglePRScript.js \
        --dataset-dir "/app/dataset/tmp" \
        --repo "boulder" \
        --category "pullrequest" \
        --pr "$CASE" \
        --output "$OUTPUT_BASE" \
        > "$LOG_FILE" 2>&1
    
    EXIT_CODE=$?
    
    # 結果チェック
    if [ $EXIT_CODE -eq 0 ]; then
        SUCCESS=$((SUCCESS + 1))
        echo "  ✅ 実行成功"
        
        # AUTO-RECOVERYログ確認
        if grep -q "🔧 AUTO-RECOVERY: Modified tag detected in ANALYSIS state" "$LOG_FILE"; then
            AUTO_RECOVERY=$((AUTO_RECOVERY + 1))
            echo "  🔧 AUTO-RECOVERY発動"
        fi
        
        # パッチ生成確認
        PATCH_FILE="/app/dataset/tmp/$CASE/premerge/final_patch.diff"
        if [ -f "$PATCH_FILE" ] && [ -s "$PATCH_FILE" ]; then
            PATCH_GENERATED=$((PATCH_GENERATED + 1))
            echo "  ✅ パッチ生成成功"
        else
            echo "  ⚠️  パッチ未生成"
        fi
    else
        FAILED=$((FAILED + 1))
        echo "  ❌ 実行失敗 (exit code: $EXIT_CODE)"
    fi
    
    echo ""
done

# サマリー
echo "=== テスト結果サマリー ==="
echo ""
echo "総ケース数: $TOTAL"
echo "実行成功: $SUCCESS"
echo "実行失敗: $FAILED"
echo ""
echo "🔧 AUTO-RECOVERY発動: $AUTO_RECOVERY/$TOTAL ($((AUTO_RECOVERY * 100 / TOTAL))%)"
echo "✅ パッチ生成成功: $PATCH_GENERATED/$TOTAL ($((PATCH_GENERATED * 100 / TOTAL))%)"
echo ""

# 改善効果
echo "=== 改善効果 ==="
echo ""
echo "Phase 0（現状）: 0/10 パッチ生成"
echo "Phase 2（今回）: $PATCH_GENERATED/10 パッチ生成"
if [ $PATCH_GENERATED -gt 0 ]; then
    echo "改善: +$PATCH_GENERATED 件 ✅"
else
    echo "改善なし ⚠️"
fi
echo ""

# 詳細レポート
REPORT_FILE="$OUTPUT_BASE/phase2_test_report.txt"
cat > "$REPORT_FILE" << EOFR
Phase 2テスト結果レポート
=======================

実行日時: $(date)
対象: Modified検出失敗ケース 10件

結果サマリー
-----------
総ケース数: $TOTAL
実行成功: $SUCCESS
実行失敗: $FAILED

AUTO-RECOVERY発動: $AUTO_RECOVERY/$TOTAL ($((AUTO_RECOVERY * 100 / TOTAL))%)
パッチ生成成功: $PATCH_GENERATED/$TOTAL ($((PATCH_GENERATED * 100 / TOTAL))%)

改善効果
--------
Phase 0（現状）: 0/10 パッチ生成（0%）
Phase 2（今回）: $PATCH_GENERATED/10 パッチ生成 ($((PATCH_GENERATED * 100 / TOTAL))%)

ケース別詳細
-----------
EOFR

# ケース別詳細を追加
for CASE in $CASES; do
    LOG_FILE="$OUTPUT_BASE/$CASE/execution.log"
    PATCH_FILE="/app/dataset/tmp/$CASE/premerge/final_patch.diff"
    
    echo "$CASE:" >> "$REPORT_FILE"
    
    if [ -f "$LOG_FILE" ]; then
        if grep -q "🔧 AUTO-RECOVERY" "$LOG_FILE"; then
            echo "  🔧 AUTO-RECOVERY: YES" >> "$REPORT_FILE"
        else
            echo "  🔧 AUTO-RECOVERY: NO" >> "$REPORT_FILE"
        fi
        
        if [ -f "$PATCH_FILE" ] && [ -s "$PATCH_FILE" ]; then
            PATCH_SIZE=$(wc -l < "$PATCH_FILE")
            echo "  ✅ パッチ生成: YES ($PATCH_SIZE lines)" >> "$REPORT_FILE"
        else
            echo "  ⚠️  パッチ生成: NO" >> "$REPORT_FILE"
        fi
    else
        echo "  ❌ ログなし" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
done

echo "詳細レポート: $REPORT_FILE"
echo ""
echo "✅ テスト完了"
