#!/bin/bash
"""
実LLM評価実行スクリプト（OpenAI API使用）
"""

echo "🤖 実LLM評価システム - 実行ガイド"
echo "=================================="

# OpenAI APIキーの確認
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OpenAI APIキーが設定されていません"
    echo ""
    echo "📋 APIキー設定方法:"
    echo "1. OpenAIアカウントでAPIキーを取得: https://platform.openai.com/api-keys"
    echo "2. 環境変数を設定:"
    echo "   export OPENAI_API_KEY='your-api-key-here'"
    echo "3. または .env ファイルを作成:"
    echo "   echo 'OPENAI_API_KEY=your-api-key-here' > /app/.env"
    echo ""
    echo "💡 テスト実行にはMockLLMを使用:"
    echo "   python real_llm_evaluator.py --repo servantes --max-logs 3 --provider mock"
    echo ""
    exit 1
else
    echo "✅ OpenAI APIキーが設定されています"
    echo "🔑 キー長: $(echo $OPENAI_API_KEY | wc -c) 文字"
    echo ""
fi

# 利用可能なコマンド例を表示
echo "🚀 実LLM評価コマンド例:"
echo "========================"
echo ""
echo "📊 基本的な評価実行:"
echo "python real_llm_evaluator.py --repo servantes --max-logs 3 --provider openai --model gpt-4o-mini"
echo ""
echo "🎯 高品質評価（GPT-4o使用）:"
echo "python real_llm_evaluator.py --repo boulder --max-logs 5 --provider openai --model gpt-4o"
echo ""
echo "💰 コスト効率重視（GPT-3.5 Turbo）:"
echo "python real_llm_evaluator.py --repo emojivoto --max-logs 2 --provider openai --model gpt-3.5-turbo"
echo ""
echo "🔍 複数リポジトリ評価:"
for repo in servantes boulder emojivoto; do
    echo "python real_llm_evaluator.py --repo $repo --max-logs 2 --provider openai --model gpt-4o-mini"
done
echo ""
echo "📈 詳細ログ確認:"
echo "ls -la llm_evaluation_logs/"
echo "python evaluation_log_viewer.py --latest"
echo ""
echo "💡 推奨設定:"
echo "- テスト段階: --provider mock または --model gpt-4o-mini --max-logs 2"
echo "- 本格評価: --model gpt-4o --max-logs 5-10"
echo "- コスト重視: --model gpt-3.5-turbo"
echo ""

# 概算コスト表示
echo "💰 OpenAI APIコスト概算 (2024年料金):"
echo "===================================="
echo "GPT-4o:       入力 $5.00/1M, 出力 $15.00/1M tokens"
echo "GPT-4o-mini:  入力 $0.15/1M, 出力 $0.60/1M tokens"  
echo "GPT-3.5-turbo: 入力 $0.50/1M, 出力 $1.50/1M tokens"
echo ""
echo "📊 1回の評価あたりの概算コスト（3,000トークン想定）:"
echo "- GPT-4o:      約 $0.045"
echo "- GPT-4o-mini: 約 $0.0018"
echo "- GPT-3.5-turbo: 約 $0.0045"
echo ""

if [ -n "$OPENAI_API_KEY" ]; then
    echo "🎯 テスト実行を開始しますか？"
    echo "実行コマンド: python real_llm_evaluator.py --repo servantes --max-logs 2 --provider openai --model gpt-4o-mini"
    echo ""
    read -p "実行しますか? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 テスト実行開始..."
        cd /app && python real_llm_evaluator.py --repo servantes --max-logs 2 --provider openai --model gpt-4o-mini
    else
        echo "⏹️ 実行をキャンセルしました"
    fi
fi
