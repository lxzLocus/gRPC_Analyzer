/**
 * テスト用データセットのセットアップ
 * シンボリックリンクを使用して5件のテストケースを作成
 */

const fs = require('fs');
const path = require('path');

// テスト用に選ぶ5件のpullrequest
const TEST_CASES = [
    // 4軸評価データがあるもの
    "Remove_deprecated_sapb-Authorizations-Authz_-map-",
    "Rename_-now-_to_-validUntil-_in_GetAuthz_requests",
    "ra-_add_GenerateOCSP",
    "SA-_Remove_AddCertificate-s_unused_return_value",
    // 通常ケース
    "Remove_-code-_from_RevokeCertByKeyRequest_protobuf_and_regen_protobufs",
];

const SOURCE_BASE = "/app/dataset/filtered_confirmed/boulder/pullrequest";
const TARGET_BASE = "/app/test_dataset/boulder/pullrequest";

// ディレクトリを再帰的に作成
fs.mkdirSync(TARGET_BASE, { recursive: true });

console.log("📦 テストデータセットのセットアップ");
console.log("=".repeat(60));

let successCount = 0;
for (const caseName of TEST_CASES) {
    const source = path.join(SOURCE_BASE, caseName);
    const target = path.join(TARGET_BASE, caseName);
    
    try {
        if (fs.existsSync(source)) {
            // 既存のリンクまたはファイルを削除
            try {
                fs.unlinkSync(target);
            } catch (e) {
                // 存在しない場合は無視
            }
            
            // シンボリックリンク作成
            fs.symlinkSync(source, target);
            console.log(`✅ ${caseName}`);
            successCount++;
        } else {
            console.log(`❌ ${caseName} (ソースなし: ${source})`);
        }
    } catch (err) {
        console.log(`❌ ${caseName}: ${err.message}`);
    }
}

console.log();
console.log("📁 作成されたテストデータセット:");
try {
    const items = fs.readdirSync(TARGET_BASE);
    for (const item of items) {
        const fullPath = path.join(TARGET_BASE, item);
        const stat = fs.lstatSync(fullPath);
        if (stat.isSymbolicLink()) {
            const target = fs.readlinkSync(fullPath);
            console.log(`   🔗 ${item}`);
        } else {
            console.log(`   📁 ${item}`);
        }
    }
} catch (err) {
    console.log(`   エラー: ${err.message}`);
}

// APRログの確認
console.log();
console.log("📁 対応するAPRログの確認:");
const APR_LOGS_BASE = "/app/apr-logs/boulder/pullrequest";
for (const caseName of TEST_CASES) {
    const aprPath = path.join(APR_LOGS_BASE, caseName);
    try {
        if (fs.existsSync(aprPath)) {
            const files = fs.readdirSync(aprPath).filter(f => f.endsWith('.log'));
            console.log(`   ✅ ${caseName}: ${files.length}件のログ`);
        } else {
            console.log(`   ❌ ${caseName}: APRログなし`);
        }
    } catch (err) {
        console.log(`   ❌ ${caseName}: ${err.message}`);
    }
}

console.log();
console.log("✅ セットアップ完了!");
console.log(`   テストデータセット: ${TARGET_BASE}`);
console.log(`   成功: ${successCount}/${TEST_CASES.length}件`);
