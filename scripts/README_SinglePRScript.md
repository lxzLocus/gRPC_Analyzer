# Single PR Script - 単一PRのみ実行

## 概要

`SinglePRScript.js` は、データセット内の**1つのPRのみ**を実行するための専用エントリーポイントです。通常の `MainScript.js` がデータセット全体を走査するのに対し、このスクリプトはハードコーディングで指定したPRだけを処理します。

## 使い方

### 1. PRの指定（ハードコーディング）

`scripts/SinglePRScript.js` の冒頭部分でPR情報を編集します：

```javascript
const TARGET_PR_CONFIG = {
    // データセットのベースディレクトリ
    datasetDir: "/app/dataset/filtered_fewChanged",
    
    // PR情報（データセットディレクトリ構造に合わせて指定）
    repositoryName: "etcd-io_etcd",           // リポジトリ名
    category: "breaking_changes",             // カテゴリ名
    pullRequestTitle: "Pull_13207",           // PRタイトル（ディレクトリ名）
    
    // 出力ディレクトリ
    outputDir: "/app/output/single_pr"
};
```

### 2. 実行

#### npmスクリプトで実行（推奨）

```bash
npm run batch:single-pr
```

#### 直接実行

```bash
node scripts/SinglePRScript.js
```

## 実行例

### 設定例1: etcd-io_etcd/breaking_changes/Pull_13207

```javascript
const TARGET_PR_CONFIG = {
    datasetDir: "/app/dataset/filtered_fewChanged",
    repositoryName: "etcd-io_etcd",
    category: "breaking_changes",
    pullRequestTitle: "Pull_13207",
    outputDir: "/app/output/single_pr"
};
```

実行結果：
- JST タイムスタンプ付きのエラーレポート： `/app/output/single_pr/error_report_YYYY-MM-DDTHH-MM-SS-sss+09-00.json`
- 処理サマリー： `/app/output/single_pr/processing_summary_YYYY-MM-DDTHH-MM-SS-sss+09-00.json`

### 設定例2: 別のリポジトリ/カテゴリを試す

```javascript
const TARGET_PR_CONFIG = {
    datasetDir: "/app/dataset/filtered_confirmed",
    repositoryName: "grpc_grpc",
    category: "bug_fixes",
    pullRequestTitle: "Pull_12345",
    outputDir: "/app/output/test_single"
};
```

## PRパスの確認方法

データセット構造は以下のようになっています：

```
/app/dataset/filtered_fewChanged/
├── repository_name/
│   ├── category_name/
│   │   ├── Pull_XXXXX/
│   │   │   ├── premerge_abc123/
│   │   │   ├── merge_def456/
│   │   │   └── ...
```

例えば、以下のパスが存在する場合：

```
/app/dataset/filtered_fewChanged/etcd-io_etcd/breaking_changes/Pull_13207/
```

設定は：

```javascript
datasetDir: "/app/dataset/filtered_fewChanged",
repositoryName: "etcd-io_etcd",
category: "breaking_changes",
pullRequestTitle: "Pull_13207"
```

## 処理オプションのカスタマイズ

`PROCESSING_OPTIONS` を編集して処理設定を変更できます：

```javascript
const PROCESSING_OPTIONS = {
    baseOutputDir: TARGET_PR_CONFIG.outputDir,
    maxRetries: 3,                     // リトライ回数
    memoryCleanupInterval: 5,          // メモリクリーンアップ間隔
    timeoutMs: 15 * 60 * 1000,         // タイムアウト（15分）
    enableGarbageCollection: true,     // GC有効化
    enablePreVerification: false,      // 事前検証
    
    // 内部的に使用（編集不要）
    targetPullRequest: {
        repositoryName: TARGET_PR_CONFIG.repositoryName,
        category: TARGET_PR_CONFIG.category,
        pullRequestTitle: TARGET_PR_CONFIG.pullRequestTitle
    }
};
```

## 出力ファイル

### エラーレポート（error_report_*.json）

```json
[
  {
    "timestamp": "2025-10-30T12:34:56.789+09:00",
    "repositoryName": "etcd-io_etcd",
    "category": "breaking_changes",
    "pullRequestTitle": "Pull_13207",
    "errorType": "ProcessingFailure",
    "errorMessage": "LLM timeout",
    "processingPhase": "LLM Processing",
    ...
  }
]
```

### 処理サマリー（processing_summary_*.json）

```json
{
  "totalRepositories": 1,
  "totalCategories": 1,
  "totalPullRequests": 1,
  "successfulPullRequests": 1,
  "failedPullRequests": 0,
  "skippedPullRequests": 0,
  "startTime": "2025-10-30T12:34:00.000Z",
  "endTime": "2025-10-30T12:45:00.000Z",
  "endTimeJST": "2025-10-30T21:45:00.000+09:00",
  "startTimeJST": "2025-10-30T21:34:00.000+09:00",
  "totalDuration": 660000,
  "totalDurationFormatted": "11m 0s",
  "successRate": 100,
  ...
}
```

## MainScript.js との違い

| 項目 | MainScript.js | SinglePRScript.js |
|------|---------------|-------------------|
| 実行対象 | データセット全体 | 指定した1つのPR |
| PR指定方法 | データセットインデックス | ハードコーディング |
| 用途 | 本番バッチ処理 | デバッグ/単体テスト |
| 実行時間 | 長時間（データセット全体） | 短時間（1PR分） |
| コマンドライン引数 | あり（dataset index等） | なし（全てコード内で指定） |

## トラブルシューティング

### エラー: PR path does not exist

```
❌ PR path does not exist: /app/dataset/...
```

**原因**: 指定したPRが存在しない

**解決策**:
1. データセットディレクトリを確認
2. リポジトリ名・カテゴリ名・PRタイトルのスペルを確認
3. ディレクトリ構造を確認：
   ```bash
   ls -la /app/dataset/filtered_fewChanged/
   ls -la /app/dataset/filtered_fewChanged/repository_name/
   ls -la /app/dataset/filtered_fewChanged/repository_name/category_name/
   ```

### エラー: Target repository not found

```
⚠️  Target repository not found: etcd-io_etcd
```

**原因**: データセット内に該当リポジトリが存在しない

**解決策**:
1. `datasetDir` が正しいか確認
2. リポジトリ名のスペル・アンダースコアを確認（例: `etcd-io_etcd` vs `etcd_io_etcd`）

### 実行が始まらない

**確認事項**:
1. TypeScriptがビルド済みか確認：`npm run build`
2. .envファイルが存在し、LLM APIキーが設定されているか確認
3. Node.jsバージョンを確認（ES modules対応版が必要）

## 実装の仕組み

SinglePRScript.js は内部的に以下のように動作します：

1. **ハードコーディングされたPR情報を読み込み**
2. **targetPullRequest オプションをBatchProcessingServiceに渡す**
3. **BatchProcessingServiceが各リストをフィルタリング**:
   - `getRepositories()` → 指定リポジトリのみ返す
   - `getCategories()` → 指定カテゴリのみ返す
   - `getPullRequests()` → 指定PRのみ返す
4. **通常通りの処理フロー**で1PRのみ実行

つまり、内部的には通常のバッチ処理と同じコードパスを使いますが、フィルタリングによって単一PRだけが実行されます。

## 関連ファイル

- `/app/scripts/SinglePRScript.js` - 本スクリプト（エントリーポイント）
- `/app/src/Service/BatchProcessingService.ts` - フィルタリングロジック
- `/app/src/types/BatchProcessTypes.ts` - targetPullRequest型定義
- `/app/scripts/MainScript.js` - 通常の全体バッチスクリプト

## 参考

- [MainScript.js README](./README_MainScript.md) - 全体バッチ処理の説明
- [SafeBatchRunner README](./README_SafeBatchRunner.md) - 旧バッチランナーの説明
