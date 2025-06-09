# オフスクリーンAPIを使った完全バックグラウンド実装計画

## 概要

現在の実装では、NotebookLMの音声を再生するために実際のタブを開いていますが、オフスクリーンAPIを使用することで、ユーザーに一切タブを見せることなく、完全にバックグラウンドで動作させることができます。

## オフスクリーンAPIの機能

### 利用可能な理由（reasons）

1. **AUDIO_PLAYBACK**: 音声を再生する
2. **IFRAME_SCRIPTING**: iframeを埋め込んでコンテンツを操作する
3. **DOM_SCRAPING**: iframeのDOMから情報を抽出する
4. **BLOBS**: Blob URLを作成・管理する
5. **DOM_PARSER**: DOMParserを使用する

### 実装可能な機能

1. **NotebookLMページの読み込み**
   - オフスクリーンドキュメント内でiframeを作成
   - NotebookLMのページをiframeに読み込み
   - コンテンツスクリプトを注入して操作

2. **音声の取得と再生**
   - NotebookLMページから音声URLを抽出
   - オフスクリーンドキュメント内で直接再生
   - プログレスバーの同期も可能

3. **音声の生成**
   - 生成ボタンのクリック
   - 生成状態の監視
   - 完了後の自動再生

## 実装アーキテクチャ

```
┌─────────────────┐
│  Side Panel UI  │
└────────┬────────┘
         │ メッセージング
┌────────┴────────┐
│ Service Worker  │
└────────┬────────┘
         │ オフスクリーン作成
┌────────┴────────────┐
│ Offscreen Document  │
│  ├─ iframe         │
│  │  └─ NotebookLM  │
│  ├─ Content Script │
│  └─ Audio Player   │
└─────────────────────┘
```

## 実装手順

### 1. オフスクリーンドキュメントの拡張

```javascript
// offscreen.js
class NotebookLMController {
  constructor() {
    this.iframe = null;
    this.audioPlayer = null;
  }

  async loadNotebook(notebookUrl) {
    // iframeを作成
    this.iframe = document.createElement('iframe');
    this.iframe.src = notebookUrl;
    this.iframe.style.display = 'none';
    document.body.appendChild(this.iframe);
    
    // iframeの読み込みを待つ
    await new Promise(resolve => {
      this.iframe.onload = resolve;
    });
    
    // コンテンツスクリプトを注入
    await this.injectContentScript();
  }

  async injectContentScript() {
    // iframeのwindowにアクセス
    const iframeWindow = this.iframe.contentWindow;
    
    // NotebookLMの操作スクリプトを注入
    const script = iframeWindow.document.createElement('script');
    script.textContent = `
      // 音声情報を取得
      function getAudioInfo() {
        const audioElement = document.querySelector('audio');
        const playButton = document.querySelector('[aria-label*="再生"]');
        // ... DOM操作
      }
      
      // メッセージングでバックグラウンドと通信
      window.addEventListener('message', (event) => {
        if (event.data.action === 'getAudioInfo') {
          const info = getAudioInfo();
          event.source.postMessage({ 
            type: 'audioInfo', 
            data: info 
          }, event.origin);
        }
      });
    `;
    iframeWindow.document.head.appendChild(script);
  }

  async getAudioInfo() {
    // iframeにメッセージを送信
    this.iframe.contentWindow.postMessage(
      { action: 'getAudioInfo' }, 
      '*'
    );
    
    // レスポンスを待つ
    return new Promise(resolve => {
      window.addEventListener('message', function handler(event) {
        if (event.data.type === 'audioInfo') {
          window.removeEventListener('message', handler);
          resolve(event.data.data);
        }
      });
    });
  }

  async playAudio(audioUrl) {
    // オフスクリーン内で音声を再生
    if (!this.audioPlayer) {
      this.audioPlayer = new Audio();
    }
    this.audioPlayer.src = audioUrl;
    await this.audioPlayer.play();
  }
}
```

### 2. manifest.jsonの更新

```json
{
  "permissions": [
    "offscreen",
    "scripting"
  ],
  "host_permissions": [
    "https://notebooklm.google.com/*"
  ],
  "web_accessible_resources": [{
    "resources": ["src/offscreen/notebook-controller.js"],
    "matches": ["https://notebooklm.google.com/*"]
  }]
}
```

### 3. Service Workerの更新

```javascript
// background.js
async function createOffscreenForNotebook() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (existingContexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'src/offscreen/offscreen.html',
      reasons: ['IFRAME_SCRIPTING', 'AUDIO_PLAYBACK', 'DOM_SCRAPING'],
      justification: 'NotebookLMをバックグラウンドで操作して音声を再生'
    });
  }
}

// タブを開く代わりにオフスクリーンで処理
async function handleAudioRequest(notebookUrl) {
  await createOffscreenForNotebook();
  
  // オフスクリーンドキュメントに指示
  const response = await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'loadAndPlayNotebook',
    notebookUrl: notebookUrl
  });
  
  return response;
}
```

## メリット

1. **完全にバックグラウンドで動作**
   - ユーザーにタブが見えない
   - 作業の邪魔にならない

2. **パフォーマンスの向上**
   - タブの切り替えが不要
   - リソース使用量の削減

3. **より良いユーザー体験**
   - シームレスな音声再生
   - 複数のノートブックの同時処理が可能

4. **セキュリティの向上**
   - ユーザーのブラウジングに影響しない
   - 隔離された環境での実行

## 注意点

1. **クロスオリジン制限**
   - postMessageを使った通信が必要
   - 一部のDOM操作に制限がある

2. **デバッグの難しさ**
   - オフスクリーンドキュメントは見えない
   - Chrome DevToolsでの検査が必要

3. **メモリ使用量**
   - iframeとオーディオを同時に保持
   - 適切なクリーンアップが必要

## 段階的移行計画

### Phase 1: 基本実装
- オフスクリーンドキュメントの作成
- iframeでのNotebookLM読み込み
- 基本的な音声再生

### Phase 2: 機能拡張
- 音声生成の自動化
- プログレスバーの同期
- エラーハンドリングの改善

### Phase 3: 最適化
- キャッシュ機能の実装
- 複数ノートブックの並列処理
- メモリ使用量の最適化

## まとめ

オフスクリーンAPIを使用することで、現在のタブベースの実装から完全にバックグラウンドで動作する実装に移行できます。これにより、ユーザー体験が大幅に向上し、拡張機能の使いやすさが格段に改善されます。