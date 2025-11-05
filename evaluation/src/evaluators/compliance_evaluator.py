"""
システム適合性評価器 - LLM統合版
APRシステムのパーサ整合性とワークフロー適合性を評価
"""

import json
import re
import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

from ..utils.log_iterator import APRLogIterator, LogEntry
from ..utils.log_parser import APRLogParser, ParsedExperiment
from ..utils.template_manager import APRPromptTemplates
from ..llm.llm_integration import LLMEvaluationManager, LLMResponse, OpenAIProvider, AnthropicProvider, MockLLMProvider


@dataclass
class ComplianceMetrics:
    """システム適合性メトリクス"""
    control_flow_accuracy: float  # 制御フロー解析精度
    parser_success_rate: float    # パーサー成功率
    file_processing_rate: float   # ファイル処理成功率
    error_handling_score: float   # エラーハンドリングスコア
    overall_compliance: float     # 総合適合性スコア


@dataclass
class LLMEvaluationResult:
    """LLM評価結果"""
    log_path: str
    experiment_id: str
    llm_response: LLMResponse
    parsed_evaluation: Optional[Dict[str, Any]]
    
    # 抽出されたメトリクス
    parser_success_rate: float
    workflow_compliance: bool
    system_health: str
    critical_issues: List[str]
    recommendations: List[str]


class SystemComplianceEvaluator:
    """システム適合性評価器（LLM統合版）"""
    
    def __init__(self, workspace_path: str = "/app", llm_provider: str = "mock", llm_model: str = None, 
                 prompt_template_style: str = "default"):
        """
        初期化
        
        Args:
            workspace_path: ワークスペースパス
            llm_provider: LLMプロバイダー (openai, anthropic, mock)
            llm_model: LLMモデル名
            prompt_template_style: プロンプトテンプレートスタイル (default, japanese, simple)
        """
        self.workspace_path = workspace_path
        self.log_iterator = APRLogIterator(workspace_path)  # ワークスペースパスを渡す
        self.log_parser = APRLogParser()
        
        # OpenAI利用可能モデル一覧
        openai_models = [
            "gpt-4.1",                    # 最新の高性能モデル (2024年5月リリース)
            "gpt-4.1-mini",              # 軽量版
            "gpt-4-turbo",              # 高速版 (最新のTurbo)
            "gpt-4-turbo-preview",      # Turbo プレビュー版
            "gpt-4-1106-preview",       # GPT-4 Turbo (2023年11月版)
            "gpt-4-0125-preview",       # GPT-4 Turbo (2024年1月版)
            "gpt-4",                    # 標準GPT-4
            "gpt-3.5-turbo"             # 軽量高速
        ]
        
        # LLMプロバイダーを作成
        if llm_provider == "openai":
            # モデル名が指定されていればそれを使用、なければデフォルト
            model_name = llm_model or "gpt-4-turbo"  # gpt-4-turboをデフォルトに
            
            # 指定されたモデルが利用可能リストにあるかチェック
            if llm_model and llm_model not in openai_models:
                print(f"⚠️  警告: 指定されたモデル '{llm_model}' は推奨リストにありません")
                print(f"📋 推奨モデル: {', '.join(openai_models)}")
            
            provider = OpenAIProvider(model_name=model_name)
            print(f"🤖 OpenAI プロバイダー初期化完了 - モデル: {model_name}")
            
        elif llm_provider == "anthropic":
            # Anthropicのモデル名も指定可能
            anthropic_models = [
                "claude-3-opus-20240229",     # 最高性能
                "claude-3-sonnet-20240229",   # バランス型
                "claude-3-haiku-20240307"     # 高速軽量
            ]
            model_name = llm_model or "claude-3-sonnet-20240229"
            
            if llm_model and llm_model not in anthropic_models:
                print(f"⚠️  警告: 指定されたモデル '{llm_model}' は推奨リストにありません")
                print(f"📋 推奨モデル: {', '.join(anthropic_models)}")
            
            provider = AnthropicProvider(model_name=model_name)
            print(f"🤖 Anthropic プロバイダー初期化完了 - モデル: {model_name}")
            
        else:  # "mock" または他の場合はMockプロバイダを使用
            provider = MockLLMProvider()
            print(f"🎭 Mock プロバイダー初期化完了 - テストモード")
        
        self.llm_manager = LLMEvaluationManager(provider)
        self.results: List[LLMEvaluationResult] = []
        
        # プロンプトテンプレート管理を初期化
        self.prompt_templates = APRPromptTemplates(template_style=prompt_template_style)
        
        # テンプレートの妥当性をチェック
        is_valid, missing_vars = self.prompt_templates.validate_evaluation_template()
        if not is_valid:
            print(f"⚠️  警告: 評価テンプレートに不足変数があります: {missing_vars}")
        else:
            print("✅ 評価テンプレートの妥当性確認完了")
    
    async def evaluate_single_repository(self, repository_name: str, max_logs: int = 5) -> Dict[str, Any]:
        """特定のリポジトリのログを評価（動作検証用）"""
        print(f"🔍 単一リポジトリ評価開始: {repository_name}")
        print(f"📊 最大処理ログ数: {max_logs}件")
        print("=" * 50)
        
        start_time = datetime.now()
        self.results = []
        
        # 指定リポジトリのログを巡回して評価
        processed_count = 0
        evaluation_tasks = []
        
        for log_entry in self.log_iterator.iterate_all_logs():
            # 指定されたリポジトリのログのみ処理
            if log_entry.project_name != repository_name:
                continue
                
            if max_logs is not None and processed_count >= max_logs:  # 指定件数まで制限
                break
                
            try:
                print(f"🔄 処理中 ({processed_count + 1}/{max_logs if max_logs is not None else '全件'}): {log_entry.log_path}")
                
                # ログファイルを解析
                parsed_experiment = self.log_parser.parse_log_file(log_entry.log_path)
                if not parsed_experiment:
                    print(f"⚠️  パース失敗: {log_entry.log_path}")
                    continue
                
                print(f"✅ パース成功: ID={parsed_experiment.experiment_id}, Turns={len(parsed_experiment.turns)}")
                
                # 評価タスクを作成（非同期処理用）
                task = self._evaluate_single_log_async(log_entry, parsed_experiment)
                evaluation_tasks.append(task)
                processed_count += 1
                    
            except Exception as e:
                print(f"⚠️  ログ評価エラー: {log_entry.log_path} - {e}")
                continue
        
        if processed_count == 0:
            print(f"❌ 指定されたリポジトリ '{repository_name}' のログが見つかりませんでした")
            print("📋 利用可能なリポジトリ:")
            for project in self.log_iterator.get_project_names():
                print(f"  - {project}")
            return self._create_empty_evaluation_result("no_logs_found")
        
        # 評価タスクを実行
        if evaluation_tasks:
            print(f"🚀 {len(evaluation_tasks)}件のログを並列評価中...")
            batch_results = await asyncio.gather(*evaluation_tasks, return_exceptions=True)
            self._process_batch_results(batch_results)
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        # 結果集計
        metrics = self._calculate_llm_metrics()
        
        evaluation_result = {
            "evaluation_type": "single_repository_compliance",
            "repository_name": repository_name,
            "timestamp": end_time.isoformat(),
            "processing_time_seconds": processing_time,
            "llm_provider": self.llm_manager.provider.__class__.__name__,
            "llm_model": self.llm_manager.provider.model_name,
            "summary": {
                "total_logs_processed": len(self.results),
                "successful_evaluations": len([r for r in self.results if r.llm_response.success]),
                "failed_evaluations": len([r for r in self.results if not r.llm_response.success]),
                "parser_issues_detected": len([r for r in self.results if r.parser_success_rate < 0.5]),
                "workflow_violations": len([r for r in self.results if not r.workflow_compliance]),
                "critical_systems": len([r for r in self.results if r.system_health == "CRITICAL"])
            },
            "compliance_metrics": asdict(metrics),
            "detailed_results": [self._serialize_result(result) for result in self.results]
        }
        
        print(f"✅ 単一リポジトリ評価完了: {repository_name}")
        print(f"  - 処理時間: {processing_time:.2f}秒")
        print(f"  - 処理ログ数: {len(self.results)}")
        print(f"  - LLM成功率: {evaluation_result['summary']['successful_evaluations']}/{len(self.results)}")
        print(f"  - 総合適合性スコア: {metrics.overall_compliance:.3f}")
        
        return evaluation_result
    
    def _create_empty_evaluation_result(self, reason: str) -> Dict[str, Any]:
        """空の評価結果を作成"""
        return {
            "evaluation_type": "single_repository_compliance",
            "repository_name": "unknown",
            "timestamp": datetime.now().isoformat(),
            "processing_time_seconds": 0.0,
            "llm_provider": self.llm_manager.provider.__class__.__name__,
            "llm_model": self.llm_manager.provider.model_name,
            "summary": {
                "total_logs_processed": 0,
                "successful_evaluations": 0,
                "failed_evaluations": 0,
                "parser_issues_detected": 0,
                "workflow_violations": 0,
                "critical_systems": 0
            },
            "compliance_metrics": asdict(ComplianceMetrics(0.0, 0.0, 0.0, 0.0, 0.0)),
            "detailed_results": [],
            "error_reason": reason
        }
    
    async def evaluate_all_projects(self) -> Dict[str, Any]:
        """全プロジェクトのログを評価"""
        print("🔍 Step 1: システム適合性評価開始（LLM統合版）")
        print("=" * 50)
        
        start_time = datetime.now()
        self.results = []
        
        # 全ログを巡回して評価（最初の5件のみテスト用）
        processed_count = 0
        evaluation_tasks = []
        
        for log_entry in self.log_iterator.iterate_all_logs():
            if processed_count >= 5:  # テスト用に制限
                break
                
            try:
                # ログファイルを解析
                parsed_experiment = self.log_parser.parse_log_file(log_entry.log_path)
                if not parsed_experiment:
                    continue
                
                # 評価タスクを作成（非同期処理用）
                task = self._evaluate_single_log_async(log_entry, parsed_experiment)
                evaluation_tasks.append(task)
                processed_count += 1
                    
            except Exception as e:
                print(f"⚠️  ログ評価エラー: {log_entry.log_path} - {e}")
                continue
        
        # 評価タスクを実行
        if evaluation_tasks:
            print(f"🚀 {len(evaluation_tasks)}件のログを並列評価中...")
            batch_results = await asyncio.gather(*evaluation_tasks, return_exceptions=True)
            self._process_batch_results(batch_results)
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        # 結果集計
        metrics = self._calculate_llm_metrics()
        
        evaluation_result = {
            "evaluation_type": "system_compliance_llm",
            "timestamp": end_time.isoformat(),
            "processing_time_seconds": processing_time,
            "llm_provider": self.llm_manager.provider.__class__.__name__,
            "llm_model": self.llm_manager.provider.model_name,
            "summary": {
                "total_logs_processed": len(self.results),
                "successful_evaluations": len([r for r in self.results if r.llm_response.success]),
                "failed_evaluations": len([r for r in self.results if not r.llm_response.success]),
                "parser_issues_detected": len([r for r in self.results if r.parser_success_rate < 0.5]),
                "workflow_violations": len([r for r in self.results if not r.workflow_compliance]),
                "critical_systems": len([r for r in self.results if r.system_health == "CRITICAL"])
            },
            "compliance_metrics": asdict(metrics),
            "project_breakdown": self._get_project_breakdown(),
            "detailed_results": [self._serialize_result(result) for result in self.results]
        }
        
        print(f"✅ システム適合性評価完了（LLM統合版）")
        print(f"  - 処理時間: {processing_time:.2f}秒")
        print(f"  - 処理ログ数: {len(self.results)}")
        print(f"  - LLM成功率: {evaluation_result['summary']['successful_evaluations']}/{len(self.results)}")
        print(f"  - 総合適合性スコア: {metrics.overall_compliance:.3f}")
        
        return evaluation_result
    
    async def _evaluate_single_log_async(self, log_entry: LogEntry, 
                                       parsed_experiment: ParsedExperiment) -> LLMEvaluationResult:
        """単一ログの非同期評価"""
        
        try:
            # 評価用データを抽出
            evaluation_data = self.log_parser.extract_evaluation_data(parsed_experiment)
            
            # プロンプトを生成
            prompt = self._generate_evaluation_prompt(evaluation_data)
            
            # キャッシュキーを生成
            cache_key = f"{parsed_experiment.experiment_id}_{len(parsed_experiment.turns)}"
            
            # LLM評価を実行
            llm_response = await self.llm_manager.evaluate_system_compliance(prompt, cache_key)
            
            # 評価結果を解析
            parsed_evaluation = None
            if llm_response.success:
                parsed_evaluation = self.llm_manager.parse_evaluation_result(llm_response.content)
            
            # メトリクスを抽出
            parser_success_rate, workflow_compliance, system_health, critical_issues, recommendations = \
                self._extract_metrics_from_evaluation(parsed_evaluation)
            
            return LLMEvaluationResult(
                log_path=str(log_entry.log_path),
                experiment_id=parsed_experiment.experiment_id,
                llm_response=llm_response,
                parsed_evaluation=parsed_evaluation,
                parser_success_rate=parser_success_rate,
                workflow_compliance=workflow_compliance,
                system_health=system_health,
                critical_issues=critical_issues,
                recommendations=recommendations
            )
            
        except Exception as e:
            # エラーの場合はデフォルト値で結果を作成
            return LLMEvaluationResult(
                log_path=str(log_entry.log_path),
                experiment_id=parsed_experiment.experiment_id if parsed_experiment else "unknown",
                llm_response=LLMResponse("", {}, "", "", False, str(e)),
                parsed_evaluation=None,
                parser_success_rate=0.0,
                workflow_compliance=False,
                system_health="CRITICAL",
                critical_issues=[f"Evaluation error: {str(e)}"],
                recommendations=["Fix evaluation pipeline"]
            )
    
    def _generate_evaluation_prompt(self, evaluation_data: Dict[str, Any]) -> str:
        """テンプレートファイルから評価用プロンプトを生成"""
        try:
            return self.prompt_templates.get_evaluation_prompt(evaluation_data)
        except Exception as e:
            print(f"⚠️  テンプレートプロンプト生成エラー: {e}")
            print("💡 フォールバックプロンプトを使用します")
            return self._generate_fallback_prompt(evaluation_data)
    
    def _generate_fallback_prompt(self, evaluation_data: Dict[str, Any]) -> str:
        """フォールバック用のハードコードプロンプト"""
        return f"""## APR System Compliance Evaluation ##
You are evaluating an Automated Program Repair (APR) system.

## Analysis Data ##
Experiment ID: {evaluation_data.get('experiment_id', 'N/A')}
Total Processing Turns: {evaluation_data.get('turn_count', 0)}
Overall Status: {evaluation_data.get('overall_status', 'N/A')}

## Raw Data ##
{json.dumps(evaluation_data.get('turns_data', [])[:2], indent=2, ensure_ascii=False)}

## Task ##
Evaluate parser integrity, workflow compliance, and system reliability.
Provide assessment in JSON format with parser_evaluation, workflow_evaluation, and overall_assessment sections.

Focus on identifying technical issues and providing actionable recommendations."""
    
    def _process_batch_results(self, batch_results: List):
        """バッチ結果を処理"""
        for result in batch_results:
            if isinstance(result, Exception):
                print(f"⚠️  バッチ処理エラー: {result}")
                continue
            
            if isinstance(result, LLMEvaluationResult):
                self.results.append(result)
    
    def _extract_metrics_from_evaluation(self, parsed_evaluation: Optional[Dict[str, Any]]) -> tuple:
        """LLM評価結果からメトリクスを抽出"""
        
        if not parsed_evaluation:
            return 0.0, False, "CRITICAL", ["No evaluation available"], ["Fix evaluation system"]
        
        # パーサー成功率の計算
        parser_evals = parsed_evaluation.get("parser_evaluation", [])
        if parser_evals:
            successful_parses = sum(1 for eval_item in parser_evals if eval_item.get("status") == "PASS")
            parser_success_rate = successful_parses / len(parser_evals)
        else:
            parser_success_rate = 0.0
        
        # ワークフロー適合性
        workflow_eval = parsed_evaluation.get("workflow_evaluation", {})
        workflow_compliance = workflow_eval.get("is_compliant", False)
        
        # システム健全性
        overall_assessment = parsed_evaluation.get("overall_assessment", {})
        system_health = overall_assessment.get("system_health", "POOR")
        critical_issues = overall_assessment.get("critical_issues", [])
        recommendations = overall_assessment.get("recommendations", [])
        
        return parser_success_rate, workflow_compliance, system_health, critical_issues, recommendations
    
    def _calculate_llm_metrics(self) -> ComplianceMetrics:
        """LLM評価結果から全体メトリクスを計算"""
        
        if not self.results:
            return ComplianceMetrics(0.0, 0.0, 0.0, 0.0, 0.0)
        
        successful_results = [r for r in self.results if r.llm_response.success]
        
        if not successful_results:
            return ComplianceMetrics(0.0, 0.0, 0.0, 0.0, 0.0)
        
        # パーサー成功率の平均
        parser_success_rate = sum(r.parser_success_rate for r in successful_results) / len(successful_results)
        
        # ワークフロー適合率
        workflow_compliance_rate = sum(1 for r in successful_results if r.workflow_compliance) / len(successful_results)
        
        # システム健全性スコア
        health_scores = {"EXCELLENT": 1.0, "GOOD": 0.8, "POOR": 0.4, "CRITICAL": 0.0}
        system_health_score = sum(health_scores.get(r.system_health, 0.0) for r in successful_results) / len(successful_results)
        
        # エラーハンドリングスコア（クリティカル問題が少ないほど高い）
        avg_critical_issues = sum(len(r.critical_issues) for r in successful_results) / len(successful_results)
        error_handling_score = max(0.0, 1.0 - (avg_critical_issues / 5.0))  # 5個以上で0点
        
        # 総合適合性スコア
        overall_compliance = (
            parser_success_rate * 0.3 +
            workflow_compliance_rate * 0.25 +
            system_health_score * 0.25 +
            error_handling_score * 0.2
        )
        
        return ComplianceMetrics(
            control_flow_accuracy=workflow_compliance_rate,
            parser_success_rate=parser_success_rate,
            file_processing_rate=system_health_score,
            error_handling_score=error_handling_score,
            overall_compliance=overall_compliance
        )
    
    def _get_project_breakdown(self) -> Dict[str, Dict]:
        """プロジェクト別内訳の取得"""
        project_results = {}
        
        for result in self.results:
            project_name = result.experiment_id.split('/')[0] if '/' in result.experiment_id else 'unknown'
            
            if project_name not in project_results:
                project_results[project_name] = {
                    "logs_count": 0,
                    "successful_evaluations": 0,
                    "parser_success_rate": 0.0,
                    "workflow_compliance_rate": 0.0,
                    "critical_issues_count": 0,
                    "avg_system_health": "UNKNOWN"
                }
            
            proj_stats = project_results[project_name]
            proj_stats["logs_count"] += 1
            proj_stats["successful_evaluations"] += 1 if result.llm_response.success else 0
            proj_stats["critical_issues_count"] += len(result.critical_issues)
        
        # プロジェクト別平均値を計算
        for project_name, stats in project_results.items():
            project_results_list = [r for r in self.results 
                                  if (r.experiment_id.split('/')[0] if '/' in r.experiment_id else 'unknown') == project_name]
            
            if project_results_list:
                successful_results = [r for r in project_results_list if r.llm_response.success]
                
                if successful_results:
                    stats["parser_success_rate"] = sum(r.parser_success_rate for r in successful_results) / len(successful_results)
                    stats["workflow_compliance_rate"] = sum(1 for r in successful_results if r.workflow_compliance) / len(successful_results)
                    
                    # 最も一般的なシステム健全性レベル
                    health_counts = {}
                    for r in successful_results:
                        health_counts[r.system_health] = health_counts.get(r.system_health, 0) + 1
                    
                    if health_counts:
                        stats["avg_system_health"] = max(health_counts.items(), key=lambda x: x[1])[0]
        
        return project_results
    
    def _serialize_result(self, result: LLMEvaluationResult) -> Dict[str, Any]:
        """評価結果をシリアライズ"""
        return {
            "log_path": result.log_path,
            "experiment_id": result.experiment_id,
            "llm_success": result.llm_response.success,
            "llm_error": result.llm_response.error_message,
            "parser_success_rate": result.parser_success_rate,
            "workflow_compliance": result.workflow_compliance,
            "system_health": result.system_health,
            "critical_issues": result.critical_issues,
            "recommendations": result.recommendations,
            "llm_usage": result.llm_response.usage
        }


async def demo_compliance_evaluation():
    """適合性評価のデモ"""
    print("🔍 システム適合性評価デモ（LLM統合版）")
    print("=" * 60)
    
    # デモ用に複数のモデルを試行
    demo_configs = [
        {"provider": "openai", "model": "gpt-4-turbo", "description": "OpenAI GPT-4 Turbo (推奨・高性能)"},
        {"provider": "openai", "model": "gpt-4-1106-preview", "description": "OpenAI GPT-4 Turbo (2023年11月版)"},
        {"provider": "openai", "model": "gpt-4.1", "description": "OpenAI gpt-4.1 (最新)"},
        {"provider": "openai", "model": "gpt-4.1-mini", "description": "OpenAI gpt-4.1 Mini (軽量)"},
        {"provider": "mock", "model": None, "description": "Mock LLM (テスト用)"}
    ]
    
    print("📋 利用可能な設定:")
    for i, config in enumerate(demo_configs, 1):
        print(f"  {i}. {config['description']}")
    
    # デモ用にMockを使用（本番では適切なプロバイダーを選択）
    selected_config = demo_configs[3]  # Mockを選択
    
    print(f"\n🚀 実行設定: {selected_config['description']}")
    print("-" * 60)
    
    # 評価器を初期化
    evaluator = SystemComplianceEvaluator(
        llm_provider=selected_config["provider"], 
        llm_model=selected_config["model"]
    )
    
    # 評価実行
    results = await evaluator.evaluate_all_projects()
    
    print("\n📊 評価結果サマリー:")
    print(f"  - 総合適合性スコア: {results['compliance_metrics']['overall_compliance']:.3f}")
    print(f"  - パーサー成功率: {results['compliance_metrics']['parser_success_rate']:.3f}")
    print(f"  - ワークフロー適合率: {results['compliance_metrics']['control_flow_accuracy']:.3f}")
    print(f"  - LLM評価成功率: {results['summary']['successful_evaluations']}/{results['summary']['total_logs_processed']}")
    print(f"  - 使用プロバイダー: {results['llm_provider']}")
    print(f"  - 使用モデル: {results['llm_model']}")
    
    print("\n💡 他のOpenAIモデルを試すには:")
    print('  evaluator = SystemComplianceEvaluator(llm_provider="openai", llm_model="gpt-4.1-mini")')
    print('  evaluator = SystemComplianceEvaluator(llm_provider="openai", llm_model="gpt-4-turbo")')
    print('  evaluator = SystemComplianceEvaluator(llm_provider="openai", llm_model="gpt-3.5-turbo")')
    

# 個別モデル実行用のヘルパー関数も追加
async def run_with_specific_model(provider: str = "openai", model: str = "gpt-4.1"):
    """指定されたモデルで評価を実行"""
    print(f"🎯 指定モデルでの評価: {provider}/{model}")
    
    evaluator = SystemComplianceEvaluator(
        llm_provider=provider,
        llm_model=model
    )
    
    results = await evaluator.evaluate_all_projects()
    return results


if __name__ == "__main__":
    asyncio.run(demo_compliance_evaluation())
