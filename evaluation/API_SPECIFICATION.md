# API仕様書 - APR評価システム

## 📋 概要

本ドキュメントは、APR（Automatic Program Repair）評価システムの詳細なAPI仕様とインターフェース定義を提供します。

---

## 🎯 主要APIエンドポイント

### main.py コマンドラインインターフェース

```bash
python main.py [OPTIONS] [COMMANDS]
```

#### オプション

| オプション | 型 | デフォルト | 説明 |
|-----------|---|-----------|------|
| `--mode` | str | `"full"` | 評価モード (`setup`, `compliance`, `quality`, `full`, `dry-run`) |
| `--project` | str | `None` | 対象プロジェクト名 (指定しない場合は全プロジェクト) |
| `--dataset` | str | `"all"` | データセット指定 (`filtered_confirmed`, `filtered_commit`, `test`, `all`) |
| `--output-format` | str | `"json"` | 出力形式 (`json`, `csv`, `html`) |
| `--output-dir` | str | `"/app/results"` | 結果出力ディレクトリ |
| `--limit` | int | `None` | 処理件数制限（テスト用） |
| `--parallel-workers` | int | `4` | 並列実行ワーカー数 |
| `--debug` | bool | `False` | デバッグモード有効化 |
| `--verbose` | bool | `False` | 詳細ログ出力 |
| `--log-level` | str | `"INFO"` | ログレベル (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `--config-file` | str | `None` | カスタム設定ファイルパス |
| `--llm-provider` | str | `"openai"` | LLMプロバイダー (`openai`, `anthropic`) |
| `--model` | str | `"gpt-4"` | 使用するLLMモデル |
| `--timeout` | int | `300` | API呼び出しタイムアウト（秒） |

#### 使用例

```bash
# 基本的な完全評価
python main.py --mode full

# 特定プロジェクトのシステム適合性評価のみ
python main.py --mode compliance --project servantes

# デバッグモードで小規模テスト
python main.py --mode quality --limit 10 --debug --verbose

# カスタム設定での評価
python main.py --config-file /app/config/custom_config.json --llm-provider anthropic
```

---

## 🔧 プログラマティックAPI

### BaseEvaluator インターフェース

```python
from src.evaluators.base_evaluator import BaseEvaluator

class BaseEvaluator:
    def __init__(self, config: Dict[str, Any]):
        """評価器の初期化
        
        Args:
            config: 設定辞書
        """
    
    def evaluate(self, data: Any) -> EvaluationResult:
        """評価の実行
        
        Args:
            data: 評価対象データ
            
        Returns:
            EvaluationResult: 評価結果
            
        Raises:
            EvaluationError: 評価失敗時
        """
    
    def generate_report(self, results: List[EvaluationResult]) -> Dict[str, Any]:
        """レポート生成
        
        Args:
            results: 評価結果リスト
            
        Returns:
            Dict: レポートデータ
        """
```

### ComplianceEvaluator API

```python
from src.evaluators.compliance_evaluator import ComplianceEvaluator

class ComplianceEvaluator(BaseEvaluator):
    def evaluate_control_flow(self, apr_logs: List[Dict]) -> float:
        """制御フロー解析精度の評価
        
        Args:
            apr_logs: APRログデータ
            
        Returns:
            float: 精度スコア (0.0-1.0)
        """
    
    def evaluate_parser_accuracy(self, apr_logs: List[Dict]) -> float:
        """パーサー精度の評価
        
        Args:
            apr_logs: APRログデータ
            
        Returns:
            float: 精度スコア (0.0-1.0)
        """
    
    def evaluate_file_processing(self, apr_logs: List[Dict]) -> float:
        """ファイル処理能力の評価
        
        Args:
            apr_logs: APRログデータ
            
        Returns:
            float: 処理成功率 (0.0-1.0)
        """
    
    def evaluate_error_handling(self, apr_logs: List[Dict]) -> float:
        """エラーハンドリング能力の評価
        
        Args:
            apr_logs: APRログデータ
            
        Returns:
            float: エラーハンドリングスコア (0.0-1.0)
        """
```

### QualityEvaluator API

```python
from src.evaluators.quality_evaluator import QualityEvaluator

class QualityEvaluator(BaseEvaluator):
    async def evaluate_patch_quality(
        self, 
        generated_patch: str, 
        ground_truth: str
    ) -> Dict[str, float]:
        """パッチ品質の総合評価
        
        Args:
            generated_patch: 生成されたパッチ
            ground_truth: グラウンドトゥルース
            
        Returns:
            Dict[str, float]: 品質メトリクス
            - plausibility_score: 妥当性スコア
            - correctness_r1: Correctness@1
            - correctness_r5: Correctness@5
            - correctness_r10: Correctness@10
            - reasoning_quality: 推論品質スコア
        """
    
    def calculate_correctness_at_k(
        self, 
        predictions: List[str], 
        ground_truth: str, 
        k: int
    ) -> float:
        """Correctness@K メトリクスの計算
        
        Args:
            predictions: 予測パッチリスト
            ground_truth: 正解パッチ
            k: 上位K個
            
        Returns:
            float: Correctness@K スコア (0.0-1.0)
        """
    
    async def evaluate_reasoning_quality(
        self, 
        reasoning_log: str
    ) -> float:
        """推論品質の評価
        
        Args:
            reasoning_log: 推論ログ
            
        Returns:
            float: 推論品質スコア (0.0-1.0)
        """
```

---

## 📊 データ構造

### EvaluationResult

```python
@dataclass
class EvaluationResult:
    """評価結果の標準データ構造"""
    
    timestamp: datetime
    evaluator_type: str  # 'compliance', 'quality', 'integrated'
    project_name: str
    dataset_type: str
    metrics: Dict[str, float]
    details: Dict[str, Any]
    status: str  # 'success', 'partial', 'failed'
    execution_time: float  # 秒
    error_message: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """辞書形式に変換"""
        return asdict(self)
    
    def to_json(self) -> str:
        """JSON文字列に変換"""
        return json.dumps(self.to_dict(), default=str, indent=2)
```

### ComplianceMetrics

```python
@dataclass
class ComplianceMetrics:
    """システム適合性評価のメトリクス"""
    
    control_flow_accuracy: float  # 制御フロー解析精度
    parser_success_rate: float    # パーサー成功率
    file_processing_rate: float   # ファイル処理成功率
    error_handling_score: float   # エラーハンドリングスコア
    overall_compliance: float     # 総合適合性スコア
    
    def calculate_overall_score(self) -> float:
        """総合スコアの計算"""
        weights = {
            'control_flow_accuracy': 0.3,
            'parser_success_rate': 0.3,
            'file_processing_rate': 0.2,
            'error_handling_score': 0.2
        }
        
        return sum(
            getattr(self, metric) * weight
            for metric, weight in weights.items()
        )
```

### QualityMetrics

```python
@dataclass
class QualityMetrics:
    """パッチ品質評価のメトリクス"""
    
    plausibility_score: float     # 妥当性スコア
    correctness_r1: float         # Correctness@1
    correctness_r5: float         # Correctness@5
    correctness_r10: float        # Correctness@10
    reasoning_quality: float      # 推論品質スコア
    semantic_similarity: float    # 意味的類似度
    syntactic_correctness: float  # 構文正確性
    
    def calculate_overall_quality(self) -> float:
        """総合品質スコアの計算"""
        weights = {
            'plausibility_score': 0.2,
            'correctness_r1': 0.25,
            'correctness_r5': 0.2,
            'correctness_r10': 0.15,
            'reasoning_quality': 0.2
        }
        
        return sum(
            getattr(self, metric) * weight
            for metric, weight in weights.items()
        )
```

---

## 🤖 LLMプロバイダーAPI

### BaseLLMProvider インターフェース

```python
from abc import ABC, abstractmethod

class BaseLLMProvider(ABC):
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.rate_limiter = None
    
    @abstractmethod
    async def evaluate(
        self, 
        prompt: str, 
        max_tokens: int = 2000,
        temperature: float = 0.1
    ) -> str:
        """LLM評価の実行
        
        Args:
            prompt: 評価プロンプト
            max_tokens: 最大トークン数
            temperature: 温度パラメータ
            
        Returns:
            str: LLM応答
            
        Raises:
            LLMAPIError: API呼び出し失敗
            RateLimitError: レート制限エラー
        """
    
    def parse_evaluation_response(self, response: str) -> Dict[str, float]:
        """LLM応答の解析
        
        Args:
            response: LLM応答
            
        Returns:
            Dict[str, float]: 評価スコア
        """
```

### OpenAIProvider

```python
class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-4"):
        super().__init__(api_key, model)
        self.client = OpenAI(api_key=api_key)
        self.rate_limiter = AsyncRateLimiter(max_calls=100, time_window=60)
    
    async def evaluate(
        self, 
        prompt: str, 
        max_tokens: int = 2000,
        temperature: float = 0.1
    ) -> str:
        """OpenAI API経由での評価実行"""
        async with self.rate_limiter:
            try:
                response = await self.client.chat.completions.acreate(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": self._get_system_prompt()},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=max_tokens,
                    temperature=temperature
                )
                
                return response.choices[0].message.content
                
            except openai.RateLimitError as e:
                raise RateLimitError(f"OpenAI rate limit exceeded: {e}")
            except Exception as e:
                raise LLMAPIError(f"OpenAI API error: {e}")
```

---

## 📈 レポートAPI

### JSONReporter

```python
class JSONReporter:
    def generate_report(
        self, 
        results: List[EvaluationResult],
        include_metadata: bool = True
    ) -> Dict[str, Any]:
        """JSON形式のレポート生成
        
        Args:
            results: 評価結果リスト
            include_metadata: メタデータ含有フラグ
            
        Returns:
            Dict: JSONレポートデータ
        """
        
        report = {
            "evaluation_summary": {
                "total_evaluations": len(results),
                "successful_evaluations": len([r for r in results if r.status == 'success']),
                "failed_evaluations": len([r for r in results if r.status == 'failed']),
                "average_execution_time": self._calculate_avg_execution_time(results)
            },
            "metrics_summary": self._calculate_metrics_summary(results),
            "detailed_results": [result.to_dict() for result in results]
        }
        
        if include_metadata:
            report["metadata"] = self._generate_metadata()
        
        return report
    
    def save_report(
        self, 
        report: Dict[str, Any], 
        output_path: str
    ) -> None:
        """レポートファイルの保存"""
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=str)
```

### ChartGenerator

```python
class ChartGenerator:
    def generate_metrics_chart(
        self, 
        metrics_data: Dict[str, List[float]],
        chart_type: str = "bar",
        output_path: str = None
    ) -> str:
        """メトリクスチャートの生成
        
        Args:
            metrics_data: メトリクスデータ
            chart_type: チャート種類 ('bar', 'line', 'scatter', 'heatmap')
            output_path: 出力パス
            
        Returns:
            str: 生成されたチャートファイルパス
        """
    
    def generate_comparison_chart(
        self, 
        baseline_data: Dict[str, float],
        current_data: Dict[str, float],
        output_path: str = None
    ) -> str:
        """比較チャートの生成"""
    
    def generate_trend_chart(
        self, 
        time_series_data: Dict[str, List[Tuple[datetime, float]]],
        output_path: str = None
    ) -> str:
        """トレンドチャートの生成"""
```

---

## ⚙️ 設定API

### ConfigManager

```python
class ConfigManager:
    def __init__(self, config_path: str = "/app/config/evaluation_config.json"):
        self.config_path = config_path
        self.config = self.load_config()
    
    def load_config(self) -> Dict[str, Any]:
        """設定ファイルの読み込み"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return self.get_default_config()
    
    def get_default_config(self) -> Dict[str, Any]:
        """デフォルト設定の取得"""
        return {
            "evaluation": {
                "step1_enabled": True,
                "step2_enabled": True,
                "llm_provider": "openai",
                "model": "gpt-4",
                "timeout": 300,
                "max_retries": 3,
                "batch_size": 10,
                "parallel_workers": 4
            },
            "output": {
                "format": "json",
                "include_charts": True,
                "chart_format": "png",
                "include_raw_data": False
            },
            "logging": {
                "level": "INFO",
                "file_rotation": True,
                "max_file_size": "10MB",
                "backup_count": 5
            }
        }
    
    def update_config(self, updates: Dict[str, Any]) -> None:
        """設定の更新"""
        def deep_update(base_dict, update_dict):
            for key, value in update_dict.items():
                if key in base_dict and isinstance(base_dict[key], dict) and isinstance(value, dict):
                    deep_update(base_dict[key], value)
                else:
                    base_dict[key] = value
        
        deep_update(self.config, updates)
        self.save_config()
    
    def save_config(self) -> None:
        """設定ファイルの保存"""
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
```

---

## 🔍 検証API

### DataValidator

```python
class DataValidator:
    @staticmethod
    def validate_apr_logs(logs: List[Dict]) -> Tuple[bool, List[str]]:
        """APRログデータの検証
        
        Args:
            logs: APRログデータ
            
        Returns:
            Tuple[bool, List[str]]: (有効性, エラーメッセージリスト)
        """
        errors = []
        
        if not logs:
            errors.append("Empty log data")
            return False, errors
        
        required_fields = ['timestamp', 'project', 'status']
        for i, log in enumerate(logs):
            missing_fields = [field for field in required_fields if field not in log]
            if missing_fields:
                errors.append(f"Log {i}: Missing fields {missing_fields}")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_patch_data(patch: str) -> Tuple[bool, List[str]]:
        """パッチデータの検証"""
        errors = []
        
        if not patch or not patch.strip():
            errors.append("Empty patch data")
        
        if not patch.startswith('diff ') and not patch.startswith('--- '):
            errors.append("Invalid patch format")
        
        return len(errors) == 0, errors
```

---

## 🚨 エラーハンドリング

### カスタム例外

```python
class EvaluationError(Exception):
    """評価システム基底例外"""
    pass

class ConfigurationError(EvaluationError):
    """設定エラー"""
    pass

class DataValidationError(EvaluationError):
    """データ検証エラー"""
    pass

class LLMAPIError(EvaluationError):
    """LLM API エラー"""
    pass

class RateLimitError(LLMAPIError):
    """レート制限エラー"""
    pass

class TimeoutError(EvaluationError):
    """タイムアウトエラー"""
    pass
```

### エラーレスポンス形式

```python
@dataclass
class ErrorResponse:
    """エラーレスポンスの標準形式"""
    
    error_type: str
    error_message: str
    error_code: str
    timestamp: datetime
    context: Dict[str, Any] = None
    suggestions: List[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
```

---

## 📚 使用例

### 基本的な評価実行

```python
#!/usr/bin/env python3
"""基本的な評価実行例"""

import asyncio
from src.evaluators.integrated_evaluator import IntegratedEvaluator
from src.utils.config_manager import ConfigManager

async def main():
    # 設定読み込み
    config_manager = ConfigManager()
    config = config_manager.load_config()
    
    # 評価器初期化
    evaluator = IntegratedEvaluator(config)
    
    # 評価実行
    try:
        results = await evaluator.evaluate_project('servantes')
        
        # 結果出力
        for result in results:
            print(f"Evaluator: {result.evaluator_type}")
            print(f"Status: {result.status}")
            print(f"Metrics: {result.metrics}")
            print(f"Execution time: {result.execution_time:.2f}s")
            print("-" * 50)
    
    except Exception as e:
        print(f"Evaluation failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
```

### カスタム評価器の実装

```python
"""カスタム評価器の実装例"""

from src.evaluators.base_evaluator import BaseEvaluator
from src.models.evaluation_result import EvaluationResult

class CustomMetricEvaluator(BaseEvaluator):
    def __init__(self, config):
        super().__init__(config)
        self.metric_name = "custom_complexity_score"
    
    def evaluate(self, data):
        """カスタムメトリクスの評価"""
        try:
            # カスタム評価ロジック
            complexity_score = self._calculate_complexity(data)
            
            return EvaluationResult(
                timestamp=datetime.now(),
                evaluator_type='custom_complexity',
                project_name=data.get('project_name', 'unknown'),
                dataset_type=data.get('dataset_type', 'unknown'),
                metrics={self.metric_name: complexity_score},
                details={'algorithm': 'custom_complexity_v1'},
                status='success',
                execution_time=time.time() - start_time
            )
        
        except Exception as e:
            self.logger.error(f"Custom evaluation failed: {e}")
            return EvaluationResult(
                timestamp=datetime.now(),
                evaluator_type='custom_complexity',
                project_name=data.get('project_name', 'unknown'),
                dataset_type=data.get('dataset_type', 'unknown'),
                metrics={},
                details={},
                status='failed',
                execution_time=0,
                error_message=str(e)
            )
    
    def _calculate_complexity(self, data):
        """複雑度計算ロジック"""
        # 実装例: McCabe複雑度的な計算
        pass
```

---

**作成日**: 2025-07-22  
**バージョン**: 1.0  
**対象システム**: gRPC_Analyzer APR評価システム
