#!/bin/sh

# リトライ実行スクリプト - 失敗したPRのみを再実行
# 使用方法: ./scripts/retry-failed.sh [options] [summary-file]

echo "🔄 Starting Retry Failed PRs Script..."
echo ""

# Node.jsの実行オプション（ガベージコレクション有効化）
NODE_OPTIONS="--expose-gc"

# デフォルトでリトライデータセットを保持しない
export KEEP_RETRY_DATASET="${KEEP_RETRY_DATASET:-false}"

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Node.jsスクリプトを実行
exec node $NODE_OPTIONS "$SCRIPT_DIR/RetryFailedScript.js" "$@"
