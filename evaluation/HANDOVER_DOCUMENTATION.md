# APR評価システム 引き継ぎドキュメント

## 📋 目次
1. [システム概要](#システム概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [環境構築](#環境構築)
4. [実行方法](#実行方法)
5. [評価フレームワーク](#評価フレームワーク)
6. [データフロー](#データフロー)
7. [設定とカスタマイズ](#設定とカスタマイズ)
8. [トラブルシューティング](#トラブルシューティング)
9. [開発継続のガイド](#開発継続のガイド)

---

## システム概要

### 目的
LLMベースのAPR（Automatic Program Repair）システムが生成したパッチの品質を、グラウンドトゥルースと比較して自動評価するシステム。

### 主要機能
- **2段階評価フレームワーク**
  - Step 1: システム適合性評価（制御フロー、パーサー精度）
  - Step 2: パッチ品質評価（妥当性、正確性R1-R10、推論品質）
- **LLM統合評価**: OpenAI/Anthropic APIを使用した高度な評価
- **統計分析**: pandas/matplotlib/seabornによる詳細な分析とレポート生成
- **Dockerコンテナ化**: 環境の一貫性と再現性の確保

---

## アーキテクチャ

### コンテナ構成
```
docker-compose.yml
├── dev                  # 開発環境
├── grpc-analyzer-node  # 本番APRシステム
└── evaluation-system   # Python評価システム（★このシステム）
```

### ディレクトリ構造
```
/app/evaluation/                    # 評価システムルート
├── main.py                        # メインエントリーポイント
├── Dockerfile_evaluation          # Dockerファイル
├── requirements_evaluation.txt    # Python依存関係
├── README.md                      # 基本説明
├── HANDOVER_DOCUMENTATION.md      # 本ドキュメント
├── DEVELOPMENT_GUIDE.md           # 開発ガイド
├── API_SPECIFICATION.md           # API仕様書
├── SYSTEM_SPECIFICATION.md       # システム仕様書
├── evaluation-design/             # 評価設計
│   ├── integrated-evaluation-system.md
│   ├── step1-system-compliance-evaluator.md
│   ├── step2-patch-quality-evaluator.md
│   └── prompt-templates/
│       ├── system-compliance-evaluation.txt
│       └── patch-quality-evaluation.txt
├── src/                           # ソースコード
│   ├── evaluators/
│   ├── analyzers/
│   ├── llm/
│   ├── reporters/
│   ├── utils/
│   └── tests/
├── config/                        # 設定ファイル
├── results/                       # 評価結果出力
├── logs/                          # ログファイル
├── apr-logs/                      # APRログ（読み取り専用マウント）
├── apr-output/                    # APR結果（読み取り専用マウント）
└── dataset/                       # データセット（読み取り専用マウント）
```

### データマッピング（ホストOS → コンテナ）
```
F:/Workspace/gRPC_Analyzer/evaluation → /app/         # 評価システム完全版
F:/Workspace/gRPC_Analyzer/dataset   → /app/dataset   # データセット（読み取り専用）
F:/Workspace/gRPC_Analyzer/log       → /app/apr-logs  # APRログ（読み取り専用）
F:/Workspace/gRPC_Analyzer/output    → /app/apr-output # APR結果（読み取り専用）
```

---

## 環境構築

### 前提条件
- **ホストOS**: Windows/Linux（dev container対応）
- **Docker**: Docker Compose v2.0+
- **Python**: 3.12.4（コンテナ内）
- **ホストパス**: `F:/Workspace/gRPC_Analyzer/` が利用可能

### セットアップ手順

1. **リポジトリの準備**
   ```bash
   cd /app/.docker
   ```

2. **コンテナビルド**
   ```bash
   ./manage.sh build
   ```

3. **環境テスト**
   ```bash
   ./manage.sh eval-dry-run
   ```

4. **設定確認**
   ```bash
   ./manage.sh eval-setup
   ```

---

## 実行方法

### 基本コマンド（manage.shを使用）

```bash
# 評価システムの起動
./manage.sh eval-run

# ドライラン（設定確認）
./manage.sh eval-dry-run

# セットアップ確認
./manage.sh eval-setup

# データリセット
./manage.sh reset

# ログ確認
./manage.sh logs evaluation-system
```

### 直接実行（コンテナ内）

```bash
# コンテナに入る
docker exec -it grpc-analyzer-evaluation bash

# 評価実行
python main.py --mode full --output-format json

# 特定の評価のみ
python main.py --mode compliance --project servantes
python main.py --mode quality --dataset filtered_confirmed
```

### 評価モード

| モード | 説明 | 実行時間 |
|--------|------|----------|
| `setup` | 環境確認・初期設定 | 1-2分 |
| `compliance` | システム適合性評価のみ | 5-10分 |
| `quality` | パッチ品質評価のみ | 15-30分 |
| `full` | 完全評価（両段階） | 20-40分 |
| `dry-run` | 設定確認（実際の評価なし） | 1分 |

---

## 評価フレームワーク

### Step 1: システム適合性評価

**目的**: APRシステムの基本機能検証

**評価項目**:
- 制御フロー解析精度
- コードパーサー正確性
- ファイル処理能力
- エラーハンドリング

**評価方法**:
```python
# 実装例
from src.evaluators.compliance_evaluator import ComplianceEvaluator

evaluator = ComplianceEvaluator()
results = evaluator.evaluate_project('servantes')
```

### Step 2: パッチ品質評価

**目的**: 生成パッチの実質的品質測定

**評価項目**:
- **妥当性**: 構文・意味的正確性
- **正確性R1-R10**: グラウンドトゥルースとの一致度
- **推論品質**: LLMの推論プロセス評価

**評価方法**:
```python
# 実装例
from src.evaluators.quality_evaluator import QualityEvaluator

evaluator = QualityEvaluator(llm_provider='openai')
results = evaluator.evaluate_patches(patch_data, ground_truth)
```

### LLM統合評価

**サポートプロバイダー**:
- OpenAI (GPT-4, GPT-3.5-turbo)
- Anthropic (Claude-3)

**プロンプトテンプレート**:
- `evaluation-design/prompt-templates/system-compliance-evaluation.txt`
- `evaluation-design/prompt-templates/patch-quality-evaluation.txt`

---

## データフロー

### 入力データ
1. **データセット**: `dataset/` 配下のCSVファイル
   - `gRPC_reps_list.csv`: プロジェクト一覧
   - `P.U_merged_filtered - Final_merged_only_not_excluded_yes_ms_unarchived_commit_hash v2.0.csv`: メインデータ

2. **APRログ**: `apr-logs/` 配下
   - プロジェクト別実行ログ
   - エラー・警告情報

3. **APR結果**: `apr-output/` 配下
   - 生成パッチファイル
   - 処理サマリー

### 出力データ
1. **評価結果**: `results/` 配下
   - `evaluation_report_YYYY-MM-DDTHH-MM-SS.json`: 詳細レポート
   - `summary_statistics_YYYY-MM-DDTHH-MM-SS.json`: 統計サマリー

2. **可視化**: `results/charts/` 配下
   - 統計グラフ（PNG/PDF）
   - 比較チャート

### 処理フロー
```
データセット読み込み → APR結果解析 → Step1評価 → Step2評価 → レポート生成 → 可視化
```

---

## 設定とカスタマイズ

### 環境変数

```bash
# 必須
PYTHONPATH=/app
EVALUATION_MODE=production

# オプション（LLM API）
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

### 設定ファイル

**config/evaluation_config.json**:
```json
{
  "evaluation": {
    "step1_enabled": true,
    "step2_enabled": true,
    "llm_provider": "openai",
    "model": "gpt-4",
    "timeout": 300
  },
  "output": {
    "format": "json",
    "include_charts": true,
    "chart_format": "png"
  },
  "data": {
    "batch_size": 10,
    "parallel_workers": 4
  }
}
```

### カスタマイズポイント

1. **評価メトリクス追加**: `src/evaluators/` 配下に新しい評価器を追加
2. **LLMプロバイダー追加**: `src/llm/` 配下にプロバイダー実装
3. **レポート形式**: `src/reporters/` でレポート生成器をカスタマイズ
4. **可視化**: `src/visualizers/` でチャート生成を拡張

---

## トラブルシューティング

### よくある問題

**1. パス関連エラー**
```
ERROR: Required directory not found: /app/apr-logs
```
**解決策**: docker-compose.ymlのボリュームマッピング確認

**2. LLM API エラー**
```
OpenAI API rate limit exceeded
```
**解決策**: API キー確認、レート制限の調整

**3. メモリ不足**
```
MemoryError during batch processing
```
**解決策**: バッチサイズを小さく設定、並列度を下げる

### ログ確認

```bash
# 評価システムログ
./manage.sh logs evaluation-system

# 特定エラーの検索
docker exec grpc-analyzer-evaluation grep -r "ERROR" /app/logs/

# パフォーマンス確認
docker exec grpc-analyzer-evaluation ls -la /app/logs/performance/
```

### デバッグモード

```bash
# デバッグ実行
python main.py --debug --verbose --log-level DEBUG

# 単体テスト
python -m pytest src/tests/ -v
```

---

## 開発継続のガイド

### 重要な実装ファイル

1. **main.py**: エントリーポイント、コマンドライン処理
2. **src/evaluators/**: 評価ロジック
3. **src/analyzers/**: データ解析
4. **src/reporters/**: レポート生成
5. **evaluation-design/**: 評価設計仕様

### 拡張ポイント

**新しい評価メトリクス追加**:
```python
# src/evaluators/custom_evaluator.py
class CustomEvaluator(BaseEvaluator):
    def evaluate(self, data):
        # カスタム評価ロジック
        pass
```

**新しいLLMプロバイダー**:
```python
# src/llm/custom_provider.py
class CustomLLMProvider(BaseLLMProvider):
    def generate_evaluation(self, prompt):
        # カスタムLLM統合
        pass
```

### テスト戦略

```bash
# 単体テスト
python -m pytest src/tests/unit/ -v

# 統合テスト
python -m pytest src/tests/integration/ -v

# エンドツーエンドテスト
./manage.sh eval-dry-run
```

### パフォーマンス最適化

1. **並列処理**: `config/evaluation_config.json` の `parallel_workers`
2. **バッチサイズ**: `batch_size` の調整
3. **キャッシング**: 中間結果のキャッシュ機能
4. **メモリ管理**: 大量データ処理時のメモリ効率化

### 運用監視

```bash
# リソース監視
docker stats grpc-analyzer-evaluation

# 評価進行状況
tail -f /app/logs/evaluation.log

# エラー監視
grep -i error /app/logs/*.log
```

---

## 🚀 クイックスタート（新規引き継ぎ者向け）

1. **環境確認**:
   ```bash
   cd /app/.docker
   ./manage.sh eval-setup
   ```

2. **テスト実行**:
   ```bash
   ./manage.sh eval-dry-run
   ```

3. **小規模評価**:
   ```bash
   ./manage.sh eval-run --mode compliance --limit 5
   ```

4. **結果確認**:
   ```bash
   ls -la F:/Workspace/gRPC_Analyzer/evaluation/results/
   ```

5. **ドキュメント詳読**:
   - `evaluation-design/integrated-evaluation-system.md`
   - `DEVELOPMENT_GUIDE.md`

---

## 📞 サポート・リソース

### 設計ドキュメント
- `evaluation-design/`: 詳細な評価フレームワーク設計
- `docs/`: 追加の技術文書

### ログファイル
- `logs/evaluation.log`: メイン実行ログ
- `logs/performance/`: パフォーマンス計測
- `logs/errors/`: エラー詳細

### 設定ファイル
- `config/evaluation_config.json`: メイン設定
- `requirements_evaluation.txt`: Python依存関係
- `docker-compose.yml`: コンテナ設定

---

**作成日**: 2025-07-22  
**バージョン**: 1.0  
**対象システム**: gRPC_Analyzer APR評価システム
