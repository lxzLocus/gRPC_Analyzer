#!/bin/sh
# コピー結果確認スクリプト

echo "🔍 バグ修正データセットコピー結果確認"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# コピープロセスが完了するまで待機
echo "\n⏳ コピープロセスの完了を待機中..."
while ps aux | grep -q "[c]opyBugFixDataset"; do
    sleep 5
    echo "  まだ実行中..."
done

echo "\n✅ コピープロセス完了\n"

# ログファイルの表示
if [ -f /tmp/copy_result.log ]; then
    echo "📋 実行ログ:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat /tmp/copy_result.log
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

# ディレクトリ構造の確認
echo "\n📂 コピー結果ディレクトリ構造:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -lh /app/dataset/ | grep filtered
echo ""

# プロジェクト別PR数
echo "📊 プロジェクト別PR数:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for project in /app/dataset/filtered_bugs/*/; do
    if [ -d "$project" ]; then
        proj_name=$(basename "$project")
        pr_count=$(find "$project" -mindepth 2 -maxdepth 2 -type d | wc -l)
        printf "  %-20s %s件\n" "$proj_name" "$pr_count"
    fi
done

# 総PR数
total_prs=$(find /app/dataset/filtered_bugs -mindepth 3 -maxdepth 3 -type d | wc -l)
echo "\n  合計PR数: $total_prs件"

echo "\n✅ 確認完了"
