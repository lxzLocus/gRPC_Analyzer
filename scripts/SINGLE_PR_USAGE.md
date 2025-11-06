# 単一PR実行スクリプトの使用方法

## 概要

`scripts/SinglePRScript.js` を作成しました。これは**指定した1つのPRのみ**を実行する専用エントリーポイントです。

## 主な機能

✅ **ハードコーディングでPRを指定** - コマンドライン引数不要
✅ **MVCアーキテクチャの再利用** - 既存のBatchProcessingServiceをそのまま使用
✅ **自動フィルタリング** - リポジトリ・カテゴリ・PRリストを自動絞り込み
✅ **JSTタイムスタンプ対応** - 出力ファイル名とログがJST固定

## 使い方（3ステップ）

### 1️⃣ PRを指定

`scripts/SinglePRScript.js` の先頭部分を編集：

```javascript
const TARGET_PR_CONFIG = {
    datasetDir: "/app/dataset/filtered_fewChanged",
    
    // ⬇️ ここを実際のPR情報に書き換える
    repositoryName: "etcd-io_etcd",      
    category: "breaking_changes",         
    pullRequestTitle: "Pull_13207",       
    
    outputDir: "/app/output/single_pr"
};
```

### 2️⃣ PR存在確認（オプション）

```bash
# PRディレクトリが存在するか確認
ls -la /app/dataset/filtered_fewChanged/etcd-io_etcd/breaking_changes/Pull_13207/
```

### 3️⃣ 実行

```bash
# npmスクリプト経由（推奨）
npm run batch:single-pr

# または直接実行
node scripts/SinglePRScript.js
```

## 出力例

実行すると以下のような表示になります：

```
🎯 Single PR Processing Mode
========================================
📂 Dataset Directory: /app/dataset/filtered_fewChanged
🏷️  Repository: etcd-io_etcd
📁 Category: breaking_changes
📋 Pull Request: Pull_13207
📁 Output Directory: /app/output/single_pr
...
🔍 Checking PR path: /app/dataset/filtered_fewChanged/etcd-io_etcd/breaking_changes/Pull_13207
✅ PR path verified

🚀 Starting single PR processing...
🎯 Filtered to target repository: etcd-io_etcd
🎯 Filtered to target category: breaking_changes
🎯 Filtered to target PR: Pull_13207
...
🎉 Single PR processing completed successfully!
```

生成されるファイル：
- `/app/output/single_pr/error_report_2025-10-30T12-34-56-789+09-00.json`
- `/app/output/single_pr/processing_summary_2025-10-30T12-34-56-789+09-00.json`

## 内部実装

### フィルタリングの仕組み

BatchProcessingServiceに `targetPullRequest` オプションを渡すことで、3段階でフィルタリングします：

```typescript
// src/types/BatchProcessTypes.ts に追加された型定義
interface BatchProcessingOptions {
    ...
    targetPullRequest?: {
        repositoryName: string;
        category: string;
        pullRequestTitle: string;
    };
}
```

```typescript
// src/Service/BatchProcessingService.ts でのフィルタリング
async getRepositories(datasetDir: string): Promise<string[]> {
    const repositories = await this.datasetRepository.getRepositoryList(datasetDir);
    
    if (this.options.targetPullRequest) {
        // 指定リポジトリのみ返す
        return repositories.filter(
            repo => repo === this.options.targetPullRequest!.repositoryName
        );
    }
    return repositories;
}

// getCategories() と getPullRequests() も同様にフィルタリング
```

### MainScript.js との比較

| 項目 | MainScript.js | SinglePRScript.js |
|------|---------------|-------------------|
| **実行対象** | データセット全体 | 指定した1PR |
| **PR指定** | dataset index | ハードコーディング |
| **引数** | あり | なし（全てコード内） |
| **用途** | 本番バッチ | デバッグ/個別テスト |
| **実行時間** | 長時間 | 短時間 |

## トラブルシューティング

### ❌ PR path does not exist

**原因**: 指定したPRが存在しない

**解決策**:
```bash
# データセット構造を確認
ls /app/dataset/filtered_fewChanged/
ls /app/dataset/filtered_fewChanged/repository_name/
ls /app/dataset/filtered_fewChanged/repository_name/category_name/
```

### ⚠️ Target repository not found

**原因**: リポジトリ名が間違っている

**解決策**:
- スペル確認（例: `etcd-io_etcd` vs `etcd_io_etcd`）
- アンダースコア・ハイフンの確認

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `scripts/SinglePRScript.js` | エントリーポイント（**このファイルを編集**） |
| `src/types/BatchProcessTypes.ts` | targetPullRequest型定義 |
| `src/Service/BatchProcessingService.ts` | フィルタリングロジック |
| `scripts/README_SinglePRScript.md` | 詳細ドキュメント |

## 次のステップ

1. **PRを指定**: `scripts/SinglePRScript.js` の `TARGET_PR_CONFIG` を編集
2. **実行**: `npm run batch:single-pr`
3. **出力確認**: `/app/output/single_pr/` 内のJSONファイルを確認

詳細は `scripts/README_SinglePRScript.md` を参照してください。
