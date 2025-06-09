#!/bin/bash

# PR作成と次タスク開始の自動化スクリプト
# CodeRabbitレビュー待ち時間を最小化するための効率的なワークフロー

set -e

echo "🚀 PR作成と次タスク開始スクリプト"
echo "=================================="

# 現在のブランチ名を取得
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 現在のブランチ: $CURRENT_BRANCH"

# 変更があるか確認
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ コミット済みの変更があります"
else
    echo "⚠️  未コミットの変更があります"
    echo "変更をコミットしてから再度実行してください"
    exit 1
fi

# PRタイトルを入力
echo ""
read -p "📝 PRタイトルを入力してください: " PR_TITLE

# PR説明を入力
echo ""
echo "📋 PR説明を入力してください (Ctrl+Dで終了):"
PR_BODY=$(cat)

# PRを作成
echo ""
echo "🔄 PRを作成中..."
PR_URL=$(gh pr create \
    --base develop \
    --title "$PR_TITLE" \
    --body "$PR_BODY" \
    2>&1 | grep -o 'https://github.com/[^[:space:]]*')

if [ -n "$PR_URL" ]; then
    echo "✅ PR作成完了: $PR_URL"
else
    echo "❌ PR作成に失敗しました"
    exit 1
fi

# 次のタスクについて確認
echo ""
echo "🤔 次のタスクを開始しますか？"
echo "1) はい - 新しいfeatureブランチを作成"
echo "2) いいえ - 現在のブランチに留まる"
read -p "選択してください (1/2): " CHOICE

if [ "$CHOICE" = "1" ]; then
    # 次のタスク名を入力
    echo ""
    read -p "📌 次のタスク名を入力してください (feature/の後の部分): " NEXT_TASK
    
    # developに戻って最新を取得
    echo "🔄 developブランチを更新中..."
    git checkout develop
    git pull origin develop
    
    # 新しいブランチを作成
    NEW_BRANCH="feature/$NEXT_TASK"
    git checkout -b "$NEW_BRANCH"
    
    echo ""
    echo "✨ 成功！"
    echo "📍 新しいブランチ '$NEW_BRANCH' で作業を開始できます"
    echo "🔗 作成したPR: $PR_URL"
    
    # TodoWriteへの追加を提案
    echo ""
    echo "💡 ヒント: TodoWriteツールで新しいタスクを追加することをお勧めします"
else
    echo ""
    echo "✅ PR作成完了"
    echo "📍 現在のブランチ '$CURRENT_BRANCH' に留まります"
    echo "🔗 作成したPR: $PR_URL"
fi

echo ""
echo "📊 現在のPR一覧:"
gh pr list --state open --limit 5