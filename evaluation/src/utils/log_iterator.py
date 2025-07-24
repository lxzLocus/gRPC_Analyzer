"""
APRログディレクトリ巡回処理システム
全プロジェクトのログを自動的に収集・処理する
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Iterator, Tuple
from dataclasses import dataclass
from datetime import datetime


@dataclass
class LogEntry:
    """ログエントリーを表すデータクラス"""
    project_name: str
    log_type: str  # 'issue' or 'pullrequest'
    log_path: Path
    timestamp: datetime
    size: int


@dataclass
class ProjectLogs:
    """プロジェクトのログ集合を表すデータクラス"""
    project_name: str
    issue_logs: List[LogEntry]
    pullrequest_logs: List[LogEntry]
    total_logs: int


class APRLogIterator:
    """APRログディレクトリを巡回するイテレーター"""
    
    def __init__(self, workspace_path: str = "/app"):
        self.workspace_path = Path(workspace_path)
        self.apr_logs_path = self.workspace_path / "apr-logs"
        self.projects = []
        self._discover_projects()
    
    def _discover_projects(self):
        """apr-logsディレクトリ内のプロジェクトサブディレクトリを発見"""
        if not self.apr_logs_path.exists():
            raise FileNotFoundError(f"APR logs directory not found: {self.apr_logs_path}")
        
        # apr-logsディレクトリ内のサブディレクトリのみを処理対象とする
        for project_dir in self.apr_logs_path.iterdir():
            if project_dir.is_dir() and not project_dir.name.startswith('.'):
                self.projects.append(project_dir.name)
        
        print(f"📁 apr-logsディレクトリ内のプロジェクト: {len(self.projects)}件")
        for project in sorted(self.projects):
            print(f"  - {project}")
    
    def get_project_names(self) -> List[str]:
        """利用可能なプロジェクト名のリストを取得"""
        return sorted(self.projects.copy())
    
    def get_project_logs(self, project_name: str) -> ProjectLogs:
        """特定プロジェクトのログを取得"""
        project_path = self.apr_logs_path / project_name
        
        if not project_path.exists():
            raise FileNotFoundError(f"Project directory not found: {project_path}")
        
        issue_logs = []
        pullrequest_logs = []
        other_logs = []  # その他のログファイルも収集
        
        # プロジェクトディレクトリ内の全サブディレクトリを探索
        for subdir in project_path.iterdir():
            if not subdir.is_dir():
                continue
                
            if subdir.name == "issue":
                issue_logs = self._collect_logs(project_name, "issue", subdir)
            elif subdir.name == "pullrequest":
                pullrequest_logs = self._collect_logs(project_name, "pullrequest", subdir)
            else:
                # その他のログディレクトリ（将来の拡張性のため）
                other_logs.extend(self._collect_logs(project_name, subdir.name, subdir))
        
        # その他のログをpullrequestログとして扱う（過去の互換性のため）
        pullrequest_logs.extend(other_logs)
        
        return ProjectLogs(
            project_name=project_name,
            issue_logs=issue_logs,
            pullrequest_logs=pullrequest_logs,
            total_logs=len(issue_logs) + len(pullrequest_logs)
        )
    
    def _collect_logs(self, project_name: str, log_type: str, log_dir: Path) -> List[LogEntry]:
        """ログディレクトリからログファイルを収集"""
        logs = []
        
        # 対象とするファイル拡張子を定義
        log_extensions = ["*.json", "*.log", "*.txt"]
        
        # ログディレクトリを再帰的に探索
        for extension in log_extensions:
            for log_file in log_dir.rglob(extension):
                try:
                    stat_info = log_file.stat()
                    logs.append(LogEntry(
                        project_name=project_name,
                        log_type=log_type,
                        log_path=log_file,
                        timestamp=datetime.fromtimestamp(stat_info.st_mtime),
                        size=stat_info.st_size
                    ))
                except Exception as e:
                    print(f"⚠️  ログファイル読み取りエラー: {log_file} - {e}")
        
        return logs
    
    def iterate_all_projects(self) -> Iterator[ProjectLogs]:
        """全プロジェクトを巡回するイテレーター"""
        for project_name in sorted(self.projects):
            try:
                project_logs = self.get_project_logs(project_name)
                print(f"🔄 処理中: {project_name} ({project_logs.total_logs} ログ)")
                yield project_logs
            except Exception as e:
                print(f"❌ プロジェクト処理エラー: {project_name} - {e}")
                continue
    
    def iterate_all_logs(self) -> Iterator[LogEntry]:
        """全ログエントリーを巡回するイテレーター"""
        for project_logs in self.iterate_all_projects():
            # issueログを処理
            for log_entry in project_logs.issue_logs:
                yield log_entry
            
            # pullrequestログを処理  
            for log_entry in project_logs.pullrequest_logs:
                yield log_entry
    
    def get_statistics(self) -> Dict:
        """ログ統計情報を取得"""
        stats = {
            "total_projects": len(self.projects),
            "projects": {},
            "overall": {
                "total_logs": 0,
                "issue_logs": 0,
                "pullrequest_logs": 0,
                "total_size_bytes": 0
            }
        }
        
        for project_logs in self.iterate_all_projects():
            project_stats = {
                "issue_logs": len(project_logs.issue_logs),
                "pullrequest_logs": len(project_logs.pullrequest_logs),
                "total_logs": project_logs.total_logs,
                "total_size_bytes": sum(log.size for log in 
                                      project_logs.issue_logs + project_logs.pullrequest_logs)
            }
            
            stats["projects"][project_logs.project_name] = project_stats
            stats["overall"]["total_logs"] += project_stats["total_logs"]
            stats["overall"]["issue_logs"] += project_stats["issue_logs"] 
            stats["overall"]["pullrequest_logs"] += project_stats["pullrequest_logs"]
            stats["overall"]["total_size_bytes"] += project_stats["total_size_bytes"]
        
        return stats


def demo_log_iteration():
    """ログ巡回のデモンストレーション"""
    print("🚀 APRログ巡回処理デモ")
    print("=" * 50)
    
    # イテレーターを初期化
    log_iterator = APRLogIterator("/app/apr-logs")
    
    # 統計情報を表示
    stats = log_iterator.get_statistics()
    print(f"📊 ログ統計情報:")
    print(f"  - 総プロジェクト数: {stats['total_projects']}")
    print(f"  - 総ログ数: {stats['overall']['total_logs']}")
    print(f"  - issueログ数: {stats['overall']['issue_logs']}")
    print(f"  - pullrequestログ数: {stats['overall']['pullrequest_logs']}")
    print(f"  - 総サイズ: {stats['overall']['total_size_bytes']:,} bytes")
    print()
    
    # プロジェクト別統計
    print("📋 プロジェクト別詳細:")
    for project_name, project_stats in stats["projects"].items():
        print(f"  📁 {project_name}:")
        print(f"    - 総ログ数: {project_stats['total_logs']}")
        print(f"    - issue: {project_stats['issue_logs']}, PR: {project_stats['pullrequest_logs']}")
        print(f"    - サイズ: {project_stats['total_size_bytes']:,} bytes")
    print()
    
    # 実際の巡回処理例（最初の10ログのみ）
    print("🔄 ログエントリー巡回例（最初の10件）:")
    count = 0
    for log_entry in log_iterator.iterate_all_logs():
        count += 1
        if count > 10:
            break
        
        print(f"  {count:2d}. [{log_entry.project_name}] {log_entry.log_type} - {log_entry.log_path.name}")
        print(f"      パス: {log_entry.log_path}")
        print(f"      サイズ: {log_entry.size:,} bytes, 更新: {log_entry.timestamp}")
        print()
    
    print(f"✅ デモ完了 - 総{stats['overall']['total_logs']}ログが処理可能")


if __name__ == "__main__":
    demo_log_iteration()
