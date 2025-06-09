# CodeRabbit開発ワークフロー最適化ガイド

## 概要

CodeRabbitを活用した効率的な開発フローのためのワークフローガイドです。PRレビューを待つ時間を最小化し、継続的な開発を実現します。

## クイックリファレンス

### 基本コマンド

```bash
# PR作成と次タスク開始
./scripts/create-pr-and-continue.sh

# レビュー状況確認
./scripts/check-reviews.sh

# PR作成 (手動)
gh pr create --base develop --title "feat: 機能説明"
```

### ブランチ戦略

```bash
main (or master)
  └── develop
       ├── feature/task-1  # 現在作業中
       ├── feature/task-2  # レビュー待ち
       └── feature/task-3  # 計画中
```

### CodeRabbit設定 (.coderabbit.yaml)

```yaml
reviews:
  auto_review:
    enabled: true
    base_branches:
      - "main"
      - "develop"
```

## 開発フロー

### 1. タスク開始

```bash
# 新しいfeatureブランチを作成
git checkout develop
git pull origin develop
git checkout -b feature/new-feature
```

### 2. 実装とコミット

```bash
# 変更を実装
# ...

# コミット (Conventional Commitsに従う)
git add .
git commit -m "feat: 新機能の説明"
```

### 3. PR作成と次タスク開始

```bash
# 自動化スクリプトを使用
./scripts/create-pr-and-continue.sh
```

または手動で：

```bash
# PR作成
gh pr create --base develop --fill

# 次のタスクを開始
git checkout develop
git checkout -b feature/next-task
```

### 4. レビュー対応

```bash
# レビューをチェック
./scripts/check-reviews.sh

# 修正が必要な場合
git checkout feature/reviewed-branch
# 修正を実装
git add .
git commit -m "fix: レビュー指摘事項を修正"
git push
```

### 5. マージ

```bash
# 承認されたPRをマージ
gh pr merge --squash --delete-branch
```

## ベストプラクティス

### TodoWriteの活用

```text
TodoWrite:
- [ ] データモデルの設計
- [ ] APIエンドポイントの実装
- [ ] UIコンポーネントの作成
- [ ] テストの追加
```

### PR作成のガイドライン

1. **小さく保つ**: 200行以下を目安に
2. **明確な説明**: 何を・なぜ・どのように
3. **スクリーンショット**: UI変更がある場合は必須

### レビュー対応

1. **迅速な対応**: 24時間以内を目標
2. **建設的な議論**: 技術的な理由を明確に
3. **CI/CDの確認**: すべてのチェックがパスすることを確認

## トラブルシューティング

### CodeRabbitがレビューしない

```bash
# ベースブランチを確認
gh pr view --json baseRefName

# 手動でトリガー (PRページで)
@coderabbitai review
```

### マージコンフリクト

```bash
# 最新のdevelopを取得
git fetch origin develop
git rebase origin/develop

# コンフリクト解消後
git add .
git rebase --continue
git push --force-with-lease
```

## 自動化スクリプト

### create-pr-and-continue.sh

このスクリプトは以下を自動化します：
1. 現在のブランチでPRを作成
2. developブランチに戻る
3. 新しいfeatureブランチを作成

### check-reviews.sh

このスクリプトは以下を表示します：
1. レビュー済みのPR一覧
2. 各PRのレビューコメント
3. 対応が必要な項目

## 効率化のTips

1. **並行作業**: PRレビュー待ちの間に次のタスクを進める
2. **定期的な確認**: 1日2回（朝・夕）レビューをチェック
3. **ドキュメント**: 実装と並行してドキュメントを更新

---

詳細な情報は[claude.md](../claude.md)のCodeRabbitセクションを参照してください。