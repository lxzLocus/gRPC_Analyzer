"""
統合評価システム
Step 1とStep 2の評価を統合して包括的な分析を実行
"""

import json
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
from dataclasses import dataclass, asdict

from .compliance_evaluator import SystemComplianceEvaluator
from .quality_evaluator import PatchQualityEvaluator


@dataclass
class IntegratedMetrics:
    """統合評価メトリクス"""
    # Step 1メトリクス
    control_flow_accuracy: float
    parser_success_rate: float
    file_processing_rate: float
    error_handling_score: float
    overall_compliance: float
    
    # Step 2メトリクス
    plausibility_score: float
    correctness_r1: float
    correctness_r5: float
    correctness_r10: float
    reasoning_quality: float
    semantic_similarity: float
    overall_quality: float
    
    # 統合メトリクス
    system_health_score: float      # システム全体の健全性
    ai_capability_score: float      # AI能力スコア
    overall_apr_score: float        # 総合APRスコア
    
    # 推奨事項
    recommendations: list


class IntegratedEvaluator:
    """統合評価システム"""
    
    def __init__(self):
        self.compliance_evaluator = SystemComplianceEvaluator()
        self.quality_evaluator = PatchQualityEvaluator()
        self.results = {}
    
    def run_full_evaluation(self, include_step1: bool = True, include_step2: bool = True) -> Dict[str, Any]:
        """完全な評価を実行"""
        print("🚀 統合APR評価システム実行開始")
        print("=" * 60)
        
        start_time = datetime.now()
        evaluation_results = {
            "evaluation_metadata": {
                "timestamp": start_time.isoformat(),
                "step1_enabled": include_step1,
                "step2_enabled": include_step2,
                "evaluator_version": "1.0"
            }
        }
        
        # Step 1: システム適合性評価
        step1_results = None
        if include_step1:
            print("🔍 Step 1: システム適合性評価実行中...")
            step1_results = self.compliance_evaluator.evaluate_all_projects()
            evaluation_results["step1_results"] = step1_results
            print("✅ Step 1完了\n")
        
        # Step 2: パッチ品質評価
        step2_results = None
        if include_step2:
            print("🎯 Step 2: パッチ品質評価実行中...")
            step2_results = self.quality_evaluator.evaluate_all_patches()
            evaluation_results["step2_results"] = step2_results
            print("✅ Step 2完了\n")
        
        # 統合分析
        print("📊 統合分析実行中...")
        integrated_analysis = self._perform_integrated_analysis(step1_results, step2_results)
        evaluation_results["integrated_analysis"] = integrated_analysis
        
        # 終了処理
        end_time = datetime.now()
        total_processing_time = (end_time - start_time).total_seconds()
        
        evaluation_results["evaluation_metadata"]["end_timestamp"] = end_time.isoformat()
        evaluation_results["evaluation_metadata"]["total_processing_time_seconds"] = total_processing_time
        
        print(f"🎉 統合評価完了 - 処理時間: {total_processing_time:.2f}秒")
        print(f"📈 総合APRスコア: {integrated_analysis['metrics']['overall_apr_score']:.3f}")
        
        return evaluation_results
    
    def _perform_integrated_analysis(self, step1_results: Dict, step2_results: Dict) -> Dict[str, Any]:
        """統合分析の実行"""
        
        # デフォルト値で初期化
        compliance_metrics = {
            "control_flow_accuracy": 0.0,
            "parser_success_rate": 0.0,
            "file_processing_rate": 0.0,
            "error_handling_score": 0.0,
            "overall_compliance": 0.0
        }
        
        quality_metrics = {
            "plausibility_score": 0.0,
            "correctness_r1": 0.0,
            "correctness_r5": 0.0,
            "correctness_r10": 0.0,
            "reasoning_quality": 0.0,
            "semantic_similarity": 0.0,
            "overall_quality": 0.0
        }
        
        # Step 1結果の取得
        if step1_results:
            compliance_metrics.update(step1_results.get("compliance_metrics", {}))
        
        # Step 2結果の取得
        if step2_results:
            quality_metrics.update(step2_results.get("quality_metrics", {}))
        
        # 統合メトリクスの計算
        integrated_metrics = self._calculate_integrated_metrics(compliance_metrics, quality_metrics)
        
        # 詳細分析
        detailed_analysis = self._generate_detailed_analysis(step1_results, step2_results, integrated_metrics)
        
        # 推奨事項の生成
        recommendations = self._generate_recommendations(integrated_metrics)
        
        return {
            "metrics": asdict(integrated_metrics),
            "detailed_analysis": detailed_analysis,
            "recommendations": recommendations,
            "cross_step_correlations": self._analyze_correlations(step1_results, step2_results),
            "performance_summary": self._generate_performance_summary(step1_results, step2_results)
        }
    
    def _calculate_integrated_metrics(self, compliance_metrics: Dict, quality_metrics: Dict) -> IntegratedMetrics:
        """統合メトリクスの計算"""
        
        # システム健全性スコア（Step 1の結果から）
        system_health_score = (
            compliance_metrics["control_flow_accuracy"] * 0.3 +
            compliance_metrics["parser_success_rate"] * 0.3 +
            compliance_metrics["file_processing_rate"] * 0.2 +
            compliance_metrics["error_handling_score"] * 0.2
        )
        
        # AI能力スコア（Step 2の結果から）
        ai_capability_score = (
            quality_metrics["plausibility_score"] * 0.25 +
            quality_metrics["correctness_r1"] * 0.30 +
            quality_metrics["correctness_r10"] * 0.25 +
            quality_metrics["reasoning_quality"] * 0.20
        )
        
        # 総合APRスコア（システム健全性とAI能力の組み合わせ）
        overall_apr_score = (system_health_score * 0.4 + ai_capability_score * 0.6)
        
        # 推奨事項の生成
        recommendations = []
        if system_health_score < 0.7:
            recommendations.append("システムの基本機能（パーサー、制御フロー解析）の改善が必要")
        if ai_capability_score < 0.5:
            recommendations.append("AI推論能力の向上とパッチ生成品質の改善が必要")
        if compliance_metrics["error_handling_score"] < 0.6:
            recommendations.append("エラーハンドリングの改善が急務")
        if quality_metrics["correctness_r1"] < 0.2:
            recommendations.append("正確なパッチ生成能力の大幅な改善が必要")
        
        return IntegratedMetrics(
            # Step 1メトリクス
            control_flow_accuracy=compliance_metrics["control_flow_accuracy"],
            parser_success_rate=compliance_metrics["parser_success_rate"],
            file_processing_rate=compliance_metrics["file_processing_rate"],
            error_handling_score=compliance_metrics["error_handling_score"],
            overall_compliance=compliance_metrics["overall_compliance"],
            
            # Step 2メトリクス
            plausibility_score=quality_metrics["plausibility_score"],
            correctness_r1=quality_metrics["correctness_r1"],
            correctness_r5=quality_metrics["correctness_r5"],
            correctness_r10=quality_metrics["correctness_r10"],
            reasoning_quality=quality_metrics["reasoning_quality"],
            semantic_similarity=quality_metrics["semantic_similarity"],
            overall_quality=quality_metrics["overall_quality"],
            
            # 統合メトリクス
            system_health_score=system_health_score,
            ai_capability_score=ai_capability_score,
            overall_apr_score=overall_apr_score,
            recommendations=recommendations
        )
    
    def _generate_detailed_analysis(self, step1_results: Dict, step2_results: Dict, 
                                  integrated_metrics: IntegratedMetrics) -> Dict[str, Any]:
        """詳細分析の生成"""
        
        analysis = {
            "system_performance": {
                "strengths": [],
                "weaknesses": [],
                "critical_issues": []
            },
            "quality_assessment": {
                "patch_generation_capability": "unknown",
                "reasoning_effectiveness": "unknown",
                "accuracy_level": "unknown"
            },
            "comparative_analysis": {
                "best_performing_projects": [],
                "worst_performing_projects": [],
                "performance_variance": 0.0
            }
        }
        
        # システム性能分析
        if integrated_metrics.system_health_score > 0.8:
            analysis["system_performance"]["strengths"].append("優秀なシステム基盤性能")
        elif integrated_metrics.system_health_score < 0.5:
            analysis["system_performance"]["critical_issues"].append("システム基盤に重大な問題")
        
        if integrated_metrics.parser_success_rate > 0.9:
            analysis["system_performance"]["strengths"].append("高いパーサー成功率")
        elif integrated_metrics.parser_success_rate < 0.7:
            analysis["system_performance"]["weaknesses"].append("パーサー成功率が低い")
        
        # 品質評価分析
        if integrated_metrics.correctness_r1 > 0.3:
            analysis["quality_assessment"]["accuracy_level"] = "高精度"
        elif integrated_metrics.correctness_r1 > 0.1:
            analysis["quality_assessment"]["accuracy_level"] = "中精度"
        else:
            analysis["quality_assessment"]["accuracy_level"] = "低精度"
        
        if integrated_metrics.reasoning_quality > 0.7:
            analysis["quality_assessment"]["reasoning_effectiveness"] = "効果的"
        elif integrated_metrics.reasoning_quality > 0.4:
            analysis["quality_assessment"]["reasoning_effectiveness"] = "普通"
        else:
            analysis["quality_assessment"]["reasoning_effectiveness"] = "改善が必要"
        
        # プロジェクト別比較分析
        if step1_results and "project_breakdown" in step1_results:
            project_scores = {}
            for project, stats in step1_results["project_breakdown"].items():
                project_scores[project] = stats.get("avg_parser_score", 0.0)
            
            if project_scores:
                sorted_projects = sorted(project_scores.items(), key=lambda x: x[1], reverse=True)
                analysis["comparative_analysis"]["best_performing_projects"] = sorted_projects[:3]
                analysis["comparative_analysis"]["worst_performing_projects"] = sorted_projects[-3:]
                
                scores = list(project_scores.values())
                if len(scores) > 1:
                    variance = sum((x - sum(scores)/len(scores))**2 for x in scores) / len(scores)
                    analysis["comparative_analysis"]["performance_variance"] = variance
        
        return analysis
    
    def _generate_recommendations(self, metrics: IntegratedMetrics) -> List[Dict[str, Any]]:
        """推奨事項の生成"""
        recommendations = []
        
        # 高優先度の推奨事項
        if metrics.overall_apr_score < 0.4:
            recommendations.append({
                "priority": "HIGH",
                "category": "critical_improvement",
                "title": "APRシステム全体の緊急改善",
                "description": "システム基盤とAI能力の両方に重大な問題があり、包括的な見直しが必要です。",
                "action_items": [
                    "基本的なパーサー機能の修正",
                    "制御フロー解析アルゴリズムの改善", 
                    "AI推論モデルの再検討",
                    "品質保証プロセスの強化"
                ]
            })
        
        # パーサー関連の推奨事項
        if metrics.parser_success_rate < 0.7:
            recommendations.append({
                "priority": "HIGH",
                "category": "parser_improvement",
                "title": "パーサー機能の改善",
                "description": f"パーサー成功率が{metrics.parser_success_rate:.1%}と低く、基本的なコード解析に問題があります。",
                "action_items": [
                    "パーサーのエラーハンドリング強化",
                    "サポートする言語仕様の拡張",
                    "構文エラー回復機能の実装"
                ]
            })
        
        # 品質関連の推奨事項
        if metrics.correctness_r1 < 0.2:
            recommendations.append({
                "priority": "HIGH",
                "category": "quality_improvement", 
                "title": "パッチ品質の大幅改善",
                "description": f"正確性@1が{metrics.correctness_r1:.1%}と極めて低く、パッチ生成能力に重大な問題があります。",
                "action_items": [
                    "LLMモデルの再評価・変更",
                    "プロンプトエンジニアリングの改善",
                    "トレーニングデータの品質向上",
                    "評価基準の見直し"
                ]
            })
        
        # 中優先度の推奨事項
        if metrics.reasoning_quality < 0.6:
            recommendations.append({
                "priority": "MEDIUM",
                "category": "reasoning_improvement",
                "title": "推論品質の向上",
                "description": "AI推論プロセスの改善により、より適切なパッチ生成が期待できます。",
                "action_items": [
                    "推論ステップの可視化",
                    "中間結果の品質チェック", 
                    "推論チェーンの最適化"
                ]
            })
        
        # システム安定性の推奨事項
        if metrics.error_handling_score < 0.6:
            recommendations.append({
                "priority": "MEDIUM",
                "category": "stability_improvement",
                "title": "システム安定性の向上",
                "description": "エラーハンドリングの改善により、システムの安定性を向上させる必要があります。",
                "action_items": [
                    "例外処理の改善",
                    "ログ品質の向上",
                    "回復機能の実装",
                    "監視システムの導入"
                ]
            })
        
        # 低優先度の改善事項
        if metrics.overall_apr_score > 0.6:
            recommendations.append({
                "priority": "LOW",
                "category": "optimization",
                "title": "最適化と微調整",
                "description": "基本的な性能は良好なため、さらなる最適化に取り組めます。",
                "action_items": [
                    "処理速度の向上",
                    "メモリ使用量の最適化",
                    "ユーザーインターフェースの改善",
                    "詳細な分析機能の追加"
                ]
            })
        
        return recommendations
    
    def _analyze_correlations(self, step1_results: Dict, step2_results: Dict) -> Dict[str, Any]:
        """Step間の相関分析"""
        correlations = {
            "parser_quality_correlation": "unknown",
            "system_health_impact": "unknown", 
            "error_impact_analysis": "unknown"
        }
        
        # 簡単な相関分析（より詳細な分析は将来の拡張で）
        if step1_results and step2_results:
            compliance_score = step1_results.get("compliance_metrics", {}).get("overall_compliance", 0)
            quality_score = step2_results.get("quality_metrics", {}).get("overall_quality", 0)
            
            if compliance_score > 0.7 and quality_score > 0.5:
                correlations["parser_quality_correlation"] = "strong_positive"
            elif compliance_score > 0.5 and quality_score < 0.3:
                correlations["parser_quality_correlation"] = "weak_or_negative"
            else:
                correlations["parser_quality_correlation"] = "unclear"
        
        return correlations
    
    def _generate_performance_summary(self, step1_results: Dict, step2_results: Dict) -> Dict[str, Any]:
        """パフォーマンス要約の生成"""
        summary = {
            "processing_efficiency": "unknown",
            "resource_utilization": "unknown",
            "scalability_assessment": "unknown"
        }
        
        # 処理時間の分析
        step1_time = step1_results.get("processing_time_seconds", 0) if step1_results else 0
        step2_time = step2_results.get("processing_time_seconds", 0) if step2_results else 0
        total_time = step1_time + step2_time
        
        if total_time < 300:  # 5分未満
            summary["processing_efficiency"] = "excellent"
        elif total_time < 1800:  # 30分未満
            summary["processing_efficiency"] = "good"
        elif total_time < 3600:  # 60分未満
            summary["processing_efficiency"] = "acceptable"
        else:
            summary["processing_efficiency"] = "needs_improvement"
        
        return summary


def demo_integrated_evaluation():
    """統合評価のデモ"""
    print("🚀 統合APR評価システムデモ")
    
    evaluator = IntegratedEvaluator()
    results = evaluator.run_full_evaluation()
    
    # 結果の保存
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = Path(f"/app/results/integrated_evaluation_{timestamp}.json")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"✅ 統合評価結果を保存: {output_file}")
    
    return results


if __name__ == "__main__":
    demo_integrated_evaluation()
