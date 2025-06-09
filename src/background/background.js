// Tab Pool Manager - inline implementation for Service Worker
class TabPoolManager {
  constructor() {
    this.pool = new Map(); // tabId -> poolEntry
    this.audioCache = new Map(); // notebookId -> audioInfo
    this.maxPoolSize = 5;  // 最大5つのタブを保持（より多くの音声を同時に管理）
    this.minPoolSize = 0;  // 最初はタブを作成しない
    this.autoCloseEnabled = true;  // 音声終了後の自動削除を有効化
    
    // タブグループ管理
    this.groupId = null;
    this.groupTitle = '📚 NotebookLM 音声';
    this.groupColor = 'blue';
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
      
      // バックグラウンドタブを作成（ユーザーに見えないように）
      const createProps = {
        url: 'about:blank',
        active: false,  // タブをアクティブにしない
        pinned: false,
        windowId: chrome.windows.WINDOW_ID_CURRENT,
        selected: false  // 古いAPIとの互換性のため
      };
      
      // タブを最後尾に配置
      if (tabIndex !== undefined) {
        createProps.index = tabIndex;
      }
      
      // タブを作成
      console.log('Creating tab with props:', createProps);
      const tab = await chrome.tabs.create(createProps);
      console.log('Tab created:', tab.id, 'active:', tab.active);
      
      // タブを即座にバックグラウンドに移動（確実に非表示にする）
      try {
        await chrome.tabs.update(tab.id, {
          active: false,
          muted: false  // 音声は出力される
        });
        console.log('Tab updated to inactive:', tab.id);
      } catch (e) {
        console.log('Tab update warning:', e);
      }
      
      const poolEntry = {
        tabId: tab.id,
        state: 'idle',
        notebookId: null,
        createdAt: Date.now(),
        lastUsed: null
      };
      
      this.pool.set(tab.id, poolEntry);
      console.log(`Created pooled tab: ${tab.id}`);
      
      // タブをグループに追加
      await this.addTabToGroup(tab.id);
      
      return tab.id;
    } catch (error) {
      console.error('Failed to create pooled tab:', error);
      // エラーを投げずにnullを返す
      return null;
    }
  }

  async getAvailableTab(notebookId) {
    // TabFocusManagerで現在のタブを記録
    if (tabFocusManager) {
      await tabFocusManager.recordCurrentActiveTab();
    }
    
    // まず、このノートブックに既に割り当てられているタブがあるかチェック
    for (const [tabId, entry] of this.pool.entries()) {
      if (entry.notebookId === notebookId && await this.isTabAlive(tabId)) {
        console.log(`Reusing existing tab for notebook ${notebookId}: ${tabId}`);
        entry.state = 'in_use';
        entry.lastUsed = Date.now();
        return tabId;
      }
    }
    
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
      // バックグラウンドでナビゲート（タブを切り替えない）
      await chrome.tabs.update(tabId, { 
        url: url,
        active: false  // タブをアクティブにしない
      });
      
      // ナビゲーションの開始を待つ
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // タブが勝手にアクティブにならないよう再確認
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.active) {
          // 元のタブに戻す
          const windows = await chrome.windows.getAll({ populate: true });
          for (const window of windows) {
            const previousTab = window.tabs.find(t => t.id !== tabId && t.active === false);
            if (previousTab) {
              await chrome.tabs.update(previousTab.id, { active: true });
              break;
            }
          }
        }
      } catch (e) {
        console.log('Tab focus check failed:', e);
      }
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
          // プールからも削除
          this.pool.delete(tabId);
          // キャッシュからも削除
          if (poolEntry.notebookId) {
            const cachedInfo = this.audioCache.get(poolEntry.notebookId);
            if (cachedInfo && cachedInfo.tabId === tabId) {
              this.audioCache.delete(poolEntry.notebookId);
            }
          }
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
      
      // キャッシュからも削除
      if (poolEntry.notebookId) {
        const cachedInfo = this.audioCache.get(poolEntry.notebookId);
        if (cachedInfo && cachedInfo.tabId === tabId) {
          this.audioCache.delete(poolEntry.notebookId);
        }
      }
      
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

  /**
   * タブグループを取得または作成
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
      // Chrome 89以降でのみ利用可能
      if (!chrome.tabGroups) {
        console.log('Tab groups API not available');
        return;
      }

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
}

// Initialize tab pool manager
let tabPoolManager = null;

// Initialize stats collector
let statsCollector = null;

// Initialize tab focus manager
let tabFocusManager = null;

// Stats Collector - inline implementation for Service Worker
class StatsCollector {
  constructor() {
    this.STORAGE_KEY = 'notebookStats';
    this.SESSION_KEY = 'activeSessions';
    this.currentSessions = new Map();
  }

  static getInstance() {
    if (!StatsCollector.instance) {
      StatsCollector.instance = new StatsCollector();
    }
    return StatsCollector.instance;
  }

  async startSession(notebookId, notebookTitle, icon = '📚') {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      sessionId,
      notebookId,
      notebookTitle,
      icon,
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      completionRate: 0,
      events: [{
        type: 'start',
        timestamp: new Date().toISOString()
      }],
      isPaused: false,
      pausedDuration: 0
    };

    this.currentSessions.set(sessionId, session);
    await this.saveActiveSessions();
    
    return sessionId;
  }

  async endSession(sessionId, completionRate = 0) {
    const session = this.currentSessions.get(sessionId);
    if (!session) return;

    session.endTime = new Date().toISOString();
    session.completionRate = Math.min(1, Math.max(0, completionRate));
    
    const totalTime = new Date(session.endTime) - new Date(session.startTime);
    session.duration = Math.round((totalTime - session.pausedDuration) / 1000);

    session.events.push({
      type: 'end',
      timestamp: session.endTime,
      completionRate: session.completionRate
    });

    await this.saveSessionToStats(session);
    
    this.currentSessions.delete(sessionId);
    await this.saveActiveSessions();
  }

  async recordEvent(sessionId, eventType, metadata = {}) {
    const session = this.currentSessions.get(sessionId);
    if (!session) return;

    session.events.push({
      type: eventType,
      timestamp: new Date().toISOString(),
      ...metadata
    });

    await this.saveActiveSessions();
  }

  async saveActiveSessions() {
    const sessions = Array.from(this.currentSessions.values());
    await chrome.storage.local.set({ [this.SESSION_KEY]: sessions });
  }

  async saveSessionToStats(session) {
    try {
      const stats = await this.getStats();
      
      if (!stats.sessions) stats.sessions = [];
      stats.sessions.push(session);

      const date = new Date(session.startTime).toISOString().split('T')[0];
      if (!stats.dailyStats) stats.dailyStats = {};
      if (!stats.dailyStats[date]) {
        stats.dailyStats[date] = {
          totalSessions: 0,
          totalDuration: 0,
          uniqueNotebooks: [],
          completedSessions: 0
        };
      }

      const dailyStat = stats.dailyStats[date];
      dailyStat.totalSessions++;
      dailyStat.totalDuration += session.duration;
      if (!dailyStat.uniqueNotebooks.includes(session.notebookId)) {
        dailyStat.uniqueNotebooks.push(session.notebookId);
      }
      if (session.completionRate >= 0.9) {
        dailyStat.completedSessions++;
      }

      // 90日以上前のセッションを削除
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      stats.sessions = stats.sessions.filter(s => 
        new Date(s.startTime) > ninetyDaysAgo
      );

      await chrome.storage.local.set({ [this.STORAGE_KEY]: stats });
    } catch (error) {
      console.error('Failed to save session stats:', error);
    }
  }

  async getStats() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || {
        sessions: [],
        dailyStats: {},
        notebookStats: {}
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        sessions: [],
        dailyStats: {},
        notebookStats: {}
      };
    }
  }
}

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
initializeStatsCollector();

async function initializeStatsCollector() {
  if (!statsCollector) {
    try {
      statsCollector = StatsCollector.getInstance();
      console.log('Stats collector initialized successfully');
    } catch (error) {
      console.error('Failed to initialize stats collector:', error);
    }
  }
}

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

// Tab Focus Manager - inline implementation
class TabFocusManager {
  constructor() {
    this.userActiveTab = null;
    this.isManagingFocus = false;
  }

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
}

async function initializeTabFocusManager() {
  if (!tabFocusManager) {
    try {
      tabFocusManager = new TabFocusManager();
      tabFocusManager.initialize();
      console.log('Tab focus manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize tab focus manager:', error);
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
  // 非同期処理のためのラッパー関数
  (async () => {
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
  } else if (request.action === 'startStatsSession') {
    // Start statistics session
    if (!statsCollector) await initializeStatsCollector();
    const sessionId = await statsCollector.startSession(
      request.notebookId,
      request.notebookTitle,
      request.icon
    );
    sendResponse(sessionId);
  } else if (request.action === 'endStatsSession') {
    // End statistics session
    if (statsCollector && request.sessionId) {
      await statsCollector.endSession(request.sessionId, request.completionRate || 0);
    }
    sendResponse({ success: true });
  } else if (request.action === 'recordStatsEvent') {
    // Record statistics event
    if (statsCollector && request.sessionId) {
      await statsCollector.recordEvent(
        request.sessionId,
        request.eventType,
        request.metadata
      );
    }
    sendResponse({ success: true });
  }
  })();
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

// 拡張機能が起動したときの初期化
chrome.runtime.onStartup.addListener(async () => {
  await initializeTabPoolManager();
  await initializeStatsCollector();
  await initializeTabFocusManager();
});

// 拡張機能がインストール/更新されたときの初期化
chrome.runtime.onInstalled.addListener(async () => {
  await initializeTabPoolManager();
  await initializeStatsCollector();
  await initializeTabFocusManager();
});