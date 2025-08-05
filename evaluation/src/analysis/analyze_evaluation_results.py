#!/usr/bin/env python3
"""
全評価結果の修正可能項目分析スクリプト
"""

import json
import os
from collections import defaultdict, Counter

def analyze_evaluation_results():
    """評価結果から修正可能な項目を抽出・分析"""
    
    results_dir = '/app/full_evaluation_results_20250729_192736'
    
    # 統計収集用
    total_stats = {
        'total_projects': 0,
        'total_logs': 0,
        'all_recommendations': [],
        'all_issues': [],
        'system_health_distribution': Counter(),
        'compliance_scores': [],
        'project_summaries': {}
    }
    
    # 各プロジェクトの結果ファイルを解析
    for filename in sorted(os.listdir(results_dir)):
        if not filename.startswith('real_llm_analysis_') or not filename.endswith('.json'):
            continue
            
        # プロジェクト名を抽出
        project_name = filename.replace('real_llm_analysis_', '').replace('.json', '')
        project_name = project_name.split('_')[0]  # タイムスタンプを除去
        
        filepath = os.path.join(results_dir, filename)
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            analysis = data.get('Real_OPENAI_Analysis', {})
            summary = analysis.get('summary', {})
            compliance_metrics = analysis.get('compliance_metrics', {})
            detailed_results = analysis.get('detailed_results', [])
            
            # プロジェクト統計
            logs_processed = summary.get('total_logs_processed', 0)
            overall_compliance = compliance_metrics.get('overall_compliance', 0)
            
            total_stats['total_projects'] += 1
            total_stats['total_logs'] += logs_processed
            total_stats['compliance_scores'].append(overall_compliance)
            
            # 詳細結果から推奨事項と問題を抽出
            project_recommendations = []
            project_issues = []
            health_counts = Counter()
            
            for result in detailed_results:
                # システム健全性
                health = result.get('system_health', 'UNKNOWN')
                health_counts[health] += 1
                total_stats['system_health_distribution'][health] += 1
                
                # 重大な問題
                critical_issues = result.get('critical_issues', [])
                project_issues.extend(critical_issues)
                total_stats['all_issues'].extend(critical_issues)
                
                # 推奨事項
                recommendations = result.get('recommendations', [])
                project_recommendations.extend(recommendations)
                total_stats['all_recommendations'].extend(recommendations)
            
            # プロジェクトサマリー
            total_stats['project_summaries'][project_name] = {
                'logs': logs_processed,
                'compliance': overall_compliance,
                'health_distribution': dict(health_counts),
                'unique_recommendations': list(set(project_recommendations)),
                'unique_issues': list(set(project_issues))
            }
            
        except Exception as e:
            print(f'❌ ファイル解析エラー {filename}: {e}')
    
    return total_stats

def categorize_recommendations(recommendations):
    """推奨事項をカテゴリ別に分類"""
    
    categories = {
        'パーサー改善': [],
        'ワークフロー強化': [],
        'テスト・監視': [],
        'ログ・診断': [],
        'システム健全性': [],
        'その他': []
    }
    
    for rec in recommendations:
        rec_lower = rec.lower()
        
        if any(keyword in rec_lower for keyword in ['parser', 'parsing', 'json', 'format']):
            categories['パーサー改善'].append(rec)
        elif any(keyword in rec_lower for keyword in ['workflow', 'think', 'plan', 'act']):
            categories['ワークフロー強化'].append(rec)
        elif any(keyword in rec_lower for keyword in ['test', 'regression', 'automated', 'monitor']):
            categories['テスト・監視'].append(rec)
        elif any(keyword in rec_lower for keyword in ['log', 'logging', 'diagnosis', 'granular']):
            categories['ログ・診断'].append(rec)
        elif any(keyword in rec_lower for keyword in ['health', 'system', 'performance']):
            categories['システム健全性'].append(rec)
        else:
            categories['その他'].append(rec)
    
    return categories

def main():
    print("🔍 APR全評価結果 - 修正可能項目分析")
    print("=" * 80)
    
    # 結果分析
    stats = analyze_evaluation_results()
    
    # 全体統計
    print(f"📊 全体統計:")
    print(f"   総プロジェクト数: {stats['total_projects']}")
    print(f"   総ログ数: {stats['total_logs']}")
    print(f"   平均コンプライアンス: {sum(stats['compliance_scores'])/len(stats['compliance_scores']):.1%}")
    print(f"   総推奨事項数: {len(stats['all_recommendations'])}")
    print(f"   総問題数: {len(stats['all_issues'])}")
    
    # システム健全性分布
    print(f"\\n🏥 システム健全性分布:")
    for health, count in stats['system_health_distribution'].most_common():
        print(f"   {health}: {count}件")
    
    # プロジェクト別詳細
    print(f"\\n📋 プロジェクト別分析:")
    for project, data in stats['project_summaries'].items():
        print(f"\\n🎯 {project.upper()}")
        print(f"   ログ数: {data['logs']}, コンプライアンス: {data['compliance']:.1%}")
        
        if data['unique_issues']:
            print(f"   ❌ 重大な問題 ({len(data['unique_issues'])}件):")
            for issue in data['unique_issues'][:3]:
                print(f"      • {issue}")
        else:
            print(f"   ✅ 重大な問題なし")
        
        if data['unique_recommendations']:
            print(f"   💡 推奨事項 ({len(data['unique_recommendations'])}件):")
            for rec in data['unique_recommendations'][:3]:
                short_rec = rec[:80] + "..." if len(rec) > 80 else rec
                print(f"      • {short_rec}")
    
    # 推奨事項の分類
    categories = categorize_recommendations(stats['all_recommendations'])
    
    print(f"\\n🏷️  推奨事項カテゴリ別分析:")
    for category, recs in categories.items():
        if recs:
            unique_recs = list(set(recs))
            print(f"\\n   📂 {category} ({len(unique_recs)}件)")
            for rec in unique_recs[:3]:
                short_rec = rec[:100] + "..." if len(rec) > 100 else rec
                print(f"      • {short_rec}")
    
    print("\\n" + "=" * 80)
    print("✅ 分析完了!")

if __name__ == "__main__":
    main()
