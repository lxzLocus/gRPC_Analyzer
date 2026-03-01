#!/bin/bash
# link_premerge.sh
# filtered_* 内の premerge ディレクトリを raw_cloned へのシンボリックリンクに置換し、ディスクを節約する
# コンテナ内で実行: bash /app/.docker/link_premerge.sh [--dry-run|--verify]

set -euo pipefail

DATASET_DIR="/app/dataset"
RAW_DIR="$DATASET_DIR/raw_cloned"
FILTERED_DIRS=("filtered_protoChanged" "filtered_commit" "filtered_fewChanged")

MODE="execute"
case "${1:-}" in
    --dry-run) MODE="dry-run"; echo "[DRY RUN] 変更は行いません" ;;
    --verify)  MODE="verify";  echo "[VERIFY] シンボリックリンクの検証のみ行います" ;;
esac

link_count=0
skip_count=0
warn_count=0
saved_bytes=0

for filtered in "${FILTERED_DIRS[@]}"; do
    filtered_path="$DATASET_DIR/$filtered"
    [[ -d "$filtered_path" ]] || continue
    echo ""
    echo "=== $filtered ==="

    for repo_dir in "$filtered_path"/*/; do
        repo=$(basename "$repo_dir")

        for type in pullrequest issue; do
            type_dir="$repo_dir$type"
            [[ -d "$type_dir" ]] || continue

            for pr_dir in "$type_dir"/*/; do
                [[ -d "$pr_dir" ]] || continue
                pr_name=$(basename "$pr_dir")

                for premerge in "$pr_dir"premerge*; do
                    [[ -e "$premerge" || -L "$premerge" ]] || continue

                    premerge_name=$(basename "$premerge")
                    raw_pr_dir="$RAW_DIR/$repo/$type/$pr_name"

                    # --- verify モード ---
                    if [[ "$MODE" == "verify" ]]; then
                        if [[ -L "$premerge" ]]; then
                            target=$(readlink "$premerge")
                            # 相対パスを解決して存在チェック
                            if [[ -d "$(dirname "$premerge")/$target" ]]; then
                                echo "[OK]   $premerge -> $target"
                            else
                                echo "[BROKEN] $premerge -> $target"
                                ((warn_count++))
                            fi
                        else
                            echo "[NOT LINKED] $premerge"
                        fi
                        ((link_count++))
                        continue
                    fi

                    # 既にシンボリックリンクならスキップ
                    if [[ -L "$premerge" ]]; then
                        ((skip_count++))
                        continue
                    fi
                    [[ -d "$premerge" ]] || continue

                    # raw_cloned 内の対応する premerge を探す
                    if [[ "$premerge_name" == premerge_* ]]; then
                        # filtered_protoChanged: 番号付き → 直接対応
                        raw_premerge="$raw_pr_dir/$premerge_name"
                    else
                        # filtered_commit/fewChanged: 番号なし → raw から premerge_* を検索
                        raw_premerge=$(find "$raw_pr_dir" -maxdepth 1 -name "premerge_*" -type d 2>/dev/null | head -1)
                    fi

                    if [[ -z "${raw_premerge:-}" || ! -d "$raw_premerge" ]]; then
                        echo "[WARN] raw に対応なし: $premerge"
                        ((warn_count++))
                        continue
                    fi

                    raw_premerge_name=$(basename "$raw_premerge")
                    # 相対パス: {pr_name}/ から 4階層上が dataset/
                    rel_target="../../../../raw_cloned/$repo/$type/$pr_name/$raw_premerge_name"

                    if [[ "$MODE" == "dry-run" ]]; then
                        size=$(du -sm "$premerge" 2>/dev/null | cut -f1)
                        echo "[DRY RUN] rm + ln -s: $premerge -> $rel_target (${size:-?}MB)"
                        saved_bytes=$((saved_bytes + ${size:-0}))
                    else
                        size=$(du -sm "$premerge" 2>/dev/null | cut -f1)
                        rm -rf "$premerge"
                        ln -s "$rel_target" "$premerge"
                        saved_bytes=$((saved_bytes + ${size:-0}))
                        echo "[LINKED] $premerge -> $rel_target (${size:-?}MB freed)"
                    fi
                    ((link_count++))
                done
            done
        done
    done
done

echo ""
echo "===== 結果 ====="
echo "処理数: $link_count, スキップ(既リンク): $skip_count, 警告: $warn_count"
if [[ "$MODE" != "verify" ]]; then
    echo "削減見込み: 約 ${saved_bytes}MB"
fi
