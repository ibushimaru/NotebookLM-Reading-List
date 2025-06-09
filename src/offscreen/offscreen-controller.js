/**
 * NotebookLMをオフスクリーンで制御するコントローラー
 */
class NotebookLMController {
  constructor() {
    this.iframe = null;
    this.audioPlayer = null;
    this.currentNotebook = null;
    this.messageHandlers = new Map();
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
      if (event.data.type === 'notebookLM') {
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
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    `;
    
    document.body.appendChild(this.iframe);
    
    // iframeの読み込みを待つ
    return new Promise((resolve, reject) => {
      this.iframe.onload = async () => {
        console.log('Iframe loaded');
        
        // コンテンツスクリプトを注入
        try {
          await this.injectContentScript();
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      this.iframe.onerror = () => {
        reject(new Error('Failed to load iframe'));
      };
      
      // タイムアウト設定
      setTimeout(() => {
        reject(new Error('Iframe load timeout'));
      }, 30000);
    });
  }

  /**
   * iframeにコンテンツスクリプトを注入
   */
  async injectContentScript() {
    console.log('Injecting content script into iframe');
    
    // iframe の window にアクセスできない（クロスオリジン）ため、
    // chrome.scripting API を使用する必要がある
    // ただし、オフスクリーンドキュメントからは制限がある
    
    // 代替案: postMessage を使った通信
    this.iframe.contentWindow.postMessage({
      type: 'extensionInit',
      action: 'initialize'
    }, 'https://notebooklm.google.com');
  }

  /**
   * 音声情報を取得
   */
  async getAudioInfo() {
    return new Promise((resolve) => {
      const messageId = Date.now().toString();
      
      // レスポンスハンドラーを登録
      this.messageHandlers.set(messageId, resolve);
      
      // iframeにメッセージを送信
      this.iframe.contentWindow.postMessage({
        type: 'extensionRequest',
        action: 'getAudioInfo',
        messageId: messageId
      }, 'https://notebooklm.google.com');
      
      // タイムアウト設定
      setTimeout(() => {
        if (this.messageHandlers.has(messageId)) {
          this.messageHandlers.delete(messageId);
          resolve({ status: 'timeout' });
        }
      }, 5000);
    });
  }

  /**
   * 音声を制御
   * @param {string} command - 'play', 'pause', 'load', 'generate'
   */
  async controlAudio(command) {
    return new Promise((resolve) => {
      const messageId = Date.now().toString();
      
      // レスポンスハンドラーを登録
      this.messageHandlers.set(messageId, resolve);
      
      // iframeにメッセージを送信
      this.iframe.contentWindow.postMessage({
        type: 'extensionRequest',
        action: 'controlAudio',
        command: command,
        messageId: messageId
      }, 'https://notebooklm.google.com');
      
      // タイムアウト設定
      setTimeout(() => {
        if (this.messageHandlers.has(messageId)) {
          this.messageHandlers.delete(messageId);
          resolve({ success: false, error: 'timeout' });
        }
      }, 10000);
    });
  }

  /**
   * iframeからのメッセージを処理
   */
  handleIframeMessage(data) {
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