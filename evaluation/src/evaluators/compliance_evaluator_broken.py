"""
Step 1: システム適合性評価器
APRログを解析してシステムの動作適合性を評価する
"""

import json
import re
import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

from ..utils.log_iterator import APRLogIterator, LogEntry, ProjectLogs
from ..utils.log_parser import APRLogParser, ParsedExperiment, SystemCompliancePromptGenerator
from ..llm.llm_integration import LLMProviderFactory, LLMEvaluationManager, LLMResponse


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
    
    def __init__(self, apr_logs_path: str = "/app/apr-logs", 
                 llm_provider: str = "mock", 
                 llm_model: Optional[str] = None):
        self.apr_logs_path = Path(apr_logs_path)
        self.log_iterator = APRLogIterator(apr_logs_path)
        
        # LLM統合のセットアップ
        provider = LLMProviderFactory.create_provider(llm_provider, llm_model)
        self.llm_manager = LLMEvaluationManager(provider)
        
        # ログパーサーとプロンプト生成器
        self.log_parser = APRLogParser()
        self.prompt_generator = SystemCompliancePromptGenerator()
        
        self.results: List[LLMEvaluationResult] = []
    
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
            prompt = self.prompt_generator.generate_prompt(evaluation_data)
            
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
    
    evaluator = SystemComplianceEvaluator(llm_provider="mock", llm_model="mock-gpt")
    results = await evaluator.evaluate_all_projects()
    
    print("\n📊 評価結果サマリー:")
    print(f"  - 総合適合性スコア: {results['compliance_metrics']['overall_compliance']:.3f}")
    print(f"  - パーサー成功率: {results['compliance_metrics']['parser_success_rate']:.3f}")
    print(f"  - ワークフロー適合率: {results['compliance_metrics']['control_flow_accuracy']:.3f}")
    print(f"  - LLM評価成功率: {results['summary']['successful_evaluations']}/{results['summary']['total_logs_processed']}")
    

if __name__ == "__main__":
    asyncio.run(demo_compliance_evaluation())
        """全プロジェクトのログを評価"""
        print("🔍 Step 1: システム適合性評価開始")
        print("=" * 50)
        
        start_time = datetime.now()
        self.results = []
        
        # 全ログを巡回して評価
        processed_count = 0
        for log_entry in self.log_iterator.iterate_all_logs():
            try:
                result = self._evaluate_single_log(log_entry)
                self.results.append(result)
                processed_count += 1
                
                if processed_count % 10 == 0:
                    print(f"  処理済み: {processed_count} ログ")
                    
            except Exception as e:
                print(f"⚠️  ログ評価エラー: {log_entry.log_path} - {e}")
                continue
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        # 結果集計
        metrics = self._calculate_overall_metrics()
        
        evaluation_result = {
            "evaluation_type": "system_compliance",
            "timestamp": end_time.isoformat(),
            "processing_time_seconds": processing_time,
            "summary": {
                "total_logs_processed": len(self.results),
                "successful_evaluations": len([r for r in self.results if r.parsing_success]),
                "failed_evaluations": len([r for r in self.results if not r.parsing_success]),
                "average_files_per_log": sum(r.files_processed for r in self.results) / len(self.results) if self.results else 0,
                "total_errors": sum(r.errors_count for r in self.results)
            },
            "compliance_metrics": asdict(metrics),
            "project_breakdown": self._get_project_breakdown(),
            "detailed_results": [asdict(result) for result in self.results[:100]]  # 最初の100件のみ保存
        }
        
        print(f"✅ システム適合性評価完了")
        print(f"  - 処理時間: {processing_time:.2f}秒")
        print(f"  - 処理ログ数: {len(self.results)}")
        print(f"  - 総合適合性スコア: {metrics.overall_compliance:.3f}")
        
        return evaluation_result
    
    def _evaluate_single_log(self, log_entry: LogEntry) -> LogAnalysisResult:
        """単一ログの評価"""
        analysis_start = datetime.now()
        
        # ログファイルを読み込み
        try:
            with open(log_entry.log_path, 'r', encoding='utf-8') as f:
                log_data = json.load(f)
        except Exception as e:
            # JSON読み込み失敗の場合はテキストとして読み込み
            with open(log_entry.log_path, 'r', encoding='utf-8', errors='ignore') as f:
                log_content = f.read()
            log_data = {"raw_content": log_content, "parsing_error": str(e)}
        
        analysis_end = datetime.now()
        processing_time = (analysis_end - analysis_start).total_seconds() * 1000
        
        # ログ内容を解析
        parsing_success = self._check_parsing_success(log_data)
        has_control_flow = self._check_control_flow(log_data)
        files_processed = self._count_processed_files(log_data)
        errors_count = self._count_errors(log_data)
        
        # スコア計算
        control_flow_score = 1.0 if has_control_flow else 0.0
        parser_score = 1.0 if parsing_success else 0.0
        file_processing_score = min(files_processed / 10.0, 1.0)  # 10ファイル処理で満点
        error_handling_score = max(0.0, 1.0 - (errors_count / 5.0))  # 5エラー以上で0点
        
        return LogAnalysisResult(
            project_name=log_entry.project_name,
            log_type=log_entry.log_type,
            log_path=str(log_entry.log_path),
            
            parsing_success=parsing_success,
            has_control_flow=has_control_flow,
            files_processed=files_processed,
            errors_count=errors_count,
            
            control_flow_score=control_flow_score,
            parser_score=parser_score,
            file_processing_score=file_processing_score,
            error_handling_score=error_handling_score,
            
            timestamp=log_entry.timestamp,
            log_size=log_entry.size,
            processing_time_ms=processing_time
        )
    
    def _check_parsing_success(self, log_data: Dict) -> bool:
        """パーシング成功チェック"""
        if "parsing_error" in log_data:
            return False
        
        # 一般的な成功指標をチェック
        success_indicators = [
            "status" in log_data and log_data.get("status") == "success",
            "parsing_success" in log_data and log_data.get("parsing_success"),
            "files" in log_data or "processed_files" in log_data,
            not ("error" in log_data or "exception" in log_data)
        ]
        
        return any(success_indicators)
    
    def _check_control_flow(self, log_data: Dict) -> bool:
        """制御フロー検出チェック"""
        # 制御フロー関連のキーワードを検索
        control_flow_keywords = [
            "control_flow", "control-flow", "controlflow",
            "method_calls", "function_calls", "call_graph",
            "ast", "syntax_tree", "program_flow"
        ]
        
        log_str = json.dumps(log_data).lower()
        return any(keyword in log_str for keyword in control_flow_keywords)
    
    def _count_processed_files(self, log_data: Dict) -> int:
        """処理ファイル数のカウント"""
        # 様々なファイル数指標を試行
        file_count_candidates = [
            log_data.get("files_processed", 0),
            log_data.get("file_count", 0),
            len(log_data.get("files", [])),
            len(log_data.get("processed_files", [])),
            log_data.get("num_files", 0)
        ]
        
        return max(file_count_candidates)
    
    def _count_errors(self, log_data: Dict) -> int:
        """エラー数のカウント"""
        error_count = 0
        
        # 直接的なエラー数
        if "error_count" in log_data:
            error_count += log_data["error_count"]
        
        # エラー配列
        if "errors" in log_data:
            error_count += len(log_data["errors"])
        
        # ログ内容からエラーキーワードを検索
        log_str = json.dumps(log_data).lower()
        error_keywords = ["error", "exception", "failed", "failure"]
        for keyword in error_keywords:
            error_count += log_str.count(keyword)
        
        return error_count
    
    def _calculate_overall_metrics(self) -> ComplianceMetrics:
        """全体メトリクスの計算"""
        if not self.results:
            return ComplianceMetrics(0.0, 0.0, 0.0, 0.0, 0.0)
        
        control_flow_accuracy = sum(r.control_flow_score for r in self.results) / len(self.results)
        parser_success_rate = sum(r.parser_score for r in self.results) / len(self.results)
        file_processing_rate = sum(r.file_processing_score for r in self.results) / len(self.results)
        error_handling_score = sum(r.error_handling_score for r in self.results) / len(self.results)
        
        # 総合スコアは各要素の重み付け平均
        overall_compliance = (
            control_flow_accuracy * 0.3 +
            parser_success_rate * 0.25 +
            file_processing_rate * 0.25 +
            error_handling_score * 0.2
        )
        
        return ComplianceMetrics(
            control_flow_accuracy=control_flow_accuracy,
            parser_success_rate=parser_success_rate,
            file_processing_rate=file_processing_rate,
            error_handling_score=error_handling_score,
            overall_compliance=overall_compliance
        )
    
    def _get_project_breakdown(self) -> Dict[str, Dict]:
        """プロジェクト別内訳の取得"""
        project_results = {}
        
        for result in self.results:
            if result.project_name not in project_results:
                project_results[result.project_name] = {
                    "logs_count": 0,
                    "successful_parsing": 0,
                    "control_flow_detected": 0,
                    "total_files_processed": 0,
                    "total_errors": 0,
                    "avg_control_flow_score": 0.0,
                    "avg_parser_score": 0.0
                }
            
            proj_stats = project_results[result.project_name]
            proj_stats["logs_count"] += 1
            proj_stats["successful_parsing"] += 1 if result.parsing_success else 0
            proj_stats["control_flow_detected"] += 1 if result.has_control_flow else 0
            proj_stats["total_files_processed"] += result.files_processed
            proj_stats["total_errors"] += result.errors_count
        
        # 平均値計算
        for project_name, stats in project_results.items():
            project_logs = [r for r in self.results if r.project_name == project_name]
            stats["avg_control_flow_score"] = sum(r.control_flow_score for r in project_logs) / len(project_logs)
            stats["avg_parser_score"] = sum(r.parser_score for r in project_logs) / len(project_logs)
        
        return project_results


def demo_compliance_evaluation():
    """適合性評価のデモ"""
    print("🔍 システム適合性評価デモ")
    
    evaluator = SystemComplianceEvaluator()
    results = evaluator.evaluate_all_projects()
    
    print("\n📊 評価結果サマリー:")
    print(f"  - 総合適合性スコア: {results['compliance_metrics']['overall_compliance']:.3f}")
    print(f"  - パーサー成功率: {results['compliance_metrics']['parser_success_rate']:.3f}")
    print(f"  - 制御フロー精度: {results['compliance_metrics']['control_flow_accuracy']:.3f}")
    

if __name__ == "__main__":
    demo_compliance_evaluation()
