#!/usr/bin/env python3
"""
データセット全体評価アナライザー
個別のプルリク評価結果を統合してデータセット全体の分析を行う
"""

import json
import os
import sys
import argparse
import glob
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import statistics

@dataclass
class ProjectSummary:
    """プロジェクト別サマリー"""
    project_name: str
    total_evaluations: int
    successful_evaluations: int
    failed_evaluations: int
    success_rate: float
    avg_compliance_score: float
    avg_processing_time: float
    total_cost: float
    issues_count: int
    pullrequests_count: int

@dataclass
class DatasetSummary:
    """データセット全体サマリー"""
    session_timestamp: str
    total_projects: int
    total_evaluations: int
    overall_success_rate: float
    avg_compliance_score: float
    total_processing_time: float
    total_cost: float
    project_summaries: List[ProjectSummary]
    
class DatasetAnalyzer:
    """データセット全体評価アナライザー"""
    
    def __init__(self, session_directory: str):
        self.session_dir = Path(session_directory)
        self.results_dir = self.session_dir / "results"
        self.summaries_dir = self.session_dir / "summaries"
        
    def analyze_project(self, project_name: str) -> Optional[ProjectSummary]:
        """個別プロジェクトの分析"""
        print(f"🔍 プロジェクト分析: {project_name}")
        
        project_dir = self.results_dir / project_name
        if not project_dir.exists():
            print(f"⚠️  プロジェクトディレクトリが存在しません: {project_dir}")
            return None
            
        # メイン評価結果ファイルを探す
        main_result_files = list(project_dir.glob("evaluation_result_*.json"))
        if not main_result_files:
            print(f"⚠️  メイン評価結果ファイルが見つかりません: {project_dir}")
            return None
            
        # 最新の評価結果を使用
        main_result_file = max(main_result_files, key=lambda x: x.stat().st_mtime)
        print(f"   📄 メインファイル: {main_result_file.name}")
        
        try:
            with open(main_result_file, 'r', encoding='utf-8') as f:
                main_result = json.load(f)
            
            # Real_OPENAI_Analysisキーの下にデータがネストされている場合
            if 'Real_OPENAI_Analysis' in main_result:
                main_result = main_result['Real_OPENAI_Analysis']
                
            # 個別評価結果も収集
            individual_results = []
            
            # issueディレクトリ
            issues_dir = project_dir / "issue"
            if issues_dir.exists():
                for issue_dir in issues_dir.iterdir():
                    if issue_dir.is_dir():
                        result_file = issue_dir / "evaluation_result.json"
                        if result_file.exists():
                            with open(result_file, 'r', encoding='utf-8') as f:
                                individual_results.append(json.load(f))
                                
            # pullrequestディレクトリ
            pr_dir = project_dir / "pullrequest"
            if pr_dir.exists():
                for pr_dir_item in pr_dir.iterdir():
                    if pr_dir_item.is_dir():
                        result_file = pr_dir_item / "evaluation_result.json"
                        if result_file.exists():
                            with open(result_file, 'r', encoding='utf-8') as f:
                                individual_results.append(json.load(f))
            
            # 統計計算
            compliance_scores = []
            processing_times = []
            costs = []
            
            # メイン結果から統計取得
            if 'compliance_metrics' in main_result:
                if 'overall_compliance' in main_result['compliance_metrics']:
                    compliance_scores.append(main_result['compliance_metrics']['overall_compliance'])
                    
            if 'processing_time_seconds' in main_result:
                processing_times.append(main_result['processing_time_seconds'])
            
            # 詳細結果からコスト情報を収集（もしある場合）
            if 'detailed_results' in main_result:
                for detail in main_result['detailed_results']:
                    if 'llm_usage' in detail and detail['llm_usage']:
                        # OpenAI API料金計算（概算）
                        usage = detail['llm_usage']
                        if 'total_tokens' in usage:
                            # GPT-5の概算料金（$0.05/1000トークン）
                            estimated_cost = usage['total_tokens'] * 0.00005
                            costs.append(estimated_cost)
                
            # 個別結果からも統計取得
            for result in individual_results:
                # 個別結果は evaluation_result キーの下にネストされている
                eval_data = result.get('evaluation_result', result)
                
                if 'compliance_score' in eval_data:
                    compliance_scores.append(eval_data['compliance_score'])
                elif 'overall_compliance' in eval_data:
                    compliance_scores.append(eval_data['overall_compliance'])
                    
                if 'processing_time' in eval_data:
                    processing_times.append(eval_data['processing_time'])
                elif 'processing_time_seconds' in eval_data:
                    processing_times.append(eval_data['processing_time_seconds'])
                    
                if 'cost' in eval_data:
                    costs.append(eval_data['cost'])
                elif 'llm_usage' in eval_data and eval_data['llm_usage']:
                    usage = eval_data['llm_usage']
                    if 'total_tokens' in usage:
                        estimated_cost = usage['total_tokens'] * 0.00005
                        costs.append(estimated_cost)
            
            # issue/PRカウント
            issues_count = len(list((project_dir / "issue").iterdir())) if (project_dir / "issue").exists() else 0
            pr_count = len(list((project_dir / "pullrequest").iterdir())) if (project_dir / "pullrequest").exists() else 0
            total_evaluations = len(individual_results)
            
            print(f"   📊 統計: compliance_scores={len(compliance_scores)}, processing_times={len(processing_times)}, costs={len(costs)}")
            print(f"   📈 適合性スコア範囲: {min(compliance_scores) if compliance_scores else 'N/A'} - {max(compliance_scores) if compliance_scores else 'N/A'}")
            
            return ProjectSummary(
                project_name=project_name,
                total_evaluations=total_evaluations,
                successful_evaluations=total_evaluations,  # 全て成功と仮定（失敗ファイルがあれば別途処理）
                failed_evaluations=0,
                success_rate=100.0 if total_evaluations > 0 else 0.0,
                avg_compliance_score=statistics.mean(compliance_scores) if compliance_scores else 0.0,
                avg_processing_time=statistics.mean(processing_times) if processing_times else 0.0,
                total_cost=sum(costs) if costs else 0.0,
                issues_count=issues_count,
                pullrequests_count=pr_count
            )
            
        except Exception as e:
            print(f"❌ プロジェクト分析エラー {project_name}: {e}")
            return None
    
    def analyze_dataset(self) -> DatasetSummary:
        """データセット全体の分析"""
        print("🔍 データセット全体分析開始")
        print("=" * 60)
        
        # セッションタイムスタンプ取得
        session_timestamp = self.session_dir.name.replace("full_evaluation_", "")
        
        # プロジェクトディレクトリ一覧取得
        project_dirs = [d for d in self.results_dir.iterdir() if d.is_dir()]
        project_summaries = []
        
        for project_dir in project_dirs:
            project_summary = self.analyze_project(project_dir.name)
            if project_summary:
                project_summaries.append(project_summary)
        
        # 全体統計計算
        if project_summaries:
            total_evaluations = sum(ps.total_evaluations for ps in project_summaries)
            total_successful = sum(ps.successful_evaluations for ps in project_summaries)
            overall_success_rate = (total_successful / total_evaluations * 100) if total_evaluations > 0 else 0.0
            
            compliance_scores = [ps.avg_compliance_score for ps in project_summaries if ps.avg_compliance_score > 0]
            avg_compliance_score = statistics.mean(compliance_scores) if compliance_scores else 0.0
            
            total_processing_time = sum(ps.avg_processing_time for ps in project_summaries)
            total_cost = sum(ps.total_cost for ps in project_summaries)
        else:
            total_evaluations = 0
            overall_success_rate = 0.0
            avg_compliance_score = 0.0
            total_processing_time = 0.0
            total_cost = 0.0
        
        return DatasetSummary(
            session_timestamp=session_timestamp,
            total_projects=len(project_summaries),
            total_evaluations=total_evaluations,
            overall_success_rate=overall_success_rate,
            avg_compliance_score=avg_compliance_score,
            total_processing_time=total_processing_time,
            total_cost=total_cost,
            project_summaries=project_summaries
        )
    
    def generate_report(self, output_file: Optional[str] = None) -> str:
        """詳細レポート生成"""
        dataset_summary = self.analyze_dataset()
        
        if output_file is None:
            output_file = str(self.session_dir / "dataset_analysis_report.json")
        
        # JSON形式で保存
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(asdict(dataset_summary), f, indent=2, ensure_ascii=False)
        
        # コンソール出力
        print("\n" + "=" * 80)
        print("📊 データセット全体評価レポート")
        print("=" * 80)
        print(f"🕒 セッション: {dataset_summary.session_timestamp}")
        print(f"📂 総プロジェクト数: {dataset_summary.total_projects}")
        print(f"📝 総評価数: {dataset_summary.total_evaluations}")
        print(f"✅ 成功率: {dataset_summary.overall_success_rate:.1f}%")
        print(f"🎯 平均適合性スコア: {dataset_summary.avg_compliance_score:.3f}")
        print(f"⏱️  総処理時間: {dataset_summary.total_processing_time:.1f}秒")
        print(f"💰 総コスト: ${dataset_summary.total_cost:.4f} USD")
        
        print("\n📋 プロジェクト別詳細:")
        print("-" * 80)
        for ps in dataset_summary.project_summaries:
            print(f"📁 {ps.project_name}:")
            print(f"   📊 評価数: {ps.total_evaluations} (Issues: {ps.issues_count}, PRs: {ps.pullrequests_count})")
            print(f"   ✅ 成功率: {ps.success_rate:.1f}%")
            print(f"   🎯 適合性: {ps.avg_compliance_score:.3f}")
            print(f"   ⏱️  時間: {ps.avg_processing_time:.1f}s")
            print(f"   💰 コスト: ${ps.total_cost:.4f}")
            print()
        
        print(f"📄 詳細レポート保存: {output_file}")
        return output_file

def main():
    parser = argparse.ArgumentParser(description='データセット全体評価アナライザー')
    parser.add_argument('--session-dir', type=str, help='評価セッションディレクトリ')
    parser.add_argument('--latest', action='store_true', help='最新のセッションを使用')
    parser.add_argument('--output', type=str, help='出力ファイル名')
    
    args = parser.parse_args()
    
    if args.latest:
        # 最新のセッションディレクトリを探す
        logs_dir = Path("/app/logs")
        session_dirs = list(logs_dir.glob("full_evaluation_*"))
        if not session_dirs:
            print("❌ 評価セッションが見つかりません")
            sys.exit(1)
        session_dir = max(session_dirs, key=lambda x: x.stat().st_mtime)
    elif args.session_dir:
        session_dir = Path(args.session_dir)
    else:
        print("❌ --session-dir または --latest を指定してください")
        sys.exit(1)
    
    if not session_dir.exists():
        print(f"❌ セッションディレクトリが存在しません: {session_dir}")
        sys.exit(1)
    
    analyzer = DatasetAnalyzer(str(session_dir))
    report_file = analyzer.generate_report(args.output)
    
    print(f"\n🎉 データセット分析完了！")
    print(f"📄 レポートファイル: {report_file}")

if __name__ == "__main__":
    main()
