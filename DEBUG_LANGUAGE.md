# 言語設定のデバッグ方法

## 問題: 日本語環境で英語が表示される

### 1. Chromeの言語設定を確認

1. Chrome設定を開く: `chrome://settings/languages`
2. 「言語」セクションで、日本語が最上位にあることを確認
3. 「Chromeをこの言語で表示」が有効になっていることを確認

### 2. 拡張機能の言語設定を確認

拡張機能のコンソールで以下を実行:

```javascript
// 1. サイドパネルで開発者ツールを開く
// 2. コンソールで実行:
console.log('UI Language:', chrome.i18n.getUILanguage());
console.log('Accept Languages:', chrome.i18n.getAcceptLanguages((langs) => console.log(langs)));
```

### 3. メッセージが正しく読み込まれているか確認

コンソールで以下を実行:

```javascript
// 日本語メッセージが読み込まれているか確認
console.log('Extension Name:', chrome.i18n.getMessage('extensionName'));
console.log('Header Title:', chrome.i18n.getMessage('headerTitle'));
```

### 4. 拡張機能の再読み込み

1. `chrome://extensions/` を開く
2. NotebookLM Reading Listの「更新」ボタンをクリック
3. サイドパネルを閉じて再度開く

### 5. トラブルシューティング

もし`chrome.i18n.getUILanguage()`が`"en"`を返す場合:

1. **Chromeを完全に再起動**
   - すべてのChromeウィンドウを閉じる
   - タスクマネージャーでChromeプロセスが終了していることを確認
   - Chromeを再起動

2. **言語パックの確認**
   - Chromeが日本語言語パックをインストールしているか確認
   - 必要に応じて言語を削除して再追加

3. **システムの言語設定**
   - OS（Windows/macOS/Linux）の言語設定も確認

### 期待される結果

- `chrome.i18n.getUILanguage()` → `"ja"`
- `chrome.i18n.getMessage('extensionName')` → `"NotebookLM Reading List"`
- `chrome.i18n.getMessage('headerTitle')` → `"NotebookLM Reading List"`（日本語と英語で同じ）

### デバッグ用コード

拡張機能のコンソールで実行:

```javascript
// 全体的な診断
(function debugI18n() {
  console.group('🌍 i18n Debug Info');
  console.log('UI Language:', chrome.i18n.getUILanguage());
  console.log('Extension Name:', chrome.i18n.getMessage('extensionName'));
  console.log('Search Placeholder:', chrome.i18n.getMessage('searchPlaceholder'));
  console.log('Sort Label:', chrome.i18n.getMessage('sortLabel'));
  
  // 日本語特有のメッセージをテスト
  console.log('Audio Summary Button:', chrome.i18n.getMessage('audioSummaryButton'));
  console.log('Generating Audio:', chrome.i18n.getMessage('generatingAudio'));
  
  chrome.i18n.getAcceptLanguages((langs) => {
    console.log('Accept Languages:', langs);
  });
  
  console.groupEnd();
})();
```

このデバッグ情報を確認して、実際にどの言語が使用されているか教えてください。