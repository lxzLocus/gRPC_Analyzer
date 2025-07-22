# APR評価システム 開発ガイド

## 🛠️ 開発者向け詳細ガイド

### 📋 目次
1. [コードベース構造](#コードベース構造)
2. [開発環境セットアップ](#開発環境セットアップ)
3. [実装詳細](#実装詳細)
4. [テスト戦略](#テスト戦略)
5. [デバッグ・プロファイリング](#デバッグプロファイリング)
6. [新機能追加ガイド](#新機能追加ガイド)
7. [コード品質管理](#コード品質管理)

---

## コードベース構造

### メインモジュール構成

```
src/
├── __init__.py
├── main.py                     # エントリーポイント
├── evaluators/                 # 評価エンジン
│   ├── __init__.py
│   ├── base_evaluator.py      # 基底評価クラス
│   ├── compliance_evaluator.py # Step1: システム適合性評価
│   ├── quality_evaluator.py   # Step2: パッチ品質評価
│   └── integrated_evaluator.py # 統合評価器
├── analyzers/                  # データ解析
│   ├── __init__.py
│   ├── apr_log_analyzer.py    # APRログ解析
│   ├── patch_analyzer.py      # パッチ解析
│   ├── dataset_analyzer.py    # データセット解析
│   └── statistical_analyzer.py # 統計解析
├── llm/                       # LLM統合
│   ├── __init__.py
│   ├── base_provider.py       # LLMプロバイダー基底クラス
│   ├── openai_provider.py     # OpenAI統合
│   ├── anthropic_provider.py  # Anthropic統合
│   └── prompt_manager.py      # プロンプト管理
├── reporters/                 # レポート生成
│   ├── __init__.py
│   ├── json_reporter.py       # JSONレポート
│   ├── csv_reporter.py        # CSVレポート
│   ├── html_reporter.py       # HTMLレポート
│   └── chart_generator.py     # 可視化
├── utils/                     # ユーティリティ
│   ├── __init__.py
│   ├── file_handler.py        # ファイル操作
│   ├── logger.py             # ログ管理
│   ├── config_manager.py     # 設定管理
│   └── validation.py         # データ検証
└── tests/                     # テストスイート
    ├── unit/                  # 単体テスト
    ├── integration/           # 統合テスト
    └── fixtures/              # テストデータ
```

### 主要クラス設計

```python
# 基底評価クラス
class BaseEvaluator:
    def __init__(self, config):
        self.config = config
        self.logger = setup_logger()
    
    def evaluate(self, data):
        raise NotImplementedError
    
    def generate_report(self, results):
        raise NotImplementedError

# 評価結果データ構造
@dataclass
class EvaluationResult:
    timestamp: datetime
    evaluator_type: str
    project_name: str
    metrics: Dict[str, float]
    details: Dict[str, Any]
    status: str  # 'success', 'partial', 'failed'
```

---

## 開発環境セットアップ

### ローカル開発用コンテナ

```bash
# 開発用コンテナの起動
docker-compose -f docker-compose.yml up -d evaluation-system

# コンテナに入る
docker exec -it grpc-analyzer-evaluation bash

# 開発モードで実行
export EVALUATION_MODE=development
export PYTHONPATH=/app
python -m src.main --debug
```

### IDE設定（VS Code）

`.vscode/settings.json`:
```json
{
    "python.pythonPath": "/usr/local/bin/python",
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true,
    "python.formatting.provider": "black",
    "python.testing.pytestEnabled": true,
    "python.testing.pytestArgs": ["src/tests"]
}
```

`.vscode/launch.json`:
```json
{
    "configurations": [
        {
            "name": "Debug Evaluation",
            "type": "python",
            "request": "launch",
            "program": "main.py",
            "args": ["--mode", "dry-run", "--debug"],
            "cwd": "/app",
            "env": {
                "PYTHONPATH": "/app",
                "EVALUATION_MODE": "development"
            }
        }
    ]
}
```

---

## 実装詳細

### Step1: システム適合性評価器

```python
# src/evaluators/compliance_evaluator.py
class ComplianceEvaluator(BaseEvaluator):
    def __init__(self, config):
        super().__init__(config)
        self.metrics = {
            'control_flow_accuracy': 0.0,
            'parser_success_rate': 0.0,
            'file_processing_rate': 0.0,
            'error_handling_score': 0.0
        }
    
    def evaluate_control_flow(self, apr_logs):
        """制御フロー解析の精度を評価"""
        try:
            # APRログから制御フロー情報を抽出
            flow_data = self._extract_control_flow(apr_logs)
            
            # 期待される制御フローと比較
            accuracy = self._calculate_flow_accuracy(flow_data)
            
            return accuracy
        except Exception as e:
            self.logger.error(f"Control flow evaluation failed: {e}")
            return 0.0
    
    def evaluate_parser_accuracy(self, apr_logs):
        """パーサーの正確性を評価"""
        success_count = 0
        total_files = 0
        
        for log_entry in apr_logs:
            if 'parsing' in log_entry:
                total_files += 1
                if log_entry.get('parsing_success', False):
                    success_count += 1
        
        return success_count / total_files if total_files > 0 else 0.0
```

### Step2: パッチ品質評価器

```python
# src/evaluators/quality_evaluator.py
class QualityEvaluator(BaseEvaluator):
    def __init__(self, config, llm_provider):
        super().__init__(config)
        self.llm_provider = llm_provider
        self.metrics = {
            'plausibility_score': 0.0,
            'correctness_r1': 0.0,
            'correctness_r5': 0.0,
            'correctness_r10': 0.0,
            'reasoning_quality': 0.0
        }
    
    async def evaluate_patch_quality(self, generated_patch, ground_truth):
        """LLMを使用してパッチ品質を評価"""
        
        # プロンプト生成
        prompt = self._generate_quality_prompt(generated_patch, ground_truth)
        
        # LLM評価実行
        llm_response = await self.llm_provider.evaluate(prompt)
        
        # 結果解析
        scores = self._parse_llm_response(llm_response)
        
        return scores
    
    def _calculate_correctness_at_k(self, predictions, ground_truth, k):
        """Correctness@K メトリクスの計算"""
        if not predictions or not ground_truth:
            return 0.0
        
        # Top-K予測の中にground truthが含まれているかチェック
        top_k_predictions = predictions[:k]
        
        for pred in top_k_predictions:
            if self._is_functionally_equivalent(pred, ground_truth):
                return 1.0
        
        return 0.0
```

### LLMプロバイダー統合

```python
# src/llm/openai_provider.py
class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key, model="gpt-4"):
        self.client = openai.OpenAI(api_key=api_key)
        self.model = model
        self.rate_limiter = AsyncRateLimiter(max_calls=100, time_window=60)
    
    async def evaluate(self, prompt, max_tokens=2000):
        """OpenAI APIを使用した評価"""
        async with self.rate_limiter:
            try:
                response = await self.client.chat.completions.acreate(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are an expert code reviewer."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=max_tokens,
                    temperature=0.1
                )
                
                return response.choices[0].message.content
                
            except Exception as e:
                self.logger.error(f"OpenAI API error: {e}")
                raise
```

---

## テスト戦略

### 単体テスト

```python
# src/tests/unit/test_compliance_evaluator.py
import pytest
from src.evaluators.compliance_evaluator import ComplianceEvaluator

class TestComplianceEvaluator:
    @pytest.fixture
    def evaluator(self):
        config = {'test_mode': True}
        return ComplianceEvaluator(config)
    
    def test_control_flow_evaluation(self, evaluator):
        # テストデータ準備
        test_logs = [
            {'control_flow': 'if-then-else', 'accuracy': 0.95},
            {'control_flow': 'loop', 'accuracy': 0.87}
        ]
        
        # 評価実行
        result = evaluator.evaluate_control_flow(test_logs)
        
        # アサーション
        assert 0.0 <= result <= 1.0
        assert isinstance(result, float)
    
    @pytest.mark.asyncio
    async def test_parser_accuracy(self, evaluator):
        test_logs = [
            {'parsing': True, 'parsing_success': True},
            {'parsing': True, 'parsing_success': False},
            {'parsing': True, 'parsing_success': True}
        ]
        
        result = evaluator.evaluate_parser_accuracy(test_logs)
        
        assert result == 2/3  # 3件中2件成功
```

### 統合テスト

```python
# src/tests/integration/test_evaluation_pipeline.py
class TestEvaluationPipeline:
    @pytest.mark.integration
    async def test_full_evaluation_pipeline(self):
        """完全な評価パイプラインのテスト"""
        
        # テストデータ準備
        test_data = self._prepare_test_data()
        
        # Step1評価
        compliance_evaluator = ComplianceEvaluator(config)
        compliance_results = compliance_evaluator.evaluate(test_data)
        
        # Step2評価
        quality_evaluator = QualityEvaluator(config, mock_llm_provider)
        quality_results = await quality_evaluator.evaluate(test_data)
        
        # 統合結果確認
        assert compliance_results.status == 'success'
        assert quality_results.status == 'success'
        assert len(compliance_results.metrics) > 0
        assert len(quality_results.metrics) > 0
```

### パフォーマンステスト

```python
# src/tests/performance/test_scalability.py
class TestScalability:
    @pytest.mark.performance
    def test_large_dataset_processing(self):
        """大量データ処理のパフォーマンステスト"""
        
        # 大量のテストデータ生成
        large_dataset = self._generate_large_dataset(size=1000)
        
        start_time = time.time()
        
        # 評価実行
        results = evaluator.evaluate_batch(large_dataset)
        
        execution_time = time.time() - start_time
        
        # パフォーマンス要件確認
        assert execution_time < 300  # 5分以内
        assert len(results) == len(large_dataset)
```

---

## デバッグ・プロファイリング

### ログ設定

```python
# src/utils/logger.py
import logging
import sys
from datetime import datetime

def setup_logger(name="evaluation", level=logging.INFO):
    """詳細なログ設定"""
    
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # コンソールハンドラー
    console_handler = logging.StreamHandler(sys.stdout)
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(console_formatter)
    
    # ファイルハンドラー
    file_handler = logging.FileHandler(
        f'/app/logs/evaluation_{datetime.now().strftime("%Y%m%d")}.log'
    )
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s'
    )
    file_handler.setFormatter(file_formatter)
    
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    return logger
```

### プロファイリング

```python
# src/utils/profiler.py
import cProfile
import pstats
from functools import wraps

def profile_function(output_file=None):
    """関数のプロファイリングデコレータ"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            profiler = cProfile.Profile()
            profiler.enable()
            
            try:
                result = func(*args, **kwargs)
            finally:
                profiler.disable()
                
                if output_file:
                    profiler.dump_stats(output_file)
                else:
                    stats = pstats.Stats(profiler)
                    stats.sort_stats('cumulative')
                    stats.print_stats(20)  # Top 20
            
            return result
        return wrapper
    return decorator

# 使用例
@profile_function('/app/logs/performance/quality_evaluation.prof')
async def evaluate_patch_quality(self, patch_data):
    # 重い処理
    pass
```

### メモリ監視

```python
# src/utils/memory_monitor.py
import psutil
import gc
from functools import wraps

def monitor_memory(threshold_mb=1000):
    """メモリ使用量監視デコレータ"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            process = psutil.Process()
            
            # 実行前メモリ
            memory_before = process.memory_info().rss / 1024 / 1024
            
            result = func(*args, **kwargs)
            
            # 実行後メモリ
            memory_after = process.memory_info().rss / 1024 / 1024
            memory_diff = memory_after - memory_before
            
            if memory_diff > threshold_mb:
                logger.warning(
                    f"High memory usage in {func.__name__}: {memory_diff:.2f}MB"
                )
                gc.collect()  # ガベージコレクション実行
            
            return result
        return wrapper
    return decorator
```

---

## 新機能追加ガイド

### 新しい評価メトリクスの追加

1. **基底クラスから継承**:
```python
# src/evaluators/custom_evaluator.py
class CustomEvaluator(BaseEvaluator):
    def __init__(self, config):
        super().__init__(config)
        self.metrics = {
            'custom_metric_1': 0.0,
            'custom_metric_2': 0.0
        }
    
    def evaluate(self, data):
        """カスタム評価ロジック"""
        results = {}
        
        # メトリクス計算
        results['custom_metric_1'] = self._calculate_custom_metric_1(data)
        results['custom_metric_2'] = self._calculate_custom_metric_2(data)
        
        return EvaluationResult(
            timestamp=datetime.now(),
            evaluator_type='custom',
            metrics=results,
            status='success'
        )
```

2. **統合評価器に登録**:
```python
# src/evaluators/integrated_evaluator.py
class IntegratedEvaluator:
    def __init__(self, config):
        self.evaluators = [
            ComplianceEvaluator(config),
            QualityEvaluator(config),
            CustomEvaluator(config)  # 追加
        ]
```

### 新しいLLMプロバイダーの追加

1. **プロバイダークラス実装**:
```python
# src/llm/custom_provider.py
class CustomLLMProvider(BaseLLMProvider):
    def __init__(self, api_key, model_name):
        self.api_key = api_key
        self.model_name = model_name
        self.client = CustomLLMClient(api_key)
    
    async def evaluate(self, prompt, **kwargs):
        """カスタムLLM APIとの統合"""
        try:
            response = await self.client.generate(
                prompt=prompt,
                model=self.model_name,
                **kwargs
            )
            
            return self._parse_response(response)
            
        except Exception as e:
            self.logger.error(f"Custom LLM API error: {e}")
            raise
```

2. **プロバイダーファクトリーに追加**:
```python
# src/llm/provider_factory.py
def create_llm_provider(provider_name, config):
    providers = {
        'openai': OpenAIProvider,
        'anthropic': AnthropicProvider,
        'custom': CustomLLMProvider  # 追加
    }
    
    if provider_name not in providers:
        raise ValueError(f"Unknown LLM provider: {provider_name}")
    
    return providers[provider_name](config)
```

---

## コード品質管理

### 静的解析設定

**pyproject.toml**:
```toml
[tool.black]
line-length = 88
target-version = ['py312']

[tool.isort]
profile = "black"
multi_line_output = 3

[tool.pylint]
max-line-length = 88
disable = ["C0114", "C0116"]  # docstring warnings

[tool.mypy]
python_version = "3.12"
warn_return_any = true
warn_unused_configs = true
```

### pre-commitフック

**.pre-commit-config.yaml**:
```yaml
repos:
  - repo: https://github.com/psf/black
    rev: 23.3.0
    hooks:
      - id: black
  
  - repo: https://github.com/pycqa/isort
    rev: 5.12.0
    hooks:
      - id: isort
  
  - repo: https://github.com/pycqa/flake8
    rev: 6.0.0
    hooks:
      - id: flake8
  
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.3.0
    hooks:
      - id: mypy
```

### 継続的インテグレーション

**Makefile**:
```makefile
.PHONY: test lint format check

test:
	python -m pytest src/tests/ -v --cov=src

lint:
	pylint src/
	flake8 src/
	mypy src/

format:
	black src/
	isort src/

check: lint test
	echo "All checks passed!"

install-dev:
	pip install -r requirements_evaluation.txt
	pip install -r requirements_dev.txt
	pre-commit install
```

---

## 🚀 開発ワークフロー

### 日常的な開発フロー

1. **環境確認**:
   ```bash
   docker exec -it grpc-analyzer-evaluation bash
   python --version  # 3.12.4確認
   pip list | grep -E "(pandas|openai|anthropic)"
   ```

2. **コード変更**:
   ```bash
   # ローカルで編集
   vim src/evaluators/quality_evaluator.py
   
   # 静的解析
   make lint
   
   # フォーマット
   make format
   ```

3. **テスト**:
   ```bash
   # 単体テスト
   python -m pytest src/tests/unit/ -v
   
   # 統合テスト
   python -m pytest src/tests/integration/ -v -m "not slow"
   
   # デバッグ実行
   python main.py --mode dry-run --debug
   ```

4. **評価実行**:
   ```bash
   # 小規模テスト
   python main.py --mode compliance --limit 5
   
   # 本格実行
   python main.py --mode full
   ```

### トラブルシューティング手順

1. **ログ確認**:
   ```bash
   tail -f /app/logs/evaluation.log
   grep -i error /app/logs/*.log
   ```

2. **設定確認**:
   ```bash
   python -c "import json; print(json.dumps(config, indent=2))"
   ```

3. **依存関係確認**:
   ```bash
   pip check
   pip list --outdated
   ```

4. **リソース確認**:
   ```bash
   docker stats grpc-analyzer-evaluation
   df -h /app/
   ```

---

**作成日**: 2025-07-22  
**対象**: 開発者・技術者向け  
**更新**: 機能追加・変更時に随時更新
