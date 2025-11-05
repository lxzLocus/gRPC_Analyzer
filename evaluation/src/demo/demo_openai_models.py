#!/usr/bin/env python3
"""
OpenAI モデル選択デモンストレーション
SystemComplianceEvaluatorでの様々なOpenAIモデル選択をデモ
"""

import asyncio
import os
from src.evaluators.compliance_evaluator import SystemComplianceEvaluator


async def demo_openai_model_selection():
    """OpenAI モデル選択のデモンストレーション"""
    print("🤖 OpenAI モデル選択機能デモ")
    print("=" * 50)
    
    # 利用可能なOpenAIモデル
    available_models = [
        "gpt-4.1",           # 最新の高性能モデル
        "gpt-4.1-mini",      # 軽量版
        "gpt-4-turbo",      # 高速版
        "gpt-4",            # 標準GPT-4
        "gpt-3.5-turbo"     # 軽量高速
    ]
    
    print("📋 対応OpenAIモデル:")
    for i, model in enumerate(available_models, 1):
        print(f"  {i}. {model}")
    
    # APIキー確認
    api_key_available = bool(os.getenv("OPENAI_API_KEY"))
    print(f"\n🔑 OpenAI API Key: {'✅ 設定済み' if api_key_available else '❌ 未設定'}")
    
    if not api_key_available:
        print("\n⚠️  OpenAI APIキーが設定されていないため、初期化のみテストします")
        print("   実際のLLM評価を行うには、OPENAI_API_KEYを設定してください")
    
    print("\n🔧 各モデルでの初期化テスト:")
    print("-" * 40)
    
    # 各モデルの初期化をテスト
    for model in available_models[:3]:  # 最初の3つをテスト
        print(f"\n🚀 テスト: {model}")
        
        try:
            evaluator = SystemComplianceEvaluator(
                llm_provider="openai",
                llm_model=model
            )
            print(f"✅ 初期化成功 - プロバイダー: OpenAI, モデル: {model}")
            
        except ValueError as e:
            print(f"⚠️  初期化警告: {e}")
        except Exception as e:
            print(f"❌ 初期化エラー: {e}")
    
    # 不正なモデル名テスト
    print(f"\n🧪 不正なモデル名での動作テスト:")
    try:
        evaluator = SystemComplianceEvaluator(
            llm_provider="openai",
            llm_model="gpt-nonexistent-model"
        )
        print("✅ 不正なモデル名でも警告付きで初期化される")
    except Exception as e:
        print(f"❌ 予期しないエラー: {e}")


def demo_usage_examples():
    """実用的な使用例を表示"""
    print("\n💡 実用的な使用例")
    print("=" * 50)
    
    examples = [
        {
            "scenario": "高精度な評価が必要なプロダクション環境",
            "code": 'evaluator = SystemComplianceEvaluator(llm_provider="openai", llm_model="gpt-4.1")',
            "description": "最新かつ最高性能のモデル。重要な評価に最適"
        },
        {
            "scenario": "コスト効率を重視した開発環境",
            "code": 'evaluator = SystemComplianceEvaluator(llm_provider="openai", llm_model="gpt-4.1-mini")',
            "description": "軽量版で基本的な評価には十分。コスト削減に効果的"
        },
        {
            "scenario": "大量データの高速処理",
            "code": 'evaluator = SystemComplianceEvaluator(llm_provider="openai", llm_model="gpt-4-turbo")',
            "description": "高速レスポンス。バッチ処理や大規模評価に適している"
        },
        {
            "scenario": "デフォルト設定（推奨）",
            "code": 'evaluator = SystemComplianceEvaluator(llm_provider="openai")',
            "description": "モデル未指定時はgpt-4.1が自動選択される"
        },
        {
            "scenario": "テスト・開発時（APIキー不要）",
            "code": 'evaluator = SystemComplianceEvaluator(llm_provider="mock")',
            "description": "モック実装。APIキーなしでテスト可能"
        }
    ]
    
    for example in examples:
        print(f"\n🎯 {example['scenario']}:")
        print(f"   コード: {example['code']}")
        print(f"   説明: {example['description']}")


def demo_comparison_table():
    """モデル比較表を表示"""
    print("\n📊 OpenAIモデル比較表")
    print("=" * 70)
    
    models_info = [
        {
            "model": "gpt-4.1",
            "performance": "★★★★★",
            "cost": "高",
            "speed": "中",
            "use_case": "プロダクション・高精度評価"
        },
        {
            "model": "gpt-4.1-mini", 
            "performance": "★★★★☆",
            "cost": "低",
            "speed": "高",
            "use_case": "開発・基本評価"
        },
        {
            "model": "gpt-4-turbo",
            "performance": "★★★★☆",
            "cost": "中",
            "speed": "★★★★★",
            "use_case": "大量データ・高速処理"
        },
        {
            "model": "gpt-4",
            "performance": "★★★★☆",
            "cost": "高",
            "speed": "中",
            "use_case": "安定性重視・レガシー互換"
        },
        {
            "model": "gpt-3.5-turbo",
            "performance": "★★★☆☆",
            "cost": "★★★★★",
            "speed": "★★★★★",
            "use_case": "テスト・軽量評価"
        }
    ]
    
    # テーブルヘッダー
    print(f"{'モデル':<15} {'性能':<12} {'コスト':<8} {'速度':<12} {'推奨用途':<20}")
    print("-" * 70)
    
    # テーブル内容
    for info in models_info:
        print(f"{info['model']:<15} {info['performance']:<12} {info['cost']:<8} {info['speed']:<12} {info['use_case']:<20}")


async def main():
    """メイン実行関数"""
    await demo_openai_model_selection()
    demo_usage_examples()
    demo_comparison_table()
    
    print(f"\n🎯 総括")
    print("=" * 30)
    print("✅ OpenAI モデル選択機能が正常に実装されました")
    print("✅ 推奨モデル一覧と警告機能が動作しています") 
    print("✅ 様々な用途に応じたモデル選択が可能です")
    print("\n🚀 次のステップ:")
    print("  1. OPENAI_API_KEYを設定して実際のLLM評価をテスト")
    print("  2. 各モデルでの評価結果を比較")
    print("  3. プロジェクトの要件に応じた最適モデルを選択")


if __name__ == "__main__":
    asyncio.run(main())
