#!/usr/bin/env bash
# PR作成と次のタスク開始を自動化するスクリプト

set -euo pipefail

# 色の定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🚀 PR作成と次タスク開始スクリプト"

# 現在のブランチ名を取得
CURRENT_BRANCH=$(git branch --show-current)
echo "現在のブランチ: $CURRENT_BRANCH"

# 変更があるか確認
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ 未コミットの変更はありません"
else
    echo -e "${RED}⚠️  未コミットの変更があります${NC}"
    echo "先にコミットしてください:"
    echo "  git add ."
    echo "  git commit -m \"your commit message\""
    exit 1
fi

# developブランチでないことを確認
if [ "$CURRENT_BRANCH" = "develop" ] || [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
    echo -e "${RED}エラー: メインブランチからPRを作成することはできません${NC}"
    exit 1
fi

# PRを作成
echo -e "\n${YELLOW}📝 PRを作成中...${NC}"
PR_URL=$(gh pr create --base develop --fill --body "🤖 Generated with Claude Code" 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PR作成成功！${NC}"
    echo "PR URL: $PR_URL"
else
    echo -e "${RED}❌ PR作成に失敗しました${NC}"
    exit 1
fi

# 次のタスク名を入力
echo -e "\n${YELLOW}次のタスクを開始します${NC}"

# タスク名の入力検証
while true; do
    read -r -p "次のタスク名を入力してください (例: user-authentication): " NEXT_TASK
    
    # 空でないか確認
    if [ -z "$NEXT_TASK" ]; then
        echo -e "${RED}タスク名は空にできません${NC}"
        continue
    fi
    
    # 特殊文字のチェック
    if [[ "$NEXT_TASK" =~ [^a-zA-Z0-9-_] ]]; then
        echo -e "${RED}タスク名には英数字、ハイフン、アンダースコアのみ使用できます${NC}"
        continue
    fi
    
    break
done

# developに戻って新しいブランチを作成
echo -e "\n${YELLOW}新しいブランチを作成中...${NC}"
git checkout develop
git pull origin develop

# ブランチ名をサニタイズ
BRANCH_NAME="feature/${NEXT_TASK}"
git checkout -b "$BRANCH_NAME"

echo -e "\n${GREEN}✅ 完了！${NC}"
echo "PR作成: $PR_URL"
echo "新しいブランチ: $BRANCH_NAME"
echo ""
echo "次のステップ:"
echo "1. 新しいタスクの実装を開始"
echo "2. レビューが来たら './scripts/check-reviews.sh' で確認"
echo "3. 必要に応じて元のブランチに戻って修正"

# TodoWriteの更新を促す
echo -e "\n${YELLOW}💡 TodoWriteの更新をお忘れなく！${NC}"