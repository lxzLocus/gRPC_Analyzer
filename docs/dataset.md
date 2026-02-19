# データセット構成

本ドキュメントでは、`dataset/` ディレクトリの構造と、LLM に渡すプロンプト変数ファイル（01〜05）の生成基準を説明する。

---

## ディレクトリ構造

### 全体構成

```
dataset/
├── gRPC_reps_list.csv                           # 対象リポジトリの一覧
├── P.U_merged_filtered - Final_merged_...csv    # フィルタリング済みマスターリスト
├── filtered_fewChanged/                         # 少数変更ファイル（デフォルトデータセット）
├── filtered_confirmed/                          # 確認済みデータ
├── filtered_commit/                             # コミット履歴データ
├── filtered_protoChanged/                       # プロトコル変更データ
├── filtered_bugs/                               # バグフィルタリング済み
├── raw_cloned/                                  # クローン元の生データ
├── incorrect/                                   # 不正データ
├── incorrect_few/                               # 不正データ（少数）
├── old_filtered_fewChanged/                     # 旧版フィルタリングデータ
├── test_no_changes/                             # 変更なしテストデータ
└── tmp/                                         # 一時ファイル
```

### 利用可能なデータセット（MainScript.js）

| Index | パス | 説明 |
|-------|------|------|
| 0 | `dataset/filtered_fewChanged` | 少数変更ファイル（デフォルト） |
| 1 | `dataset/filtered_confirmed` | 確認済みデータ |
| 2 | `dataset/filtered_commit` | コミット履歴データ |
| 3 | `dataset/filtered_protoChanged` | プロトコル変更データ |
| 4 | `dataset/test` | テスト用データ |

---

## リポジトリ単位の構造

各データセットディレクトリの内部は、以下のように構成される。

```
dataset/filtered_fewChanged/
└── REPOSITORY_NAME/                    # 対象プロジェクト名
    └── pullrequest/                    # PR / Issue の区分
        └── PULLREQUEST_NAME/           # PR タイトルまたは ID
            ├── premerge_xxxxx/         # 変更前のスナップショット（LLM 修正の入力）
            ├── merge_xxxxx/            # 変更後のスナップショット（diff 計算・評価用）
            │   または
            ├── commit_snapshot_xxx/    # merge の代替スナップショット
            ├── 01_proto.txt            # Proto ファイル情報
            ├── 02_protoFileChanges.txt # Proto 差分情報
            ├── 03_fileChanges.txt      # 変更ファイル一覧
            ├── 04_surroundedFilePaths.txt  # プロジェクト構造
            └── 05_suspectedFiles.txt   # 疑わしい手書きファイル
```

- **`premerge_xxx/`**: LLM エージェントが修正対象とする入力ディレクトリ
- **`merge_xxx/`**: 修正後の正解状態（diff 計算や自動評価に利用）
- **`commit_snapshot_xxx/`**: merge がない場合の代替スナップショット
- **`01〜05_xxx.txt`**: `src/utils/generatePrompt.ts` により生成されるプロンプト変数ファイル

---

## プロンプト変数ファイル（01〜05）

### 1. `01_proto.txt` — Proto ファイル情報

各 `.proto` ファイルを以下のように分類して出力する:

| 区分 | 内容 |
|------|------|
| 変更された proto ファイル | フル内容を含む |
| import された proto ファイル | 依存関係解析で特定、フル内容を含む |
| その他の proto ファイル | パスのみリスト化 |

### 2. `02_protoFileChanges.txt` — Proto 差分情報

- `premerge` と `merge`（または `commit_snapshot`）間の diff
- `.proto` ファイルのみが対象
- 変更がない場合は空

### 3. `03_fileChanges.txt` — 変更ファイル一覧

- 全ての変更されたファイルパスを JSON 配列形式で出力
- ファイルタイプに関係なく全て含む
- `premerge` と `merge` 間の差分から自動抽出

### 4. `04_surroundedFilePaths.txt` — プロジェクト構造

- ディレクトリ構造を 5 階層の深さまで詳細取得
- ファイルを `proto`, `generated`, `handwritten` に自動分類

**自動生成ファイルの判定パターン**:
```
.pb., _pb2., .pb2., .pb.go, .pb.cc, .pb.h, .pb.rb, .pb.swift
```

**除外パターン**:
```
.md, .log, .lock, .png, .jpg, Dockerfile, LICENSE, .github/, docs/
```

### 5. `05_suspectedFiles.txt` — 疑わしい手書きファイル

フィルタリング済みの手書きファイルに対して、`.proto` 変更との関連度をスコアリングする。

#### スコアリング基準

| 基準 | 条件 | 加点 |
|------|------|------|
| ファイル役割ボーナス | `main.go`, `server.go`, `client.go`, `app.py`, `index.js` | +20 |
| ファイル役割ボーナス | `.yaml`, `deployment/` | +10 |
| ファイル役割ボーナス | `Tiltfile`, `Dockerfile` | +5 |
| Proto 関連度ボーナス | ファイル名が proto ファイル名と一致 | +15 |
| Proto 関連度ボーナス | 内容に proto 変更名が含まれる | +30 |
| 変更インパクトボーナス | 差分が存在する | +5 |

#### 出力ルール

- **上位 3 位まで**: 変更前のファイル内容をフル出力
- **4 位以下**: スコアとパスのみ
- **手書きファイルなし**: 説明メッセージを出力

---

## CSV マスターリスト

### `gRPC_reps_list.csv`

対象リポジトリの一覧。データセットのフィルタリングや選定に使用される。

### `P.U_merged_filtered - Final_merged_...csv`

フィルタリング基準を適用済みの最終マスターリスト。各 PR に対するメタ情報（コミットハッシュ、除外フラグ等）を含む。

---

## 前提条件

### 必須ディレクトリ構造

各 PR ディレクトリには最低限以下が必要:

```
pullrequest_directory/
├── premerge_xxxxx/     # 変更前の状態（必須）
└── merge_xxxxx/        # 変更後の状態（必須）
    または
    commit_snapshot_xxx/ # merge の代替
```

### エラー時の挙動

| 条件 | 挙動 |
|------|------|
| `premerge` ディレクトリなし | 処理スキップ（skippedPullRequests++) |
| `merge` ディレクトリなし | `commit_snapshot` を探索、なければスキップ |
| ファイルアクセスエラー | ログに記録し、空の内容で継続 |
