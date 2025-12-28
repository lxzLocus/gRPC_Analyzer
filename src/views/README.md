# Blessed TUI View - Quick Start

## テスト実行

```bash
# ビルドしてテストを実行
npm run test:blessed
```

## MainScript.js での使用

### 環境変数で有効化

```bash
# /app ディレクトリから実行
cd /app

# Blessed TUI を有効化
USE_BLESSED_VIEW=true node scripts/MainScript.js

# 従来のANSI表示（現在のデフォルト）
node scripts/MainScript.js
```

### コード内で有効化

MainScript.js を編集:

```javascript
// Before
const progressTracker = new ProgressTracker(
    totalCategories * datasetEntries.length,
    true,
    quietMode
);

// After - Blessed TUI を有効化
const progressTracker = new ProgressTracker(
    totalCategories * datasetEntries.length,
    true,
    quietMode,
    true  // useBlessedView
);
```

## キーボードショートカット

実行中に以下のキーで操作できます：

- `Q` または `ESC`: 終了
- `R`: 画面を手動リフレッシュ
- `H` または `?`: ヘルプを表示
- `↑` / `↓`: ログをスクロール
- `PgUp` / `PgDn`: 高速スクロール

## トラブルシューティング

### "Blessed View が表示されない"

TTYが必要です。Dockerコンテナ内で実行する場合：

```bash
# インタラクティブモードで実行
docker exec -it <container> bash
cd /app
npm run test:blessed
```

### "パスエラー: Cannot find module '/app/scripts/scripts/MainScript.js'"

`/app/scripts` ディレクトリから実行するとパスが重複します。
必ず `/app` ディレクトリから実行してください：

```bash
# 正しい
cd /app
node scripts/MainScript.js

# 誤り
cd /app/scripts
node scripts/MainScript.js  # パスが /app/scripts/scripts/MainScript.js になる
```

### "文字が崩れる"

UTF-8とTERMを設定：

```bash
export LANG=ja_JP.UTF-8
export TERM=xterm-256color
```

## 機能比較

| 項目 | ANSI表示 | Blessed TUI |
|------|----------|-------------|
| 複雑さ | シンプル | リッチ |
| グラフ | なし | あり |
| ログ分割 | 順次 | 4分割 |
| 操作 | 限定的 | 対話的 |
| 起動速度 | 速い | やや遅い |

詳細は [BLESSED_TUI_VIEW.md](../docs/BLESSED_TUI_VIEW.md) を参照してください。
