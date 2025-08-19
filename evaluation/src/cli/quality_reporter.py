#!/usr/bin/env python3
"""
データセット評価品質レポート生成器
APRシステムの評価結果を詳細に分析し、品質指標を提供
"""

import json
import argparse
from pathlib import Path
from typing import Dict, List, Any
import statistics
import matplotlib.pyplot as plt
import numpy as np

class EvaluationQualityReporter:
    """評価品質レポート生成器"""
    
    def __init__(self, dataset_report_file: str):
        with open(dataset_report_file, 'r', encoding='utf-8') as f:
            self.dataset_report = json.load(f)
    
    def generate_quality_insights(self) -> Dict[str, Any]:
        """評価品質に関する洞察を生成"""
        projects = self.dataset_report['project_summaries']
        
        # 適合性スコア分析
        compliance_scores = [p['avg_compliance_score'] for p in projects]
        
        # プロジェクトサイズと品質の関係
        size_quality = []
        for p in projects:
            size_quality.append({
                'project': p['project_name'],
                'size': p['total_evaluations'],
                'compliance': p['avg_compliance_score'],
                'cost_per_eval': p['total_cost'] / p['total_evaluations'] if p['total_evaluations'] > 0 else 0,
                'time_per_eval': p['avg_processing_time'] / p['total_evaluations'] if p['total_evaluations'] > 0 else 0
            })
        
        # 統計計算
        insights = {
            'compliance_analysis': {
                'mean': statistics.mean(compliance_scores),
                'median': statistics.median(compliance_scores),
                'std_dev': statistics.stdev(compliance_scores) if len(compliance_scores) > 1 else 0,
                'min': min(compliance_scores),
                'max': max(compliance_scores),
                'range': max(compliance_scores) - min(compliance_scores)
            },
            'project_size_analysis': {
                'total_evaluations': sum(p['total_evaluations'] for p in projects),
                'avg_evaluations_per_project': statistics.mean([p['total_evaluations'] for p in projects]),
                'largest_project': max(projects, key=lambda x: x['total_evaluations']),
                'smallest_project': min(projects, key=lambda x: x['total_evaluations'])
            },
            'efficiency_analysis': {
                'avg_cost_per_evaluation': statistics.mean([sq['cost_per_eval'] for sq in size_quality]),
                'avg_time_per_evaluation': statistics.mean([sq['time_per_eval'] for sq in size_quality]),
                'most_efficient_project': min(size_quality, key=lambda x: x['cost_per_eval']),
                'least_efficient_project': max(size_quality, key=lambda x: x['cost_per_eval'])
            },
            'quality_distribution': {
                'high_quality_projects': len([p for p in projects if p['avg_compliance_score'] > 0.05]),
                'medium_quality_projects': len([p for p in projects if 0.02 <= p['avg_compliance_score'] <= 0.05]),
                'low_quality_projects': len([p for p in projects if p['avg_compliance_score'] < 0.02]),
            }
        }
        
        return insights
    
    def generate_recommendations(self, insights: Dict[str, Any]) -> List[str]:
        """改善推奨事項を生成"""
        recommendations = []
        
        # 適合性スコアに基づく推奨事項
        compliance_mean = insights['compliance_analysis']['mean']
        compliance_std = insights['compliance_analysis']['std_dev']
        
        if compliance_mean < 0.05:
            recommendations.append(
                f"⚠️  全体的な適合性スコアが低い（平均{compliance_mean:.3f}）。"
                "APRシステムのパーサーとワークフロー改善が必要。"
            )
        
        if compliance_std > 0.02:
            recommendations.append(
                f"📊 適合性スコアのばらつきが大きい（標準偏差{compliance_std:.3f}）。"
                "プロジェクト間での品質の一貫性を改善する必要がある。"
            )
        
        # 効率性に基づく推奨事項
        avg_cost = insights['efficiency_analysis']['avg_cost_per_evaluation']
        if avg_cost > 0.5:
            recommendations.append(
                f"💰 評価あたりのコストが高い（平均${avg_cost:.3f}）。"
                "プロンプトの最適化やモデル選択の見直しを検討。"
            )
        
        # プロジェクトサイズに基づく推奨事項
        largest = insights['project_size_analysis']['largest_project']
        smallest = insights['project_size_analysis']['smallest_project']
        
        if largest['total_evaluations'] / smallest['total_evaluations'] > 10:
            recommendations.append(
                f"📏 プロジェクトサイズの偏りが大きい（最大{largest['total_evaluations']}件 vs 最小{smallest['total_evaluations']}件）。"
                "データセットのバランス調整を検討。"
            )
        
        # 品質分布に基づく推奨事項
        quality_dist = insights['quality_distribution']
        if quality_dist['low_quality_projects'] > quality_dist['high_quality_projects']:
            recommendations.append(
                "🎯 低品質プロジェクトが多数。重点的な改善が必要なプロジェクトを特定し、"
                "パーサーやワークフローの調整を行う。"
            )
        
        return recommendations
    
    def generate_html_report(self, output_file: str) -> str:
        """HTML形式の詳細レポートを生成"""
        insights = self.generate_quality_insights()
        recommendations = self.generate_recommendations(insights)
        
        html_content = f"""
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APRシステム データセット評価品質レポート</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; }}
        .header {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }}
        .metric-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }}
        .metric-card {{ background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; }}
        .metric-value {{ font-size: 24px; font-weight: bold; color: #2563eb; }}
        .metric-label {{ color: #6b7280; font-size: 14px; }}
        .recommendations {{ background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; }}
        .project-table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        .project-table th, .project-table td {{ border: 1px solid #e9ecef; padding: 8px; text-align: left; }}
        .project-table th {{ background: #f8f9fa; }}
        .quality-high {{ color: #059669; font-weight: bold; }}
        .quality-medium {{ color: #d97706; font-weight: bold; }}
        .quality-low {{ color: #dc2626; font-weight: bold; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 APRシステム データセット評価品質レポート</h1>
        <p>セッション: {self.dataset_report['session_timestamp']}</p>
        <p>生成日時: {insights['compliance_analysis']['mean']:.3f}</p>
    </div>
    
    <h2>📈 全体統計</h2>
    <div class="metric-grid">
        <div class="metric-card">
            <div class="metric-value">{self.dataset_report['total_projects']}</div>
            <div class="metric-label">総プロジェクト数</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">{self.dataset_report['total_evaluations']}</div>
            <div class="metric-label">総評価数</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">{insights['compliance_analysis']['mean']:.3f}</div>
            <div class="metric-label">平均適合性スコア</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${self.dataset_report['total_cost']:.2f}</div>
            <div class="metric-label">総コスト (USD)</div>
        </div>
    </div>
    
    <h2>🎯 適合性分析</h2>
    <div class="metric-grid">
        <div class="metric-card">
            <div class="metric-value">{insights['compliance_analysis']['min']:.3f}</div>
            <div class="metric-label">最低スコア</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">{insights['compliance_analysis']['max']:.3f}</div>
            <div class="metric-label">最高スコア</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">{insights['compliance_analysis']['std_dev']:.3f}</div>
            <div class="metric-label">標準偏差</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">{insights['compliance_analysis']['range']:.3f}</div>
            <div class="metric-label">スコア範囲</div>
        </div>
    </div>
    
    <h2>💡 推奨事項</h2>
    <div class="recommendations">
        {"<br>".join(recommendations)}
    </div>
    
    <h2>📋 プロジェクト別詳細</h2>
    <table class="project-table">
        <thead>
            <tr>
                <th>プロジェクト</th>
                <th>評価数</th>
                <th>適合性スコア</th>
                <th>処理時間 (秒)</th>
                <th>コスト ($)</th>
                <th>品質ランク</th>
            </tr>
        </thead>
        <tbody>
"""
        
        # プロジェクト行を追加
        for project in self.dataset_report['project_summaries']:
            compliance = project['avg_compliance_score']
            if compliance > 0.05:
                quality_class = "quality-high"
                quality_rank = "高"
            elif compliance >= 0.02:
                quality_class = "quality-medium"
                quality_rank = "中"
            else:
                quality_class = "quality-low"
                quality_rank = "低"
                
            html_content += f"""
            <tr>
                <td>{project['project_name']}</td>
                <td>{project['total_evaluations']}</td>
                <td class="{quality_class}">{compliance:.3f}</td>
                <td>{project['avg_processing_time']:.1f}</td>
                <td>${project['total_cost']:.2f}</td>
                <td class="{quality_class}">{quality_rank}</td>
            </tr>
"""
        
        html_content += """
        </tbody>
    </table>
</body>
</html>
"""
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return output_file

def main():
    parser = argparse.ArgumentParser(description='データセット評価品質レポート生成器')
    parser.add_argument('--dataset-report', type=str, required=True, help='データセット分析レポートJSONファイル')
    parser.add_argument('--output', type=str, help='出力HTMLファイル名')
    
    args = parser.parse_args()
    
    if not Path(args.dataset_report).exists():
        print(f"❌ ファイルが見つかりません: {args.dataset_report}")
        return
    
    output_file = args.output or args.dataset_report.replace('.json', '_quality_report.html')
    
    reporter = EvaluationQualityReporter(args.dataset_report)
    insights = reporter.generate_quality_insights()
    recommendations = reporter.generate_recommendations(insights)
    
    print("🔍 データセット評価品質分析")
    print("=" * 60)
    print(f"📊 適合性スコア統計:")
    print(f"   平均: {insights['compliance_analysis']['mean']:.3f}")
    print(f"   中央値: {insights['compliance_analysis']['median']:.3f}")
    print(f"   標準偏差: {insights['compliance_analysis']['std_dev']:.3f}")
    print(f"   範囲: {insights['compliance_analysis']['min']:.3f} - {insights['compliance_analysis']['max']:.3f}")
    
    print(f"\n⚙️  効率性分析:")
    print(f"   評価あたり平均コスト: ${insights['efficiency_analysis']['avg_cost_per_evaluation']:.3f}")
    print(f"   評価あたり平均時間: {insights['efficiency_analysis']['avg_time_per_evaluation']:.1f}秒")
    
    print(f"\n🎯 品質分布:")
    print(f"   高品質プロジェクト: {insights['quality_distribution']['high_quality_projects']}件")
    print(f"   中品質プロジェクト: {insights['quality_distribution']['medium_quality_projects']}件")
    print(f"   低品質プロジェクト: {insights['quality_distribution']['low_quality_projects']}件")
    
    print(f"\n💡 推奨事項:")
    for i, rec in enumerate(recommendations, 1):
        print(f"   {i}. {rec}")
    
    html_file = reporter.generate_html_report(output_file)
    print(f"\n📄 詳細HTMLレポート生成: {html_file}")

if __name__ == "__main__":
    main()
