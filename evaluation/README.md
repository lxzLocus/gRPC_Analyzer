# APR評価システム - クイックスタートガイド

## 📋 概要

このディレクトリには、LLMベースのAPR (Automatic Program Repair) システムの包括的な評価機能が含まれています。2段階評価フレームワークにより、システムの適合性とパッチ品質を定量的・定性的に評価します。

## 🚀 クイックスタート

### 1. 環境確認
```bash
cd /app/.docker
./manage.sh eval-setup
```

### 2. テスト実行
```bash
./manage.sh eval-dry-run
```

### 3. 小規模評価
```bash
./manage.sh eval-run --mode compliance --limit 10
```

### 4. 完全評価
```bash
./manage.sh eval-run --mode full
```

## 📁 ディレクトリ構造

```
## 📁 ディレクトリ構造

```text
/app/
├── main.py                        # メインエントリーポイント
├── src/                           # コアライブラリ
│   ├── cli/                       # コマンドラインツール
│   │   ├── real_llm_evaluator.py  # メイン評価エンジン
│   │   ├── evaluation_log_viewer.py # ログ詳細表示
│   │   ├── llm_response_viewer.py  # LLM応答詳細表示
│   │   ├── verification_report.py  # レポート生成
│   │   ├── verify_single_repo.py   # 単一リポ検証
│   │   ├── run_full_evaluation.sh  # 全ログ評価（推奨）
│   │   └── run_real_llm_evaluation.sh # 学習・テスト用
│   ├── analysis/                  # 分析ツール
│   │   ├── analyze_evaluation_results.py # 評価結果分析
│   │   ├── detailed_analysis.py    # 詳細分析
│   │   ├── full_dataset_evaluation.py # 大規模データセット評価
│   │   ├── apr_dataset_analyzer.py # APRデータセット分析
│   │   ├── enhanced_apr_analyzer.py # 拡張APR分析
│   │   └── task_category_classifier.py # タスク分類
│   ├── demo/                      # デモンストレーション
│   │   └── demo_openai_models.py   # OpenAI接続テスト
│   ├── evaluators/                # 評価器
│   │   ├── compliance_evaluator.py # システム適合性評価
│   │   ├── quality_evaluator.py    # 品質評価
│   │   └── integrated_evaluator.py # 統合評価
│   ├── llm/                       # LLM統合
│   │   └── llm_integration.py      # LLM接続・管理
│   ├── utils/                     # ユーティリティ
│   │   ├── log_parser.py           # ログ解析
│   │   ├── log_iterator.py         # ログ反復処理
│   │   └── template_manager.py     # テンプレート管理
│   └── tests/                     # テストコード
│   ├── evaluators/
│   ├── analyzers/
│   ├── llm/
│   ├── reporters/
│   ├── utils/
│   └── tests/
├── logs/                          # 評価ログ
│   ├── evaluation_results_*.json
│   ├── error_reports_*.json
│   └── processing_summaries_*.json
├── apr-logs/                      # APRデータセット
├── apr-output/                    # 評価出力
├── config/                        # 設定ファイル
├── dataset/                       # データセット
├── results/                       # 評価結果
└── docs/                          # ドキュメント
    ├── HANDOVER_DOCUMENTATION.md  # 引き継ぎドキュメント（重要）
    ├── DEVELOPMENT_GUIDE.md       # 開発者ガイド
    ├── API_SPECIFICATION.md       # API仕様書
    ├── SYSTEM_SPECIFICATION.md    # システム仕様書
    ├── SYSTEM_FILE_DOCUMENTATION.md # ファイル構成説明
    └── FILE_DEPENDENCY_DIAGRAM.md # 依存関係図
```
├── apr-logs/                      # 入力APRログ（86件）
├── logs/                          # 評価ログ出力
├── output/
│   └── verification_results/          # 評価結果
├── config/                        # 設定ファイル
├── evaluation-design/             # 評価設計
├── Dockerfile_evaluation          # Docker設定
└── requirements_evaluation.txt    # Python依存関係
│   ├── utils/
│   └── tests/
├── config/                        # 設定ファイル
├── results/                       # 評価結果出力
├── logs/                          # ログファイル
├── apr-logs/                      # APRログ（読み取り専用）
├── apr-output/                    # APR結果（読み取り専用）
└── dataset/                       # データセット（読み取り専用）
```

## ⚙️ 主要コマンド

### 🎯 統合コマンドライン

```bash
# APR評価実行
python main.py evaluate --repo boulder --max-logs 3 --provider openai --model gpt-4.1-mini

# 結果分析
python main.py analyze --input-dir /app/output/verification_results

# ログ表示
python main.py view --log-file /app/logs/evaluation.log

# デモ実行
python main.py demo --model gpt-4.1-mini
```

### 🔥 全ログ評価（推奨）

**すべてのAPRログ（86ログ）を評価したい場合**:

```bash
# 全ログ一括評価（推奨）
bash src/cli/run_full_evaluation.sh

# または個別プロジェクト評価
python src/cli/real_llm_evaluator.py --repo boulder --max-logs 999 --provider openai --model gpt-4.1-mini
python src/cli/real_llm_evaluator.py --repo daos --max-logs 999 --provider openai --model gpt-4.1-mini
# ...全11プロジェクト
```

**学習・テスト用ガイド**:

```bash
bash scripts/run_real_llm_evaluation.sh
```

**評価モード選択**:

- 🎭 **Mock LLM**: テスト用・高速・無料
- 💰 **gpt-4.1-mini**: 高品質・低コスト（全86ログで約$0.15）
- 🎯 **gpt-4.1**: 最高品質・高コスト（全86ログで約$3.87）

### manage.sh スクリプト使用

```bash
# コンテナビルド
./manage.sh build

# 評価実行
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

# 基本評価
python main.py --mode full

# 特定モード
python main.py --mode compliance --project servantes
python main.py --mode quality --dataset filtered_confirmed

# デバッグモード
python main.py --debug --verbose --log-level DEBUG
```

## 🎯 評価モード

| モード | 説明 | 実行時間 |
|--------|------|----------|
| `setup` | 環境確認・初期設定 | 1-2分 |
| `compliance` | システム適合性評価のみ | 5-10分 |
| `quality` | パッチ品質評価のみ | 15-30分 |
| `full` | 完全評価（両段階） | 20-40分 |
| `dry-run` | 設定確認（実際の評価なし） | 1分 |

## 📊 出力結果

### 評価結果
- **場所**: `/app/results/`
- **形式**: JSON, CSV, HTML
- **内容**: 詳細メトリクス、統計サマリー

### 可視化
- **場所**: `/app/results/charts/`
- **形式**: PNG, PDF
- **内容**: 統計グラフ、比較チャート

## ⚠️ 重要な設定

### 環境変数
```bash
PYTHONPATH=/app                    # 必須
EVALUATION_MODE=production         # 必須
OPENAI_API_KEY=your_key_here      # OpenAI使用時
ANTHROPIC_API_KEY=your_key_here   # Anthropic使用時
```

### ホストパスマッピング
```
F:/Workspace/gRPC_Analyzer/evaluation → /app/
F:/Workspace/gRPC_Analyzer/dataset   → /app/dataset
F:/Workspace/gRPC_Analyzer/log       → /app/apr-logs
F:/Workspace/gRPC_Analyzer/output    → /app/apr-output
```

## 🆘 トラブルシューティング

### よくある問題

1. **パス関連エラー**
   ```bash
   # 解決策: docker-compose.ymlのボリュームマッピング確認
   ERROR: Required directory not found: /app/apr-logs
   ```

2. **LLM API エラー**
   ```bash
   # 解決策: API キー確認、レート制限の調整
   OpenAI API rate limit exceeded
   ```

3. **メモリ不足**
   ```bash
   # 解決策: バッチサイズを小さく設定
   MemoryError during batch processing
   ```

### ログ確認
```bash
# 評価ログ
./manage.sh logs evaluation-system

# エラー検索
docker exec grpc-analyzer-evaluation grep -r "ERROR" /app/logs/

# パフォーマンス確認
docker exec grpc-analyzer-evaluation ls -la /app/logs/performance/
```

## 📚 詳細ドキュメント

- **🎯 新規引き継ぎ**: `HANDOVER_DOCUMENTATION.md` - **必読**
- **🛠️ 開発継続**: `DEVELOPMENT_GUIDE.md`
- **📚 API使用**: `API_SPECIFICATION.md`
- **📊 仕様詳細**: `SYSTEM_SPECIFICATION.md`
- **🎨 評価設計**: `evaluation-design/`

## 🚀 始めてみよう

**新規引き継ぎ者の方へ**:

1. **必読ドキュメント**: `HANDOVER_DOCUMENTATION.md`
2. **環境確認**: `./manage.sh eval-setup`
3. **テスト実行**: `./manage.sh eval-dry-run`
4. **小規模評価**: `./manage.sh eval-run --mode compliance --limit 5`

**開発者の方へ**:

1. **開発ガイド**: `DEVELOPMENT_GUIDE.md`
2. **API仕様**: `API_SPECIFICATION.md`
3. **テスト**: `python -m pytest src/tests/ -v`

---

**作成日**: 2025-07-22  
**バージョン**: 1.0  
**システム**: gRPC_Analyzer APR評価システム
cd /app/.docker
./manage.sh build

# 評価実行
./manage.sh eval-all

# 評価システムシェル
./manage.sh shell evaluation-system
```

### 評価システム内で直接実行
```bash
# 全評価実行
python main.py --step all

# 個別評価
python main.py --step 1  # システム仕様準拠性
python main.py --step 2  # パッチ品質

# 環境チェック
python main.py --dry-run
```

## 📊 評価フロー

1. **ステップ1**: システム仕様準拠性評価
   - APRログ（`/app/apr-logs/`）を分析
   - 制御フロー、パーサー精度、エラーハンドリングを評価
   - 結果: `/app/results/step1/`

2. **ステップ2**: パッチ品質評価
   - データセット（`/app/dataset/`）とAPR結果（`/app/apr-output/`）を比較
   - Plausibility、Correctness、Reasoning Qualityを評価
   - 結果: `/app/results/step2/`

3. **統合レポート**: 包括的な評価レポート生成
   - 結果: `/app/results/comprehensive_*.json`

## 🔧 設定

### 環境変数
- `PYTHONPATH=/app`
- `EVALUATION_MODE=production`

### 入力データ
- **APRログ**: `/app/apr-logs/` (F:\Workspace\gRPC_Analyzer\log)
- **APR結果**: `/app/apr-output/` (F:\Workspace\gRPC_Analyzer\output)
- **データセット**: `/app/dataset/` (F:\Workspace\gRPC_Analyzer\dataset)

### 出力データ
- **評価結果**: `/app/results/` (F:\Workspace\gRPC_Analyzer\evaluation\results)

## 🛠️ 開発

### ローカル開発
```bash
# 評価ディレクトリで作業
cd /app/evaluation

# 依存関係インストール
pip install -r requirements_evaluation.txt

# テスト実行
python main.py --dry-run
```

### 新しい評価器追加
1. `step3_*.py` などの新しいモジュール作成
2. `main.py` に統合
3. プロンプトテンプレート追加
