# Diff Viewer 機能ガイド

## 概要

APR Evaluation Viewer に GitHub スタイルの Diff Viewer が追加されました。PR詳細画面で以下のDiffを確認できます：

- **Ground Truth Diff**: コミット前状態（premerge）とコミット後状態（merge/commit_snapshot）の比較

## 機能

### 1. Diff表示
- PR詳細画面に「変更差分 (Ground Truth)」セクションが追加されます
- 変更されたファイルごとにタブで切り替えが可能
- diff2htmlライブラリを使用したGitHubスタイルの表示

### 2. サポートされるDiff
- **Premerge vs Merge/Commit Snapshot**: プルリクエストのGround Truth変更を表示

## API エンドポイント

### GET /api/reports/:sessionId/prs/:datasetEntry/diffs

PR の Diff 情報を取得します。

**パラメータ:**
- `sessionId`: レポートID（例: `250920_135845`）
- `datasetEntry`: URLエンコードされたデータセットエントリ（例: `boulder%2Fpullrequest%2FAllow_WFEv1_to_specify_which_issuer_to_use`）

**レスポンス:**
```json
{
  "available": true,
  "premergeDir": "/app/dataset/filtered_fewChanged/boulder/pullrequest/...",
  "postmergeDir": "/app/dataset/filtered_fewChanged/boulder/pullrequest/...",
  "changedFiles": ["ca/ca.go", "ra/ra.go", ...],
  "diffs": [
    {
      "fileName": "ca/ca.go",
      "diff": "--- a/ca/ca.go\n+++ b/ca/ca.go\n@@ -1,10 +1,12 @@\n..."
    }
  ]
}
```

## データセット構造

Diff生成には以下のディレクトリ構造が必要です：

```
/app/dataset/
  └── filtered_fewChanged/
      └── [project]/
          └── pullrequest/
              └── [PR_name]/
                  ├── premerge/           # コミット前のコード
                  ├── commit_snapshot_*/  # または merge/
                  └── 03_fileChanges.txt  # 変更ファイルリスト（JSON配列）
```

## 実装詳細

### フロントエンド
- `server/public/app.js`: Diff取得とレンダリングロジック
- `server/public/index.html`: Diff2Html CSS/JS CDNの統合

### バックエンド
- `server/services/ReportBasedLogService.js`: Diff生成ロジック
  - `getPRDiffs()`: Diffメタデータの取得
  - `generateFileDiff()`: Unified Diff形式の生成
- `server/routes/reports.js`: Diff APIエンドポイント

### 使用ライブラリ
- **diff2html**: GitHubスタイルのDiff表示（CDN経由）
  - CSS: `https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css`
  - JS: `https://cdn.jsdelivr.net/npm/diff2html/bundles/js/diff2html-ui.min.js`

## 使用方法

1. サーバーを起動:
   ```bash
   cd /app && node server/server.js
   ```

2. ブラウザで `http://localhost:3000` を開く

3. レポートを選択 → PR/Issue を選択

4. PR詳細画面で「変更差分 (Ground Truth)」セクションを確認

5. タブをクリックして異なるファイルのDiffを表示

## トラブルシューティング

### "Diff情報の読み込みに失敗しました"
- データセットに `premerge/` と `commit_snapshot_*/` または `merge/` ディレクトリが存在するか確認
- `03_fileChanges.txt` ファイルが存在し、有効なJSON配列形式か確認

### Diffが表示されない
- ブラウザの開発者コンソールでエラーを確認
- diff2html CDNが正しく読み込まれているか確認

### "Dataset entry not found"
- `filtered_fewChanged`, `filtered_confirmed`, `filtered_commit`, `filtered_protoChanged` のいずれかにPRが存在するか確認

## 今後の拡張

- [ ] APRパッチDiffの表示
- [ ] 3カラム比較ビュー（premerge | merge | APR patch）
- [ ] Diffのダウンロード機能
- [ ] ファイルツリービュー
