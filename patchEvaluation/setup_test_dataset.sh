#!/bin/sh
# テスト用データセットのセットアップスクリプト

# テストディレクトリ構造を作成
mkdir -p /app/test_dataset/boulder/pullrequest

# 5件のpullrequestをシンボリックリンクで参照
# 選定理由：4軸評価データがあるもの（3件）と、通常ケース（2件）を混ぜる

cd /app/test_dataset/boulder/pullrequest

# 1. PLAUSIBLE評価のケース
ln -sf /app/dataset/filtered_confirmed/boulder/pullrequest/Remove_deprecated_sapb-Authorizations-Authz_-map- .

# 2. INCORRECT評価のケース
ln -sf /app/dataset/filtered_confirmed/boulder/pullrequest/Rename_-now-_to_-validUntil-_in_GetAuthz_requests .

# 3. INCORRECT評価のケース
ln -sf /app/dataset/filtered_confirmed/boulder/pullrequest/ra-_add_GenerateOCSP .

# 4. INCORRECT評価のケース
ln -sf /app/dataset/filtered_confirmed/boulder/pullrequest/SA-_Remove_AddCertificate-s_unused_return_value .

# 5. 通常ケース
ln -sf /app/dataset/filtered_confirmed/boulder/pullrequest/Remove_-code-_from_RevokeCertByKeyRequest_protobuf_and_regen_protobufs .

echo "✅ テストデータセットを作成しました"
ls -la /app/test_dataset/boulder/pullrequest/

# APRログディレクトリも確認
echo ""
echo "📁 対応するAPRログの確認:"
for dir in /app/test_dataset/boulder/pullrequest/*/; do
    name=$(basename "$dir")
    aprlog="/app/apr-logs/boulder/pullrequest/$name"
    if [ -d "$aprlog" ]; then
        echo "  ✅ $name: APRログあり"
    else
        echo "  ❌ $name: APRログなし"
    fi
done
