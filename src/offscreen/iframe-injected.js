/**
 * Offscreen内のiframeに注入されるスクリプト
 * バックグラウンドスクリプトから chrome.scripting.executeScript で注入される
 */

(function() {
  console.log('[iframe-injected] Script injected into NotebookLM iframe');
  
  // メッセージハンドラーを設定
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[iframe-injected] Received message:', request);
    
    if (request.target !== 'iframe-injected') return;
    
    switch (request.action) {
      case 'getAudioInfo':
        sendResponse(getAudioInfo());
        break;
        
      case 'controlAudio':
        controlAudio(request.command)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // 非同期レスポンス
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  });
  
  /**
   * 音声情報を取得
   */
  function getAudioInfo() {
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
      
      // 再生ボタンを探す
      const playButton = findPlayButton();
      
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
      console.error('[iframe-injected] Error getting audio info:', error);
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
          const loadButton = audioOverview.querySelector('div[role="button"][class*="load-audio"]');
          if (loadButton) {
            loadButton.click();
            return { success: true };
          }
          return { success: false, error: 'Load button not found' };
        }
          
        case 'generate': {
          const generateButton = document.querySelector('button[aria-label*="生成"], button[aria-label*="Generate"]');
          if (generateButton) {
            generateButton.click();
            return { success: true };
          }
          return { success: false, error: 'Generate button not found' };
        }
          
        case 'play': {
          const playButton = findPlayButton();
          if (playButton) {
            playButton.click();
            return { success: true };
          }
          
          const audioElement = findAudioElement();
          if (audioElement) {
            await audioElement.play();
            return { success: true };
          }
          return { success: false, error: 'Play button not found' };
        }
          
        case 'pause': {
          const pauseButton = findPauseButton();
          if (pauseButton) {
            pauseButton.click();
            return { success: true };
          }
          
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
    
    let playButton = audioOverview.querySelector('button[jslog*="229238"]');
    if (!playButton) {
      playButton = audioOverview.querySelector('button[aria-label*="再生"]');
    }
    if (!playButton) {
      playButton = audioOverview.querySelector('button[aria-label*="Play"]');
    }
    if (!playButton) {
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
    
    let pauseButton = audioOverview.querySelector('button[aria-label*="一時停止"]');
    if (!pauseButton) {
      pauseButton = audioOverview.querySelector('button[aria-label*="Pause"]');
    }
    if (!pauseButton) {
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
  
  // 初期化完了を通知
  chrome.runtime.sendMessage({
    from: 'iframe-injected',
    event: 'initialized',
    location: window.location.href
  });
})();