# FSM状態遷移エラー分析レポート

## 実行サマリー

- **実行日時**: 2026-01-18 07:44:47 - 09:44:59 (UTC)
- **バッチID**: batch_20260118_074447
- **データセット**: filtered_fewChanged (71 PRs)
- **総実行時間**: 2時間0分12秒

## 実行結果

### 全体統計

| 項目 | 件数 | 割合 |
|------|------|------|
| **総実行数** | 71 | 100% |
| **プロセス成功** | 71 | 100% |
| **APR処理成功** | 36 | 50.7% |
| **APR処理失敗（エラー）** | 35 | 49.3% |

### APR処理完了ステータス（成功36件のみ）

| ステータス | 件数 | 割合 |
|-----------|------|------|
| **Completed (Implicit)** | 19 | 52.8% |
| **Incomplete** | 17 | 47.2% |
| **Completed (Verified)** | 0 | 0% |
| **Completed (No Changes Needed)** | 0 | 0% |

### エラー分析（失敗35件）

| エラータイプ | 件数 | 割合 | 説明 |
|-------------|------|------|------|
| **Invalid state transition: ANALYSIS → VERIFYING** | 34 | 97.1% | FSM状態遷移ルール違反 |
| **Input tokens exceed limit (272K)** | 1 | 2.9% | トークン制限超過 |

## 根本原因

### 1. FSM状態遷移ルール違反（34件）

#### 問題の詳細

**エラーメッセージ:**
```
Invalid state transition: ANALYSIS -> VERIFYING
```

**発生原因:**

1. **`%_No_Changes_Needed_%`タグの誤った遷移**
   - AgentStateService.ts Line 203
   - ANALYSIS状態から直接VERIFYINGへ遷移しようとした
   - 許可されている遷移: ANALYSIS → READY_TO_FINISH

2. **`%_Modified_%`タグの状態チェック不足**
   - AgentStateService.ts Line 219
   - 現在の状態を考慮せず、常にVERIFYINGへ遷移しようとした
   - 許可されている遷移: MODIFYING → VERIFYING のみ

#### 状態遷移ルール（STATE_TRANSITIONS）

```typescript
[AgentState.ANALYSIS]: [
  AgentState.AWAITING_INFO,
  AgentState.MODIFYING,
  AgentState.READY_TO_FINISH,  // ✅ 許可
  AgentState.ERROR
  // AgentState.VERIFYING  // ❌ 許可されていない
],
```

### 2. FSM設計の問題

#### VERIFYING状態への到達失敗

| 指標 | 測定値 |
|------|--------|
| VERIFYING状態到達 | 0件 |
| %_Verification_Report_%タグ検出 | 2件 |
| MODIFYING → VERIFYING遷移 | 0件 |

**原因:**
1. ANALYSIS状態からVERIFYINGへの無効な遷移により処理が中断
2. MODIFYING状態を経由せずにVERIFYINGへ遷移しようとした

## 修正内容

### 修正1: `%_No_Changes_Needed_%`タグの遷移先変更

**ファイル:** `src/Service/AgentStateService.ts`

**修正前:**
```typescript
if (tags.includes('%_No_Changes_Needed_%')) {
  if (currentState === AgentState.ANALYSIS) {
    console.log('✅ No changes needed, transitioning to VERIFYING for final check');
    return AgentState.VERIFYING;  // ❌ 無効な遷移
  }
  // ...
}
```

**修正後:**
```typescript
if (tags.includes('%_No_Changes_Needed_%')) {
  if (currentState === AgentState.ANALYSIS) {
    console.log('✅ No changes needed, transitioning directly to READY_TO_FINISH');
    return AgentState.READY_TO_FINISH;  // ✅ 有効な遷移
  }
  // ...
}
```

### 修正2: `%_Modified_%`タグの状態チェック追加

**ファイル:** `src/Service/AgentStateService.ts`

**修正前:**
```typescript
if (tags.includes('%_Modified_%')) {
  return AgentState.VERIFYING;  // ❌ 現在の状態を無視
}
```

**修正後:**
```typescript
if (tags.includes('%_Modified_%')) {
  // Modified DiffはMODIFYING状態からのみVERIFYINGへ遷移可能
  if (currentState === AgentState.MODIFYING) {
    console.log('✅ Modified diff detected in MODIFYING state, transitioning to VERIFYING');
    return AgentState.VERIFYING;  // ✅ 有効な遷移
  }
  console.warn(`⚠️  Modified tag detected in invalid state: ${currentState}`);
  return undefined;  // 無効な状態では遷移しない
}
```

## 期待される改善効果

### 状態遷移エラーの解消

| 項目 | 修正前 | 修正後（期待値） |
|------|--------|-----------------|
| Invalid state transition エラー | 34件 (97%) | 0件 (0%) |
| VERIFYING状態到達 | 0件 | 増加予想 |
| Completed (Verified) | 0件 | 増加予想 |

### FSMフローの正常化

**修正前のフロー（エラー発生）:**
```
ANALYSIS → %_No_Changes_Needed_% → VERIFYING ❌
ANALYSIS → %_Modified_% → VERIFYING ❌
```

**修正後の正しいフロー:**
```
ANALYSIS → %_No_Changes_Needed_% → READY_TO_FINISH → FINISHED ✅
ANALYSIS → %_Plan_% → MODIFYING → %_Modified_% → VERIFYING → READY_TO_FINISH → FINISHED ✅
```

## その他の発見

### トークン制限超過（1件）

**エラー:**
```
Input tokens exceed the configured limit of 272000 tokens.
Your messages resulted in 318569 tokens.
```

**原因:** 
- 要約機能が有効だが、大規模なファイル変更により制限を超過

**対策案:**
1. 要約の頻度を増やす（現在: 5ターン毎 → 3ターン毎）
2. ファイル内容の要約を強化
3. 古い対話履歴の積極的な削減

## 検証計画

### 次回テスト実行での確認事項

1. **状態遷移エラーの解消**
   - Invalid state transition エラーが発生しないこと
   
2. **VERIFYING状態への到達**
   - MODIFYING → VERIFYING遷移が正常に動作すること
   - VERIFYING状態のログが出力されること

3. **検証フロー の動作**
   - %_Verification_Report_%タグが検出されること
   - VERIFYING → READY_TO_FINISH → FINISHED の遷移が完了すること

4. **完了ステータスの改善**
   - Completed (Verified) の割合が増加すること
   - Completed (Implicit) の割合が減少すること

### 推奨テスト規模

- **小規模テスト**: 5-10 PRs（初期検証）
- **中規模テスト**: 20-30 PRs（動作確認）
- **大規模テスト**: 71 PRs（全体検証）

## 関連コミット

- `260118_1706` [Fix] FSM状態遷移ルール違反を修正（ANALYSIS→VERIFYINGを防止）
- `260118_0744` [Fix] 構文エラー修正とhas_verification_report型定義追加
- `260118_0558` [Fix] ファイルI/Oタイムアウト増加とイテレーション追跡修正
- `260118_1003` [Feature] FSM logic for state transitions and tag handling

## 結論

バッチ実行で発見された35件のエラーの97%（34件）は、FSM状態遷移ルール違反が原因でした。
クレジット切れではなく、コードのバグによるものです。

修正により以下が期待されます：
1. ✅ 状態遷移エラーの完全解消
2. ✅ VERIFYING状態への正常な到達
3. ✅ 検証フローの正常動作
4. ✅ Completed (Verified) ステータスの増加
5. ✅ Implicit完了の減少

次回のテスト実行で効果を検証する必要があります。
