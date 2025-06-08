/**
 * タグ管理のUIコンポーネント
 */

import tagStorage from '../../storage/tagStorage.js';

class TagManager {
  constructor() {
    this.tagFilterContainer = null;
    this.selectedTags = new Set();
    this.setupTagFilter();
  }

  /**
   * タグフィルターエリアのセットアップ
   */
  setupTagFilter() {
    // サイドパネルにタグフィルターエリアを追加
    const sidePanel = document.querySelector('.notebook-list-container');
    if (!sidePanel) return;

    this.tagFilterContainer = document.createElement('div');
    this.tagFilterContainer.className = 'tag-filter-container';
    
    // セキュリティ向上のため、DOM APIを使用して要素を作成
    const header = document.createElement('div');
    header.className = 'tag-filter-header';
    
    const label = document.createElement('span');
    label.textContent = '🏷️ タグフィルター';
    
    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-filter-btn';
    clearBtn.textContent = 'クリア';
    clearBtn.style.display = 'none';
    
    header.appendChild(label);
    header.appendChild(clearBtn);
    
    const chips = document.createElement('div');
    chips.className = 'tag-filter-chips';
    
    this.tagFilterContainer.appendChild(header);
    this.tagFilterContainer.appendChild(chips);

    sidePanel.insertBefore(this.tagFilterContainer, sidePanel.firstChild);
    this.updateTagFilter();

    // クリアボタンのイベントリスナー
    clearBtn.addEventListener('click', () => {
      this.selectedTags.clear();
      this.updateTagFilter();
      this.applyTagFilter();
    });
  }

  /**
   * タグフィルターの表示を更新
   */
  async updateTagFilter() {
    const chips = this.tagFilterContainer.querySelector('.tag-filter-chips');
    const clearBtn = this.tagFilterContainer.querySelector('.clear-filter-btn');
    const uniqueTags = await tagStorage.getAllUniqueTags();
    const tagColors = await tagStorage.getTagColors();

    chips.innerHTML = '';
    uniqueTags.forEach(tag => {
      const chip = document.createElement('div');
      chip.className = 'tag-chip' + (this.selectedTags.has(tag) ? ' selected' : '');
      chip.style.backgroundColor = tagColors[tag] || '#e0e0e0';
      chip.textContent = tag;
      
      chip.addEventListener('click', () => {
        if (this.selectedTags.has(tag)) {
          this.selectedTags.delete(tag);
        } else {
          this.selectedTags.add(tag);
        }
        this.updateTagFilter();
        this.applyTagFilter();
      });
      
      chips.appendChild(chip);
    });

    clearBtn.style.display = this.selectedTags.size > 0 ? 'block' : 'none';
  }

  /**
   * タグフィルターを適用
   */
  async applyTagFilter() {
    try {
      const notebooks = document.querySelectorAll('.notebook-item');
      if (this.selectedTags.size === 0) {
        notebooks.forEach(notebook => {
          notebook.style.display = 'block';
        });
        return;
      }

      const allTags = await tagStorage.getAllTags();
      notebooks.forEach(notebook => {
        const notebookId = notebook.dataset.notebookId;
        const notebookTags = allTags[notebookId] || [];
        
        // 選択されたタグをすべて含むノートブックのみ表示
        const hasAllTags = Array.from(this.selectedTags)
          .every(tag => notebookTags.includes(tag));
        
        notebook.style.display = hasAllTags ? 'block' : 'none';
      });
    } catch (error) {
      console.error('タグフィルターの適用に失敗しました:', error);
      // エラー時はすべて表示
      document.querySelectorAll('.notebook-item').forEach(notebook => {
        notebook.style.display = 'block';
      });
    }
  }

  /**
   * ノートブックアイテムにタグ管理UIを追加
   * @param {HTMLElement} notebookItem - ノートブックのDOM要素
   * @param {string} notebookId - ノートブックのID
   */
  async setupNotebookTags(notebookItem, notebookId) {
    // タグ表示エリアを作成
    const tagArea = document.createElement('div');
    tagArea.className = 'notebook-tags';
    
    // タグ追加ボタン
    const addButton = document.createElement('button');
    addButton.className = 'add-tag-btn';
    addButton.textContent = '➕ タグ追加';
    addButton.addEventListener('click', () => this.showTagInput(notebookId, tagArea));

    // タグエリアをノートブックアイテムに追加
    const controls = notebookItem.querySelector('.notebook-controls');
    controls.insertBefore(tagArea, controls.firstChild);
    controls.insertBefore(addButton, controls.firstChild);

    // 既存のタグを表示
    await this.updateNotebookTags(notebookId, tagArea);
  }

  /**
   * タグ入力UIを表示
   * @param {string} notebookId - ノートブックID
   * @param {HTMLElement} tagArea - タグ表示エリア
   */
  showTagInput(notebookId, tagArea) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tag-input';
    input.placeholder = 'タグ名を入力（20文字以内）';
    input.maxLength = 20;

    const addTag = async () => {
      const tagName = input.value.trim();
      if (tagName) {
        try {
          await tagStorage.addTag(notebookId, tagName);
          await this.updateNotebookTags(notebookId, tagArea);
          await this.updateTagFilter();
          input.remove();
        } catch (error) {
          alert(error.message);
        }
      }
    };

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addTag();
      }
    });

    input.addEventListener('blur', addTag);
    
    tagArea.insertBefore(input, tagArea.firstChild);
    input.focus();
  }

  /**
   * ノートブックのタグ表示を更新
   * @param {string} notebookId - ノートブックID
   * @param {HTMLElement} tagArea - タグ表示エリア
   */
  async updateNotebookTags(notebookId, tagArea) {
    const tags = await tagStorage.getNotebookTags(notebookId);
    const colors = await tagStorage.getTagColors();
    
    // 既存のタグを削除（入力フィールドは残す）
    Array.from(tagArea.children).forEach(child => {
      if (child.classList.contains('tag-chip')) {
        child.remove();
      }
    });

    // タグを追加
    tags.forEach(tag => {
      const chip = document.createElement('div');
      chip.className = 'tag-chip';
      chip.style.backgroundColor = colors[tag] || '#e0e0e0';
      
      const tagText = document.createElement('span');
      tagText.textContent = tag;
      chip.appendChild(tagText);

      // 削除ボタン
      const deleteBtn = document.createElement('span');
      deleteBtn.className = 'tag-delete';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`タグ「${tag}」を削除しますか？`)) {
          try {
            await tagStorage.removeTag(notebookId, tag);
            await this.updateNotebookTags(notebookId, tagArea);
            await this.updateTagFilter();
            // フィルター適用中の場合は再適用
            if (this.selectedTags.size > 0) {
              this.applyTagFilter();
            }
          } catch (error) {
            console.error('タグの削除に失敗しました:', error);
            alert('タグの削除に失敗しました');
          }
        }
      });
      chip.appendChild(deleteBtn);

      tagArea.appendChild(chip);
    });
  }
}

export default TagManager;