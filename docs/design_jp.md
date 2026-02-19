---
title: "設計ドキュメント（日本語）"
tags: ["design", "human"]
component: "grpc_analyzer"
last_updated: "2026-02-01"
---

# 設計概要 (日本語)

## 背景・思想
本研究は **gRPC / Protocol Buffers** のスキーマ差分（diff）を入力として、Automated Program Repair（APR）手法で自動的に修正パッチを生成することを目的としています。\
- 手作業のパッチ適用は時間がかかりミスが起きやすい。\
- 差分情報だけで修復候補を提示できれば、実験再現性・トレーサビリティが向上する。

## アーキテクチャ概要
```mermaid
flowchart LR
    subgraph Analyzer [/app]
        A[diff 解析] --> B[パッチ候補生成]
    end
    subgraph Evaluation [patchEvaluation コンテナ]
        C[パッチ評価] --> D[修復結果出力]
    end
    A --> C
    B --> C
```
- **gRPC_Analyzer** はメインコンテナで `/app` としてマウントされ、差分解析・パッチ生成を行う。
- **patchEvaluation** は別コンテナで実行され、生成されたパッチの品質評価のみを担当。直接的なコード依存は作らない。

## データフロー
1. `diff` ファイル → **parse_diff**（`src/diff_parser.py`）
2. 解析結果 → **generate_candidate_patches**（`src/patch_generator.py`）
3. 候補パッチ集合 → `patchEvaluation` コンテナへ送信
4. 評価結果 → 修復レポート (`reports/`) に出力

## 命名規則・コーディングスタイル (CLAUDE.md 参照)
- ファイル名は **camelCase**（プログラム）／**kebab-case**（ドキュメント）。\
- 変数は camelCase、定数は CONSTANT_CASE、関数は snake_case。
- APR 関連語彙は `diff`, `patch`, `repair`, `candidate`, `evaluation`, `schema` を優先使用。

## 主要アルゴリズムと Why コメント例
```python
# src/diff_parser.py:42
def parse_diff(diff_text):
    """差分テキストを構文木に変換する。\
    Why: diff の行単位情報だけでは AST 解析が困難なため、まず文字列 → 構造体へ正規化する必要がある。"""
    ...
```

## 今後の拡張方針 (TODO)
- 複数言語対応（proto + OpenAPI）\
- 高速評価用 Redis キャッシュ導入（※別コンテナ依存は避ける）
