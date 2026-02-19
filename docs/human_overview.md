---
title: "プロジェクト概要"
tags: ["overview", "human"]
component: "grpc_analyzer"
last_updated: "2026-02-01"
---

# gRPC Analyzer – 人間向け概要ドキュメント

## プロジェクトの目的
このプロジェクトは **gRPC / Protocol Buffers** のスキーマ差分（diff）を入力として、Automated Program Repair（APR）手法を研究・実装することを目的としています。

## 背景・研究動機
- スキーマ変更によるバグや互換性問題は手作業での修正がコスト高。
- 差分情報だけから自動的にパッチ候補を生成し、評価コンテナで品質を測定することで、再現性のある実験基盤を提供します。

## 主なコンポーネント
- **gRPC_Analyzer** (メインルート `/app` にマウント) – diff 解析・パッチ生成ロジック。
- **patchEvaluation** (別コンテナ) – 生成したパッチを評価し、修復結果を出力します。直接的な依存関係は作りません。

## データセット配置
- コンテナ内: `app/gRPC_Analyzer/dataset`
- ホスト側実体: `E:\Workspace\gRPC_Analyzer\dataset` (Docker Compose の bind‑mount により同期)

## ビルド・実行手順
```bash
docker compose up --build   # データセットが自動でマウントされます
```

## コーディング規約・命名規則
- 変数は **camelCase**、定数は **CONSTANT_CASE**、関数は **snake_case**（`CLAUDE.md` を参照）。
- APR に関する語彙は `diff`, `patch`, `repair`, `candidate`, `evaluation`, `schema` を優先します。

## 参考情報
- 詳細な設計・実装は同ディレクトリの `design_jp.md`, `implementation_jp.md`, `examples_jp.md` を参照してください。