"""
プロンプトテンプレート管理ユーティリティ
外部テンプレートファイルの読み込みとフォーマット処理を提供
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional
from string import Template


class PromptTemplateManager:
    """プロンプトテンプレート管理クラス"""
    
    def __init__(self, templates_dir: str = None):
        """
        初期化
        
        Args:
            templates_dir: テンプレートディレクトリのパス（Noneの場合は自動検出）
        """
        if templates_dir:
            self.templates_dir = Path(templates_dir)
        else:
            # デフォルトのテンプレートディレクトリを設定（srcレベル）
            current_dir = Path(__file__).parent.parent  # src/utils から src へ
            self.templates_dir = current_dir / "templates"
        
        # テンプレートキャッシュ
        self._template_cache = {}
        
        print(f"📁 プロンプトテンプレートディレクトリ: {self.templates_dir}")
    
    def load_template(self, template_name: str, use_cache: bool = True) -> str:
        """
        テンプレートファイルを読み込み
        
        Args:
            template_name: テンプレートファイル名（拡張子含む）
            use_cache: キャッシュを使用するかどうか
        
        Returns:
            テンプレート内容
        
        Raises:
            FileNotFoundError: テンプレートファイルが見つからない場合
        """
        
        # キャッシュから取得を試行
        if use_cache and template_name in self._template_cache:
            return self._template_cache[template_name]
        
        template_path = self.templates_dir / template_name
        
        if not template_path.exists():
            raise FileNotFoundError(f"テンプレートファイルが見つかりません: {template_path}")
        
        try:
            with open(template_path, 'r', encoding='utf-8') as f:
                template_content = f.read()
            
            # キャッシュに保存
            if use_cache:
                self._template_cache[template_name] = template_content
            
            print(f"✅ テンプレート読み込み成功: {template_name}")
            return template_content
            
        except Exception as e:
            raise RuntimeError(f"テンプレートファイルの読み込みに失敗: {template_name} - {e}")
    
    def format_template(self, template_name: str, **kwargs) -> str:
        """
        テンプレートを変数で置換してフォーマット
        
        Args:
            template_name: テンプレートファイル名
            **kwargs: テンプレート変数
        
        Returns:
            フォーマット済みテンプレート
        """
        template_content = self.load_template(template_name)
        
        # Python標準のstring.Templateを使用
        template = Template(template_content)
        
        try:
            formatted_content = template.substitute(**kwargs)
            return formatted_content
        except KeyError as e:
            missing_var = str(e).strip("'")
            raise ValueError(f"テンプレート変数が不足しています: {missing_var} (テンプレート: {template_name})")
        except Exception as e:
            raise RuntimeError(f"テンプレートのフォーマットに失敗: {template_name} - {e}")
    
    def get_available_templates(self) -> list[str]:
        """
        利用可能なテンプレートファイル一覧を取得
        
        Returns:
            テンプレートファイル名のリスト
        """
        if not self.templates_dir.exists():
            return []
        
        template_files = []
        for file_path in self.templates_dir.glob("*.txt"):
            template_files.append(file_path.name)
        
        return sorted(template_files)
    
    def validate_template(self, template_name: str, required_vars: list[str]) -> tuple[bool, list[str]]:
        """
        テンプレートが必要な変数を含んでいるかチェック
        
        Args:
            template_name: テンプレートファイル名
            required_vars: 必要な変数のリスト
        
        Returns:
            (valid, missing_vars): 妥当性とない変数のリスト
        """
        template_content = self.load_template(template_name)
        
        missing_vars = []
        for var in required_vars:
            if f"{{{var}}}" not in template_content:
                missing_vars.append(var)
        
        return len(missing_vars) == 0, missing_vars
    
    def clear_cache(self):
        """テンプレートキャッシュをクリア"""
        self._template_cache.clear()
        print("🗑️  テンプレートキャッシュをクリアしました")
    
    def reload_template(self, template_name: str) -> str:
        """
        テンプレートを強制的に再読み込み
        
        Args:
            template_name: テンプレートファイル名
        
        Returns:
            テンプレート内容
        """
        # キャッシュから削除
        self._template_cache.pop(template_name, None)
        
        # 再読み込み
        return self.load_template(template_name, use_cache=True)


class APRPromptTemplates:
    """APR評価専用のプロンプトテンプレート管理"""
    
    def __init__(self, templates_dir: str = None, template_style: str = "default"):
        """
        初期化
        
        Args:
            templates_dir: テンプレートディレクトリのパス
            template_style: テンプレートスタイル (default, japanese, simple)
        """
        self.template_manager = PromptTemplateManager(templates_dir)
        self.template_style = template_style
        
        # 利用可能なテンプレートスタイルマッピング
        self.template_files = {
            "default": "evaluation_prompt_template.txt",
            "english": "evaluation_prompt_template.txt", 
            "japanese": "evaluation_prompt_japanese.txt",
            "simple": "evaluation_prompt_simple.txt"
        }
        
        # APR評価で使用する標準的なテンプレート変数
        self.standard_vars = [
            "experiment_id",
            "turn_count", 
            "overall_status",
            "log_size",
            "turns_data",
            "additional_data_note"
        ]
        
        # 選択されたテンプレートファイル
        self.current_template_file = self.template_files.get(template_style, self.template_files["default"])
        print(f"📋 APRプロンプトテンプレート: {template_style} -> {self.current_template_file}")
    
    def set_template_style(self, style: str):
        """テンプレートスタイルを変更"""
        if style in self.template_files:
            self.template_style = style
            self.current_template_file = self.template_files[style]
            print(f"📋 テンプレートスタイル変更: {style} -> {self.current_template_file}")
        else:
            available_styles = list(self.template_files.keys())
            raise ValueError(f"無効なテンプレートスタイル: {style}. 利用可能: {available_styles}")
    
    def get_available_styles(self) -> list[str]:
        """利用可能なテンプレートスタイル一覧"""
        return list(self.template_files.keys())
    
    def get_evaluation_prompt(self, evaluation_data: Dict[str, Any]) -> str:
        """
        評価用プロンプトを生成
        
        Args:
            evaluation_data: 評価データ
        
        Returns:
            フォーマット済みプロンプト
        """
        # テンプレート変数を準備
        template_vars = {
            "experiment_id": evaluation_data.get('experiment_id', 'N/A'),
            "turn_count": evaluation_data.get('turn_count', 0),
            "overall_status": evaluation_data.get('overall_status', 'N/A'),
            "log_size": len(str(evaluation_data.get('turns_data', []))),
            "turns_data": json.dumps(evaluation_data.get('turns_data', [])[:3], indent=2, ensure_ascii=False),
            "additional_data_note": "[Additional data truncated for brevity...]" if len(evaluation_data.get('turns_data', [])) > 3 else ""
        }
        
        try:
            return self.template_manager.format_template(self.current_template_file, **template_vars)
        except FileNotFoundError:
            print(f"⚠️  {self.current_template_file} が見つかりません。デフォルトプロンプトを使用します")
            return self._get_fallback_prompt(evaluation_data)
    
    def _get_fallback_prompt(self, evaluation_data: Dict[str, Any]) -> str:
        """フォールバック用の基本プロンプト"""
        return f"""## APR System Evaluation ##
Please evaluate the following APR system log data:

Experiment ID: {evaluation_data.get('experiment_id', 'N/A')}
Total Turns: {evaluation_data.get('turn_count', 0)}
Status: {evaluation_data.get('overall_status', 'N/A')}

Data: {json.dumps(evaluation_data.get('turns_data', [])[:2], indent=2)}

Please provide your evaluation in JSON format with parser_evaluation, workflow_evaluation, and overall_assessment sections."""
    
    def validate_evaluation_template(self) -> tuple[bool, list[str]]:
        """評価テンプレートの妥当性をチェック"""
        return self.template_manager.validate_template(self.current_template_file, self.standard_vars)
    
    def list_templates(self) -> list[str]:
        """利用可能なテンプレート一覧"""
        return self.template_manager.get_available_templates()


def demo_template_management():
    """テンプレート管理のデモ"""
    print("📋 プロンプトテンプレート管理デモ")
    print("=" * 50)
    
    # 複数のスタイルでテスト
    styles_to_test = ["default", "japanese", "simple"]
    
    for style in styles_to_test:
        print(f"\n🎨 テンプレートスタイル: {style}")
        print("-" * 30)
        
        # APRプロンプトテンプレート管理を初期化
        apr_templates = APRPromptTemplates(template_style=style)
        
        # 利用可能なテンプレート一覧
        templates = apr_templates.list_templates()
        print(f"📁 利用可能なテンプレート: {templates}")
        
        # テンプレートの妥当性チェック
        is_valid, missing_vars = apr_templates.validate_evaluation_template()
        print(f"✅ 評価テンプレート妥当性: {is_valid}")
        if missing_vars:
            print(f"⚠️  不足変数: {missing_vars}")
        
        # サンプルデータでプロンプト生成
        sample_data = {
            "experiment_id": "demo_exp_001", 
            "turn_count": 3,
            "overall_status": "SUCCESS",
            "turns_data": [
                {"turn": 1, "status": "completed", "content": "sample content 1"},
                {"turn": 2, "status": "completed", "content": "sample content 2"}
            ]
        }
        
        try:
            prompt = apr_templates.get_evaluation_prompt(sample_data)
            print(f"🚀 生成されたプロンプト長: {len(prompt)} 文字")
            print(f"プロンプト内容（最初の150文字）:")
            print(prompt[:150] + "...")
        except Exception as e:
            print(f"❌ プロンプト生成エラー: {e}")
    
    print("\n🎯 利用可能なスタイル:")
    for style in APRPromptTemplates().get_available_styles():
        print(f"  - {style}")
    
    print("\n💡 使用例:")
    print("  # 日本語テンプレートを使用")
    print('  evaluator = SystemComplianceEvaluator(prompt_template_style="japanese")')
    print("  # シンプルテンプレートを使用")
    print('  evaluator = SystemComplianceEvaluator(prompt_template_style="simple")')
    print("  # 動的にスタイル変更")
    print('  evaluator.prompt_templates.set_template_style("japanese")')


if __name__ == "__main__":
    demo_template_management()
