/**
 * バックグラウンドタブマネージャー
 * 音声生成や再生のためのタブを完全にバックグラウンドで管理
 */
class BackgroundTabManager {
  constructor() {
    this.hiddenTabs = new Map(); // tabId -> tabInfo
    this.currentActiveTab = null; // 現在のアクティブタブを記憶
  }

  /**
   * バックグラウンドでタブを作成・操作
   * @param {string} url - 開くURL
   * @param {string} notebookId - ノートブックID
   * @returns {number} タブID
   */
  async createBackgroundTab(url, notebookId) {
    try {
      // 現在のアクティブタブを記憶
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentActiveTab = activeTab?.id;

      // 新しいウィンドウをバックグラウンドで作成する方法
      // 1. 最小化された状態で作成
      const window = await chrome.windows.create({
        url: url,
        focused: false,
        state: 'minimized',
        width: 1,
        height: 1,
        left: -9999,
        top: -9999
      });

      const tab = window.tabs[0];
      
      // タブ情報を保存
      this.hiddenTabs.set(tab.id, {
        tabId: tab.id,
        windowId: window.id,
        notebookId: notebookId,
        createdAt: Date.now()
      });

      // 元のタブにフォーカスを戻す
      if (this.currentActiveTab) {
        await chrome.tabs.update(this.currentActiveTab, { active: true });
        await chrome.windows.update(activeTab.windowId, { focused: true });
      }

      return tab.id;
    } catch (error) {
      console.error('Failed to create background tab:', error);
      // フォールバック: 通常のタブを作成してバックグラウンドに
      return await this.createFallbackTab(url, notebookId);
    }
  }

  /**
   * フォールバック: 通常のタブをバックグラウンドで作成
   */
  async createFallbackTab(url, notebookId) {
    // 現在のアクティブタブを記憶
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // タブを作成（非アクティブ）
    const tab = await chrome.tabs.create({
      url: url,
      active: false,
      pinned: false,
      index: 9999 // 最後尾に配置
    });

    // タブ情報を保存
    this.hiddenTabs.set(tab.id, {
      tabId: tab.id,
      windowId: activeTab?.windowId,
      notebookId: notebookId,
      createdAt: Date.now(),
      isFallback: true
    });

    // 元のタブが非アクティブになった場合、再度アクティブに
    if (activeTab && !activeTab.active) {
      setTimeout(async () => {
        try {
          await chrome.tabs.update(activeTab.id, { active: true });
        } catch (e) {
          console.log('Failed to restore active tab:', e);
        }
      }, 100);
    }

    return tab.id;
  }

  /**
   * バックグラウンドタブでスクリプトを実行
   */
  async executeInBackgroundTab(tabId, func, args = []) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: func,
        args: args
      });
      return results[0]?.result;
    } catch (error) {
      console.error('Failed to execute script in background tab:', error);
      throw error;
    }
  }

  /**
   * バックグラウンドタブを削除
   */
  async removeBackgroundTab(tabId) {
    const tabInfo = this.hiddenTabs.get(tabId);
    if (!tabInfo) return;

    try {
      if (tabInfo.windowId && !tabInfo.isFallback) {
        // ウィンドウごと削除
        await chrome.windows.remove(tabInfo.windowId);
      } else {
        // タブのみ削除
        await chrome.tabs.remove(tabId);
      }
    } catch (error) {
      console.error('Failed to remove background tab:', error);
    }

    this.hiddenTabs.delete(tabId);
  }

  /**
   * すべてのバックグラウンドタブをクリーンアップ
   */
  async cleanup() {
    for (const [tabId] of this.hiddenTabs) {
      await this.removeBackgroundTab(tabId);
    }
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackgroundTabManager;
}