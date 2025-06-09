#!/bin/bash

# CodeRabbitレビューチェックスクリプト
# レビュー済みのPRを確認し、必要な修正を効率的に行うためのツール

set -e

echo "🔍 CodeRabbitレビューチェッカー"
echo "================================"

# オープンなPRを取得
echo "📋 オープンなPRを確認中..."
OPEN_PRS=$(gh pr list --state open --json number,title,url,headRefName)

if [ -z "$OPEN_PRS" ] || [ "$OPEN_PRS" = "[]" ]; then
    echo "✅ 現在オープンなPRはありません"
    exit 0
fi

# PRの数を表示
PR_COUNT=$(echo "$OPEN_PRS" | jq '. | length')
echo "📊 オープンなPR: $PR_COUNT 件"
echo ""

# 各PRのレビュー状態を確認
echo "🤖 CodeRabbitレビュー状態を確認中..."
echo ""

for row in $(echo "$OPEN_PRS" | jq -r '.[] | @base64'); do
    _jq() {
        echo ${row} | base64 -d | jq -r ${1}
    }
    
    PR_NUMBER=$(_jq '.number')
    PR_TITLE=$(_jq '.title')
    PR_URL=$(_jq '.url')
    PR_BRANCH=$(_jq '.headRefName')
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "PR #$PR_NUMBER: $PR_TITLE"
    echo "🔗 $PR_URL"
    echo "🌿 ブランチ: $PR_BRANCH"
    echo ""
    
    # PRのコメントを取得してCodeRabbitのレビューを探す
    COMMENTS=$(gh pr view $PR_NUMBER --json comments --jq '.comments')
    CODERABBIT_COMMENTS=$(echo "$COMMENTS" | jq -r '.[] | select(.author.login == "coderabbitai") | .body' 2>/dev/null || echo "")
    
    if [ -n "$CODERABBIT_COMMENTS" ]; then
        echo "✅ CodeRabbitレビュー済み"
        
        # レビューサマリーを抽出（最初の数行のみ）
        SUMMARY=$(echo "$CODERABBIT_COMMENTS" | head -n 10)
        echo ""
        echo "📝 レビューサマリー:"
        echo "$SUMMARY" | sed 's/^/   /'
        echo ""
        
        # 修正が必要かチェック
        if echo "$CODERABBIT_COMMENTS" | grep -q -i "warning\|error\|security\|vulnerability"; then
            echo "⚠️  重要な指摘事項があります！"
            echo ""
            read -p "このPRに切り替えて修正しますか？ (y/n): " SWITCH_CHOICE
            if [ "$SWITCH_CHOICE" = "y" ]; then
                git checkout "$PR_BRANCH"
                echo "✅ ブランチ '$PR_BRANCH' に切り替えました"
                echo "💡 ヒント: $PR_URL でレビューの詳細を確認してください"
                break
            fi
        else
            echo "✨ 重大な問題は検出されていません"
        fi
    else
        echo "⏳ CodeRabbitレビュー待ち"
        echo "💡 ヒント: レビューを手動でトリガーするには、PRページで '@coderabbitai review' とコメントしてください"
    fi
    
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 サマリー:"
echo "- オープンなPR: $PR_COUNT 件"

# レビュー済みの数を計算
REVIEWED_COUNT=0
for row in $(echo "$OPEN_PRS" | jq -r '.[] | @base64'); do
    _jq() {
        echo ${row} | base64 -d | jq -r ${1}
    }
    PR_NUMBER=$(_jq '.number')
    COMMENTS=$(gh pr view $PR_NUMBER --json comments --jq '.comments' 2>/dev/null || echo "[]")
    if echo "$COMMENTS" | jq -e '.[] | select(.author.login == "coderabbitai")' >/dev/null 2>&1; then
        ((REVIEWED_COUNT++))
    fi
done

echo "- レビュー済み: $REVIEWED_COUNT 件"
echo "- レビュー待ち: $((PR_COUNT - REVIEWED_COUNT)) 件"

# 次のアクション提案
echo ""
echo "💡 次のアクション:"
if [ $REVIEWED_COUNT -gt 0 ]; then
    echo "- レビュー済みのPRの修正対応を行う"
fi
if [ $((PR_COUNT - REVIEWED_COUNT)) -gt 0 ]; then
    echo "- レビュー待ちの間に次のタスクを進める"
    echo "- 必要に応じて '@coderabbitai review' でレビューをトリガー"
fi