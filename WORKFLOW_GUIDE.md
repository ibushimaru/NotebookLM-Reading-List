# 開発ワークフローガイド

このガイドでは、Git Flowを使った開発の進め方を分かりやすく説明します。

## 🌳 ブランチの構造

```
main（本番環境）
 │
 ├── develop（開発版）
 │    │
 │    ├── feature/tag-management（タグ機能）
 │    ├── feature/analytics（統計機能）
 │    └── feature/ai-search（AI検索）
 │
 └── hotfix/urgent-fix（緊急修正）
```

### 各ブランチの役割

- **main**: お客様が実際に使うバージョン（安定版）
- **develop**: 次のバージョンの開発中のコード
- **feature/**: 新しい機能を開発するブランチ
- **hotfix/**: 緊急のバグ修正用

## 📝 実際の開発の流れ

### 1. 新機能を開発する時

例：タグ管理機能を追加する場合

```bash
# ① 最新のdevelopブランチに移動
git checkout develop
git pull origin develop

# ② 新機能用のブランチを作成
git checkout -b feature/tag-management

# ③ ここで開発作業を行います
# - ファイルを編集
# - 新しいファイルを作成
# - テストを実行

# ④ 変更を保存（コミット）
git add src/sidepanel/tags.js
git commit -m "feat: タグ追加機能を実装"

# ⑤ GitHubにアップロード
git push origin feature/tag-management
```

### 2. Pull Request（PR）を作成

GitHubで以下の手順：

1. 「Pull requests」タブをクリック
2. 「New pull request」ボタンをクリック
3. base: `develop` ← compare: `feature/tag-management` を選択
4. タイトルと説明を記入
5. 「Create pull request」をクリック

### 3. レビューとマージ

1. コードレビューを受ける
2. 修正が必要なら対応
3. 承認されたら「Merge pull request」

## 💡 コミットメッセージの書き方

### 基本形式
```
種類: 簡潔な説明

詳細な説明（必要に応じて）
```

### 種類の一覧
- `feat:` 新機能追加
- `fix:` バグ修正
- `docs:` ドキュメント更新
- `style:` コードの見た目を整理
- `refactor:` コードの改善
- `test:` テスト追加
- `chore:` その他の作業

### 例
```bash
git commit -m "feat: ノートブックにタグを追加する機能を実装

- タグの追加・削除が可能
- 最大5つまでタグを設定可能
- Chrome Storageに保存"
```

## 🔄 日々の作業フロー

### 朝の作業開始時
```bash
# 最新版を取得
git checkout develop
git pull origin develop
```

### 作業終了時
```bash
# 変更を確認
git status

# 変更を保存
git add .
git commit -m "feat: 今日の作業内容"
git push origin feature/現在の機能名
```

## ⚠️ 注意点

### やってはいけないこと
- ❌ mainブランチに直接コミット
- ❌ developブランチに直接大きな変更
- ❌ レビューなしでマージ

### やるべきこと
- ✅ 機能ごとにブランチを作る
- ✅ こまめにコミット
- ✅ 分かりやすいコミットメッセージ
- ✅ PRでレビューを受ける

## 🆘 困った時は

### コンフリクト（競合）が発生した場合
```bash
# 最新のdevelopを取り込む
git checkout develop
git pull origin develop
git checkout feature/your-branch
git merge develop

# コンフリクトを解決後
git add .
git commit -m "fix: コンフリクトを解決"
```

### 間違えてコミットした場合
```bash
# 直前のコミットを取り消し（ファイルは残る）
git reset --soft HEAD~1

# 修正してから再度コミット
git add .
git commit -m "正しいメッセージ"
```

## 📊 進捗の確認方法

### 現在の状態を確認
```bash
git status          # 変更されたファイル
git log --oneline   # コミット履歴
git branch          # ブランチ一覧
```

### GitHubで確認
- Pull Requests: レビュー待ちの機能
- Issues: 課題や要望
- Projects: 全体の進捗

## 🔍 タグ管理機能の設計と実装

### データ構造
```javascript
// Chrome Storage format
{
  "tags": {
    "notebook-id-1": ["勉強", "AI", "重要"],
    "notebook-id-2": ["仕事", "プレゼン"]
  },
  "tagColors": {
    "勉強": "#FF6B6B",
    "AI": "#4ECDC4"
  }
}
```

### 主要なクラスと責務

1. **TagStorage**: タグデータの永続化管理
   - タグの保存・読み込み
   - カラー管理
   - キャッシュ制御

2. **TagManager**: タグのUI管理
   - タグ追加・削除UI
   - フィルタリングUI
   - イベントハンドリング

### 検討したポイント

1. **パフォーマンス**
   - Chrome Storageの使用頻度を最小限に
   - メモリ使用量の最適化
   - レンダリングの効率化

2. **UX**
   - 直感的なタグ操作
   - リアルタイムフィルタリング
   - ビジュアルフィードバック

3. **エラーハンドリング**
   - ストレージエラーの処理
   - バリデーション
   - ユーザーフィードバック

## 🎯 まとめ

1. **開発は feature ブランチで**
2. **こまめにコミット**
3. **PRでレビューを受ける**
4. **developにマージ**
5. **定期的にmainへリリース**

この流れを守ることで、安全で効率的な開発ができます！