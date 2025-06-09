/**
 * タブフォーカス管理
 * タブが意図せずアクティブになることを防ぐ
 */
class TabFocusManager {
  constructor() {
    this.userActiveTab = null;
    this.isManagingFocus = false;
  }

  /**
   * 初期化
   */
  initialize() {
    // タブがアクティブになったときの監視
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      if (this.isManagingFocus) return;
      
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        
        // NotebookLMの音声タブがアクティブになった場合
        if (tab.url && tab.url.includes('notebooklm.google.com') && 
            this.userActiveTab && this.userActiveTab !== activeInfo.tabId) {
          
          // タブグループに属しているかチェック
          if (tab.groupId && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
            const group = await chrome.tabGroups.get(tab.groupId);
            
            // 音声再生用のグループの場合
            if (group.title === '📚 NotebookLM 音声') {
              this.isManagingFocus = true;
              
              // 元のタブに即座にフォーカスを戻す
              await chrome.tabs.update(this.userActiveTab, { active: true });
              
              // グループを折りたたむ
              await chrome.tabGroups.update(tab.groupId, { collapsed: true });
              
              this.isManagingFocus = false;
            }
          }
        } else if (!tab.url?.includes('notebooklm.google.com')) {
          // ユーザーが意図的に別のタブを開いた
          this.userActiveTab = activeInfo.tabId;
        }
      } catch (error) {
        console.error('Focus management error:', error);
        this.isManagingFocus = false;
      }
    });
  }

  /**
   * 現在のアクティブタブを記録
   */
  async recordCurrentActiveTab() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        this.userActiveTab = activeTab.id;
      }
    } catch (error) {
      console.error('Failed to record active tab:', error);
    }
  }

  /**
   * フォーカスを元のタブに戻す
   */
  async restoreFocus() {
    if (this.userActiveTab) {
      try {
        await chrome.tabs.update(this.userActiveTab, { active: true });
      } catch (error) {
        console.error('Failed to restore focus:', error);
      }
    }
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TabFocusManager;
}