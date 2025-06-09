/**
 * NotebookLM iframe内で動作するコンテンツスクリプト
 * オフスクリーンドキュメントとの通信を処理
 */

// デバッグ: このスクリプトが実行されていることを確認
console.log('[notebook-iframe.js] Script loaded in:', window.location.href);
console.log('[notebook-iframe.js] Is iframe:', window.parent !== window);

// オフスクリーンドキュメントからのメッセージを待機
window.addEventListener('message', async (event) => {
  console.log('[notebook-iframe.js] Received message:', event.data, 'from origin:', event.origin);
  
  // 拡張機能からのメッセージのみ処理
  if (event.data.type !== 'extensionRequest' && event.data.type !== 'extensionInit') {
    return;
  }
  
  console.log('[notebook-iframe.js] Processing message:', event.data);
  
  const { action, command, messageId } = event.data;
  let response = {};
  
  try {
    switch (action) {
      case 'getAudioInfo':
        response = await getAudioInfo();
        break;
        
      case 'controlAudio':
        response = await controlAudio(command);
        break;
        
      default:
        response = { error: 'Unknown action' };
    }
  } catch (error) {
    response = { error: error.message };
  }
  
  // レスポンスを送信
  event.source.postMessage({
    type: 'notebookLM',
    messageId: messageId,
    response: response
  }, event.origin);
});

/**
 * 音声情報を取得
 */
async function getAudioInfo() {
  try {
    // audio-overview要素を探す
    const audioOverview = document.querySelector('audio-overview');
    if (!audioOverview) {
      return { status: 'not_found' };
    }
    
    // 音声要素を探す
    const audioElement = findAudioElement();
    
    // 読み込みボタンを探す
    const loadButton = audioOverview.querySelector('div[role="button"][class*="load-audio"]');
    if (loadButton) {
      return { status: 'not_loaded', hasLoadButton: true };
    }
    
    // 生成中かチェック
    if (audioOverview.querySelector('.loading-phase-container')) {
      return { status: 'generating' };
    }
    
    // 再生ボタンを探す（複数のセレクターで試す）
    let playButton = audioOverview.querySelector('button[jslog*="229238"]');
    if (!playButton) {
      playButton = audioOverview.querySelector('button[aria-label*="再生"], button[aria-label*="Play"]');
    }
    
    // 生成ボタンを探す
    const generateButton = document.querySelector('button[aria-label*="生成"], button[aria-label*="Generate"]');
    if (generateButton && !playButton && !audioElement) {
      return { status: 'not_generated', hasGenerateButton: true };
    }
    
    // プレーヤーが存在する
    const audioPlayer = audioOverview.querySelector('.audio-player-wrapper');
    if (audioPlayer || (audioElement && audioElement.src)) {
      const audioInfo = {
        status: 'ready',
        hasPlayer: true,
        audioUrl: audioElement ? audioElement.src : null,
        currentTime: formatTime(audioElement?.currentTime || 0),
        duration: formatTime(audioElement?.duration || 0),
        isPlaying: audioElement ? !audioElement.paused : false
      };
      
      return audioInfo;
    }
    
    return { status: 'unknown' };
  } catch (error) {
    console.error('Error getting audio info:', error);
    return { status: 'error', error: error.message };
  }
}

/**
 * 音声を制御
 */
async function controlAudio(command) {
  try {
    const audioOverview = document.querySelector('audio-overview');
    if (!audioOverview) {
      return { success: false, error: 'Audio overview not found' };
    }
    
    switch (command) {
      case 'load': {
        // 読み込みボタンをクリック
        const loadButton = audioOverview.querySelector('div[role="button"][class*="load-audio"]');
        if (loadButton) {
          loadButton.click();
          return { success: true };
        }
        return { success: false, error: 'Load button not found' };
      }
        
      case 'generate': {
        // 生成ボタンをクリック
        const generateButton = document.querySelector('button[aria-label*="生成"], button[aria-label*="Generate"]');
        if (generateButton) {
          generateButton.click();
          return { success: true };
        }
        return { success: false, error: 'Generate button not found' };
      }
        
      case 'play': {
        // 再生ボタンをクリック
        const playButton = findPlayButton();
        if (playButton) {
          playButton.click();
          return { success: true };
        }
        
        // audio要素で直接制御
        const audioElement = findAudioElement();
        if (audioElement) {
          await audioElement.play();
          return { success: true };
        }
        return { success: false, error: 'Play button not found' };
      }
        
      case 'pause': {
        // 一時停止ボタンをクリック
        const pauseButton = findPauseButton();
        if (pauseButton) {
          pauseButton.click();
          return { success: true };
        }
        
        // audio要素で直接制御
        const audioElement = findAudioElement();
        if (audioElement) {
          audioElement.pause();
          return { success: true };
        }
        return { success: false, error: 'Pause button not found' };
      }
        
      default:
        return { success: false, error: 'Unknown command' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * audio要素を探す
 */
function findAudioElement() {
  // 複数の方法で探す
  let audioElement = document.querySelector('audio-overview audio');
  if (!audioElement) {
    audioElement = document.querySelector('audio[src*="blobstore"], audio[src*="blob:"]');
  }
  if (!audioElement) {
    audioElement = document.querySelector('audio');
  }
  return audioElement;
}

/**
 * 再生ボタンを探す
 */
function findPlayButton() {
  const audioOverview = document.querySelector('audio-overview');
  if (!audioOverview) return null;
  
  // 複数のセレクターで試す
  let playButton = audioOverview.querySelector('button[jslog*="229238"]');
  if (!playButton) {
    playButton = audioOverview.querySelector('button[aria-label*="再生"]');
  }
  if (!playButton) {
    playButton = audioOverview.querySelector('button[aria-label*="Play"]');
  }
  if (!playButton) {
    // アイコンで探す
    const playIcon = audioOverview.querySelector('svg path[d*="M8 5v14l11-7z"]');
    if (playIcon) {
      playButton = playIcon.closest('button');
    }
  }
  
  return playButton;
}

/**
 * 一時停止ボタンを探す
 */
function findPauseButton() {
  const audioOverview = document.querySelector('audio-overview');
  if (!audioOverview) return null;
  
  // 複数のセレクターで試す
  let pauseButton = audioOverview.querySelector('button[aria-label*="一時停止"]');
  if (!pauseButton) {
    pauseButton = audioOverview.querySelector('button[aria-label*="Pause"]');
  }
  if (!pauseButton) {
    // アイコンで探す
    const pauseIcon = audioOverview.querySelector('svg path[d*="M6 19h4V5H6v14zm8-14v14h4V5h-4z"]');
    if (pauseIcon) {
      pauseButton = pauseIcon.closest('button');
    }
  }
  
  return pauseButton;
}

/**
 * 時間をフォーマット
 */
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 初期化メッセージを送信
if (window.parent !== window) {
  console.log('[notebook-iframe.js] Sending initialization message to parent');
  window.parent.postMessage({
    type: 'notebookLM',
    status: 'initialized',
    location: window.location.href
  }, '*');
} else {
  console.log('[notebook-iframe.js] Not in iframe, skipping initialization message');
}

console.log('[notebook-iframe.js] Content script fully initialized');