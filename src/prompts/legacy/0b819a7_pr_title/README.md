# Legacy Prompt Set: 0b819a7 - PR Title Embedding (プルリクタイトル埋め込み)

## 📋 コミット情報

- **Commit**: `0b819a71a20b4a485b8edd5323ccf3feb59c3814`
- **Date**: 2025-10-26 15:21:55 +0000
- **Message**: 251027_0021 [Add] プルリクタイトル埋め込み対応版
- **Phase**: コンテキスト強化

## 🎯 特徴

### 変更されたプロンプト
- `00_prompt_gem.txt` - PRタイトル情報の追加（+3行）

### 新機能：PRタイトル埋め込み

#### 背景
従来は、LLMがPRのタイトルを知らずに修正を行っていました：
- ❌ PRの目的が不明確
- ❌ 修正の方向性が定まりにくい
- ❌ 無関係な修正をする可能性

#### 改善内容
```typescript
// src/modules/fileManager.ts
async getPRTitle(): Promise<string | null> {
    const prPath = path.join(this.prDir, 'pull_request.json');
    const prData = JSON.parse(fs.readFileSync(prPath, 'utf-8'));
    return prData.title || null;
}
```

#### プロンプトでの活用
```
## 📋 プルリクエスト情報

**タイトル**: [PRタイトルがここに挿入される]

このプルリクエストの目的を理解し、
タイトルに沿った適切な修正を行ってください。
```

### ベースラインからの変更
- プロンプトファイル: 1個のみ修正（00_prompt_gem.txt）
- その他の機能: すべて建設的批判アプローチを継承
  - ✅ 最終確認フェーズ
  - ✅ クロスリファレンス分析
  - ✅ 早期終了防止
  - ✅ 要約機能

### 状態数
- **21個の状態** (建設的批判アプローチと同じ)

### 対話パターン
```
1. 初期プロンプト（+ PRタイトル情報） → LLM分析
2. ファイル要求 → ファイル送信 → LLM再分析
3. パッチ生成 → 適用 → 結果送信（+ クロスリファレンス情報）
4. ready_for_final_check → 最終確認プロンプト送信
5. 最終確認応答 → Finタグ or 追加修正
```

## 🔬 実験での使用方法

### config.jsonの設定
```json
{
  "experimental": {
    "flowMode": "modern",
    "legacyPromptSet": "0b819a7_pr_title",
    "features": {
      "conversationSummarizer": true,
      "crossReferenceAnalyzer": true,
      "finalCheckPhase": true,
      "earlyTerminationPrevention": true,
      "prTitleEmbedding": true
    }
  }
}
```

### 期待される動作
- 建設的批判アプローチとほぼ同じターン数
- PRの目的に沿った修正
- より文脈を理解した対話

## 📊 比較用メトリクス

| メトリクス | 期待値 |
|-----------|--------|
| 平均ターン数 | 6-10（建設的批判と同等） |
| PRタイトル参照率 | 100% |
| 目的に沿った修正率 | 向上 |
| トークン消費 | 建設的批判 + PRタイトル分 |

## 🆕 新機能の詳細

### PRタイトル埋め込みの効果

#### 例1: 明確な目的のPR
```
PRタイトル: "Fix memory leak in connection pool"

Before: 一般的なメモリ管理の改善を提案
After: connection poolのメモリリークに焦点を当てた修正
```

#### 例2: 機能追加のPR
```
PRタイトル: "Add support for HTTP/2"

Before: 既存のHTTP/1.1の改善を提案
After: HTTP/2対応の実装に集中
```

#### 例3: リファクタリングのPR
```
PRタイトル: "Refactor authentication module"

Before: バグ修正を試みる
After: 認証モジュールのリファクタリングに注力
```

### プロンプト変更の詳細

**00_prompt_gem.txt への追加箇所**:
```diff
+ ## 📋 プルリクエスト情報
+ 
+ **タイトル**: {{PR_TITLE}}
+ 
+ このプルリクエストの目的を理解し、タイトルに沿った適切な修正を行ってください。
```

**変数置換**:
```typescript
// src/modules/config.ts
const prTitle = await this.fileManager.getPRTitle();
const prompt = template.replace('{{PR_TITLE}}', prTitle || 'Unknown');
```

## 📈 建設的批判アプローチとの比較

| 項目 | 建設的批判 (0d47361) | PRタイトル (0b819a7) | 差分 |
|-----|---------------------|---------------------|------|
| プロンプト変更 | 大規模 | 小規模（+3行） | 微調整 |
| 新機能 | 多数 | PRタイトル埋め込みのみ | 追加 |
| 状態数 | 21個 | 21個 | 同じ |
| 平均ターン数 | 6-10 | 6-10 | 同じ |
| コンテキスト | 豊富 | 最も豊富 | 向上 |

## 💡 使用上のポイント

### PRタイトルが重要なケース
1. **明確な目的があるPR**
   - "Fix bug #1234"
   - "Add feature X"
   - "Refactor module Y"

2. **複雑な修正**
   - タイトルが方向性を示す
   - LLMの判断を助ける

3. **複数の修正候補がある場合**
   - タイトルが優先順位を決定

### PRタイトルがあまり効果的でないケース
1. **曖昧なタイトル**
   - "Update code"
   - "Fix issues"
   - "Improvements"

2. **タイトルと実際の内容が不一致**
   - メタデータが不正確な場合

## ⚠️ 制限事項

- PRタイトルがない場合は "Unknown" として処理
- タイトルが曖昧な場合の効果は限定的
- タイトルと実際の修正内容が乖離している場合は逆効果の可能性

## 🔗 関連コミット

- 前: 0d47361 (建設的批判アプローチ)
- 次: 386f4f1 (単一PR実行エントリーポイントの追加)

## 🎯 実験での活用

このプロンプトセットは、建設的批判アプローチに**最小限の変更**を加えたものです。
以下の実験に最適：

1. **PRタイトル情報の効果検証**
   - 0d47361（PRタイトルなし）と比較
   - 目的に沿った修正率を測定

2. **コンテキスト強化の効果**
   - より豊富な情報でLLMのパフォーマンスが向上するか検証

3. **最新バージョンのベースライン**
   - 現在のHEADに最も近いプロンプトセット
   - 微調整の効果を測定しやすい
