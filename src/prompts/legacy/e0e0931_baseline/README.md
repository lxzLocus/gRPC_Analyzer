# Legacy Prompt Set: e0e0931 - Baseline (開発初期)

## 📋 コミット情報

- **Commit**: `e0e0931fa2bbc82df0cb27b721540871ef1c7855`
- **Date**: 2025-09-17 05:06:13 +0000
- **Message**: 250917_1405 [Fix] レポート出力の修正
- **Phase**: 開発初期・ベースライン

## 🎯 特徴

### プロンプト構成
- `00_prompt_gem.txt` - 初期プロンプト（シンプル版）
- `00_promptModified.txt` - パッチ適用後のフィードバック
- `00_promptReply.txt` - ファイル内容送信時
- `00_fileVersionMismatch.txt` - バージョン不一致エラー時

### アプローチの特徴
✅ **シンプルな一方向フロー**
- Finタグで即終了
- 最小限のガイドライン
- 対話ターン数が少ない（3-5ターン）

✅ **基本的な機能のみ**
- 要約機能なし
- クロスリファレンス分析なし
- 最終確認フェーズなし
- 早期終了防止なし

### 状態数
- **19個の状態** (SendFinalCheckToLLM, LLMFinalDecisionは未実装)

### 対話パターン
```
1. 初期プロンプト → LLM分析
2. ファイル要求 → ファイル送信 → LLM再分析
3. パッチ生成 → 適用 → 結果送信
4. Finタグ → 即終了
```

## 🔬 実験での使用方法

### config.jsonの設定
```json
{
  "experimental": {
    "flowMode": "legacy",
    "legacyPromptSet": "e0e0931_baseline",
    "features": {
      "conversationSummarizer": false,
      "crossReferenceAnalyzer": false,
      "finalCheckPhase": false,
      "earlyTerminationPrevention": false
    }
  }
}
```

### 期待される動作
- 最も対話ターン数が少ない
- LLMの判断を最大限尊重
- シンプルで高速な処理

## 📊 比較用メトリクス

| メトリクス | 期待値 |
|-----------|--------|
| 平均ターン数 | 3-5 |
| Finタグ後の処理 | 即終了 |
| 追加検証 | なし |
| トークン消費 | 最小 |

## ⚠️ 制限事項

- 早期終了のリスクあり（ファイル未処理でFinタグ）
- 長い対話でトークン制限に達する可能性
- パッチの品質チェックなし

## 🔗 関連コミット

- 前: 90d4dd9 (プロンプトのガイドライン修正)
- 次: 8ea8c1a (プロンプトの改修＆パーサーの修正)
