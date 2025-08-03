#!/usr/bin/env python3
"""
LLM生成レスポンス内容表示ツール
評価システムのLLMが実際に生成した詳細なレスポンス内容を表示
"""

import sys
import json
import asyncio

sys.path.append('/app')
sys.path.append('/app/src')

from src.llm.llm_integration import MockLLMProvider, OpenAIProvider, AnthropicProvider
from src.utils.template_manager import APRPromptTemplates


async def show_llm_response_details():
    """LLM応答の詳細内容を表示"""
    print("🤖 LLM評価レスポンス詳細表示ツール")
    print("=" * 60)
    
    # 各種プロバイダーをテスト
    providers_info = [
        ("Mock LLM", MockLLMProvider()),
        # 実際のAPIキーがあれば以下も有効化可能
        # ("OpenAI GPT-4", OpenAIProvider("gpt-4.1")),
        # ("Anthropic Claude", AnthropicProvider("claude-3-sonnet-20240229"))
    ]
    
    # APRプロンプトテンプレート管理
    template_manager = APRPromptTemplates(template_style="default")
    
    # サンプル評価データ
    sample_evaluation_data = {
        "experiment_id": "servantes/Issue_sample_evaluation",
        "turn_count": 2,
        "overall_status": "SUCCESS",
        "turns_data": [
            {
                "turn": 1,
                "action": "think",
                "content": "Analyzing the problem requirements and understanding the scope of the issue.",
                "parsed_content": {"analysis": "initial problem assessment", "status": "completed"}
            },
            {
                "turn": 2, 
                "action": "plan",
                "content": "Developing a comprehensive strategy to address the identified issues.",
                "parsed_content": {"strategy": "implementation plan", "status": "completed"}
            }
        ]
    }
    
    for provider_name, provider in providers_info:
        print(f"\n🧠 {provider_name} レスポンス詳細")
        print("-" * 40)
        
        try:
            # プロンプトを生成
            prompt = template_manager.get_evaluation_prompt(sample_evaluation_data)
            print(f"📝 送信プロンプト長: {len(prompt)} 文字")
            print(f"📄 プロンプト内容（最初の200文字）:")
            print(prompt[:200] + "...")
            print()
            
            # LLM応答を生成
            response = await provider.generate(prompt)
            
            print(f"✅ レスポンス成功: {response.success}")
            if not response.success:
                print(f"❌ エラー: {response.error_message}")
                continue
            
            print(f"📊 使用量: {response.usage}")
            print(f"🤖 モデル: {response.model}")
            print(f"🔗 プロバイダー: {response.provider}")
            print()
            
            print("📃 生成されたLLM評価内容:")
            print("-" * 30)
            
            # JSONとして整形表示を試行
            try:
                parsed_response = json.loads(response.content)
                print(json.dumps(parsed_response, indent=2, ensure_ascii=False))
                
                # 評価内容の解析
                print("\\n🔍 評価内容解析:")
                if "parser_evaluation" in parsed_response:
                    parser_evals = parsed_response["parser_evaluation"]
                    print(f"  - パーサー評価ターン数: {len(parser_evals)}")
                    for i, eval_item in enumerate(parser_evals, 1):
                        print(f"    Turn {i}: {eval_item.get('status', 'N/A')} - {eval_item.get('reasoning', 'N/A')[:50]}...")
                
                if "workflow_evaluation" in parsed_response:
                    workflow = parsed_response["workflow_evaluation"]
                    print(f"  - ワークフロー適合: {workflow.get('is_compliant', 'N/A')}")
                    print(f"  - ワークフロー理由: {workflow.get('reasoning', 'N/A')[:80]}...")
                
                if "overall_assessment" in parsed_response:
                    assessment = parsed_response["overall_assessment"]
                    print(f"  - システム健全性: {assessment.get('system_health', 'N/A')}")
                    print(f"  - 重大問題数: {len(assessment.get('critical_issues', []))}")
                    print(f"  - 推奨事項数: {len(assessment.get('recommendations', []))}")
                
            except json.JSONDecodeError:
                # JSON以外の場合はそのまま表示
                print(response.content)
                
        except Exception as e:
            print(f"❌ {provider_name} でエラーが発生: {e}")
    
    print("\\n" + "=" * 60)
    print("💡 実際の評価結果ファイルでLLMレスポンス内容を確認するには:")
    print("   python scripts/evaluation_log_viewer.py --latest")
    print("   python scripts/evaluation_log_viewer.py --repo servantes")
    print("   python scripts/evaluation_log_viewer.py -f [ファイル名]")


async def compare_different_templates():
    """異なるテンプレートでのLLM応答を比較"""
    print("\\n🎨 異なるテンプレートでのLLM応答比較")
    print("=" * 60)
    
    template_styles = ["default", "japanese", "simple"]
    provider = MockLLMProvider()
    
    sample_data = {
        "experiment_id": "sample/test_comparison",
        "turn_count": 1,
        "overall_status": "SUCCESS", 
        "turns_data": [{"turn": 1, "status": "completed"}]
    }
    
    for style in template_styles:
        print(f"\\n📋 テンプレートスタイル: {style}")
        print("-" * 30)
        
        template_manager = APRPromptTemplates(template_style=style)
        prompt = template_manager.get_evaluation_prompt(sample_data)
        
        print(f"📏 プロンプト長: {len(prompt)} 文字")
        
        response = await provider.generate(prompt)
        if response.success:
            print(f"📊 トークン使用量: {response.usage.get('total_tokens', 'N/A')}")
            print(f"📄 応答内容（最初の150文字）:")
            print(response.content[:150] + "...")
        else:
            print(f"❌ 応答失敗: {response.error_message}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="LLM応答詳細表示ツール")
    parser.add_argument("--compare-templates", action="store_true", help="異なるテンプレートでの応答を比較")
    
    args = parser.parse_args()
    
    if args.compare_templates:
        asyncio.run(compare_different_templates())
    else:
        asyncio.run(show_llm_response_details())
