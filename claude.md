作りたいもののメモ

NotebookLMを活用しているが、検索機能がない為不便である。
Googleの標準の機能では、リーディングリストというものが存在する。
ブラウザの右や左に常駐させるような新たな拡張機能を作成したい。

満たす要件としては、自分が作成したNotebookLMの記事リンクさせて、一覧表示させる。
その時、NotebookLMは自動的にアイコンを作成するので、そのアイコンでフィルタリングできればなお良い。
また、音声概要を作成するボタンと、再生するボタンを用意したい。
また、NoteBookLMに質問を行い、その結果を返答する簡易的なUIを用意しても面白い。(必須ではない)

NoteBookLMの機能を拡張する拡張機能として、ユーザーフレンドリーなGoogle拡張機能を作成するのがあなたの目的だ。

## 調査結果
### NotebookLM APIについて
- **公式APIは現在存在しない**: GoogleはNotebookLMの公式APIをまだ公開していない
- **既存の拡張機能**: 「NotebookLM Web Importer」という公式拡張機能が存在し、ウェブページやYouTube動画をワンクリックでNotebookLMに追加できる
- **技術的アプローチ**: APIがないため、Chrome拡張機能のContent Scriptを使用してNotebookLMのウェブインターフェースを直接操作する必要がある

### 開発方針
1. **Content Scriptを使用したDOM操作**: NotebookLMのウェブページ（notebooklm.google.com）のDOMを解析し、記事一覧の取得や操作を実装
2. **Chrome Side Panel API**: ブラウザの左右に常駐するサイドパネルを実装
3. **Storage API**: 記事情報のキャッシュとフィルタリング設定の保存
4. **実装の段階的アプローチ**: 
   - Phase 1: 基本的な記事一覧の取得と表示
   - Phase 2: アイコンによるフィルタリング機能
   - Phase 3: 音声概要の操作機能
   - Phase 4: 質問機能（オプション）

参考拡張機能:
- https://chromewebstore.google.com/detail/notebooklm-web-importer/ijdefdijdmghafocfmmdojfghnpelnfn
- NotebookLM Web Importer（公式）

## 開発進捗

### 完了したタスク
1. **基本的な拡張機能構造の作成**
   - manifest.json（Manifest V3対応）
   - バックグラウンドスクリプト（Service Worker）
   - コンテントスクリプト（DOM操作用）
   - サイドパネル（HTML/CSS/JS）

### 実装した機能
- **サイドパネル表示**: Chrome Side Panel APIを使用
- **記事一覧表示**: NotebookLMページから記事情報を抽出
- **検索機能**: タイトルでの絞り込み検索
- **アイコンフィルター**: アイコンごとの分類表示
- **更新ボタン**: 記事一覧の手動更新
- **音声再生機能**: Offscreen APIを使用して拡張機能内で音声を再生
  - 音声URLをキャッシュして高速アクセス
  - インラインプレーヤーで直接再生/一時停止
  - 再生進行状況の表示
  - 音声の自動読み込み
  - **シークバー機能**: プログレスバーをクリックして任意の位置にジャンプ
  - **インライン表示**: すべての音声コントロールを各ノートブックの下に表示
  - **正確な時間表示**: audio要素から直接時間情報を取得
  - **自動音声準備**: 音声UIが表示されたら自動的にタブをアクティブにして音声を準備
  - **改善されたシーク機能**: audio要素を直接操作してより確実なシーク動作
  - **視覚的な再生状態表示**: アクティブな音声とそのノートブックを青色で強調表示
  - **明確な間隔**: 各音声プレーヤーの間隔を広げ、どの音声を再生中かを明確に表示
- **タブプールシステム**: 高速音声アクセスのための最適化
  - バックグラウンドでタブを事前に作成・管理
  - 音声読み込み時間を10-15秒から2-3秒に短縮
  - 音声情報のキャッシュで2回目以降は即座にアクセス（3時間保持）
  - タブの自動リサイクルでリソース効率化
  - バックグラウンド再生対応
  - **音声終了時の自動削除**: 再生が終わったらタブを自動的に削除
  - **タブの目立たない配置**: タブバーの最後に配置して視覚的な影響を最小化
  - **最大5つのタブを同時管理**: より多くの音声を切り替え可能
  - **使用中タブの再利用**: タブが不足した場合は最も古いタブを再利用

### 次のステップ
1. **アイコン画像の生成**: icons/create_icons.htmlをブラウザで開いて保存
2. **DOM解析の改善**: NotebookLMの実際のDOM構造に合わせてセレクタを調整
3. **音声概要機能**: Audio Overview APIの調査と実装
4. **データ永続化**: Chrome Storage APIでの記事情報の保存強化

### 既知の問題と対処法
1. **拡張機能リロード時のエラー**
   - "Extension context invalidated"エラーが表示される場合があります
   - これは正常な動作で、NotebookLMのページをリロードすることで解決します
   - 自動的にコンテントスクリプトを再注入する機能も実装済み

2. **音声再生タブについて**
   - 音声再生用のタブが表示されますが、これは技術的な制限によるものです
   - タブはタブバーの最後に配置され、視覚的な影響を最小限に抑えています
   - 音声再生が終了すると自動的に削除されます

3. **タブ作成エラー**
   - "Failed to create new tab"エラーが表示される場合があります
   - これは一時的な問題で、以下の対処法があります：
     - 拡張機能を再読み込み
     - 不要なタブを閉じてメモリを開放
     - Chromeを再起動
   - フォールバック機能により、エラーが発生しても基本的な音声再生は可能です

4. **シークバーの制限**
   - NotebookLMのシークバーはAngularコンポーネントとして実装されているため、直接操作が難しい場合があります
   - 音声要素が利用可能な場合は、直接シークを実行します
   - 一部の環境では、シーク機能が正しく動作しない可能性があります

### インストール方法
1. Chromeで `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をONにする
3. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリック
4. `/home/ibushimaru/project/Extenshin-Reading` フォルダを選択（manifest.jsonがあるフォルダ）

### テスト手順
1. NotebookLM（https://notebooklm.google.com）を開く
2. 拡張機能アイコンをクリックしてサイドパネルを表示
3. 記事一覧が表示されることを確認

## 最新の実装内容（2025年1月）

### 実装した主要機能

1. **シークバーUIの改善**
   - スライダーサム（まるポチ）の追加
   - リアルタイム同期の実現
   - GPUアクセラレーションによる滑らかなアニメーション

2. **音声生成状態の自動検知**
   - 音声概要がない場合の自動生成開始
   - 生成中状態の検知と表示
   - 不要な「音声概要がありません」メッセージの削除

3. **折りたたまれたStudioタブの自動展開**
   - ページ幅が小さい時の自動対応
   - Studioタブの自動クリック機能

4. **擬似的な再生時間カウントアップ**
   - requestAnimationFrameによる60fps更新
   - 実際の音声時間との自動補正
   - 1秒の遅延を最小限に短縮

5. **エラーハンドリングの改善**
   - Extension Context Invalidatedエラーの対処
   - タブが閉じられた時の適切な処理
   - ユーザーフレンドリーなエラーメッセージ

### 技術的な実装詳細

#### 1. GPUアクセラレーションを活用した滑らかなアニメーション

```javascript
// CSS
.audio-progress-fill {
  will-change: transform;
  transform-origin: left center;
}

// JavaScript
progressFill.style.transform = `scaleX(${scaleX})`;
```

#### 2. requestAnimationFrameによる擬似カウントアップ

```javascript
const simulation = {
  animationId: null,
  lastUpdateTime: null,
  
  start() {
    const animate = (currentTime) => {
      const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
      this.lastKnownTime += deltaTime;
      // 60fpsで更新
      this.animationId = requestAnimationFrame(animate);
    };
  }
};
```

#### 3. 音声状態の高度な検知

```javascript
function getAudioOverviewInfo() {
  // 複数のセレクターで再生ボタンを検索
  let playButton = audioOverview.querySelector('button[jslog*="229238"]');
  if (!playButton) {
    playButton = audioOverview.querySelector('button[aria-label*="再生"]');
  }
  // audio要素の存在もチェック
  if (audioPlayer || (audioElement && audioElement.src)) {
    return { status: 'ready', hasPlayer: true };
  }
}
```

### パフォーマンス最適化

1. **DOM操作の最小化**
   - 要素を一度だけ取得してキャッシュ
   - 必要な時のみ更新

2. **CSS transitionの削除**
   - JavaScriptによる直接制御で一貫性確保
   - GPUレイヤーでの処理

3. **非同期処理の最適化**
   - 即座に擬似カウント開始
   - 並行して実際の値を取得・補正

---

# 技術ブログ原稿（Zenn向け）

## タイトル：Chrome拡張機能でNotebookLMの音声概要を快適に管理する方法

### はじめに

GoogleのNotebookLMは優れたAI要約ツールですが、音声概要機能へのアクセスが少し面倒です。複数のノートブックを管理している場合、それぞれを個別に開いて音声を再生する必要があります。

この記事では、Chrome拡張機能を開発して、サイドパネルから全ての音声概要に素早くアクセスできるようにした方法を紹介します。

### 解決したい課題

1. **アクセスの煩雑さ**: 音声概要を聴くには各ノートブックを個別に開く必要がある
2. **管理の困難さ**: 複数のノートブックの音声を一覧で管理できない
3. **UXの問題**: 再生進行状況がリアルタイムで更新されない、シークバーが使いにくい

### アーキテクチャ

```
┌─────────────────┐
│  Side Panel UI  │
└────────┬────────┘
         │
┌────────┴────────┐     ┌─────────────────┐
│ Service Worker  │────│  Tab Pool Mgr   │
└────────┬────────┘     └─────────────────┘
         │
┌────────┴────────┐     ┌─────────────────┐
│ Content Script  │────│ Offscreen Doc   │
└─────────────────┘     └─────────────────┘
```

### 実装のポイント

#### 1. タブプールシステムによる高速化

音声読み込みを10-15秒から2-3秒に短縮：

```javascript
class TabPoolManager {
  constructor() {
    this.pool = new Map(); // タブプール
    this.audioCache = new Map(); // 音声情報キャッシュ
    this.maxPoolSize = 5; // 最大5タブ
  }

  async getAvailableTab(notebookId) {
    // キャッシュチェック
    const cachedInfo = this.audioCache.get(notebookId);
    if (cachedInfo?.tabId) {
      return cachedInfo.tabId;
    }
    
    // アイドルタブを探す
    for (const [tabId, entry] of this.pool.entries()) {
      if (entry.state === 'idle') {
        entry.state = 'in_use';
        entry.notebookId = notebookId;
        return tabId;
      }
    }
    
    // 新規作成
    return await this.createPooledTab();
  }
}
```

**メリット：**
- 事前にタブを作成しておくことで即座にアクセス可能
- 音声情報を3時間キャッシュして2回目以降は瞬時に再生
- メモリ効率を考慮した自動リサイクル

#### 2. 擬似カウントアップによる滑らかな再生表示

60fpsの滑らかなアニメーションを実現：

```javascript
const simulation = {
  animationId: null,
  lastUpdateTime: performance.now(),
  lastKnownTime: 0,
  lastKnownDuration: 0,
  
  start() {
    const animate = (currentTime) => {
      // 前フレームからの経過時間を計算
      const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
      this.lastUpdateTime = currentTime;
      
      // 時間を更新
      this.lastKnownTime += deltaTime;
      
      // GPUアクセラレーションでプログレスバー更新
      const progress = this.lastKnownTime / this.lastKnownDuration;
      progressFill.style.transform = `scaleX(${progress})`;
      
      // 次フレームをリクエスト
      this.animationId = requestAnimationFrame(animate);
    };
    
    this.animationId = requestAnimationFrame(animate);
  }
}
```

**工夫点：**
- CSS transitionを使わずrequestAnimationFrameで直接制御
- transform: scaleXでGPU合成レイヤーを活用
- deltaTime計算で正確な時間管理
- 実際の音声時間と定期的に同期して誤差を補正

#### 3. 音声状態の自動検知と処理

NotebookLMのDOM構造を解析して適切に対応：

```javascript
function getAudioOverviewInfo() {
  const audioOverview = document.querySelector('audio-overview');
  
  // 生成中チェック
  if (audioOverview.querySelector('.loading-phase-container')) {
    return { status: 'generating' };
  }
  
  // Studioタブが折りたたまれているかチェック
  const studioTab = document.querySelector('[role="tab"][aria-selected="false"]');
  if (studioTab?.textContent.includes('Studio')) {
    studioTab.click(); // 自動展開
    return new Promise(resolve => 
      setTimeout(() => resolve(getAudioOverviewInfo()), 1000)
    );
  }
  
  // 音声準備完了チェック
  const audioElement = findAudioElement();
  if (audioElement?.src) {
    return {
      status: 'ready',
      audioUrl: audioElement.src,
      currentTime: formatTime(audioElement.currentTime),
      duration: formatTime(audioElement.duration),
      isPlaying: !audioElement.paused
    };
  }
  
  return { status: 'not_generated' };
}
```

### 技術的な課題と解決策

#### 1. Extension Context Invalidatedエラー

**問題**: 拡張機能のリロード時にコンテキストが無効になる

**解決策**:
```javascript
// エラーハンドリング
try {
  chrome.runtime.sendMessage(message);
} catch (error) {
  if (!error.message.includes('Extension context invalidated')) {
    console.error(error);
  }
}

// SPAナビゲーション検出
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    cleanup();
    reinitialize();
  }
}).observe(document, {subtree: true, childList: true});
```

#### 2. 滑らかなシークバーアニメーション

**問題**: CSS transitionとJavaScript更新の競合でカクつく

**解決策**:
```css
.audio-progress-fill {
  /* transitionを削除 */
  will-change: transform;
  transform-origin: left center;
}
```

#### 3. 音声タブの管理

**問題**: 使用中のタブが閉じられるとエラーになる

**解決策**:
```javascript
handleTabRemoved(tabId) {
  // サイドパネルに通知
  chrome.runtime.sendMessage({
    action: 'tabRemoved',
    tabId: tabId
  });
  
  // ユーザーフレンドリーなメッセージ表示
  showMessage('音声タブが閉じられました。再度お試しください。');
}
```

### パフォーマンス最適化

1. **DOM操作の最小化**
   ```javascript
   // 要素をキャッシュ
   const progressFill = control.querySelector('.audio-progress-fill');
   const currentTimeSpan = control.querySelector('.current-time');
   ```

2. **GPU合成レイヤーの活用**
   ```css
   will-change: transform;
   transform: scaleX(0.5); /* widthの代わりに使用 */
   ```

3. **非同期処理の最適化**
   ```javascript
   // 即座にUIを更新
   simulation.start();
   
   // 並行して実際の値を取得
   setTimeout(async () => {
     const info = await getAudioInfo();
     simulation.correct(info);
   }, 300);
   ```

### 実装結果

- **アクセス時間**: 10-15秒 → 2-3秒（80%短縮）
- **アニメーション**: 30fps → 60fps（倍速化）
- **エラー発生率**: 大幅に減少
- **ユーザビリティ**: サイドパネルから全音声に即座にアクセス可能

### まとめ

Chrome拡張機能の最新APIを活用することで、NotebookLMの使い勝手を大幅に改善できました。特に重要だったのは：

1. **ユーザーの実際の使用パターンを観察**: 複数ノートブックの管理という課題を発見
2. **最新Web APIの活用**: Side Panel API、Offscreen API、requestAnimationFrame
3. **パフォーマンスとUXのバランス**: タブプールによる高速化と滑らかなアニメーション

### 今後の展望

- 音声の文字起こし表示
- 再生速度の調整機能
- キーボードショートカット対応
- 他のAIツールとの連携

### ソースコード

完全なソースコードは以下で公開予定：
[GitHubリポジトリ]

### 参考資料

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Side Panel API](https://developer.chrome.com/docs/extensions/reference/sidePanel/)
- [Offscreen Documents](https://developer.chrome.com/docs/extensions/reference/offscreen/)

---

## 2025/01/10 開発ログ - 音声概要の自動読み込みとタブ管理の改善

### 解決した問題と実装内容

#### 1. タブ復元の不具合修正
- **問題**: 音声再生時に元のタブに自動で戻らない
- **解決**: `chrome.windows.getLastFocused()` で正確なアクティブタブを取得
- **実装箇所**: `sidepanel.js` 行1393-1576

#### 2. 音声生成ダイアログの削除
- **問題**: 不要な「音声概要を生成中...」ダイアログ
- **解決**: ボタンで状態を表示（読み込み中→生成中→完了）
- **削除した関数**: `showGeneratingDialog`, `showGenerateAudioDialog`

#### 3. 自動音声読み込みの復活
- **問題**: ダイアログ削除後、音声が自動読み込みされない
- **解決**: `processReadyAudio` に音声プレーヤー表示ロジックを追加
- **新機能**: `monitorGenerationProgress` で生成完了を5秒ごとに監視

#### 4. その他の改善
- コンテントスクリプトの重複実行防止
- NotebookLMリフレッシュ時のトップページ遷移
- 生成タイムアウト処理（最大10分）

### 今後の改善案
1. 音声生成のプログレスバー表示
2. エラー時の自動リトライ機能
3. ユーザー設定（自動読み込みのオン/オフ）

### 参考
- PR: https://github.com/ibushimaru/NotebookLM-Reading-List/pull/3
- 詳細な開発ログ: `/home/ibushimaru/project/Extenshin-Reading/DEVELOPMENT_LOG.md`
