#!/bin/sh
# 高速バグ修正データセットコピー

echo "🐛 バグ修正データセットコピー開始"

# ソースからターゲットへまるごとコピー
cp -r /app/dataset/filtered_fewChanged /app/dataset/filtered_bugs_temp

echo "✅ 一時コピー完了"

# ディレクトリ名変更
mv /app/dataset/filtered_bugs_temp /app/dataset/filtered_bugs

echo "✅ すべて完了"
du -sh /app/dataset/filtered_bugs
