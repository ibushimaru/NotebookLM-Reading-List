// Tab Pool Manager - inline implementation for Service Worker
class TabPoolManager {
  constructor() {
    this.pool = new Map(); // tabId -> poolEntry
    this.audioCache = new Map(); // notebookId -> audioInfo
    this.maxPoolSize = 5;  // 最大5つのタブを保持（より多くの音声を同時に管理）
    this.minPoolSize = 0;  // 最初はタブを作成しない
    this.autoCloseEnabled = true;  // 音声終了後の自動削除を有効化
  }

  async initialize() {
    console.log('Initializing tab pool manager...');
    
    // Set up tab event listeners
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });
    
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === 'unloaded') {
        this.handleTabCrashed(tabId);
      }
    });
    
    // Create initial pooled tabs
    await this.ensureMinimumPool();
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    console.log('Tab pool manager initialized');
  }

  async ensureMinimumPool() {
    const idleCount = Array.from(this.pool.values()).filter(entry => entry.state === 'idle').length;
    const needed = Math.max(0, this.minPoolSize - idleCount);
    
    for (let i = 0; i < needed; i++) {
      try {
        await this.createPooledTab();
      } catch (error) {
        console.error('Failed to create pooled tab:', error);
      }
    }
  }

  async createPooledTab() {
    if (this.pool.size >= this.maxPoolSize) {
      console.log('Pool is at max size, cannot create new tab');
      return null;
    }
    
    try {
      // 現在のウィンドウを取得（populateなしで試す）
      let tabIndex;
      try {
        const currentWindow = await chrome.windows.getCurrent({ populate: true });
        tabIndex = currentWindow.tabs ? currentWindow.tabs.length : undefined;
      } catch (e) {
        console.warn('Failed to get current window info:', e);
        tabIndex = undefined;
      }
      
      const createProps = {
        url: 'about:blank',
        active: false,
        pinned: false
      };
      
      // indexはオプショナル
      if (tabIndex !== undefined) {
        createProps.index = tabIndex;
      }
      
      const tab = await chrome.tabs.create(createProps);
      
      const poolEntry = {
        tabId: tab.id,
        state: 'idle',
        notebookId: null,
        createdAt: Date.now(),
        lastUsed: null
      };
      
      this.pool.set(tab.id, poolEntry);
      console.log(`Created pooled tab: ${tab.id}`);
      return tab.id;
    } catch (error) {
      console.error('Failed to create pooled tab:', error);
      // エラーを投げずにnullを返す
      return null;
    }
  }

  async getAvailableTab(notebookId) {
    // Check if we have a cached tab for this notebook
    const cachedInfo = this.audioCache.get(notebookId);
    if (cachedInfo && cachedInfo.tabId) {
      const poolEntry = this.pool.get(cachedInfo.tabId);
      if (poolEntry && await this.isTabAlive(cachedInfo.tabId)) {
        poolEntry.state = 'in_use';
        poolEntry.lastUsed = Date.now();
        poolEntry.notebookId = notebookId;
        return cachedInfo.tabId;
      }
    }
    
    // Find an idle tab
    let availableTab = null;
    for (const [tabId, entry] of this.pool.entries()) {
      if (entry.state === 'idle' && await this.isTabAlive(tabId)) {
        availableTab = entry;
        availableTab.tabId = tabId;
        break;
      }
    }
    
    // Create new tab if none available
    if (!availableTab) {
      const newTabId = await this.createPooledTab();
      if (!newTabId) {
        // プールが満杯の場合、一番古いタブを再利用（idleまたはin-use）
        const oldestTab = Array.from(this.pool.values())
          .sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0))[0];
        
        if (oldestTab) {
          availableTab = oldestTab;
          console.log(`Reusing oldest tab (${oldestTab.state}):`, availableTab.tabId);
          
          // 使用中のタブの場合、現在の音声を停止
          if (oldestTab.state === 'in-use') {
            try {
              await chrome.tabs.sendMessage(oldestTab.tabId, {
                action: 'controlAudio',
                command: 'pause'
              });
            } catch (e) {
              console.log('Failed to pause audio in reused tab:', e);
            }
          }
        } else {
          throw new Error('No available tabs in pool and cannot create new one');
        }
      } else {
        availableTab = this.pool.get(newTabId);
        availableTab.tabId = newTabId;
      }
    }
    
    // Mark as in use
    availableTab.state = 'in_use';
    availableTab.notebookId = notebookId;
    availableTab.lastUsed = Date.now();
    
    // タブが自動的に削除されないように保護
    try {
      await chrome.tabs.update(availableTab.tabId, { 
        autoDiscardable: false,
        pinned: false 
      });
    } catch (e) {
      console.log('Failed to protect tab from auto-discard:', e);
    }
    
    return availableTab.tabId;
  }

  async navigateTab(tabId, url) {
    try {
      await chrome.tabs.update(tabId, { url });
      // Wait a bit for navigation to start
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Failed to navigate tab:', error);
      throw error;
    }
  }

  releaseTab(tabId, autoClose = false) {
    const poolEntry = this.pool.get(tabId);
    if (poolEntry) {
      if (autoClose) {
        // 音声再生終了時はタブを削除
        try {
          chrome.tabs.remove(tabId);
          console.log(`Auto-closed tab ${tabId} after audio ended`);
        } catch (error) {
          console.error('Failed to auto-close tab:', error);
        }
      } else {
        poolEntry.state = 'idle';
        poolEntry.lastUsed = Date.now();
        console.log(`Released tab ${tabId} back to pool`);
      }
    }
    
    // Ensure we maintain minimum pool size
    setTimeout(() => this.ensureMinimumPool(), 1000);
  }

  getCachedAudioInfo(tabId) {
    const poolEntry = this.pool.get(tabId);
    if (!poolEntry || !poolEntry.notebookId) return null;
    
    return this.audioCache.get(poolEntry.notebookId);
  }

  cacheAudioInfo(tabId, audioInfo) {
    const poolEntry = this.pool.get(tabId);
    if (poolEntry && poolEntry.notebookId) {
      this.audioCache.set(poolEntry.notebookId, {
        ...audioInfo,
        tabId,
        cachedAt: Date.now()
      });
      console.log(`Cached audio info for notebook ${poolEntry.notebookId}`);
    }
  }

  async isTabAlive(tabId) {
    try {
      await chrome.tabs.get(tabId);
      return true;
    } catch {
      return false;
    }
  }

  handleTabRemoved(tabId) {
    const poolEntry = this.pool.get(tabId);
    if (poolEntry) {
      console.log(`Tab ${tabId} was removed from pool`);
      
      // 再生中のタブの場合は警告
      if (poolEntry.state === 'in_use') {
        console.warn(`Active audio tab ${tabId} was removed while in use`);
        
        // サイドパネルに通知を送信
        try {
          chrome.runtime.sendMessage({
            action: 'tabRemoved',
            tabId: tabId,
            notebookId: poolEntry.notebookId
          });
        } catch (e) {
          // エラーを無視
        }
      }
      
      this.pool.delete(tabId);
      
      // Remove from cache if it was cached
      if (poolEntry.notebookId) {
        const cachedInfo = this.audioCache.get(poolEntry.notebookId);
        if (cachedInfo && cachedInfo.tabId === tabId) {
          // キャッシュは保持するが、tabIdだけクリア
          cachedInfo.tabId = null;
        }
      }
      
      // Maintain minimum pool
      setTimeout(() => this.ensureMinimumPool(), 1000);
    }
  }

  handleTabCrashed(tabId) {
    console.log(`Tab ${tabId} crashed`);
    this.handleTabRemoved(tabId);
  }

  startPeriodicCleanup() {
    // Clean up every 5 minutes
    setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000);
  }

  async performCleanup() {
    const now = Date.now();
    const maxIdleTime = 60 * 60 * 1000; // 60分に延長（音声を長く保持）
    const maxCacheTime = 3 * 60 * 60 * 1000; // 3時間キャッシュ保持
    
    // Clean up old idle tabs
    for (const [tabId, entry] of this.pool.entries()) {
      if (entry.state === 'idle' && 
          entry.lastUsed && 
          (now - entry.lastUsed) > maxIdleTime) {
        try {
          await chrome.tabs.remove(tabId);
          console.log(`Removed stale tab ${tabId}`);
        } catch (error) {
          console.error('Failed to remove stale tab:', error);
        }
      }
    }
    
    // Clean up old cache entries
    for (const [notebookId, cacheEntry] of this.audioCache.entries()) {
      if ((now - cacheEntry.cachedAt) > maxCacheTime) {
        this.audioCache.delete(notebookId);
        console.log(`Removed stale cache for notebook ${notebookId}`);
      }
    }
    
    // Ensure minimum pool
    await this.ensureMinimumPool();
  }

  getStats() {
    const entries = Array.from(this.pool.values());
    return {
      totalTabs: this.pool.size,
      idleTabs: entries.filter(e => e.state === 'idle').length,
      inUseTabs: entries.filter(e => e.state === 'in_use').length,
      cacheSize: this.audioCache.size,
      tabs: entries.map(e => ({
        tabId: e.tabId,
        state: e.state,
        notebookId: e.notebookId,
        lastUsed: e.lastUsed
      }))
    };
  }
}

// Initialize tab pool manager
let tabPoolManager = null;

// Initialize on extension install or startup
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/updated');
  await initializeTabPoolManager();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension started');
  await initializeTabPoolManager();
});

// Also initialize immediately for development
initializeTabPoolManager();

async function initializeTabPoolManager() {
  if (!tabPoolManager) {
    try {
      tabPoolManager = new TabPoolManager();
      await tabPoolManager.initialize();
      console.log('Tab pool manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize tab pool manager:', error);
      // フォールバックとして最小限の機能を提供
      tabPoolManager = {
        getAvailableTab: async (notebookId) => {
          // シンプルに新しいタブを作成
          const tab = await chrome.tabs.create({
            url: 'https://notebooklm.google.com',
            active: false
          });
          return tab.id;
        },
        navigateTab: async (tabId, url) => {
          await chrome.tabs.update(tabId, { url });
        },
        releaseTab: (tabId) => {
          // 即座にタブを削除
          chrome.tabs.remove(tabId).catch(() => {});
        },
        getCachedAudioInfo: () => null,
        cacheAudioInfo: () => {},
        getStats: () => ({ totalTabs: 0, idleTabs: 0, inUseTabs: 0 })
      };
    }
  }
}

// サイドパネルの設定
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// 拡張機能のアイコンクリック時の処理
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// メッセージリスナー（コンテントスクリプトとの通信用）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // シンプルなオフスクリーンAPIのテスト処理
  if (request.action === 'offscreenSimpleTest') {
    (async () => {
      try {
        console.log('Simple offscreen test request:', request);
        
        // フィーチャーフラグを確認
        const stored = await chrome.storage.local.get('featureFlags');
        const features = stored.featureFlags || {};
        
        if (!features.USE_OFFSCREEN_API) {
          sendResponse({ success: false, error: 'Offscreen API is disabled' });
          return;
        }
        
        // オフスクリーンドキュメントを作成
        await ensureOffscreenDocument();
        
        // シンプルコントローラーを使用
        let response;
        switch (request.command) {
          case 'openNotebook':
            response = await chrome.runtime.sendMessage({
              target: 'offscreen-simple',
              action: 'openNotebook',
              notebookUrl: request.notebookUrl
            });
            break;
            
          case 'getAudioInfo':
            response = await chrome.runtime.sendMessage({
              target: 'offscreen-simple',
              action: 'getAudioInfo'
            });
            break;
            
          case 'controlAudio':
            response = await chrome.runtime.sendMessage({
              target: 'offscreen-simple',
              action: 'controlAudio',
              command: request.audioCommand
            });
            break;
            
          default:
            response = { success: false, error: 'Unknown command' };
        }
        
        sendResponse(response);
      } catch (error) {
        console.error('Simple offscreen test error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  // オフスクリーンAPIのテスト処理
  if (request.action === 'offscreenTest') {
    (async () => {
      try {
        console.log('Offscreen test request:', request);
        
        // フィーチャーフラグを確認
        const stored = await chrome.storage.local.get('featureFlags');
        const features = stored.featureFlags || {};
        
        if (!features.USE_OFFSCREEN_API) {
          sendResponse({ success: false, error: 'Offscreen API is disabled' });
          return;
        }
        
        // オフスクリーンドキュメントを作成
        try {
          // chrome.runtime.getContexts が使えない場合があるので、try-catchで処理
          let needsCreation = true;
          
          if (chrome.runtime.getContexts) {
            const existingContexts = await chrome.runtime.getContexts({
              contextTypes: ['OFFSCREEN_DOCUMENT']
            });
            needsCreation = existingContexts.length === 0;
          } else {
            // getContextsが使えない場合は、hasDocumentを使用
            needsCreation = !(await chrome.offscreen.hasDocument());
          }
          
          if (needsCreation) {
            await chrome.offscreen.createDocument({
              url: chrome.runtime.getURL('src/offscreen/offscreen.html'),
              reasons: ['IFRAME_SCRIPTING', 'AUDIO_PLAYBACK', 'DOM_SCRAPING'],
              justification: 'NotebookLMをバックグラウンドで操作して音声を再生'
            });
            console.log('Offscreen document created');
            
            // ドキュメントが読み込まれるまで少し待つ
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            console.log('Offscreen document already exists');
          }
        } catch (error) {
          console.error('Failed to create offscreen document:', error);
          throw error;
        }
        
        // コマンドに応じて処理
        let response;
        switch (request.command) {
          case 'loadNotebook':
            response = await sendToOffscreenWithIframe({
              action: 'loadNotebook',
              notebookUrl: request.notebookUrl
            });
            break;
            
          case 'getAudioInfo':
            response = await sendToOffscreenWithIframe({
              action: 'getAudioInfo'
            });
            break;
            
          case 'controlAudio':
            response = await sendToOffscreenWithIframe({
              action: 'controlAudio',
              command: request.audioCommand
            });
            break;
            
          default:
            response = { success: false, error: 'Unknown command' };
        }
        
        sendResponse(response);
      } catch (error) {
        console.error('Offscreen test error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'getNotebooks') {
    // NotebookLMから取得したデータをサイドパネルに送信
    chrome.runtime.sendMessage({
      action: 'updateNotebooks',
      data: request.data
    });
  } else if (request.action === 'audioProgressUpdate') {
    // 音声進行状況の更新をサイドパネルに転送
    chrome.runtime.sendMessage({
      action: 'audioProgressUpdate',
      data: request.data,
      tabId: sender.tab?.id
    });
  } else if (request.action === 'getPooledTab') {
    // Handle tab pool requests
    handleTabPoolRequest(request, sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'releaseTab') {
    // Release tab back to pool
    if (tabPoolManager) {
      tabPoolManager.releaseTab(request.tabId, request.autoClose);
    }
    sendResponse({ success: true });
  } else if (request.action === 'getPoolStats') {
    // Get pool statistics
    const stats = tabPoolManager ? tabPoolManager.getStats() : null;
    sendResponse({ stats });
  } else if (request.action === 'cacheAudioInfo') {
    // Cache audio info for a tab
    if (tabPoolManager && request.tabId && request.audioInfo) {
      tabPoolManager.cacheAudioInfo(request.tabId, request.audioInfo);
    }
    sendResponse({ success: true });
  } else if (request.action === 'injectScriptToOffscreenIframe') {
    // Inject script into offscreen iframe
    handleOffscreenIframeInjection(request, sendResponse);
    return true;
  } else if (request.action === 'sendToIframeScript') {
    // Send message to iframe script
    handleSendToIframeScript(request, sendResponse);
    return true;
  } else if (request.action === 'createNotebookTab') {
    // Create a new tab for NotebookLM
    (async () => {
      try {
        const tab = await chrome.tabs.create({
          url: request.url,
          active: request.active || false
        });
        sendResponse({ success: true, tabId: tab.id });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  return true;
});

// Handle tab pool requests
async function handleTabPoolRequest(request, sendResponse) {
  try {
    if (!tabPoolManager) {
      await initializeTabPoolManager();
    }
    
    // Get an available tab from the pool
    const tabId = await tabPoolManager.getAvailableTab(request.notebookId);
    
    // If a specific notebook URL is requested, navigate to it
    if (request.notebookUrl) {
      await tabPoolManager.navigateTab(tabId, request.notebookUrl);
    }
    
    // Check for cached audio info
    const cachedAudioInfo = tabPoolManager.getCachedAudioInfo(tabId);
    
    sendResponse({ 
      success: true, 
      tabId,
      cachedAudioInfo
    });
  } catch (error) {
    console.error('Tab pool request error:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Offscreenドキュメントの作成
async function createOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  
  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('src/offscreen/offscreen.html'),
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'NotebookLMの音声概要を再生するため'
  });
}

// Offscreenドキュメントの作成（確実に作成）
async function ensureOffscreenDocument() {
  try {
    // chrome.runtime.getContexts が使えない場合があるので、try-catchで処理
    let needsCreation = true;
    
    if (chrome.runtime.getContexts) {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      needsCreation = existingContexts.length === 0;
    } else {
      // getContextsが使えない場合は、hasDocumentを使用
      needsCreation = !(await chrome.offscreen.hasDocument());
    }
    
    if (needsCreation) {
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('src/offscreen/offscreen.html'),
        reasons: ['IFRAME_SCRIPTING', 'AUDIO_PLAYBACK', 'DOM_SCRAPING'],
        justification: 'NotebookLMをバックグラウンドで操作して音声を再生'
      });
      console.log('Offscreen document created');
      
      // ドキュメントが読み込まれるまで少し待つ
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('Offscreen document already exists');
    }
  } catch (error) {
    console.error('Failed to create offscreen document:', error);
    throw error;
  }
}

// Offscreenドキュメントへのメッセージ送信
async function sendToOffscreen(message) {
  await createOffscreenDocument();
  
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      ...message,
      target: 'offscreen'
    }, response => {
      resolve(response);
    });
  });
}

// Offscreenドキュメントへのメッセージ送信（iframe対応）
async function sendToOffscreenWithIframe(message) {
  console.log('Sending to offscreen:', message);
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      ...message,
      target: 'offscreen'
    }, response => {
      console.log('Offscreen response:', response);
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response || { success: false, error: 'No response' });
      }
    });
    
    // タイムアウト設定
    setTimeout(() => {
      reject(new Error('Offscreen request timeout'));
    }, 30000);
  });
}

// Offscreen iframe内にスクリプトを注入
async function handleOffscreenIframeInjection(request, sendResponse) {
  try {
    console.log('Injecting script into offscreen iframe:', request.iframeSrc);
    
    // オフスクリーンドキュメントが存在することを確認
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (contexts.length === 0) {
      throw new Error('No offscreen document found');
    }
    
    // NotebookLMのタブを探す（オフスクリーン内のiframeのURL）
    const tabs = await chrome.tabs.query({
      url: 'https://notebooklm.google.com/*'
    });
    
    // オフスクリーンドキュメント内のiframeは通常のタブとして扱えないため、
    // 別のアプローチが必要
    console.log('Found tabs:', tabs.length);
    
    // オフスクリーン内のiframeには直接スクリプトを注入できないため、
    // コンテントスクリプトが自動的に注入されることを期待
    sendResponse({ 
      success: true, 
      note: 'Content script should be auto-injected via manifest.json' 
    });
  } catch (error) {
    console.error('Failed to inject script:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// iframe内のスクリプトにメッセージを送信
async function handleSendToIframeScript(request, sendResponse) {
  try {
    console.log('Sending message to iframe script:', request.message);
    
    // NotebookLMのタブを探す
    const tabs = await chrome.tabs.query({
      url: ['https://notebooklm.google.com/*', 'https://notebooklm.google/*']
    });
    
    console.log('Found NotebookLM tabs:', tabs.length);
    
    if (tabs.length === 0) {
      sendResponse({ status: 'error', error: 'No NotebookLM tabs found' });
      return;
    }
    
    // 各タブに順番にメッセージを送信
    for (const tab of tabs) {
      try {
        console.log('Trying tab:', tab.id, tab.url);
        const response = await chrome.tabs.sendMessage(tab.id, request.message);
        if (response) {
          console.log('Got response from tab:', tab.id, response);
          sendResponse(response);
          return;
        }
      } catch (error) {
        console.log('Tab', tab.id, 'did not respond:', error.message);
      }
    }
    
    // どのタブからも応答がない場合
    sendResponse({ status: 'error', error: 'No response from any NotebookLM tab' });
  } catch (error) {
    console.error('Failed to send message to iframe script:', error);
    sendResponse({ success: false, error: error.message });
  }
}