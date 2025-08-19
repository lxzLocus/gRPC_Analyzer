#!/usr/bin/env python3
"""
実LLM評価実行ツール
OpenAIを使用した実際のAPRシステム評価と詳細ログ出力
"""

import asyncio
import json
import sys
import os
from datetime import datetime
from pathlib import Path
import logging
from typing import Dict, Any, List

# .envファイルを明示的にロード
try:
    from dotenv import load_dotenv
    load_dotenv("/app/.env")
    print(f"✅ .envファイルをロード: OPENAI_API_KEY={'設定済み' if os.getenv('OPENAI_API_KEY') else '未設定'}")
except ImportError:
    print("⚠️  python-dotenvが未インストール - OSの環境変数を使用")

sys.path.append('/app')
sys.path.append('/app/src')

from src.evaluators.compliance_evaluator import SystemComplianceEvaluator


class DetailedLLMLogger:
    """詳細なLLM評価ログ出力クラス"""
    
    def __init__(self, output_dir: str = "/app/logs"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # ログファイル名を生成
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file = self.output_dir / f"llm_evaluation_detailed_{self.timestamp}.log"
        self.json_file = self.output_dir / f"llm_responses_{self.timestamp}.json"
        
        # ログ設定
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.log_file, encoding='utf-8'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        # LLMレスポンス詳細データ
        self.llm_responses = []
        
        self.logger.info(f"🔍 詳細LLM評価ログ開始 - {self.timestamp}")
        self.logger.info(f"📄 ログファイル: {self.log_file}")
        self.logger.info(f"📊 JSONファイル: {self.json_file}")
    
    def log_evaluation_start(self, repository: str, max_logs: int, provider: str, model: str):
        """評価開始のログ"""
        self.logger.info("=" * 80)
        self.logger.info(f"🎯 実LLM評価開始")
        self.logger.info(f"📂 対象リポジトリ: {repository}")
        self.logger.info(f"📊 最大処理ログ数: {max_logs}")
        self.logger.info(f"🤖 LLMプロバイダー: {provider}")
        self.logger.info(f"🧠 LLMモデル: {model}")
        self.logger.info("=" * 80)
    
    def log_prompt_and_response(self, log_path: str, experiment_id: str, 
                               prompt: str, response: str, usage: Dict, success: bool, 
                               error: str = None):
        """プロンプトとレスポンスの詳細ログ"""
        
        log_name = Path(log_path).name
        
        self.logger.info(f"\n📋 ログ処理: {log_name}")
        self.logger.info(f"🆔 実験ID: {experiment_id}")
        self.logger.info(f"📝 プロンプト長: {len(prompt)} 文字")
        self.logger.info(f"✅ LLM成功: {success}")
        
        if error:
            self.logger.error(f"❌ LLMエラー: {error}")
        
        if usage:
            total_tokens = usage.get('total_tokens', 0)
            prompt_tokens = usage.get('prompt_tokens', 0) 
            completion_tokens = usage.get('completion_tokens', 0)
            self.logger.info(f"🧮 トークン使用量: {total_tokens} (入力:{prompt_tokens}, 出力:{completion_tokens})")
        
        # 詳細データを保存
        response_data = {
            "timestamp": datetime.now().isoformat(),
            "log_path": log_path,
            "experiment_id": experiment_id,
            "prompt": prompt,
            "response": response,
            "usage": usage,
            "success": success,
            "error": error,
            "prompt_length": len(prompt),
            "response_length": len(response) if response else 0
        }
        
        self.llm_responses.append(response_data)
        
        # プロンプト内容を一部表示
        self.logger.info(f"📄 プロンプト内容（最初の200文字）:")
        self.logger.info(prompt[:200] + "...")
        
        # レスポンス内容を表示
        if success and response:
            self.logger.info(f"🤖 LLMレスポンス内容（最初の300文字）:")
            self.logger.info(response[:300] + "...")
            
            # JSONレスポンスの場合は構造も解析
            try:
                parsed_response = json.loads(response)
                self.logger.info("🔍 レスポンス構造解析:")
                
                if "parser_evaluation" in parsed_response:
                    parser_evals = parsed_response["parser_evaluation"]
                    self.logger.info(f"  📈 パーサー評価: {len(parser_evals)}ターン")
                    for i, eval_item in enumerate(parser_evals, 1):
                        status = eval_item.get("status", "N/A")
                        reasoning = eval_item.get("reasoning", "")[:60]
                        self.logger.info(f"    Turn {i}: {status} - {reasoning}...")
                
                if "workflow_evaluation" in parsed_response:
                    workflow = parsed_response["workflow_evaluation"]
                    compliance = workflow.get("is_compliant", "N/A")
                    self.logger.info(f"  🔄 ワークフロー適合: {compliance}")
                
                if "overall_assessment" in parsed_response:
                    assessment = parsed_response["overall_assessment"]
                    health = assessment.get("system_health", "N/A")
                    issues_count = len(assessment.get("critical_issues", []))
                    recommendations_count = len(assessment.get("recommendations", []))
                    self.logger.info(f"  ❤️  システム健全性: {health}")
                    self.logger.info(f"  ⚠️  重大問題数: {issues_count}")
                    self.logger.info(f"  💡 推奨事項数: {recommendations_count}")
                    
            except json.JSONDecodeError:
                self.logger.info("  📝 非JSON形式のレスポンス")
        else:
            self.logger.warning("⚠️  レスポンスが空または失敗")
    
    def log_evaluation_summary(self, result: Dict[str, Any]):
        """評価サマリーのログ"""
        self.logger.info("\n" + "=" * 80)
        self.logger.info("📊 評価結果サマリー")
        self.logger.info("=" * 80)
        
        summary = result.get("summary", {})
        metrics = result.get("compliance_metrics", {})
        
        self.logger.info(f"📂 リポジトリ: {result.get('repository_name', 'N/A')}")
        self.logger.info(f"⏱️  処理時間: {result.get('processing_time_seconds', 0):.2f}秒")
        self.logger.info(f"🤖 LLMプロバイダー: {result.get('llm_provider', 'N/A')}")
        self.logger.info(f"🧠 LLMモデル: {result.get('llm_model', 'N/A')}")
        
        self.logger.info("\n📈 処理統計:")
        self.logger.info(f"  - 総処理ログ数: {summary.get('total_logs_processed', 0)}")
        self.logger.info(f"  - LLM成功評価: {summary.get('successful_evaluations', 0)}")
        self.logger.info(f"  - LLM失敗評価: {summary.get('failed_evaluations', 0)}")
        self.logger.info(f"  - パーサー問題検出: {summary.get('parser_issues_detected', 0)}")
        self.logger.info(f"  - ワークフロー違反: {summary.get('workflow_violations', 0)}")
        self.logger.info(f"  - 重大システム数: {summary.get('critical_systems', 0)}")
        
        self.logger.info("\n🎯 適合性メトリクス:")
        self.logger.info(f"  - 制御フロー精度: {metrics.get('control_flow_accuracy', 0):.3f}")
        self.logger.info(f"  - パーサー成功率: {metrics.get('parser_success_rate', 0):.3f}")
        self.logger.info(f"  - ファイル処理率: {metrics.get('file_processing_rate', 0):.3f}")
        self.logger.info(f"  - エラー処理スコア: {metrics.get('error_handling_score', 0):.3f}")
        self.logger.info(f"  - 総合適合性: {metrics.get('overall_compliance', 0):.3f}")
        
        # トークン使用量の集計
        total_tokens = 0
        total_cost_estimate = 0.0
        for response_data in self.llm_responses:
            if response_data.get("usage"):
                tokens = response_data["usage"].get("total_tokens", 0)
                total_tokens += tokens
                # GPT-4の概算コスト (input: $0.03/1K, output: $0.06/1K tokens)
                input_tokens = response_data["usage"].get("prompt_tokens", 0)
                output_tokens = response_data["usage"].get("completion_tokens", 0)
                cost = (input_tokens * 0.03 + output_tokens * 0.06) / 1000
                total_cost_estimate += cost
        
        self.logger.info(f"\n💰 コスト情報:")
        self.logger.info(f"  - 総トークン使用量: {total_tokens:,}")
        self.logger.info(f"  - 概算コスト: ${total_cost_estimate:.4f} USD")
        
    def save_detailed_responses(self):
        """詳細なレスポンスデータをJSONファイルに保存"""
        detailed_data = {
            "evaluation_session": {
                "timestamp": self.timestamp,
                "total_responses": len(self.llm_responses),
                "log_file": str(self.log_file),
                "summary": {
                    "successful_responses": len([r for r in self.llm_responses if r.get("success")]),
                    "failed_responses": len([r for r in self.llm_responses if not r.get("success")]),
                    "total_tokens": sum(r.get("usage", {}).get("total_tokens", 0) for r in self.llm_responses),
                    "average_prompt_length": sum(r.get("prompt_length", 0) for r in self.llm_responses) / len(self.llm_responses) if self.llm_responses else 0,
                    "average_response_length": sum(r.get("response_length", 0) for r in self.llm_responses) / len(self.llm_responses) if self.llm_responses else 0
                }
            },
            "llm_responses": self.llm_responses
        }
        
        with open(self.json_file, 'w', encoding='utf-8') as f:
            json.dump(detailed_data, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"💾 詳細レスポンスデータを保存: {self.json_file}")
        
    def finalize(self):
        """ログ終了処理"""
        self.save_detailed_responses()
        self.logger.info("=" * 80)
        self.logger.info(f"✅ 詳細LLM評価ログ完了 - {self.timestamp}")
        self.logger.info(f"📋 ログファイル: {self.log_file}")
        self.logger.info(f"📊 詳細データ: {self.json_file}")
        self.logger.info("=" * 80)


class EnhancedSystemComplianceEvaluator(SystemComplianceEvaluator):
    """ログ出力機能付きのシステム適合性評価器"""
    
    def __init__(self, workspace_path: str = "/app", llm_provider: str = "openai", 
                 llm_model: str = "gpt-4-turbo", prompt_template_style: str = "default", 
                 detailed_logger: DetailedLLMLogger = None):
        super().__init__(workspace_path, llm_provider, llm_model, prompt_template_style)
        self.detailed_logger = detailed_logger
    
    async def _evaluate_single_log_async(self, log_entry, parsed_experiment):
        """単一ログの非同期評価（ログ出力付き）"""
        
        try:
            # 評価用データを抽出
            evaluation_data = self.log_parser.extract_evaluation_data(parsed_experiment)
            
            # プロンプトを生成
            prompt = self._generate_evaluation_prompt(evaluation_data)
            
            # キャッシュキーを生成
            cache_key = f"{parsed_experiment.experiment_id}_{len(parsed_experiment.turns)}"
            
            # LLM評価を実行
            llm_response = await self.llm_manager.evaluate_system_compliance(prompt, cache_key)
            
            # 詳細ログ出力
            if self.detailed_logger:
                self.detailed_logger.log_prompt_and_response(
                    log_path=str(log_entry.log_path),
                    experiment_id=parsed_experiment.experiment_id,
                    prompt=prompt,
                    response=llm_response.content,
                    usage=llm_response.usage,
                    success=llm_response.success,
                    error=llm_response.error_message
                )
            
            # 評価結果を解析
            parsed_evaluation = None
            if llm_response.success:
                parsed_evaluation = self.llm_manager.parse_evaluation_result(llm_response.content)
            
            # メトリクスを抽出
            parser_success_rate, workflow_compliance, system_health, critical_issues, recommendations = \
                self._extract_metrics_from_evaluation(parsed_evaluation)
            
            from src.evaluators.compliance_evaluator import LLMEvaluationResult
            return LLMEvaluationResult(
                log_path=str(log_entry.log_path),
                experiment_id=parsed_experiment.experiment_id,
                llm_response=llm_response,
                parsed_evaluation=parsed_evaluation,
                parser_success_rate=parser_success_rate,
                workflow_compliance=workflow_compliance,
                system_health=system_health,
                critical_issues=critical_issues,
                recommendations=recommendations
            )
            
        except Exception as e:
            if self.detailed_logger:
                self.detailed_logger.logger.error(f"❌ LLM評価エラー: {log_entry.log_path} - {e}")
            
            # エラーの場合はデフォルト値で結果を作成
            from src.evaluators.compliance_evaluator import LLMEvaluationResult, LLMResponse
            return LLMEvaluationResult(
                log_path=str(log_entry.log_path),
                experiment_id=parsed_experiment.experiment_id if parsed_experiment else "unknown",
                llm_response=LLMResponse("", {}, "", "", False, str(e)),
                parsed_evaluation=None,
                parser_success_rate=0.0,
                workflow_compliance=False,
                system_health="CRITICAL",
                critical_issues=[f"Evaluation error: {str(e)}"],
                recommendations=["Fix evaluation pipeline"]
            )


async def run_real_llm_evaluation(repository: str = "servantes", max_logs: int = 3, 
                                llm_provider: str = "openai", llm_model: str = "gpt-4-turbo"):
    """実LLMでの評価実行"""
    
    # 詳細ログ出力の初期化
    logger = DetailedLLMLogger()
    logger.log_evaluation_start(repository, max_logs, llm_provider, llm_model)
    
    try:
        # 拡張評価器の初期化
        evaluator = EnhancedSystemComplianceEvaluator(
            workspace_path="/app",
            llm_provider=llm_provider,
            llm_model=llm_model,
            prompt_template_style="default",
            detailed_logger=logger
        )
        
        # 評価実行
        result = await evaluator.evaluate_single_repository(repository, max_logs=max_logs)
        
        # 結果のログ出力
        logger.log_evaluation_summary(result)
        
        # 結果を保存
        timestamp = logger.timestamp
        output_dir = Path("/app/output/verification_results")
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"real_llm_analysis_{repository}_{timestamp}.json"
        
        output_data = {
            f"Real_{llm_provider.upper()}_Analysis": result
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        logger.logger.info(f"💾 評価結果を保存: {output_file}")
        
        return result, logger
        
    except Exception as e:
        logger.logger.error(f"❌ 評価実行エラー: {e}")
        raise
    finally:
        logger.finalize()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="実LLM評価実行ツール")
    parser.add_argument("--repo", "-r", default="servantes", help="評価対象リポジトリ名")
    parser.add_argument("--max-logs", "-n", type=int, default=3, help="最大処理ログ数")
    parser.add_argument("--provider", "-p", default="openai", choices=["openai", "anthropic", "mock"], help="LLMプロバイダー")
    parser.add_argument("--model", "-m", help="LLMモデル名 (例: gpt-4.1-mini, gpt-4.1, claude-3-sonnet-20240229)")
    
    args = parser.parse_args()
    
    # デフォルトモデル設定
    if not args.model:
        if args.provider == "openai":
            args.model = "gpt-4.1-mini"  # コスト効率の良いモデル
        elif args.provider == "anthropic":
            args.model = "claude-3-sonnet-20240229"
        elif args.provider == "mock":
            args.model = "mock-gpt"
    
    print(f"🎯 実LLM評価開始")
    print(f"📂 リポジトリ: {args.repo}")
    print(f"📊 最大ログ数: {args.max_logs}")
    print(f"🤖 プロバイダー: {args.provider}")
    print(f"🧠 モデル: {args.model}")
    print()
    
    try:
        result, logger = asyncio.run(run_real_llm_evaluation(
            repository=args.repo,
            max_logs=args.max_logs,
            llm_provider=args.provider,
            llm_model=args.model
        ))
        
        print("\n✅ 実LLM評価が完了しました！")
        print(f"📋 詳細ログ: {logger.log_file}")
        print(f"📊 詳細データ: {logger.json_file}")
        
    except KeyboardInterrupt:
        print("\n⏹️  ユーザーによって中断されました")
    except Exception as e:
        print(f"\n❌ 実行エラー: {e}")
        sys.exit(1)
