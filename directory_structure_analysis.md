# プロジェクトディレクトリ構造分析

## Boulder プロジェクト (Let's Encrypt CA - Go)

### コアロジックファイルの配置

```
boulder/
├── cmd/                          # 実行可能ファイル (コマンド)
│   ├── boulder-ca/
│   │   └── main.go              # CA サービスのエントリポイント
│   ├── boulder-ra/
│   │   └── main.go              # RA サービスのエントリポイント
│   ├── boulder-sa/
│   │   └── main.go              # SA サービスのエントリポイント
│   ├── boulder-va/
│   │   └── main.go              # VA サービスのエントリポイント
│   ├── boulder-wfe2/
│   │   └── main.go              # WFE2 サービスのエントリポイント
│   ├── ocsp-responder/
│   │   └── main.go              # OCSP レスポンダー
│   └── ...
├── core/                         # コアロジック
│   ├── proto/
│   │   ├── core.proto           # ★ Proto ファイル
│   │   └── core.pb.go           # 生成されたコード
│   ├── objects.go               # コアデータ構造
│   ├── challenges.go
│   └── interfaces.go
├── ca/                           # Certificate Authority ロジック
│   ├── proto/
│   │   ├── ca.proto             # ★ Proto ファイル
│   │   ├── ca.pb.go
│   │   └── ca_grpc.pb.go
│   ├── ca.go                    # CA メインロジック
│   ├── ocsp.go
│   └── crl.go
├── ra/                           # Registration Authority
│   ├── proto/
│   │   ├── ra.proto             # ★ Proto ファイル
│   │   ├── ra.pb.go
│   │   └── ra_grpc.pb.go
│   └── ra.go                    # RA メインロジック
├── sa/                           # Storage Authority
│   ├── proto/
│   │   ├── sa.proto             # ★ Proto ファイル
│   │   ├── sa.pb.go
│   │   └── sa_grpc.pb.go
│   ├── sa.go                    # SA メインロジック
│   ├── database.go
│   └── model.go
├── va/                           # Validation Authority
│   ├── proto/
│   │   ├── va.proto             # ★ Proto ファイル
│   │   ├── va.pb.go
│   │   └── va_grpc.pb.go
│   ├── va.go                    # VA メインロジック
│   ├── dns.go
│   ├── http.go
│   └── caa.go
├── grpc/                         # gRPC 関連
│   ├── pb-marshalling.go        # Proto ↔ Core 型変換
│   ├── server.go
│   ├── client.go
│   └── test_proto/
│       └── interceptors_test.proto
├── wfe2/                         # Web Front End (v2)
│   └── wfe.go
└── test/                         # テストとデプロイメント設定
    ├── config/
    │   ├── ca-a.json
    │   ├── ca-b.json
    │   ├── ra.json
    │   ├── sa.json
    │   ├── va.json
    │   └── wfe2.json
    ├── docker-compose.yml       # ★ デプロイメント設定
    ├── Dockerfile
    └── grpc-creds/              # gRPC 認証情報
```

## 他のプロジェクト例

### DAOS (C/Go ハイブリッド)

```
daos/
├── src/
│   ├── proto/                   # ★ Proto ファイルディレクトリ
│   │   ├── mgmt.proto
│   │   ├── pool.proto
│   │   └── container.proto
│   ├── control/                 # Go コアロジック
│   │   ├── server/
│   │   │   └── main.go
│   │   └── cmd/
│   │       └── dmg/
│   │           └── main.go
│   ├── engine/                  # C コアロジック
│   │   ├── srv.c
│   │   └── pool.c
│   └── client/
│       └── api/
└── utils/
    ├── Dockerfile               # ★ ビルド設定
    └── deploy/
        └── daos.yaml            # ★ デプロイメント設定
```

### hmda-platform (Scala)

```
hmda-platform/
├── hmda/
│   └── src/
│       └── main/
│           ├── scala/
│           │   └── hmda/
│           │       ├── api/
│           │       │   └── http/
│           │       │       └── HmdaFilingApi.scala    # メイン API エントリポイント
│           │       ├── validation/
│           │       │   └── rules/                     # コアビジネスロジック
│           │       └── persistence/
│           │           └── model/
│           ├── protobuf/
│           │   ├── institution.proto                  # ★ Proto ファイル
│           │   ├── filing.proto
│           │   └── submission.proto
│           └── resources/
│               └── application.conf                   # 設定ファイル
├── kubernetes/                                         # ★ デプロイメント
│   ├── hmda-platform.yaml
│   └── Dockerfile
└── build.sbt                                          # ビルド設定
```

### rasa-sdk (Python)

```
rasa-sdk/
├── rasa_sdk/
│   ├── __main__.py              # エントリポイント
│   ├── endpoint.py              # メイン API ロジック
│   ├── executor.py              # コアロジック
│   ├── grpc_py/
│   │   ├── action_webhook.proto # ★ Proto ファイル
│   │   ├── action_webhook_pb2.py
│   │   └── action_webhook_pb2_grpc.py
│   └── interfaces.py
├── Dockerfile                   # ★ デプロイメント
├── docker-compose.yml           # ★ デプロイメント
└── setup.py                     # ビルド設定
```

## ファイルタイプ別の優先順位付け戦略

### コアロジックファイル (+20点)
- **Go**: `main.go`, `*_server.go`, `*_client.go`, `service.go`, `handler.go`
- **Python**: `__main__.py`, `app.py`, `main.py`, `server.py`, `service.py`
- **Scala**: `*Api.scala`, `*Service.scala`, `*Controller.scala`, `Main.scala`
- **Java**: `*Application.java`, `*Service.java`, `*Controller.java`

### デプロイメント設定 (+10点)
- `Dockerfile`, `docker-compose.yml`, `docker-compose.*.yml`
- `*.yaml` (Kubernetes), `Tiltfile`
- `.dockerignore`

### ビルド設定 (+5点)
- `Makefile`, `build.sbt`, `pom.xml`, `build.gradle`
- `go.mod`, `package.json`, `setup.py`, `requirements.txt`
- `.goreleaser.yml`, `.travis.yml`

### Proto ファイル関連ボーナス
- **Proto ファイル名一致** (+15点): 変更されたprotoファイル名と同じ名前のファイル
  - 例: `core.proto` → `core.go`, `core_test.go`, `core_impl.go`
  
- **Proto コンテンツ関係** (+30点): 変更されたprotoのメッセージ/サービス名がファイル内に出現
  - 例: `CertificateStatus` メッセージ → `certStatus.go`, `pb-marshalling.go`

### 典型的なディレクトリ構造パターン

#### パターン1: マイクロサービス型 (Boulder)
```
project/
├── cmd/{service}/main.go        # エントリポイント (コアロジック)
├── {service}/
│   ├── proto/{service}.proto    # Proto定義
│   ├── {service}.go             # サービスロジック (コアロジック)
│   └── {service}_test.go
├── grpc/
│   └── pb-marshalling.go        # Proto変換 (コアロジック)
└── test/
    ├── config/                  # 設定
    └── docker-compose.yml       # デプロイメント
```

#### パターン2: モノリシック型 (DAOS, rasa-sdk)
```
project/
├── src/
│   ├── proto/                   # Proto定義
│   ├── main.{ext}               # エントリポイント (コアロジック)
│   └── {module}/
│       └── service.{ext}        # コアロジック
├── Dockerfile                   # デプロイメント
└── Makefile                     # ビルド
```

#### パターン3: マルチモジュール型 (hmda-platform)
```
project/
├── {module}/src/main/
│   ├── {lang}/                  # コアロジック
│   │   └── {package}/
│   │       ├── api/
│   │       └── service/
│   └── protobuf/                # Proto定義
├── kubernetes/                  # デプロイメント
└── build.{tool}                 # ビルド
```

## スコアリング例

変更されたProtoファイル: `core/proto/core.proto` (CertificateStatus メッセージに issuerID 追加)

### 高スコアファイル例

| ファイルパス | スコア計算 | 合計 |
|------------|-----------|------|
| `grpc/pb-marshalling.go` | コアロジック(+20) + Proto内容一致(+30) = **50** | 50 |
| `core/objects.go` | コアロジック(+20) + Proto内容一致(+30) = **50** | 50 |
| `cmd/boulder-ca/main.go` | コアロジック(+20) | 20 |
| `ca/ca.go` | コアロジック(+20) + Proto名一致(+15) = **35** | 35 |
| `test/docker-compose.yml` | デプロイメント(+10) | 10 |
| `Makefile` | ビルド(+5) | 5 |

この優先順位付けにより、プロンプトに含めるファイルを効率的に選択できます。
