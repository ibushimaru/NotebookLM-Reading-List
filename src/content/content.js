// NotebookLMのページから記事情報を取得するスクリプト

// i18n helper - chrome.i18n.getMessage wrapper with fallback
const getMessage = (messageName, substitutions) => {
  if (chrome.i18n && chrome.i18n.getMessage) {
    return chrome.i18n.getMessage(messageName, substitutions) || messageName;
  }
  return messageName;
};

// スクリプトが既に実行されているかチェック
if (typeof window._notebookLMExtensionInitialized === 'undefined') {
  window._notebookLMExtensionInitialized = true;

  // DOM変更の監視
  const observer = new MutationObserver((mutations) => {
    // 拡張機能のコンテキストが有効かチェック
    if (!chrome.runtime || !chrome.runtime.id) {
      observer.disconnect();
      return;
    }
    extractNotebooks();
  });

// 初期化
function init() {
  // ページ読み込み完了後に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserving);
  } else {
    startObserving();
  }
}

// DOM監視開始
function startObserving() {
  // 拡張機能のコンテキストが有効かチェック
  if (!chrome.runtime || !chrome.runtime.id) {
    console.log('Extension context is invalid, stopping observer');
    return;
  }
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // 初回実行
  extractNotebooks();
}

// ノートブック情報の抽出
function extractNotebooks() {
  const notebooks = [];
  
  // NotebookLMの記事カードを検索（複数のセレクタを試す）
  const selectors = [
    'project-button',
    '[role="button"][aria-labelledby]',
    '.project-button',
    '[class*="project-button"]'
  ];
  
  let notebookElements = [];
  try {
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        notebookElements = elements;
        console.log(`Found elements with selector "${selector}":`, elements.length);
        break;
      }
    }
  } catch (error) {
    console.log('Error while searching for elements:', error);
    return;
  }
  
  notebookElements.forEach(element => {
    const notebookId = extractNotebookId(element);
    const createdDate = extractCreatedDate(element);
    const notebook = {
      id: notebookId,
      title: extractTitle(element),
      icon: extractIcon(element),
      url: notebookId ? `https://notebooklm.google.com/notebook/${notebookId}` : null,
      timestamp: new Date().toISOString(),
      sourceCount: extractSourceCount(element),
      createdDate: createdDate
    };
    
    if (notebook.title) {
      notebooks.push(notebook);
    }
  });
  
  // バックグラウンドスクリプトに送信（エラーハンドリング付き）
  if (notebooks.length > 0) {
    try {
      // 拡張機能のコンテキストが有効かチェック
      if (chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
          action: 'getNotebooks',
          data: notebooks
        });
      }
    } catch (error) {
      // Extension context invalidatedエラーを無視
      if (!error.message.includes('Extension context invalidated')) {
        console.error('Failed to send message:', error);
      }
    }
  } else {
    // デバッグ: ページの構造を確認
    console.log('No notebooks found. Page structure:', {
      bodyChildren: document.body.children.length,
      hasAudioOverview: !!document.querySelector('audio-overview'),
      url: window.location.href
    });
  }
  
  console.log('Found notebooks:', notebooks.length);
}

// タイトル抽出
function extractTitle(element) {
  // project-button-titleクラスを持つ要素を探す
  const titleElement = element.querySelector('.project-button-title');
  if (titleElement && titleElement.textContent) {
    return titleElement.textContent.trim();
  }
  
  return '';
}

// アイコン抽出
function extractIcon(element) {
  // project-button-box-iconクラスを持つ要素（絵文字アイコン）を探す
  const iconElement = element.querySelector('.project-button-box-icon');
  if (iconElement && iconElement.textContent) {
    return iconElement.textContent.trim();
  }
  return null;
}

// ノートブックID抽出
function extractNotebookId(element) {
  // タイトル要素のIDから抽出（例: "97d4cdf7-377f-4b89-ab0f-aa6a52299d1e-title"）
  const titleElement = element.querySelector('.project-button-title');
  if (titleElement && titleElement.id) {
    // "-title"を除去してIDを取得
    return titleElement.id.replace('-title', '');
  }
  return null;
}

// ソース数の抽出
function extractSourceCount(element) {
  const sourceElement = element.querySelector('.project-button-subtitle-part-sources');
  if (sourceElement && sourceElement.textContent) {
    const match = sourceElement.textContent.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
  return 0;
}

// 作成日の抽出
function extractCreatedDate(element) {
  // セレクターに基づいて作成日を取得
  const dateElement = element.querySelector('.project-button-subtitle-part[title]');
  if (dateElement) {
    // title属性から完全な日時を取得
    const fullDate = dateElement.getAttribute('title');
    // 表示テキストから短縮形式を取得
    const displayDate = dateElement.textContent?.trim();
    
    if (fullDate) {
      try {
        // 日付をパースしてISOString形式で返す
        const date = new Date(fullDate);
        return {
          isoString: date.toISOString(),
          displayText: displayDate || fullDate,
          timestamp: date.getTime()
        };
      } catch (e) {
        console.error('Failed to parse date:', fullDate, e);
      }
    }
  }
  return null;
}

// ID生成
function generateId() {
  return 'notebook-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// 初期化実行
init();

// audio要素の変更を監視して、リアルタイムで更新を送信
let audioUpdateInterval = null;
let lastAudioElement = null;

function monitorAudioElement() {
  const audio = findAudioElement();
  
  if (audio && audio !== lastAudioElement) {
    // 新しいaudio要素が見つかった
    console.log('New audio element detected, setting up monitoring');
    lastAudioElement = audio;
    
    // 既存のインターバルをクリア
    if (audioUpdateInterval) {
      clearInterval(audioUpdateInterval);
    }
    
    // 音声要素の状態を監視
    let wasPlaying = false;
    audioUpdateInterval = setInterval(() => {
      if (audio && audio.src) {
        const isPlaying = !audio.paused;
        
        // 再生状態が変わった時、または再生中の時に更新を送信
        if (isPlaying || isPlaying !== wasPlaying) {
          const info = {
            currentTime: formatTime(audio.currentTime),
            duration: formatTime(audio.duration),
            progress: audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0,
            isPlaying: isPlaying
          };
          
          // 拡張機能のコンテキストが有効かチェック
          if (chrome.runtime && chrome.runtime.id) {
            try {
              chrome.runtime.sendMessage({
                action: 'audioProgressUpdate',
                data: info
              });
            } catch (error) {
              // エラーを無視
            }
          }
        }
        
        wasPlaying = isPlaying;
      }
    }, 100); // 100msごとに更新（より頻繁に）
  }
}

// 定期的にaudio要素をチェック
const monitorInterval = setInterval(() => {
  // 拡張機能のコンテキストが無効になったらクリーンアップ
  if (!chrome.runtime || !chrome.runtime.id) {
    clearInterval(monitorInterval);
    if (audioUpdateInterval) {
      clearInterval(audioUpdateInterval);
    }
    return;
  }
  monitorAudioElement();
}, 1000);

// ページがアンロードされる時にクリーンアップ
window.addEventListener('beforeunload', () => {
  if (audioUpdateInterval) {
    clearInterval(audioUpdateInterval);
  }
  clearInterval(monitorInterval);
  observer.disconnect();
});

// SPAナビゲーションを検出してクリーンアップ
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('URL changed, cleaning up audio monitoring');
    if (audioUpdateInterval) {
      clearInterval(audioUpdateInterval);
      audioUpdateInterval = null;
    }
    lastAudioElement = null;
  }
}).observe(document, {subtree: true, childList: true});

// 時間フォーマット関数
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// audio要素を複数の方法で探す
function findAudioElement() {
  // 通常のaudio要素
  let audio = document.querySelector('audio');
  if (audio) return audio;
  
  // audio-overview内
  const audioOverview = document.querySelector('audio-overview');
  if (audioOverview) {
    audio = audioOverview.querySelector('audio');
    if (audio) return audio;
  }
  
  // audio-player内
  const audioPlayer = document.querySelector('audio-player');
  if (audioPlayer) {
    audio = audioPlayer.querySelector('audio');
    if (audio) return audio;
  }
  
  // Shadow DOMの可能性
  const elements = document.querySelectorAll('*');
  for (const el of elements) {
    if (el.shadowRoot) {
      audio = el.shadowRoot.querySelector('audio');
      if (audio) return audio;
    }
  }
  
  return null;
}

// Blob URLから音声データを取得
async function fetchAudioBlobData(blobUrl) {
  try {
    console.log('Fetching audio blob data from:', blobUrl);
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    
    // BlobをArrayBufferに変換
    const arrayBuffer = await blob.arrayBuffer();
    
    // ArrayBufferをBase64に変換（Chrome拡張機能のメッセージングで送信可能）
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    return {
      success: true,
      mimeType: blob.type || 'audio/wav',
      size: blob.size,
      base64Data: base64
    };
  } catch (error) {
    console.error('Failed to fetch audio blob:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 音声ダウンロード機能
async function downloadAudioFromBlob(blobUrl, filename) {
  try {
    // Blob URLからBlobオブジェクトを取得
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    
    // ダウンロード用のURLを作成
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'audio-overview.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    console.error('Download error:', error);
    return { success: false, error: error.message };
  }
}

// 音声概要の情報を取得
function getAudioOverviewInfo() {
  // まずStudioタブが折りたたまれているかチェック
  const studioTabs = document.querySelectorAll('div[role="tab"] .mdc-tab__text-label');
  let studioTabElement = null;
  
  for (const tab of studioTabs) {
    if (tab.textContent && tab.textContent.trim() === 'Studio') {
      studioTabElement = tab.closest('div[role="tab"]');
      break;
    }
  }
  
  if (studioTabElement && studioTabElement.getAttribute('aria-selected') === 'false') {
    // Studioタブがアクティブでない場合はクリック
    console.log('Clicking Studio tab to expand audio overview');
    studioTabElement.click();
    // クリック後、少し待ってから再度チェック
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(getAudioOverviewInfo());
      }, 1000); // より長い待機時間
    });
  }
  
  const audioOverview = document.querySelector('audio-overview');
  if (!audioOverview) {
    return { status: 'not_found' };
  }
  
  // 各要素の存在を確認
  const audioPlayer = audioOverview.querySelector('audio-player');
  const readyContainer = audioOverview.querySelector('.ready-container');
  const actionContainer = audioOverview.querySelector('.action-container');
  const loadingContainer = audioOverview.querySelector('.loading-phase-container');
  
  // 生成中かどうかをチェック
  if (loadingContainer) {
    console.log('Audio generation in progress');
    return { status: 'generating' };
  }
  
  // ボタンの種類で状態を判定
  const loadButton = audioOverview.querySelector('button[jslog*="229232"]'); // 読み込みボタン
  const generateButton = audioOverview.querySelector('button[jslog*="229231"]'); // 生成ボタン
  
  // 再生ボタンの検索（より広範囲に）
  let playButton = audioOverview.querySelector('button[jslog*="229238"]');
  if (!playButton) {
    playButton = audioOverview.querySelector('button[aria-label*="再生"]');
  }
  if (!playButton) {
    playButton = audioOverview.querySelector('button[aria-label*="一時停止"]');
  }
  if (!playButton && audioPlayer) {
    // audio-player内のボタンも探す
    playButton = audioPlayer.querySelector('button[role="button"]');
  }
  
  // audio要素を探す
  const audioElement = findAudioElement();
  
  // 状態の判定
  console.log('Audio overview elements:', {
    audioPlayer: !!audioPlayer,
    playButton: !!playButton,
    loadButton: !!loadButton,
    generateButton: !!generateButton,
    loadingContainer: !!loadingContainer
  });
  
  if (audioPlayer || (audioElement && audioElement.src)) {
    // プレーヤーまたはaudio要素がある = 準備完了
    const info = {
      status: 'ready',
      isPlaying: false,
      duration: '',
      currentTime: '',
      title: '',
      audioUrl: null,
      hasPlayer: true
    };
    
    // audio要素があればURL取得
    if (audioElement && audioElement.src) {
      info.audioUrl = audioElement.src;
    }
    
    // 再生状態を確認（playButtonがある場合）
    if (playButton) {
      const icon = playButton.querySelector('mat-icon');
      info.isPlaying = icon && icon.textContent === 'pause';
    }
    
    // 再生時間情報（複数の方法で試す）
    if (audioPlayer) {
      const timeContainer = audioPlayer.querySelector('.playback-time-container');
      if (timeContainer) {
        const timeText = timeContainer.textContent.trim();
        const timeParts = timeText.split('/');
        if (timeParts.length >= 2) {
          info.currentTime = timeParts[0].trim();
          info.duration = timeParts[1].split('•')[0].trim();
        }
      }
    }
    
    // audio要素から直接時間情報を取得（これが最も信頼できる）
    const audio = audioElement || findAudioElement();
    if (audio && audio.src) {
      console.log('Audio element found:', {
        src: audio.src ? 'present' : 'none',
        paused: audio.paused,
        currentTime: audio.currentTime,
        duration: audio.duration
      });
      
      // 現在時間と全体時間を秒で取得
      if (!isNaN(audio.currentTime) && !isNaN(audio.duration) && audio.duration > 0) {
        info.currentTime = formatTime(audio.currentTime);
        info.duration = formatTime(audio.duration);
        info.progress = (audio.currentTime / audio.duration) * 100;
        // 再生状態もaudio要素から直接取得（これを優先）
        info.isPlaying = !audio.paused;
      } else if (!info.currentTime || !info.duration) {
        // audio要素から時間が取得できない場合のデフォルト値
        info.currentTime = '00:00';
        info.duration = '00:00';
      }
    }
    
    // タイトル
    if (audioPlayer) {
      const titleElement = audioPlayer.querySelector('.audio-title span');
      if (titleElement) {
        info.title = titleElement.textContent.trim();
      }
    }
    
    console.log('Returning audio info:', info);
    return info;
  }
  
  // actionContainerとその中のボタンで判定
  if (actionContainer) {
    if (loadButton) {
      return { status: 'not_loaded' };
    }
    
    if (generateButton) {
      const customContainer = audioOverview.querySelector('.custom-audio-action-container');
      if (customContainer) {
        return { status: 'not_generated' };
      }
    }
  }
  
  // readyContainerがあるがaudioPlayerがない場合は読み込み中
  if (readyContainer && !audioPlayer) {
    return { status: 'loading' };
  }
  
  return { status: 'unknown' };
}

// 音声の読み込み完了を待つ
async function waitForAudioLoaded(maxWaitTime = 30000) {
  const startTime = Date.now();
  let previousStatus = null;
  let audioObserver = null;
  
  console.log('Waiting for audio to load...');
  
  // 現在のページ状態をログ
  console.log('Current page state:', {
    hasAudioOverview: !!document.querySelector('audio-overview'),
    hasAudioPlayer: !!document.querySelector('audio-player'),
    hasAudio: !!document.querySelector('audio'),
    audioSrc: document.querySelector('audio')?.src
  });
  
  // audio要素のsrc変更を監視するPromise
  const audioSrcPromise = new Promise((resolve) => {
    // 既存のaudio要素をチェック
    const checkExistingAudio = () => {
      const audio = document.querySelector('audio');
      const audioInPlayer = document.querySelector('audio-player audio');
      const targetAudio = audio || audioInPlayer;
      
      if (targetAudio && targetAudio.src && targetAudio.src.startsWith('blob:')) {
        console.log('Audio already has src:', targetAudio.src);
        resolve(targetAudio);
        return true;
      }
      return false;
    };
    
    if (checkExistingAudio()) return;
    
    // MutationObserverでaudio要素の出現とsrc変更を監視
    audioObserver = new MutationObserver((mutations) => {
      // デバッグ: 変更を監視
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeName === 'AUDIO' || (node.querySelector && node.querySelector('audio'))) {
              console.log('Audio element added to DOM');
            }
          });
        }
      });
      
      // audio要素をチェック
      if (checkExistingAudio()) {
        audioObserver.disconnect();
      }
    });
    
    // 監視開始
    audioObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
    
    // 定期的にチェック（MutationObserverが見逃す場合の対策）
    const checkInterval = setInterval(() => {
      if (checkExistingAudio()) {
        clearInterval(checkInterval);
        if (audioObserver) {
          audioObserver.disconnect();
        }
      }
    }, 1000);
    
    // タイムアウト時にインターバルをクリア
    setTimeout(() => clearInterval(checkInterval), maxWaitTime);
  });
  
  // タイムアウトPromise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), maxWaitTime);
  });
  
  try {
    // audio要素のsrcが設定されるまで待つ
    const audioElement = await Promise.race([audioSrcPromise, timeoutPromise]);
    
    // 監視を停止
    if (audioObserver) {
      audioObserver.disconnect();
    }
    
    console.log('Audio element found, getting final info');
    
    // 最終的な情報を取得
    await new Promise(resolve => setTimeout(resolve, 1000)); // 安定するまで少し待つ
    const info = getAudioOverviewInfo();
    
    console.log('Final audio info:', info);
    
    return info;
    
  } catch (error) {
    // 監視を停止
    if (audioObserver) {
      audioObserver.disconnect();
    }
    
    if (error.message === 'timeout') {
      console.log('Audio loading timeout - checking final status');
      const finalInfo = getAudioOverviewInfo();
      console.log('Final info after timeout:', finalInfo);
      
      // 最後の状態を返す
      return finalInfo;
    }
    
    throw error;
  }
}

// 音声要素のプリロード
async function preloadAudioElement() {
  const audioElement = findAudioElement();
  if (audioElement?.src) {
    try {
      // プリロードを実行
      audioElement.load();
      console.log('Audio element preloaded');
      
      // ユーザーインタラクションをシミュレート（タブがアクティブな場合）
      if (document.hasFocus()) {
        console.log('Tab is active, attempting silent play...');
        const originalVolume = audioElement.volume;
        audioElement.volume = 0;
        audioElement.muted = true;
        
        try {
          await audioElement.play();
          audioElement.pause();
          audioElement.currentTime = 0;
          audioElement.volume = originalVolume;
          audioElement.muted = false;
          console.log('Audio context activated via silent play');
        } catch (e) {
          console.log('Silent play failed:', e);
        }
      }
      
      // readyStateを確認
      if (audioElement.readyState >= 3) { // HAVE_FUTURE_DATA
        console.log('Audio is ready to play');
        return true;
      }
    } catch (error) {
      console.log('Preload failed:', error);
    }
  }
  return false;
}

// ページ読み込み時に自動的にプリロード
window.addEventListener('load', () => {
  setTimeout(() => {
    preloadAudioElement();
  }, 2000);
});

// 音声概要の操作
async function controlAudioOverview(action, params = {}) {
  // まずStudioタブを確認して展開
  const studioTabs = document.querySelectorAll('div[role="tab"] .mdc-tab__text-label');
  let studioTabElement = null;
  
  for (const tab of studioTabs) {
    if (tab.textContent && tab.textContent.trim() === 'Studio') {
      studioTabElement = tab.closest('div[role="tab"]');
      break;
    }
  }
  
  if (studioTabElement && studioTabElement.getAttribute('aria-selected') === 'false') {
    console.log('Clicking Studio tab before audio control');
    studioTabElement.click();
    // タブ切り替えを待つ
    return new Promise((resolve) => {
      setTimeout(async () => {
        const result = await controlAudioOverview(action, params);
        resolve(result);
      }, 1000);
    });
  }
  
  const audioOverview = document.querySelector('audio-overview');
  if (!audioOverview) {
    return { success: false, error: getMessage('audioOverviewNotFoundError') };
  }
  
  switch (action) {
    case 'play':
    case 'pause': {
      // getAudioOverviewInfoと同じロジックを使用
      const audioPlayer = audioOverview?.querySelector('audio-player');
      
      // 複数のセレクターを試す
      let playButton = audioOverview?.querySelector('button[jslog*="229238"]');
      if (!playButton) {
        playButton = audioOverview?.querySelector('button[aria-label*="再生"]');
      }
      if (!playButton) {
        playButton = audioOverview?.querySelector('button[aria-label*="一時停止"]');
      }
      if (!playButton && audioPlayer) {
        // audio-player内のボタンも探す
        playButton = audioPlayer.querySelector('button[role="button"]');
      }
      if (!playButton && audioPlayer) {
        // playback-control-buttonクラスを持つボタンを探す
        playButton = audioPlayer.querySelector('button.playback-control-button');
      }
      if (!playButton && audioPlayer) {
        // mat-iconを含むボタンを探す
        const buttons = audioPlayer.querySelectorAll('button');
        for (const btn of buttons) {
          const icon = btn.querySelector('mat-icon');
          if (icon && (icon.textContent === 'play_arrow' || icon.textContent === 'pause')) {
            playButton = btn;
            break;
          }
        }
      }
      
      // デバッグ情報を出力
      if (!playButton) {
        console.log('Play button not found. Searching for buttons...');
        const allButtons = audioOverview.querySelectorAll('button');
        console.log('Total buttons found:', allButtons.length);
        allButtons.forEach((btn, index) => {
          const icon = btn.querySelector('mat-icon');
          console.log(`Button ${index}:`, {
            ariaLabel: btn.getAttribute('aria-label'),
            jslog: btn.getAttribute('jslog'),
            classes: btn.className,
            iconText: icon ? icon.textContent : 'no icon'
          });
        });
      } else {
        console.log('Play button found:', {
          ariaLabel: playButton.getAttribute('aria-label'),
          jslog: playButton.getAttribute('jslog'),
          classes: playButton.className
        });
      }
      
      // まず、audio要素を直接操作を試みる
      const audioElement = findAudioElement();
      if (audioElement && audioElement.src) {
        try {
          if (action === 'play') {
            console.log('Trying direct audio play...');
            await audioElement.play();
            console.log('Audio played directly');
          } else {
            audioElement.pause();
            console.log('Audio paused directly');
          }
          return { success: true };
        } catch (error) {
          console.log('Direct audio control failed:', error.name, error.message);
          // 直接操作が失敗した場合のみ、ボタンクリックを試みる
        }
      }
      
      // audio要素の直接操作が失敗した場合、ボタンをクリック
      if (playButton) {
        console.log('Falling back to button click...');
        playButton.click();
        
        // クリック後、少し待ってからaudio要素の状態を確認
        setTimeout(() => {
          const audio = findAudioElement();
          if (audio) {
            console.log('Audio state after click:', {
              paused: audio.paused,
              currentTime: audio.currentTime,
              duration: audio.duration,
              src: audio.src ? 'present' : 'none'
            });
          }
        }, 500);
        
        return { success: true };
      }
      
      return { success: false, error: getMessage('playButtonNotFoundError') };
    }
      
    case 'seek': {
      // シーク機能の実装
      console.log('Seeking to percentage:', params.percentage);
      
      // まずaudio要素で直接シークを試みる
      const audio = findAudioElement();
      if (audio && audio.duration && params.percentage !== undefined) {
        const newTime = (audio.duration * params.percentage) / 100;
        console.log('Setting audio currentTime to:', newTime);
        audio.currentTime = newTime;
        
        // UIの更新をトリガー
        audio.dispatchEvent(new Event('timeupdate'));
        return { success: true };
      }
      
      // audio要素が見つからない場合は、プログレスバーを操作
      const progressInputs = audioOverview.querySelectorAll('input[type="range"]');
      console.log('Found progress inputs:', progressInputs.length);
      
      for (const progressBar of progressInputs) {
        if (params.percentage !== undefined) {
          // プログレスバーの最大値を確認（ミリ秒単位の可能性）
          const max = parseFloat(progressBar.max) || 100;
          const min = parseFloat(progressBar.min) || 0;
          const value = min + ((max - min) * params.percentage / 100);
          
          console.log('Setting progress bar value:', value, 'max:', max);
          progressBar.value = value;
          
          // ネイティブのイベントをシミュレート
          const inputEvent = new Event('input', { bubbles: true, cancelable: true });
          const changeEvent = new Event('change', { bubbles: true, cancelable: true });
          
          progressBar.dispatchEvent(inputEvent);
          progressBar.dispatchEvent(changeEvent);
          
          // Angularの場合、追加のイベントが必要かもしれない
          try {
            progressBar.dispatchEvent(new Event('mousedown', { bubbles: true }));
            progressBar.dispatchEvent(new Event('mouseup', { bubbles: true }));
          } catch (e) {
            console.log('Additional event dispatch failed:', e);
          }
          
          return { success: true };
        }
      }
      
      console.log('Failed to seek: no audio element or progress bar found');
      return { success: false, error: getMessage('seekElementNotFoundError') };
    }
      
    case 'load': {
      // jslog属性で読み込みボタンを特定
      const loadBtn = audioOverview.querySelector('button[jslog*="229232"]');
      if (loadBtn) {
        loadBtn.click();
        return { success: true };
      }
      // フォールバック：aria-labelで探す
      const loadBtnAlt = audioOverview.querySelector('button[aria-label="音声概要を読み込む"]');
      if (loadBtnAlt) {
        loadBtnAlt.click();
        return { success: true };
      }
      // さらにフォールバック：divのロールがbuttonのものを探す
      const loadDiv = audioOverview.querySelector('div[role="button"][class*="load-audio"]');
      if (loadDiv) {
        loadDiv.click();
        return { success: true };
      }
      return { success: false, error: getMessage('loadButtonNotFoundError') };
    }
      
    case 'generate': {
      // jslog属性で生成ボタンを特定
      const genBtn = audioOverview.querySelector('button[jslog*="229231"]');
      if (genBtn) {
        genBtn.click();
        return { success: true };
      }
      // フォールバック：クラス名で探す
      const genBtnAlt = audioOverview.querySelector('.generate-button');
      if (genBtnAlt) {
        genBtnAlt.click();
        return { success: true };
      }
      // さらにフォールバック：aria-labelで探す
      const genBtnLabel = document.querySelector('button[aria-label*="生成"], button[aria-label*="Generate"]');
      if (genBtnLabel) {
        genBtnLabel.click();
        return { success: true };
      }
      return { success: false, error: getMessage('generateButtonNotFoundError') };
    }
      
    case 'download': {
      const audioElement = document.querySelector('audio');
      if (audioElement && audioElement.src) {
        const title = document.querySelector('.audio-title span')?.textContent?.trim() || 'audio-overview';
        const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
        return downloadAudioFromBlob(audioElement.src, filename);
      }
      return { success: false, error: getMessage('audioFileNotFoundError') };
    }
  }
  
  return { success: false, error: getMessage('operationFailedError') };
}

// メッセージリスナーを拡張（エラーハンドリング付き）
if (chrome.runtime && chrome.runtime.id) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[NotebookLM content script] Received message:', request);
    
    // 非同期処理を適切に処理
    (async () => {
      try {
      switch (request.action) {
        case 'ping':
          sendResponse({ success: true });
          break;
          
        case 'getAudioInfo':
          // 非同期処理の可能性があるため、Promiseで処理
          Promise.resolve(getAudioOverviewInfo()).then(info => {
            sendResponse(info);
          });
          return true; // 非同期レスポンスを示す
          
        case 'waitForAudioLoaded':
          const loadedInfo = await waitForAudioLoaded(request.timeout);
          sendResponse(loadedInfo);
          break;
          
        case 'controlAudio':
          // 非同期処理の可能性があるため、Promiseで処理
          Promise.resolve(controlAudioOverview(request.command, request)).then(result => {
            sendResponse(result);
          });
          return true; // 非同期レスポンスを示す
          
        case 'seekAudio':
          // 非同期処理の可能性があるため、Promiseで処理
          Promise.resolve(controlAudioOverview('seek', { percentage: request.percentage })).then(seekResult => {
            sendResponse(seekResult);
          });
          return true; // 非同期レスポンスを示す
          
        case 'fetchAudioBlob':
          // Blob URLから実際のデータを取得
          fetchAudioBlobData(request.blobUrl).then(result => {
            sendResponse(result);
          });
          return true; // 非同期レスポンスを示す
          
        default:
          sendResponse({ success: false });
      }
    } catch (error) {
      console.error('Content script error:', error);
      sendResponse({ status: 'error', message: error.message });
    }
    })();
    
    // 非同期レスポンスを示す
    return true;
  });
}

} // スクリプト初期化チェックの閉じ括弧