#!/usr/bin/env python3
"""
単一リポジトリ動作検証スクリプト
特定のリポジトリで少数のログファイルを対象に動作検証を実行
"""

import asyncio
import sys
from pathlib import Path

# パスを追加
sys.path.append('/app')

from src.evaluators.compliance_evaluator import SystemComplianceEvaluator
from src.utils.log_iterator import APRLogIterator


async def verify_single_repository():
    """単一リポジトリでの動作検証"""
    print("🔍 単一リポジトリ動作検証")
    print("=" * 50)
    
    # 利用可能なリポジトリを表示
    log_iterator = APRLogIterator("/app")
    available_repos = log_iterator.get_project_names()
    
    print(f"\n📋 利用可能なリポジトリ ({len(available_repos)}件):")
    for i, repo in enumerate(available_repos, 1):
        print(f"  {i}. {repo}")
    
    # 検証対象リポジトリを選択（デフォルト: servantes）
    target_repo = "servantes"  # 修正可能
    max_logs = 5
    
    print(f"\n🎯 検証対象: {target_repo}")
    print(f"📊 最大処理ログ数: {max_logs}件")
    
    # 各LLMプロバイダーでテスト
    test_configs = [
        {"provider": "mock", "model": None, "description": "Mock LLM (高速テスト)"},
        # 実際のOpenAI APIキーが設定されている場合は以下も試せます
        # {"provider": "openai", "model": "gpt-4.1-mini", "description": "OpenAI gpt-4.1 Mini (軽量)"},
    ]
    
    print(f"\n🧪 テスト設定:")
    for i, config in enumerate(test_configs, 1):
        print(f"  {i}. {config['description']}")
    
    # 各設定でテスト実行
    for config in test_configs:
        print(f"\n" + "="*60)
        print(f"🚀 テスト実行: {config['description']}")
        print("="*60)
        
        try:
            # 評価器を初期化
            evaluator = SystemComplianceEvaluator(
                llm_provider=config["provider"],
                llm_model=config["model"]
            )
            
            # 単一リポジトリ評価を実行
            results = await evaluator.evaluate_single_repository(target_repo, max_logs)
            
            # 結果を表示
            print_evaluation_summary(results, config["description"])
            
        except Exception as e:
            print(f"❌ テスト実行エラー ({config['description']}): {e}")
            import traceback
            traceback.print_exc()


def print_evaluation_summary(results: dict, config_name: str):
    """評価結果サマリーを表示"""
    print(f"\n📊 評価結果サマリー - {config_name}")
    print("-" * 40)
    
    if "error_reason" in results:
        print(f"❌ エラー: {results['error_reason']}")
        return
    
    summary = results.get("summary", {})
    metrics = results.get("compliance_metrics", {})
    
    print(f"🎯 対象リポジトリ: {results.get('repository_name', 'N/A')}")
    print(f"⏱️  処理時間: {results.get('processing_time_seconds', 0):.2f}秒")
    print(f"📝 処理ログ数: {summary.get('total_logs_processed', 0)}")
    print(f"✅ LLM評価成功: {summary.get('successful_evaluations', 0)}")
    print(f"❌ LLM評価失敗: {summary.get('failed_evaluations', 0)}")
    print(f"🤖 使用プロバイダー: {results.get('llm_provider', 'N/A')}")
    print(f"🧠 使用モデル: {results.get('llm_model', 'N/A')}")
    
    print(f"\n📈 メトリクス:")
    print(f"  - 総合適合性スコア: {metrics.get('overall_compliance', 0):.3f}")
    print(f"  - パーサー成功率: {metrics.get('parser_success_rate', 0):.3f}")
    print(f"  - ワークフロー適合率: {metrics.get('control_flow_accuracy', 0):.3f}")
    print(f"  - エラーハンドリングスコア: {metrics.get('error_handling_score', 0):.3f}")
    
    # 詳細結果の一部を表示
    detailed_results = results.get("detailed_results", [])
    if detailed_results:
        print(f"\n📋 詳細結果 (最初の3件):")
        for i, result in enumerate(detailed_results[:3], 1):
            print(f"  {i}. {result.get('experiment_id', 'N/A')}")
            print(f"     LLM成功: {result.get('llm_success', False)}")
            print(f"     システム健全性: {result.get('system_health', 'N/A')}")
            print(f"     クリティカル問題: {len(result.get('critical_issues', []))}")


async def test_specific_repository(repo_name: str, max_logs: int = 3):
    """特定のリポジトリをテスト（個別実行用）"""
    print(f"🎯 個別リポジトリテスト: {repo_name}")
    
    evaluator = SystemComplianceEvaluator(llm_provider="mock")
    results = await evaluator.evaluate_single_repository(repo_name, max_logs)
    
    print_evaluation_summary(results, f"Mock Test - {repo_name}")
    return results


async def quick_verification():
    """クイック検証（最小限のテスト）"""
    print("⚡ クイック動作検証")
    print("=" * 30)
    
    # 複数のリポジトリで簡単なテスト
    test_repos = ["servantes", "boulder", "weaviate"]  # 存在するリポジトリ
    
    for repo in test_repos:
        print(f"\n🔄 テスト: {repo}")
        try:
            result = await test_specific_repository(repo, max_logs=2)
            status = "✅ 成功" if result.get("summary", {}).get("total_logs_processed", 0) > 0 else "⚠️  ログなし"
            print(f"   結果: {status}")
        except Exception as e:
            print(f"   結果: ❌ エラー - {e}")


if __name__ == "__main__":
    import os
    
    print("🚀 APR システム適合性評価 - 動作検証")
    print("=" * 60)
    
    # 引数に応じて実行モードを選択
    if len(sys.argv) > 1:
        mode = sys.argv[1]
        if mode == "quick":
            asyncio.run(quick_verification())
        elif mode == "full":
            asyncio.run(verify_single_repository())
        else:
            print("使用方法: python verify_single_repo.py [quick|full]")
    else:
        # デフォルトは単一リポジトリ検証
        asyncio.run(verify_single_repository())
