# gRPC LLMエージェントによる自動バグ修正システム設計ドキュメント

---

## 1. プロジェクト目的

gRPCベースのマイクロサービスにおいて、`.proto`ファイルの変更に起因するバグを  
LLMエージェントが自動で検出・修正するシステムを構築する。

---

## 2. コア課題と基本方針

- gRPCは多言語対応のため、従来の静的解析による依存関係追跡はコスト・保守性の面で非現実的。
- LLMを「自律的なエージェント」として活用し、
  - 高品質なコンテキストを戦略的に与える
  - 「Think→Plan→Act」サイクルを強制
  - 必要に応じて追加情報を動的に取得できる
  という設計思想を採用。

---

## 3. システム構成

- **コンテキスト生成パイプライン**  
  コミット前後のスナップショットから、LLMが初期分析に使う構造化JSON（master_context.json）を生成。
- **LLM対話ループ**  
  LLMのリクエストに応じて情報提供・修正適用を繰り返すステートフルな制御プログラム。

---

## 4. 詳細ワークフロー

### 4.1 コンテキスト生成

- **入力**: premerge/mergeディレクトリ
- **出力**: master_context.json（directory_structure, categorized_changed_files）
- **主な処理**
  - .proto差分抽出
  - 変更ファイルリストのノイズ除去
  - 「疑わしいファイル」選定（ファイル名・proto関連語・変更有無によるスコアリング）
  - 上位N件のpre-change内容を抽出
  - 重要ファイル周辺のディレクトリ構造をBFSでスニペット化し、最終的に統合

### 4.2 LLM対話ループ

- **プロンプト設計**
  - 初期プロンプト、追加情報、修正成功/失敗時のテンプレートを使い分け
- **タグベース制御**
  - `%_Thought_%`（分析）、`%_Plan_%`（計画）、`%_Reply Required_%`（追加情報要求）、`%_Modified_%`（修正案）、`%%_Fin_%%`（完了）で分岐
- **ループ処理**
  - LLMのタグに応じて情報提供・修正適用・エラー対応を繰り返し、`%%_Fin_%%`で終了

---

## 5. 技術的特徴

- 静的解析に頼らず、LLMの動的探索力＋高品質コンテキストで多言語gRPCの修正を実現
- 「疑わしいファイル」選定のスコアリングは、proto差分の語彙を活用し、静的解析不要で関連性を高めている
- LLMの出力をタグで制御し、状態遷移を明確化した堅牢な対話ループ設計
- master_context.jsonの設計がLLMパフォーマンスの鍵

---

## 6. データセット構成例

```
dataset/
└── PROJECT_NAME/
    └── pullrequest/ または issue/
        └── PULLREQUEST_NAME/
            ├── premerge_xxx/         # コミット前のスナップショット（LLM修正フローの入力）
            ├── merge_xxx/            # コミット後のスナップショット（diff計算や評価用）
            ├── commit_snapshot_xxx/  # その他のスナップショット（必要に応じて利用）
            ├── 01_proto.txt
            ├── 02_protoFileChanges.txt
            ├── 03_fileChanges.txt
            ├── 04_surroundedFilePaths.txt
            └── 05_suspectedFiles.txt
```

- **PROJECT_NAME**: 対象プロジェクト名
- **pullrequest/issue**: PRかIssueかの区分
- **PULLREQUEST_NAME**: PRやIssueのタイトルやID
- **premerge_xxx/**: LLMエージェントが修正対象とする入力ディレクトリ
- **merge_xxx/**: 修正後の状態（diffや自動評価で利用）
- **commit_snapshot_xxx/**: その他のスナップショット（任意）
- **01〜05_xxx.txt**: 各種コンテキスト・差分・疑わしいファイルリスト等

---

## 7. 実装状況

- TypeScript/ESMでllmFlowController, llmFlowBatchRunner等の主要モジュールを実装
- バッチ処理・ログ出力・プロンプト管理・タグ解析・diff適用など、autoResponser.jsの機能を全て移行・拡張済み

---
