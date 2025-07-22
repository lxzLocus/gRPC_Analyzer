# ステップ1：システム仕様準拠性評価器

## 目的
APRシステムが設計仕様通りに動作しているかを評価

## 入力データ
- `/app/logs/*/interaction_log.json` - 各ケースの対話履歴
- `/app/output/processing_summary_*.json` - 全体の処理サマリー

## 評価項目

### 1. 制御フロー準拠性
- `%_Thought_%` → `%_Plan_%` → `%_Reply Required_%` の順序
- `%%_Fin_%%` タグでの適切な終了
- 無限ループの回避（最大ターン数制限）

### 2. パーサー精度
- `raw_content` と `parsed_content` の整合性
- JSON形式ファイル要求の正しい解析
- タグ形式の正確な認識

### 3. エラーハンドリング
- LLM API エラーの適切な処理
- タイムアウトの適切な処理
- 不正な応答フォーマットの処理

## 評価LLMプロンプト例

```
# システム仕様準拠性評価

## 評価対象
- 対話履歴: {interaction_sequence}
- パース結果: {parsing_results}
- エラーログ: {error_logs}

## 評価基準
1. **制御フロー準拠性** (0-100点)
   - Thought→Plan→Actionの順序遵守: __/25点
   - 適切な%%_Fin_%%終了: __/25点
   - ループ制御の適切性: __/25点
   - 例外処理の適切性: __/25点

2. **パーサー精度** (0-100点)
   - タグ認識精度: __/50点
   - JSON解析精度: __/50点

## 出力フォーマット
{
  "compliance_score": __,
  "parser_accuracy": __,
  "issues_found": ["issue1", "issue2"],
  "recommendations": ["rec1", "rec2"]
}
```

## 実装スケルトン

```python
class SystemComplianceEvaluator:
    def __init__(self, llm_client):
        self.llm_client = llm_client
        
    def evaluate_case(self, interaction_log_path):
        # ログファイル解析
        with open(interaction_log_path) as f:
            log_data = json.load(f)
        
        # 制御フロー分析
        flow_analysis = self.analyze_control_flow(log_data)
        
        # パーサー精度分析
        parser_analysis = self.analyze_parser_accuracy(log_data)
        
        # LLM評価実行
        evaluation = self.llm_evaluate_compliance(flow_analysis, parser_analysis)
        
        return evaluation
        
    def analyze_control_flow(self, log_data):
        sequence = []
        for turn in log_data.get('turns', []):
            if 'parsed_content' in turn:
                tags = self.extract_tags(turn['raw_content'])
                sequence.append(tags)
        return sequence
        
    def analyze_parser_accuracy(self, log_data):
        accuracy_data = []
        for turn in log_data.get('turns', []):
            raw = turn.get('raw_content', '')
            parsed = turn.get('parsed_content', {})
            accuracy_data.append({
                'raw_has_thought': '%_Thought_%' in raw,
                'parsed_has_thought': bool(parsed.get('thought')),
                'raw_has_plan': '%_Plan_%' in raw,
                'parsed_has_plan': bool(parsed.get('plan')),
                'raw_has_fin': '%%_Fin_%%' in raw,
                'parsed_has_fin': parsed.get('has_fin_tag', False)
            })
        return accuracy_data
```
