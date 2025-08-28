# APRログパーサー

LLMとの対話でAPRのログをパースし、premergeとmergeの差分を取得するモジュールです。また、LLMを使用したパッチ品質の自動評価機能も提供します。

## 🆕 新機能: LLMベースのパッチ評価 (evaluateWithLLM)

### 概要
`evaluateWithLLM`メソッドは、LLMを使用してAutomated Program Repair (APR)で生成されたパッチの品質を評価します。R0-R15の意味的等価性ルールに基づいて、パッチの妥当性と正確性を分析します。

### 機能特徴
- **プロンプトテンプレート**: `/app/patchEvaluation/prompt/00_evaluationPrompt.txt`を使用
- **意味的等価性評価**: R0-R15ルールに基づく体系的な評価
- **二段階評価**:
  - **妥当性評価** (Plausibility): パッチがコンテキストに適しているか
  - **正確性評価** (Correctness): 正解と意味的に等価か
- **詳細な推論**: 評価理由とルール適用の説明
- **堅牢な解析**: JSON解析エラーのハンドリング

### 使用方法

#### 1. 基本的な使用方法
```javascript
import APRLogParser from './aprLogParser.js';

const aprLogParser = new APRLogParser();

const result = await aprLogParser.evaluateWithLLM(
    codeContext,          // コードの周辺コンテキスト
    groundTruthDiff,      // 正解のdiff
    agentGeneratedDiff,   // AIエージェントが生成したdiff
    agentThoughtProcess   // AIエージェントの思考プロセス
);

if (result.success) {
    console.log('評価成功:', result.evaluation);
    
    // 評価サマリーの生成
    const summary = aprLogParser.generateEvaluationSummary(result);
    console.log(`総合評価: ${summary.summary.overall_assessment}`);
    console.log(`妥当性: ${summary.summary.is_plausible}`);
    console.log(`正確性: ${summary.summary.is_correct}`);
} else {
    console.error('評価失敗:', result.error);
}
```



### 評価レベル
- **IDENTICAL**: 完全に同一
- **SEMANTICALLY_EQUIVALENT**: 意味的に等価
- **PLAUSIBLE_BUT_DIFFERENT**: 妥当だが異なる
- **INCORRECT**: 不正確

---

## 従来機能

## 概要

このモジュールはAPRログの解析とLLMベースのパッチ品質評価を提供します。

## 主要コンポーネント

### 1. APRLogParser (`aprLogParser.js`)
- APRログファイルの解析
- LLMとの対話履歴の抽出
- premergeとmergeの差分比較
- 問題解決進行パターンの分析

### 2. MessageHandler (`messageHandler.js`)
- LLMレスポンスの解析
- タグベースメッセージ解析
- JSONフォーマット解析
- ファイル要求の抽出

### 3. LLMClientFactory (`llmClientFactory.js`)
- OpenAI/Gemini LLMクライアントの生成
- プロバイダー自動選択
- 設定管理

### 4. 型定義とユーティリティ
- `types.js`: 共通型定義とヘルパー関数
- `config.js`: 設定管理
- `llmClient.js`: LLMクライアント基底クラス

## 使用方法

### Controllerでの統合使用

```javascript
// Controller.jsでの実際の使用例
import APRLogParser from './aprLogParser.js';

const aprLogParser = new APRLogParser();

// データセットループ内での使用
for (const pullRequestTitle of titleDirs) {
    const aprLogPath = path.join(aprOutputPath, path.relative(datasetDir, pullRequestPath));
    
    // APRログ解析
    const aprLogData = await aprLogParser.parseLogEntry(aprLogPath);
    
    if (aprLogData) {
        const diffAnalysis = aprLogParser.analyzeDifferences(aprLogData);
        const finalMods = aprLogParser.extractFinalModifications(aprLogData);
        
        // LLM評価の実行
        if (finalMods.lastModification) {
            const llmEvaluation = await aprLogParser.evaluateWithLLM(
                "",
                "",
                finalMods.lastModification.diff,
                aprLogData.turns.map(turn => turn.content).join('\n\n')
            );
        }
    }
}
```

## APRログ形式

解析対象となるAPRログは以下の形式のJSONファイルです：

```json
{
    "experiment_id": "project/issue123",
    "status": "completed",
    "conversation_log": [
        {
            "turn": 1,
            "timestamp": "2025-01-01T12:00:00Z",
            "llm_response": {
                "raw_content": "LLMの生レスポンス",
                "parsed_content": {
                    "thought": "分析内容",
                    "plan": "計画",
                    "reply_required": [...],
                    "modified_diff": "差分内容",
                    "has_fin_tag": false
                },
                "usage": {
                    "total": 1500,
                    "prompt_tokens": 1000,
                    "completion_tokens": 500
                }
            }
        }
    ]
}
```

## 解析結果

### 対話データ構造

```javascript
{
    experimentId: "project/issue123",
    turns: [
        {
            turnNumber: 1,
            timestamp: "2025-01-01T12:00:00Z",
            thought: "分析内容",
            plan: "計画",
            requiredFiles: [...],
            modifiedDiff: "差分",
            hasFinTag: false,
            usage: { total: 1500 }
        }
    ],
    totalTokens: 15000,
    status: "completed",
    modificationHistory: [...],
    requestedFiles: [...],
    allThoughts: [...],
    allPlans: [...]
}
```

### 差分分析結果

```javascript
{
    totalModifications: 3,
    affectedFiles: ["file1.go", "file2.proto"],
    codeChanges: [
        {
            turn: 2,
            timestamp: "2025-01-01T12:05:00Z",
            changes: [
                {
                    filePath: "file1.go",
                    addedLines: 10,
                    deletedLines: 5,
                    netChange: 5
                }
            ]
        }
    ],
    progressionAnalysis: {
        phases: [...],
        keyInsights: [...],
        problemSolvingPattern: [...]
    }
}
```

## フェーズ分析

システムは対話の進行を以下のフェーズに分類します：

1. **initial_analysis** - 初期分析フェーズ
2. **information_gathering** - 情報収集フェーズ
3. **detailed_analysis** - 詳細分析フェーズ
4. **implementation** - 実装フェーズ
5. **solution_refinement** - 解決策改善フェーズ
6. **completion** - 完了フェーズ

## 実行方法

### メイン実行

```bash
# データセット分析の実行
node /app/src/Controller.js
```

## 注意事項

- OpenAI/Gemini APIキーが環境変数に設定されている必要があります
- APRログファイルは`.log`拡張子のJSONファイルです
- 大容量ログファイルの解析には時間がかかる場合があります

## ログ出力

解析時には詳細なログが出力されます：

```
[1] Processing: project/pullrequest/issue123
  ✅ APRログ発見: /app/apr-logs/project/pullrequest/issue123 (1 ファイル)
  � APRログ解析を開始: project/pullrequest/issue123 (1 ログファイル)
  � 最新ログファイル: processing_summary_2025-08-19.log
  ✅ APRログ解析成功:
    - 対話ターン数: 5
    - 総トークン数: 15000
    - 修正回数: 3
  🎯 最終修正 (Turn 5):
    - タイムスタンプ: 2025-08-19T05:00:05.924Z
    - 修正行数: 45
    - 影響ファイルパス: ['src/main.go', 'api/service.proto']
  🤖 LLM評価を開始...
  ✅ LLM評価完了: CORRECT
    - 正確性: 正しい
    - 妥当性: 妥当
```

## 拡張性

このモジュールは以下のように拡張可能です：

1. **新しいフェーズ分類の追加**
2. **より詳細な差分解析アルゴリズム**
3. **機械学習による洞察分類**
4. **レポート生成機能**
5. **他の形式のログファイル対応**
