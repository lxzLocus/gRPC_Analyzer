# Legacy Prompt Set: b34512c - Summarization (要約機能追加)

## 📋 コミット情報

- **Commit**: `b34512cd35bc737fff5b43108b356df8d5512474`
- **Date**: 2025-09-21 05:19:33 +0000
- **Message**: 250921_1419 [Add] 要約機能の追加
- **Phase**: 対話履歴管理の導入

## 🎯 特徴

### 新規追加プロンプト
- ✅ `00_prompt_summarize.txt` - 対話履歴要約用プロンプト
- ✅ `00_prompt_resume_from_summary.txt` - 要約後の対話再開プロンプト
- ✅ `00_promptPreVerification.txt` - 事前検証用プロンプト（実験的）

### ベースラインからの変更点
1. **対話履歴要約機能の追加**
   - トークン数閾値監視（デフォルト30,000トークン）
   - 自動要約実行
   - 要約後の対話再開

2. **新規モジュール**
   - `ConversationSummarizer` クラスの導入
   - トークン数自動カウント
   - 動的要約生成

3. **PreVerificationプロンプト**
   - パッチ適用前の事前検証（実験的機能）
   - 後のコミットで削除される

### アプローチの特徴
✅ **長い対話への対応**
- トークン数を監視し、自動的に要約
- 対話が長くなってもAPI制限に達しない

✅ **対話の文脈保持**
- 重要な情報を要約に含める
- 要約後もタスクの継続性を維持

❌ **まだない機能**
- 最終確認フェーズなし
- クロスリファレンス分析なし
- 早期終了防止なし（部分的）

### 状態数
- **19個の状態** (ベースラインと同じ)

### 対話パターン
```
1. 初期プロンプト → LLM分析
2. ファイル要求 → ファイル送信 → LLM再分析
3. （トークン閾値超過 → 要約実行 → 対話再開）
4. パッチ生成 → 適用 → 結果送信
5. Finタグ → 即終了
```

## 🔬 実験での使用方法

### config.jsonの設定
```json
{
  "experimental": {
    "flowMode": "legacy",
    "legacyPromptSet": "b34512c_summarization",
    "features": {
      "conversationSummarizer": true,
      "crossReferenceAnalyzer": false,
      "finalCheckPhase": false,
      "earlyTerminationPrevention": false
    }
  },
  "llm": {
    "tokenThreshold": 30000
  }
}
```

### 期待される動作
- ベースラインよりやや多い対話ターン（要約分）
- 長い対話でも安定動作
- トークン消費が管理される

## 📊 比較用メトリクス

| メトリクス | 期待値 |
|-----------|--------|
| 平均ターン数 | 4-7（要約発生時+1-2） |
| 要約実行回数 | 0-2回 |
| Finタグ後の処理 | 即終了 |
| トークン消費 | 中程度（要約で削減） |

## 🆕 新機能の詳細

### ConversationSummarizer
```typescript
// トークン数監視
if (totalTokens > threshold) {
  // 要約プロンプト送信
  const summary = await generateSummary(...);
  
  // 対話再開プロンプト生成
  const resumePrompt = readPromptResumeFromSummaryFile(...);
}
```

### 要約プロンプトの特徴
- 技術的詳細を保持
- タスクの進捗状況を明確化
- 修正目標を再確認

## ⚠️ 制限事項

- 要約の品質はLLMに依存
- 要約プロンプト自体がトークンを消費
- PreVerificationは後に削除される（実験的機能のため）

## 🔗 関連コミット

- 前: 8ea8c1a (プロンプトの改修＆パーサーの修正)
- 次: 0d47361 (建設的批判アプローチ)
