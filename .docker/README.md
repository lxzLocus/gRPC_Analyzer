# APR + 評価システム統合環境

既存のAPRシステム（dev + grpc-analyzer-node）に評価システムを追加したDocker環境です。

## 🏗️ アーキテクチャ

```
┌─────────────────────┐    ┌─────────────────────┐
│   dev コンテナ       │    │ evaluation-system   │
│  (開発環境)          │    │   (評価システム)     │
│                     │    │    (Python)         │
└─────────────────────┘    └─────────────────────┘
                                      │
┌─────────────────────┐              │
│ grpc-analyzer-node  │              │
│ (本番実験用環境)     │              │
│ • 大規模データセット │ ─────────────┘
│ • フルパスバインド   │
│ • Node.js/TypeScript│
└─────────────────────┘

共有データ:
• dataset/ (読み取り専用 → 評価)
• log/ (grpc-analyzer-node → 評価)
• output/ (grpc-analyzer-node → 評価)
```

## 🐳 サービス構成

### dev
- **用途**: 開発環境（現在の主要作業環境）
- **技術**: Node.js + TypeScript
- **役割**: コード開発・テスト

### grpc-analyzer-node
- **用途**: 本番実験用環境（大規模データセット処理）
- **技術**: Node.js + TypeScript
- **特徴**: 全データセットサブフォルダをバインド
- **役割**: 本格的なAPR実行

### evaluation-system
- **用途**: APR評価システム（新規追加）
- **技術**: Python
- **役割**: システム評価 + パッチ品質評価

## 🚀 クイックスタート

### 1. 環境構築

```bash
# プロジェクトルートで実行
cd /app/.docker

# コンテナビルド
./manage.sh build

# サービス起動
./manage.sh up
```

### 2. APR実行

```bash
# テストデータで実行
./manage.sh run-apr-test

# 本格データで実行  
./manage.sh run-apr
```

### 3. 評価実行

```bash
# 全評価実行
./manage.sh eval-all

# 個別実行
./manage.sh eval-step1  # システム仕様準拠性
./manage.sh eval-step2  # パッチ品質
```

## 📁 ディレクトリ構造（ホストOS: E:\F\Workspace\gRPC_Analyzer）

```
E:\F\Workspace\gRPC_Analyzer\     # ホストOS
├── .docker/                    # Docker設定
│   ├── docker-compose.yml      # サービス定義
│   ├── Dockerfile_*            # 各種Dockerfile
│   ├── requirements_*.txt      # 依存関係
│   └── manage.sh               # 管理スクリプト
│
├── src/                        # APRシステムソース
├── evaluation/                 # 評価システムソース
│   └── main.py                 # 評価メインスクリプト
│
├── dataset/                    # データセット（読み取り専用）
├── log/                        # APRログ（APR→評価）
├── output/                     # APR結果（APR→評価）
├── evaluation-results/         # 評価結果専用
└── evaluation-design/          # 評価設計ドキュメント
```

### ボリュームマッピング

**grpc-analyzer-node（本番環境）:**
- `E:\Workspace\gRPC_Analyzer\dataset\*` → `/app/dataset/*`
- 全データセットサブフォルダを個別バインド

**evaluation-system（評価環境）:**
- `E:\F\Workspace\gRPC_Analyzer\dataset` → `/app/dataset` (読み取り専用)
- `E:\F\Workspace\gRPC_Analyzer\log` → `/app/log` (読み取り専用)
- `E:\F\Workspace\gRPC_Analyzer\output` → `/app/output` (読み取り専用)
- `E:\F\Workspace\gRPC_Analyzer\evaluation-results` → `/app/evaluation-results`

## 🐳 サービス構成

### apr-system
- **用途**: gRPC Analyzer（既存APRシステム）
- **技術**: Node.js + TypeScript
- **役割**: LLMベースの自動プログラム修復

### evaluation-system  
- **用途**: APR評価システム（新規）
- **技術**: Python
- **役割**: システム評価 + パッチ品質評価

### dev
- **用途**: 開発環境
- **技術**: Node.js
- **役割**: 開発・デバッグ用

## 📊 評価フロー

### Phase 1: APR実行
```bash
./manage.sh run-apr
```
- dataset/filtered_commit を処理
- log/ にログ出力
- output/ に結果出力

### Phase 2: 評価実行
```bash
./manage.sh eval-all
```

**ステップ1**: システム仕様準拠性評価
- 制御フロー準拠性
- パーサー精度  
- エラーハンドリング

**ステップ2**: パッチ品質評価
- Plausibility（適用可能性）
- Correctness（正確性: R1-R10）
- Reasoning Quality（推論品質）

**最終**: 統合レポート生成
- 総合パフォーマンス分析
- 改善推奨事項

## 🛠️ 管理コマンド

### 基本操作
```bash
./manage.sh build          # コンテナビルド
./manage.sh up             # サービス起動
./manage.sh down           # サービス停止
./manage.sh status         # 状態確認
```

### APR操作
```bash
./manage.sh run-apr        # grpc-analyzer-nodeで本格バッチ処理
./manage.sh run-apr-test   # grpc-analyzer-nodeでテストデータ処理
```

### 開発操作  
```bash
./manage.sh shell dev                # 開発環境シェル
./manage.sh shell grpc-analyzer-node # 本番環境シェル
```

### 評価操作
```bash
./manage.sh eval-all       # 全評価実行
./manage.sh eval-step1     # 仕様準拠性評価のみ
./manage.sh eval-step2     # パッチ品質評価のみ
./manage.sh eval-dry-run   # 環境チェック
```

### ユーティリティ
```bash
./manage.sh shell evaluation-system  # 評価システムシェル
./manage.sh shell dev                # 開発環境シェル
./manage.sh shell grpc-analyzer-node # 本番環境シェル
./manage.sh logs grpc-analyzer-node  # 本番APRログ表示
./manage.sh clean                    # クリーンアップ
./manage.sh reset                    # データリセット（注意）
```

## 🔧 設定

### 環境変数
APRシステム用:
```bash
OPENAI_TOKEN=your_openai_token
NODE_ENV=production
```

評価システム用:
```bash
PYTHONPATH=/app
EVALUATION_MODE=production
```

### ボリューム設定
- `dataset/`: 読み取り専用バインド
- `log/`: APRが書き込み、評価が読み取り
- `output/`: APRが書き込み、評価が読み取り  
- `evaluation-results/`: 評価専用書き込み

## 📈 結果確認

### APR結果
```
E:\F\Workspace\gRPC_Analyzer\output\
├── processing_summary_*.json    # 処理サマリー
├── error_report_*.json          # エラーレポート
└── backups/                     # バックアップ
```

### 評価結果
```
E:\F\Workspace\gRPC_Analyzer\evaluation-results\
├── step1/                       # 仕様準拠性評価
│   └── compliance_evaluation_*.json
├── step2/                       # パッチ品質評価
│   └── quality_evaluation_*.json
└── comprehensive_report_*.json  # 統合レポート
```

## 🚨 トラブルシューティング

### よくある問題

1. **ポート競合**
   ```bash
   ./manage.sh down
   ./manage.sh clean
   ```

2. **ディスク容量不足**
   ```bash
   docker system prune -a
   ```

3. **権限エラー**
   ```bash
   sudo chown -R $USER:$USER /app/evaluation-results
   ```

### ログ確認
```bash
# APRログ
./manage.sh logs apr-system

# 評価ログ
./manage.sh logs evaluation-system

# 全ログ
./manage.sh logs
```

## 🔄 ワークフロー例

完全な評価実行例:
```bash
# 1. 環境準備
./manage.sh build
./manage.sh up

# 2. APR実行（grpc-analyzer-nodeで約3時間）
./manage.sh run-apr

# 3. 評価実行（約30分）
./manage.sh eval-all

# 4. 結果確認
ls -la E:/F/Workspace/gRPC_Analyzer/evaluation-results/

# 5. クリーンアップ
./manage.sh down
```
