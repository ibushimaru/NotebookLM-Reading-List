/**
 * タブグループマネージャー
 * 音声再生用のタブをグループ化して管理
 */
class TabGroupManager {
  constructor() {
    this.groupId = null;
    this.groupTitle = '📚 NotebookLM 音声';
    this.groupColor = 'blue';
  }

  /**
   * タブグループを作成または取得
   */
  async getOrCreateGroup() {
    try {
      // 既存のグループがあるかチェック
      if (this.groupId) {
        try {
          const group = await chrome.tabGroups.get(this.groupId);
          if (group) return this.groupId;
        } catch (e) {
          // グループが存在しない
          this.groupId = null;
        }
      }

      // 既存のグループを検索
      const groups = await chrome.tabGroups.query({});
      const existingGroup = groups.find(g => g.title === this.groupTitle);
      
      if (existingGroup) {
        this.groupId = existingGroup.id;
        return this.groupId;
      }

      // 新しいグループは後で作成（タブを追加する時）
      return null;
    } catch (error) {
      console.error('Failed to get or create tab group:', error);
      return null;
    }
  }

  /**
   * タブをグループに追加
   */
  async addTabToGroup(tabId) {
    try {
      let groupId = await this.getOrCreateGroup();
      
      // グループが存在しない場合は、タブをグループ化して新規作成
      if (!groupId) {
        groupId = await chrome.tabs.group({ tabIds: [tabId] });
        this.groupId = groupId;
        
        // グループの設定
        await chrome.tabGroups.update(groupId, {
          title: this.groupTitle,
          color: this.groupColor,
          collapsed: true  // グループを折りたたんで目立たなくする
        });
      } else {
        // 既存のグループに追加
        await chrome.tabs.group({ 
          tabIds: [tabId], 
          groupId: groupId 
        });
        
        // グループが展開されている場合は折りたたむ
        try {
          const group = await chrome.tabGroups.get(groupId);
          if (!group.collapsed) {
            await chrome.tabGroups.update(groupId, { collapsed: true });
          }
        } catch (e) {
          console.log('Failed to collapse group:', e);
        }
      }
      
      return groupId;
    } catch (error) {
      console.error('Failed to add tab to group:', error);
      return null;
    }
  }

  /**
   * グループを削除（空の場合）
   */
  async cleanupEmptyGroup() {
    if (!this.groupId) return;
    
    try {
      const tabs = await chrome.tabs.query({ groupId: this.groupId });
      if (tabs.length === 0) {
        // グループは自動的に削除される
        this.groupId = null;
      }
    } catch (error) {
      console.error('Failed to cleanup group:', error);
    }
  }

  /**
   * グループの表示/非表示を切り替え
   */
  async toggleGroupVisibility(show = false) {
    if (!this.groupId) return;
    
    try {
      await chrome.tabGroups.update(this.groupId, {
        collapsed: !show
      });
    } catch (error) {
      console.error('Failed to toggle group visibility:', error);
    }
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TabGroupManager;
}