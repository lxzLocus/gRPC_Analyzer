#!/bin/sh
# link_premerge_sh.sh  (POSIX sh 互換版)
# filtered_* 内の premerge ディレクトリを raw_cloned へのシンボリックリンクに置換し、ディスクを節約する
# コンテナ内で実行:
#   sh /app/.docker/link_premerge_sh.sh --dry-run       # 変更せず対象を表示
#   sh /app/.docker/link_premerge_sh.sh --delete-only   # 削除のみ（リンクは張らない）
#   sh /app/.docker/link_premerge_sh.sh --link-only     # リンクのみ（削除済み前提）
#   sh /app/.docker/link_premerge_sh.sh --verify        # シンボリックリンクの検証
#   sh /app/.docker/link_premerge_sh.sh                 # 削除+リンク（従来動作）

set -eu

DATASET_DIR="/app/dataset"
RAW_DIR="$DATASET_DIR/raw_cloned"
FILTERED_DIRS="filtered_protoChanged filtered_commit filtered_fewChanged"

MODE="execute"
case "${1:-}" in
    --dry-run)     MODE="dry-run";     echo "[DRY RUN] 変更は行いません" ;;
    --delete-only) MODE="delete-only"; echo "[DELETE ONLY] 削除のみ行います（リンクは張りません）" ;;
    --link-only)   MODE="link-only";   echo "[LINK ONLY] リンクのみ行います（削除済み前提）" ;;
    --verify)      MODE="verify";      echo "[VERIFY] シンボリックリンクの検証のみ行います" ;;
esac

link_count=0
skip_count=0
warn_count=0
saved_bytes=0

# ===========================================================================
# link-only モード: raw_cloned 側を走査して、filtered 側に欠落した premerge のリンクを張る
# ===========================================================================
if [ "$MODE" = "link-only" ]; then
    for filtered in $FILTERED_DIRS; do
        filtered_path="$DATASET_DIR/$filtered"
        [ -d "$filtered_path" ] || continue
        echo ""
        echo "=== $filtered ==="

        for repo_dir in "$filtered_path"/*/; do
            [ -d "$repo_dir" ] || continue
            repo=$(basename "$repo_dir")

            for type in pullrequest issue; do
                type_dir="$repo_dir$type"
                [ -d "$type_dir" ] || continue

                for pr_dir in "$type_dir"/*/; do
                    [ -d "$pr_dir" ] || continue
                    pr_name=$(basename "$pr_dir")
                    raw_pr_dir="$RAW_DIR/$repo/$type/$pr_name"
                    [ -d "$raw_pr_dir" ] || continue

                    # raw_cloned 側の premerge_* を列挙
                    for raw_premerge in "$raw_pr_dir"/premerge_*; do
                        [ -d "$raw_premerge" ] || continue
                        raw_premerge_name=$(basename "$raw_premerge")

                        # filtered 側でどの名前でリンクすべきか判定
                        if [ "$filtered" = "filtered_protoChanged" ]; then
                            # 番号付きでそのまま対応
                            target_name="$raw_premerge_name"
                        else
                            # filtered_commit/fewChanged: "premerge" (番号なし)
                            target_name="premerge"
                        fi
                        target_path="$pr_dir$target_name"

                        # 既にシンボリックリンクならスキップ
                        if [ -L "$target_path" ]; then
                            skip_count=$((skip_count + 1))
                            continue
                        fi
                        # 実ディレクトリが残っていたらスキップ
                        if [ -e "$target_path" ]; then
                            echo "[SKIP] まだ実体が残っています: $target_path"
                            skip_count=$((skip_count + 1))
                            continue
                        fi

                        rel_target="../../../../raw_cloned/$repo/$type/$pr_name/$raw_premerge_name"
                        ln -s "$rel_target" "$target_path"
                        echo "[LINKED] $target_path -> $rel_target"
                        link_count=$((link_count + 1))
                    done
                done
            done
        done
    done

    echo ""
    echo "===== 結果 ====="
    echo "リンク作成: $link_count, スキップ: $skip_count, 警告: $warn_count"
    exit 0
fi

# ===========================================================================
# 通常モード (dry-run / delete-only / verify / execute)
# filtered 側の premerge* を走査
# ===========================================================================
for filtered in $FILTERED_DIRS; do
    filtered_path="$DATASET_DIR/$filtered"
    [ -d "$filtered_path" ] || continue
    echo ""
    echo "=== $filtered ==="

    for repo_dir in "$filtered_path"/*/; do
        [ -d "$repo_dir" ] || continue
        repo=$(basename "$repo_dir")

        for type in pullrequest issue; do
            type_dir="$repo_dir$type"
            [ -d "$type_dir" ] || continue

            for pr_dir in "$type_dir"/*/; do
                [ -d "$pr_dir" ] || continue
                pr_name=$(basename "$pr_dir")

                for premerge in "$pr_dir"premerge*; do
                    # グロブが展開されなかった場合スキップ
                    [ -e "$premerge" ] || [ -L "$premerge" ] || continue

                    premerge_name=$(basename "$premerge")
                    raw_pr_dir="$RAW_DIR/$repo/$type/$pr_name"

                    # --- verify モード ---
                    if [ "$MODE" = "verify" ]; then
                        if [ -L "$premerge" ]; then
                            target=$(readlink "$premerge")
                            resolved="$(dirname "$premerge")/$target"
                            if [ -d "$resolved" ]; then
                                echo "[OK]   $premerge -> $target"
                            else
                                echo "[BROKEN] $premerge -> $target"
                                warn_count=$((warn_count + 1))
                            fi
                        else
                            echo "[NOT LINKED] $premerge"
                        fi
                        link_count=$((link_count + 1))
                        continue
                    fi

                    # 既にシンボリックリンクならスキップ
                    if [ -L "$premerge" ]; then
                        skip_count=$((skip_count + 1))
                        continue
                    fi
                    [ -d "$premerge" ] || continue

                    # raw_cloned 内の対応する premerge を探す
                    raw_premerge=""
                    case "$premerge_name" in
                        premerge_*)
                            raw_premerge="$raw_pr_dir/$premerge_name"
                            ;;
                        *)
                            raw_premerge=$(find "$raw_pr_dir" -maxdepth 1 -name "premerge_*" -type d 2>/dev/null | head -1)
                            ;;
                    esac

                    if [ -z "$raw_premerge" ] || [ ! -d "$raw_premerge" ]; then
                        echo "[WARN] raw に対応なし: $premerge"
                        warn_count=$((warn_count + 1))
                        continue
                    fi

                    raw_premerge_name=$(basename "$raw_premerge")
                    rel_target="../../../../raw_cloned/$repo/$type/$pr_name/$raw_premerge_name"

                    if [ "$MODE" = "dry-run" ]; then
                        size=$(du -sm "$premerge" 2>/dev/null | cut -f1)
                        size=${size:-0}
                        echo "[DRY RUN] rm + ln -s: $premerge -> $rel_target (${size}MB)"
                        saved_bytes=$((saved_bytes + size))
                    elif [ "$MODE" = "delete-only" ]; then
                        size=$(du -sm "$premerge" 2>/dev/null | cut -f1)
                        size=${size:-0}
                        rm -rf "$premerge"
                        saved_bytes=$((saved_bytes + size))
                        echo "[DELETED] $premerge (${size}MB freed)"
                    else
                        size=$(du -sm "$premerge" 2>/dev/null | cut -f1)
                        size=${size:-0}
                        rm -rf "$premerge"
                        ln -s "$rel_target" "$premerge"
                        saved_bytes=$((saved_bytes + size))
                        echo "[LINKED] $premerge -> $rel_target (${size}MB freed)"
                    fi
                    link_count=$((link_count + 1))
                done
            done
        done
    done
done

echo ""
echo "===== 結果 ====="
echo "処理数: $link_count, スキップ(既リンク): $skip_count, 警告: $warn_count"
if [ "$MODE" != "verify" ]; then
    echo "削減見込み: 約 ${saved_bytes}MB"
fi
