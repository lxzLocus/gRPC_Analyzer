#!/usr/bin/env python3
"""
システム適合性評価器 - LLM統合版
APRシステムのパーサ整合性とワークフロー適合性を評価
"""
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict

from utils.log_iterator import APRLogIterator
from utils.log_parser import APRLogParser
from llm.llm_integration import LLMEvaluationManager, LLMResponse

@dataclass
class ComplianceMetrics:
    """適合性メトリクス"""
    overall_compliance: float
    parser_success_avg: float
    workflow_compliance_rate: float
    system_health_score: float
    llm_evaluation_success_rate: float

@dataclass
class LogEvaluationResult:
    """個別ログの評価結果"""
    log_path: str
    project_name: str
    parser_success_rate: float
    workflow_compliance: bool
    system_health: str  # "GOOD", "WARNING", "CRITICAL"
    llm_response: LLMResponse
    workflow_tags_detected: List[str]
    evaluation_timestamp: str

class SystemComplianceEvaluator:
    """システム適合性評価器（LLM統合版）"""
    
    def __init__(self, workspace_path: str = "/app", llm_provider: str = "mock"):
        self.workspace_path = workspace_path
        self.log_iterator = APRLogIterator(workspace_path)
        self.log_parser = APRLogParser()
        self.llm_manager = LLMEvaluationManager(provider_type=llm_provider)
        self.results: List[LogEvaluationResult] = []
    
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
    
    async def _evaluate_single_log_async(self, log_entry, parsed_experiment) -> LogEvaluationResult:
        """単一ログの非同期評価"""
        try:
            # LLMプロンプト生成
            prompt = self.log_parser.prompt_generator.generate_system_compliance_prompt(parsed_experiment)
            
            # LLM評価実行
            llm_response = await self.llm_manager.evaluate_async(
                prompt=prompt,
                experiment_id=f"{log_entry.project}_{log_entry.log_path.stem}"
            )
            
            # 評価結果を解析
            parser_success_rate = self._calculate_parser_success_rate(parsed_experiment)
            workflow_compliance = self._check_workflow_compliance(parsed_experiment)
            system_health = self._assess_system_health(parser_success_rate, workflow_compliance, llm_response)
            
            return LogEvaluationResult(
                log_path=str(log_entry.log_path),
                project_name=log_entry.project,
                parser_success_rate=parser_success_rate,
                workflow_compliance=workflow_compliance,
                system_health=system_health,
                llm_response=llm_response,
                workflow_tags_detected=parsed_experiment.get('workflow_tags', []),
                evaluation_timestamp=datetime.now().isoformat()
            )
            
        except Exception as e:
            # エラー時はダミー結果を返す
            return LogEvaluationResult(
                log_path=str(log_entry.log_path),
                project_name=log_entry.project,
                parser_success_rate=0.0,
                workflow_compliance=False,
                system_health="CRITICAL",
                llm_response=LLMResponse(success=False, content="", error=str(e), evaluation_score=0.0),
                workflow_tags_detected=[],
                evaluation_timestamp=datetime.now().isoformat()
            )
    
    def _process_batch_results(self, batch_results: List):
        """バッチ処理結果を処理"""
        for result in batch_results:
            if isinstance(result, Exception):
                print(f"⚠️  バッチ処理エラー: {result}")
                continue
            if isinstance(result, LogEvaluationResult):
                self.results.append(result)
    
    def _calculate_parser_success_rate(self, parsed_experiment: Dict) -> float:
        """パーサ成功率を計算"""
        total_operations = parsed_experiment.get('total_parsing_operations', 1)
        successful_operations = parsed_experiment.get('successful_parsing_operations', 0)
        return successful_operations / total_operations if total_operations > 0 else 0.0
    
    def _check_workflow_compliance(self, parsed_experiment: Dict) -> bool:
        """ワークフロー適合性をチェック"""
        required_tags = ['%_Thought_%', '%_Plan_%', '%_Reply Required_%']
        detected_tags = parsed_experiment.get('workflow_tags', [])
        return len([tag for tag in required_tags if tag in detected_tags]) >= 2
    
    def _assess_system_health(self, parser_success_rate: float, workflow_compliance: bool, llm_response: LLMResponse) -> str:
        """システム健全性を評価"""
        if parser_success_rate >= 0.8 and workflow_compliance and llm_response.success:
            return "GOOD"
        elif parser_success_rate >= 0.5 and (workflow_compliance or llm_response.success):
            return "WARNING"
        else:
            return "CRITICAL"
    
    def _calculate_llm_metrics(self) -> ComplianceMetrics:
        """LLM統合メトリクスを計算"""
        if not self.results:
            return ComplianceMetrics(0.0, 0.0, 0.0, 0.0, 0.0)
        
        # 基本統計
        parser_success_avg = sum(r.parser_success_rate for r in self.results) / len(self.results)
        workflow_compliance_rate = len([r for r in self.results if r.workflow_compliance]) / len(self.results)
        llm_success_rate = len([r for r in self.results if r.llm_response.success]) / len(self.results)
        
        # システム健全性スコア
        health_scores = {"GOOD": 1.0, "WARNING": 0.5, "CRITICAL": 0.0}
        system_health_score = sum(health_scores.get(r.system_health, 0.0) for r in self.results) / len(self.results)
        
        # 総合適合性（重み付き平均）
        overall_compliance = (
            parser_success_avg * 0.3 +
            workflow_compliance_rate * 0.3 +
            system_health_score * 0.2 +
            llm_success_rate * 0.2
        )
        
        return ComplianceMetrics(
            overall_compliance=overall_compliance,
            parser_success_avg=parser_success_avg,
            workflow_compliance_rate=workflow_compliance_rate,
            system_health_score=system_health_score,
            llm_evaluation_success_rate=llm_success_rate
        )
    
    def _get_project_breakdown(self) -> Dict[str, Any]:
        """プロジェクト別内訳を取得"""
        projects = {}
        for result in self.results:
            if result.project_name not in projects:
                projects[result.project_name] = {
                    "log_count": 0,
                    "avg_parser_success": 0.0,
                    "workflow_compliance_count": 0,
                    "health_distribution": {"GOOD": 0, "WARNING": 0, "CRITICAL": 0}
                }
            
            project = projects[result.project_name]
            project["log_count"] += 1
            project["avg_parser_success"] += result.parser_success_rate
            if result.workflow_compliance:
                project["workflow_compliance_count"] += 1
            project["health_distribution"][result.system_health] += 1
        
        # 平均値を計算
        for project in projects.values():
            if project["log_count"] > 0:
                project["avg_parser_success"] /= project["log_count"]
        
        return projects
    
    def _serialize_result(self, result: LogEvaluationResult) -> Dict[str, Any]:
        """評価結果をシリアライズ"""
        return {
            "log_file_name": result.log_path.split('/')[-1],
            "project_name": result.project_name,
            "parser_success_rate": result.parser_success_rate,
            "workflow_compliance": result.workflow_compliance,
            "system_health": result.system_health,
            "llm_evaluation_success": result.llm_response.success,
            "llm_evaluation_score": result.llm_response.evaluation_score,
            "workflow_tags_count": len(result.workflow_tags_detected),
            "evaluation_timestamp": result.evaluation_timestamp
        }

# デモ実行関数
async def demo_compliance_evaluation():
    """デモ用のシステム適合性評価を実行"""
    print("🧪 システム適合性評価器 デモ実行")
    print("=" * 40)
    
    evaluator = SystemComplianceEvaluator(llm_provider="mock")
    result = await evaluator.evaluate_all_projects()
    
    # 結果をファイルに保存
    output_file = f"/app/apr-output/llm_compliance_evaluation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"📁 評価結果を保存: {output_file}")
    return result

if __name__ == "__main__":
    asyncio.run(demo_compliance_evaluation())
