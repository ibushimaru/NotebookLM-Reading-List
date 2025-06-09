// サイドパネルのメインスクリプト

let notebooks = [];
let filteredNotebooks = [];
let activeFilters = new Set();

// DOM要素
const notebooksContainer = document.getElementById('notebooks-container');
const searchInput = document.getElementById('search-input');
const iconFilters = document.getElementById('icon-filters');
const refreshBtn = document.getElementById('refresh-btn');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadNotebooks();
  setupEventListeners();
});

// イベントリスナーの設定
function setupEventListeners() {
  searchInput.addEventListener('input', handleSearch);
  refreshBtn.addEventListener('click', refreshNotebooks);
  
  // バックグラウンドからのメッセージを受信
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateNotebooks') {
      notebooks = request.data;
      updateDisplay();
    } else if (request.action === 'audioProgressUpdate') {
      // 音声進行状況の更新を処理
      handleAudioProgressUpdate(request.data, request.tabId);
    } else if (request.action === 'tabRemoved') {
      // タブが削除された場合の処理
      handleTabRemoved(request.tabId, request.notebookId);
    }
  });
}

// ノートブックの読み込み
async function loadNotebooks() {
  try {
    // ストレージから既存のデータを読み込み
    const result = await chrome.storage.local.get(['notebooks']);
    if (result.notebooks) {
      notebooks = result.notebooks;
      updateDisplay();
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error('Failed to load notebooks:', error);
    showEmptyState();
  }
}

// ノートブックの更新
function refreshNotebooks() {
  // 回転アニメーション
  refreshBtn.classList.add('rotating');
  
  // NotebookLMのタブを取得してコンテントスクリプトをリロード
  chrome.tabs.query({ url: 'https://notebooklm.google.com/*' }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.reload(tabs[0].id);
    } else {
      // NotebookLMを新しいタブで開く
      chrome.tabs.create({ url: 'https://notebooklm.google.com' });
    }
  });
  
  setTimeout(() => {
    refreshBtn.classList.remove('rotating');
  }, 1000);
}

// 検索処理
function handleSearch() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  filterNotebooks(searchTerm);
}

// フィルタリング
function filterNotebooks(searchTerm = '') {
  filteredNotebooks = notebooks.filter(notebook => {
    const matchesSearch = !searchTerm || 
      notebook.title.toLowerCase().includes(searchTerm);
    
    const matchesIconFilter = activeFilters.size === 0 || 
      activeFilters.has(notebook.icon);
    
    return matchesSearch && matchesIconFilter;
  });
  
  renderNotebooks();
}

// 表示更新
function updateDisplay() {
  // データをストレージに保存
  chrome.storage.local.set({ notebooks });
  
  // アイコンフィルターを更新
  updateIconFilters();
  
  // フィルタリングと表示
  filterNotebooks();
}

// アイコンフィルターの更新
function updateIconFilters() {
  const icons = new Map();
  
  notebooks.forEach(notebook => {
    if (notebook.icon) {
      const count = icons.get(notebook.icon) || 0;
      icons.set(notebook.icon, count + 1);
    }
  });
  
  iconFilters.innerHTML = '';
  
  icons.forEach((count, icon) => {
    const filterBtn = document.createElement('button');
    filterBtn.className = 'icon-filter';
    filterBtn.innerHTML = `
      <span class="icon-filter-emoji">${icon}</span>
      <span>${count}</span>
    `;
    
    filterBtn.addEventListener('click', () => toggleIconFilter(icon, filterBtn));
    iconFilters.appendChild(filterBtn);
  });
}

// アイコンフィルターの切り替え
function toggleIconFilter(icon, button) {
  if (activeFilters.has(icon)) {
    activeFilters.delete(icon);
    button.classList.remove('active');
  } else {
    activeFilters.add(icon);
    button.classList.add('active');
  }
  
  filterNotebooks(searchInput.value.toLowerCase().trim());
}

// ノートブックの表示
function renderNotebooks() {
  if (filteredNotebooks.length === 0) {
    showEmptyState();
    return;
  }
  
  notebooksContainer.innerHTML = '';
  
  filteredNotebooks.forEach(notebook => {
    const item = createNotebookItem(notebook);
    notebooksContainer.appendChild(item);
  });
}

// ノートブックアイテムの作成
function createNotebookItem(notebook) {
  const item = document.createElement('div');
  item.className = 'notebook-item';
  item.setAttribute('data-notebook-id', notebook.id);
  
  const iconHtml = notebook.icon ? 
    `<div class="notebook-icon notebook-emoji">${notebook.icon}</div>` : 
    `<div class="notebook-icon" style="background-color: #e0e0e0;"></div>`;
  
  item.innerHTML = `
    ${iconHtml}
    <div class="notebook-content">
      <div class="notebook-title">${notebook.title}</div>
      <div class="notebook-subtitle">${notebook.sourceCount || 0} 個のソース</div>
      <div class="notebook-actions">
        <button class="action-btn" data-action="open" data-id="${notebook.id}">開く</button>
        <button class="action-btn primary" data-action="audio" data-id="${notebook.id}">音声概要</button>
      </div>
    </div>
  `;
  
  // アクションボタンのイベント
  item.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleAction(btn.dataset.action, btn.dataset.id);
    });
  });
  
  // アイテムクリックで開く
  item.addEventListener('click', () => {
    if (notebook.url) {
      chrome.tabs.create({ url: notebook.url });
    }
  });
  
  return item;
}

// アクション処理
async function handleAction(action, notebookId) {
  const notebook = notebooks.find(n => n.id === notebookId);
  if (!notebook) return;
  
  switch (action) {
    case 'open':
      if (notebook.url) {
        chrome.tabs.create({ url: notebook.url });
      }
      break;
    
    case 'audio':
      await handleAudioAction(notebook);
      break;
  }
}

// 音声概要の処理
async function handleAudioAction(notebook) {
  try {
    // 既存のインラインプレーヤーがあるかチェック
    const existingControl = document.querySelector(`[data-notebook-id="${notebook.id}"]`);
    if (existingControl) {
      // 既存のプレーヤーにフォーカス（スクロール）
      existingControl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      // 一時的にハイライト
      existingControl.classList.add('highlight');
      setTimeout(() => existingControl.classList.remove('highlight'), 1000);
      return;
    }
    
    // 統計セッションを開始
    const sessionId = await startStatsSession(notebook);
    
    // Show loading indicator
    showLoadingIndicator(notebook);
    
    // Request a tab from the pool
    const poolResponse = await chrome.runtime.sendMessage({
      action: 'getPooledTab',
      notebookId: notebook.id,
      notebookUrl: notebook.url
    });
    
    if (!poolResponse.success) {
      throw new Error(poolResponse.error || 'Failed to get tab from pool');
    }
    
    const tabId = poolResponse.tabId;
    
    // Check if we have cached audio info from the pool
    if (poolResponse.cachedAudioInfo) {
      hideLoadingIndicator(notebook);
      
      if (poolResponse.cachedAudioInfo.status === 'generating') {
        showGeneratingDialog(notebook, tabId);
      } else if (poolResponse.cachedAudioInfo.audioUrl) {
        showInlineAudioPlayer(notebook, poolResponse.cachedAudioInfo);
      } else {
        showAudioControlDialog(notebook, poolResponse.cachedAudioInfo, tabId);
      }
      return;
    }
    
    // Prepare the audio tab
    await prepareAudioTab(notebook, tabId);
    
  } catch (error) {
    console.error('Audio action error:', error);
    hideLoadingIndicator(notebook);
    alert('音声概要の取得に失敗しました: ' + error.message);
  }
}

// タブが生きているか確認
async function isTabAlive(tabId) {
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

// 音声タブを準備（プールされたタブを使用）
async function prepareAudioTab(notebook, tabId) {
  try {
    // タブの準備ができていることを確認（プールされたタブは既に準備済みのはず）
    await waitForContentScript(tabId, 5); // タイムアウトを短縮
    
    // バックグラウンドでタブを操作（アクティブにしない）
    // await chrome.tabs.update(tabId, { active: true });
    // await new Promise(resolve => setTimeout(resolve, 500));
    
    // 音声情報を取得
    const audioInfo = await sendMessageToTab(tabId, { action: 'getAudioInfo' });
    
    if (!audioInfo) {
      throw new Error('音声情報の取得に失敗しました');
    }
    
    switch (audioInfo.status) {
      case 'not_loaded':
        // 読み込みボタンをクリック
        await sendMessageToTab(tabId, { action: 'controlAudio', command: 'load' });
        
        // すぐにプレーヤーの存在を確認（タイムアウトを短く）
        let retries = 0;
        let loadedInfo = null;
        
        while (retries < 20) { // 最大10秒
          await new Promise(resolve => setTimeout(resolve, 500));
          loadedInfo = await sendMessageToTab(tabId, { action: 'getAudioInfo' });
          
          if (loadedInfo.status === 'ready' && loadedInfo.hasPlayer) {
            break;
          }
          retries++;
        }
        
        if (loadedInfo && loadedInfo.status === 'ready') {
          // Cache audio info in the tab pool
          chrome.runtime.sendMessage({
            action: 'cacheAudioInfo',
            tabId: tabId,
            audioInfo: loadedInfo
          });
          
          hideLoadingIndicator(notebook);
          
          // タブは既に非アクティブなのでそのまま
          
          if (loadedInfo.audioUrl) {
            // URLがある場合はタブをプールに戻してインライン再生
            chrome.runtime.sendMessage({
              action: 'releaseTab',
              tabId: tabId,
              autoClose: true
            });
            showInlineAudioPlayer(notebook, loadedInfo);
          } else {
            // URLがない場合はタブを保持してコントロール
            showAudioControlDialog(notebook, loadedInfo, tabId);
          }
        } else if (loadedInfo && loadedInfo.status === 'not_generated') {
          hideLoadingIndicator(notebook);
          showGenerateAudioDialog(notebook, tabId);
        } else {
          hideLoadingIndicator(notebook);
          chrome.runtime.sendMessage({
            action: 'releaseTab',
            tabId: tabId
          });
          alert('音声の読み込みに失敗しました。');
        }
        break;
        
      case 'not_generated':
        hideLoadingIndicator(notebook);
        // 自動的に生成を開始
        const genResult = await sendMessageToTab(tabId, { 
          action: 'controlAudio', 
          command: 'generate' 
        });
        
        if (genResult.success) {
          // バックグラウンドで生成を監視
          showGeneratingDialogWithAutoCheck(notebook, tabId);
        } else {
          showGenerateAudioDialog(notebook, tabId);
        }
        break;
        
      case 'generating':
        hideLoadingIndicator(notebook);
        // Cache the generating status
        chrome.runtime.sendMessage({
          action: 'cacheAudioInfo',
          tabId: tabId,
          audioInfo: { status: 'generating' }
        });
        showGeneratingDialogWithAutoCheck(notebook, tabId);
        break;
        
      case 'ready':
        // Cache audio info in the tab pool
        chrome.runtime.sendMessage({
          action: 'cacheAudioInfo',
          tabId: tabId,
          audioInfo: audioInfo
        });
        
        hideLoadingIndicator(notebook);
        
        if (audioInfo.audioUrl) {
          chrome.runtime.sendMessage({
            action: 'releaseTab',
            tabId: tabId
          });
          showInlineAudioPlayer(notebook, audioInfo);
        } else if (audioInfo.hasPlayer) {
          showAudioControlDialog(notebook, audioInfo, tabId);
        } else {
          showAudioDialog(notebook, audioInfo, tabId);
        }
        break;
        
      default:
        hideLoadingIndicator(notebook);
        // 自動的に生成を開始
        const genResult2 = await sendMessageToTab(tabId, { 
          action: 'controlAudio', 
          command: 'generate' 
        });
        
        if (genResult2.success) {
          showGeneratingDialog(notebook, tabId);
        } else {
          showGenerateAudioDialog(notebook, tabId);
        }
    }
    hideLoadingIndicator(notebook);
    
  } catch (error) {
    console.error('Audio preparation error:', error);
    
    // Release the tab back to the pool instead of closing it
    if (tabId) {
      chrome.runtime.sendMessage({
        action: 'releaseTab',
        tabId: tabId
      });
    }
    
    hideLoadingIndicator(notebook);
    throw error; // Re-throw to be handled by handleAudioAction
  }
}

// コンテントスクリプトが準備できるまで待つ
async function waitForContentScript(tabId, maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response) {
        return true;
      }
    } catch (e) {
      // まだ準備できていない
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Content script not ready');
}

// タブにメッセージを送信（エラーハンドリング付き）
async function sendMessageToTab(tabId, message) {
  try {
    // タブが存在するか確認
    await chrome.tabs.get(tabId);
    
    // コンテントスクリプトを再注入（必要な場合）
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
      if (error.message.includes('Could not establish connection')) {
        // コンテントスクリプトを再注入
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['src/content/content.js']
        });
        
        // 少し待ってから再試行
        await new Promise(resolve => setTimeout(resolve, 500));
        return await chrome.tabs.sendMessage(tabId, message);
      }
      throw error;
    }
  } catch (error) {
    console.error('Failed to send message to tab:', error);
    throw error;
  }
}

// 音声情報をキャッシュに保存
async function cacheAudioInfo(notebookId, audioInfo) {
  const cache = await chrome.storage.local.get(['audioCache']) || {};
  if (!cache.audioCache) cache.audioCache = {};
  
  cache.audioCache[notebookId] = {
    audioUrl: audioInfo.audioUrl,
    title: audioInfo.title,
    duration: audioInfo.duration,
    cachedAt: Date.now()
  };
  
  await chrome.storage.local.set({ audioCache: cache.audioCache });
}

// キャッシュから音声情報を取得
async function getCachedAudioInfo(notebookId) {
  const cache = await chrome.storage.local.get(['audioCache']);
  if (!cache.audioCache) return null;
  
  const cachedInfo = cache.audioCache[notebookId];
  if (!cachedInfo) return null;
  
  // キャッシュが3時間以内のものを使用（保持時間を延長）
  if (Date.now() - cachedInfo.cachedAt > 3 * 3600000) {
    return null;
  }
  
  return cachedInfo;
}

// 音声プレーヤーダイアログを表示
function showAudioDialog(notebook, audioInfo, tabId) {
  // 既存のダイアログを削除
  const existingDialog = document.getElementById('audio-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }
  
  const dialog = document.createElement('div');
  dialog.id = 'audio-dialog';
  dialog.className = 'audio-dialog';
  dialog.innerHTML = `
    <div class="audio-dialog-content">
      <div class="audio-dialog-header">
        <h3>${notebook.title}</h3>
        <button class="audio-dialog-close" id="close-audio-dialog">×</button>
      </div>
      <div class="audio-dialog-body">
        <div class="audio-info">
          <div class="audio-duration">${audioInfo.currentTime} / ${audioInfo.duration}</div>
        </div>
        <div class="audio-controls-panel">
          <button class="audio-control-btn" id="play-pause-btn">
            ${audioInfo.isPlaying ? '⏸️ 一時停止' : '▶️ 再生'}
          </button>
          <button class="audio-control-btn secondary" id="download-btn">
            💾 ダウンロード
          </button>
          <button class="audio-control-btn secondary" id="open-in-tab-btn">
            タブで開く
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // イベントリスナー
  document.getElementById('close-audio-dialog').addEventListener('click', () => {
    dialog.remove();
    // タブを削除（autoCloseフラグで削除）
    if (tabId) {
      chrome.runtime.sendMessage({ 
        action: 'releaseTab', 
        tabId: tabId,
        autoClose: true
      });
    }
  });
  
  document.getElementById('play-pause-btn').addEventListener('click', async () => {
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'controlAudio', 
      command: audioInfo.isPlaying ? 'pause' : 'play' 
    });
    
    if (response.success) {
      audioInfo.isPlaying = !audioInfo.isPlaying;
      document.getElementById('play-pause-btn').textContent = 
        audioInfo.isPlaying ? '⏸️ 一時停止' : '▶️ 再生';
    }
  });
  
  document.getElementById('download-btn').addEventListener('click', async () => {
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'controlAudio', 
      command: 'download' 
    });
    
    if (response.success) {
      // 一時的に成功メッセージを表示
      const btn = document.getElementById('download-btn');
      const originalText = btn.textContent;
      btn.textContent = '✅ ダウンロード完了';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    } else {
      alert('ダウンロードに失敗しました: ' + (response.message || 'エラー'));
    }
  });
  
  document.getElementById('open-in-tab-btn').addEventListener('click', () => {
    chrome.tabs.update(tabId, { active: true });
    dialog.remove();
  });
}

// 音声生成中ダイアログを表示（自動チェック付き）
function showGeneratingDialogWithAutoCheck(notebook, tabId) {
  // 既存のダイアログを削除
  const existingDialog = document.getElementById('audio-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }
  
  const dialog = document.createElement('div');
  dialog.id = 'audio-dialog';
  dialog.className = 'audio-dialog';
  dialog.innerHTML = `
    <div class="audio-dialog-content">
      <div class="audio-dialog-header">
        <h3>${notebook.title}</h3>
        <button class="audio-dialog-close" id="close-audio-dialog">×</button>
      </div>
      <div class="audio-dialog-body">
        <div class="audio-info">
          <div class="loading-spinner" style="margin: 0 auto;"></div>
          <p style="margin-top: 16px;">音声概要を生成中...</p>
          <p style="font-size: 12px; color: #5f6368; margin-top: 8px;">
            バックグラウンドで生成しています。<br>
            完了したら自動的に表示されます。
          </p>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // イベントリスナー
  const closeButton = document.getElementById('close-audio-dialog');
  let checkInterval;
  
  const cleanup = () => {
    if (checkInterval) clearInterval(checkInterval);
    dialog.remove();
    if (tabId) {
      chrome.runtime.sendMessage({ 
        action: 'releaseTab', 
        tabId: tabId,
        autoClose: true
      });
    }
  };
  
  closeButton.addEventListener('click', cleanup);
  
  // 生成完了を定期的にチェック
  let checkCount = 0;
  checkInterval = setInterval(async () => {
    checkCount++;
    
    try {
      const audioInfo = await chrome.tabs.sendMessage(tabId, { action: 'getAudioInfo' });
      
      if (audioInfo.status === 'ready') {
        clearInterval(checkInterval);
        dialog.remove();
        
        // 音声情報をキャッシュ
        chrome.runtime.sendMessage({
          action: 'cacheAudioInfo',
          tabId: tabId,
          audioInfo: audioInfo
        });
        
        if (audioInfo.audioUrl) {
          chrome.runtime.sendMessage({
            action: 'releaseTab',
            tabId: tabId
          });
          showInlineAudioPlayer(notebook, audioInfo);
        } else {
          showAudioControlDialog(notebook, audioInfo, tabId);
        }
      } else if (checkCount > 60) { // 3分後にタイムアウト
        clearInterval(checkInterval);
        dialog.remove();
        chrome.runtime.sendMessage({
          action: 'releaseTab',
          tabId: tabId
        });
        alert('音声概要の生成がタイムアウトしました。');
      }
    } catch (error) {
      console.error('Error checking audio status:', error);
      if (error.message && error.message.includes('context invalidated')) {
        cleanup();
      }
    }
  }, 3000); // 3秒ごとにチェック
}

// 音声生成中ダイアログを表示（手動確認用）
function showGeneratingDialog(notebook, tabId) {
  // 既存のダイアログを削除
  const existingDialog = document.getElementById('audio-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }
  
  const dialog = document.createElement('div');
  dialog.id = 'audio-dialog';
  dialog.className = 'audio-dialog';
  dialog.innerHTML = `
    <div class="audio-dialog-content">
      <div class="audio-dialog-header">
        <h3>${notebook.title}</h3>
        <button class="audio-dialog-close" id="close-audio-dialog">×</button>
      </div>
      <div class="audio-dialog-body">
        <div class="audio-info">
          <div class="loading-spinner" style="margin: 0 auto;"></div>
          <p style="margin-top: 16px;">音声概要を生成中...</p>
          <p style="font-size: 12px; color: #5f6368; margin-top: 8px;">
            これには数分かかることがあります。<br>
            数分後に再度「音声概要」ボタンをクリックしてください。
          </p>
        </div>
        <div class="audio-controls-panel">
          <button class="audio-control-btn secondary" id="open-in-tab-btn">
            タブで開いて確認
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // イベントリスナー
  document.getElementById('close-audio-dialog').addEventListener('click', () => {
    dialog.remove();
    // タブを削除（autoCloseフラグで削除）
    if (tabId) {
      chrome.runtime.sendMessage({ 
        action: 'releaseTab', 
        tabId: tabId,
        autoClose: true
      });
    }
  });
  
  document.getElementById('open-in-tab-btn').addEventListener('click', () => {
    chrome.tabs.update(tabId, { active: true });
    dialog.remove();
  });
}

// 音声概要生成ダイアログを表示
function showGenerateAudioDialog(notebook, tabId) {
  const dialog = document.createElement('div');
  dialog.id = 'audio-dialog';
  dialog.className = 'audio-dialog';
  dialog.innerHTML = `
    <div class="audio-dialog-content">
      <div class="audio-dialog-header">
        <h3>${notebook.title}</h3>
        <button class="audio-dialog-close" id="close-audio-dialog">×</button>
      </div>
      <div class="audio-dialog-body">
        <p>音声概要の生成に失敗しました。</p>
        <div class="audio-controls-panel">
          <button class="audio-control-btn primary" id="generate-audio-btn">
            🎙️ 音声概要を生成
          </button>
          <button class="audio-control-btn secondary" id="open-in-tab-btn">
            タブで開く
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // イベントリスナー
  document.getElementById('close-audio-dialog').addEventListener('click', () => {
    dialog.remove();
    // タブを削除（autoCloseフラグで削除）
    if (tabId) {
      chrome.runtime.sendMessage({ 
        action: 'releaseTab', 
        tabId: tabId,
        autoClose: true
      });
    }
  });
  
  document.getElementById('generate-audio-btn').addEventListener('click', async () => {
    // 生成ボタンをクリック
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'controlAudio', 
      command: 'generate' 
    });
    
    if (response.success) {
      // バックグラウンドで生成を開始
      dialog.innerHTML = `
        <div class="audio-dialog-content">
          <div class="audio-dialog-header">
            <h3>${notebook.title}</h3>
            <button class="audio-dialog-close" id="close-audio-dialog">×</button>
          </div>
          <div class="audio-dialog-body">
            <div class="audio-info">
              <div class="loading-spinner" style="margin: 0 auto;"></div>
              <p style="margin-top: 16px;">音声概要を生成中...</p>
              <p style="font-size: 12px; color: #5f6368; margin-top: 8px;">
                バックグラウンドで生成しています。<br>
                しばらくお待ちください...
              </p>
            </div>
          </div>
        </div>
      `;
      
      // 新しい閉じるボタンにイベントリスナーを追加
      document.getElementById('close-audio-dialog').addEventListener('click', () => {
        dialog.remove();
        if (tabId) {
          chrome.runtime.sendMessage({ action: 'releaseTab', tabId });
        }
      });
      
      // 生成完了を定期的にチェック
      let checkCount = 0;
      const checkInterval = setInterval(async () => {
        checkCount++;
        
        try {
          const audioInfo = await chrome.tabs.sendMessage(tabId, { action: 'getAudioInfo' });
          
          if (audioInfo.status === 'ready') {
            clearInterval(checkInterval);
            dialog.remove();
            
            // 音声情報をキャッシュ
            chrome.runtime.sendMessage({
              action: 'cacheAudioInfo',
              tabId: tabId,
              audioInfo: audioInfo
            });
            
            if (audioInfo.audioUrl) {
              chrome.runtime.sendMessage({
                action: 'releaseTab',
                tabId: tabId
              });
              showInlineAudioPlayer(notebook, audioInfo);
            } else {
              showAudioControlDialog(notebook, audioInfo, tabId);
            }
          } else if (checkCount > 60) { // 3分後にタイムアウト
            clearInterval(checkInterval);
            dialog.remove();
            chrome.runtime.sendMessage({
              action: 'releaseTab',
              tabId: tabId,
              autoClose: true
            });
            alert('音声概要の生成がタイムアウトしました。');
          }
        } catch (error) {
          console.error('Error checking audio status:', error);
        }
      }, 3000); // 3秒ごとにチェック
    } else {
      alert('音声概要の生成に失敗しました。\nNotebookLMのページで直接生成してください。');
    }
  });
  
  document.getElementById('open-in-tab-btn').addEventListener('click', () => {
    chrome.tabs.update(tabId, { active: true });
    dialog.remove();
  });
}

// Loading indicator functions
function showLoadingIndicator(notebook) {
  const notebookItem = document.querySelector(`[data-notebook-id="${notebook.id}"]`);
  if (notebookItem) {
    const audioBtn = notebookItem.querySelector('[data-action="audio"]');
    if (audioBtn) {
      audioBtn.disabled = true;
      audioBtn.innerHTML = '<span class="loading-spinner"></span>読み込み中...';
    }
  }
}

function hideLoadingIndicator(notebook) {
  const notebookItem = document.querySelector(`[data-notebook-id="${notebook.id}"]`);
  if (notebookItem) {
    const audioBtn = notebookItem.querySelector('[data-action="audio"]');
    if (audioBtn) {
      audioBtn.disabled = false;
      audioBtn.innerHTML = '音声概要';
    }
  }
}

// 空の状態表示
function showEmptyState() {
  notebooksContainer.innerHTML = `
    <div class="empty-state">
      <p>ノートブックが見つかりません</p>
      <button class="action-btn primary" id="open-notebooklm-btn">
        NotebookLMを開く
      </button>
    </div>
  `;
  
  // イベントリスナーを追加
  const openBtn = document.getElementById('open-notebooklm-btn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://notebooklm.google.com' });
    });
  }
}

// インライン音声プレーヤーを表示
async function showInlineAudioPlayer(notebook, audioInfo) {
  // 既存のプレーヤーを削除
  const existingPlayer = document.getElementById(`audio-player-${notebook.id}`);
  if (existingPlayer) {
    existingPlayer.remove();
  }
  
  // 他のアクティブな音声を非アクティブに
  document.querySelectorAll('.active-audio').forEach(el => {
    el.classList.remove('active-audio');
  });
  
  // ノートブックアイテムを探す
  const notebookItem = document.querySelector(`[data-notebook-id="${notebook.id}"]`);
  if (!notebookItem) return;
  
  // プレーヤーを作成
  const player = document.createElement('div');
  player.id = `audio-player-${notebook.id}`;
  player.className = 'inline-audio-player active-audio';
  player.innerHTML = `
    <div class="audio-player-controls">
      <button class="audio-play-btn" data-playing="false">
        <span class="play-icon">▶️</span>
        <span class="pause-icon" style="display: none;">⏸️</span>
      </button>
      <div class="audio-progress-container">
        <div class="audio-progress-bar">
          <div class="audio-progress-fill" style="transform: scaleX(0.01)">
            <div class="audio-progress-thumb"></div>
          </div>
        </div>
        <div class="audio-time">
          <span class="current-time">00:00</span> / <span class="duration">${audioInfo.duration || '00:00'}</span>
        </div>
      </div>
      <button class="audio-close-btn" title="閉じる">×</button>
    </div>
  `;
  
  // ノートブックアイテムの後に挿入
  notebookItem.insertAdjacentElement('afterend', player);
  
  // イベントリスナーを設定
  setupInlinePlayerEvents(player, notebook, audioInfo);
  
  // Offscreenドキュメントで音声を準備
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'fetchAndPlay',
    audioUrl: audioInfo.audioUrl,
    title: notebook.title
  });
  
  // 自動的に一時停止（ユーザーがクリックするまで再生しない）
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'pause'
  });
}

// インラインプレーヤーのイベント設定
function setupInlinePlayerEvents(player, notebook, audioInfo) {
  const playBtn = player.querySelector('.audio-play-btn');
  const closeBtn = player.querySelector('.audio-close-btn');
  const progressBar = player.querySelector('.audio-progress-bar');
  const progressFill = player.querySelector('.audio-progress-fill');
  const currentTimeSpan = player.querySelector('.current-time');
  
  // 再生/一時停止ボタン
  playBtn.addEventListener('click', async () => {
    const isPlaying = playBtn.dataset.playing === 'true';
    
    if (isPlaying) {
      await chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'pause'
      });
    } else {
      await chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'play',
        audioUrl: audioInfo.audioUrl,
        title: notebook.title
      });
      
      // 再生開始時は他のアクティブな音声を非アクティブに
      document.querySelectorAll('.active-audio').forEach(el => {
        if (el !== player) {
          el.classList.remove('active-audio');
        }
      });
      player.classList.add('active-audio');
    }
    
    playBtn.dataset.playing = !isPlaying;
    updatePlayButton(playBtn, !isPlaying);
  });
  
  // 閉じるボタン
  closeBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'pause'
    });
    player.remove();
  });
  
  // プログレスバーのクリック（シーク機能）
  progressBar.addEventListener('click', async (e) => {
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    
    // 即座にUIを更新
    const progressFill = player.querySelector('.audio-progress-fill');
    if (progressFill) {
      progressFill.style.transform = `scaleX(${Math.max(percentage / 100, 0.01)})`;
    }
    
    // Offscreenドキュメントにシークリクエストを送信
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'seek',
      percentage: percentage
    });
  });
  
  // プログレスバーのホバー効果（シーク可能であることを示す）
  progressBar.style.cursor = 'pointer';
  progressBar.title = 'クリックでシーク';
}

// 再生ボタンの表示を更新
function updatePlayButton(button, isPlaying) {
  const playIcon = button.querySelector('.play-icon');
  const pauseIcon = button.querySelector('.pause-icon');
  
  if (isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'inline';
  } else {
    playIcon.style.display = 'inline';
    pauseIcon.style.display = 'none';
  }
}

// Offscreenからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.from === 'offscreen') {
    switch (request.event) {
      case 'timeupdate':
        updateAudioProgress(request.data);
        break;
      case 'ended':
        resetAllPlayButtons();
        break;
    }
  }
});

// 音声の進行状況を更新
function updateAudioProgress(data) {
  const players = document.querySelectorAll('.inline-audio-player');
  players.forEach(player => {
    const progressFill = player.querySelector('.audio-progress-fill');
    const currentTimeSpan = player.querySelector('.current-time');
    const durationSpan = player.querySelector('.duration');
    
    if (progressFill) {
      // 最小幅を考慮した進行状況の計算
      const progress = data.progress || 0;
      const scaleX = Math.max(progress / 100, 0.01); // 最小値を確保
      progressFill.style.transform = `scaleX(${scaleX})`;
    }
    if (currentTimeSpan) {
      currentTimeSpan.textContent = data.currentTime;
    }
    if (durationSpan && data.duration) {
      durationSpan.textContent = data.duration;
    }
  });
}

// すべての再生ボタンをリセット
function resetAllPlayButtons() {
  const playBtns = document.querySelectorAll('.audio-play-btn');
  playBtns.forEach(btn => {
    btn.dataset.playing = 'false';
    updatePlayButton(btn, false);
  });
}

// 音声コントロールをインライン表示（URLが取得できない場合）
function showAudioControlDialog(notebook, audioInfo, tabId) {
  // 既存のプレーヤーを削除
  const existingPlayer = document.getElementById(`audio-control-${notebook.id}`);
  if (existingPlayer) {
    existingPlayer.remove();
  }
  
  // 既存のコントロールが多すぎる場合は古いものを削除
  const allControls = document.querySelectorAll('.inline-audio-player');
  if (allControls.length >= 5) {
    // 最も古いコントロールを削除
    allControls[0].remove();
  }
  
  // 他のアクティブな音声を非アクティブに
  document.querySelectorAll('.active-audio').forEach(el => {
    el.classList.remove('active-audio');
  });
  
  // ノートブックアイテムを探す
  const notebookItem = document.querySelector(`[data-notebook-id="${notebook.id}"]`);
  if (!notebookItem) return;
  
  // インラインコントロールを作成
  const control = document.createElement('div');
  control.id = `audio-control-${notebook.id}`;
  control.className = 'inline-audio-player active-audio';
  control.dataset.tabId = tabId;
  control.setAttribute('data-tab-id', tabId);
  control.setAttribute('data-notebook-id', notebook.id);
  
  // 現在の再生時間情報を計算
  const progress = audioInfo.duration ? 
    ((parseTime(audioInfo.currentTime) / parseTime(audioInfo.duration)) * 100) : 0;
  
  control.innerHTML = `
    <div class="audio-player-controls">
      <button class="audio-play-btn" data-playing="${audioInfo.isPlaying || false}">
        <span class="play-icon" ${audioInfo.isPlaying ? 'style="display: none;"' : ''}>▶️</span>
        <span class="pause-icon" ${!audioInfo.isPlaying ? 'style="display: none;"' : ''}>⏸️</span>
      </button>
      <div class="audio-progress-container">
        <div class="audio-progress-bar">
          <div class="audio-progress-fill" style="transform: scaleX(${Math.max(progress / 100, 0.01)})">
            <div class="audio-progress-thumb"></div>
          </div>
        </div>
        <div class="audio-time">
          <span class="current-time">${audioInfo.currentTime || '00:00'}</span> / <span class="duration">${audioInfo.duration || '00:00'}</span>
        </div>
      </div>
      <button class="audio-tab-btn" title="NotebookLMで表示">🔗</button>
      <button class="audio-close-btn" title="閉じる">×</button>
    </div>
  `;
  
  // ノートブックアイテムの後に挿入
  notebookItem.insertAdjacentElement('afterend', control);
  
  // イベントリスナーを設定
  setupInlineControlEvents(control, notebook, audioInfo, tabId);
  
  // 初回の音声準備（バックグラウンドで音声を準備）
  setTimeout(async () => {
    try {
      // バックグラウンドで音声を準備（アクティブにしない）
      // await chrome.tabs.update(tabId, { active: true });
      
      // 音声の準備を試みる
      // setTimeout(() => {
      //   chrome.tabs.update(tabId, { active: false });
      // }, 1000);
      
      // 音声情報を再取得
      const updatedInfo = await sendMessageToTab(tabId, { action: 'getAudioInfo' });
      if (updatedInfo && updatedInfo.status === 'ready') {
        updateInlineControlProgress(control, updatedInfo);
      }
    } catch (error) {
      console.error('Failed to prepare audio:', error);
    }
  }, 500);
  
  // 定期的に音声情報を更新（再生状態の確認のみ）
  console.log('Setting up update interval for control:', control.id);
  const updateInterval = setInterval(async () => {
    try {
      // コントロールが削除されたら更新を停止
      if (!document.body.contains(control)) {
        clearInterval(updateInterval);
        return;
      }
      
      const info = await sendMessageToTab(tabId, { action: 'getAudioInfo' });
      if (info && info.status === 'ready') {
        // 再生状態の変化を検出
        const playBtn = control.querySelector('.audio-play-btn');
        const wasPlaying = playBtn && playBtn.dataset.playing === 'true';
        
        console.log('Update check - wasPlaying:', wasPlaying, 'isPlaying:', info.isPlaying);
        
        if (info.isPlaying !== wasPlaying) {
          // 再生状態が変わった場合
          updateInlineControlProgress(control, info);
          
          if (control._simulation) {
            if (info.isPlaying) {
              // 再生開始 - 擬似カウントアップ開始
              control._simulation.lastKnownTime = control._simulation.timeToSeconds(info.currentTime);
              control._simulation.lastKnownDuration = control._simulation.timeToSeconds(info.duration);
              control._simulation.start();
            } else {
              // 一時停止 - 擬似カウントアップ停止
              control._simulation.stop();
              updateInlineControlProgress(control, info);
            }
          }
        }
        
        // 再生中でない場合のみ通常の更新
        if (!info.isPlaying) {
          updateInlineControlProgress(control, info);
        }
      }
    } catch (error) {
      // 接続エラーの場合は静かに失敗（タブが閉じられた可能性）
      if (!error.message.includes('Could not establish connection') && 
          !error.message.includes('Extension context invalidated')) {
        console.error('Failed to update audio info:', error);
      }
      clearInterval(updateInterval);
      
      // タブが閉じられた場合はコントロールも削除
      if (error.message.includes('No tab with id')) {
        if (control._simulation) {
          control._simulation.stop();
        }
        // エラーメッセージを表示
        const errorMsg = document.createElement('div');
        errorMsg.className = 'audio-notice';
        errorMsg.textContent = '音声タブが閉じられました。再度「音声概要」ボタンをクリックしてください。';
        control.appendChild(errorMsg);
        
        // 3秒後にコントロールを削除
        setTimeout(() => {
          control.remove();
        }, 3000);
      }
    }
  }, 2000); // 2秒ごとに状態確認（擬似カウントアップ中は頻繁な更新不要）
}

// 時間フォーマット関数
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// インラインコントロールのイベント設定
function setupInlineControlEvents(control, notebook, audioInfo, tabId) {
  const playBtn = control.querySelector('.audio-play-btn');
  const closeBtn = control.querySelector('.audio-close-btn');
  const tabBtn = control.querySelector('.audio-tab-btn');
  const progressBar = control.querySelector('.audio-progress-bar');
  
  // 擬似的なカウントアップ用の変数と関数をオブジェクトにまとめる
  const simulation = {
    animationId: null,
    lastUpdateTime: null,
    lastKnownTime: 0,
    lastKnownDuration: 0,
    lastDisplayedSecond: 0,
    
    // 時間を秒に変換
    timeToSeconds(timeStr) {
      if (!timeStr) return 0;
      const parts = timeStr.split(':').map(p => parseInt(p) || 0);
      return parts[0] * 60 + parts[1];
    },
    
    // 擬似的なカウントアップを開始
    start() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
      
      this.lastUpdateTime = performance.now();
      this.lastDisplayedSecond = Math.floor(this.lastKnownTime);
      
      // DOM要素を最初に一度だけ取得
      const progressFill = control.querySelector('.audio-progress-fill');
      const currentTimeSpan = control.querySelector('.current-time');
      
      const animate = (currentTime) => {
        if (!this.animationId) return;
        
        // 前回の更新からの経過時間を計算
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // ミリ秒を秒に変換
        this.lastUpdateTime = currentTime;
        
        // 時間を更新
        this.lastKnownTime += deltaTime;
        
        if (this.lastKnownTime > this.lastKnownDuration && this.lastKnownDuration > 0) {
          this.lastKnownTime = this.lastKnownDuration;
          this.stop();
          return;
        }
        
        // 時間表示を更新（秒が変わった時のみ）
        const currentSecond = Math.floor(this.lastKnownTime);
        if (currentTimeSpan && currentSecond !== this.lastDisplayedSecond) {
          currentTimeSpan.textContent = formatTime(this.lastKnownTime);
          this.lastDisplayedSecond = currentSecond;
        }
        
        // プログレスバーを更新（transformでGPUアクセラレーション）
        if (progressFill && this.lastKnownDuration > 0) {
          const progress = this.lastKnownTime / this.lastKnownDuration;
          const scaleX = Math.max(progress, 0.01); // 最小値を確保
          progressFill.style.transform = `scaleX(${scaleX})`;
        }
        
        // 次のフレームをリクエスト
        this.animationId = requestAnimationFrame(animate);
      };
      
      this.animationId = requestAnimationFrame(animate);
      console.log('Simulation started with requestAnimationFrame');
    },
    
    // 擬似的なカウントアップを停止
    stop() {
      console.log('Stopping simulation');
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    }
  };
  
  // 再生/一時停止ボタン
  playBtn.addEventListener('click', async () => {
    const isPlaying = playBtn.dataset.playing === 'true';
    
    try {
      console.log('Sending control command:', isPlaying ? 'pause' : 'play');
      const response = await sendMessageToTab(tabId, { 
        action: 'controlAudio', 
        command: isPlaying ? 'pause' : 'play' 
      });
      
      console.log('Control response:', response);
      
      if (response && response.success) {
        playBtn.dataset.playing = !isPlaying;
        updatePlayButton(playBtn, !isPlaying);
        
        if (!isPlaying) {
          // 再生開始時
          document.querySelectorAll('.active-audio').forEach(el => {
            if (el !== control) {
              el.classList.remove('active-audio');
            }
          });
          control.classList.add('active-audio');
          
          // 即座に擬似カウントアップを開始（前回の値から）
          simulation.start();
          
          // 並行して実際の音声情報を取得
          setTimeout(async () => {
            const info = await sendMessageToTab(tabId, { action: 'getAudioInfo' });
            console.log('Audio info received:', info);
            if (info && info.status === 'ready') {
              // 実際の値で補正
              simulation.lastKnownTime = simulation.timeToSeconds(info.currentTime);
              simulation.lastKnownDuration = simulation.timeToSeconds(info.duration);
              console.log('Time values corrected:', {
                currentTime: info.currentTime,
                duration: info.duration,
                currentSeconds: simulation.lastKnownTime,
                durationSeconds: simulation.lastKnownDuration
              });
            }
          }, 300); // 300msで補正
        } else {
          // 一時停止時
          simulation.stop();
          
          // 実際の値と同期（即座に）
          const info = await sendMessageToTab(tabId, { action: 'getAudioInfo' });
          if (info && info.status === 'ready') {
            updateInlineControlProgress(control, info);
            simulation.lastKnownTime = simulation.timeToSeconds(info.currentTime);
            simulation.lastKnownDuration = simulation.timeToSeconds(info.duration);
          }
        }
      }
    } catch (error) {
      console.error('Failed to control audio:', error);
    }
  });
  
  // コントロールに擬似カウントアップオブジェクトを保存
  control._simulation = simulation;
  
  // NotebookLMタブを表示（グループを展開）
  tabBtn.addEventListener('click', async () => {
    try {
      // タブが属するグループを取得
      const tab = await chrome.tabs.get(tabId);
      if (tab.groupId && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        // グループを展開
        await chrome.tabGroups.update(tab.groupId, { collapsed: false });
        // タブをアクティブにする
        await chrome.tabs.update(tabId, { active: true });
      } else {
        // グループに属していない場合は通常通りアクティブに
        await chrome.tabs.update(tabId, { active: true });
      }
    } catch (error) {
      console.error('Failed to show tab:', error);
      // フォールバック
      chrome.tabs.update(tabId, { active: true });
    }
  });
  
  // 閉じるボタン
  closeBtn.addEventListener('click', async () => {
    simulation.stop();
    control.remove();
    // タブを削除（releaseTabではなく削除）
    chrome.runtime.sendMessage({ 
      action: 'releaseTab', 
      tabId: tabId,
      autoClose: true  // 自動削除フラグを有効に
    });
  });
  
  // プログレスバーのクリック（シーク機能）
  progressBar.addEventListener('click', async (e) => {
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    
    // 即座にUIを更新
    const progressFill = control.querySelector('.audio-progress-fill');
    if (progressFill) {
      progressFill.style.transform = `scaleX(${Math.max(percentage / 100, 0.01)})`;
    }
    
    try {
      const response = await sendMessageToTab(tabId, { 
        action: 'seekAudio', 
        percentage: percentage
      });
      
      // シーク後、最新の情報を取得して更新
      setTimeout(async () => {
        try {
          const info = await sendMessageToTab(tabId, { action: 'getAudioInfo' });
          if (info && info.status === 'ready') {
            updateInlineControlProgress(control, info);
            // 擬似カウントアップの値も更新
            simulation.lastKnownTime = simulation.timeToSeconds(info.currentTime);
            simulation.lastKnownDuration = simulation.timeToSeconds(info.duration);
          }
        } catch (error) {
          console.error('Failed to update after seek:', error);
        }
      }, 100);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  });
  
  progressBar.style.cursor = 'pointer';
  progressBar.title = 'クリックでシーク';
  
  // 初期状態をチェック
  if (audioInfo) {
    simulation.lastKnownTime = simulation.timeToSeconds(audioInfo.currentTime);
    simulation.lastKnownDuration = simulation.timeToSeconds(audioInfo.duration);
    
    console.log('Initial state check:', {
      isPlaying: audioInfo.isPlaying,
      currentTime: audioInfo.currentTime,
      duration: audioInfo.duration,
      currentSeconds: simulation.lastKnownTime,
      durationSeconds: simulation.lastKnownDuration
    });
    
    // 既に再生中の場合は擬似カウントアップを開始
    if (audioInfo.isPlaying) {
      simulation.start();
    }
  }
}

// インラインコントロールの進捗更新
function updateInlineControlProgress(control, audioInfo) {
  const progressFill = control.querySelector('.audio-progress-fill');
  const currentTimeSpan = control.querySelector('.current-time');
  const durationSpan = control.querySelector('.duration');
  const playBtn = control.querySelector('.audio-play-btn');
  
  // audioInfoにprogressが含まれている場合は直接使用
  let progress = 0;
  if (audioInfo.progress !== undefined) {
    progress = audioInfo.progress;
  } else if (audioInfo.duration) {
    // progressがない場合は計算
    progress = (parseTime(audioInfo.currentTime) / parseTime(audioInfo.duration)) * 100;
  }
  
  if (progressFill && !isNaN(progress)) {
    // 最小幅を考慮した進行状況の設定
    const scaleX = Math.max(progress / 100, 0.01); // 最小値を確保
    progressFill.style.transform = `scaleX(${scaleX})`;
  }
  if (currentTimeSpan && audioInfo.currentTime) {
    currentTimeSpan.textContent = audioInfo.currentTime;
  }
  if (durationSpan && audioInfo.duration) {
    durationSpan.textContent = audioInfo.duration;
  }
  if (playBtn && audioInfo.isPlaying !== undefined) {
    const wasPlaying = playBtn.dataset.playing === 'true';
    if (wasPlaying !== audioInfo.isPlaying) {
      playBtn.dataset.playing = audioInfo.isPlaying;
      updatePlayButton(playBtn, audioInfo.isPlaying);
    }
  }
}

// 音声終了を監視
async function startAudioEndMonitoring(tabId, dialog) {
  const checkInterval = setInterval(async () => {
    try {
      // ダイアログが閉じられたら監視を停止
      if (!document.body.contains(dialog)) {
        clearInterval(checkInterval);
        return;
      }
      
      const audioInfo = await sendMessageToTab(tabId, { action: 'getAudioInfo' });
      
      if (!audioInfo || audioInfo.status !== 'ready') {
        clearInterval(checkInterval);
        return;
      }
      
      // 音声が終了したかチェック（再生中でない、かつ現在時間が継続時間に近い）
      if (!audioInfo.isPlaying && audioInfo.currentTime && audioInfo.duration) {
        const current = parseTime(audioInfo.currentTime);
        const duration = parseTime(audioInfo.duration);
        
        if (duration > 0 && current >= duration - 1) {
          // 音声が終了した
          clearInterval(checkInterval);
          
          // ダイアログを閉じる
          if (dialog && document.body.contains(dialog)) {
            dialog.remove();
          }
          
          // タブをプールに返却（自動的に削除される）
          chrome.runtime.sendMessage({ 
            action: 'releaseTab', 
            tabId: tabId,
            autoClose: true  // 自動削除フラグ
          });
        }
      }
    } catch (error) {
      console.error('Audio monitoring error:', error);
      clearInterval(checkInterval);
    }
  }, 1000); // 1秒ごとにチェック
}

// 時間文字列をパース（例: "12:34" -> 754秒）
function parseTime(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(p => parseInt(p) || 0);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

// タブIDから対応するコントロールを更新する関数
function handleAudioProgressUpdate(audioInfo, tabId) {
  if (!tabId) return;
  
  // タブIDに対応するコントロールを探す
  const control = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (control) {
    updateInlineControlProgress(control, audioInfo);
  }
}

// タブが削除された場合の処理
function handleTabRemoved(tabId, notebookId) {
  if (!tabId) return;
  
  // タブIDに対応するコントロールを探す
  const control = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (control) {
    // 擬似カウントアップを停止
    if (control._simulation) {
      control._simulation.stop();
    }
    
    // エラーメッセージを表示
    const errorMsg = document.createElement('div');
    errorMsg.className = 'audio-notice';
    errorMsg.textContent = '音声タブが閉じられました。再度「音声概要」ボタンをクリックしてください。';
    control.appendChild(errorMsg);
    
    // 3秒後にコントロールを削除
    setTimeout(() => {
      control.remove();
    }, 3000);
  }
}

// 統計収集関数
let currentSessionId = null;

async function startStatsSession(notebook) {
  try {
    const sessionId = await chrome.runtime.sendMessage({
      action: 'startStatsSession',
      notebookId: notebook.id,
      notebookTitle: notebook.title,
      icon: notebook.icon || '📚'
    });
    currentSessionId = sessionId;
    return sessionId;
  } catch (error) {
    console.error('Failed to start stats session:', error);
    return null;
  }
}

async function endStatsSession(completionRate = 0) {
  if (!currentSessionId) return;
  
  try {
    await chrome.runtime.sendMessage({
      action: 'endStatsSession',
      sessionId: currentSessionId,
      completionRate: completionRate
    });
  } catch (error) {
    console.error('Failed to end stats session:', error);
  } finally {
    currentSessionId = null;
  }
}

async function recordStatsEvent(eventType, metadata = {}) {
  if (!currentSessionId) return;
  
  try {
    await chrome.runtime.sendMessage({
      action: 'recordStatsEvent',
      sessionId: currentSessionId,
      eventType: eventType,
      metadata: metadata
    });
  } catch (error) {
    console.error('Failed to record stats event:', error);
  }
}

// CSSアニメーション用のスタイル追加
const style = document.createElement('style');
style.textContent = `
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .rotating {
    animation: rotate 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .loading-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #1a73e8;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    vertical-align: middle;
    margin-right: 4px;
  }
  
  .audio-notice {
    font-size: 12px;
    color: #5f6368;
    text-align: center;
    margin-top: 12px;
    padding: 8px;
    background-color: #f8f9fa;
    border-radius: 4px;
  }
  
  .highlight {
    animation: highlight-flash 0.5s ease-in-out 2;
  }
  
  @keyframes highlight-flash {
    0%, 100% { 
      background-color: transparent;
      box-shadow: none;
    }
    50% { 
      background-color: #e8f0fe;
      box-shadow: 0 0 0 3px #1a73e8;
    }
  }
`;
document.head.appendChild(style);