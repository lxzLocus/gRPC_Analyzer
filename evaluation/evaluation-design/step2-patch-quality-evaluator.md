# ステップ2：パッチ品質評価器

## 目的
LLMエージェントが生成したパッチの技術的品質と正解との適合性を評価

## 入力データ
- `/app/dataset/*/merge_*/` - 正解のマージ後状態
- `/app/dataset/*/premerge_*/` - マージ前状態  
- `/app/output/` - エージェント生成結果
- `/app/logs/*/interaction_log.json` - 思考プロセス

## 評価項目

### 1. 学術的評価基準 (従来のR1-R10)
- **Plausible**: 構文的に有効で適用可能
- **Correct**: 正解と意味的に同等

### 2. 拡張評価基準
- **Reasoning Quality**: 思考プロセスの論理性
- **Efficiency**: 必要ターン数の適切性
- **Robustness**: エラー状況での回復能力

## 評価LLMプロンプト例

```
# パッチ品質評価

## 評価対象
### 正解パッチ (Ground Truth)
```diff
{ground_truth_diff}
```

### エージェント生成パッチ
```diff
{agent_generated_diff}
```

### 思考プロセス要約
{agent_reasoning_summary}

## 評価基準

### 1. Plausibility (適用可能性) - Yes/No
- [ ] 構文的に有効
- [ ] コンパイル/実行可能
- [ ] ファイルパスが存在
- [ ] 変更箇所が適切

### 2. Correctness (正確性) - R1-R10
- [ ] R1: 完全一致
- [ ] R2: 空白・コメントの差異のみ
- [ ] R3: 変数名の差異のみ
- [ ] R4: 意味的に同等（条件文の書き方等）
- [ ] R5: より良い実装
- [ ] R6-R10: その他の部分的正解

### 3. Reasoning Quality (推論品質) - 1-5点
- 問題分析の適切性: __/5点
- 解決策の論理性: __/5点  
- ファイル要求の的確性: __/5点

### 4. Efficiency (効率性)
- 使用ターン数: {total_turns}
- 効率性評価: Excellent/Good/Fair/Poor

## 出力フォーマット
{
  "plausible": true/false,
  "correctness_level": "R1-R10 or None",
  "reasoning_quality": __,
  "efficiency_rating": "Excellent/Good/Fair/Poor",
  "detailed_analysis": "..."
}
```

## 実装スケルトン

```python
class PatchQualityEvaluator:
    def __init__(self, llm_client):
        self.llm_client = llm_client
        
    def evaluate_case(self, case_path, agent_result_path):
        # 正解データ読み込み
        ground_truth = self.load_ground_truth(case_path)
        
        # エージェント結果読み込み
        agent_result = self.load_agent_result(agent_result_path)
        
        # 思考プロセス要約
        reasoning_summary = self.summarize_reasoning(agent_result)
        
        # LLM評価実行
        evaluation = self.llm_evaluate_patch_quality(
            ground_truth, agent_result, reasoning_summary
        )
        
        return evaluation
        
    def load_ground_truth(self, case_path):
        premerge_path = f"{case_path}/premerge_*"
        merge_path = f"{case_path}/merge_*"
        
        # プレマージとマージ後の差分を計算
        diff = self.calculate_diff(premerge_path, merge_path)
        return diff
        
    def summarize_reasoning(self, agent_result):
        interaction_log = agent_result.get('interaction_log', {})
        thoughts = []
        plans = []
        
        for turn in interaction_log.get('turns', []):
            parsed = turn.get('parsed_content', {})
            if parsed.get('thought'):
                thoughts.append(parsed['thought'])
            if parsed.get('plan'):
                plans.append(parsed['plan'])
                
        return {
            'key_insights': thoughts,
            'strategic_approaches': plans,
            'total_turns': len(interaction_log.get('turns', []))
        }
```
