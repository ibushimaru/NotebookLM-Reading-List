# オフスクリーンAPI実装のGitブランチ戦略

## ブランチ構成

```
main
  └── develop
        ├── feature/offscreen-base          # オフスクリーンAPIの基本実装
        ├── feature/offscreen-iframe        # iframe統合
        ├── feature/offscreen-audio         # 音声再生の移行
        └── feature/offscreen-migration     # 既存機能からの完全移行
```

## ブランチ作成手順

### 1. 現在の作業をコミット
```bash
# 現在の変更をコミット
git add .
git commit -m "fix: タブフォーカス管理の改善"

# 現在のブランチをpush
git push origin pr-2
```

### 2. メインブランチの更新
```bash
# developブランチに切り替え
git checkout develop

# 最新の変更を取得
git pull origin develop
```

### 3. フィーチャーブランチの作成
```bash
# オフスクリーンAPIの基本実装ブランチ
git checkout -b feature/offscreen-base

# 作業開始
```

## コミット戦略

### コミットメッセージの規則
```
feat: オフスクリーンドキュメントの基本構造を実装
fix: オフスクリーンでのメッセージング問題を修正
refactor: 既存のタブ管理ロジックをオフスクリーンに移行
docs: オフスクリーンAPI実装ガイドを追加
test: オフスクリーン機能のテストを追加
```

### 小さなコミット単位
```bash
# ✅ 良い例：機能ごとに分割
git add src/offscreen/offscreen.html
git commit -m "feat: オフスクリーンドキュメントのHTML構造を追加"

git add src/offscreen/offscreen-controller.js
git commit -m "feat: NotebookLMコントローラークラスを実装"

# ❌ 悪い例：すべてを一度にコミット
git add .
git commit -m "feat: オフスクリーン機能を追加"
```

## マージ戦略

### 1. 段階的マージ
```
feature/offscreen-base → develop
  ↓ (テスト完了後)
feature/offscreen-iframe → develop
  ↓ (テスト完了後)
feature/offscreen-audio → develop
  ↓ (すべて動作確認後)
feature/offscreen-migration → develop
```

### 2. フィーチャーフラグの使用
```javascript
// config.js
const FEATURES = {
  USE_OFFSCREEN_API: false,  // 本番環境では最初はfalse
  OFFSCREEN_IFRAME: false,
  OFFSCREEN_AUDIO: false
};

// 使用例
if (FEATURES.USE_OFFSCREEN_API) {
  await handleWithOffscreen();
} else {
  await handleWithTabs();  // 既存の実装
}
```

## Pull Request戦略

### 1. 小さなPRを作成
- 各フィーチャーブランチごとにPR作成
- 200行以下を目安に
- レビューしやすいサイズを維持

### 2. PRテンプレート
```markdown
## 概要
オフスクリーンAPIの基本構造を実装

## 変更内容
- [ ] オフスクリーンドキュメントの作成
- [ ] メッセージングの実装
- [ ] エラーハンドリング

## テスト
- [ ] 単体テスト追加
- [ ] 手動テスト完了
- [ ] 既存機能への影響なし

## スクリーンショット
（該当する場合）
```

## ロールバック戦略

### 1. フィーチャーフラグで即座に無効化
```javascript
// 問題が発生した場合
FEATURES.USE_OFFSCREEN_API = false;
```

### 2. Git revertの使用
```bash
# 問題のあるコミットを特定
git log --oneline

# revertで取り消し
git revert <commit-hash>
```

## 並行開発のベストプラクティス

### 1. 既存機能を壊さない
- 新旧両方の実装を並存させる
- フィーチャーフラグで切り替え
- 段階的に移行

### 2. テストの追加
```javascript
// tests/offscreen.test.js
describe('Offscreen API', () => {
  it('should create offscreen document', async () => {
    // テスト実装
  });
  
  it('should handle iframe loading', async () => {
    // テスト実装
  });
});
```

### 3. ドキュメントの更新
- 各PRでドキュメントも更新
- 実装の進捗を記録
- 問題と解決策を文書化

## チェックリスト

### ブランチ作成前
- [ ] 現在の作業をコミット
- [ ] developブランチを最新に更新
- [ ] 明確な目的のブランチ名

### 実装中
- [ ] 小さなコミット単位
- [ ] 意味のあるコミットメッセージ
- [ ] 定期的なpush

### PR作成前
- [ ] コードレビュー（セルフ）
- [ ] テスト追加
- [ ] ドキュメント更新
- [ ] 不要なコードの削除

### マージ前
- [ ] すべてのテストがパス
- [ ] レビューコメントへの対応
- [ ] コンフリクトの解決