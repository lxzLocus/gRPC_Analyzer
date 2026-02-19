# ブランチ構成と FSM 実装バージョン比較

このドキュメントでは、各ブランチにおける LLM 対話制御（FSM: 有限状態機械）の実装の違いを説明する。

---

## ブランチ一覧

| ブランチ名 | FSM 実装 | 用途 | 論文対応 |
|-----------|---------|------|---------|
| `master` | なし（タグベース制御のみ） | メインブランチ・基本実装 | — |
| `experiment/fsm-implementation` | **二重 FSM**（外部 State enum + 内部 AgentState FSM） | **論文投稿最終版** | ✅ |
| `Feature_SelfRefine` | 二重 FSM + Self-Refine + セッション管理 | 自己改善ループ実験 | — |
| `feature/Evaluation_FSM` | 二重 FSM + 評価システム統合 | FSM 評価実験 | — |
| `final` | 二重 FSM（fsm-implementation と同等）+ 並列バッチ処理 | 最終成果物の統合 | — |
| `experiment/stub-context-enhancement` | なし（master ベース） | コンテキスト生成の改善実験 | — |
| `experiment/ab-test-28fa3c5-clean` | なし（master ベース） | A/B テスト用クリーン版 | — |
| `experiment/e0e0931-with-pr-title` | なし（master ベース） | PR タイトル埋め込み実験 | — |
| `feature/fix-title-embedding` | なし（master ベース） | PR タイトル埋め込み修正 | — |
| `chore` | なし | TypeScript 移行・雑務 | — |

---

## FSM 実装の進化

### Level 0: タグベース制御（master / 実験系ブランチ）

**該当ブランチ**: `master`, `experiment/ab-test-*`, `experiment/e0e0931-*`, `experiment/stub-context-*`, `feature/fix-title-embedding`, `chore`

- `AgentStateMachine.ts` は存在しない
- LLM 対話ループは `llmFlowController.ts` 内の `State` enum のみで制御
- LLM 応答のタグ（`%_Thought_%`, `%_Modified_%`, `%%_Fin_%%` 等）を正規表現で検出し、対応する処理に分岐
- 状態遷移の検証（不正遷移の検出）は行わない

```
State enum (types.ts):
  Start → PrepareInitialContext → SendInitialInfoToLLM → LLMAnalyzePlan
  → LLMDecision → SystemAnalyzeRequest / SystemParseDiff / End
  → ... (switch 文で直接制御)
```

**制御フロー（概略）**:
```
初期プロンプト送信 → LLM応答のタグを検出 →
  %_Reply Required_%  → ファイル取得 → 再送信 (ループ)
  %_Modified_%        → diff適用 → 結果送信 (ループ)
  %%_Fin_%%           → 終了
```

---

### Level 1: 二重 FSM（experiment/fsm-implementation — 論文投稿最終版）

**該当ブランチ**: `experiment/fsm-implementation`

**追加されたファイル**:
- `src/modules/AgentStateMachine.ts` — FSM 低レベル実装（状態遷移の可否チェック、タグ検証）
- `src/types/AgentState.ts` — FSM 状態・遷移ルール・許可タグの定義
- `src/Service/AgentStateService.ts` — FSM ビジネスロジック層

**二重ステートマシン構造**:

1. **外部ステートマシン** (`State` enum) — `llmFlowController.ts` の `run()` メソッドの switch 文で処理フローを制御
2. **内部 FSM** (`AgentState` enum) — LLM 応答のタグが現在の状態で有効かを検証し、不正タグを無視

**7 つの AgentState**:

| 状態 | 説明 |
|------|------|
| `ANALYSIS` | 初期分析・計画フェーズ |
| `AWAITING_INFO` | ファイル/ディレクトリ情報待ちフェーズ（内部専用） |
| `MODIFYING` | パッチ生成中フェーズ |
| `VERIFYING` | 自己検証・レビューフェーズ |
| `READY_TO_FINISH` | 完了許可直前フェーズ |
| `FINISHED` | 正常終了 |
| `ERROR` | 異常系 |

**状態遷移ルール**:
```
ANALYSIS       → AWAITING_INFO / MODIFYING / VERIFYING
AWAITING_INFO  → ANALYSIS
MODIFYING      → VERIFYING / AWAITING_INFO
VERIFYING      → READY_TO_FINISH / MODIFYING
READY_TO_FINISH → FINISHED
ERROR          → ANALYSIS
```

**安全機構**:
- タグ違反リトライ: 最大 2 回の corrective retry
- ターン数上限: 15 ターンで強制終了
- 調査フェーズ強制終了: 連続 5 回のファイルリクエストで修正フェーズへ強制遷移
- No Progress 検出: 同一状態・同一タグが 2 回連続で行き詰まり判定

---

### Level 1+: Self-Refine 拡張（Feature_SelfRefine）

**該当ブランチ**: `Feature_SelfRefine`

Level 1（fsm-implementation）をベースに、以下を追加:

- **Self-Refine パターン**: LLM が自身の出力を自己評価し、改善ループを回す
- **セッション管理 API**: 対話履歴の永続化・再開機能
- **CommitMessages 型**: コミットメッセージ解析機能
- **行動バイアス除去**: プロンプトの改善で、LLM の確認偏向を軽減

---

### Level 1+: 評価統合（feature/Evaluation_FSM）

**該当ブランチ**: `feature/Evaluation_FSM`

Level 1（fsm-implementation）をベースに、以下を変更:

- 評価システム（`evaluation/`）との連携を強化
- ファイル生成モジュールのリファクタリング
- 並列バッチ処理の追加

---

### final ブランチ

**該当ブランチ**: `final`

`Feature_SelfRefine` と同等の FSM 実装（AgentStateMachine + AgentState）を含む。加えて:

- PR の並列処理をバッチ処理で制御
- Intent Fulfillment Level の数値スコアマッピング機能
- gRPC 生成ファイルの変更処理スクリプト

---

## 実験系ブランチの概要

| ブランチ | ベース | 主な変更点 |
|---------|--------|-----------|
| `experiment/ab-test-28fa3c5-clean` | master (28fa3c5) | LLM モデルバージョン変更、タイムアウト調整による A/B テスト |
| `experiment/e0e0931-with-pr-title` | master (e0e0931) | 初期プロンプトへの PR タイトル埋め込み |
| `experiment/stub-context-enhancement` | master | コンテキスト生成の改善（要約機能追加、プロンプト構造強化） |
| `feature/fix-title-embedding` | master | PR タイトル埋め込みのパーサー修正 |

---

## 推奨事項

- **引き継ぎ時のベースブランチ**: `experiment/fsm-implementation`（論文投稿最終版）
- FSM なしの基本実装を確認したい場合は `master` を参照
- Self-Refine の改善手法を参照したい場合は `Feature_SelfRefine` を参照
