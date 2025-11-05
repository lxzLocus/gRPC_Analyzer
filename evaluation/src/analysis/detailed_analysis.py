#!/usr/bin/env python3
"""
詳細分析付きリポジトリ動作検証
特定のリポジトリの詳細なログ分析と結果保存
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

# パスを追加
sys.path.append('/app')

from src.evaluators.compliance_evaluator import SystemComplianceEvaluator
from src.utils.log_iterator import APRLogIterator


async def detailed_repository_analysis(repo_name: str = "servantes", max_logs: int = 5):
    """詳細なリポジトリ分析"""
    print(f"🔬 詳細リポジトリ分析: {repo_name}")
    print("=" * 60)
    
    # 結果保存ディレクトリを作成
    results_dir = Path("/app/output/verification_results")
    results_dir.mkdir(exist_ok=True)
    
    # タイムスタンプ付きファイル名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    result_file = results_dir / f"analysis_{repo_name}_{timestamp}.json"
    
    # 各LLMプロバイダーでテスト
    test_configs = [
        {"provider": "mock", "model": None, "name": "Mock_LLM"}
    ]
    
    # OpenAI APIキーが設定されていれば、OpenAIテストも追加
    import os
    if os.getenv("OPENAI_API_KEY"):
        test_configs.extend([
            {"provider": "openai", "model": "gpt-4.1-mini", "name": "GPT4o_Mini"},
            {"provider": "openai", "model": "gpt-4.1", "name": "GPT4o"}
        ])
        print("🔑 OpenAI API Key detected - real LLM tests will be included")
    else:
        print("⚠️  OpenAI API Key not found - using Mock LLM only")
    
    all_results = {}
    
    for config in test_configs:
        print(f"\n🧪 実行中: {config['name']}")
        print("-" * 40)
        
        try:
            # 評価器を初期化
            evaluator = SystemComplianceEvaluator(
                llm_provider=config["provider"],
                llm_model=config["model"]
            )
            
            # 単一リポジトリ評価を実行
            results = await evaluator.evaluate_single_repository(repo_name, max_logs)
            
            # 結果をディクショナリに保存
            all_results[config["name"]] = results
            
            # 結果サマリーを表示
            print_detailed_summary(results, config["name"])
            
        except Exception as e:
            print(f"❌ エラー ({config['name']}): {e}")
            all_results[config["name"]] = {"error": str(e)}
    
    # 結果をJSONファイルに保存
    print(f"\n💾 結果を保存中: {result_file}")
    with open(result_file, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"✅ 分析完了 - 結果ファイル: {result_file}")
    
    # 比較分析を表示
    print_comparison_analysis(all_results)
    
    return all_results


def print_detailed_summary(results: dict, config_name: str):
    """詳細サマリーを表示"""
    print(f"📊 詳細結果 - {config_name}:")
    
    if "error" in results:
        print(f"❌ エラー: {results['error']}")
        return
    
    summary = results.get("summary", {})
    metrics = results.get("compliance_metrics", {})
    
    print(f"  📈 メトリクス詳細:")
    print(f"    - 総合適合性: {metrics.get('overall_compliance', 0):.4f}")
    print(f"    - パーサー成功率: {metrics.get('parser_success_rate', 0):.4f}")
    print(f"    - 制御フロー精度: {metrics.get('control_flow_accuracy', 0):.4f}")
    print(f"    - ファイル処理率: {metrics.get('file_processing_rate', 0):.4f}")
    print(f"    - エラーハンドリング: {metrics.get('error_handling_score', 0):.4f}")
    
    print(f"  📝 処理統計:")
    print(f"    - 処理時間: {results.get('processing_time_seconds', 0):.2f}秒")
    print(f"    - 成功/失敗: {summary.get('successful_evaluations', 0)}/{summary.get('failed_evaluations', 0)}")
    print(f"    - パーサー問題: {summary.get('parser_issues_detected', 0)}件")
    print(f"    - ワークフロー違反: {summary.get('workflow_violations', 0)}件")
    print(f"    - クリティカルシステム: {summary.get('critical_systems', 0)}件")


def print_comparison_analysis(all_results: dict):
    """複数設定の比較分析"""
    print(f"\n🔍 比較分析")
    print("=" * 40)
    
    valid_results = {k: v for k, v in all_results.items() if "error" not in v}
    
    if len(valid_results) < 2:
        print("⚠️  比較に十分な結果がありません")
        return
    
    # メトリクス比較表
    print("📊 メトリクス比較:")
    print(f"{'設定':<15} {'総合適合性':<12} {'パーサー率':<10} {'制御フロー':<10} {'処理時間':<10}")
    print("-" * 60)
    
    for name, result in valid_results.items():
        metrics = result.get("compliance_metrics", {})
        processing_time = result.get("processing_time_seconds", 0)
        
        print(f"{name:<15} "
              f"{metrics.get('overall_compliance', 0):<12.4f} "
              f"{metrics.get('parser_success_rate', 0):<10.4f} "
              f"{metrics.get('control_flow_accuracy', 0):<10.4f} "
              f"{processing_time:<10.2f}")
    
    # 最良結果の特定
    best_overall = max(valid_results.items(), 
                      key=lambda x: x[1].get("compliance_metrics", {}).get("overall_compliance", 0))
    fastest = min(valid_results.items(),
                  key=lambda x: x[1].get("processing_time_seconds", float('inf')))
    
    print(f"\n🏆 ベストパフォーマンス:")
    print(f"  - 最高適合性: {best_overall[0]} ({best_overall[1]['compliance_metrics']['overall_compliance']:.4f})")
    print(f"  - 最速処理: {fastest[0]} ({fastest[1]['processing_time_seconds']:.2f}秒)")


def analyze_log_content(repo_name: str):
    """ログファイルの内容分析"""
    print(f"\n🔍 ログファイル内容分析: {repo_name}")
    print("-" * 30)
    
    log_iterator = APRLogIterator("/app")
    sample_count = 0
    
    for log_entry in log_iterator.iterate_all_logs():
        if log_entry.project_name != repo_name or sample_count >= 2:
            continue
            
        try:
            print(f"\n📄 ログファイル: {log_entry.log_path}")
            print(f"  サイズ: {log_entry.size:,} bytes")
            print(f"  タイムスタンプ: {log_entry.timestamp}")
            
            # ログファイルの最初の数行を表示
            with open(log_entry.log_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')[:10]  # 最初の10行
                print(f"  内容プレビュー:")
                for i, line in enumerate(lines, 1):
                    if line.strip():
                        print(f"    {i:2d}: {line[:100]}")
            
            sample_count += 1
            
        except Exception as e:
            print(f"  ❌ ログ読み込みエラー: {e}")


async def main():
    """メイン実行関数"""
    # コマンドライン引数処理
    repo_name = sys.argv[1] if len(sys.argv) > 1 else "servantes"
    max_logs = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    
    print(f"🚀 APRシステム適合性評価 - 詳細分析")
    print(f"🎯 対象リポジトリ: {repo_name}")
    print(f"📊 最大ログ数: {max_logs}")
    print("=" * 60)
    
    # ログ内容の事前分析
    analyze_log_content(repo_name)
    
    # 詳細分析実行
    results = await detailed_repository_analysis(repo_name, max_logs)
    
    print(f"\n✅ 全分析完了")
    print(f"📁 結果ファイルは /app/output/verification_results/ に保存されました")


if __name__ == "__main__":
    asyncio.run(main())
