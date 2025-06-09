/**
 * シンプルなオフスクリーンコントローラー
 * iframeを使わずにタブを直接制御
 */

class SimpleOffscreenController {
  constructor() {
    this.tabId = null;
    this.audioPlayer = null;
  }

  /**
   * 初期化
   */
  initialize() {
    this.audioPlayer = document.getElementById('audio-player');
    this.userInteracted = false;
    console.log('[simple-controller] Initialized');
  }

  /**
   * NotebookLMのタブを開く
   */
  async openNotebook(notebookUrl) {
    try {
      console.log('[simple-controller] Opening notebook:', notebookUrl);
      
      // バックグラウンドスクリプトにタブの作成を依頼
      // バックグラウンドで作成（初回再生時にアクティブ化）
      const response = await chrome.runtime.sendMessage({
        action: 'createNotebookTab',
        url: notebookUrl,
        active: false, // バックグラウンドで作成
        pinned: false
      });
      
      if (response && response.tabId) {
        this.tabId = response.tabId;
        console.log('[simple-controller] Tab created in background:', this.tabId);
        
        // タブが完全に読み込まれるまで待つ
        await this.waitForTabReady(this.tabId);
        
        return { success: true, tabId: this.tabId };
      } else {
        throw new Error('Failed to create tab');
      }
    } catch (error) {
      console.error('[simple-controller] Error opening notebook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * タブが準備完了するまで待つ
   */
  async waitForTabReady(tabId) {
    console.log('[simple-controller] Waiting for tab to be ready...');
    
    const maxAttempts = 30; // 最大30秒待つ
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        // バックグラウンド経由でタブにpingを送信
        const response = await chrome.runtime.sendMessage({
          action: 'sendMessageToTab',
          tabId: tabId,
          message: { action: 'ping' }
        });
        if (response && response.success) {
          console.log('[simple-controller] Tab is ready');
          
          // さらに音声情報を取得して、ページが完全に読み込まれているか確認
          const audioInfo = await chrome.runtime.sendMessage({
            action: 'sendMessageToTab',
            tabId: tabId,
            message: { action: 'getAudioInfo' }
          });
          
          console.log('[simple-controller] Initial audio info:', audioInfo);
          
          // ページの準備ができるまでもう少し待つ
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          return true;
        }
      } catch (error) {
        // エラーは無視（コンテントスクリプトがまだ読み込まれていない）
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    console.warn('[simple-controller] Tab ready timeout');
    return false;
  }

  /**
   * タブの音声状態を確認
   */
  async checkTabAudioState() {
    if (!this.tabId) return null;
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getTabInfo',
        tabId: this.tabId
      });
      return response;
    } catch (error) {
      console.error('[simple-controller] Error checking tab audio state:', error);
      return null;
    }
  }

  /**
   * 音声情報を取得
   */
  async getAudioInfo() {
    if (!this.tabId) {
      return { status: 'error', error: 'No tab available' };
    }
    
    // タブがまだ存在するか確認
    const isValid = await this.validateTab();
    if (!isValid) {
      return { status: 'error', error: 'Tab no longer exists' };
    }
    
    try {
      console.log('[simple-controller] Getting audio info from tab:', this.tabId);
      
      // バックグラウンド経由でタブにメッセージを送信
      const response = await chrome.runtime.sendMessage({
        action: 'sendMessageToTab',
        tabId: this.tabId,
        message: { action: 'getAudioInfo' }
      });
      
      console.log('[simple-controller] Audio info:', response);
      return response || { status: 'error', error: 'No response' };
    } catch (error) {
      console.error('[simple-controller] Error getting audio info:', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * タブが有効か確認
   */
  async validateTab() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'validateTab',
        tabId: this.tabId
      });
      return response && response.valid;
    } catch (error) {
      console.error('[simple-controller] Tab validation error:', error);
      return false;
    }
  }

  /**
   * 音声を制御
   */
  async controlAudio(command) {
    if (!this.tabId) {
      return { success: false, error: 'No tab available' };
    }
    
    // タブがまだ存在するか確認
    const isValid = await this.validateTab();
    if (!isValid) {
      return { success: false, error: 'Tab no longer exists' };
    }
    
    try {
      console.log('[simple-controller] Controlling audio:', command);
      
      // バックグラウンド経由でタブにメッセージを送信
      const response = await chrome.runtime.sendMessage({
        action: 'sendMessageToTab',
        tabId: this.tabId,
        message: {
          action: 'controlAudio',
          command: command
        }
      });
      
      console.log('[simple-controller] Control response:', response);
      return response || { success: false, error: 'No response' };
    } catch (error) {
      console.error('[simple-controller] Error controlling audio:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 音声URLを取得して再生
   */
  async playAudioFromTab() {
    try {
      // まず音声情報を取得
      const audioInfo = await this.getAudioInfo();
      console.log('[simple-controller] Audio info for playback:', audioInfo);
      
      if (audioInfo.status === 'ready' && audioInfo.audioUrl) {
        // オフスクリーン内で音声を再生
        console.log('[simple-controller] Playing audio URL:', audioInfo.audioUrl);
        
        // Blob URLの場合、直接使用
        if (audioInfo.audioUrl.startsWith('blob:')) {
          // タブからBlob URLを取得して新しいBlob URLを作成
          const response = await chrome.runtime.sendMessage({
            action: 'fetchBlobFromTab',
            tabId: this.tabId,
            blobUrl: audioInfo.audioUrl
          });
          
          if (response && response.audioData) {
            // Base64データからBlobを作成
            const byteCharacters = atob(response.audioData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'audio/wav' });
            const newBlobUrl = URL.createObjectURL(blob);
            
            this.audioPlayer.src = newBlobUrl;
            await this.audioPlayer.play();
            
            // メモリリークを防ぐため、古いURLを解放
            setTimeout(() => {
              URL.revokeObjectURL(newBlobUrl);
            }, 60000);
          } else {
            // フォールバック：タブ内で再生
            const playResult = await this.controlAudio('play');
            return playResult;
          }
        } else {
          // 通常のURLの場合
          this.audioPlayer.src = audioInfo.audioUrl;
          await this.audioPlayer.play();
        }
        
        console.log('[simple-controller] Audio playback started');
        return { success: true };
      } else if (audioInfo.status === 'ready') {
        // 音声URLが取得できない場合は、タブ内で再生
        console.log('[simple-controller] No audio URL, playing in tab');
        const playResult = await this.controlAudio('play');
        return playResult;
      } else {
        return { success: false, error: `Audio not ready: ${audioInfo.status}` };
      }
    } catch (error) {
      console.error('[simple-controller] Error playing audio:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 再生コマンドを処理（タブ内で直接再生）
   */
  async handlePlayCommand() {
    try {
      // 音声情報を取得
      const audioInfo = await this.getAudioInfo();
      console.log('[simple-controller] Audio info:', audioInfo);
      
      if (audioInfo.status !== 'ready') {
        return { success: false, error: `Audio not ready: ${audioInfo.status}` };
      }
      
      // タブ内で音声を再生（コンテンツスクリプトの特権を利用）
      console.log('[simple-controller] Playing audio in tab directly');
      const controlResult = await this.controlAudio('play');
      
      if (controlResult.success) {
        console.log('[simple-controller] Audio playback started in tab');
        // タブを非表示にする（ユーザーには見えないが音声は継続）
        try {
          await chrome.runtime.sendMessage({
            action: 'hideTab',
            tabId: this.tabId
          });
        } catch (e) {
          console.log('[simple-controller] Tab hiding not supported');
        }
      }
      
      return controlResult;
    } catch (error) {
      console.error('[simple-controller] Error in handlePlayCommand:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * オフスクリーン内の音声を一時停止
   */
  pauseOffscreenAudio() {
    console.log('[simple-controller] Pausing offscreen audio');
    this.audioPlayer.pause();
  }
  
  /**
   * 音声イベントリスナーを設定
   */
  setupAudioEventListeners() {
    if (this.audioListenersSetup) return;
    
    this.audioPlayer.addEventListener('play', () => {
      console.log('[simple-controller] Offscreen audio playing');
    });
    
    this.audioPlayer.addEventListener('pause', () => {
      console.log('[simple-controller] Offscreen audio paused');
    });
    
    this.audioPlayer.addEventListener('ended', () => {
      console.log('[simple-controller] Offscreen audio ended');
    });
    
    this.audioPlayer.addEventListener('error', (e) => {
      console.error('[simple-controller] Offscreen audio error:', e);
    });
    
    // 進行状況の更新
    this.audioPlayer.addEventListener('timeupdate', () => {
      if (this.audioPlayer.duration > 0) {
        const progress = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
        if (progress % 5 < 0.1) { // 5%ごとにログ
          console.log(`[simple-controller] Playback progress: ${progress.toFixed(0)}%`);
        }
      }
    });
    
    this.audioListenersSetup = true;
  }

  /**
   * クリーンアップ
   */
  async cleanup() {
    if (this.tabId) {
      try {
        // バックグラウンド経由でタブを削除
        await chrome.runtime.sendMessage({
          action: 'removeTab',
          tabId: this.tabId
        });
        console.log('[simple-controller] Tab removed:', this.tabId);
      } catch (error) {
        console.error('[simple-controller] Error removing tab:', error);
      }
      this.tabId = null;
    }
    
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.src = '';
    }
  }
}

// グローバルインスタンス
let simpleController = null;

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  console.log('[simple-controller] DOM loaded, initializing...');
  if (!simpleController) {
    simpleController = new SimpleOffscreenController();
    simpleController.initialize();
  } else {
    console.log('[simple-controller] Already initialized');
  }
});

// メッセージハンドラー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[simple-controller] Received message:', request);
  
  if (request.target !== 'offscreen-simple') return;
  
  (async () => {
    try {
      switch (request.action) {
        case 'openNotebook':
          console.log('[simple-controller] Current tabId:', simpleController.tabId);
          const openResult = await simpleController.openNotebook(request.notebookUrl);
          console.log('[simple-controller] After open, tabId:', simpleController.tabId);
          sendResponse(openResult);
          break;
          
        case 'getAudioInfo':
          const audioInfo = await simpleController.getAudioInfo();
          sendResponse(audioInfo);
          break;
          
        case 'controlAudio':
          if (request.command === 'play') {
            // 再生の場合は特別な処理
            const playResult = await simpleController.handlePlayCommand();
            sendResponse(playResult);
          } else if (request.command === 'pause') {
            // 一時停止
            simpleController.pauseOffscreenAudio();
            sendResponse({ success: true });
          } else {
            // その他のコマンドはタブ内で実行
            const controlResult = await simpleController.controlAudio(request.command);
            sendResponse(controlResult);
          }
          break;
          
        case 'enableAudioContext':
          // ユーザーインタラクションフラグを設定
          simpleController.userInteracted = true;
          // 無音を再生してAudioContextを有効化
          if (simpleController.audioPlayer) {
            // 空のオーディオデータを作成
            const audioContext = new AudioContext();
            const buffer = audioContext.createBuffer(1, 1, 22050);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            
            try {
              // AudioContextを再開
              if (audioContext.state === 'suspended') {
                await audioContext.resume();
              }
              source.start();
              console.log('[simple-controller] AudioContext enabled');
              sendResponse({ success: true });
            } catch (error) {
              console.error('[simple-controller] Failed to enable AudioContext:', error.name, error.message);
              // フォールバック：単純にフラグを設定
              sendResponse({ success: true });
            }
          } else {
            sendResponse({ success: false, error: 'Audio player not initialized' });
          }
          break;
          
        case 'playAudioFromTab':
          const playResult = await simpleController.playAudioFromTab();
          sendResponse(playResult);
          break;
          
        case 'cleanup':
          await simpleController.cleanup();
          sendResponse({ success: true });
          break;
          
        case 'getTabId':
          sendResponse({ tabId: simpleController.tabId });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[simple-controller] Error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // 非同期レスポンス
});