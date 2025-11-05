#!/usr/bin/env python3
"""
APR評価システム - メインエントリーポイント

Usage:
    python main.py <command> [options]

Commands:
    evaluate      - APRシステムの評価を実行
    analyze       - 結果の分析を実行
    view          - ログやレスポンスの表示
    demo          - デモンストレーション実行

Examples:
    python main.py evaluate --repo boulder --max-logs 3
    python main.py analyze --input-dir /app/output/verification_results
    python main.py view --log-file /app/logs/evaluation.log
    python main.py demo --model gpt-4.1-mini
"""

import sys
import argparse
from pathlib import Path

# パスを追加
sys.path.append('/app')
sys.path.append('/app/src')


def main():
    parser = argparse.ArgumentParser(description="APR評価システム")
    subparsers = parser.add_subparsers(dest='command', help='利用可能なコマンド')
    
    # evaluate コマンド
    eval_parser = subparsers.add_parser('evaluate', help='APRシステムの評価を実行')
    eval_parser.add_argument('--repo', '-r', default='boulder', help='評価対象リポジトリ')
    eval_parser.add_argument('--max-logs', '-n', type=int, default=3, help='最大処理ログ数')
    eval_parser.add_argument('--provider', '-p', default='mock', help='LLMプロバイダー')
    eval_parser.add_argument('--model', '-m', help='LLMモデル名')
    
    # analyze コマンド
    analyze_parser = subparsers.add_parser('analyze', help='結果の分析を実行')
    analyze_parser.add_argument('--input-dir', '-i', default='/app/output/verification_results', help='入力ディレクトリ')
    analyze_parser.add_argument('--output-file', '-o', help='出力ファイル')
    
    # view コマンド
    view_parser = subparsers.add_parser('view', help='ログやレスポンスの表示')
    view_parser.add_argument('--log-file', '-l', help='ログファイルパス')
    view_parser.add_argument('--response-file', '-f', help='レスポンスファイルパス')
    
    # demo コマンド
    demo_parser = subparsers.add_parser('demo', help='デモンストレーション実行')
    demo_parser.add_argument('--model', '-m', default='gpt-4.1-mini', help='使用するモデル')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    if args.command == 'evaluate':
        from src.cli.real_llm_evaluator import run_real_llm_evaluation
        import asyncio
        
        print(f"🎯 評価開始: {args.repo}")
        print(f"📊 最大ログ数: {args.max_logs}")
        print(f"🤖 プロバイダー: {args.provider}")
        print(f"🧠 モデル: {args.model or 'デフォルト'}")
        
        try:
            asyncio.run(run_real_llm_evaluation(
                repository=args.repo,
                max_logs=args.max_logs,
                llm_provider=args.provider,
                llm_model=args.model
            ))
        except Exception as e:
            print(f"❌ 評価実行エラー: {e}")
            sys.exit(1)
            
    elif args.command == 'analyze':
        print(f"📊 分析開始")
        print(f"📂 入力ディレクトリ: {args.input_dir}")
        # TODO: 分析ツールの統合
        print("⚠️  分析機能は準備中です")
        
    elif args.command == 'view':
        print(f"👀 表示開始")
        if args.log_file:
            print(f"📋 ログファイル: {args.log_file}")
        if args.response_file:
            print(f"📄 レスポンスファイル: {args.response_file}")
        # TODO: ビューアーの統合
        print("⚠️  表示機能は準備中です")
        
    elif args.command == 'demo':
        print(f"🎮 デモ開始")
        print(f"🧠 モデル: {args.model}")
        # TODO: デモの統合
        print("⚠️  デモ機能は準備中です")


if __name__ == '__main__':
    main()
