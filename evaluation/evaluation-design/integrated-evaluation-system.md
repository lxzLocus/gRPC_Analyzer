# 統合評価システム設計

## 全体アーキテクチャ

```
[APR System Container]              [Evaluation System Container]
├── dataset/ (bind:ro)              ├── dataset/ (bind:ro)
├── logs/ (bind:rw)        ────────>├── logs/ (bind:ro)  
├── output/ (bind:rw)      ────────>├── output/ (bind:ro)
└── src/                            ├── evaluation-results/ (bind:rw)
                                    └── evaluators/
                                        ├── step1_compliance.py
                                        ├── step2_quality.py
                                        └── aggregator.py
```

## 実行フロー

### Phase 1: APR実行
```bash
# APRシステムでデータセット処理
docker-compose run apr-system python safeBatchRunner.py /app/dataset/filtered_commit
```

### Phase 2: 仕様準拠性評価  
```bash
# ステップ1: システム動作評価
docker-compose run evaluation-system python step1_compliance_evaluator.py \
  --logs-dir /app/logs \
  --output-dir /app/evaluation-results/step1
```

### Phase 3: パッチ品質評価
```bash
# ステップ2: パッチ品質評価  
docker-compose run evaluation-system python step2_quality_evaluator.py \
  --dataset-dir /app/dataset/filtered_commit \
  --results-dir /app/output \
  --output-dir /app/evaluation-results/step2
```

### Phase 4: 統合レポート生成
```bash
# 最終レポート生成
docker-compose run evaluation-system python generate_final_report.py \
  --step1-results /app/evaluation-results/step1 \
  --step2-results /app/evaluation-results/step2 \
  --output-file /app/evaluation-results/comprehensive_report.json
```

## 出力形式

### ステップ1結果例
```json
{
  "system_compliance_summary": {
    "total_cases": 419,
    "compliance_rate": 94.5,
    "parser_accuracy": 98.2,
    "avg_turns_per_case": 2.3,
    "error_breakdown": {
      "infinite_loops": 2,
      "parser_failures": 8,
      "api_timeouts": 13
    }
  },
  "detailed_cases": [
    {
      "case_id": "boulder/pullrequest/fix_123",
      "compliance_score": 95,
      "parser_accuracy": 100,
      "issues": ["Minor: Plan section was longer than recommended"],
      "turn_sequence": ["Thought->Plan->Reply", "Thought->Modified->Fin"]
    }
  ]
}
```

### ステップ2結果例  
```json
{
  "patch_quality_summary": {
    "total_cases": 396,
    "plausible_rate": 87.4,
    "correct_rate": 72.1,
    "correctness_distribution": {
      "R1": 45,
      "R2": 32, 
      "R3": 28,
      "R4": 61,
      "R5": 19,
      "R6-R10": 31,
      "None": 180
    },
    "avg_reasoning_quality": 3.8,
    "efficiency_distribution": {
      "Excellent": 234,
      "Good": 98,
      "Fair": 45,
      "Poor": 19
    }
  },
  "detailed_cases": [
    {
      "case_id": "boulder/pullrequest/fix_123",
      "plausible": true,
      "correctness_level": "R4",
      "reasoning_quality": 4.2,
      "efficiency_rating": "Good",
      "analysis": "エージェントは問題を正確に特定し、意味的に同等なソリューションを生成したが、実装方法が正解と異なる"
    }
  ]
}
```

### 最終統合レポート例
```json
{
  "overall_performance": {
    "apr_system_health": {
      "compliance_rate": 94.5,
      "reliability_score": 92.1
    },
    "ai_agent_capability": {
      "plausible_rate": 87.4,
      "correct_rate": 72.1,
      "reasoning_score": 3.8
    },
    "efficiency_metrics": {
      "avg_turns": 2.3,
      "success_rate_per_turn": {
        "turn_1": 23.4,
        "turn_2": 68.7,
        "turn_3": 7.9
      }
    }
  },
  "recommendations": [
    "パーサー精度向上により、システム準拠性を98%以上に改善可能",
    "Few-shotサンプルの最適化により、推論品質を4.2以上に向上可能",
    "早期終了条件の調整により、効率性をさらに改善可能"
  ]
}
```

## 実装上の推奨事項

### 1. 段階的実装
1. **最小限の評価器**: 基本的なメトリクス（成功率、エラー率）
2. **LLM統合**: Few-shotプロンプトによる品質評価
3. **高度な分析**: 推論パターン分析、パフォーマンス予測

### 2. 設定可能性
- 評価LLMモデルの選択（GPT-4, Claude等）
- Few-shotサンプルの動的読み込み
- 評価基準の重み付け調整

### 3. 拡張性
- 新しい評価基準の追加インターフェース
- 並列処理による高速化対応
- 異なるデータセット形式への対応
