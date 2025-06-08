/**
 * タグデータの保存・読み込みを管理するモジュール
 * Chrome Storage APIのラッパー
 */

class TagStorage {
  constructor() {
    this.STORAGE_KEY = 'notebookTags';
    this.COLORS_KEY = 'tagColors';
    this.DEFAULT_COLORS = [
      '#FF6B6B', // 赤
      '#4ECDC4', // ターコイズ
      '#45B7D1', // 青
      '#FFA07A', // サーモン
      '#98D8C8', // ミント
      '#F7DC6F', // 黄
      '#BB8FCE', // 紫
      '#85C1E5', // スカイブルー
    ];
  }

  /**
   * すべてのタグデータを取得
   * @returns {Promise<Object>} タグデータ
   */
  async getAllTags() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || {};
    } catch (error) {
      console.error('Failed to load tags:', error);
      return {};
    }
  }

  /**
   * 特定のノートブックのタグを取得
   * @param {string} notebookId - ノートブックID
   * @returns {Promise<Array>} タグの配列
   */
  async getNotebookTags(notebookId) {
    const allTags = await this.getAllTags();
    return allTags[notebookId] || [];
  }

  /**
   * ノートブックにタグを追加
   * @param {string} notebookId - ノートブックID
   * @param {string} tagName - タグ名
   * @returns {Promise<boolean>} 成功時true
   */
  async addTag(notebookId, tagName) {
    try {
      // 入力検証
      if (!tagName || tagName.trim().length === 0) {
        throw new Error('タグ名が空です');
      }
      
      if (tagName.length > 20) {
        throw new Error('タグ名は20文字以内にしてください');
      }

      const allTags = await this.getAllTags();
      
      // ノートブックのタグ配列を初期化
      if (!allTags[notebookId]) {
        allTags[notebookId] = [];
      }
      
      // 重複チェック
      if (allTags[notebookId].includes(tagName.trim())) {
        throw new Error('このタグは既に追加されています');
      }
      
      // タグ数の制限（1つのノートブックに最大10個）
      if (allTags[notebookId].length >= 10) {
        throw new Error('タグは最大10個までです');
      }
      
      // タグを追加
      allTags[notebookId].push(tagName.trim());
      
      // 保存
      await chrome.storage.local.set({ [this.STORAGE_KEY]: allTags });
      
      // タグの色を自動割り当て
      await this.assignTagColor(tagName.trim());
      
      return true;
    } catch (error) {
      console.error('Failed to add tag:', error);
      throw error;
    }
  }

  /**
   * ノートブックからタグを削除
   * @param {string} notebookId - ノートブックID
   * @param {string} tagName - タグ名
   * @returns {Promise<boolean>} 成功時true
   */
  async removeTag(notebookId, tagName) {
    try {
      const allTags = await this.getAllTags();
      
      if (!allTags[notebookId]) {
        return false;
      }
      
      // タグを削除
      allTags[notebookId] = allTags[notebookId].filter(tag => tag !== tagName);
      
      // 空配列の場合はキーごと削除
      if (allTags[notebookId].length === 0) {
        delete allTags[notebookId];
      }
      
      // 保存
      await chrome.storage.local.set({ [this.STORAGE_KEY]: allTags });
      
      // このタグを使用している他のノートブックがない場合、色情報も削除
      await this.cleanupUnusedTagColors();
      
      return true;
    } catch (error) {
      console.error('Failed to remove tag:', error);
      return false;
    }
  }

  /**
   * すべてのユニークなタグを取得
   * @returns {Promise<Array>} ユニークなタグの配列
   */
  async getAllUniqueTags() {
    const allTags = await this.getAllTags();
    const uniqueTags = new Set();
    
    Object.values(allTags).forEach(tags => {
      tags.forEach(tag => uniqueTags.add(tag));
    });
    
    return Array.from(uniqueTags).sort();
  }

  /**
   * タグの使用統計を取得
   * @returns {Promise<Object>} タグ名をキー、使用回数を値とするオブジェクト
   */
  async getTagStatistics() {
    const allTags = await this.getAllTags();
    const statistics = {};
    
    Object.values(allTags).forEach(tags => {
      tags.forEach(tag => {
        statistics[tag] = (statistics[tag] || 0) + 1;
      });
    });
    
    return statistics;
  }

  /**
   * タグの色を取得
   * @returns {Promise<Object>} タグ名をキー、色コードを値とするオブジェクト
   */
  async getTagColors() {
    try {
      const result = await chrome.storage.local.get(this.COLORS_KEY);
      return result[this.COLORS_KEY] || {};
    } catch (error) {
      console.error('Failed to load tag colors:', error);
      return {};
    }
  }

  /**
   * タグに色を割り当て
   * @param {string} tagName - タグ名
   * @returns {Promise<string>} 割り当てられた色コード
   */
  async assignTagColor(tagName) {
    const colors = await this.getTagColors();
    
    // 既に色が割り当てられている場合
    if (colors[tagName]) {
      return colors[tagName];
    }
    
    // 使用されていない色を探す
    const usedColors = Object.values(colors);
    const availableColor = this.DEFAULT_COLORS.find(color => !usedColors.includes(color));
    
    // 利用可能な色がない場合はランダムに選択
    const selectedColor = availableColor || 
      this.DEFAULT_COLORS[Math.floor(Math.random() * this.DEFAULT_COLORS.length)];
    
    colors[tagName] = selectedColor;
    await chrome.storage.local.set({ [this.COLORS_KEY]: colors });
    
    return selectedColor;
  }

  /**
   * 使用されていないタグの色情報を削除
   */
  async cleanupUnusedTagColors() {
    const allTags = await this.getAllTags();
    const colors = await this.getTagColors();
    const usedTags = new Set();
    
    // 使用中のタグを収集
    Object.values(allTags).forEach(tags => {
      tags.forEach(tag => usedTags.add(tag));
    });
    
    // 使用されていない色を削除
    let updated = false;
    Object.keys(colors).forEach(tagName => {
      if (!usedTags.has(tagName)) {
        delete colors[tagName];
        updated = true;
      }
    });
    
    if (updated) {
      await chrome.storage.local.set({ [this.COLORS_KEY]: colors });
    }
  }

  /**
   * すべてのタグデータをクリア（デバッグ用）
   */
  async clearAllTags() {
    await chrome.storage.local.remove([this.STORAGE_KEY, this.COLORS_KEY]);
  }

  /**
   * タグデータのエクスポート
   * @returns {Promise<Object>} エクスポート用データ
   */
  async exportTags() {
    const tags = await this.getAllTags();
    const colors = await this.getTagColors();
    
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      tags,
      colors
    };
  }

  /**
   * タグデータのインポート
   * @param {Object} data - インポートするデータ
   * @returns {Promise<boolean>} 成功時true
   */
  async importTags(data) {
    try {
      if (!data.version || !data.tags) {
        throw new Error('無効なインポートデータです');
      }
      
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: data.tags,
        [this.COLORS_KEY]: data.colors || {}
      });
      
      return true;
    } catch (error) {
      console.error('Failed to import tags:', error);
      return false;
    }
  }
}

// シングルトンインスタンスをエクスポート
const tagStorage = new TagStorage();
export default tagStorage;