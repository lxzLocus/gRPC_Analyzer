# Safe Batch Runner

大量のデータセットで安全にLLMFlowControllerを実行するためのエラーハンドリング強化ラッパーです。

## 📁 ファイル構造と実行方法

```
/app/
├── src/modules/llmFlowController.ts   # 開発用TypeScriptソース
├── dist/js/modules/llmFlowController.js  # 実行用コンパイル済みJS（本バッチランナーが使用）
└── scripts/safeBatchRunner.js        # 本バッチランナー（dist/js/modules/を参照）
```

**重要**: バッチランナーは `dist/js/modules/llmFlowController.js` を使用します。
TypeScriptファイルを変更した場合は `tsc` コマンドでコンパイルしてください。

## 特徴

- **エラーハンドリング**: 個別のpullRequestで発生した例外をキャッチし、処理を継続
- **詳細なエラーレポート**: 発生したエラーの詳細情報をJSONファイルに記録
- **処理統計**: 成功率、処理時間、エラー分類などの統計情報を生成
- **進捗報告**: リアルタイムでの処理進捗と統計の表示
- **グレースフルシャットダウン**: 中断時にも現在の状態を保存
- **メモリ管理**: 定期的なガベージコレクションによるメモリ効率化

## 使用方法

### 基本的な使い方

```bash
# テストデータセットでの実行
node scripts/safeBatchRunner.js /app/dataset/test /app/output

# 大量データセットでの実行
node scripts/safeBatchRunner.js /app/dataset/filtered_commit /app/output

# カスタムディレクトリでの実行
node scripts/safeBatchRunner.js /path/to/dataset /path/to/output
```

### 引数

1. **データセットディレクトリ**: 処理対象のデータセットのパス（デフォルト: `/app/dataset/test`）
2. **出力ディレクトリ**: エラーレポートとサマリーレポートの出力先（デフォルト: `/app/output`）

## 出力ファイル

### エラーレポート（error_report_YYYY-MM-DDTHH-MM-SS-sssZ.json）

```json
[
  {
    "timestamp": "2025-07-18T17:45:21.447Z",
    "repositoryName": "servantes",
    "category": "pullrequest",
    "pullRequestTitle": "fix_bug_in_auth",
    "pullRequestPath": "/app/dataset/test/servantes/pullrequest/fix_bug_in_auth",
    "premergeDir": "/app/dataset/test/servantes/pullrequest/fix_bug_in_auth/premerge_42",
    "errorType": "TypeError",
    "errorMessage": "Cannot read property 'length' of undefined",
    "stackTrace": "TypeError: Cannot read property 'length' of undefined\n    at ...",
    "processingPhase": "CONTROLLER_EXECUTION"
  }
]
```

### サマリーレポート（processing_summary_YYYY-MM-DDTHH-MM-SS-sssZ.json）

```json
{
  "totalRepositories": 1,
  "totalCategories": 1,
  "totalPullRequests": 2,
  "successfulPullRequests": 2,
  "failedPullRequests": 0,
  "skippedPullRequests": 0,
  "startTime": "2025-07-18T17:50:53.571Z",
  "endTime": "2025-07-18T17:51:36.499Z",
  "totalDuration": 42928,
  "totalDurationFormatted": "42s",
  "successRate": 100,
  "errorReportPath": "/app/output/error_report_2025-07-18T17-50-53-571Z.json",
  "topErrorTypes": []
}
```

## 処理フロー

1. **初期化**: データセットディレクトリのスキャンと統計の初期化
2. **リポジトリ処理**: 各リポジトリディレクトリの処理
3. **カテゴリ処理**: pullrequest, issueなどのカテゴリ別処理
4. **プルリクエスト処理**: 個別のプルリクエストの安全な処理
5. **エラーハンドリング**: 例外発生時のエラー記録と処理継続
6. **統計更新**: 処理結果の統計情報更新
7. **レポート生成**: 最終的なエラーレポートとサマリーレポートの生成

## エラーハンドリング

### 処理フェーズ

- **DIRECTORY_SCANNING**: ディレクトリスキャン時のエラー
- **CONTROLLER_EXECUTION**: LLMFlowController実行時のエラー

### エラー分類

- **TypeError**: 型エラー
- **ReferenceError**: 参照エラー
- **Error**: 一般的なエラー
- **DirectoryError**: ディレクトリ関連のエラー
- **UnknownError**: 不明なエラー

## 進捗表示

実行中は以下のような進捗情報が表示されます：

```
📊 Progress: 15/100 (15%) - Success: 12, Failed: 2, Skipped: 1
```

## グレースフルシャットダウン

SIGINT（Ctrl+C）やSIGTERMでの中断時に：

1. 現在の処理状態を保存
2. 統計情報をサマリーレポートに記録
3. メモリのクリーンアップ
4. 正常終了

## メモリ管理

- 10個のプルリクエスト処理ごとにガベージコレクション実行
- 大量データセット処理時のメモリ効率化

## 使用例

### 小規模テスト

```bash
# テストデータセットでの動作確認
node scripts/safeBatchRunner.js /app/dataset/test /app/output
```

### 大規模バッチ処理

```bash
# 大量データセットでの本格実行
node scripts/safeBatchRunner.js /app/dataset/filtered_commit /app/output_large

# バックグラウンドでの実行（推奨）
nohup node scripts/safeBatchRunner.js /app/dataset/filtered_commit /app/output_large > batch_processing.log 2>&1 &
```

### 結果確認

```bash
# 処理結果の確認
cat /app/output/processing_summary_*.json

# エラーレポートの確認
cat /app/output/error_report_*.json

# 成功率の確認
jq '.successRate' /app/output/processing_summary_*.json
```

## 注意事項

1. **ディスク容量**: 大量データセット処理時は出力ディレクトリの容量を確認
2. **処理時間**: 大規模データセットでは数時間から数日かかる場合があります
3. **メモリ使用量**: 大量データセット処理時はメモリ使用量を監視
4. **API制限**: OpenAI APIの制限に注意して実行

## トラブルシューティング

### 高いエラー率の場合

1. エラーレポートでエラーパターンを確認
2. 共通のエラー原因を特定
3. LLMFlowControllerの修正を検討

### メモリ不足の場合

1. より小さなバッチサイズでの実行
2. ガベージコレクション頻度の調整
3. システムリソースの確認

### 処理中断の場合

1. 最後のサマリーレポートで進捗を確認
2. 処理済みのプルリクエストを特定
3. 未処理分のみを再実行
