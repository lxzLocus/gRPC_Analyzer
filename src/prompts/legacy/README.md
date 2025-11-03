# Legacy Prompt Sets - プロンプト進化の記録

## 📚 概要

このディレクトリには、gRPC_Analyzer APRシステムの開発過程で使用された
歴史的なプロンプトセットが保存されています。

各プロンプトセットは特定のコミットから抽出され、
実験的な比較・検証に使用できるよう整理されています。

## 📂 ディレクトリ構成

```
src/prompts/
├── modern/                               # 現在のプロンプト（デフォルト）
│   ├── 00_prompt_gem.txt
│   ├── 00_promptModified_enhanced.txt
│   ├── 00_promptFinalCheck.txt
│   └── ...
│
└── legacy/                               # 過去のプロンプトセット
    ├── e0e0931_baseline/                # 開発初期・ベースライン
    │   ├── README.md
    │   ├── 00_prompt_gem.txt
    │   ├── 00_promptModified.txt
    │   ├── 00_promptReply.txt
    │   └── 00_fileVersionMismatch.txt
    │
    ├── b34512c_summarization/           # 要約機能追加
    │   ├── README.md
    │   ├── 00_prompt_summarize.txt     ← 新規
    │   ├── 00_prompt_resume_from_summary.txt ← 新規
    │   ├── 00_promptPreVerification.txt ← 実験的（後に削除）
    │   └── ... (4個のプロンプト)
    │
    ├── 0d47361_constructive_criticism/  # 建設的批判アプローチ
    │   ├── README.md
    │   ├── 00_promptFinalCheck.txt     ← 新規（最重要）
    │   ├── 00_promptModified_enhanced.txt ← 新規
    │   └── ... (8個のプロンプト)
    │
    ├── 0b819a7_pr_title/                # PRタイトル埋め込み
    │   ├── README.md
    │   └── ... (8個のプロンプト、微調整のみ)
    │
    └── README.md                         # このファイル
```

## 🔄 プロンプトセットの進化

### タイムライン

```
2025-09-17  e0e0931  ━━━━━━━━━━━━━━┓
                    Baseline       ┃  シンプル、対話ターン少ない
                                   ┃
2025-09-21  b34512c  ━━━━━━━━━━━━━━╋━━┓
                    Summarization  ┃  ┃  要約機能追加
                                   ┃  ┃
2025-09-25  0d47361  ━━━━━━━━━━━━━━╋━━╋━━┓
                    Constructive   ┃  ┃  ┃  最終確認、クロスリファレンス
                    Criticism      ┃  ┃  ┃  早期終了防止
                                   ┃  ┃  ┃
2025-10-26  0b819a7  ━━━━━━━━━━━━━━╋━━╋━━╋━━┓
                    PR Title       ┃  ┃  ┃  ┃  PRタイトル埋め込み
                    Embedding      ┃  ┃  ┃  ┃
                                   ┃  ┃  ┃  ┃
2025-11-02  HEAD     ━━━━━━━━━━━━━━┻━━┻━━┻━━┻━━ 現在
                    Modern                      (微調整)
```

## 📊 プロンプトセット比較表

| セット名 | コミット | 日付 | プロンプト数 | 状態数 | 平均ターン数 | 主な特徴 |
|---------|---------|------|------------|--------|------------|---------|
| **e0e0931_baseline** | e0e0931 | 2025-09-17 | 4 | 19 | 3-5 | シンプル、即終了 |
| **b34512c_summarization** | b34512c | 2025-09-21 | 7 | 19 | 4-7 | 要約機能 |
| **0d47361_constructive_criticism** | 0d47361 | 2025-09-25 | 8 | 21 | 6-10 | 最終確認、高品質 |
| **0b819a7_pr_title** | 0b819a7 | 2025-10-26 | 8 | 21 | 6-10 | PRタイトル、最新 |
| **modern (current)** | HEAD | 2025-11-02 | 9 | 21 | 6-10 | 現在の実装 |

## 🎯 各プロンプトセットの特徴

### 1. e0e0931_baseline - 開発初期・ベースライン

**使用目的**: 最もシンプルなフロー、対話ターン数のベースライン測定

**特徴**:
- ✅ 最も対話ターン数が少ない（3-5ターン）
- ✅ Finタグで即終了
- ✅ トークン消費が最小
- ❌ 早期終了のリスクあり
- ❌ 品質チェックなし

**適した実験**:
- 対話ターン数の下限測定
- 最小限のLLM介入での修正品質
- コスト効率の最大化

---

### 2. b34512c_summarization - 要約機能追加

**使用目的**: 長い対話への対応、トークン管理の検証

**特徴**:
- ✅ トークン数自動監視（30,000トークン閾値）
- ✅ 対話履歴の自動要約
- ✅ 長い対話でも安定動作
- ⚠️ 要約実行時に+1-2ターン増加
- ⚠️ 要約の品質はLLMに依存

**適した実験**:
- 長い対話での動作検証
- トークン管理の効果測定
- 要約品質の評価

---

### 3. 0d47361_constructive_criticism - 建設的批判アプローチ

**使用目的**: 高品質なパッチ生成、最終確認の効果検証

**特徴**:
- ✅ 最終確認フェーズ（+2ターン）
- ✅ クロスリファレンス分析
- ✅ 早期終了防止
- ✅ 最も高品質なパッチ
- ⚠️ 対話ターン数が最大（6-10ターン）
- ⚠️ トークン消費が最大

**適した実験**:
- パッチ品質の最大化
- 最終確認フェーズの効果測定
- コスト vs 品質のトレードオフ分析

---

### 4. 0b819a7_pr_title - PRタイトル埋め込み

**使用目的**: コンテキスト強化の効果、現在に最も近い設定

**特徴**:
- ✅ PRタイトル情報を自動埋め込み
- ✅ 建設的批判アプローチをすべて継承
- ✅ 目的に沿った修正を促進
- ✅ 現在のHEADに最も近い
- ⚠️ タイトルが曖昧な場合は効果限定的

**適した実験**:
- PRタイトル情報の効果検証
- 最新設定でのベースライン測定
- 建設的批判 vs PRタイトル追加の比較

---

## 🔬 実験での使用方法

### 設定ベースの切り替え（推奨）

#### 1. config.jsonで指定

```json
{
  "experimental": {
    "flowMode": "legacy",
    "legacyPromptSet": "e0e0931_baseline",  // ← ここを変更
    "features": {
      "conversationSummarizer": false,
      "crossReferenceAnalyzer": false,
      "finalCheckPhase": false,
      "earlyTerminationPrevention": false
    }
  }
}
```

#### 2. プロンプトセット名の指定

| セット名 | config.jsonでの指定 |
|---------|-------------------|
| ベースライン | `"e0e0931_baseline"` |
| 要約機能 | `"b34512c_summarization"` |
| 建設的批判 | `"0d47361_constructive_criticism"` |
| PRタイトル | `"0b819a7_pr_title"` |

#### 3. 機能フラグの組み合わせ

```json
// ベースライン: すべてfalse
{
  "conversationSummarizer": false,
  "crossReferenceAnalyzer": false,
  "finalCheckPhase": false,
  "earlyTerminationPrevention": false
}

// 要約機能のみ
{
  "conversationSummarizer": true,
  "crossReferenceAnalyzer": false,
  "finalCheckPhase": false,
  "earlyTerminationPrevention": false
}

// 建設的批判（フル機能）
{
  "conversationSummarizer": true,
  "crossReferenceAnalyzer": true,
  "finalCheckPhase": true,
  "earlyTerminationPrevention": true
}
```

## 📈 推奨実験プロトコル

### 実験1: ベースライン vs 建設的批判

**目的**: 最終確認フェーズの効果を測定

```bash
# ベースラインで実行
node scripts/SinglePRScript.js \
  --config config/legacy_baseline.json \
  --pr "grpc/grpc/33799" \
  --output output/baseline/

# 建設的批判で実行
node scripts/SinglePRScript.js \
  --config config/legacy_constructive.json \
  --pr "grpc/grpc/33799" \
  --output output/constructive/

# 比較
diff -u output/baseline/patches/ output/constructive/patches/
```

**測定メトリクス**:
- 対話ターン数
- パッチ品質スコア
- トークン消費量
- 実行時間

---

### 実験2: 要約機能の効果

**目的**: 長い対話での要約の効果を測定

```bash
# 要約なし（ベースライン）
node scripts/SinglePRScript.js \
  --config config/legacy_baseline.json \
  --pr "grpc/grpc/[complex_pr]" \
  --output output/no_summary/

# 要約あり
node scripts/SinglePRScript.js \
  --config config/legacy_summarization.json \
  --pr "grpc/grpc/[complex_pr]" \
  --output output/with_summary/
```

**測定メトリクス**:
- 要約実行回数
- トークン削減率
- 対話の一貫性
- 最終的なパッチ品質

---

### 実験3: PRタイトルの効果

**目的**: コンテキスト強化の効果を測定

```bash
# PRタイトルなし
node scripts/SinglePRScript.js \
  --config config/legacy_constructive.json \
  --pr "grpc/grpc/33799" \
  --output output/no_pr_title/

# PRタイトルあり
node scripts/SinglePRScript.js \
  --config config/legacy_pr_title.json \
  --pr "grpc/grpc/33799" \
  --output output/with_pr_title/
```

**測定メトリクス**:
- PRの目的に沿った修正率
- 無関係な修正の発生率
- LLMの理解度（定性評価）

---

## 🛠️ 実装状況

### ✅ 完了
- [x] プロンプトファイルの抽出
- [x] ディレクトリ構成の整理
- [x] 各セットのREADME作成
- [x] 全体のインデックス作成

### 🔄 実装中
- [ ] config.tsのプロンプトパス切り替え実装
- [ ] llmFlowController.tsの機能フラグ実装
- [ ] 実験用設定ファイルの作成

### 📋 TODO
- [ ] 自動テストスクリプト作成
- [ ] 比較レポート生成ツール
- [ ] メトリクス自動収集

## 📚 関連ドキュメント

- [EXPERIMENTAL_COMPARISON_STRATEGY.md](../../../docs/EXPERIMENTAL_COMPARISON_STRATEGY.md) - 実験戦略の詳細
- [SYSTEM_FLOW_EVOLUTION_ANALYSIS.md](../../../docs/SYSTEM_FLOW_EVOLUTION_ANALYSIS.md) - システムフローの進化分析
- [DIALOGUE_TURN_ANALYSIS_REPORT.md](../../../docs/DIALOGUE_TURN_ANALYSIS_REPORT.md) - 対話ターン数分析

## 🎓 使用上の注意

### プロンプトセット選択のガイドライン

1. **最小限のコスト**: e0e0931_baseline
2. **長い対話**: b34512c_summarization
3. **最高品質**: 0d47361_constructive_criticism
4. **最新ベースライン**: 0b819a7_pr_title

### 機能の依存関係

```
conversationSummarizer
  ↓ (独立)
crossReferenceAnalyzer
  ↓ (独立)
finalCheckPhase
  ↓ (requires crossReferenceAnalyzer)
earlyTerminationPrevention
```

### 互換性マトリクス

| プロンプトセット | 要約 | クロスリファレンス | 最終確認 | 早期終了防止 |
|---------------|-----|----------------|---------|------------|
| e0e0931 | ❌ | ❌ | ❌ | ❌ |
| b34512c | ✅ | ❌ | ❌ | ❌ |
| 0d47361 | ✅ | ✅ | ✅ | ✅ |
| 0b819a7 | ✅ | ✅ | ✅ | ✅ |
| modern | ✅ | ✅ | ✅ | ✅ |

## 🔗 外部リンク

- [OpenAI Best Practices](https://platform.openai.com/docs/guides/prompt-engineering)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
