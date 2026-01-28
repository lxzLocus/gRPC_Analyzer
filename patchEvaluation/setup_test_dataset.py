#!/usr/bin/env python3
"""テスト用データセットのセットアップ"""

import os
import sys

# テスト用に選ぶ5件のpullrequest
TEST_CASES = [
    # 4軸評価データがあるもの
    "Remove_deprecated_sapb-Authorizations-Authz_-map-",
    "Rename_-now-_to_-validUntil-_in_GetAuthz_requests",
    "ra-_add_GenerateOCSP",
    "SA-_Remove_AddCertificate-s_unused_return_value",
    # 通常ケース
    "Remove_-code-_from_RevokeCertByKeyRequest_protobuf_and_regen_protobufs",
]

SOURCE_BASE = "/app/dataset/filtered_confirmed/boulder/pullrequest"
TARGET_BASE = "/app/test_dataset/boulder/pullrequest"

# ディレクトリが存在することを確認
os.makedirs(TARGET_BASE, exist_ok=True)

print("📦 テストデータセットのセットアップ")
print("=" * 60)

for case in TEST_CASES:
    source = os.path.join(SOURCE_BASE, case)
    target = os.path.join(TARGET_BASE, case)
    
    if os.path.exists(source):
        if os.path.exists(target) or os.path.islink(target):
            os.remove(target)
        os.symlink(source, target)
        print(f"✅ {case}")
    else:
        print(f"❌ {case} (ソースなし)")

print()
print("📁 作成されたテストデータセット:")
for item in os.listdir(TARGET_BASE):
    full_path = os.path.join(TARGET_BASE, item)
    if os.path.islink(full_path):
        print(f"   🔗 {item} -> {os.readlink(full_path)}")
    else:
        print(f"   📁 {item}")

# APRログの確認
print()
print("📁 対応するAPRログの確認:")
APR_LOGS_BASE = "/app/apr-logs/boulder/pullrequest"
for case in TEST_CASES:
    apr_path = os.path.join(APR_LOGS_BASE, case)
    if os.path.exists(apr_path):
        log_files = [f for f in os.listdir(apr_path) if f.endswith('.log')]
        print(f"   ✅ {case}: {len(log_files)}件のログ")
    else:
        print(f"   ❌ {case}: APRログなし")

print()
print("✅ セットアップ完了!")
print(f"   テストデータセット: {TARGET_BASE}")
print(f"   ケース数: {len(TEST_CASES)}件")
