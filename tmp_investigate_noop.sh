#!/bin/sh
# no-op調査スクリプト

echo "=== No-op Cases Investigation ==="
echo ""
echo "1. Checking latest evaluation report..."
LATEST_REPORT=$(ls -t /app/patchEvaluation/output/detailed_analysis_report_*.json 2>/dev/null | head -1)

if [ -n "$LATEST_REPORT" ]; then
    echo "Latest report: $LATEST_REPORT"
    echo ""
    
    echo "2. Extracting no-op cases..."
    jq -r '.casesAnalysis[] | select(.aprStatus != null and (.aprStatus | contains("No Changes"))) | "\(.projectName)/\(.category)/\(.pullRequestName) - \(.aprStatus)"' "$LATEST_REPORT" 2>/dev/null | head -20
    
    echo ""
    echo "3. Counting by status..."
    jq -r '.casesAnalysis[] | .aprStatus' "$LATEST_REPORT" 2>/dev/null | sort | uniq -c
else
    echo "No evaluation report found"
fi

echo ""
echo "4. Checking premerge directories for proto files..."
find /app/dataset/filtered_confirmed/boulder/pullrequest/Add_IssuerID_field_to_CertificateStatus_proto/premerge -name "*.proto" 2>/dev/null | wc -l
find /app/dataset/filtered_confirmed/boulder/pullrequest/Add_IssuerID_field_to_CertificateStatus_proto/commit_snapshot_*/ -name "*.proto" 2>/dev/null | wc -l

echo ""
echo "5. Checking for stub files..."
find /app/dataset/filtered_confirmed/boulder/pullrequest/Add_IssuerID_field_to_CertificateStatus_proto/premerge -name "*.pb.go" 2>/dev/null | wc -l
