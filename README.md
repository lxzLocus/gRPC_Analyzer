# gRPC LLMエージェントによる自動バグ修正システム

> ⚠️ **IMPORTANT**: The `main` branch must not be modified.  
> It corresponds to the exact implementation used for paper submission (2026-03).  
> Tag `paper-submission-2026-03` marks the frozen submission point.

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
| [BRANCH_OVERVIEW.md](BRANCH_OVERVIEW.md) | ブランチ一覧・FSM レベル・実験条件の研究マップ |
| [REPRODUCIBILITY.md](REPRODUCIBILITY.md) | 環境構築・実行手順・データセット・評価方法 |
| [docs/architecture.md](docs/architecture.md) | アーキテクチャ詳細・エントリーポイント・MVC構成・処理フロー |
| [docs/dataset.md](docs/dataset.md) | データセットのディレクトリ構造・プロンプト変数ファイル生成基準 |
| [docs/fsm.md](docs/fsm.md) | FSM（有限状態機械）の状態・遷移・タグ制御の詳細 |
| [docs/branches.md](docs/branches.md) | ブランチごとの FSM 実装バージョンの技術的な違い |
| [docs/design_jp.md](docs/design_jp.md) | 設計思想の詳細（日本語） |

---

## ブランチ構成

このリポジトリは研究アーカイブです。全ブランチは実験スナップショットとして凍結されています。

| ブランチ | FSM Level | 概要 |
|---------|:---------:|------|
| `main` ★ | Lv1 | **論文投稿版** — FSM 緩め制御（system-managed completion） |
| `baseline/prompt-5step` | Lv0 | プロンプト駆動ベースライン（旧 master） |
| `baseline/prompt-pr-title` | Lv0 | + PR タイトル埋め込み |
| `baseline/prompt-context-enhanced` | Lv0 | + コンテキスト要約強化 |
| `baseline/prompt-model-abtest` | Lv0 | + モデル/タイムアウト A/B テスト |
| `baseline/prompt-title-fix` | Lv0 | + タイトルパーサー修正 |
| `fsm-strict/selfrefine` | Lv2 | FSM 厳格 + Self-Refine パターン |
| `fsm-strict/integrated` | Lv2 | FSM 厳格 + バッチ処理統合 |
| `fsm-strict/evaluation` | Lv2 | FSM 厳格 + 評価システム統合 |

> 詳細は [BRANCH_OVERVIEW.md](BRANCH_OVERVIEW.md) を参照

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
