#!/bin/bash

# GitHub CLI セットアップスクリプト
# このスクリプトはGitHubトークンを安全に設定します

set -e

echo "GitHub CLI セットアップを開始します..."

# 環境変数ファイルの存在確認
if [ ! -f ".env" ]; then
    echo "❌ .envファイルが見つかりません"
    echo "📝 .env.exampleを.envにコピーしてください:"
    echo "   cp .env.example .env"
    echo "   その後、.envファイルにGitHubトークンを設定してください"
    exit 1
fi

# .envファイルから環境変数を読み込み
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# トークンの存在確認
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKENが設定されていません"
    echo "📝 .envファイルにGITHUB_TOKENを設定してください"
    exit 1
fi

# GitHub CLIの認証
echo "🔐 GitHub CLIの認証を設定中..."
echo "$GITHUB_TOKEN" | gh auth login --with-token

# 認証の確認
if gh auth status &>/dev/null; then
    echo "✅ GitHub CLI認証が完了しました"
    gh auth status
else
    echo "❌ GitHub CLI認証に失敗しました"
    exit 1
fi

echo ""
echo "🎉 セットアップが完了しました！"
echo ""
echo "📌 注意事項:"
echo "- .envファイルは絶対にGitにコミットしないでください"
echo "- トークンは定期的に更新することを推奨します"
echo "- 不要になったトークンは必ず削除してください"