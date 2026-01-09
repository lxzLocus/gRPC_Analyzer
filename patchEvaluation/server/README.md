# APR Evaluation API Server - レポートベース版

APRシステムによって生成されたパッチ評価結果を **レポートごと > PR/Issue別** に閲覧するWebサーバーです。

## 🎯 新しいアプローチ

**旧構造の問題点：**
- ログが APRツール名別に分散
- セッション・PR の管理が複雑

**新構造：レポートベース**
```
評価レポート (/app/output/detailed_analysis_report_*.json)
    ↓
PR/Issue 一覧
    ↓
評価結果詳細
```

## 📁 データ構造

### 評価レポートファイル
```
/app/output/
├── detailed_analysis_report_260102_082636.json
├── detailed_analysis_report_260102_025839.json
└── ...
```

各レポートには：
- 複数の PR/Issue の評価結果
- 正確性レベル別の分類（identical, semanticallyEquivalent, plausibleButDifferent, incorrect）
- 詳細な評価理由と類似度スコア

### 既存のAPRログ（参照のみ）
```
/app/apr-logs/
├── [APRツール名]/
│   ├── pullrequest/
│   │   └── [PR名]/
│   │       └── ログファイル
│   └── issue/
│       └── ...
└── ...
```
※このディレクトリは変更不要。レポートファイルが主データソース。

## 🚀 起動方法

```bash
npm install
npm run server
```

デフォルトでは `http://localhost:3000` でサーバーが起動します。

## 📡 新しいAPI構造

### レポート管理

- `GET /api/reports` - 評価レポート一覧
- `GET /api/reports/:sessionId` - レポートの完全な内容
- `GET /api/reports/:sessionId/statistics` - レポートの詳細統計情報
- `GET /api/reports/:sessionId/prs` - レポート内のPR/Issue一覧
- `GET /api/reports/:sessionId/prs/:datasetEntry` - 特定PR/Issueの評価詳細
- `GET /api/reports/statistics/summary` - 統計情報

## 🌐 Webビューワー

`http://localhost:3000` にアクセス

### 階層構造

1. **評価レポート一覧**（左サイドバー）
   - 日付別のレポート
   - 各レポートのPR数と正確性の概要

2. **レポート統計ビュー**（レポート選択時）
   - 📊 総PR/Issue数、成功率、平均変更行数
   - 🎯 正確性レベル分布（バーチャート）
   - 📊 意味的類似度分布（低/中/高）
   - 🤖 APRプロバイダー・モデル別統計
   - 📋 評価ステータス

3. **PR/Issue 一覧**
   - レポート内の全PR/Issue
   - 正確性レベル別に色分け
   - 意味的類似度スコア表示

3. **評価結果詳細**
   - 基本情報（プロジェクト名、変更行数、APRモデル等）
   - 評価理由
   - 類似度の理由
   - 妥当性の理由
   - 完全なJSONデータ

### 正確性レベル

- ✅ **完全一致** (IDENTICAL)
- ✅ **意味的等価** (SEMANTICALLY_EQUIVALENT)
- ⚠️ **妥当だが異なる** (PLAUSIBLE_BUT_DIFFERENT)
- ❌ **不正解** (INCORRECT)

## 📊 使用例

```bash
# レポート一覧
curl http://localhost:3000/api/reports

# レポートの詳細統計
curl http://localhost:3000/api/reports/260102_082636/statistics

# 特定レポートのPR一覧
curl http://localhost:3000/api/reports/260102_082636/prs

# 統計情報
curl http://localhost:3000/api/reports/statistics/summary
```

## 📝 MainScript.js との連携

MainScript.js が生成する `detailed_analysis_report_*.json` ファイルを自動的に検出・表示します。

## 🐳 Docker環境

```yaml
services:
  apr-server:
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
```

## ✅ 利点

1. **シンプルな階層構造** - レポート → PR の2階層
2. **既存ログ構造を変更不要** - `/app/apr-logs/` はそのまま
3. **評価結果の完全な情報** - 正確性・類似度・詳細理由
4. **統計情報の自動集計** - 成功率など

## 📝 注意事項

- レポートファイル（`/app/output/detailed_analysis_report_*.json`）が必要
- ポート3000でサーバーが起動
