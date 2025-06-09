# i18n（多言語対応）のテスト方法

## 方法1: Chromeの言語設定を変更（推奨）

1. Chromeの設定を開く
   - `chrome://settings/` にアクセス
   - または、メニュー → 設定

2. 詳細設定 → 言語
   - 「言語」セクションを開く
   - 「言語を追加」をクリック
   - 「英語（米国）」を追加

3. 英語を優先言語に設定
   - 追加した英語の右側の3点メニューをクリック
   - 「Chromeをこの言語で表示」にチェック
   - 「一番上に移動」をクリック

4. Chromeを再起動
   - 「再起動」ボタンをクリック
   - または、Chromeを完全に終了して再度開く

## 方法2: 新しいChromeプロファイルを作成

1. Chromeプロファイルを追加
   - 右上のプロファイルアイコンをクリック
   - 「追加」をクリック
   - 新しいプロファイルを作成

2. 新しいプロファイルで言語を英語に設定
   - 上記の方法1の手順を実行
   - このプロファイルは英語テスト専用として使用

## 方法3: Chrome起動オプションを使用（一時的）

Windowsの場合：
```cmd
chrome.exe --lang=en-US
```

macOSの場合：
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --lang=en-US
```

Linuxの場合：
```bash
google-chrome --lang=en-US
```

## 方法4: 拡張機能の再読み込み

言語設定を変更した後：
1. `chrome://extensions/` を開く
2. NotebookLM Reading Listの「更新」ボタンをクリック
3. サイドパネルを開き直す

## テスト項目

### 日本語表示の確認
- [ ] ヘッダータイトル: "NotebookLM Reading List"
- [ ] 検索プレースホルダー: "記事を検索..."
- [ ] ソートラベル: "並び順:"
- [ ] ボタンテキスト: "開く", "音声概要"
- [ ] エラーメッセージが日本語で表示される

### 英語表示の確認
- [ ] ヘッダータイトル: "NotebookLM Reading List"
- [ ] 検索プレースホルダー: "Search articles..."
- [ ] ソートラベル: "Sort by:"
- [ ] ボタンテキスト: "Open", "Audio Summary"
- [ ] エラーメッセージが英語で表示される

## 注意事項

- 拡張機能の言語はChromeの言語設定に従います
- `manifest.json`の`default_locale`は"en"に設定されているため、対応していない言語の場合は英語が表示されます
- 言語切り替え後は拡張機能の再読み込みが必要な場合があります