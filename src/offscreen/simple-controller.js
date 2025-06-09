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
        await new Promise(resolve => setTimeout(resolve, 3000));
        
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
   * 音声情報を取得
   */
  async getAudioInfo() {
    if (!this.tabId) {
      return { status: 'error', error: 'No tab available' };
    }
    
    try {
      console.log('[simple-controller] Getting audio info from tab:', this.tabId);
      
      // タブに直接メッセージを送信（content.jsが期待する形式で）
      const response = await chrome.tabs.sendMessage(this.tabId, {
        action: 'getAudioInfo'
      });
      
      console.log('[simple-controller] Audio info:', response);
      return response || { status: 'error', error: 'No response' };
    } catch (error) {
      console.error('[simple-controller] Error getting audio info:', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 音声を制御
   */
  async controlAudio(command) {
    if (!this.tabId) {
      return { success: false, error: 'No tab available' };
    }
    
    try {
      console.log('[simple-controller] Controlling audio:', command);
      
      // タブに直接メッセージを送信（content.jsが期待する形式で）
      const response = await chrome.tabs.sendMessage(this.tabId, {
        action: 'controlAudio',
        command: command
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
      
      if (audioInfo.status === 'ready' && audioInfo.audioUrl) {
        // オフスクリーン内で音声を再生
        console.log('[simple-controller] Playing audio:', audioInfo.audioUrl);
        
        this.audioPlayer.src = audioInfo.audioUrl;
        await this.audioPlayer.play();
        
        return { success: true };
      } else {
        return { success: false, error: 'Audio not ready' };
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
        await chrome.tabs.remove(this.tabId);
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
  simpleController = new SimpleOffscreenController();
  simpleController.initialize();
});

// メッセージハンドラー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[simple-controller] Received message:', request);
  
  if (request.target !== 'offscreen-simple') return;
  
  (async () => {
    try {
      switch (request.action) {
        case 'openNotebook':
          const openResult = await simpleController.openNotebook(request.notebookUrl);
          sendResponse(openResult);
          break;
          
        case 'getAudioInfo':
          const audioInfo = await simpleController.getAudioInfo();
          sendResponse(audioInfo);
          break;
          
        case 'controlAudio':
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