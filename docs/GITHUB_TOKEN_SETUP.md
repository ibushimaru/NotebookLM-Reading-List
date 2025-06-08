# GitHub トークンのセキュアな管理

## 概要

このドキュメントでは、GitHub Personal Access Token (PAT) を安全に管理する方法を説明します。

## セキュリティの重要性

GitHubトークンは以下の理由から適切に管理する必要があります：

- リポジトリへのアクセス権限を持つ
- 不正使用された場合、データの漏洩や改ざんの可能性
- GitHubの利用規約違反につながる可能性

## セットアップ手順

### 1. GitHubトークンの作成

1. [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens) にアクセス
2. 「Generate new token」をクリック
3. 以下の設定を行う：
   - **Note**: `NotebookLM-Reading-List Development`
   - **Expiration**: 90日（定期的な更新を推奨）
   - **Scopes**: 
     - ✅ `repo` (Full control of private repositories)
     - ✅ `read:org` (Read org and team membership)

4. 「Generate token」をクリック
5. 生成されたトークンをコピー（この画面を離れると二度と表示されません）

### 2. ローカル環境での設定

```bash
# 1. .envファイルを作成
cp .env.example .env

# 2. .envファイルを編集してトークンを設定
# GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 3. セットアップスクリプトを実行
./scripts/setup-github.sh
```

### 3. 環境変数の使用方法

#### Bashスクリプトでの使用
```bash
# .envファイルから環境変数を読み込み
source .env
# または
export $(grep -v '^#' .env | xargs)

# GitHub CLIで使用
export GH_TOKEN=$GITHUB_TOKEN
gh pr create --title "タイトル" --body "説明"
```

#### Node.jsでの使用（将来的な実装用）
```javascript
require('dotenv').config();
const token = process.env.GITHUB_TOKEN;
```

## セキュリティのベストプラクティス

### ✅ やるべきこと

1. **トークンの最小権限の原則**
   - 必要最小限のスコープのみを付与
   - 開発用と本番用でトークンを分離

2. **定期的な更新**
   - 90日ごとにトークンを更新
   - 古いトークンは必ず削除

3. **環境変数の使用**
   - ハードコーディングは絶対に避ける
   - .envファイルを使用

4. **アクセスログの監視**
   - [GitHub Security log](https://github.com/settings/security-log) で定期的に確認
   - 不審なアクセスがないかチェック

### ❌ やってはいけないこと

1. **コードへのハードコーディング**
   ```javascript
   // ❌ 絶対にやってはいけない
   const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
   ```

2. **Gitへのコミット**
   - .envファイルは必ず.gitignoreに追加
   - 誤ってコミットした場合は即座にトークンを無効化

3. **公開リポジトリでの使用**
   - パブリックリポジトリでトークンを使用しない
   - GitHub Actionsを使う場合はSecretsを使用

4. **トークンの共有**
   - チームメンバーとトークンを共有しない
   - 各自が個別のトークンを作成

## トラブルシューティング

### トークンが無効と表示される

```bash
# トークンの確認
echo $GITHUB_TOKEN

# 再認証
./scripts/setup-github.sh
```

### 権限エラーが発生する

1. トークンのスコープを確認
2. 必要に応じて新しいトークンを作成

### 誤ってトークンを公開してしまった場合

1. **即座にトークンを無効化**
   - [GitHub Settings > Personal access tokens](https://github.com/settings/tokens)
   - 該当トークンの「Delete」をクリック

2. **新しいトークンを作成**

3. **セキュリティログを確認**
   - 不正使用の痕跡がないか確認

## GitHub CLIの代替手段

### 1. SSHキー認証

```bash
# SSHキーの生成
ssh-keygen -t ed25519 -C "your_email@example.com"

# GitHubに公開鍵を登録
cat ~/.ssh/id_ed25519.pub
# → GitHubの Settings > SSH and GPG keys に追加
```

### 2. GitHub Actionsでの使用

```yaml
# .github/workflows/example.yml
steps:
  - uses: actions/checkout@v3
    with:
      token: ${{ secrets.GITHUB_TOKEN }}
```

## 参考リンク

- [GitHub: Creating a personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub CLI: Authentication](https://cli.github.com/manual/gh_auth_login)
- [Best practices for managing credentials](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-secrets)