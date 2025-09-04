# MainScript.js 使用説明書

**gRPC_Analyzer の新しいメインエントリーポイント (ESM + MVC)**

---

## 🎯 概要

`MainScript.js` は完全にESM形式に統一され、MVCアーキテクチャを使用したgRPC_Analyzerのメインエントリーポイントです。レガシーの`safeBatchRunner.js`から完全移行済みです。

## 🚀 基本使用方法

### コマンドライン実行
```bash
node scripts/MainScript.js [データセット番号] [出力ディレクトリ]
```

### 使用例
```bash
# ヘルプ表示
node scripts/MainScript.js
node scripts/MainScript.js --help
node scripts/MainScript.js -h

# テストデータセットで実行（推奨）
node scripts/MainScript.js 4 /tmp/output

# 特定のデータセットで実行
node scripts/MainScript.js 0 /app/output

# バックグラウンド実行
nohup node scripts/MainScript.js 1 /app/output > processing.log 2>&1 &
```

## 📊 利用可能なデータセット

| 番号 | データセット | 説明 | 規模 |
|-----|-------------|------|------|
| 0 | filtered_fewChanged | 変更少数データセット | 小規模 |
| 1 | filtered_commit | コミットフィルター済み | 中規模 |
| 2 | filtered_confirmed | 確認済みデータセット | 中規模 |
| 3 | filtered_protoChanged | Proto変更データセット | 中規模 |
| 4 | test | テストデータセット | 極小 (推奨) |

## ⚙️ 実行オプション

### 環境変数設定
実行前に `.env` ファイルを設定：
```env
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here  # オプション
LLM_PROVIDER=openai
NODE_ENV=development
DEBUG_MODE=false
```

### パフォーマンス最適化
```bash
# メモリ制限を増加
node --max-old-space-size=4096 scripts/MainScript.js 4 /tmp/output

# ガベージコレクションを有効化  
node --expose-gc scripts/MainScript.js 4 /tmp/output

# 両方を組み合わせ
node --max-old-space-size=4096 --expose-gc scripts/MainScript.js 4 /tmp/output
```

## 📋 実行結果

### 成功時の出力例
```
🚀 MVC Batch Processing Starting...
========================================
📂 Selected Dataset: /app/dataset/test (index: 4)
📁 Output Directory: /tmp/output
🐛 Process ID: 12345
📝 Node.js Version: v18.20.8

⚙️ Processing Options:
   Max Retries: 3
   Memory Cleanup Interval: 5
   Timeout: 1800s
   Garbage Collection: Enabled
========================================

🎮 MVC Controller Integration: Starting full implementation...
🚀 Starting MVC batch processing...
📊 Found 2 repositories to process

🔄 Processing repository: servantes
  📁 Category servantes/pullrequest
    ✅ add_Secrets_service-_global_yaml (27s)
    ✅ fix_up_protobufs_and_improve_ci (29s)

🎉 MVC batch processing completed successfully!
========================================
✅ Success: 2/2
📊 Success Rate: 100.0%
❌ Failed: 0
⏭️ Skipped: 0
⏱️ Total Duration: 55s
========================================
```

### 生成されるファイル
```
# 指定した出力ディレクトリ
/tmp/output/
├── error_report_2025-09-04T16-09-19-005Z.json      # エラーレポート
├── processing_summary_2025-09-04T16-09-19-005Z.json # 処理統計
└── [その他の処理結果ファイル]

# プロジェクトの出力ディレクトリ
/app/output/
├── error_report_2025-09-04T16-09-19-006Z.json      # 統合エラーレポート  
├── processing_summary_2025-09-04T16-09-19-006Z.json # 統合処理統計
└── [バックアップファイル]
```

## 🐛 トラブルシューティング

### よくあるエラー

**1. データセット番号が無効**
```
❌ Error: Invalid dataset index 5. Available: 0-4
```
→ 有効な番号（0-4）を使用してください

**2. 出力ディレクトリの権限エラー**
```
❌ Error: Permission denied: /restricted/path
```
→ 書き込み権限のあるディレクトリを指定してください

**3. API キーエラー**
```
❌ Error: OpenAI API key not found
```
→ `.env`ファイルの`OPENAI_API_KEY`を確認してください

**4. メモリ不足**
```
❌ Error: JavaScript heap out of memory
```
→ `--max-old-space-size`オプションを使用してください

### デバッグ方法

**詳細ログの有効化**
```bash
DEBUG_MODE=true node scripts/MainScript.js 4 /tmp/output
```

**ログファイルの確認**
```bash
# パフォーマンスログ
ls -la /app/logs/performance/

# エラーログ詳細
cat /tmp/output/error_report_*.json | jq '.'

# 処理統計  
cat /tmp/output/processing_summary_*.json | jq '.'
```

## 🔧 高度な使用方法

### プログラム内での使用
```javascript
import { datasetLoop } from '../src/Controller/Controller.js';

async function customProcessing() {
    const stats = await datasetLoop(
        '/app/dataset/test',
        '/tmp/custom_output',
        {
            maxRetries: 5,
            memoryCleanupInterval: 3,
            timeoutMs: 3600000,        // 1時間
            enableGarbageCollection: true,
            generateReport: true,
            generateErrorReport: true
        }
    );
    
    console.log(`Success Rate: ${stats.successRate}%`);
    console.log(`Total Duration: ${stats.totalDuration}ms`);
}
```

### 統計情報の活用
```javascript
const stats = await datasetLoop(datasetPath, outputPath);

// 処理結果の分析
if (stats.successRate >= 90) {
    console.log('高い成功率で処理完了');
} else if (stats.hasErrors) {
    console.error('エラーが発生:', stats.finalError);
}

// パフォーマンス情報
const avgTimePerPR = stats.totalDuration / stats.totalPullRequests;
console.log(`平均処理時間: ${avgTimePerPR}ms/PR`);
```

## 📈 パフォーマンス

### 処理時間の目安
- **test** (2 PRs): ~1分
- **filtered_fewChanged** (数十 PRs): ~5-15分  
- **filtered_commit** (数百 PRs): ~30分-2時間
- **大規模データセット** (1000+ PRs): ~2時間以上

### 最適化のコツ
1. テストデータセットで動作確認
2. 本格実行前にメモリ使用量を監視  
3. 大規模データセットはバックグラウンド実行を推奨
4. APIレート制限に注意

---

**Note**: このスクリプトは完全にESM形式に統一されており、レガシーの`safeBatchRunner.js`は不要になりました。
