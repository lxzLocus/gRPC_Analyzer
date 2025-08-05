#!/usr/bin/env python3
"""
APR評価結果の詳細分析ツール
個別のLLM評価レスポンスから詳細なメトリクスを抽出し、より精密な分析を実行
"""

import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from collections import defaultdict, Counter
import re
import logging


@dataclass 
class DetailedEvaluationMetrics:
    """詳細評価メトリクス"""
    experiment_id: str
    project: str
    task_title: str
    category: str
    
    # LLM評価スコア
    parser_success_rate: float
    workflow_compliance: bool
    system_health: str
    
    # LLM使用量統計
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    
    # 推奨事項とクリティカル問題
    recommendations_count: int
    critical_issues_count: int
    
    # 詳細分析用
    task_complexity: str = "MEDIUM"  # タスクの複雑度
    estimated_difficulty: float = 0.5  # 推定難易度


class EnhancedAPRAnalyzer:
    """拡張APR分析器"""
    
    def __init__(self, session_path: str):
        self.session_path = Path(session_path)
        self.results_path = self.session_path / "results"
        self.detailed_responses_path = self.session_path / "detailed_responses"
        self.metrics: List[DetailedEvaluationMetrics] = []
        
        # カテゴリ分類（前回と同じ）
        self.category_keywords = {
            'リファクタリング': ['refactor', 'rename', 'restructure', 'reorganize', 'move', 'extract'],
            'パフォーマンス改善': ['performance', 'optimize', 'cache', 'index', 'speed', 'efficient'],
            '機能追加': ['add', 'implement', 'feature', 'endpoint', 'api', 'support'],
            'テストコード': ['test', 'unittest', 'integration', 'coverage', 'mock'],
            'バグ修正': ['fix', 'bug', 'error', 'issue', 'correct', 'resolve'],
            '単純修正': ['typo', 'license', 'header', 'format', 'style', 'comment'],
            'ドキュメント': ['doc', 'readme', 'documentation', 'comment', 'example'],
            'セキュリティ': ['security', 'auth', 'permission', 'vulnerability', 'secure'],
            '依存関係': ['dependency', 'update', 'version', 'upgrade', 'package'],
            '設定・環境': ['config', 'environment', 'setup', 'install', 'deploy'],
            'プロトコル・通信': ['grpc', 'http', 'api', 'protocol', 'endpoint', 'request'],
            'データベース': ['database', 'sql', 'query', 'table', 'schema', 'migration']
        }
        
        # 複雑度判定キーワード
        self.complexity_indicators = {
            'HIGH': ['multiple', 'complex', 'integration', 'migration', 'refactor', 'architecture'],
            'MEDIUM': ['add', 'update', 'modify', 'implement', 'enhance'],
            'LOW': ['fix', 'typo', 'format', 'simple', 'minor']
        }
        
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def load_enhanced_data(self) -> None:
        """拡張データを読み込み"""
        self.logger.info(f"🔍 拡張評価データ読み込み開始: {self.session_path}")
        
        total_loaded = 0
        
        for project_dir in self.results_path.iterdir():
            if not project_dir.is_dir():
                continue
                
            project_name = project_dir.name
            result_files = list(project_dir.glob("evaluation_result_*.json"))
            
            if not result_files:
                continue
            
            result_file = max(result_files, key=lambda x: x.stat().st_mtime)
            
            try:
                with open(result_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                analysis_data = data.get('Real_OPENAI_Analysis', {})
                detailed_results = analysis_data.get('detailed_results', [])
                
                for result in detailed_results:
                    metrics = self._create_detailed_metrics(result, project_name)
                    if metrics:
                        self.metrics.append(metrics)
                        total_loaded += 1
                
                self.logger.info(f"✅ {project_name}: {len(detailed_results)}件の詳細メトリクスを読み込み")
                
            except Exception as e:
                self.logger.error(f"❌ {project_name}: {e}")
        
        self.logger.info(f"📊 総合読み込み完了: {total_loaded}件のメトリクス")

    def _create_detailed_metrics(self, result_data: Dict, project: str) -> Optional[DetailedEvaluationMetrics]:
        """詳細メトリクスオブジェクトを作成"""
        try:
            experiment_id = result_data.get('experiment_id', '')
            
            # タスクタイトル抽出
            if '/Issue_' in experiment_id:
                task_title = experiment_id.split('/Issue_')[1].replace('_', ' ')
            elif '/PR_' in experiment_id:
                task_title = experiment_id.split('/PR_')[1].replace('_', ' ')
            else:
                task_title = experiment_id.split('/')[-1].replace('_', ' ')
            
            # カテゴリ自動分類
            category = self._classify_task_category(task_title)
            
            # 複雑度判定
            complexity = self._estimate_task_complexity(task_title)
            difficulty = self._estimate_task_difficulty(task_title, category)
            
            # LLM使用量統計
            llm_usage = result_data.get('llm_usage', {})
            
            return DetailedEvaluationMetrics(
                experiment_id=experiment_id,
                project=project,
                task_title=task_title,
                category=category,
                parser_success_rate=result_data.get('parser_success_rate', 0.0),
                workflow_compliance=result_data.get('workflow_compliance', False),
                system_health=result_data.get('system_health', 'UNKNOWN'),
                prompt_tokens=llm_usage.get('prompt_tokens', 0),
                completion_tokens=llm_usage.get('completion_tokens', 0),
                total_tokens=llm_usage.get('total_tokens', 0),
                recommendations_count=len(result_data.get('recommendations', [])),
                critical_issues_count=len(result_data.get('critical_issues', [])),
                task_complexity=complexity,
                estimated_difficulty=difficulty
            )
            
        except Exception as e:
            self.logger.error(f"⚠️ 詳細メトリクス作成エラー: {e}")
            return None

    def _classify_task_category(self, task_title: str) -> str:
        """タスクカテゴリを分類"""
        task_lower = task_title.lower()
        
        for category, keywords in self.category_keywords.items():
            for keyword in keywords:
                if keyword in task_lower:
                    return category
        
        return "その他"

    def _estimate_task_complexity(self, task_title: str) -> str:
        """タスクの複雑度を推定"""
        task_lower = task_title.lower()
        
        for complexity, keywords in self.complexity_indicators.items():
            for keyword in keywords:
                if keyword in task_lower:
                    return complexity
        
        return "MEDIUM"

    def _estimate_task_difficulty(self, task_title: str, category: str) -> float:
        """タスクの難易度を推定（0.0-1.0）"""
        # 基本難易度（カテゴリベース）
        category_difficulty = {
            'テストコード': 0.8,
            'リファクタリング': 0.7,
            'パフォーマンス改善': 0.6,
            '機能追加': 0.5,
            'バグ修正': 0.4,
            'セキュリティ': 0.7,
            '設定・環境': 0.3,
            '単純修正': 0.2,
            'ドキュメント': 0.3,
            'その他': 0.5
        }
        
        base_difficulty = category_difficulty.get(category, 0.5)
        
        # タイトルの長さによる調整
        title_length_factor = min(len(task_title.split()) / 10, 0.3)
        
        # 技術的キーワードによる調整
        technical_keywords = ['grpc', 'api', 'protocol', 'database', 'integration', 'migration']
        tech_factor = sum(0.1 for keyword in technical_keywords if keyword in task_title.lower())
        
        difficulty = min(base_difficulty + title_length_factor + tech_factor, 1.0)
        return difficulty

    def analyze_comprehensive_metrics(self) -> Dict[str, Any]:
        """包括的メトリクス分析"""
        self.logger.info("📊 包括的メトリクス分析開始")
        
        df = pd.DataFrame([{
            'experiment_id': m.experiment_id,
            'project': m.project,
            'task_title': m.task_title,
            'category': m.category,
            'parser_success_rate': m.parser_success_rate,
            'workflow_compliance': m.workflow_compliance,
            'system_health': m.system_health,
            'prompt_tokens': m.prompt_tokens,
            'completion_tokens': m.completion_tokens,
            'total_tokens': m.total_tokens,
            'recommendations_count': m.recommendations_count,
            'critical_issues_count': m.critical_issues_count,
            'task_complexity': m.task_complexity,
            'estimated_difficulty': m.estimated_difficulty
        } for m in self.metrics])
        
        analysis = {}
        
        # 1. カテゴリ別統計
        category_stats = df.groupby('category').agg({
            'parser_success_rate': ['count', 'mean', 'std'],
            'workflow_compliance': 'mean',
            'total_tokens': ['mean', 'std'],
            'recommendations_count': 'mean',
            'critical_issues_count': 'mean',
            'estimated_difficulty': 'mean'
        }).round(3)
        
        analysis['category_statistics'] = category_stats
        
        # 2. プロジェクト別統計
        project_stats = df.groupby('project').agg({
            'parser_success_rate': 'mean',
            'total_tokens': 'mean',
            'estimated_difficulty': 'mean'
        }).round(3)
        
        analysis['project_statistics'] = project_stats
        
        # 3. 複雑度別統計
        complexity_stats = df.groupby('task_complexity').agg({
            'parser_success_rate': 'mean',
            'total_tokens': 'mean',
            'recommendations_count': 'mean'
        }).round(3)
        
        analysis['complexity_statistics'] = complexity_stats
        
        # 4. 相関分析
        correlation_matrix = df[['parser_success_rate', 'total_tokens', 'recommendations_count', 
                               'critical_issues_count', 'estimated_difficulty']].corr().round(3)
        analysis['correlation_matrix'] = correlation_matrix
        
        return analysis

    def generate_enhanced_visualizations(self, output_dir: Path) -> None:
        """拡張可視化グラフを生成"""
        self.logger.info(f"📈 拡張可視化グラフ生成開始: {output_dir}")
        
        output_dir.mkdir(exist_ok=True)
        
        # スタイル設定
        plt.style.use('seaborn-v0_8')
        
        # データフレーム作成
        df = pd.DataFrame([{
            'project': m.project,
            'category': m.category,
            'parser_success_rate': m.parser_success_rate,
            'total_tokens': m.total_tokens,
            'recommendations_count': m.recommendations_count,
            'estimated_difficulty': m.estimated_difficulty,
            'task_complexity': m.task_complexity
        } for m in self.metrics])
        
        # 1. カテゴリ別トークン使用量
        plt.figure(figsize=(14, 8))
        sns.boxplot(data=df, x='category', y='total_tokens')
        plt.title('Token Usage Distribution by Task Category', fontsize=16, fontweight='bold')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig(output_dir / 'category_token_usage.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 2. 推定難易度 vs パフォーマンス
        plt.figure(figsize=(12, 8))
        scatter = plt.scatter(df['estimated_difficulty'], df['parser_success_rate'], 
                            c=df['total_tokens'], s=60, alpha=0.7, cmap='viridis')
        plt.colorbar(scatter, label='Total Tokens')
        plt.xlabel('Estimated Task Difficulty')
        plt.ylabel('Parser Success Rate')
        plt.title('Task Difficulty vs Performance (Token Usage)', fontsize=16, fontweight='bold')
        plt.tight_layout()
        plt.savefig(output_dir / 'difficulty_vs_performance.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 3. プロジェクト別推奨事項数
        plt.figure(figsize=(12, 6))
        project_recommendations = df.groupby('project')['recommendations_count'].mean().sort_values(ascending=True)
        project_recommendations.plot(kind='barh', color='lightgreen')
        plt.title('Average Recommendations Count by Project', fontsize=16, fontweight='bold')
        plt.xlabel('Average Recommendations Count')
        plt.tight_layout()
        plt.savefig(output_dir / 'project_recommendations.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        # 4. 複雑度別パフォーマンス分布
        plt.figure(figsize=(10, 6))
        complexity_order = ['LOW', 'MEDIUM', 'HIGH']
        df_complexity = df[df['task_complexity'].isin(complexity_order)]
        sns.boxplot(data=df_complexity, x='task_complexity', y='parser_success_rate', order=complexity_order)
        plt.title('Performance Distribution by Task Complexity', fontsize=16, fontweight='bold')
        plt.ylabel('Parser Success Rate')
        plt.tight_layout()
        plt.savefig(output_dir / 'complexity_performance.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        self.logger.info("✅ 拡張可視化グラフ生成完了")

    def generate_enhanced_report(self, output_dir: Path) -> None:
        """拡張レポートを生成"""
        self.logger.info("📄 拡張レポート生成開始")
        
        analysis = self.analyze_comprehensive_metrics()
        
        report = []
        report.append("# Enhanced APR System Analysis Report")
        report.append(f"**分析日時**: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"**総評価件数**: {len(self.metrics):,}")
        report.append("")
        
        # カテゴリ別詳細統計
        report.append("## カテゴリ別詳細統計")
        report.append("")
        report.append("| カテゴリ | 件数 | 成功率 | 平均トークン | 推奨事項 | 推定難易度 |")
        report.append("|---------|------|--------|-------------|----------|-----------|")
        
        category_stats = analysis['category_statistics']
        for category in category_stats.index:
            count = category_stats.loc[category, ('parser_success_rate', 'count')]
            success_rate = category_stats.loc[category, ('parser_success_rate', 'mean')]
            avg_tokens = category_stats.loc[category, ('total_tokens', 'mean')]
            avg_recommendations = category_stats.loc[category, ('recommendations_count', 'mean')]
            avg_difficulty = category_stats.loc[category, ('estimated_difficulty', 'mean')]
            
            report.append(f"| {category} | {count} | {success_rate:.3f} | {avg_tokens:.0f} | {avg_recommendations:.1f} | {avg_difficulty:.3f} |")
        
        report.append("")
        
        # プロジェクト別統計
        report.append("## プロジェクト別統計")
        report.append("")
        report.append("| プロジェクト | 成功率 | 平均トークン | 推定難易度 |")
        report.append("|-------------|--------|-------------|-----------|")
        
        project_stats = analysis['project_statistics']
        for project in project_stats.index:
            success_rate = project_stats.loc[project, 'parser_success_rate']
            avg_tokens = project_stats.loc[project, 'total_tokens']
            avg_difficulty = project_stats.loc[project, 'estimated_difficulty']
            
            report.append(f"| {project} | {success_rate:.3f} | {avg_tokens:.0f} | {avg_difficulty:.3f} |")
        
        report.append("")
        
        # 主要な発見
        report.append("## 主要な発見")
        report.append("")
        
        df = pd.DataFrame([{
            'category': m.category,
            'total_tokens': m.total_tokens,
            'estimated_difficulty': m.estimated_difficulty
        } for m in self.metrics])
        
        # 最もトークンを消費するカテゴリ
        avg_tokens_by_category = df.groupby('category')['total_tokens'].mean()
        most_tokens_category = avg_tokens_by_category.idxmax()
        most_tokens_value = avg_tokens_by_category.max()
        
        # 最も困難なカテゴリ
        avg_difficulty_by_category = df.groupby('category')['estimated_difficulty'].mean()
        most_difficult_category = avg_difficulty_by_category.idxmax()
        most_difficult_value = avg_difficulty_by_category.max()
        
        report.append(f"- **最もトークンを消費するカテゴリ**: {most_tokens_category} ({most_tokens_value:.0f} tokens)")
        report.append(f"- **最も困難なカテゴリ**: {most_difficult_category} (難易度: {most_difficult_value:.3f})")
        report.append("")
        
        # レポート保存
        with open(output_dir / 'enhanced_analysis_report.md', 'w', encoding='utf-8') as f:
            f.write('\n'.join(report))
        
        self.logger.info("✅ 拡張レポート生成完了")


def main():
    """メイン実行関数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Enhanced APR Dataset Analysis Tool')
    parser.add_argument('session_path', help='評価セッションのパス')
    parser.add_argument('--output', '-o', default='./enhanced_analysis_output', help='出力ディレクトリ')
    
    args = parser.parse_args()
    
    # 拡張分析器初期化
    analyzer = EnhancedAPRAnalyzer(args.session_path)
    
    # 出力ディレクトリ準備
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)
    
    try:
        # データ読み込み
        analyzer.load_enhanced_data()
        
        # 分析実行
        analyzer.generate_enhanced_visualizations(output_dir)
        analyzer.generate_enhanced_report(output_dir)
        
        print(f"🎉 拡張分析完了！結果は {output_dir} に保存されました")
        
    except Exception as e:
        print(f"❌ 拡張分析エラー: {e}")
        raise


if __name__ == "__main__":
    main()
