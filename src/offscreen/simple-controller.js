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
    console.log('[simple-controller] Initialized');
  }

  /**
   * NotebookLMのタブを開く
   */
  async openNotebook(notebookUrl) {
    try {
      console.log('[simple-controller] Opening notebook:', notebookUrl);
      
      // バックグラウンドスクリプトにタブの作成を依頼
      const response = await chrome.runtime.sendMessage({
        action: 'createNotebookTab',
        url: notebookUrl,
        active: false
      });
      
      if (response && response.tabId) {
        this.tabId = response.tabId;
        console.log('[simple-controller] Tab created:', this.tabId);
        
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
          // すべてのコマンドをタブ内で実行（音声はタブ内で再生される）
          const controlResult = await simpleController.controlAudio(request.command);
          sendResponse(controlResult);
          break;
          
        case 'playAudioFromTab':
          const playResult = await simpleController.playAudioFromTab();
          sendResponse(playResult);
          break;
          
        case 'cleanup':
          await simpleController.cleanup();
          sendResponse({ success: true });
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