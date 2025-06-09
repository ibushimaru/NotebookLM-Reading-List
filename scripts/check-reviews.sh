#!/usr/bin/env bash
# レビュー済みのPRをチェックして表示するスクリプト

set -euo pipefail

# 色の定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔍 レビュー済みのPRをチェック中..."

# オープンなPRを取得
OPEN_PRS=$(gh pr list --state open --json number,title,author,reviews,isDraft,baseRefName)

if [ -z "$OPEN_PRS" ] || [ "$OPEN_PRS" = "[]" ]; then
    echo "オープンなPRはありません。"
    exit 0
fi

# レビュー済みのPRをフィルタリング
REVIEWED_PRS=$(echo "$OPEN_PRS" | jq '[.[] | select(.reviews | length > 0)]')

if [ "$REVIEWED_PRS" = "[]" ]; then
    echo "レビュー待ちのPRはありません。"
    
    # オープンなPRの一覧を表示
    echo -e "\n${YELLOW}📋 オープンなPR一覧:${NC}"
    echo "$OPEN_PRS" | jq -r '.[] | "PR #\(.number): \(.title) (@\(.author.login))"'
    exit 0
fi

echo -e "\n${GREEN}✅ レビュー済みのPR:${NC}"

# 各PRの詳細を表示する関数
show_pr_details() {
    local pr_number="$1"
    
    echo -e "\n${YELLOW}PR #${pr_number}${NC}"
    gh pr view "$pr_number" --json title,author,reviews,state | jq -r '
        "タイトル: \(.title)",
        "作成者: @\(.author.login)",
        "レビュー数: \(.reviews | length)"
    '
    
    # レビューコメントを表示
    echo -e "\n${GREEN}レビューコメント:${NC}"
    gh pr view "$pr_number" --json reviews | jq -r '.reviews[] | 
        "[\(.state)] @\(.author.login): \(.body // "No comment")"' | head -20
    
    # CodeRabbitのコメントを取得
    echo -e "\n${YELLOW}CodeRabbitのコメント:${NC}"
    gh pr view "$pr_number" --comments | grep -A 5 "coderabbitai" || echo "CodeRabbitのコメントはありません"
}

# レビュー済みPRの数をカウント
REVIEWED_COUNT=$(echo "$REVIEWED_PRS" | jq 'length')
echo "レビュー済みのPR数: $REVIEWED_COUNT"

# 各PRの詳細を表示
echo "$REVIEWED_PRS" | jq -r '.[].number' | while read -r PR_NUMBER; do
    show_pr_details "$PR_NUMBER"
    echo -e "\n---"
done

# サマリー
echo -e "\n${GREEN}📊 サマリー:${NC}"
echo "オープンなPR総数: $(echo "$OPEN_PRS" | jq 'length')"
echo "レビュー済み: $REVIEWED_COUNT"
echo "レビュー待ち: $(($(echo "$OPEN_PRS" | jq 'length') - REVIEWED_COUNT))"

# アクション提案
if [ "$REVIEWED_COUNT" -gt 0 ]; then
    echo -e "\n${YELLOW}💡 次のアクション:${NC}"
    echo "1. レビューコメントを確認して対応"
    echo "2. 修正が必要な場合は該当ブランチにチェックアウト"
    echo "3. 修正後、コミット&プッシュ"
    echo ""
    echo "例:"
    PR_NUMS=$(echo "$REVIEWED_PRS" | jq -r '.[].number' | head -1)
    echo "  git checkout feature/branch-name"
    echo "  # 修正を実施"
    echo "  git add ."
    echo "  git commit -m \"fix: レビュー指摘事項を修正\""
    echo "  git push"
fi