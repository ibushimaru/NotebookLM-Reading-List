/**
 * オフスクリーンAPIハンドラー
 * NotebookLMの操作をオフスクリーンドキュメントで実行
 */

// フィーチャーフラグを読み込み
import { FEATURES } from '../config/features.js';

class OffscreenHandler {
  constructor() {
    this.offscreenCreated = false;
    this.pendingRequests = new Map();
  }

  /**
   * オフスクリーンドキュメントを作成
   */
  async createOffscreen() {
    if (this.offscreenCreated) return;
    
    try {
      // 既存のオフスクリーンドキュメントがあるかチェック
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      
      if (existingContexts.length > 0) {
        this.offscreenCreated = true;
        return;
      }
      
      // オフスクリーンドキュメントを作成
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('src/offscreen/offscreen.html'),
        reasons: ['IFRAME_SCRIPTING', 'AUDIO_PLAYBACK', 'DOM_SCRAPING'],
        justification: 'NotebookLMをバックグラウンドで操作して音声を再生するため'
      });
      
      this.offscreenCreated = true;
      console.log('Offscreen document created');
    } catch (error) {
      console.error('Failed to create offscreen document:', error);
      throw error;
    }
  }

  /**
   * オフスクリーンドキュメントにメッセージを送信
   */
  async sendMessage(message) {
    await this.createOffscreen();
    
    return new Promise((resolve, reject) => {
      const messageId = Date.now().toString();
      
      // レスポンスハンドラーを登録
      this.pendingRequests.set(messageId, { resolve, reject });
      
      // メッセージを送信
      chrome.runtime.sendMessage({
        ...message,
        target: 'offscreen',
        messageId: messageId
      }, response => {
        if (chrome.runtime.lastError) {
          this.pendingRequests.delete(messageId);
          reject(new Error(chrome.runtime.lastError.message));
        }
      });
      
      // タイムアウト設定
      setTimeout(() => {
        if (this.pendingRequests.has(messageId)) {
          this.pendingRequests.delete(messageId);
          reject(new Error('Offscreen request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * NotebookLMページを読み込み
   */
  async loadNotebook(notebookUrl) {
    return await this.sendMessage({
      action: 'loadNotebook',
      notebookUrl: notebookUrl
    });
  }

  /**
   * 音声情報を取得
   */
  async getAudioInfo() {
    return await this.sendMessage({
      action: 'getAudioInfo'
    });
  }

  /**
   * 音声を制御
   */
  async controlAudio(command) {
    return await this.sendMessage({
      action: 'controlAudio',
      command: command
    });
  }

  /**
   * 音声を再生
   */
  async playAudio(audioUrl) {
    return await this.sendMessage({
      action: 'playAudio',
      audioUrl: audioUrl
    });
  }

  /**
   * 音声の状態を取得
   */
  async getAudioStatus() {
    return await this.sendMessage({
      action: 'getAudioStatus'
    });
  }

  /**
   * レスポンスを処理
   */
  handleResponse(messageId, response) {
    const pending = this.pendingRequests.get(messageId);
    if (pending) {
      this.pendingRequests.delete(messageId);
      if (response.success === false && response.error) {
        pending.reject(new Error(response.error));
      } else {
        pending.resolve(response);
      }
    }
  }
}

// シングルトンインスタンス
let offscreenHandler = null;

/**
 * オフスクリーンハンドラーを取得
 */
export function getOffscreenHandler() {
  if (!offscreenHandler) {
    offscreenHandler = new OffscreenHandler();
  }
  return offscreenHandler;
}

/**
 * フィーチャーフラグをチェックしてハンドラーを使用するか判定
 */
export function shouldUseOffscreen() {
  return FEATURES.USE_OFFSCREEN_API;
}

// メッセージリスナー（オフスクリーンからのレスポンス）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.from === 'offscreen' && message.messageId) {
    const handler = getOffscreenHandler();
    handler.handleResponse(message.messageId, message.response);
  }
});