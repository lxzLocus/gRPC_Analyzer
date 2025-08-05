#!/usr/bin/env python3
"""
APRタスクカテゴリ分類支援ツール
タスクタイトルから自動分類し、手動確認・修正を支援
"""

import json
import pandas as pd
import re
from pathlib import Path
from typing import Dict, List, Tuple
import logging


class TaskCategoryClassifier:
    """タスクカテゴリ分類器"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # 拡張されたカテゴリキーワード辞書
        self.category_patterns = {
            'リファクタリング': {
                'keywords': ['refactor', 'rename', 'restructure', 'reorganize', 'move', 'extract', 
                           'relocate', 'cleanup', 'simplify', 'consolidate'],
                'patterns': [r'\bmove\s+\w+\s+to\b', r'\brename\s+\w+', r'\bextract\s+\w+']
            },
            'パフォーマンス改善': {
                'keywords': ['performance', 'optimize', 'cache', 'index', 'speed', 'efficient', 
                           'faster', 'improve', 'accelerate', 'benchmark'],
                'patterns': [r'\boptimize\b', r'\bperformance\b', r'\bspeed\s+up\b']
            },
            '機能追加': {
                'keywords': ['add', 'implement', 'feature', 'endpoint', 'api', 'support', 
                           'introduce', 'create', 'new', 'enhance'],
                'patterns': [r'\badd\s+\w+', r'\bimplement\s+\w+', r'\bnew\s+\w+']
            },
            'テストコード': {
                'keywords': ['test', 'unittest', 'integration', 'coverage', 'mock', 'spec', 
                           'testing', 'verification', 'validate'],
                'patterns': [r'\btest\s+\w+', r'\bunittest\b', r'\bmock\s+\w+']
            },
            'バグ修正': {
                'keywords': ['fix', 'bug', 'error', 'issue', 'correct', 'resolve', 'repair', 
                           'patch', 'address', 'handle'],
                'patterns': [r'\bfix\s+\w+', r'\bbug\s+fix\b', r'\bresolve\s+\w+']
            },
            '単純修正': {
                'keywords': ['typo', 'license', 'header', 'format', 'style', 'comment', 
                           'whitespace', 'indent', 'spelling'],
                'patterns': [r'\btypo\b', r'\blicense\s+header\b', r'\bformat\s+\w+']
            },
            'ドキュメント': {
                'keywords': ['doc', 'readme', 'documentation', 'comment', 'example', 
                           'guide', 'manual', 'explain'],
                'patterns': [r'\bdoc\s+\w+', r'\breadme\b', r'\bdocumentation\b']
            },
            'セキュリティ': {
                'keywords': ['security', 'auth', 'permission', 'vulnerability', 'secure', 
                           'encrypt', 'protect', 'certificate', 'tls', 'ssl'],
                'patterns': [r'\bsecurity\s+\w+', r'\bauth\w*', r'\bssl\b', r'\btls\b']
            },
            '依存関係': {
                'keywords': ['dependency', 'update', 'version', 'upgrade', 'package', 
                           'library', 'framework', 'module'],
                'patterns': [r'\bupdate\s+\w+', r'\bupgrade\s+\w+', r'\bdependency\b']
            },
            '設定・環境': {
                'keywords': ['config', 'environment', 'setup', 'install', 'deploy', 
                           'configuration', 'setting', 'env'],
                'patterns': [r'\bconfig\w*', r'\bsetup\b', r'\benvironment\b']
            },
            'プロトコル・通信': {
                'keywords': ['grpc', 'http', 'api', 'protocol', 'endpoint', 'request', 
                           'response', 'client', 'server'],
                'patterns': [r'\bgrpc\b', r'\bhttp\s+\w+', r'\bapi\s+\w+']
            },
            'データベース': {
                'keywords': ['database', 'sql', 'query', 'table', 'schema', 'migration', 
                           'index', 'db'],
                'patterns': [r'\bdatabase\b', r'\bsql\b', r'\bquery\b', r'\btable\b']
            }
        }

    def classify_task(self, task_title: str, experiment_id: str = "") -> Tuple[str, float]:
        """
        タスクを分類し、信頼度を返す
        
        Returns:
            (category, confidence): カテゴリ名と信頼度(0.0-1.0)
        """
        task_lower = task_title.lower()
        experiment_lower = experiment_id.lower()
        combined_text = f"{task_lower} {experiment_lower}"
        
        category_scores = {}
        
        for category, patterns in self.category_patterns.items():
            score = 0.0
            matches = 0
            
            # キーワードマッチング
            for keyword in patterns['keywords']:
                if keyword in combined_text:
                    score += 1.0
                    matches += 1
            
            # パターンマッチング（より高い重み）
            for pattern in patterns['patterns']:
                if re.search(pattern, combined_text, re.IGNORECASE):
                    score += 2.0
                    matches += 1
            
            # 信頼度計算（マッチ数に基づく）
            if matches > 0:
                max_possible = len(patterns['keywords']) + len(patterns['patterns']) * 2
                confidence = min(score / max_possible, 1.0)
                category_scores[category] = confidence
        
        if not category_scores:
            return "その他", 0.0
        
        # 最高スコアのカテゴリを選択
        best_category = max(category_scores.keys(), key=lambda k: category_scores[k])
        best_confidence = category_scores[best_category]
        
        return best_category, best_confidence

    def batch_classify_from_session(self, session_path: str) -> pd.DataFrame:
        """セッションデータから一括分類"""
        session_dir = Path(session_path)
        results_dir = session_dir / "results"
        
        all_tasks = []
        
        # 各プロジェクトからタスク情報を抽出
        for project_dir in results_dir.iterdir():
            if not project_dir.is_dir():
                continue
                
            project_name = project_dir.name
            result_files = list(project_dir.glob("evaluation_result_*.json"))
            
            if not result_files:
                continue
            
            # 最新の結果ファイルを使用
            result_file = max(result_files, key=lambda x: x.stat().st_mtime)
            
            try:
                with open(result_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                analysis_data = data.get('Real_OPENAI_Analysis', {})
                detailed_results = analysis_data.get('detailed_results', [])
                
                for result in detailed_results:
                    experiment_id = result.get('experiment_id', '')
                    
                    # タスクタイプとタイトルを抽出
                    if '/Issue_' in experiment_id:
                        task_type = 'issue'
                        task_title = experiment_id.split('/Issue_')[1].replace('_', ' ')
                    elif '/PR_' in experiment_id:
                        task_type = 'pullrequest'
                        task_title = experiment_id.split('/PR_')[1].replace('_', ' ')
                    else:
                        task_type = 'unknown'
                        task_title = experiment_id.split('/')[-1].replace('_', ' ')
                    
                    # 自動分類実行
                    category, confidence = self.classify_task(task_title, experiment_id)
                    
                    all_tasks.append({
                        'project': project_name,
                        'experiment_id': experiment_id,
                        'task_type': task_type,
                        'task_title': task_title,
                        'auto_category': category,
                        'confidence': confidence,
                        'manual_category': '',  # 手動確認用
                        'notes': ''  # メモ用
                    })
                    
            except Exception as e:
                self.logger.error(f"❌ {project_name}: {e}")
        
        return pd.DataFrame(all_tasks)

    def export_classification_template(self, df: pd.DataFrame, output_path: str) -> None:
        """分類確認用テンプレートをエクスポート"""
        # 信頼度でソート（低い順）
        df_sorted = df.sort_values(['confidence', 'project', 'task_title'])
        
        # カテゴリ統計を追加
        category_stats = df.groupby('auto_category').agg({
            'confidence': ['count', 'mean', 'std'],
            'project': 'nunique'
        }).round(3)
        
        # エクスポート
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # メイン分類データ
            df_sorted.to_excel(writer, sheet_name='Task_Classification', index=False)
            
            # カテゴリ統計
            category_stats.to_excel(writer, sheet_name='Category_Statistics')
            
            # 分類ガイド
            guide_data = []
            for category, patterns in self.category_patterns.items():
                guide_data.append({
                    'Category': category,
                    'Keywords': ', '.join(patterns['keywords'][:5]),  # 最初の5個
                    'Description': f"{len(patterns['keywords'])} keywords, {len(patterns['patterns'])} patterns"
                })
            
            pd.DataFrame(guide_data).to_excel(writer, sheet_name='Classification_Guide', index=False)
        
        print(f"✅ 分類テンプレートを出力: {output_path}")
        print(f"📊 総タスク数: {len(df):,}")
        print(f"🏷️ 自動分類カテゴリ数: {df['auto_category'].nunique()}")
        print(f"📈 平均信頼度: {df['confidence'].mean():.3f}")

    def generate_classification_report(self, df: pd.DataFrame) -> str:
        """分類レポートを生成"""
        report = []
        report.append("# APR Task Classification Report")
        report.append(f"**総タスク数**: {len(df):,}")
        report.append(f"**分析日時**: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # カテゴリ別統計
        report.append("## カテゴリ別統計")
        report.append("")
        category_stats = df.groupby('auto_category').agg({
            'confidence': ['count', 'mean', 'std'],
            'project': 'nunique'
        }).round(3)
        
        report.append("| カテゴリ | 件数 | 平均信頼度 | 信頼度標準偏差 | プロジェクト数 |")
        report.append("|---------|------|-----------|--------------|---------------|")
        
        for category in category_stats.index:
            count = category_stats.loc[category, ('confidence', 'count')]
            mean_conf = category_stats.loc[category, ('confidence', 'mean')]
            std_conf = category_stats.loc[category, ('confidence', 'std')]
            project_count = category_stats.loc[category, ('project', 'nunique')]
            
            report.append(f"| {category} | {count} | {mean_conf:.3f} | {std_conf:.3f} | {project_count} |")
        
        report.append("")
        
        # 信頼度分析
        report.append("## 信頼度分析")
        report.append("")
        
        high_conf = len(df[df['confidence'] >= 0.7])
        medium_conf = len(df[(df['confidence'] >= 0.3) & (df['confidence'] < 0.7)])
        low_conf = len(df[df['confidence'] < 0.3])
        
        report.append(f"- **高信頼度** (≥0.7): {high_conf:,}件 ({high_conf/len(df)*100:.1f}%)")
        report.append(f"- **中信頼度** (0.3-0.7): {medium_conf:,}件 ({medium_conf/len(df)*100:.1f}%)")
        report.append(f"- **低信頼度** (<0.3): {low_conf:,}件 ({low_conf/len(df)*100:.1f}%)")
        report.append("")
        
        # 要確認項目
        report.append("## 要確認項目")
        report.append("")
        
        low_confidence_tasks = df[df['confidence'] < 0.3].head(10)
        if not low_confidence_tasks.empty:
            report.append("### 信頼度が低いタスク（上位10件）")
            report.append("")
            for _, task in low_confidence_tasks.iterrows():
                report.append(f"- **{task['project']}**: {task['task_title']} (信頼度: {task['confidence']:.3f})")
            report.append("")
        
        return '\n'.join(report)


def main():
    """メイン実行関数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='APR Task Category Classification Tool')
    parser.add_argument('session_path', help='評価セッションのパス')
    parser.add_argument('--output', '-o', default='./classification_output', help='出力ディレクトリ')
    
    args = parser.parse_args()
    
    # 分類器初期化
    classifier = TaskCategoryClassifier()
    
    # 出力ディレクトリ準備
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)
    
    try:
        # 一括分類実行
        print("🔍 タスク分類開始...")
        df = classifier.batch_classify_from_session(args.session_path)
        
        # 分類テンプレートエクスポート
        template_path = output_dir / 'task_classification_template.xlsx'
        classifier.export_classification_template(df, str(template_path))
        
        # レポート生成
        report = classifier.generate_classification_report(df)
        report_path = output_dir / 'classification_report.md'
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        
        print(f"📄 分類レポートを出力: {report_path}")
        print(f"🎉 分類完了！結果は {output_dir} に保存されました")
        
    except Exception as e:
        print(f"❌ 分類エラー: {e}")
        raise


if __name__ == "__main__":
    main()
