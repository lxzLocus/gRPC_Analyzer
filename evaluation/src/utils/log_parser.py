"""
APRログパーサー - LLM評価用データ抽出
ログファイルからシステム仕様準拠性評価のための情報を抽出する
"""

import json
import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ParsedTurn:
    """パースされたターン情報"""
    turn_number: int
    timestamp: str
    raw_llm_response: str
    system_parsed_content: Dict[str, Any]
    action_summary: str
    parsing_success: bool
    workflow_tags_found: List[str]


@dataclass
class ParsedExperiment:
    """パースされた実験情報"""
    experiment_id: str
    total_turns: int
    start_time: str
    end_time: str
    status: str
    total_tokens: Dict[str, int]
    turns: List[ParsedTurn]


class APRLogParser:
    """APRログパーサー"""
    
    def __init__(self):
        # 制御タグの定義
        self.workflow_tags = {
            '%_Thought_%': 'Thought',
            '%_Plan_%': 'Plan',
            '%_Reply Required_%': 'Reply Required',
            '%_Modified_%': 'Modified',
            '%%_Fin_%%': 'Fin'
        }
        
        # プロンプト生成器の初期化
        self.prompt_generator = SystemCompliancePromptGenerator()
        
    def parse_log_file(self, log_file_path: Path) -> Optional[ParsedExperiment]:
        """ログファイルを解析してParsedExperimentオブジェクトを返す"""
        try:
            with open(log_file_path, 'r', encoding='utf-8') as f:
                log_data = json.load(f)
            
            return self._parse_log_data(log_data)
            
        except Exception as e:
            print(f"⚠️  ログファイル解析エラー: {log_file_path} - {e}")
            return None
    
    def _parse_log_data(self, log_data: Dict) -> ParsedExperiment:
        """ログデータからParsedExperimentオブジェクトを生成"""
        
        # メタデータの抽出
        metadata = log_data.get('experiment_metadata', {})
        experiment_id = metadata.get('experiment_id', 'unknown')
        total_turns = metadata.get('total_turns', 0)
        start_time = metadata.get('start_time', '')
        end_time = metadata.get('end_time', '')
        status = metadata.get('status', 'unknown')
        total_tokens = metadata.get('total_tokens', {})
        
        # 各ターンの解析
        turns = []
        for turn_data in log_data.get('interaction_log', []):
            parsed_turn = self._parse_turn(turn_data)
            if parsed_turn:
                turns.append(parsed_turn)
        
        return ParsedExperiment(
            experiment_id=experiment_id,
            total_turns=total_turns,
            start_time=start_time,
            end_time=end_time,
            status=status,
            total_tokens=total_tokens,
            turns=turns
        )
    
    def _parse_turn(self, turn_data: Dict) -> Optional[ParsedTurn]:
        """単一ターンのデータを解析"""
        try:
            turn_number = turn_data.get('turn', 0)
            timestamp = turn_data.get('timestamp', '')
            
            # LLM応答の取得
            llm_response = turn_data.get('llm_response', {})
            raw_content = llm_response.get('raw_content', '')
            parsed_content = llm_response.get('parsed_content', {})
            
            # ワークフロータグの検出
            workflow_tags_found = self._detect_workflow_tags(raw_content)
            action_summary = ' -> '.join(workflow_tags_found) if workflow_tags_found else 'No tags detected'
            
            # パーシング成功の判定
            parsing_success = self._evaluate_parsing_success(raw_content, parsed_content)
            
            return ParsedTurn(
                turn_number=turn_number,
                timestamp=timestamp,
                raw_llm_response=raw_content,
                system_parsed_content=parsed_content,
                action_summary=action_summary,
                parsing_success=parsing_success,
                workflow_tags_found=workflow_tags_found
            )
            
        except Exception as e:
            print(f"⚠️  ターン解析エラー: {e}")
            return None
    
    def _detect_workflow_tags(self, raw_content: str) -> List[str]:
        """生のLLM応答からワークフロータグを検出"""
        found_tags = []
        
        for tag_pattern, tag_name in self.workflow_tags.items():
            # エスケープしてパターンマッチング
            escaped_pattern = re.escape(tag_pattern)
            if re.search(escaped_pattern, raw_content):
                found_tags.append(tag_name)
        
        return found_tags
    
    def _evaluate_parsing_success(self, raw_content: str, parsed_content: Dict) -> bool:
        """パーシング成功を評価"""
        if not raw_content:
            return False
        
        # パースされたコンテンツが空でないかチェック
        if not parsed_content:
            return False
        
        # 主要フィールドの存在チェック
        key_fields = ['thought', 'plan', 'reply_required', 'modified_diff']
        parsed_fields = sum(1 for field in key_fields if parsed_content.get(field) is not None)
        
        # 生のコンテンツにタグが含まれているかチェック
        tags_in_raw = len(self._detect_workflow_tags(raw_content))
        
        # パーシングされたフィールド数がタグ数に比例しているか
        if tags_in_raw > 0:
            return parsed_fields > 0 and parsed_fields >= (tags_in_raw * 0.5)  # 50%以上のタグがパースされていれば成功
        
        return parsed_fields > 0
    
    def extract_evaluation_data(self, parsed_experiment: ParsedExperiment) -> Dict[str, Any]:
        """評価用LLMに送信するためのデータを抽出"""
        evaluation_data = {
            "experiment_id": parsed_experiment.experiment_id,
            "total_turns": parsed_experiment.total_turns,
            "start_time": parsed_experiment.start_time,
            "end_time": parsed_experiment.end_time,
            "status": parsed_experiment.status,
            "turns": []
        }
        
        for turn in parsed_experiment.turns:
            turn_data = {
                "turn_number": turn.turn_number,
                "timestamp": turn.timestamp,
                "action_summary": turn.action_summary,
                "raw_llm_response": turn.raw_llm_response,
                "system_parsed_content": turn.system_parsed_content,
                "workflow_tags_found": turn.workflow_tags_found,
                "parsing_success": turn.parsing_success
            }
            evaluation_data["turns"].append(turn_data)
        
        return evaluation_data


class SystemCompliancePromptGenerator:
    """システム仕様準拠性評価用プロンプト生成器"""
    
    def __init__(self):
        self.prompt_template = self._load_prompt_template()
    
    def _load_prompt_template(self) -> str:
        """プロンプトテンプレートを定義"""
        return """## Role and Goal ##
You are a meticulous Quality Assurance (QA) Engineer. Your task is to evaluate the operational integrity of an AI agent system based on its interaction logs. You will perform two specific checks:
1. **Parser Integrity Check**: Verify if the system's internal parser correctly interpreted the raw response from the LLM.
2. **Workflow Compliance Check**: Assess if the agent's sequence of actions adheres to the documented operational workflow.

Provide your evaluation in a structured JSON format.

---
## System Specifications ##

### 1. Workflow Rules ###
The agent MUST follow a "Think -> Plan -> Act" cycle.
- **`%_Thought_%`**: The agent must first analyze the situation.
- **`%_Plan_%`**: Based on the thought, the agent must create a step-by-step plan.
- **Act**: After planning, the agent can act by requesting information (`%_Reply Required_%`) or proposing a patch (`%_Modified_%`).
- **`%%_Fin_%%`**: The agent must use this tag to signal the completion of all tasks. An agent can finish in any turn if it deems the task complete.

### 2. Parser Rules ###
The system's parser is responsible for extracting content from tags in the "Raw LLM Response" and structuring it into the "System's Parsed Content" JSON object. For example, text within `%_Thought_%` should populate the `thought` field in the JSON.

---
## Log Data to Evaluate ##

**Experiment ID**: `{experiment_id}`
**Total Turns**: `{total_turns}`
**Start Time**: `{start_time}`
**End Time**: `{end_time}`
**Status**: `{status}`

---
{turns_content}

---

## Your Task: Provide Evaluation in JSON Format

Based on the specifications and log data, provide your evaluation.

```json
{
  "parser_evaluation": [
    {
      "turn": 1,
      "status": "PASS/FAIL",
      "reasoning": "Detailed explanation of parser performance for this turn"
    }
  ],
  "workflow_evaluation": {
    "is_compliant": true/false,
    "reasoning": "Detailed explanation of workflow compliance"
  },
  "overall_assessment": {
    "system_health": "EXCELLENT/GOOD/POOR/CRITICAL",
    "critical_issues": ["List of critical issues if any"],
    "recommendations": ["List of improvement recommendations"]
  }
}
```

Please analyze each turn carefully and provide a comprehensive evaluation."""

    def generate_prompt(self, evaluation_data: Dict[str, Any]) -> str:
        """評価データからプロンプトを生成"""
        
        # ターン情報の生成
        turns_content = []
        for i, turn in enumerate(evaluation_data["turns"], 1):
            turn_section = f"""### Turn {turn["turn_number"]} ###

**Timestamp**: `{turn["timestamp"]}`
**Action Summary**: `{turn["action_summary"]}`

**Raw LLM Response**:
```
{turn["raw_llm_response"]}
```

**System's Parsed Content**:
```json
{json.dumps(turn["system_parsed_content"], indent=2, ensure_ascii=False)}
```

**Tags Found in Raw Response**: {', '.join(turn["workflow_tags_found"]) if turn["workflow_tags_found"] else 'None'}
**Parser Success**: {'✅ SUCCESS' if turn["parsing_success"] else '❌ FAILED'}

---"""
            turns_content.append(turn_section)
        
        # プロンプトテンプレートに値を挿入
        prompt = self.prompt_template.format(
            experiment_id=evaluation_data["experiment_id"],
            total_turns=evaluation_data["total_turns"],
            start_time=evaluation_data["start_time"],
            end_time=evaluation_data["end_time"],
            status=evaluation_data["status"],
            turns_content="\n".join(turns_content)
        )
        
        return prompt


def demo_log_parsing():
    """ログ解析のデモンストレーション"""
    print("🔍 APRログ解析デモ")
    print("=" * 50)
    
    # ログファイルのパース
    log_file = Path("/app/apr-logs/servantes/pullrequest/add_Secrets_service-_global_yaml/2025-07-20_10-23-50_JST.log")
    
    parser = APRLogParser()
    parsed_experiment = parser.parse_log_file(log_file)
    
    if not parsed_experiment:
        print("❌ ログファイルの解析に失敗しました")
        return
    
    print(f"📊 実験情報:")
    print(f"  - ID: {parsed_experiment.experiment_id}")
    print(f"  - ターン数: {parsed_experiment.total_turns}")
    print(f"  - ステータス: {parsed_experiment.status}")
    print(f"  - トークン数: {parsed_experiment.total_tokens}")
    print()
    
    print("🔄 ターン別分析:")
    for turn in parsed_experiment.turns:
        print(f"  Turn {turn.turn_number}:")
        print(f"    - アクション: {turn.action_summary}")
        print(f"    - パーシング成功: {'✅' if turn.parsing_success else '❌'}")
        print(f"    - 検出タグ: {turn.workflow_tags_found}")
        print()
    
    # 評価用データの生成
    evaluation_data = parser.extract_evaluation_data(parsed_experiment)
    
    # プロンプトの生成
    prompt_generator = SystemCompliancePromptGenerator()
    evaluation_prompt = prompt_generator.generate_prompt(evaluation_data)
    
    print(f"📝 生成されたプロンプト長: {len(evaluation_prompt):,}文字")
    print(f"🎯 評価準備完了 - LLMにリクエスト可能")
    
    # プロンプトの一部を表示
    print("\n📄 プロンプト例 (最初の500文字):")
    print("-" * 50)
    print(evaluation_prompt[:500] + "...")
    
    return evaluation_data, evaluation_prompt


if __name__ == "__main__":
    demo_log_parsing()
