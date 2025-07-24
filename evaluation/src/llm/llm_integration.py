"""
LLM統合システム
OpenAI、Anthropic、その他のLLMプロバイダーとの統合
"""

import json
import os
import time
import asyncio
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from abc import ABC, abstractmethod
from pathlib import Path


@dataclass
class LLMResponse:
    """LLM応答データクラス"""
    content: str
    usage: Dict[str, Any]
    model: str
    provider: str
    success: bool
    error_message: Optional[str] = None


class BaseLLMProvider(ABC):
    """LLMプロバイダーの基底クラス"""
    
    def __init__(self, model_name: str, api_key: Optional[str] = None):
        self.model_name = model_name
        self.api_key = api_key
        self.rate_limit_delay = 1.0  # 秒
        
    @abstractmethod
    async def generate(self, prompt: str, **kwargs) -> LLMResponse:
        """プロンプトに対してLLM応答を生成"""
        pass
    
    def _handle_rate_limit(self, retry_count: int = 0) -> float:
        """レート制限のハンドリング"""
        delay = self.rate_limit_delay * (2 ** retry_count)  # 指数バックオフ
        return min(delay, 60.0)  # 最大60秒


class OpenAIProvider(BaseLLMProvider):
    """OpenAI LLMプロバイダー"""
    
    def __init__(self, model_name: str = "gpt-4", api_key: Optional[str] = None):
        super().__init__(model_name, api_key or os.getenv("OPENAI_API_KEY"))
        self.rate_limit_delay = 1.0
        
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
    
    async def generate(self, prompt: str, max_retries: int = 3, **kwargs) -> LLMResponse:
        """OpenAI APIを使用してLLM応答を生成"""
        
        for attempt in range(max_retries + 1):
            try:
                # 新しいOpenAI APIクライアントの初期化
                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=self.api_key)
                
                response = await client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": "You are a helpful AI assistant specializing in code analysis and evaluation. You must respond with valid JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=kwargs.get("max_tokens", 4000),
                    temperature=kwargs.get("temperature", 0.1),
                    response_format={"type": "json_object"}
                )
                
                return LLMResponse(
                    content=response.choices[0].message.content,
                    usage=response.usage.model_dump() if response.usage else {},
                    model=self.model_name,
                    provider="openai",
                    success=True
                )
                
            except Exception as e:
                if "rate_limit" in str(e).lower() and attempt < max_retries:
                    delay = self._handle_rate_limit(attempt)
                    print(f"⏳ OpenAI レート制限 - {delay:.1f}秒待機中...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    return LLMResponse(
                        content="",
                        usage={},
                        model=self.model_name,
                        provider="openai",
                        success=False,
                        error_message=str(e)
                    )
        
        return LLMResponse(
            content="",
            usage={},
            model=self.model_name,
            provider="openai",
            success=False,
            error_message="Max retries exceeded"
        )


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude LLMプロバイダー"""
    
    def __init__(self, model_name: str = "claude-3-sonnet-20240229", api_key: Optional[str] = None):
        super().__init__(model_name, api_key or os.getenv("ANTHROPIC_API_KEY"))
        self.rate_limit_delay = 2.0
        
        if not self.api_key:
            raise ValueError("Anthropic API key is required")
    
    async def generate(self, prompt: str, max_retries: int = 3, **kwargs) -> LLMResponse:
        """Anthropic APIを使用してLLM応答を生成"""
        
        for attempt in range(max_retries + 1):
            try:
                # Anthropic APIクライアントの初期化（仮想実装）
                import anthropic
                client = anthropic.AsyncAnthropic(api_key=self.api_key)
                
                response = await client.messages.create(
                    model=self.model_name,
                    max_tokens=kwargs.get("max_tokens", 4000),
                    temperature=kwargs.get("temperature", 0.1),
                    messages=[
                        {"role": "user", "content": prompt}
                    ]
                )
                
                return LLMResponse(
                    content=response.content[0].text,
                    usage={"input_tokens": response.usage.input_tokens, "output_tokens": response.usage.output_tokens},
                    model=self.model_name,
                    provider="anthropic",
                    success=True
                )
                
            except Exception as e:
                if "rate_limit" in str(e).lower() and attempt < max_retries:
                    delay = self._handle_rate_limit(attempt)
                    print(f"⏳ Anthropic レート制限 - {delay:.1f}秒待機中...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    return LLMResponse(
                        content="",
                        usage={},
                        model=self.model_name,
                        provider="anthropic",
                        success=False,
                        error_message=str(e)
                    )
        
        return LLMResponse(
            content="",
            usage={},
            model=self.model_name,
            provider="anthropic",
            success=False,
            error_message="Max retries exceeded"
        )


class MockLLMProvider(BaseLLMProvider):
    """テスト用のモックLLMプロバイダー"""
    
    def __init__(self, model_name: str = "mock-gpt"):
        super().__init__(model_name, "mock_api_key")
        self.rate_limit_delay = 0.1
    
    async def generate(self, prompt: str, **kwargs) -> LLMResponse:
        """モック応答を生成"""
        
        # 簡単な遅延をシミュレート
        await asyncio.sleep(0.1)
        
        # プロンプト内容に基づいてモック応答を生成
        if "parser_evaluation" in prompt.lower():
            # より現実的で詳細な英語評価応答を生成
            mock_response = {
                "parser_evaluation": [
                    {
                        "turn": 1,
                        "status": "PASS",
                        "reasoning": "JSON structure is well-formed with complete metadata fields. Parser successfully extracted experiment ID, timestamps, and token usage data. No structural anomalies detected in turn 1."
                    },
                    {
                        "turn": 2,
                        "status": "PASS", 
                        "reasoning": "Continued parsing shows consistent data structure. Turn-to-turn data integrity maintained. All required fields present with valid data types."
                    }
                ],
                "workflow_evaluation": {
                    "is_compliant": True,
                    "reasoning": "System demonstrates proper Think->Plan->Act workflow adherence. Clear phase transitions observed with appropriate data flow between stages. Logical progression from problem analysis through strategy formulation to implementation execution."
                },
                "overall_assessment": {
                    "system_health": "GOOD",
                    "critical_issues": ["Minor performance optimization opportunities in token usage"],
                    "recommendations": [
                        "Consider implementing caching for repetitive analysis patterns",
                        "Add performance monitoring for turn processing times",
                        "Enhance error logging granularity for better debugging"
                    ]
                }
            }
            content = json.dumps(mock_response, indent=2, ensure_ascii=False)
        else:
            content = "Mock LLM Professional Response: Comprehensive system analysis complete. All evaluation criteria have been assessed using industry-standard methodologies."
        
        return LLMResponse(
            content=content,
            usage={"prompt_tokens": len(prompt) // 4, "completion_tokens": len(content) // 4, "total_tokens": (len(prompt) + len(content)) // 4},
            model=self.model_name,
            provider="mock",
            success=True
        )


class LLMProviderFactory:
    """LLMプロバイダーファクトリー"""
    
    @staticmethod
    def create_provider(provider_name: str, model_name: Optional[str] = None, api_key: Optional[str] = None) -> BaseLLMProvider:
        """プロバイダー名に基づいてLLMプロバイダーを作成"""
        
        provider_name = provider_name.lower()
        
        if provider_name == "openai":
            model = model_name or "gpt-4"
            return OpenAIProvider(model, api_key)
        
        elif provider_name == "anthropic":
            model = model_name or "claude-3-sonnet-20240229"
            return AnthropicProvider(model, api_key)
        
        elif provider_name == "mock":
            model = model_name or "mock-gpt"
            return MockLLMProvider(model)
        
        else:
            raise ValueError(f"Unsupported provider: {provider_name}")


class LLMEvaluationManager:
    """LLM評価マネージャー"""
    
    def __init__(self, provider: BaseLLMProvider):
        self.provider = provider
        self.evaluation_cache = {}
    
    async def evaluate_system_compliance(self, prompt: str, cache_key: Optional[str] = None) -> LLMResponse:
        """システム仕様準拠性評価を実行"""
        
        # キャッシュチェック
        if cache_key and cache_key in self.evaluation_cache:
            cached_response = self.evaluation_cache[cache_key]
            print(f"📋 キャッシュから取得: {cache_key}")
            return cached_response
        
        print(f"🤖 LLM評価実行中 - プロバイダー: {self.provider.__class__.__name__}")
        print(f"📝 プロンプト長: {len(prompt):,}文字")
        
        start_time = time.time()
        response = await self.provider.generate(prompt)
        end_time = time.time()
        
        if response.success:
            print(f"✅ 評価完了 - 実行時間: {end_time - start_time:.2f}秒")
            print(f"📊 使用量: {response.usage}")
            
            # キャッシュに保存
            if cache_key:
                self.evaluation_cache[cache_key] = response
        else:
            print(f"❌ 評価失敗: {response.error_message}")
        
        return response
    
    def parse_evaluation_result(self, response_content: str) -> Optional[Dict[str, Any]]:
        """LLM評価結果をJSONとして解析"""
        try:
            # JSON部分を抽出（コードブロック内にある場合）
            import re
            json_match = re.search(r'```json\s*(.*?)\s*```', response_content, re.DOTALL)
            if json_match:
                json_content = json_match.group(1)
            else:
                # 全体がJSONの場合
                json_content = response_content
            
            return json.loads(json_content)
            
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"⚠️  JSON解析エラー: {e}")
            return None
    
    async def batch_evaluate(self, prompts: List[str], concurrent_limit: int = 3) -> List[LLMResponse]:
        """複数のプロンプトを並列評価"""
        
        semaphore = asyncio.Semaphore(concurrent_limit)
        
        async def evaluate_single(prompt: str, index: int) -> LLMResponse:
            async with semaphore:
                print(f"📝 評価 {index + 1}/{len(prompts)} 開始...")
                return await self.provider.generate(prompt)
        
        tasks = [evaluate_single(prompt, i) for i, prompt in enumerate(prompts)]
        responses = await asyncio.gather(*tasks)
        
        successful = sum(1 for r in responses if r.success)
        print(f"🎯 バッチ評価完了: {successful}/{len(responses)} 成功")
        
        return responses


async def demo_llm_integration():
    """LLM統合のデモンストレーション"""
    print("🤖 LLM統合システムデモ")
    print("=" * 50)
    
    # プロバイダーの作成（モックを使用）
    provider = LLMProviderFactory.create_provider("mock")
    manager = LLMEvaluationManager(provider)
    
    # サンプルプロンプト
    sample_prompt = """
    ## Role and Goal ##
    You are a QA Engineer evaluating system compliance.
    
    ## Log Data ##
    Turn 1: %_Thought_% Analysis complete %_Plan_% Step 1: Review code
    
    Provide parser_evaluation and workflow_evaluation in JSON format.
    """
    
    # 評価実行
    response = await manager.evaluate_system_compliance(sample_prompt, "demo_cache_key")
    
    if response.success:
        print("🎯 LLM評価成功!")
        print(f"📄 応答内容の最初の300文字:")
        print(response.content[:300] + "...")
        
        # JSON解析
        parsed_result = manager.parse_evaluation_result(response.content)
        if parsed_result:
            print("✅ JSON解析成功")
            print(f"📊 パーサー評価結果数: {len(parsed_result.get('parser_evaluation', []))}")
        
    else:
        print(f"❌ LLM評価失敗: {response.error_message}")
    
    # バッチ評価のデモ
    print("\n🔄 バッチ評価デモ...")
    batch_prompts = [sample_prompt] * 3
    batch_responses = await manager.batch_evaluate(batch_prompts, concurrent_limit=2)
    
    print(f"✅ バッチ評価完了: {len(batch_responses)}件")


if __name__ == "__main__":
    asyncio.run(demo_llm_integration())
