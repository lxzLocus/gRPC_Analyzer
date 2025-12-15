#!/bin/sh
# バグ修正データセットコピースクリプト (シェル版)

SOURCE_DIR="/app/dataset/filtered_fewChanged"
TARGET_DIR="/app/dataset/filtered_bugs"

echo "🐛 バグ修正データセットコピー（シェル版）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. ターゲットディレクトリ作成
mkdir -p "$TARGET_DIR"
echo "✅ ターゲットディレクトリ準備完了: $TARGET_DIR"
echo ""

# 2. バグ修正PRリスト（JSONから手動で抽出したリスト）
echo "📦 バグ修正PRをコピー中..."
echo ""

# boulderプロジェクト (35件)
echo "[boulder] コピー中..."
cp -r "$SOURCE_DIR/boulder/issue/ratelimits-_Exempt_renewals_from_NewOrdersPerAccount_and_CertificatesPerDomain_limits" \
      "$TARGET_DIR/boulder/issue/" 2>/dev/null && echo "  ✓ ratelimits-_Exempt_renewals..." || echo "  ✗ ratelimits-_Exempt_renewals..."

for pr in \
    "Add_IssuerID_field_to_CertificateStatus_proto" \
    "Add_validated_timestamp_to_challenges" \
    "Allow_WFEv1_to_specify_which_issuer_to_use" \
    "CA-_gRPC_plumbing_for_multiple_certificate_profiles" \
    "GRPC_Unwrap-_Make_sa-FinalizeOrder_passthrough" \
    "GRPC_Unwrap-_Make_sa-NewOrder_passthrough" \
    "GRPC_Unwrap-_Make_sa-SetOrderError_passthrough" \
    "GRPC_Unwrap-_Make_sa-SetOrderProcessing_passthrough" \
    "Publisher-_clean_up_deprecated_Request-Precert_field" \
    "RA-_Add_UnpauseAccountRequest_protobuf_message_and_service" \
    "RA-_Return_retry-after_when_Certificates_per_Registered_Domain_is_exceeded" \
    "Remove_-code-_from_RevokeCertByKeyRequest_protobuf_and_regen_protobufs" \
    "Remove_-useV2authorizations-_boolean_flags-" \
    "Remove_CertDER_from_GenerateOCSPRequest_proto" \
    "Remove_IssueCertificateRequest-IssuerNameID" \
    "Remove_OCSP_and_CRL_methods_from_CA_gRPC_service" \
    "Remove_RA_NewAuthorization_and_NewCertificate" \
    "Remove_challenge-ProvidedKeyAuthorization" \
    "Remove_deprecated_sapb-Authorizations-Authz_-map-" \
    "Remove_leftover_ACMEv1_combinations_code" \
    "Rename_-now-_to_-validUntil-_in_GetAuthz_requests" \
    "Rename_protobuf_duration_fields_to_-fieldname-NS_and_populate_new_duration_fields" \
    "SA-_Add_GetLastExpiry_gRPC_method" \
    "SA-_Add_GetLintPrecertificate_gRPC_method" \
    "SA-_Remove_AddCertificate-s_unused_return_value" \
    "SA-_Remove_AddPrecertificate-s_unused_return_value" \
    "SA-_Remove_GetV2Authorization-s_-Now-_field" \
    "Store_Issuance_Token_in_orders_table" \
    "Use_google-protobuf-Empty_instead_of_core-Empty" \
    "VA-_Add_IsCAAValid_protobuf_method_and_service" \
    "WFE-_Return_existing_order_if_a_valid_one_exists" \
    "WFEv2-_Allow_key_ID_to_be_non-URL-safe_base64" \
    "WFEv2-_Add_new_-revokeCert-_endpoint" \
    "account-contact-_update_to_gRPC"
do
    mkdir -p "$TARGET_DIR/boulder/pullrequest"
    cp -r "$SOURCE_DIR/boulder/pullrequest/$pr" "$TARGET_DIR/boulder/pullrequest/" 2>/dev/null && \
        echo "  ✓ $pr" || echo "  ✗ $pr"
done

echo ""
echo "✅ コピー完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 統計表示
echo ""
echo "📊 コピー結果:"
find "$TARGET_DIR" -mindepth 3 -maxdepth 3 -type d | wc -l | xargs echo "  PRディレクトリ数:"
du -sh "$TARGET_DIR" | awk '{print "  合計サイズ: " $1}'
