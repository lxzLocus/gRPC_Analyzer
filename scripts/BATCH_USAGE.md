#!/bin/bash

# Batch.sh テスト用ドキュメント

## 実装完了

✅ **batch.sh スクリプト作成完了**
- 場所: `/app/scripts/batch.sh`
- 実行権限: 付与済み

## 機能

### 1. 各PRごとにプロセス分離
- `npx tsx /app/src/utils/autoResponser.ts` を個別に実行
- 各実行後にnodeプロセスが完全に終了
- メモリリークの防止

### 2. 並列実行サポート
- デフォルト: 順次実行（並列数=1）
- 推奨: 2並列実行
- 最大: 4並列以上も可能（システムリソース次第）

### 3. タイムアウト機能
- 各PR処理に5分（300秒）のタイムアウト
- 無限ループやハングアップを防止

### 4. 詳細ログ
- `progress.log`: 全体の進捗ログ
- `success.log`: 成功したPRリスト
- `error.log`: 失敗したPRリストと理由

## 使用方法

### 基本（順次実行）
```bash
cd /app
source .env
./scripts/batch.sh /app/dataset/filtered_confirmed
```

### 2並列実行（推奨）
```bash
cd /app
source .env
./scripts/batch.sh /app/dataset/filtered_confirmed 2
```

### 4並列実行
```bash
cd /app
source .env
./scripts/batch.sh /app/dataset/filtered_confirmed 4
```

## 依存パッケージ

✅ **すべてインストール済み**
- `bash`: インストール済み（Alpine Linux）
- `parallel` (GNU parallel): インストール済み

## テスト手順

### 小規模テスト（1件）
```bash
cd /app
source .env

# テスト用データセット作成
mkdir -p /tmp/test_dataset/boulder/issue
cp -r /app/dataset/filtered_confirmed/boulder/issue/Implement_RA_method_for_unpausing_accounts \
      /tmp/test_dataset/boulder/issue/

# 実行
./scripts/batch.sh /tmp/test_dataset 1
```

### 中規模テスト（10件程度）
```bash
cd /app
source .env

# filtered_confirmedから10件抽出
# （実際のコマンドは環境に応じて調整）

./scripts/batch.sh /path/to/10cases 2
```

### 大規模実行（全件）
```bash
cd /app
source .env

# 全filtered_confirmed実行（時間がかかる）
./scripts/batch.sh /app/dataset/filtered_confirmed 2
```

## 並列実行の仕組み

### GNU parallel使用
```bash
parallel -j 2 --line-buffer --tagstring "[{#}/$TOTAL]" \
    process_pr {} {#} "$TOTAL" :::: pr_list.txt
```

- `-j 2`: 2並列実行
- `--line-buffer`: 行バッファリング（出力の混在を防ぐ）
- `--tagstring`: 進捗表示タグ
- `process_pr`: 各PR処理関数

### 並列実行時の考慮事項

#### メリット
✅ 実行時間の大幅短縮（2並列で約50%短縮）
✅ プロセス分離によるメモリ管理の改善
✅ エラー分離（1件の失敗が他に影響しない）

#### 注意点
⚠️ **API Rate Limit**: OpenAI APIのレート制限に注意
⚠️ **メモリ使用量**: 並列数 × プロセスメモリ
⚠️ **ログの混在**: progress.logで多少の混在の可能性

#### 推奨設定
- **2並列**: バランスが良い（推奨）
- **4並列**: リソースに余裕がある場合
- **1並列**: 安全重視、デバッグ時

## 出力例

```
[INFO] Dataset directory: /app/dataset/filtered_confirmed
[INFO] Parallel jobs: 2
[INFO] Collecting PR directories...
[SUCCESS] Found 71 PR directories
[INFO] Results will be saved to: /app/output/batch_results/20260127_103000
[INFO] Starting batch processing with 2 parallel jobs...
[INFO] [1/71] Processing: boulder/Implement_RA_method_for_unpausing_accounts
[INFO] [2/71] Processing: daos/DAOS-10037_mgmt
[SUCCESS] [1/71] ✅ boulder/Implement_RA_method_for_unpausing_accounts
[SUCCESS] [2/71] ✅ daos/DAOS-10037_mgmt
...
========================================
🎉 Batch processing completed
========================================
Total PRs:       71
✅ Success:      65
❌ Failed:       6
⏱️  Duration:     45m 23s
📊 Success Rate: 91.5%

📁 Results saved to: /app/output/batch_results/20260127_103000
```

## トラブルシューティング

### parallel not found
```bash
apk add --no-cache parallel
```

### bash not found
```bash
apk add --no-cache bash
```

### Permission denied
```bash
chmod +x /app/scripts/batch.sh
```

### .env not found
```bash
cp /app/.env.example /app/.env
# .envファイルを編集してAPIキーを設定
```

## 次のステップ

1. ✅ batch.sh作成完了
2. ⏭️ 小規模テスト実行（1-5件）
3. ⏭️ 中規模テスト実行（10-20件）
4. ⏭️ 大規模実行（全filtered_confirmed）
5. ⏭️ patchEvaluationで結果評価
