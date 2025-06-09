// サイドパネルのメインスクリプト

// Use the global i18n helper if available, otherwise provide fallback
const getMessage = window.i18n?.getMessage || ((messageName, substitutions) => 
  chrome.i18n?.getMessage(messageName, substitutions) ?? messageName
);

let notebooks = [];
let filteredNotebooks = [];
let activeFilters = new Set();
let sortOrder = 'default'; // 'default' or 'created'

// DOM要素
const notebooksContainer = document.getElementById('notebooks-container');
const searchInput = document.getElementById('search-input');
const iconFilters = document.getElementById('icon-filters');
const refreshBtn = document.getElementById('refresh-btn');
const sortSelect = document.getElementById('sort-select');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadNotebooks();
  setupEventListeners();
  setupSupportLink();
});

// イベントリスナーの設定
function setupEventListeners() {
  searchInput.addEventListener('input', handleSearch);
  refreshBtn.addEventListener('click', refreshNotebooks);
  sortSelect.addEventListener('change', handleSortChange);
  
  // バックグラウンドからのメッセージを受信
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateNotebooks') {
      notebooks = request.data;
      updateDisplay();
      // リフレッシュアニメーションを停止
      refreshBtn.classList.remove('rotating');
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
    // ストレージから既存のデータとソート設定を読み込み
    const result = await chrome.storage.local.get(['notebooks', 'sortOrder']);
    if (result.sortOrder) {
      sortOrder = result.sortOrder;
      sortSelect.value = sortOrder;
    }
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
async function refreshNotebooks() {
  // 回転アニメーション
  refreshBtn.classList.add('rotating');
  
  // 現在のノートブックリストをクリア
  notebooks = [];
  updateDisplay();
  
  try {
    // バックグラウンドスクリプト経由でタブ操作を実行
    const response = await chrome.runtime.sendMessage({
      action: 'refreshNotebookTab'
    });
    
    if (response?.success) {
      console.log('NotebookLM tab refreshed successfully');
    } else {
      console.error('Failed to refresh NotebookLM tab:', response?.error);
    }
  } catch (error) {
    console.error('Exception in refreshNotebooks:', error);
  } finally {
    // 一定時間後にアニメーションを停止
    setTimeout(() => {
      refreshBtn.classList.remove('rotating');
    }, 3000);
  }
}

// 検索処理
function handleSearch() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  filterNotebooks(searchTerm);
}

// ソート順変更処理
function handleSortChange(event) {
  sortOrder = event.target.value;
  chrome.storage.local.set({ sortOrder }); // 設定を保存
  filterNotebooks(searchInput.value.toLowerCase().trim());
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
  
  // ソート処理
  if (sortOrder === 'created') {
    filteredNotebooks.sort((a, b) => {
      // 作成日でソート（新しい順）
      const dateA = a.createdDate?.timestamp || 0;
      const dateB = b.createdDate?.timestamp || 0;
      return dateB - dateA;
    });
  }
  // defaultの場合は元の順序を保持
  
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
  
  const dateInfo = notebook.createdDate ? 
    `<div class="notebook-date">${notebook.createdDate.displayText || ''}</div>` : '';
  
  item.innerHTML = `
    ${iconHtml}
    <div class="notebook-content">
      <div class="notebook-title">${notebook.title}</div>
      <div class="notebook-subtitle">
        ${getMessage('sourceCount', [notebook.sourceCount || 0])}
        ${dateInfo}
      </div>
      <div class="notebook-actions">
        <button class="action-btn" data-action="open" data-id="${notebook.id}">${getMessage('openButton')}</button>
        <button class="action-btn primary" data-action="audio" data-id="${notebook.id}">${getMessage('audioSummaryButton')}</button>
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
    
    // キャッシュがあっても、タブの実際の状態を確認する必要がある
    // （タブが再利用された場合、音声が読み込まれていない可能性があるため）
    
    // Prepare the audio tab
    await prepareAudioTab(notebook, tabId);
    
  } catch (error) {
    console.error('Audio action error:', error);
    hideLoadingIndicator(notebook);
    alert(getMessage('audioFetchError', [error.message]));
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
    // タブの準備ができていることを確認
    await waitForContentScript(tabId, 10);
    
    // 音声情報を取得
    let audioInfo = await sendMessageToTab(tabId, { action: 'getAudioInfo' });
    console.log('Initial audio info:', audioInfo);
    
    if (!audioInfo) {
      throw new Error(getMessage('operationFailedError'));
    }
    
    switch (audioInfo.status) {
      case 'not_loaded': {
        console.log('Audio not loaded, clicking load button...');
        // 読み込みボタンをクリック
        const loadResult = await sendMessageToTab(tabId, { action: 'controlAudio', command: 'load' });
        console.log('Load button click result:', loadResult);
        
        // 読み込み完了を待つ
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 再度音声情報を取得
        let retries = 0;
        let loadedInfo = null;
        const maxRetries = 20; // 最大10秒（読み込みの場合）
        
        while (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
          loadedInfo = await sendMessageToTab(tabId, { action: 'getAudioInfo' });
          
          console.log(`[Audio Loading] Retry ${retries + 1}/${maxRetries}, info:`, loadedInfo);
          
          // 音声が準備できたら終了（hasPlayerの条件を緩和）
          if (loadedInfo.status === 'ready') {
            console.log('[Audio Loading] Audio is ready!');
            break;
          }
          
          // 生成中の場合は別の処理に移行
          if (loadedInfo.status === 'generating') {
            console.log('[Audio Loading] Status changed to generating, will monitor progress');
            break;
          }
          
          // 未生成の場合も別の処理に移行
          if (loadedInfo.status === 'not_generated') {
            console.log('[Audio Loading] Status is not_generated, will start generation');
            break;
          }
          
          retries++;
        }
        
        if (loadedInfo && loadedInfo.status === 'ready') {
          console.log('[Audio Loading] Processing ready status, audioInfo:', loadedInfo);
          
          // Cache audio info in the tab pool
          chrome.runtime.sendMessage({
            action: 'cacheAudioInfo',
            tabId: tabId,
            audioInfo: loadedInfo
          });
          
          console.log('[Audio Loading] Hiding loading indicator...');
          hideLoadingIndicator(notebook);
          
          // タブを非アクティブに戻す
          await chrome.tabs.update(tabId, { active: false });
          
          if (loadedInfo.audioUrl) {
            console.log('[Audio Loading] Has audioUrl, showing inline player');
            // URLがある場合はタブをプールに戻してインライン再生
            chrome.runtime.sendMessage({
              action: 'releaseTab',
              tabId: tabId
            });
            showInlineAudioPlayer(notebook, loadedInfo);
          } else if (loadedInfo.hasPlayer) {
            console.log('[Audio Loading] Has player but no URL, showing control dialog');
            // URLがない場合はタブを保持してコントロール
            showAudioControlDialog(notebook, loadedInfo, tabId);
          } else {
            console.log('[Audio Loading] No URL or player, showing basic dialog');
            showAudioDialog(notebook, loadedInfo, tabId);
          }
        } else if (loadedInfo && loadedInfo.status === 'not_generated') {
          hideLoadingIndicator(notebook);
          // 自動的に生成を開始
          console.log('[Audio] Starting automatic generation...');
          const genResult = await sendMessageToTab(tabId, { 
            action: 'controlAudio', 
            command: 'generate' 
          });
          
          if (genResult.success) {
            console.log('[Audio] Generation started, monitoring progress');
            // Cache the generating status
            chrome.runtime.sendMessage({
              action: 'cacheAudioInfo',
              tabId: tabId,
              audioInfo: { status: 'generating' }
            });
            
            // 生成完了を監視
            monitorGenerationProgress(notebook, tabId);
          } else {
            console.log('[Audio] Failed to start generation');
            hideLoadingIndicator(notebook);
            // タブをプールに戻す
            chrome.runtime.sendMessage({
              action: 'releaseTab',
              tabId: tabId
            });
          }
        } else if (loadedInfo && loadedInfo.status === 'generating') {
          // 読み込み後に生成中になった場合
          console.log('[Audio Loading] Transitioned to generating after load');
          hideLoadingIndicator(notebook);
          
          // Cache the generating status
          chrome.runtime.sendMessage({
            action: 'cacheAudioInfo',
            tabId: tabId,
            audioInfo: { status: 'generating' }
          });
          
          // タブは保持して、生成完了を監視
          console.log('[Audio Loading] Starting generation monitoring...');
          monitorGenerationProgress(notebook, tabId);
        } else {
          hideLoadingIndicator(notebook);
          chrome.runtime.sendMessage({
            action: 'releaseTab',
            tabId: tabId
          });
          // エラーメッセージ
          alert(getMessage('audioLoadFailedAlert'));
        }
        break;
      }
        
      case 'not_generated': {
        hideLoadingIndicator(notebook);
        console.log('[Audio] Not generated, starting automatic generation');
        
        // 自動的に生成を開始
        const genResult = await sendMessageToTab(tabId, { 
          action: 'controlAudio', 
          command: 'generate' 
        });
        
        if (genResult.success) {
          console.log('[Audio] Generation started successfully');
          // Cache the generating status
          chrome.runtime.sendMessage({
            action: 'cacheAudioInfo',
            tabId: tabId,
            audioInfo: { status: 'generating' }
          });
          
          // 生成完了を監視
          monitorGenerationProgress(notebook, tabId);
        } else {
          console.log('[Audio] Failed to start generation');
          hideLoadingIndicator(notebook);
          // タブをプールに戻す
          chrome.runtime.sendMessage({
            action: 'releaseTab',
            tabId: tabId
          });
        }
        break;
      }
        
      case 'generating': {
        hideLoadingIndicator(notebook);
        console.log('[Audio] Already generating');
        
        // Cache the generating status
        chrome.runtime.sendMessage({
          action: 'cacheAudioInfo',
          tabId: tabId,
          audioInfo: { status: 'generating' }
        });
        
        // 生成完了を監視
        monitorGenerationProgress(notebook, tabId);
        break;
      }
        
      case 'ready': {
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
      }
        
      default: {
        hideLoadingIndicator(notebook);
        console.log('[Audio] Unknown status, attempting to generate:', audioInfo.status);
        // 自動的に生成を開始
        const genResult2 = await sendMessageToTab(tabId, { 
          action: 'controlAudio', 
          command: 'generate' 
        });
        
        if (genResult2.success) {
          console.log('[Audio] Generation started from unknown status');
          // Cache the generating status
          chrome.runtime.sendMessage({
            action: 'cacheAudioInfo',
            tabId: tabId,
            audioInfo: { status: 'generating' }
          });
          
          // 生成完了を監視
          monitorGenerationProgress(notebook, tabId);
        } else {
          console.log('[Audio] Failed to start generation from unknown status');
          hideLoadingIndicator(notebook);
          // タブをプールに戻す
          chrome.runtime.sendMessage({
            action: 'releaseTab',
            tabId: tabId
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Audio preparation error:', error);
    console.error('Error stack:', error.stack);
    
    // Release the tab back to the pool instead of closing it
    if (tabId) {
      chrome.runtime.sendMessage({
        action: 'releaseTab',
        tabId: tabId
      });
    }
    
    console.log('[Error] Hiding loading indicator due to error...');
    hideLoadingIndicator(notebook);
    throw error; // Re-throw to be handled by handleAudioAction
  }
}

// 音声生成の進行状況を監視
async function monitorGenerationProgress(notebook, tabId) {
  console.log('[Monitor] Starting generation monitoring for tab:', tabId);
  
  // ボタンを生成中の状態に更新
  const notebookItem = document.querySelector(`[data-notebook-id="${notebook.id}"]`);
  if (notebookItem) {
    const audioBtn = notebookItem.querySelector('[data-action="audio"]');
    if (audioBtn) {
      audioBtn.disabled = false; // ローディング状態を解除
      audioBtn.innerHTML = getMessage('generatingStatus');
      console.log('[Monitor] Button updated to generating state');
    }
  }
  
  let checkCount = 0;
  const maxChecks = 120; // 最大10分（5秒間隔）
  
  const checkInterval = setInterval(async () => {
    try {
      // タブが存在するか確認
      const tabExists = await isTabAlive(tabId);
      if (!tabExists) {
        console.log('[Monitor] Tab no longer exists, stopping monitoring');
        clearInterval(checkInterval);
        return;
      }
      
      // 音声情報を取得
      const audioInfo = await sendMessageToTab(tabId, { action: 'getAudioInfo' });
      console.log(`[Monitor] Check ${checkCount + 1}/${maxChecks}, status:`, audioInfo.status);
      
      if (audioInfo.status === 'ready') {
        console.log('[Monitor] Audio is ready! Processing...');
        clearInterval(checkInterval);
        
        // 音声が準備できたら処理
        await processReadyAudio(notebook, audioInfo, tabId);
      } else if (audioInfo.status !== 'generating' && audioInfo.status !== 'not_loaded') {
        console.log('[Monitor] Status changed to:', audioInfo.status);
        clearInterval(checkInterval);
      }
      
      checkCount++;
      if (checkCount >= maxChecks) {
        console.log('[Monitor] Max checks reached, stopping monitoring');
        clearInterval(checkInterval);
        
        // ボタンを元の状態に戻す
        const notebookItem = document.querySelector(`[data-notebook-id="${notebook.id}"]`);
        if (notebookItem) {
          const audioBtn = notebookItem.querySelector('[data-action="audio"]');
          if (audioBtn) {
            audioBtn.innerHTML = getMessage('audioSummaryButton');
            console.log('[Monitor] Button restored after timeout');
          }
        }
        
        // タブをプールに戻す
        chrome.runtime.sendMessage({
          action: 'releaseTab',
          tabId: tabId
        });
      }
    } catch (error) {
      console.error('[Monitor] Error during monitoring:', error);
      clearInterval(checkInterval);
    }
  }, 5000); // 5秒ごとにチェック
}

// 準備できた音声を処理
async function processReadyAudio(notebook, audioInfo, tabId) {
  console.log('[processReadyAudio] Processing ready audio');
  
  // Cache audio info
  chrome.runtime.sendMessage({
    action: 'cacheAudioInfo',
    tabId: tabId,
    audioInfo: audioInfo
  });
  
  // ボタンの状態を更新（アイコンなどで生成完了を示す）
  const notebookItem = document.querySelector(`[data-notebook-id="${notebook.id}"]`);
  if (notebookItem) {
    const audioBtn = notebookItem.querySelector('[data-action="audio"]');
    if (audioBtn) {
      audioBtn.innerHTML = getMessage('audioReadyButton');
      console.log('[processReadyAudio] Button updated with ready indicator');
    }
  }
  
  // 音声が準備できたら自動的にプレーヤーを表示
  console.log('[processReadyAudio] Audio ready, showing player');
  
  if (audioInfo.audioUrl) {
    // URLがある場合はタブをプールに戻してインライン再生
    chrome.runtime.sendMessage({
      action: 'releaseTab',
      tabId: tabId
    });
    showInlineAudioPlayer(notebook, audioInfo);
  } else if (audioInfo.hasPlayer) {
    // URLがない場合はタブを保持してコントロール
    showAudioControlDialog(notebook, audioInfo, tabId);
  } else {
    // プレーヤーがない場合は基本的なダイアログ
    console.log('[processReadyAudio] No player found, keeping tab for manual control');
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
            ${audioInfo.isPlaying ? getMessage('pauseButton') : getMessage('playButton')}
          </button>
          <button class="audio-control-btn secondary" id="download-btn">
            ${getMessage('downloadButton')}
          </button>
          <button class="audio-control-btn secondary" id="open-in-tab-btn">
            ${getMessage('openInTabButton')}
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // イベントリスナー
  document.getElementById('close-audio-dialog').addEventListener('click', () => {
    dialog.remove();
    // タブをプールに返却
    if (tabId) {
      chrome.runtime.sendMessage({ action: 'releaseTab', tabId });
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
        audioInfo.isPlaying ? getMessage('pauseButton') : getMessage('playButton');
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
      btn.textContent = getMessage('downloadComplete');
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    } else {
      alert(getMessage('downloadError', [response.message || getMessage('operationFailedError')]));
    }
  });
  
  document.getElementById('open-in-tab-btn').addEventListener('click', () => {
    chrome.tabs.update(tabId, { active: true });
    dialog.remove();
  });
}

// 音声生成中ダイアログを表示
function showGeneratingDialog(notebook, tabId) {
  console.log('[showGeneratingDialog] Called for notebook:', notebook.id);
  
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
          <p style="margin-top: 16px;">${getMessage('audioGeneratingMessage')}</p>
          <p style="font-size: 12px; color: #5f6368; margin-top: 8px;">
            ${getMessage('generatingTimeMessage')}<br>
            ${getMessage('generatingInstructionMessage')}
          </p>
        </div>
        <div class="audio-controls-panel">
          <button class="audio-control-btn secondary" id="open-in-tab-btn">
            ${getMessage('openTabToCheckButton')}
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // イベントリスナー
  document.getElementById('close-audio-dialog').addEventListener('click', () => {
    dialog.remove();
    // タブをプールに返却
    if (tabId) {
      chrome.runtime.sendMessage({ action: 'releaseTab', tabId });
    }
  });
  
  document.getElementById('open-in-tab-btn').addEventListener('click', () => {
    chrome.tabs.update(tabId, { active: true });
    dialog.remove();
  });
  
  console.log('[showGeneratingDialog] Dialog created successfully');
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
        <p>${getMessage('audioNotGeneratedMessage')}</p>
        <p style="font-size: 12px; color: #5f6368; margin-top: 8px;">
          ${getMessage('generateInstructionMessage')}
        </p>
        <div class="audio-controls-panel">
          <button class="audio-control-btn primary" id="generate-audio-btn">
            ${getMessage('generateAudioButton')}
          </button>
          <button class="audio-control-btn secondary" id="open-in-tab-btn">
            ${getMessage('openInTabButton')}
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // イベントリスナー
  document.getElementById('close-audio-dialog').addEventListener('click', () => {
    dialog.remove();
    // タブをプールに返却
    if (tabId) {
      chrome.runtime.sendMessage({ action: 'releaseTab', tabId });
    }
  });
  
  document.getElementById('generate-audio-btn').addEventListener('click', async () => {
    // 生成ボタンをクリック
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'controlAudio', 
      command: 'generate' 
    });
    
    if (response.success) {
      // タブをアクティブにして生成プロセスを確認できるようにする
      chrome.tabs.update(tabId, { active: true });
      dialog.remove();
    } else {
      alert(getMessage('generateFailedAlert'));
    }
  });
  
  document.getElementById('open-in-tab-btn').addEventListener('click', () => {
    chrome.tabs.update(tabId, { active: true });
    dialog.remove();
  });
}

// Loading indicator functions
function showLoadingIndicator(notebook) {
  console.log('[showLoadingIndicator] Called for notebook:', notebook.id);
  const notebookItem = document.querySelector(`[data-notebook-id="${notebook.id}"]`);
  if (notebookItem) {
    const audioBtn = notebookItem.querySelector('[data-action="audio"]');
    if (audioBtn) {
      console.log('[showLoadingIndicator] Current button text:', audioBtn.textContent);
      audioBtn.disabled = true;
      audioBtn.innerHTML = '<span class="loading-spinner"></span>' + getMessage('loadingMessage');
      console.log('[showLoadingIndicator] Button updated to loading state');
    }
  }
}

function hideLoadingIndicator(notebook) {
  console.log('[hideLoadingIndicator] Called for notebook:', notebook.id);
  const notebookItem = document.querySelector(`[data-notebook-id="${notebook.id}"]`);
  console.log('[hideLoadingIndicator] Found notebook item:', !!notebookItem);
  
  if (notebookItem) {
    const audioBtn = notebookItem.querySelector('[data-action="audio"]');
    console.log('[hideLoadingIndicator] Found audio button:', !!audioBtn);
    
    if (audioBtn) {
      console.log('[hideLoadingIndicator] Resetting button state');
      audioBtn.disabled = false;
      audioBtn.innerHTML = getMessage('audioSummaryButton');
    }
  } else {
    console.error('[hideLoadingIndicator] Notebook item not found for ID:', notebook.id);
  }
}

// 空の状態表示
function showEmptyState() {
  notebooksContainer.innerHTML = `
    <div class="empty-state">
      <p>${getMessage('noNotebooksFound')}</p>
      <button class="action-btn primary" id="open-notebooklm-btn">
        ${getMessage('openNotebookLMButton')}
      </button>
    </div>
  `;
  
  // イベントリスナーを追加
  const openBtn = document.getElementById('open-notebooklm-btn');
  if (openBtn) {
    openBtn.addEventListener('click', async () => {
      // バックグラウンドスクリプト経由でタブを開く
      try {
        await chrome.runtime.sendMessage({
          action: 'refreshNotebookTab'
        });
      } catch (error) {
        console.error('Failed to open NotebookLM:', error);
      }
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
      <button class="audio-close-btn" title="${getMessage('closeButtonTitle')}">×</button>
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
  progressBar.title = getMessage('clickToSeekTitle');
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
      <button class="audio-tab-btn" title="${getMessage('showInNotebookLMTitle')}">🔗</button>
      <button class="audio-close-btn" title="${getMessage('closeButtonTitle')}">×</button>
    </div>
  `;
  
  // ノートブックアイテムの後に挿入
  notebookItem.insertAdjacentElement('afterend', control);
  
  // イベントリスナーを設定
  setupInlineControlEvents(control, notebook, audioInfo, tabId);
  
  // 初回の音声準備（自動的にタブをアクティブにして音声を準備）
  setTimeout(async () => {
    try {
      // タブを一度アクティブにして音声を準備
      await chrome.tabs.update(tabId, { active: true });
      
      // 少し待ってから非アクティブに戻す
      setTimeout(() => {
        chrome.tabs.update(tabId, { active: false });
      }, 1000);
      
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
        errorMsg.textContent = getMessage('audioTabClosedNotice');
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
    
    console.log('=== Play button clicked ===');
    console.log('Tab operation:', {
      tabId,
      isPlaying,
      action: isPlaying ? 'pause' : 'play',
      timestamp: new Date().toISOString()
    });
    
    // Chrome APIの制限をチェック
    try {
      const manifest = chrome.runtime.getManifest();
      console.log('[API Check] Extension permissions:', manifest.permissions);
      
      // 現在のウィンドウ情報を取得
      const currentWindow = await chrome.windows.getCurrent();
      console.log('[API Check] Current window:', {
        id: currentWindow.id,
        focused: currentWindow.focused,
        state: currentWindow.state
      });
    } catch (apiError) {
      console.error('[API Check] Failed to check API status:', apiError);
    }
    
    try {
      let currentTab = null;
      let shouldRestoreTab = false;
      
      // 再生開始時、初回再生かチェック
      if (!isPlaying) {
        const firstPlayCheck = await chrome.runtime.sendMessage({
          action: 'checkFirstPlay',
          tabId: tabId
        });
        
        if (firstPlayCheck && firstPlayCheck.isFirstPlay) {
          console.log('First play detected, activating tab for minimum time');
          
          // 再生ボタンを押す前の現在のアクティブタブを記録
          // まず、現在フォーカスされているウィンドウを取得
          const focusedWindow = await chrome.windows.getLastFocused({ populate: true });
          console.log('[Tab Search] Currently focused window:', {
            id: focusedWindow.id,
            type: focusedWindow.type,
            focused: focusedWindow.focused
          });
          
          // フォーカスされているウィンドウのアクティブタブを取得
          let originalActiveTab = null;
          if (focusedWindow.tabs) {
            originalActiveTab = focusedWindow.tabs.find(tab => tab.active);
            if (originalActiveTab) {
              console.log('[Tab Search] Original active tab before playing:', {
                id: originalActiveTab.id,
                url: originalActiveTab.url,
                title: originalActiveTab.title,
                windowId: originalActiveTab.windowId
              });
            }
          }
          
          // NotebookLMタブの情報も取得
          const notebookTab = await chrome.tabs.get(tabId);
          console.log('[Tab Search] NotebookLM tab:', {
            id: notebookTab.id,
            windowId: notebookTab.windowId,
            url: notebookTab.url
          });
          
          // 復元するタブを決定
          console.log('[Tab Search] Determining tab to restore...');
          
          // 最初に元のアクティブタブが復元可能かチェック
          if (originalActiveTab && 
              originalActiveTab.id !== tabId &&
              originalActiveTab.url && 
              originalActiveTab.url !== 'about:blank' &&
              !originalActiveTab.url.includes('sidepanel.html') &&
              !originalActiveTab.url.includes('notebooklm.google.com')) {
            
            currentTab = originalActiveTab;
            console.log('[Tab Search] ✅ Using original active tab for restoration');
          } else {
            console.log('[Tab Search] Original active tab not suitable, searching for alternatives...');
            
            // NotebookLMタブと同じウィンドウのタブを取得
            const tabs = await chrome.tabs.query({ 
              active: true, 
              windowId: notebookTab.windowId 
            });
            console.log(`[Tab Search] Active tabs in NotebookLM window: ${tabs.length}`);
          
          currentTab = tabs.find(tab => {
            console.log(`[Tab Search] Checking tab ${tab.id}:`, {
              url: tab.url || 'no-url',
              title: tab.title || 'no-title',
              active: tab.active,
              pinned: tab.pinned
            });
            
            // NotebookLMのタブを除外
            if (tab.id === tabId) {
              console.log(`[Tab Search] ❌ Skipping - This is the NotebookLM tab we're playing from`);
              return false;
            }
            
            // URLが無い場合やabout:blankの場合を除外
            if (!tab.url || tab.url === 'about:blank') {
              console.log(`[Tab Search] ❌ Skipping - No valid URL`);
              return false;
            }
            
            // chrome:// URLも許可（新しいタブページなど）
            if (tab.url.startsWith('chrome://')) {
              console.log(`[Tab Search] ✅ Found Chrome internal page: ${tab.url}`);
              return true;
            }
            
            // サイドパネルを除外
            if (tab.url.includes('sidepanel.html')) {
              console.log(`[Tab Search] ❌ Skipping - This is the side panel`);
              return false;
            }
            
            // 拡張機能のタブでNotebookLMに関連するものを除外
            if (tab.url.startsWith('chrome-extension://')) {
              if (tab.title && tab.title.includes('NotebookLM')) {
                console.log(`[Tab Search] ❌ Skipping - Extension tab with NotebookLM in title`);
                return false;
              }
              // その他の拡張機能タブは許可
              console.log(`[Tab Search] ✅ Found extension tab: ${tab.url}`);
              return true;
            }
            
            // デバッグ用のタブを除外
            if (tab.url.includes('debug.html')) {
              console.log(`[Tab Search] ❌ Skipping - Debug tab`);
              return false;
            }
            
            console.log(`[Tab Search] ✅ Found valid tab!`);
            return true;
          });
          
          // 見つからない場合の詳細情報
          if (!currentTab) {
            console.log('[Tab Search] No active tab found in initial search. Trying fallback methods...');
            console.log('[Tab Search] Active tabs checked:', tabs.map(t => ({
              id: t.id,
              url: t.url || 'no-url',
              title: t.title || 'no-title',
              windowId: t.windowId
            })));
            
            // フォールバック: 同じウィンドウの他のタブを確認
            console.log('[Tab Search] Fallback: Checking all tabs in the same window...');
            const allTabsInWindow = await chrome.tabs.query({ windowId: notebookTab.windowId });
            console.log(`[Tab Search] Total tabs in window: ${allTabsInWindow.length}`);
            
            // 最近アクセスされたタブを優先（lastAccessedが大きいほど最近）
            // lastAccessedが利用できない場合は、元の位置（小さいindex）を優先
            const sortedTabs = allTabsInWindow.sort((a, b) => {
              // lastAccessedがある場合はそれを使用（optional chainingで簡略化）
              return (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0) || 
                     (a.index ?? 0) - (b.index ?? 0);
            });
            
            console.log('[Tab Search] Tabs sorted by access time/position:', sortedTabs.map(t => ({
              id: t.id,
              index: t.index,
              lastAccessed: t.lastAccessed,
              url: t.url ? t.url.substring(0, 50) + '...' : 'no-url'
            })));
            
            currentTab = sortedTabs.find(tab => {
              if (tab.id === tabId) return false;
              if (!tab.url || tab.url === 'about:blank') return false;
              if (tab.url.includes('sidepanel.html')) return false;
              if (tab.url.includes('notebooklm.google.com')) return false;
              
              console.log(`[Tab Search] ✅ Found restorable tab in fallback: ${tab.id} - ${tab.url}`);
              return true;
            });
            
            if (currentTab) {
              console.log('[Tab Search] ✅ SUCCESS: Tab found using fallback method');
            }
            
            if (!currentTab) {
              // 最後の手段: 他のウィンドウも確認
              console.log('[Tab Search] Final fallback: Checking other windows...');
              const allWindows = await chrome.windows.getAll({ populate: true });
              
              for (const window of allWindows) {
                if (window.id === notebookTab.windowId) continue;
                
                const activeTab = window.tabs?.find(tab => tab.active);
                if (activeTab && activeTab.url && 
                    !activeTab.url.includes('sidepanel.html') && 
                    !activeTab.url.includes('notebooklm.google.com') &&
                    activeTab.id !== tabId) {
                  console.log(`[Tab Search] ✅ Found active tab in window ${window.id}: ${activeTab.id} - ${activeTab.url}`);
                  currentTab = activeTab;
                  break;
                }
              }
            }
            
            if (!currentTab) {
              console.log('[Tab Search] ℹ️ No restorable tab found.');
              console.log('[Tab Search] Possible reasons:');
              console.log('- Only NotebookLM tabs are open');
              console.log('- Browser just started with no other tabs');
              console.log('- All other tabs are system pages');
              console.log('[Tab Search] Audio will play without tab restoration.');
            }
          }
          
          }
          
          console.log('Current active tab to restore:', currentTab ? {
            id: currentTab.id,
            url: currentTab.url,
            title: currentTab.title,
            windowId: currentTab.windowId
          } : 'none');
          
          // タブをアクティブにする
          await chrome.tabs.update(tabId, { active: true });
          
          // 復元するタブが見つかった場合のみ復元フラグを設定
          if (currentTab) {
            shouldRestoreTab = true;
            console.log('Will restore to tab:', currentTab.id);
          } else {
            shouldRestoreTab = false;
            console.log('No tab to restore, will only pin the NotebookLM tab later');
          }
          
          // 初回再生フラグを更新
          chrome.runtime.sendMessage({
            action: 'markAsPlayed',
            tabId: tabId
          });
        }
      }
      
      console.log('Sending control command:', isPlaying ? 'pause' : 'play');
      const response = await sendMessageToTab(tabId, { 
        action: 'controlAudio', 
        command: isPlaying ? 'pause' : 'play' 
      });
      
      // タブの復元（できるだけ早く）
      if (shouldRestoreTab && currentTab && currentTab.id) {
        // タブの切り替えが完了するのを待つ
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // タブ復元処理（詳細なデバッグ付き）
        setTimeout(async () => {
          console.log('=== Starting tab restoration ===');
          try {
            // タブがまだ存在するか確認
            let tabInfo;
            try {
              tabInfo = await chrome.tabs.get(currentTab.id);
              console.log('[Restoration] Tab still exists:', {
                id: tabInfo.id,
                url: tabInfo.url,
                active: tabInfo.active,
                windowId: tabInfo.windowId
              });
            } catch (getError) {
              console.error('[Restoration] ❌ Tab no longer exists:', {
                id: currentTab.id,
                error: getError.message
              });
              return;
            }
            
            // 同じウィンドウ内であることを確認
            const notebookTabInfo = await chrome.tabs.get(tabId);
            if (tabInfo.windowId !== notebookTabInfo.windowId) {
              console.warn('[Restoration] ⚠️ Tabs are in different windows!', {
                targetTab: { id: tabInfo.id, windowId: tabInfo.windowId },
                notebookTab: { id: notebookTabInfo.id, windowId: notebookTabInfo.windowId }
              });
            }
            
            console.log('[Restoration] Attempting to restore tab...');
            
            // タブをアクティブにする
            await chrome.tabs.update(currentTab.id, { active: true });
            console.log('[Restoration] ✅ Successfully restored tab!');
            
            // タブの状態を確認
            const restoredTab = await chrome.tabs.get(currentTab.id);
            console.log('[Restoration] Restored tab state:', {
              id: restoredTab.id,
              active: restoredTab.active,
              url: restoredTab.url
            });
            
            // NotebookLMタブをピン留め（復元後に実行）
            setTimeout(async () => {
              try {
                await chrome.tabs.update(tabId, { pinned: true });
                console.log('[Restoration] ✅ Successfully pinned NotebookLM tab');
              } catch (pinError) {
                console.error('[Restoration] ❌ Failed to pin tab:', {
                  tabId: tabId,
                  error: pinError.message
                });
              }
            }, 100);
            
          } catch (restoreError) {
            console.error('[Restoration] ❌ Failed to restore tab:', {
              error: restoreError.message,
              errorStack: restoreError.stack,
              tabId: currentTab.id,
              tabUrl: currentTab.url,
              errorType: restoreError.constructor.name
            });
            
            // エラーの種類に応じたメッセージ
            if (restoreError.message.includes('No tab with id')) {
              console.error('[Restoration] Tab was closed before restoration');
            } else if (restoreError.message.includes('permissions')) {
              console.error('[Restoration] Permission denied - Chrome API limitation');
            } else {
              console.error('[Restoration] Unknown error occurred');
            }
          }
          console.log('=== Tab restoration completed ===');
        }, 300); // より短時間に
      } else if (shouldRestoreTab && !currentTab) {
        console.warn('No tab to restore - currentTab is null');
        // これは通常発生しないはず（shouldRestoreTabがtrueの場合はcurrentTabが存在するため）
      } else if (!shouldRestoreTab && response && response.success) {
        // 復元するタブがない場合でも、初回再生後にピン留め
        console.log('No tab to restore, but will pin NotebookLM tab');
        setTimeout(async () => {
          try {
            await chrome.tabs.update(tabId, { pinned: true });
            console.log('[No restoration needed] Successfully pinned NotebookLM tab');
          } catch (e) {
            console.error('[No restoration needed] Failed to pin tab:', e);
          }
        }, 400);
      }
      
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
  
  // NotebookLMタブを表示
  tabBtn.addEventListener('click', () => {
    chrome.tabs.update(tabId, { active: true });
  });
  
  // 閉じるボタン
  closeBtn.addEventListener('click', async () => {
    simulation.stop();
    control.remove();
    // タブを削除する
    chrome.runtime.sendMessage({ action: 'releaseTab', tabId, autoClose: true });
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
  progressBar.title = getMessage('clickToSeekTitle');
  
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
    errorMsg.textContent = getMessage('audioTabClosedNotice');
    control.appendChild(errorMsg);
    
    // 3秒後にコントロールを削除
    setTimeout(() => {
      control.remove();
    }, 3000);
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
`;
document.head.appendChild(style);

// サポートリンクのセットアップ
function setupSupportLink() {
  const supportFooter = document.getElementById('support-footer');
  const supportLink = document.getElementById('support-link');
  
  if (!supportFooter || !supportLink) return;
  
  // 保存された状態を確認
  chrome.storage.local.get(['supportClicked'], (result) => {
    if (result.supportClicked) {
      supportFooter.classList.add('minimized');
    }
  });
  
  // クリックイベント
  supportLink.addEventListener('click', () => {
    // 状態を保存
    chrome.storage.local.set({ supportClicked: true });
    
    // 少し遅延を入れてから最小化
    setTimeout(() => {
      supportFooter.classList.add('minimized');
    }, 100);
  });
}