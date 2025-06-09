/**
 * Offscreen document内のiframeを制御するコントローラー
 * chrome.scripting APIを使用してスクリプトを注入
 */

class IframeController {
  constructor(iframe) {
    this.iframe = iframe;
    this.isReady = false;
    this.scriptInjected = false;
  }

  /**
   * iframeの準備ができるまで待つ
   */
  async waitForReady() {
    if (this.isReady) return;
    
    console.log('[iframe-controller] Waiting for iframe to be ready...');
    
    // iframeが完全に読み込まれるまで待つ
    await new Promise((resolve) => {
      if (this.iframe.contentWindow) {
        // すでに読み込まれている場合
        resolve();
      } else {
        // loadイベントを待つ
        const onLoad = () => {
          this.iframe.removeEventListener('load', onLoad);
          resolve();
        };
        this.iframe.addEventListener('load', onLoad);
      }
    });
    
    // 少し待機（ページのJavaScriptが初期化されるまで）
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // スクリプトを注入
    if (!this.scriptInjected) {
      await this.injectScript();
    }
    
    this.isReady = true;
    console.log('[iframe-controller] Iframe is ready');
  }

  /**
   * iframeにスクリプトを注入
   */
  async injectScript() {
    console.log('[iframe-controller] Requesting script injection from background...');
    
    try {
      // バックグラウンドスクリプトに注入を依頼
      const response = await chrome.runtime.sendMessage({
        action: 'injectScriptToOffscreenIframe',
        iframeSrc: this.iframe.src
      });
      
      if (response && response.success) {
        console.log('[iframe-controller] Script injected successfully');
        this.scriptInjected = true;
        
        // スクリプトが初期化されるまで少し待つ
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.error('[iframe-controller] Failed to inject script:', response?.error);
        throw new Error('Script injection failed');
      }
    } catch (error) {
      console.error('[iframe-controller] Error injecting script:', error);
      throw error;
    }
  }

  /**
   * 音声情報を取得
   */
  async getAudioInfo() {
    await this.waitForReady();
    
    try {
      console.log('[iframe-controller] Requesting audio info from injected script...');
      
      // バックグラウンド経由でメッセージを送信
      const response = await chrome.runtime.sendMessage({
        action: 'sendToIframeScript',
        message: {
          target: 'iframe-injected',
          action: 'getAudioInfo'
        }
      });
      
      console.log('[iframe-controller] Audio info response:', response);
      return response || { status: 'error', error: 'No response' };
    } catch (error) {
      console.error('[iframe-controller] Error getting audio info:', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 音声を制御
   */
  async controlAudio(command) {
    await this.waitForReady();
    
    try {
      console.log('[iframe-controller] Sending control command:', command);
      
      // バックグラウンド経由でメッセージを送信
      const response = await chrome.runtime.sendMessage({
        action: 'sendToIframeScript',
        message: {
          target: 'iframe-injected',
          action: 'controlAudio',
          command: command
        }
      });
      
      console.log('[iframe-controller] Control response:', response);
      return response || { success: false, error: 'No response' };
    } catch (error) {
      console.error('[iframe-controller] Error controlling audio:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export for use in offscreen-controller.js
window.IframeController = IframeController;