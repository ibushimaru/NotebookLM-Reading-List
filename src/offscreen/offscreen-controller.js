/**
 * NotebookLMをオフスクリーンで制御するコントローラー
 */
class NotebookLMController {
  constructor() {
    this.iframe = null;
    this.iframeController = null;
    this.audioPlayer = null;
    this.currentNotebook = null;
    this.messageHandlers = new Map();
    this.iframeInitialized = false;
  }

  /**
   * 初期化
   */
  initialize() {
    // オーディオプレーヤーを作成
    this.audioPlayer = document.getElementById('audio-player');
    
    // メッセージリスナーを設定
    this.setupMessageListeners();
    
    console.log('NotebookLMController initialized');
  }

  /**
   * メッセージリスナーの設定
   */
  setupMessageListeners() {
    // iframe からのメッセージを受信
    window.addEventListener('message', (event) => {
      console.log('[offscreen-controller] Received message:', event.data, 'from:', event.origin);
      
      if (event.data.type === 'notebookLM') {
        console.log('[offscreen-controller] Processing NotebookLM message');
        this.handleIframeMessage(event.data);
      }
    });
  }

  /**
   * NotebookLMページをiframeで読み込み
   * @param {string} notebookUrl - NotebookLMのURL
   */
  async loadNotebook(notebookUrl) {
    console.log('Loading notebook:', notebookUrl);
    
    // 既存のiframeを削除
    if (this.iframe) {
      this.iframe.remove();
    }
    
    // 新しいiframeを作成
    this.iframe = document.createElement('iframe');
    this.iframe.id = 'notebook-iframe';
    this.iframe.src = notebookUrl;
    this.iframe.style.cssText = `
      position: absolute;
      top: -9999px;
      left: -9999px;
      width: 1024px;
      height: 768px;
      opacity: 0.01;
      pointer-events: none;
    `;
    
    // デバッグ用: iframeを表示
    if (window.location.search.includes('debug=true')) {
      this.iframe.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 400px;
        height: 300px;
        opacity: 1;
        border: 2px solid red;
        z-index: 9999;
      `;
    }
    
    document.body.appendChild(this.iframe);
    console.log('Iframe created and appended');
    
    // IframeControllerを作成
    this.iframeController = new IframeController(this.iframe);
    
    // iframeの読み込みを待つ
    return new Promise((resolve, reject) => {
      let loaded = false;
      
      this.iframe.onload = async () => {
        if (loaded) return; // 重複実行を防ぐ
        loaded = true;
        
        console.log('Iframe loaded, URL:', this.iframe.src);
        
        // IframeControllerの準備を待つ
        try {
          await this.iframeController.waitForReady();
          console.log('IframeController ready');
          resolve();
        } catch (error) {
          console.error('IframeController initialization failed:', error);
          reject(error);
        }
      };
      
      this.iframe.onerror = (error) => {
        console.error('Iframe error:', error);
        reject(new Error('Failed to load iframe'));
      };
      
      // タイムアウト設定
      setTimeout(() => {
        if (!loaded) {
          console.error('Iframe load timeout');
          reject(new Error('Iframe load timeout'));
        }
      }, 30000);
    });
  }

  /**
   * iframeにコンテンツスクリプトを注入（削除）
   * IframeControllerを使用するため不要
   */
  async injectContentScript() {
    // 何もしない - IframeControllerが直接DOM操作を行う
    console.log('Using IframeController for iframe control');
  }

  /**
   * 音声情報を取得
   */
  async getAudioInfo() {
    if (!this.iframeController) {
      console.error('[offscreen-controller] No iframe controller available');
      return { status: 'error', error: 'No iframe controller' };
    }
    
    try {
      console.log('[offscreen-controller] Getting audio info via IframeController');
      const audioInfo = await this.iframeController.getAudioInfo();
      console.log('[offscreen-controller] Audio info received:', audioInfo);
      return audioInfo;
    } catch (error) {
      console.error('[offscreen-controller] Error getting audio info:', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 音声を制御
   * @param {string} command - 'play', 'pause', 'load', 'generate'
   */
  async controlAudio(command) {
    if (!this.iframeController) {
      console.error('[offscreen-controller] No iframe controller available');
      return { success: false, error: 'No iframe controller' };
    }
    
    try {
      console.log('[offscreen-controller] Controlling audio via IframeController:', command);
      const result = await this.iframeController.controlAudio(command);
      console.log('[offscreen-controller] Control result:', result);
      return result;
    } catch (error) {
      console.error('[offscreen-controller] Error controlling audio:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * iframeからのメッセージを処理
   */
  handleIframeMessage(data) {
    console.log('[offscreen-controller] Handling iframe message:', data);
    
    // 初期化メッセージの処理
    if (data.status === 'initialized') {
      console.log('[offscreen-controller] Iframe initialized at:', data.location);
      this.iframeInitialized = true;
      return;
    }
    
    const { messageId, response } = data;
    
    if (messageId && this.messageHandlers.has(messageId)) {
      const handler = this.messageHandlers.get(messageId);
      this.messageHandlers.delete(messageId);
      handler(response);
    }
  }

  /**
   * 音声を再生（オフスクリーン内で）
   * @param {string} audioUrl - 音声のURL
   */
  async playAudio(audioUrl) {
    console.log('Playing audio:', audioUrl);
    
    if (!this.audioPlayer) {
      throw new Error('Audio player not initialized');
    }
    
    // Blob URLの場合は、fetchして新しいBlob URLを作成
    if (audioUrl.startsWith('blob:')) {
      try {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const newUrl = URL.createObjectURL(blob);
        
        // 古いURLを解放
        setTimeout(() => {
          URL.revokeObjectURL(newUrl);
        }, 60000);
        
        audioUrl = newUrl;
      } catch (error) {
        console.error('Failed to fetch blob URL:', error);
        throw error;
      }
    }
    
    this.audioPlayer.src = audioUrl;
    await this.audioPlayer.play();
  }

  /**
   * 音声を一時停止
   */
  pauseAudio() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
    }
  }

  /**
   * 音声の状態を取得
   */
  getAudioStatus() {
    if (!this.audioPlayer) {
      return { isPlaying: false, currentTime: '00:00', duration: '00:00', progress: 0 };
    }
    
    return {
      isPlaying: !this.audioPlayer.paused,
      currentTime: this.formatTime(this.audioPlayer.currentTime),
      duration: this.formatTime(this.audioPlayer.duration),
      progress: this.audioPlayer.duration ? 
        (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100 : 0
    };
  }

  /**
   * 時間をフォーマット
   */
  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.src = '';
    }
    
    this.messageHandlers.clear();
  }
}

// グローバルインスタンス
let controller = null;

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing NotebookLMController...');
  controller = new NotebookLMController();
  controller.initialize();
  console.log('NotebookLMController initialized');
  
  // 初期化を通知
  chrome.runtime.sendMessage({
    from: 'offscreen',
    event: 'initialized',
    controller: 'NotebookLMController'
  });
});

// メッセージハンドラー（バックグラウンドからの通信）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Offscreen controller received:', request);
  
  if (request.target !== 'offscreen') {
    console.log('Message not for offscreen controller');
    return;
  }
  
  (async () => {
    try {
      console.log('Processing action:', request.action);
      
      switch (request.action) {
        case 'loadNotebook':
          await controller.loadNotebook(request.notebookUrl);
          sendResponse({ success: true });
          break;
          
        case 'getAudioInfo':
          const audioInfo = await controller.getAudioInfo();
          sendResponse(audioInfo);
          break;
          
        case 'controlAudio':
          const result = await controller.controlAudio(request.command);
          sendResponse(result);
          break;
          
        case 'playAudio':
          await controller.playAudio(request.audioUrl);
          sendResponse({ success: true });
          break;
          
        case 'pauseAudio':
          controller.pauseAudio();
          sendResponse({ success: true });
          break;
          
        case 'getAudioStatus':
          const status = controller.getAudioStatus();
          sendResponse(status);
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // 非同期レスポンスのため
});