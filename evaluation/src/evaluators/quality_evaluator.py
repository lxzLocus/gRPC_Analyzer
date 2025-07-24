"""
Step 2: パッチ品質評価器
APRが生成したパッチとグラウンドトゥルースを比較して品質を評価する
"""

import json
import csv
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
import difflib
import re


@dataclass
class QualityMetrics:
    """パッチ品質メトリクス"""
    plausibility_score: float     # 妥当性スコア
    correctness_r1: float         # 正確性@1
    correctness_r5: float         # 正確性@5  
    correctness_r10: float        # 正確性@10
    reasoning_quality: float      # 推論品質
    semantic_similarity: float    # 意味的類似度
    overall_quality: float        # 総合品質スコア


@dataclass
class PatchComparison:
    """パッチ比較結果"""
    project_name: str
    commit_hash: str
    file_path: str
    
    # 入力データ
    ground_truth: str
    generated_patch: Optional[str]
    
    # 評価結果
    has_generated_patch: bool
    exact_match: bool
    similarity_score: float
    plausibility_score: float
    reasoning_score: float
    
    # 詳細分析
    diff_analysis: Dict[str, Any]
    semantic_analysis: Dict[str, Any]
    
    timestamp: datetime


class PatchQualityEvaluator:
    """パッチ品質評価器"""
    
    def __init__(self, 
                 dataset_path: str = "/app/dataset", 
                 apr_output_path: str = "/app/apr-output"):
        self.dataset_path = Path(dataset_path)
        self.apr_output_path = Path(apr_output_path)
        self.dataset_entries: List[Dict] = []
        self.results: List[PatchComparison] = []
    
    def load_dataset(self) -> None:
        """データセットファイルを読み込み"""
        dataset_file = self.dataset_path / "P.U_merged_filtered - Final_merged_only_not_excluded_yes_ms_unarchived_commit_hash v2.0.csv"
        
        if not dataset_file.exists():
            raise FileNotFoundError(f"Dataset file not found: {dataset_file}")
        
        print(f"📊 データセット読み込み中: {dataset_file}")
        
        with open(dataset_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            self.dataset_entries = list(reader)
        
        print(f"✅ データセット読み込み完了: {len(self.dataset_entries)}件")
    
    def evaluate_all_patches(self) -> Dict[str, Any]:
        """全パッチの品質評価"""
        print("🎯 Step 2: パッチ品質評価開始")
        print("=" * 50)
        
        if not self.dataset_entries:
            self.load_dataset()
        
        start_time = datetime.now()
        self.results = []
        
        # データセットの各エントリーを処理
        processed_count = 0
        for entry in self.dataset_entries:
            try:
                result = self._evaluate_single_patch(entry)
                if result:  # 結果がある場合のみ追加
                    self.results.append(result)
                processed_count += 1
                
                if processed_count % 50 == 0:
                    print(f"  処理済み: {processed_count}/{len(self.dataset_entries)} エントリー")
                    
            except Exception as e:
                print(f"⚠️  パッチ評価エラー: {entry.get('commit_hash', 'unknown')} - {e}")
                continue
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        # 結果集計
        metrics = self._calculate_overall_metrics()
        
        evaluation_result = {
            "evaluation_type": "patch_quality",
            "timestamp": end_time.isoformat(),
            "processing_time_seconds": processing_time,
            "summary": {
                "total_dataset_entries": len(self.dataset_entries),
                "evaluations_completed": len(self.results),
                "patches_generated": len([r for r in self.results if r.has_generated_patch]),
                "exact_matches": len([r for r in self.results if r.exact_match]),
                "average_similarity": sum(r.similarity_score for r in self.results) / len(self.results) if self.results else 0
            },
            "quality_metrics": asdict(metrics),
            "project_breakdown": self._get_project_breakdown(),
            "detailed_results": [asdict(result) for result in self.results[:100]]  # 最初の100件のみ保存
        }
        
        print(f"✅ パッチ品質評価完了")
        print(f"  - 処理時間: {processing_time:.2f}秒")
        print(f"  - 評価完了: {len(self.results)}/{len(self.dataset_entries)}")
        print(f"  - 総合品質スコア: {metrics.overall_quality:.3f}")
        
        return evaluation_result
    
    def _evaluate_single_patch(self, dataset_entry: Dict) -> Optional[PatchComparison]:
        """単一パッチの評価"""
        commit_hash = dataset_entry.get('commit_hash', '')
        project = dataset_entry.get('project', '')
        file_path = dataset_entry.get('file_path', '')
        ground_truth = dataset_entry.get('ground_truth', '')
        
        if not all([commit_hash, project, ground_truth]):
            return None
        
        # 生成されたパッチを検索
        generated_patch = self._find_generated_patch(project, commit_hash, file_path)
        
        # パッチが生成されていない場合
        if generated_patch is None:
            return PatchComparison(
                project_name=project,
                commit_hash=commit_hash,
                file_path=file_path,
                ground_truth=ground_truth,
                generated_patch=None,
                has_generated_patch=False,
                exact_match=False,
                similarity_score=0.0,
                plausibility_score=0.0,
                reasoning_score=0.0,
                diff_analysis={"status": "no_patch_generated"},
                semantic_analysis={"status": "no_patch_generated"},
                timestamp=datetime.now()
            )
        
        # パッチ比較分析
        exact_match = ground_truth.strip() == generated_patch.strip()
        similarity_score = self._calculate_similarity(ground_truth, generated_patch)
        plausibility_score = self._evaluate_plausibility(generated_patch)
        reasoning_score = self._evaluate_reasoning_quality(generated_patch, ground_truth)
        
        diff_analysis = self._analyze_diff(ground_truth, generated_patch)
        semantic_analysis = self._analyze_semantic_similarity(ground_truth, generated_patch)
        
        return PatchComparison(
            project_name=project,
            commit_hash=commit_hash,
            file_path=file_path,
            ground_truth=ground_truth,
            generated_patch=generated_patch,
            has_generated_patch=True,
            exact_match=exact_match,
            similarity_score=similarity_score,
            plausibility_score=plausibility_score,
            reasoning_score=reasoning_score,
            diff_analysis=diff_analysis,
            semantic_analysis=semantic_analysis,
            timestamp=datetime.now()
        )
    
    def _find_generated_patch(self, project: str, commit_hash: str, file_path: str) -> Optional[str]:
        """生成されたパッチを検索"""
        # APR出力ディレクトリでパッチファイルを検索
        # 複数の可能な場所を確認
        
        possible_locations = [
            self.apr_output_path / f"{project}_{commit_hash}.patch",
            self.apr_output_path / f"{commit_hash}.patch", 
            self.apr_output_path / "tmp_restoredDiff.txt",
            self.apr_output_path / f"{project}.patch"
        ]
        
        for patch_file in possible_locations:
            if patch_file.exists():
                try:
                    with open(patch_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if content.strip():  # 空でない場合
                            return content
                except Exception:
                    continue
        
        # processing_summary からパッチ情報を検索
        for summary_file in self.apr_output_path.glob("processing_summary_*.json"):
            try:
                with open(summary_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                # サマリーファイルから該当するパッチを検索
                if self._matches_entry(data, project, commit_hash, file_path):
                    patch_content = self._extract_patch_from_summary(data)
                    if patch_content:
                        return patch_content
                        
            except Exception:
                continue
        
        return None
    
    def _matches_entry(self, summary_data: Dict, project: str, commit_hash: str, file_path: str) -> bool:
        """サマリーデータがデータセットエントリーと一致するかチェック"""
        # プロジェクト名とコミットハッシュの一致をチェック
        summary_project = summary_data.get('project', '')
        summary_commit = summary_data.get('commit_hash', '')
        
        return (project.lower() in summary_project.lower() or summary_project.lower() in project.lower()) and \
               (commit_hash in summary_commit or summary_commit in commit_hash)
    
    def _extract_patch_from_summary(self, summary_data: Dict) -> Optional[str]:
        """サマリーデータからパッチ内容を抽出"""
        # 様々な可能なパッチフィールドを試行
        patch_fields = ['patch', 'diff', 'changes', 'generated_patch', 'result']
        
        for field in patch_fields:
            if field in summary_data and summary_data[field]:
                return str(summary_data[field])
        
        return None
    
    def _calculate_similarity(self, ground_truth: str, generated_patch: str) -> float:
        """文字列類似度計算"""
        if not ground_truth or not generated_patch:
            return 0.0
        
        # difflib を使用した類似度計算
        matcher = difflib.SequenceMatcher(None, ground_truth, generated_patch)
        return matcher.ratio()
    
    def _evaluate_plausibility(self, generated_patch: str) -> float:
        """パッチの妥当性評価"""
        if not generated_patch:
            return 0.0
        
        score = 0.0
        
        # 基本的な妥当性チェック
        # 1. 空でないこと
        if generated_patch.strip():
            score += 0.2
        
        # 2. 構文的に妥当そうなコード変更であること
        if any(keyword in generated_patch.lower() for keyword in [
            'function', 'method', 'class', 'if', 'for', 'while', 'return', 
            '+', '-', 'add', 'remove', 'fix', 'change'
        ]):
            score += 0.3
        
        # 3. diff形式またはコード形式であること
        if generated_patch.startswith(('---', '+++', 'diff', '@')) or \
           any(line.startswith(('+', '-')) for line in generated_patch.split('\n')):
            score += 0.3
        
        # 4. 適切な長さであること（極端に短い・長いは低評価）
        length = len(generated_patch)
        if 10 < length < 10000:
            score += 0.2
        
        return min(score, 1.0)
    
    def _evaluate_reasoning_quality(self, generated_patch: str, ground_truth: str) -> float:
        """推論品質の評価"""
        if not generated_patch:
            return 0.0
        
        score = 0.0
        
        # 1. 変更の方向性が正しいか
        gt_lines = set(ground_truth.split('\n'))
        gen_lines = set(generated_patch.split('\n'))
        
        common_lines = gt_lines.intersection(gen_lines)
        if common_lines:
            score += 0.4
        
        # 2. キーワードの一致
        gt_keywords = set(re.findall(r'\b\w+\b', ground_truth.lower()))
        gen_keywords = set(re.findall(r'\b\w+\b', generated_patch.lower()))
        
        if gt_keywords and gen_keywords:
            keyword_overlap = len(gt_keywords.intersection(gen_keywords)) / len(gt_keywords.union(gen_keywords))
            score += keyword_overlap * 0.6
        
        return min(score, 1.0)
    
    def _analyze_diff(self, ground_truth: str, generated_patch: str) -> Dict[str, Any]:
        """差分分析"""
        if not generated_patch:
            return {"status": "no_patch"}
        
        # 基本的な差分統計
        gt_lines = ground_truth.split('\n')
        gen_lines = generated_patch.split('\n')
        
        return {
            "ground_truth_lines": len(gt_lines),
            "generated_lines": len(gen_lines),
            "line_difference": abs(len(gt_lines) - len(gen_lines)),
            "common_lines": len(set(gt_lines).intersection(set(gen_lines))),
            "unique_gt_lines": len(set(gt_lines) - set(gen_lines)),
            "unique_gen_lines": len(set(gen_lines) - set(gt_lines))
        }
    
    def _analyze_semantic_similarity(self, ground_truth: str, generated_patch: str) -> Dict[str, Any]:
        """意味的類似度分析"""
        if not generated_patch:
            return {"status": "no_patch"}
        
        # 簡単な意味的類似度分析
        gt_tokens = set(re.findall(r'\b\w+\b', ground_truth.lower()))
        gen_tokens = set(re.findall(r'\b\w+\b', generated_patch.lower()))
        
        if not gt_tokens:
            return {"token_similarity": 0.0, "total_tokens_gt": 0, "total_tokens_gen": len(gen_tokens)}
        
        intersection = gt_tokens.intersection(gen_tokens)
        union = gt_tokens.union(gen_tokens)
        
        return {
            "token_similarity": len(intersection) / len(union) if union else 0.0,
            "total_tokens_gt": len(gt_tokens),
            "total_tokens_gen": len(gen_tokens),
            "common_tokens": len(intersection),
            "unique_gt_tokens": len(gt_tokens - gen_tokens),
            "unique_gen_tokens": len(gen_tokens - gt_tokens)
        }
    
    def _calculate_overall_metrics(self) -> QualityMetrics:
        """全体品質メトリクスの計算"""
        if not self.results:
            return QualityMetrics(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        
        # 基本メトリクス
        plausibility_score = sum(r.plausibility_score for r in self.results) / len(self.results)
        reasoning_quality = sum(r.reasoning_score for r in self.results) / len(self.results)
        
        # 正確性メトリクス（完全一致の割合）
        exact_matches = [r for r in self.results if r.exact_match]
        correctness_r1 = len(exact_matches) / len(self.results)
        
        # R5, R10は類似度上位5件、10件での一致率（簡単な実装）
        similarity_sorted = sorted(self.results, key=lambda x: x.similarity_score, reverse=True)
        top_5_percent = int(len(similarity_sorted) * 0.05) or 1
        top_10_percent = int(len(similarity_sorted) * 0.10) or 1
        
        correctness_r5 = sum(1 for r in similarity_sorted[:top_5_percent] if r.similarity_score > 0.8) / len(self.results)
        correctness_r10 = sum(1 for r in similarity_sorted[:top_10_percent] if r.similarity_score > 0.7) / len(self.results)
        
        # 意味的類似度
        semantic_similarity = sum(r.similarity_score for r in self.results) / len(self.results)
        
        # 総合品質スコア
        overall_quality = (
            plausibility_score * 0.25 +
            correctness_r1 * 0.30 +
            correctness_r10 * 0.20 +
            reasoning_quality * 0.15 +
            semantic_similarity * 0.10
        )
        
        return QualityMetrics(
            plausibility_score=plausibility_score,
            correctness_r1=correctness_r1,
            correctness_r5=correctness_r5,
            correctness_r10=correctness_r10,
            reasoning_quality=reasoning_quality,
            semantic_similarity=semantic_similarity,
            overall_quality=overall_quality
        )
    
    def _get_project_breakdown(self) -> Dict[str, Dict]:
        """プロジェクト別内訳の取得"""
        project_results = {}
        
        for result in self.results:
            if result.project_name not in project_results:
                project_results[result.project_name] = {
                    "total_evaluations": 0,
                    "patches_generated": 0,
                    "exact_matches": 0,
                    "avg_similarity": 0.0,
                    "avg_plausibility": 0.0
                }
            
            proj_stats = project_results[result.project_name]
            proj_stats["total_evaluations"] += 1
            proj_stats["patches_generated"] += 1 if result.has_generated_patch else 0
            proj_stats["exact_matches"] += 1 if result.exact_match else 0
        
        # 平均値計算
        for project_name, stats in project_results.items():
            project_results_list = [r for r in self.results if r.project_name == project_name]
            if project_results_list:
                stats["avg_similarity"] = sum(r.similarity_score for r in project_results_list) / len(project_results_list)
                stats["avg_plausibility"] = sum(r.plausibility_score for r in project_results_list) / len(project_results_list)
        
        return project_results


def demo_quality_evaluation():
    """品質評価のデモ"""
    print("🎯 パッチ品質評価デモ")
    
    evaluator = PatchQualityEvaluator()
    results = evaluator.evaluate_all_patches()
    
    print("\n📊 評価結果サマリー:")
    print(f"  - 総合品質スコア: {results['quality_metrics']['overall_quality']:.3f}")
    print(f"  - 妥当性スコア: {results['quality_metrics']['plausibility_score']:.3f}")
    print(f"  - 正確性@1: {results['quality_metrics']['correctness_r1']:.3f}")


if __name__ == "__main__":
    demo_quality_evaluation()
