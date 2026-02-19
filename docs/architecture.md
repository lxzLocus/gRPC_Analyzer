# アーキテクチャ詳細

本ドキュメントでは、システムのエントリーポイント、MVC 構成、コアモジュール、処理フローを説明する。

---

## エントリーポイント

### `scripts/MainScript.js`（メインエントリーポイント）

```bash
node scripts/MainScript.js [datasetIndex] [outputDir]
```

- コマンドライン引数の処理（データセット番号、出力ディレクトリ）
- 環境変数の読み込み（`.env`）
- `src/Controller/Controller.js` の `datasetLoop()` を呼び出す

### `src/Controller/Controller.js`（MVC 統合レイヤー）

- `datasetLoop(datasetDir, outputPath, options)` を export
- `BatchProcessController` を初期化し、`runBatchProcessing()` を実行
- 後方互換性を維持する統合レイヤー

### NPM スクリプト

| コマンド | 説明 |
|---------|------|
| `npm run batch:mvc` | デフォルト設定で実行 |
| `npm run batch:mvc:test` | テストデータセット (index: 4) で実行 |
| `npm run batch:mvc:large` | 大規模データセット (index: 2) で実行 |
| `npm run batch:mvc:help` | ヘルプ表示 |
| `npm run build` | TypeScript コンパイル |
| `npm run dev` | 開発時の自動コンパイル（watch モード） |
| `npm run clean` | dist/ ディレクトリを削除 |

---

## MVC アーキテクチャ

### 全体構成図

```
MainScript.js
  └── Controller.js (統合レイヤー)
        └── BatchProcessController (Controller 層)
              ├── BatchProcessingService (Service 層)
              │     ├── LLMProcessingService  → llmFlowController (コアモジュール)
              │     ├── ReportService          → エラー・統計レポート生成
              │     ├── MemoryManagementService → メモリ監視・GC
              │     ├── AgentStateService       → FSM ビジネスロジック
              │     └── DatasetRepository (Repository 層) → ファイルシステム操作
              └── BatchProcessView (View 層) → 進捗表示・レポート出力
```

### Controller 層

| ファイル | 役割 |
|---------|------|
| `src/controllers/BatchProcessController.ts` | バッチ処理の制御ロジック、シグナル処理 |
| `src/Controller/Controller.js` | 後方互換性を維持する統合エントリーポイント |

### Service 層

| ファイル | 役割 |
|---------|------|
| `src/Service/BatchProcessingService.ts` | 処理調整（リポジトリ走査、PR 処理の実行） |
| `src/Service/LLMProcessingService.ts` | LLM 通信制御とリトライ |
| `src/Service/ReportService.ts` | エラー・統計レポートの生成 |
| `src/Service/MemoryManagementService.ts` | メモリ監視と GC 管理 |
| `src/Service/AgentStateService.ts` | FSM ビジネスロジック（タグ正規化・次状態推測） |

### Repository 層

| ファイル | 役割 |
|---------|------|
| `src/Repository/DatasetRepository.ts` | ファイルシステム操作の抽象化 |

### View 層

| ファイル | 役割 |
|---------|------|
| `src/views/BatchProcessView.ts` | 進捗表示とレポート出力 |

### Model 層

| ファイル | 役割 |
|---------|------|
| `src/models/BatchProcessModel.ts` | バッチ処理のデータモデル |

### 型定義

| ファイル | 内容 |
|---------|------|
| `src/types/AgentState.ts` | FSM 状態・遷移ルール・許可タグの定義 |
| `src/types/BatchProcessTypes.ts` | バッチ処理関連の型定義 |
| `src/types/ValidationError.ts` | バリデーションエラー型 |

---

## コアモジュール（`src/modules/`）

### LLM 処理フロー

| ファイル | 役割 |
|---------|------|
| `llmFlowController.ts` | **中核** — 二重ステートマシンによるメイン処理ループ |
| `AgentStateMachine.ts` | FSM 低レベル実装 + TagParser |
| `MessageHandler.ts` | LLM メッセージの構築・パーシング |
| `llmRetryEnhancer.ts` | 品質チェック付きリトライ |
| `ConversationSummarizer.ts` | 対話履歴の要約（トークン削減） |

### LLM クライアント

| ファイル | 役割 |
|---------|------|
| `OpenAIClient.ts` | OpenAI API クライアント |
| `openAILLMClient.ts` | OpenAI LLM クライアント実装 |
| `geminiLLMClient.ts` | Gemini API クライアント |
| `llmClient.ts` | LLM クライアントの抽象インターフェース |
| `llmClientFactory.ts` | LLM クライアントの生成ファクトリ |

### ファイル操作

| ファイル | 役割 |
|---------|------|
| `FileManager.ts` | ファイル I/O 操作（読み込み・書き込み・パス解決） |
| `RestoreDiff.ts` | Diff の適用と復元処理 |
| `generatePeripheralStructure.ts` | ディレクトリ構造の生成 |
| `crossReferenceAnalyzer.ts` | 相互参照分析 |

### 設定・ログ

| ファイル | 役割 |
|---------|------|
| `Config.ts` | 設定管理と validation |
| `Logger.ts` | 構造化ログ管理 |

---

## プロンプトテンプレート（`src/prompts/`）

| ファイル | 用途 |
|---------|------|
| `00_prompt.txt` | 初期プロンプト（OpenAI 用） |
| `00_prompt_gem.txt` | 初期プロンプト（Gemini 用） |
| `00_promptReply.txt` | ファイル内容返送時のプロンプト |
| `00_promptModified.txt` | パッチ適用結果通知プロンプト |
| `00_promptModified_enhanced.txt` | 強化版修正結果プロンプト |
| `00_promptVerifying.txt` | VERIFYING 状態用プロンプト |
| `00_promptVerifyingNoChanges.txt` | No Changes 時の検証プロンプト |
| `00_promptVerifyingNoProgress.txt` | No Progress 時の検証プロンプト |
| `00_promptFinalCheck.txt` | 最終確認プロンプト |
| `00_fileVersionMismatch.txt` | ファイルバージョン不一致エラー |
| `00_prompt_resume_from_summary.txt` | 要約からの再開プロンプト |
| `00_prompt_summarize.txt` | 対話要約プロンプト |

---

## ユーティリティ（`src/utils/`）

| ファイル | 役割 |
|---------|------|
| `generatePrompt.ts` | プロンプト変数ファイル（01〜05）の生成 |
| `autoResponser.ts` | 自動応答システム |
| `timeUtils.ts` | 時間関連ユーティリティ |

---

## 処理フロー

### メインバッチ処理

```
1. MainScript.js: 引数処理 → Controller.js 呼び出し
2. Controller.js: BatchProcessController 初期化
3. BatchProcessController: データセット走査
4. 各リポジトリに対して:
   4.1 DatasetRepository: PR ディレクトリを列挙
   4.2 各 PR に対して:
       4.2.1 generatePrompt: プロンプト変数ファイル（01〜05）を生成
       4.2.2 LLMFlowController: FSM ベースの対話ループを実行
       4.2.3 ReportService: 結果をログ・レポートに記録
5. BatchProcessView: 最終統計を表示
```

### LLM 対話ループ（1 PR あたり）

```
1. コンテキスト準備（01〜05 のファイルからプロンプト構築）
2. 初期プロンプト送信
3. LLM 応答のタグを解析:
   - %_Reply Required_%  → ファイル取得 → 情報送信 (ループ)
   - %_Modified_%        → diff パース → diff 適用 → 結果送信 (ループ)
   - %_Verification_%    → 検証プロンプト送信 (ループ)
   - %%_Fin_%%           → 終了
4. 安全機構による強制終了判定（ターン数上限、No Progress 等）
```

---

## 設定ファイル

### `config/config.json`

```json
{
  "system": { "version": "1.0.0", "environment": "production", "debugMode": false },
  "llm": { "provider": "openai", "model": "gpt-5.1-chat-latest", "maxTokens": 30000, "temperature": 0.1, "timeout": 60000 },
  "fileOperations": { "maxFileSize": 52428800, "timeout": 30000, "encoding": "utf-8", "backupEnabled": true },
  "paths": { "promptDir": "/app/src/prompts", "outputDir": "/app/output", "logsDir": "/app/logs", "backupDir": "/app/backups" }
}
```

### `.env`（環境変数）

| 変数名 | 説明 |
|--------|------|
| `OPENAI_API_KEY` | OpenAI API キー |
| `GEMINI_API_KEY` | Gemini API キー（オプション） |
| `LLM_PROVIDER` | `openai` または `gemini` |
| `NODE_ENV` | `development` / `production` |
| `DEBUG_MODE` | デバッグモード（`true` / `false`） |

---

## 出力

### 処理結果

| ディレクトリ | 内容 |
|-------------|------|
| `output/` | 処理結果（エラーレポート、統計サマリー） |
| `logs/diff_errors/` | Diff 適用エラーの詳細ログ |
| `logs/parsing_errors/` | LLM 応答パーシングエラーのログ |
| `logs/file_errors/` | ファイル操作エラーのログ |
| `logs/performance/` | パフォーマンスログ |
| `log/` | リポジトリ別の詳細実行ログ |

### 評価システム

| ディレクトリ | 内容 |
|-------------|------|
| `evaluation/` | 独立した評価コンテナ（Python / Docker） |
| `patchEvaluation/` | パッチ品質の評価スクリプト |
