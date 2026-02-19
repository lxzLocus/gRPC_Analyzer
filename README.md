# gRPC LLMエージェントによる自動バグ修正システム

gRPCベースのマイクロサービスにおいて、`.proto` ファイルの変更に起因するバグを LLM エージェントが自動で検出・修正するシステム。

---

## 概要

- **目的**: `.proto` スキーマ変更に伴う手書きコードの修正漏れを、LLM（GPT / Gemini）を用いて自動的に検出・修正する
- **手法**: 高品質なコンテキスト生成 → FSM（有限状態機械）制御の LLM 対話ループ → Diff 適用・検証
- **アーキテクチャ**: ESM + MVC (TypeScript)

> 詳細な設計思想・ワークフローは [docs/architecture.md](docs/architecture.md) を参照

---

## クイックスタート

### 前提条件

- Node.js 18+
- OpenAI API Key（または Gemini API Key）

### セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .env を編集して API キーを設定

# TypeScript のコンパイル
npm run build
```

### 必要な環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `OPENAI_API_KEY` | OpenAI API キー | `sk-proj-...` |
| `GEMINI_API_KEY` | Gemini API キー（オプション） | `AIza...` |
| `LLM_PROVIDER` | 使用する LLM プロバイダー | `openai` / `gemini` |

### 実行

```bash
# テストデータセットで実行（推奨）
node scripts/MainScript.js 4 /tmp/output

# デフォルト設定で実行
node scripts/MainScript.js

# ヘルプ表示
node scripts/MainScript.js --help
```

### 利用可能なデータセット

| Index | パス | 説明 |
|-------|------|------|
| 0 | `dataset/filtered_fewChanged` | 少数変更ファイル（デフォルト） |
| 1 | `dataset/filtered_confirmed` | 確認済みデータ |
| 2 | `dataset/filtered_commit` | コミット履歴データ |
| 3 | `dataset/filtered_protoChanged` | プロトコル変更データ |
| 4 | `dataset/test` | テスト用データ |

---

## プロジェクト構造

```
/app/
├── scripts/
│   └── MainScript.js            # 🎯 メインエントリーポイント
├── src/
│   ├── Controller/Controller.js  # MVC 統合レイヤー
│   ├── controllers/              # Controller 層
│   ├── Service/                  # Service 層（ビジネスロジック）
│   ├── Repository/               # Repository 層（データアクセス）
│   ├── views/                    # View 層（進捗表示）
│   ├── models/                   # Model 層（データ構造）
│   ├── modules/                  # コアモジュール（FSM, LLM, ファイル操作）
│   ├── prompts/                  # LLM プロンプトテンプレート
│   ├── types/                    # TypeScript 型定義
│   └── utils/                    # ユーティリティ
├── config/config.json            # システム設定
├── dataset/                      # 実験データセット
├── evaluation/                   # 評価システム（独立コンテナ）
├── patchEvaluation/              # パッチ評価システム（独立）
├── docs/                         # 📖 詳細ドキュメント
├── dist/js/                      # コンパイル済み JS（ESM 出力）
├── output/                       # 処理結果出力
└── logs/                         # 実行ログ
```

> 各コンポーネントの詳細は [docs/architecture.md](docs/architecture.md) を参照

---

## ドキュメント一覧

| ドキュメント | 内容 |
|-------------|------|
| [docs/architecture.md](docs/architecture.md) | アーキテクチャ詳細・エントリーポイント・MVC構成・処理フロー |
| [docs/dataset.md](docs/dataset.md) | データセットのディレクトリ構造・プロンプト変数ファイル生成基準 |
| [docs/fsm.md](docs/fsm.md) | FSM（有限状態機械）の状態・遷移・タグ制御の詳細 |
| [docs/branches.md](docs/branches.md) | ブランチ一覧と各ブランチの FSM 実装バージョンの違い |
| [docs/design_jp.md](docs/design_jp.md) | 設計思想の詳細（日本語） |

---

## ブランチ構成

| ブランチ | 概要 |
|---------|------|
| `master` | メインブランチ（基本 LLM 対話ループ） |
| `experiment/fsm-implementation` | **論文投稿最終版** — FSM による状態遷移制御を実装 |
| `Feature_SelfRefine` | Self-Refine パターン（セッション管理・自己改善ループ） |
| `feature/Evaluation_FSM` | FSM + 評価システム統合版 |
| その他 | 実験用ブランチ各種 |

> 詳細は [docs/branches.md](docs/branches.md) を参照

---

## 開発

```bash
# 開発時の自動コンパイル
npm run dev

# ビルド
npm run build

# クリーン
npm run clean
```

すべてのファイルは **ESM 形式** に統一されています（`"type": "module"`）。

---

## ライセンス

MIT License — [LICENSE](./LICENSE) を参照
