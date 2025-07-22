#!/usr/bin/env python3
"""
APR評価システム - メインエントリーポイント
"""

import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime

def setup_paths():
    """パスの設定と初期化"""
    base_path = Path("/app")
    
    paths = {
        'dataset': base_path / 'dataset',
        'apr_logs': base_path / 'apr-logs', 
        'apr_output': base_path / 'apr-output',
        'results': base_path / 'results',
        'evaluation_design': base_path / 'evaluation-design'
    }
    
    # 必要なディレクトリの存在確認
    for name, path in paths.items():
        if not path.exists() and name == 'results':
            path.mkdir(parents=True, exist_ok=True)
        elif not path.exists() and name not in ['evaluation_design']:
            print(f"ERROR: Required directory not found: {path}")
            sys.exit(1)
    
    return paths

def run_step1_compliance_evaluation(paths, args):
    """ステップ1: システム仕様準拠性評価"""
    print("🔍 Step 1: System Compliance Evaluation")
    print(f"  - APR Logs directory: {paths['apr_logs']}")
    print(f"  - Output directory: {paths['results']}/step1")
    
    # ステップ1評価の実装をここに追加
    # 実際の評価ロジックは別モジュールに分離
    try:
        # from evaluation.step1_compliance import SystemComplianceEvaluator
        # evaluator = SystemComplianceEvaluator()
        # results = evaluator.evaluate_all(paths['logs'])
        
        # 仮の結果（実装時に置き換え）
        results = {
            "evaluation_type": "system_compliance",
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_cases": 0,
                "compliance_rate": 0.0,
                "parser_accuracy": 0.0
            },
            "detailed_results": []
        }
        
        # 結果保存
        output_dir = paths['results'] / 'step1'
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_file = output_dir / f"compliance_evaluation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Step 1 completed. Results saved to: {output_file}")
        return output_file
        
    except Exception as e:
        print(f"❌ Step 1 failed: {e}")
        return None

def run_step2_quality_evaluation(paths, args):
    """ステップ2: パッチ品質評価"""
    print("🎯 Step 2: Patch Quality Evaluation")
    print(f"  - Dataset directory: {paths['dataset']}")
    print(f"  - APR Results directory: {paths['apr_output']}")
    print(f"  - Output directory: {paths['results']}/step2")
    
    try:
        # from evaluation.step2_quality import PatchQualityEvaluator
        # evaluator = PatchQualityEvaluator()
        # results = evaluator.evaluate_all(paths['dataset'], paths['output'])
        
        # 仮の結果（実装時に置き換え）
        results = {
            "evaluation_type": "patch_quality",
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_cases": 0,
                "plausible_rate": 0.0,
                "correct_rate": 0.0,
                "avg_reasoning_quality": 0.0
            },
            "detailed_results": []
        }
        
        # 結果保存
        output_dir = paths['results'] / 'step2'
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_file = output_dir / f"quality_evaluation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Step 2 completed. Results saved to: {output_file}")
        return output_file
        
    except Exception as e:
        print(f"❌ Step 2 failed: {e}")
        return None

def generate_comprehensive_report(paths, step1_file, step2_file, args):
    """統合レポート生成"""
    print("📊 Generating Comprehensive Report")
    
    try:
        # 各ステップの結果を読み込み
        step1_results = {}
        step2_results = {}
        
        if step1_file and step1_file.exists():
            with open(step1_file, 'r', encoding='utf-8') as f:
                step1_results = json.load(f)
        
        if step2_file and step2_file.exists():
            with open(step2_file, 'r', encoding='utf-8') as f:
                step2_results = json.load(f)
        
        # 統合レポート作成
        comprehensive_report = {
            "report_type": "comprehensive_evaluation",
            "timestamp": datetime.now().isoformat(),
            "system_compliance": step1_results.get('summary', {}),
            "patch_quality": step2_results.get('summary', {}),
            "overall_assessment": {
                "apr_system_health": "To be calculated",
                "ai_agent_capability": "To be calculated",
                "recommendations": [
                    "Detailed recommendations will be generated based on evaluation results"
                ]
            },
            "detailed_analysis": {
                "step1_details": step1_results.get('detailed_results', []),
                "step2_details": step2_results.get('detailed_results', [])
            }
        }
        
        # レポート保存
        output_file = paths['results'] / f"comprehensive_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(comprehensive_report, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Comprehensive report generated: {output_file}")
        return output_file
        
    except Exception as e:
        print(f"❌ Report generation failed: {e}")
        return None

def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(description="APR Evaluation System")
    parser.add_argument('--step', choices=['1', '2', 'all'], default='all',
                      help='Evaluation step to run (1: compliance, 2: quality, all: both)')
    parser.add_argument('--llm-model', default='gpt-4o-mini',
                      help='LLM model for evaluation')
    parser.add_argument('--verbose', '-v', action='store_true',
                      help='Verbose output')
    parser.add_argument('--dry-run', action='store_true',
                      help='Dry run mode (no actual evaluation)')
    
    args = parser.parse_args()
    
    print("🚀 APR Evaluation System Starting...")
    print(f"  - Evaluation step: {args.step}")
    print(f"  - LLM model: {args.llm_model}")
    print(f"  - Verbose mode: {args.verbose}")
    print(f"  - Dry run: {args.dry_run}")
    print()
    
    # パス設定
    paths = setup_paths()
    
    if args.dry_run:
        print("🔍 Dry run mode - checking environment...")
        for name, path in paths.items():
            status = "✅ EXISTS" if path.exists() else "❌ MISSING"
            print(f"  - {name}: {path} [{status}]")
        print("✅ Dry run completed")
        return
    
    # 評価実行
    step1_file = None
    step2_file = None
    
    if args.step in ['1', 'all']:
        step1_file = run_step1_compliance_evaluation(paths, args)
    
    if args.step in ['2', 'all']:
        step2_file = run_step2_quality_evaluation(paths, args)
    
    # 統合レポート生成（両ステップ実行時のみ）
    if args.step == 'all':
        generate_comprehensive_report(paths, step1_file, step2_file, args)
    
    print("🎉 APR Evaluation System Completed!")

if __name__ == "__main__":
    main()
