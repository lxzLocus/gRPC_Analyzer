#!/usr/bin/env python3
"""
評価結果ログビューワー
LLMによる評価結果の詳細表示と分析機能
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import argparse

# scripts/ディレクトリから実行される場合のパス設定
sys.path.append('/app')
sys.path.append('/app/src')


class EvaluationLogViewer:
    """評価結果ログビューワー"""
    
    def __init__(self, workspace_path: str = "/app"):
        self.workspace_path = Path(workspace_path)
        
        # 各種ログディレクトリ
        self.log_locations = {
            "verification": self.workspace_path / "output" / "verification_results",
            "logs": self.workspace_path / "logs", 
            "llm_evaluation": self.workspace_path / "logs",  # ログ場所を統一
            "apr_output": self.workspace_path / "apr-output",
            "results": self.workspace_path / "results"
        }
    
    def list_all_evaluation_files(self) -> Dict[str, List[Path]]:
        """全ての評価結果ファイル一覧を取得"""
        all_files = {}
        
        for location_name, location_path in self.log_locations.items():
            if location_path.exists():
                json_files = list(location_path.glob("*.json"))
                json_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)  # 新しい順
                all_files[location_name] = json_files
            else:
                all_files[location_name] = []
        
        return all_files
    
    def display_file_summary(self):
        """ファイル一覧の概要を表示"""
        print("📊 評価結果ログファイル一覧")
        print("=" * 60)
        
        all_files = self.list_all_evaluation_files()
        total_files = sum(len(files) for files in all_files.values())
        
        print(f"🗂️  総ファイル数: {total_files}件")
        print()
        
        for location_name, files in all_files.items():
            location_path = self.log_locations[location_name]
            description = {
                "verification": "単一リポジトリ評価結果",
                "logs": "LLM評価ログ", 
                "llm_evaluation": "詳細LLM評価ログ（新）",
                "apr_output": "APR処理結果",
                "results": "その他の結果"
            }.get(location_name, location_name)
            
            print(f"📁 {location_path}")
            print(f"   {description}")
            
            if files:
                for file in files[:5]:  # 最新5件
                    size_kb = file.stat().st_size / 1024
                    mtime = datetime.fromtimestamp(file.stat().st_mtime)
                    print(f"   - {file.name} ({size_kb:.1f}KB, {mtime.strftime('%m-%d %H:%M')})")
                if len(files) > 5:
                    print(f"   ... 他{len(files) - 5}件")
            else:
                print("   - (空)")
            print()
    
    def load_evaluation_file(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """評価ファイルを読み込み"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ ファイル読み込みエラー {file_path.name}: {e}")
            return None
    
    def display_detailed_evaluation(self, file_path: Path, show_llm_details: bool = True):
        """詳細な評価内容を表示"""
        data = self.load_evaluation_file(file_path)
        if not data:
            return
        
        print(f"🔍 詳細評価結果: {file_path.name}")
        print("=" * 60)
        
        # Mock_LLM、Fresh_MockLLM_Analysis、Real_XXX_Analysis、またはメインデータを探す
        possible_keys = ["Mock_LLM", "Fresh_MockLLM_Analysis"] + \
                       [f"Real_{provider.upper()}_Analysis" for provider in ["OPENAI", "ANTHROPIC", "MOCK"]]
        
        evaluation_data = data
        for key in possible_keys:
            if key in data:
                evaluation_data = data[key]
                break
        
        if "repository_name" in evaluation_data:
            # 基本情報
            print(f"📂 リポジトリ: {evaluation_data.get('repository_name', 'N/A')}")
            print(f"📅 評価日時: {evaluation_data.get('timestamp', 'N/A')}")
            print(f"⏱️  処理時間: {evaluation_data.get('processing_time_seconds', 0):.2f}秒")
            print(f"🤖 LLMプロバイダー: {evaluation_data.get('llm_provider', 'N/A')}")
            print(f"🧠 LLMモデル: {evaluation_data.get('llm_model', 'N/A')}")
            print()
            
            # 評価サマリー
            summary = evaluation_data.get("summary", {})
            print("📊 評価サマリー:")
            print(f"  - 処理ログ数: {summary.get('total_logs_processed', 0)}")
            print(f"  - LLM成功率: {summary.get('successful_evaluations', 0)}/{summary.get('total_logs_processed', 0)}")
            print(f"  - 失敗評価: {summary.get('failed_evaluations', 0)}")
            print(f"  - パーサー問題検出: {summary.get('parser_issues_detected', 0)}")
            print(f"  - ワークフロー違反: {summary.get('workflow_violations', 0)}")
            print(f"  - 重大システム: {summary.get('critical_systems', 0)}")
            print()
            
            # 適合性メトリクス
            metrics = evaluation_data.get("compliance_metrics", {})
            print("🎯 適合性メトリクス:")
            print(f"  - 制御フロー精度: {metrics.get('control_flow_accuracy', 0):.3f}")
            print(f"  - パーサー成功率: {metrics.get('parser_success_rate', 0):.3f}")
            print(f"  - ファイル処理率: {metrics.get('file_processing_rate', 0):.3f}")
            print(f"  - エラー処理スコア: {metrics.get('error_handling_score', 0):.3f}")
            print(f"  - 総合適合性: {metrics.get('overall_compliance', 0):.3f}")
            print()
        
        # 詳細結果
        detailed_results = evaluation_data.get("detailed_results", [])
        if detailed_results and show_llm_details:
            print(f"🔍 個別ログの詳細評価 ({len(detailed_results)}件):")
            print("-" * 60)
            
            for i, result in enumerate(detailed_results, 1):
                print(f"\\n--- ログ {i}: {Path(result.get('log_path', '')).name} ---")
                print(f"🆔 実験ID: {result.get('experiment_id', 'N/A')}")
                print(f"✅ LLM評価成功: {result.get('llm_success', False)}")
                
                if result.get('llm_error'):
                    print(f"❌ LLMエラー: {result['llm_error']}")
                
                print(f"📈 パーサー成功率: {result.get('parser_success_rate', 0):.1%}")
                print(f"🔄 ワークフロー適合: {result.get('workflow_compliance', False)}")
                print(f"❤️  システム健全性: {result.get('system_health', 'N/A')}")
                
                # 重大問題
                critical_issues = result.get("critical_issues", [])
                if critical_issues:
                    print(f"⚠️  重大問題:")
                    for issue in critical_issues:
                        print(f"    - {issue}")
                
                # 推奨事項
                recommendations = result.get("recommendations", [])
                if recommendations:
                    print(f"💡 推奨事項:")
                    for rec in recommendations:
                        print(f"    - {rec}")
                
                # LLM使用量
                usage = result.get("llm_usage", {})
                if usage:
                    total_tokens = usage.get("total_tokens", 0)
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)
                    print(f"🧮 LLM使用量: {total_tokens}トークン (入力:{prompt_tokens}, 出力:{completion_tokens})")
    
    def find_latest_evaluation(self, repository_name: str = None) -> Optional[Path]:
        """最新の評価結果ファイルを取得"""
        all_files = self.list_all_evaluation_files()
        
        # verification_resultsから優先的に探す
        verification_files = all_files.get("verification", [])
        
        if repository_name:
            # 特定のリポジトリの結果を探す
            matching_files = [f for f in verification_files if repository_name.lower() in f.name.lower()]
            if matching_files:
                return matching_files[0]  # 最新
        
        # リポジトリ指定なしまたは見つからない場合は最新を返す
        for location_files in all_files.values():
            if location_files:
                return location_files[0]  # 最新
        
        return None
    
    def compare_evaluations(self, file1: Path, file2: Path):
        """2つの評価結果を比較"""
        data1 = self.load_evaluation_file(file1)
        data2 = self.load_evaluation_file(file2)
        
        if not data1 or not data2:
            return
        
        print(f"⚖️  評価結果比較")
        print("=" * 60)
        print(f"📄 ファイル1: {file1.name}")
        print(f"📄 ファイル2: {file2.name}")
        print()
        
        # 基本情報の比較
        eval1 = data1.get("Mock_LLM", data1)
        eval2 = data2.get("Mock_LLM", data2)
        
        metrics1 = eval1.get("compliance_metrics", {})
        metrics2 = eval2.get("compliance_metrics", {})
        
        print("🎯 適合性メトリクス比較:")
        metric_names = [
            ("overall_compliance", "総合適合性"),
            ("parser_success_rate", "パーサー成功率"), 
            ("control_flow_accuracy", "制御フロー精度"),
            ("error_handling_score", "エラー処理スコア")
        ]
        
        for metric_key, metric_name in metric_names:
            val1 = metrics1.get(metric_key, 0)
            val2 = metrics2.get(metric_key, 0)
            diff = val2 - val1
            
            if diff > 0:
                trend = "📈"
            elif diff < 0:
                trend = "📉"  
            else:
                trend = "➡️"                python src/cli/real_llm_evaluator.py --repo boulder --max-logs 1 --provider mock --model gpt-5
            print(f"  {metric_name}: {val1:.3f} → {val2:.3f} {trend} ({diff:+.3f})")


def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(description="評価結果ログビューワー")
    parser.add_argument("--file", "-f", help="表示する評価ファイル名")
    parser.add_argument("--repo", "-r", help="特定のリポジトリの評価結果を表示")
    parser.add_argument("--latest", "-l", action="store_true", help="最新の評価結果を表示")
    parser.add_argument("--summary", "-s", action="store_true", help="ファイル一覧のみ表示")
    parser.add_argument("--compare", "-c", nargs=2, help="2つのファイルを比較")
    
    args = parser.parse_args()
    
    viewer = EvaluationLogViewer()
    
    if args.summary:
        viewer.display_file_summary()
        return
    
    if args.compare:
        file1 = Path("/app") / args.compare[0]
        file2 = Path("/app") / args.compare[1]
        viewer.compare_evaluations(file1, file2)
        return
    
    if args.file:
        # 指定ファイルを表示
        file_path = None
        for location_path in viewer.log_locations.values():
            candidate = location_path / args.file
            if candidate.exists():
                file_path = candidate
                break
        
        if file_path:
            viewer.display_detailed_evaluation(file_path)
        else:
            print(f"❌ ファイルが見つかりません: {args.file}")
            viewer.display_file_summary()
    
    elif args.repo or args.latest:
        # 最新または特定リポジトリの評価結果を表示
        file_path = viewer.find_latest_evaluation(args.repo)
        if file_path:
            viewer.display_detailed_evaluation(file_path)
        else:
            print("❌ 評価結果ファイルが見つかりません")
            viewer.display_file_summary()
    
    else:
        # デフォルト: ファイル一覧を表示
        viewer.display_file_summary()


if __name__ == "__main__":
    main()
