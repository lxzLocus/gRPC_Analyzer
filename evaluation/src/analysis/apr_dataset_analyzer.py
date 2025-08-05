#!/usr/bin/env python3
"""
APR全体評価分析システム
データセット全体の度数分布とカテゴリ別評価を実装

1. 度数分布分析：評価グレード、システム健全性、適合性スコアの分布
2. カテゴリ別分析：修正タスクの種類別パフォーマンス評価
"""

import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
from collections import defaultdict, Counter
import logging


@dataclass
class EvaluationRecord:
    """個別評価記録"""
    experiment_id: str
    project: str
    task_type: str  # issue/pullrequest
    task_title: str
    overall_compliance: float
    system_health: str
    parser_success_rate: float
    workflow_compliance: bool
    critical_issues: List[str]
    recommendations: List[str]
    category: str = "未分類"  # 後でカテゴリ分類を追加


@dataclass
class DistributionAnalysis:
    """度数分布分析結果"""
    grade_distribution: Dict[str, int]
    health_distribution: Dict[str, int]
    score_statistics: Dict[str, float]
    score_histogram_data: Tuple[np.ndarray, np.ndarray]


@dataclass
class CategoryAnalysis:
    """カテゴリ別分析結果"""
    category_stats: Dict[str, Dict[str, Any]]
    success_rates: Dict[str, float]
    average_scores: Dict[str, float]
    health_breakdown: Dict[str, Dict[str, int]]


class APRDatasetAnalyzer:
    """APRデータセット全体分析器"""
    
    def __init__(self, session_path: str):
        self.session_path = Path(session_path)
        self.results_path = self.session_path / "results"
        self.records: List[EvaluationRecord] = []
        
        # 評価グレード定義（EVALUATION_PROCESS_GUIDE.mdに基づく）
        self.grade_thresholds = {
            'A+': 0.95,
            'A': 0.90,
            'B': 0.80,
            'C': 0.70,
            'D': 0.60,
            'F': 0.0
        }
        
        # カテゴリ分類定義（拡張可能）
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
            '設定・環境': ['config', 'environment', 'setup', 'install', 'deploy']
        }
        
        # ログ設定
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def load_evaluation_data(self) -> None:
        """評価データを読み込み"""
        self.logger.info(f"🔍 評価データ読み込み開始: {self.session_path}")
        
        total_loaded = 0
        
        # 各プロジェクトの結果を読み込み
        for project_dir in self.results_path.iterdir():
            if not project_dir.is_dir():
                continue
                
            project_name = project_dir.name
            result_files = list(project_dir.glob("evaluation_result_*.json"))
            
            if not result_files:
                self.logger.warning(f"⚠️ {project_name}: 評価結果ファイルが見つかりません")
                continue
            
            # 最新の結果ファイルを使用
            result_file = max(result_files, key=lambda x: x.stat().st_mtime)
            
            try:
                with open(result_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # detailed_resultsから個別記録を抽出
                analysis_data = data.get('Real_OPENAI_Analysis', {})
                detailed_results = analysis_data.get('detailed_results', [])
                
                for result in detailed_results:
                    record = self._create_evaluation_record(result, project_name)
                    if record:
                        self.records.append(record)
                        total_loaded += 1
                
                self.logger.info(f"✅ {project_name}: {len(detailed_results)}件の評価を読み込み")
                
            except Exception as e:
                self.logger.error(f"❌ {project_name}: データ読み込みエラー - {e}")
        
        self.logger.info(f"📊 総合読み込み完了: {total_loaded}件の評価記録")

    def _create_evaluation_record(self, result_data: Dict, project: str) -> EvaluationRecord:
        """評価記録オブジェクトを作成"""
        try:
            experiment_id = result_data.get('experiment_id', '')
            
            # task_typeとtask_titleを抽出
            if '/Issue_' in experiment_id:
                task_type = 'issue'
                task_title = experiment_id.split('/Issue_')[1].replace('_', ' ')
            elif '/PR_' in experiment_id:
                task_type = 'pullrequest'
                task_title = experiment_id.split('/PR_')[1].replace('_', ' ')
            else:
                task_type = 'unknown'
                task_title = experiment_id.split('/')[-1].replace('_', ' ')
            
            # カテゴリ自動分類
            category = self._classify_task_category(task_title)
            
            return EvaluationRecord(
                experiment_id=experiment_id,
                project=project,
                task_type=task_type,
                task_title=task_title,
                overall_compliance=result_data.get('parser_success_rate', 0.0),  # 個別結果にはoverall_complianceなし
                system_health=result_data.get('system_health', 'UNKNOWN'),
                parser_success_rate=result_data.get('parser_success_rate', 0.0),
                workflow_compliance=result_data.get('workflow_compliance', False),
                critical_issues=result_data.get('critical_issues', []),
                recommendations=result_data.get('recommendations', []),
                category=category
            )
            
        except Exception as e:
            self.logger.error(f"⚠️ 評価記録作成エラー: {e}")
            return None

    def _classify_task_category(self, task_title: str) -> str:
        """タスクタイトルからカテゴリを自動分類"""
        task_lower = task_title.lower()
        
        # 各カテゴリのキーワードマッチング
        for category, keywords in self.category_keywords.items():
            for keyword in keywords:
                if keyword in task_lower:
                    return category
        
        return "その他"

    def analyze_distributions(self) -> DistributionAnalysis:
        """度数分布分析を実行"""
        self.logger.info("📊 度数分布分析開始")
        
        # 評価グレード分布
        grade_counts = Counter()
        for record in self.records:
            grade = self._score_to_grade(record.overall_compliance)
            grade_counts[grade] += 1
        
        # システム健全性分布
        health_counts = Counter(record.system_health for record in self.records)
        
        # スコア統計
        scores = [record.overall_compliance for record in self.records]
        score_stats = {
            'mean': np.mean(scores),
            'median': np.median(scores),
            'std': np.std(scores),
            'min': np.min(scores),
            'max': np.max(scores),
            'q25': np.percentile(scores, 25),
            'q75': np.percentile(scores, 75)
        }
        
        # ヒストグラム用データ
        hist_counts, hist_bins = np.histogram(scores, bins=20, range=(0.0, 1.0))
        
        return DistributionAnalysis(
            grade_distribution=dict(grade_counts),
            health_distribution=dict(health_counts),
            score_statistics=score_stats,
            score_histogram_data=(hist_counts, hist_bins)
        )

    def analyze_categories(self) -> CategoryAnalysis:
        """カテゴリ別分析を実行"""
        self.logger.info("🏷️ カテゴリ別分析開始")
        
        category_data = defaultdict(list)
        
        # カテゴリ別にデータをグループ化
        for record in self.records:
            category_data[record.category].append(record)
        
        category_stats = {}
        success_rates = {}
        average_scores = {}
        health_breakdown = {}
        
        for category, records in category_data.items():
            # 成功率（EXCELLENT または GOOD）
            successful = sum(1 for r in records if r.system_health in ['EXCELLENT', 'GOOD'])
            success_rate = successful / len(records) if records else 0
            
            # 平均スコア
            avg_score = np.mean([r.overall_compliance for r in records]) if records else 0
            
            # 健全性内訳
            health_count = Counter(r.system_health for r in records)
            
            # 統計情報
            scores = [r.overall_compliance for r in records]
            stats = {
                'count': len(records),
                'success_rate': success_rate,
                'average_score': avg_score,
                'median_score': np.median(scores) if scores else 0,
                'score_std': np.std(scores) if scores else 0,
                'workflow_compliance_rate': sum(1 for r in records if r.workflow_compliance) / len(records) if records else 0
            }
            
            category_stats[category] = stats
            success_rates[category] = success_rate
            average_scores[category] = avg_score
            health_breakdown[category] = dict(health_count)
        
        return CategoryAnalysis(
            category_stats=category_stats,
            success_rates=success_rates,
            average_scores=average_scores,
            health_breakdown=health_breakdown
        )

    def _score_to_grade(self, score: float) -> str:
        """スコアを評価グレードに変換"""
        for grade, threshold in self.grade_thresholds.items():
            if score >= threshold:
                return grade
        return 'F'

    def generate_visualizations(self, output_dir: Path) -> None:
        """可視化グラフを生成"""
        self.logger.info(f"📈 可視化グラフ生成開始: {output_dir}")
        
        # 出力ディレクトリ作成
        output_dir.mkdir(exist_ok=True)
        
        # 日本語フォント設定（利用可能であれば）
        plt.style.use('seaborn-v0_8')
        try:
            plt.rcParams['font.family'] = 'DejaVu Sans'
        except:
            pass
        
        # 分析実行
        dist_analysis = self.analyze_distributions()
        cat_analysis = self.analyze_categories()
        
        # 1. 評価グレード分布（円グラフ）
        self._plot_grade_distribution(dist_analysis.grade_distribution, output_dir)
        
        # 2. システム健全性分布（棒グラフ）
        self._plot_health_distribution(dist_analysis.health_distribution, output_dir)
        
        # 3. スコアヒストグラム
        self._plot_score_histogram(dist_analysis.score_histogram_data, output_dir)
        
        # 4. カテゴリ別成功率
        self._plot_category_success_rates(cat_analysis.success_rates, output_dir)
        
        # 5. カテゴリ別平均スコア
        self._plot_category_scores(cat_analysis.average_scores, output_dir)
        
        # 6. カテゴリ別健全性ヒートマップ
        self._plot_category_health_heatmap(cat_analysis.health_breakdown, output_dir)
        
        self.logger.info("✅ 可視化グラフ生成完了")

    def _plot_grade_distribution(self, grade_dist: Dict[str, int], output_dir: Path):
        """評価グレード分布の円グラフ"""
        plt.figure(figsize=(10, 8))
        
        # グレード順にソート
        grade_order = ['A+', 'A', 'B', 'C', 'D', 'F']
        sorted_grades = [(g, grade_dist.get(g, 0)) for g in grade_order if grade_dist.get(g, 0) > 0]
        
        labels, sizes = zip(*sorted_grades)
        colors = ['#2E8B57', '#32CD32', '#FFD700', '#FF8C00', '#FF4500', '#DC143C'][:len(labels)]
        
        plt.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90)
        plt.title('APR System Evaluation Grade Distribution', fontsize=16, fontweight='bold')
        plt.axis('equal')
        plt.tight_layout()
        plt.savefig(output_dir / 'grade_distribution.png', dpi=300, bbox_inches='tight')
        plt.close()

    def _plot_health_distribution(self, health_dist: Dict[str, int], output_dir: Path):
        """システム健全性分布の棒グラフ"""
        plt.figure(figsize=(12, 6))
        
        health_order = ['EXCELLENT', 'GOOD', 'POOR', 'CRITICAL']
        labels = [h for h in health_order if h in health_dist]
        values = [health_dist[h] for h in labels]
        colors = ['#2E8B57', '#32CD32', '#FF8C00', '#DC143C'][:len(labels)]
        
        bars = plt.bar(labels, values, color=colors, alpha=0.8)
        plt.title('System Health Distribution', fontsize=16, fontweight='bold')
        plt.xlabel('Health Status')
        plt.ylabel('Number of Cases')
        
        # 値をバーの上に表示
        for bar, value in zip(bars, values):
            plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5, 
                    str(value), ha='center', va='bottom', fontweight='bold')
        
        plt.tight_layout()
        plt.savefig(output_dir / 'health_distribution.png', dpi=300, bbox_inches='tight')
        plt.close()

    def _plot_score_histogram(self, hist_data: Tuple[np.ndarray, np.ndarray], output_dir: Path):
        """適合性スコアのヒストグラム"""
        counts, bins = hist_data
        
        plt.figure(figsize=(12, 6))
        plt.hist(bins[:-1], bins, weights=counts, alpha=0.7, color='steelblue', edgecolor='black')
        plt.title('Overall Compliance Score Distribution', fontsize=16, fontweight='bold')
        plt.xlabel('Compliance Score')
        plt.ylabel('Frequency')
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(output_dir / 'score_histogram.png', dpi=300, bbox_inches='tight')
        plt.close()

    def _plot_category_success_rates(self, success_rates: Dict[str, float], output_dir: Path):
        """カテゴリ別成功率"""
        plt.figure(figsize=(14, 8))
        
        categories = list(success_rates.keys())
        rates = [success_rates[cat] * 100 for cat in categories]  # パーセンテージに変換
        
        bars = plt.bar(range(len(categories)), rates, alpha=0.8, color='lightcoral')
        plt.title('Success Rate by Task Category', fontsize=16, fontweight='bold')
        plt.xlabel('Task Category')
        plt.ylabel('Success Rate (%)')
        plt.xticks(range(len(categories)), categories, rotation=45, ha='right')
        
        # 値をバーの上に表示
        for i, (bar, rate) in enumerate(zip(bars, rates)):
            plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1, 
                    f'{rate:.1f}%', ha='center', va='bottom', fontweight='bold')
        
        plt.tight_layout()
        plt.savefig(output_dir / 'category_success_rates.png', dpi=300, bbox_inches='tight')
        plt.close()

    def _plot_category_scores(self, avg_scores: Dict[str, float], output_dir: Path):
        """カテゴリ別平均スコア"""
        plt.figure(figsize=(14, 8))
        
        categories = list(avg_scores.keys())
        scores = [avg_scores[cat] for cat in categories]
        
        bars = plt.bar(range(len(categories)), scores, alpha=0.8, color='lightblue')
        plt.title('Average Compliance Score by Task Category', fontsize=16, fontweight='bold')
        plt.xlabel('Task Category')
        plt.ylabel('Average Compliance Score')
        plt.xticks(range(len(categories)), categories, rotation=45, ha='right')
        plt.ylim(0, 1.0)
        
        # 値をバーの上に表示
        for i, (bar, score) in enumerate(zip(bars, scores)):
            plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01, 
                    f'{score:.3f}', ha='center', va='bottom', fontweight='bold')
        
        plt.tight_layout()
        plt.savefig(output_dir / 'category_average_scores.png', dpi=300, bbox_inches='tight')
        plt.close()

    def _plot_category_health_heatmap(self, health_breakdown: Dict[str, Dict[str, int]], output_dir: Path):
        """カテゴリ別健全性ヒートマップ"""
        plt.figure(figsize=(12, 8))
        
        # データを行列形式に変換
        categories = list(health_breakdown.keys())
        health_statuses = ['EXCELLENT', 'GOOD', 'POOR', 'CRITICAL']
        
        matrix = []
        for category in categories:
            row = [health_breakdown[category].get(status, 0) for status in health_statuses]
            matrix.append(row)
        
        # ヒートマップ作成
        sns.heatmap(matrix, xticklabels=health_statuses, yticklabels=categories, 
                   annot=True, fmt='d', cmap='RdYlGn_r', cbar_kws={'label': 'Number of Cases'})
        plt.title('Health Status Distribution by Task Category', fontsize=16, fontweight='bold')
        plt.xlabel('Health Status')
        plt.ylabel('Task Category')
        plt.tight_layout()
        plt.savefig(output_dir / 'category_health_heatmap.png', dpi=300, bbox_inches='tight')
        plt.close()

    def generate_report(self, output_dir: Path) -> None:
        """総合レポートを生成"""
        self.logger.info("📄 総合レポート生成開始")
        
        dist_analysis = self.analyze_distributions()
        cat_analysis = self.analyze_categories()
        
        report = []
        report.append("# APR System Dataset Analysis Report")
        report.append(f"**分析日時**: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"**総評価件数**: {len(self.records):,}")
        report.append("")
        
        # 1. 度数分布サマリー
        report.append("## 1. 度数分布分析")
        report.append("")
        
        # グレード分布
        report.append("### 評価グレード分布")
        for grade, count in sorted(dist_analysis.grade_distribution.items()):
            percentage = (count / len(self.records)) * 100
            report.append(f"- **{grade}**: {count:,}件 ({percentage:.1f}%)")
        report.append("")
        
        # 健全性分布
        report.append("### システム健全性分布")
        for health, count in dist_analysis.health_distribution.items():
            percentage = (count / len(self.records)) * 100
            report.append(f"- **{health}**: {count:,}件 ({percentage:.1f}%)")
        report.append("")
        
        # スコア統計
        report.append("### 適合性スコア統計")
        stats = dist_analysis.score_statistics
        report.append(f"- **平均**: {stats['mean']:.3f}")
        report.append(f"- **中央値**: {stats['median']:.3f}")
        report.append(f"- **標準偏差**: {stats['std']:.3f}")
        report.append(f"- **最小値**: {stats['min']:.3f}")
        report.append(f"- **最大値**: {stats['max']:.3f}")
        report.append("")
        
        # 2. カテゴリ別分析
        report.append("## 2. カテゴリ別分析")
        report.append("")
        
        # カテゴリ別テーブル
        report.append("| カテゴリ | 件数 | 成功率 | 平均スコア | 最高健全性 |")
        report.append("|---------|------|--------|-----------|------------|")
        
        for category, stats in cat_analysis.category_stats.items():
            health_dist = cat_analysis.health_breakdown[category]
            best_health = max(health_dist.keys(), key=lambda k: health_dist[k])
            
            report.append(f"| {category} | {stats['count']:,} | {stats['success_rate']:.1%} | {stats['average_score']:.3f} | {best_health} |")
        
        report.append("")
        
        # 3. 主要な発見
        report.append("## 3. 主要な発見")
        report.append("")
        
        # 最高成功率カテゴリ
        best_category = max(cat_analysis.success_rates.keys(), key=lambda k: cat_analysis.success_rates[k])
        worst_category = min(cat_analysis.success_rates.keys(), key=lambda k: cat_analysis.success_rates[k])
        
        report.append(f"- **最高成功率カテゴリ**: {best_category} ({cat_analysis.success_rates[best_category]:.1%})")
        report.append(f"- **最低成功率カテゴリ**: {worst_category} ({cat_analysis.success_rates[worst_category]:.1%})")
        report.append("")
        
        # 最高スコアカテゴリ
        best_score_category = max(cat_analysis.average_scores.keys(), key=lambda k: cat_analysis.average_scores[k])
        worst_score_category = min(cat_analysis.average_scores.keys(), key=lambda k: cat_analysis.average_scores[k])
        
        report.append(f"- **最高平均スコアカテゴリ**: {best_score_category} ({cat_analysis.average_scores[best_score_category]:.3f})")
        report.append(f"- **最低平均スコアカテゴリ**: {worst_score_category} ({cat_analysis.average_scores[worst_score_category]:.3f})")
        report.append("")
        
        # レポート保存
        with open(output_dir / 'analysis_report.md', 'w', encoding='utf-8') as f:
            f.write('\n'.join(report))
        
        self.logger.info("✅ 総合レポート生成完了")

    def export_detailed_data(self, output_dir: Path) -> None:
        """詳細データをCSVでエクスポート"""
        self.logger.info("💾 詳細データエクスポート開始")
        
        # 基本データをDataFrameに変換
        data = []
        for record in self.records:
            data.append({
                'experiment_id': record.experiment_id,
                'project': record.project,
                'task_type': record.task_type,
                'task_title': record.task_title,
                'category': record.category,
                'overall_compliance': record.overall_compliance,
                'system_health': record.system_health,
                'parser_success_rate': record.parser_success_rate,
                'workflow_compliance': record.workflow_compliance,
                'critical_issues_count': len(record.critical_issues),
                'recommendations_count': len(record.recommendations),
                'grade': self._score_to_grade(record.overall_compliance)
            })
        
        df = pd.DataFrame(data)
        df.to_csv(output_dir / 'detailed_evaluation_data.csv', index=False, encoding='utf-8')
        
        self.logger.info("✅ 詳細データエクスポート完了")


def main():
    """メイン実行関数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='APR Dataset Analysis Tool')
    parser.add_argument('session_path', help='評価セッションのパス')
    parser.add_argument('--output', '-o', default='./analysis_output', help='出力ディレクトリ')
    
    args = parser.parse_args()
    
    # 分析器初期化
    analyzer = APRDatasetAnalyzer(args.session_path)
    
    # 出力ディレクトリ準備
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)
    
    try:
        # データ読み込み
        analyzer.load_evaluation_data()
        
        # 分析実行
        analyzer.generate_visualizations(output_dir)
        analyzer.generate_report(output_dir)
        analyzer.export_detailed_data(output_dir)
        
        print(f"🎉 分析完了！結果は {output_dir} に保存されました")
        
    except Exception as e:
        print(f"❌ 分析エラー: {e}")
        raise


if __name__ == "__main__":
    main()
