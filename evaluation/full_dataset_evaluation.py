#!/usr/bin/env python3
"""
データセット全件LLM評価実行ツール - GPT-4o使用
最新GPT-4oモデルを使用した全421ログの大規模評価
"""

import asyncio
import json
import sys
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List
from concurrent.futures import ThreadPoolExecutor

# .envファイルを明示的にロード
try:
    from dotenv import load_dotenv
    load_dotenv("/app/.env")
    print(f"✅ .envファイルをロード: OPENAI_API_KEY={'設定済み' if os.getenv('OPENAI_API_KEY') else '未設定'}")
except ImportError:
    print("⚠️  python-dotenvが未インストール - OSの環境変数を使用")

sys.path.append('/app')
sys.path.append('/app/src')

from real_llm_evaluator import EnhancedSystemComplianceEvaluator, DetailedLLMLogger


class FullDatasetEvaluator:
    """データセット全件評価クラス"""
    
    def __init__(self, llm_model: str = "gpt-4o", concurrent_limit: int = 5):
        self.llm_model = llm_model
        self.concurrent_limit = concurrent_limit
        self.start_time = datetime.now()
        self.timestamp = self.start_time.strftime("%Y%m%d_%H%M%S")
        
        # 出力ディレクトリの作成
        self.output_dir = Path("/app/full_dataset_results")
        self.output_dir.mkdir(exist_ok=True)
        
        # プロジェクトリスト
        self.projects = [
            "boulder", "daos", "emojivoto", "go-micro-services", 
            "hmda-platform", "loop", "orchestra", "pravega", 
            "rasa-sdk", "servantes", "weaviate"
        ]
        
        print(f"🚀 データセット全件評価システム初期化")
        print(f"🧠 使用モデル: {self.llm_model}")
        print(f"⚡ 並列処理数: {self.concurrent_limit}")
        print(f"📊 対象プロジェクト: {len(self.projects)}件")
        print(f"📁 出力ディレクトリ: {self.output_dir}")
    
    def get_all_log_files(self) -> Dict[str, List[Path]]:
        """全ログファイルを取得"""
        all_logs = {}
        total_logs = 0
        
        for project in self.projects:
            project_dir = Path(f"/app/apr-logs/{project}")
            if project_dir.exists():
                log_files = list(project_dir.glob("**/*.log"))
                all_logs[project] = log_files
                total_logs += len(log_files)
                print(f"📁 {project}: {len(log_files)} ログ")
            else:
                print(f"⚠️  {project}: ディレクトリが存在しません")
                all_logs[project] = []
        
        print(f"📊 総ログファイル数: {total_logs}")
        return all_logs
    
    async def evaluate_single_project(self, project: str, max_logs: int = None) -> Dict[str, Any]:
        """単一プロジェクトの評価"""
        print(f"\n🎯 プロジェクト評価開始: {project}")
        
        # プロジェクト専用ログ出力
        project_logger = DetailedLLMLogger(
            output_dir=f"/app/full_dataset_results/{project}_logs"
        )
        project_logger.log_evaluation_start(project, max_logs or "全件", "openai", self.llm_model)
        
        try:
            # 評価器の初期化
            evaluator = EnhancedSystemComplianceEvaluator(
                workspace_path="/app",
                llm_provider="openai",
                llm_model=self.llm_model,
                prompt_template_style="default",
                detailed_logger=project_logger
            )
            
            # 評価実行
            result = await evaluator.evaluate_single_repository(project, max_logs=max_logs)
            
            # 結果のログ出力
            project_logger.log_evaluation_summary(result)
            
            # 結果を保存
            output_file = self.output_dir / f"{project}_analysis_{self.timestamp}.json"
            result_data = {
                f"Full_Dataset_{self.llm_model.upper()}_Analysis": result
            }
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result_data, f, indent=2, ensure_ascii=False)
            
            project_logger.logger.info(f"💾 プロジェクト評価結果を保存: {output_file}")
            
            return {
                "project": project,
                "result": result,
                "success": True,
                "logger": project_logger
            }
            
        except Exception as e:
            project_logger.logger.error(f"❌ プロジェクト評価エラー: {project} - {e}")
            return {
                "project": project,
                "result": None,
                "success": False,
                "error": str(e),
                "logger": project_logger
            }
        finally:
            project_logger.finalize()
    
    async def evaluate_all_projects(self, max_logs_per_project: int = None) -> Dict[str, Any]:
        """全プロジェクトの並列評価"""
        print(f"\n🚀 データセット全件評価開始")
        print(f"📊 評価対象: {len(self.projects)} プロジェクト")
        print(f"🧠 使用モデル: {self.llm_model}")
        print(f"⚡ 並列処理: {self.concurrent_limit} 同時実行")
        if max_logs_per_project:
            print(f"📋 各プロジェクト最大ログ数: {max_logs_per_project}")
        else:
            print(f"📋 処理モード: 全ログファイル")
        print(f"⏰ 開始時刻: {self.start_time}")
        print("=" * 80)
        
        # セマフォを使用した並列実行制限
        semaphore = asyncio.Semaphore(self.concurrent_limit)
        
        async def evaluate_with_semaphore(project: str) -> Dict[str, Any]:
            async with semaphore:
                return await self.evaluate_single_project(project, max_logs_per_project)
        
        # 全プロジェクトの並列評価
        project_tasks = [evaluate_with_semaphore(project) for project in self.projects]
        project_results = await asyncio.gather(*project_tasks, return_exceptions=True)
        
        # 結果の集計
        successful_projects = []
        failed_projects = []
        total_logs_processed = 0
        total_successful_evaluations = 0
        total_failed_evaluations = 0
        total_tokens = 0
        total_cost = 0.0
        
        for i, result in enumerate(project_results):
            if isinstance(result, Exception):
                failed_projects.append({
                    "project": self.projects[i],
                    "error": str(result)
                })
                continue
            
            if result["success"]:
                successful_projects.append(result)
                project_result = result["result"]
                summary = project_result.get("summary", {})
                
                total_logs_processed += summary.get("total_logs_processed", 0)
                total_successful_evaluations += summary.get("successful_evaluations", 0)
                total_failed_evaluations += summary.get("failed_evaluations", 0)
                
                # トークンとコスト情報
                if result.get("logger"):
                    logger_responses = result["logger"].llm_responses
                    for response_data in logger_responses:
                        if response_data.get("usage"):
                            tokens = response_data["usage"].get("total_tokens", 0)
                            total_tokens += tokens
                            # GPT-4 Turboのコスト計算 (input: $0.01/1K, output: $0.03/1K)
                            input_tokens = response_data["usage"].get("prompt_tokens", 0)
                            output_tokens = response_data["usage"].get("completion_tokens", 0)
                            cost = (input_tokens * 0.01 + output_tokens * 0.03) / 1000
                            total_cost += cost
            else:
                failed_projects.append(result)
        
        # 総合結果の作成
        end_time = datetime.now()
        total_duration = (end_time - self.start_time).total_seconds()
        
        overall_results = {
            "evaluation_metadata": {
                "timestamp": self.timestamp,
                "start_time": self.start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "total_duration_seconds": total_duration,
                "llm_model": self.llm_model,
                "concurrent_limit": self.concurrent_limit,
                "max_logs_per_project": max_logs_per_project
            },
            "overall_summary": {
                "total_projects": len(self.projects),
                "successful_projects": len(successful_projects),
                "failed_projects": len(failed_projects),
                "total_logs_processed": total_logs_processed,
                "total_successful_evaluations": total_successful_evaluations,
                "total_failed_evaluations": total_failed_evaluations,
                "overall_success_rate": total_successful_evaluations / max(total_logs_processed, 1),
                "total_tokens": total_tokens,
                "total_cost_usd": total_cost,
                "average_logs_per_project": total_logs_processed / max(len(successful_projects), 1),
                "processing_rate_logs_per_minute": total_logs_processed / max(total_duration / 60, 1)
            },
            "project_results": successful_projects,
            "failed_projects": failed_projects
        }
        
        # 総合結果を保存
        overall_output = self.output_dir / f"full_dataset_analysis_{self.timestamp}.json"
        with open(overall_output, 'w', encoding='utf-8') as f:
            json.dump(overall_results, f, indent=2, ensure_ascii=False)
        
        # サマリー表示
        self.print_final_summary(overall_results)
        
        return overall_results
    
    def print_final_summary(self, results: Dict[str, Any]):
        """最終サマリーの表示"""
        print("\n" + "=" * 80)
        print("🎊 データセット全件評価完了")
        print("=" * 80)
        
        metadata = results["evaluation_metadata"]
        summary = results["overall_summary"]
        
        print(f"⏰ 開始時刻: {metadata['start_time']}")
        print(f"⏰ 終了時刻: {metadata['end_time']}")
        print(f"⏱️  総実行時間: {metadata['total_duration_seconds']:.2f}秒 ({metadata['total_duration_seconds']/60:.1f}分)")
        print(f"🧠 使用モデル: {metadata['llm_model']}")
        
        print(f"\n📊 評価統計:")
        print(f"  - 対象プロジェクト数: {summary['total_projects']}")
        print(f"  - 成功プロジェクト数: {summary['successful_projects']}")
        print(f"  - 失敗プロジェクト数: {summary['failed_projects']}")
        print(f"  - 総処理ログ数: {summary['total_logs_processed']:,}")
        print(f"  - 成功評価数: {summary['total_successful_evaluations']:,}")
        print(f"  - 失敗評価数: {summary['total_failed_evaluations']:,}")
        print(f"  - 全体成功率: {summary['overall_success_rate']:.3f}")
        
        print(f"\n💰 コスト情報:")
        print(f"  - 総トークン数: {summary['total_tokens']:,}")
        print(f"  - 総コスト: ${summary['total_cost_usd']:.2f} USD")
        
        print(f"\n⚡ パフォーマンス:")
        print(f"  - 平均ログ/プロジェクト: {summary['average_logs_per_project']:.1f}")
        print(f"  - 処理速度: {summary['processing_rate_logs_per_minute']:.1f} ログ/分")
        
        print(f"\n📁 出力ファイル: {self.output_dir}/full_dataset_analysis_{metadata['timestamp']}.json")
        print("=" * 80)


async def main():
    """メイン実行関数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="データセット全件LLM評価実行")
    parser.add_argument("--model", "-m", default="gpt-4o", help="使用するLLMモデル")
    parser.add_argument("--concurrent", "-c", type=int, default=5, help="並列実行数")
    parser.add_argument("--max-logs", "-n", type=int, help="各プロジェクトの最大ログ数（指定なしで全件）")
    parser.add_argument("--test", action="store_true", help="テストモード（各プロジェクト2ログのみ）")
    
    args = parser.parse_args()
    
    if args.test:
        args.max_logs = 2
        print("🧪 テストモード: 各プロジェクト2ログのみ処理")
    
    print(f"🎯 データセット全件評価開始")
    print(f"🧠 使用モデル: {args.model}")
    print(f"⚡ 並列実行数: {args.concurrent}")
    if args.max_logs:
        print(f"📊 各プロジェクト最大ログ数: {args.max_logs}")
    else:
        print(f"📊 処理モード: 全件処理")
    
    try:
        evaluator = FullDatasetEvaluator(
            llm_model=args.model,
            concurrent_limit=args.concurrent
        )
        
        results = await evaluator.evaluate_all_projects(args.max_logs)
        
        print(f"\n✅ データセット全件評価が正常に完了しました！")
        
    except KeyboardInterrupt:
        print("\n⏹️  ユーザーによって中断されました")
    except Exception as e:
        print(f"\n❌ 実行エラー: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
