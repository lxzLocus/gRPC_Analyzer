#!/bin/bash

# APR評価システム管理スクリプト

set -e

DOCKER_DIR="/app/.docker"
COMPOSE_FILE="$DOCKER_DIR/docker-compose.yml"

# 色付きログ
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ヘルプ表示
show_help() {
    cat << EOF
APR評価システム管理スクリプト

使用方法:
  $0 [コマンド] [オプション]

コマンド:
  build           コンテナイメージをビルド
  up              サービスを起動
  down            サービスを停止
  logs            ログを表示
  shell           コンテナにシェル接続
  
  # APR実行コマンド
  run-apr         grpc-analyzer-nodeでバッチ処理実行
  run-apr-test    grpc-analyzer-nodeでテストデータ処理
  
  # 評価実行コマンド  
  eval-step1      ステップ1: システム仕様準拠性評価
  eval-step2      ステップ2: パッチ品質評価
  eval-all        全評価ステップ実行
  eval-dry-run    評価環境チェック（ドライラン）
  
  # ユーティリティ
  status          サービス状態確認
  clean           停止・クリーンアップ
  reset           全データリセット（注意）

例:
  $0 build                    # 全サービスビルド
  $0 run-apr                  # grpc-analyzer-nodeでAPRバッチ処理実行
  $0 eval-all                 # 評価システムで全評価実行
  $0 shell dev                # 開発環境にシェル接続
  $0 shell grpc-analyzer-node # 本番環境にシェル接続
  $0 shell evaluation-system  # 評価システムにシェル接続

EOF
}

# Docker Compose実行
run_compose() {
    cd "$DOCKER_DIR"
    docker-compose "$@"
}

# メイン処理
case "${1:-help}" in
    "build")
        log_info "コンテナイメージをビルド中..."
        run_compose build
        log_success "ビルド完了"
        ;;
        
    "up")
        log_info "サービスを起動中..."
        run_compose up -d
        log_success "サービス起動完了"
        ;;
        
    "down")
        log_info "サービスを停止中..."
        run_compose down
        log_success "サービス停止完了"
        ;;
        
    "logs")
        SERVICE=${2:-}
        if [ -n "$SERVICE" ]; then
            run_compose logs -f "$SERVICE"
        else
            run_compose logs -f
        fi
        ;;
        
    "shell")
        SERVICE=${2:-dev}
        log_info "コンテナ $SERVICE にシェル接続..."
        run_compose exec "$SERVICE" /bin/bash
        ;;
        
    "run-apr")
        log_info "grpc-analyzer-nodeでバッチ処理を実行..."
        run_compose exec grpc-analyzer-node npm run batch:large
        log_success "APRバッチ処理完了"
        ;;
        
    "run-apr-test")
        log_info "grpc-analyzer-nodeでテストデータ処理を実行..."
        run_compose exec grpc-analyzer-node npm run batch:test
        log_success "APRテスト処理完了"
        ;;
        
    "eval-step1")
        log_info "ステップ1: システム仕様準拠性評価を実行..."
        run_compose exec evaluation-system python main.py --step 1
        log_success "ステップ1評価完了"
        ;;
        
    "eval-step2")
        log_info "ステップ2: パッチ品質評価を実行..."
        run_compose exec evaluation-system python main.py --step 2
        log_success "ステップ2評価完了"
        ;;
        
    "eval-all")
        log_info "全評価ステップを実行..."
        run_compose exec evaluation-system python main.py --step all
        log_success "全評価完了"
        ;;
        
    "eval-dry-run")
        log_info "評価環境をチェック中（ドライラン）..."
        run_compose exec evaluation-system python main.py --dry-run
        ;;
        
    "status")
        log_info "サービス状態:"
        run_compose ps
        ;;
        
    "clean")
        log_warning "サービスを停止してクリーンアップ中..."
        run_compose down --volumes --remove-orphans
        log_success "クリーンアップ完了"
        ;;
        
    "reset")
        log_error "⚠️  全データリセットを実行します（10秒でキャンセル可能）"
        sleep 10
        log_warning "評価結果ディレクトリをクリア中..."
        rm -rf F:/Workspace/gRPC_Analyzer/evaluation/results/*
        log_warning "評価ログディレクトリをクリア中..."
        rm -rf F:/Workspace/gRPC_Analyzer/evaluation/logs/*
        log_warning "APRログディレクトリをクリア中..."
        rm -rf F:/Workspace/gRPC_Analyzer/log/*
        log_warning "APR出力ディレクトリをクリア中..."
        rm -rf F:/Workspace/gRPC_Analyzer/output/*
        log_success "データリセット完了"
        ;;
        
    "help"|*)
        show_help
        ;;
esac
