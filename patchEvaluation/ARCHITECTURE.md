# patchEvaluation アーキテクチャ

## 📦 独立コンテナ設計

`/app/patchEvaluation` は**独立したDockerコンテナ**で動作するように設計されています。

### 🎯 設計原則

#### 1. **親ディレクトリへの依存禁止**
- `/app/src` からのモジュールインポート禁止
- `/app/patchEvaluation` をルートとした自己完結型設計
- 必要な定数・型は patchEvaluation 内に複製

#### 2. **共通定数の管理**

##### APRStatus定数の同期
APRシステム本体とpatchEvaluationで同じステータス定数を使用する必要があります。

**定義場所:**
- **APRシステム本体**: `/app/src/modules/Logger.ts`
- **patchEvaluation**: `/app/patchEvaluation/src/types.js`

**同期が必要な定数:**
```javascript
export const APRStatus = {
    FINISHED: 'FINISHED',                       // パッチ生成完了
    NO_CHANGES_NEEDED: 'NO_CHANGES_NEEDED',     // 修正不要と判定
    TIMEOUT: 'TIMEOUT',                         // タイムアウト
    ERROR: 'ERROR',                             // エラー発生
    INVESTIGATION_PHASE: 'INVESTIGATION_PHASE', // 調査フェーズ
    INCOMPLETE: 'INCOMPLETE'                    // 不完全終了
};
```

**同期手順:**
1. `/app/src/modules/Logger.ts` でAPRStatus定数を変更
2. `/app/patchEvaluation/src/types.js` の同じ定数を手動で更新
3. 両方のファイルでコメントに更新日時を記録

#### 3. **許可されるインポートパス**

✅ **OK: patchEvaluation内の相対パス**
```javascript
import reportService from '../services/ReportBasedLogService.js';
import { APRStatus } from '../../src/types.js';
import prStatisticsService from '../../src/Service/PRStatisticsService.js';
```

❌ **NG: 親ディレクトリへの参照**
```javascript
import Logger from '../../src/modules/Logger.js';          // ❌
import { APRStatus } from '/app/src/modules/Logger.js';    // ❌
```

### 🔍 親ディレクトリ依存のチェック方法

```bash
# patchEvaluation配下で親ディレクトリへのインポートを検索
cd /app/patchEvaluation
grep -r "from.*\.\./\.\./src" . --include="*.js" --include="*.ts"
grep -r "from.*/app/src/" . --include="*.js" --include="*.ts"
grep -r "require.*\.\./\.\./src" . --include="*.js" --include="*.ts"
```

### 📂 ディレクトリ構造

```
/app/
├── src/                          # APRシステム本体（コンテナ外）
│   └── modules/
│       └── Logger.ts            # ← APRStatus定義（マスター）
│
└── patchEvaluation/             # 独立コンテナ（ルート）
    ├── src/
    │   ├── types.js             # ← APRStatus定義（複製）
    │   ├── Service/
    │   │   └── PRStatisticsService.js
    │   └── Controller/
    │       └── DatasetAnalysisController.js
    ├── server/
    │   ├── routes/
    │   │   └── reports.js
    │   ├── services/
    │   │   └── ReportBasedLogService.js
    │   └── public/
    │       └── app.js
    └── README.md
```

### ⚙️ コンテナ環境での動作

patchEvaluationコンテナは `/app/patchEvaluation` をルートとしてマウントされるため：

```dockerfile
# Dockerfileイメージ例
WORKDIR /app/patchEvaluation
# この時点で /app/src は存在しない
```

### 🔄 定数同期のベストプラクティス

1. **変更時のチェックリスト**
   - [ ] `/app/src/modules/Logger.ts` のAPRStatusを更新
   - [ ] `/app/patchEvaluation/src/types.js` のAPRStatusを同期
   - [ ] 両方のファイルにコメントで更新日を記録
   - [ ] TypeScriptコンパイルエラーチェック: `npm run build`
   - [ ] patchEvaluationの依存チェック: 上記grepコマンド実行

2. **コメント記載例**
```javascript
// APR終了ステータス定数（最終更新: 2026-01-22）
// ※ /app/src/modules/Logger.ts と同期すること
export const APRStatus = {
    FINISHED: 'FINISHED',
    // ...
};
```

### 🚨 トラブルシューティング

**症状**: コンテナ起動時に `Cannot find module '../../src/modules/Logger.js'` エラー

**原因**: 親ディレクトリへの不正なインポート

**解決方法**:
1. エラーメッセージからファイル名を特定
2. 該当ファイルのインポート文を確認
3. patchEvaluation内のモジュールに変更
4. 必要なら定数を `/app/patchEvaluation/src/types.js` に複製

---

## 📝 変更履歴

- **2026-01-22**: APRStatus定数の同期ルール追加、親ディレクトリ依存禁止を明文化
