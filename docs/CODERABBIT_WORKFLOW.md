# CodeRabbit ワークフロー クイックリファレンス

## 🚀 基本コマンド

### PR作成して次のタスクへ
```bash
./scripts/create-pr-and-continue.sh
```

### レビュー状態をチェック
```bash
./scripts/check-reviews.sh
```

### 手動でレビューをトリガー
PRページで以下をコメント:
```
@coderabbitai review
```

## 📊 日次ワークフロー

### 朝のルーティン
1. レビューチェック: `./scripts/check-reviews.sh`
2. 修正が必要なPRに対応
3. 新しいタスクを開始

### 夕方のルーティン
1. 作業をコミット
2. PRを作成: `./scripts/create-pr-and-continue.sh`
3. 次の日のタスクを準備

## 🎯 ベストプラクティス

### PR作成時
- **タイトル**: `feat:`, `fix:`, `docs:` などのプレフィックスを使用
- **サイズ**: 200行以下を目安に
- **説明**: 変更の理由と影響を明確に

### ブランチ名
- `feature/機能名`: 新機能
- `fix/バグ名`: バグ修正
- `docs/ドキュメント名`: ドキュメント更新

## 🔧 Git エイリアス

~/.gitconfig に追加:
```bash
[alias]
    # PR作成
    pr = "!gh pr create --base develop --fill"
    
    # PR一覧
    prs = "!gh pr list --state open"
    
    # レビュー済みPR確認
    pr-reviewed = "!gh pr list --state open --json number,title,reviews --jq '.[] | select(.reviews | length > 0)'"
```

## 📝 TodoWrite 連携

新しいタスクを始める前に:
```
TodoWrite:
- [ ] 機能の実装
- [ ] テストの作成
- [ ] ドキュメントの更新
```

## 🚨 トラブルシューティング

### CodeRabbitがレビューしない
1. `.coderabbit.yaml` の設定を確認
2. ベースブランチが `develop` または `main` か確認
3. 手動トリガー: `@coderabbitai review`

### マージコンフリクト
```bash
git fetch origin develop
git rebase origin/develop
# コンフリクト解消
git add .
git rebase --continue
git push --force-with-lease
```

## 📈 効率化のコツ

1. **並行作業**: PR作成後すぐに次のタスクへ
2. **小さなPR**: レビューが早く、コンフリクトが少ない
3. **早めの修正**: CodeRabbitの指摘は即座に対応
4. **定期チェック**: 1日2-3回レビュー状態を確認

---

詳細は [claude.md](../claude.md) の「CodeRabbit開発ワークフロー最適化ガイド」を参照