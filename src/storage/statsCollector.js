/**
 * 学習統計を収集・管理するクラス
 * Chrome Extension の Storage API を使用してデータを永続化
 */
class StatsCollector {
  constructor() {
    this.STORAGE_KEY = 'notebookStats';
    this.SESSION_KEY = 'activeSessions';
    this.currentSessions = new Map();
  }

  /**
   * シングルトンインスタンスを取得
   * @returns {StatsCollector} StatsCollectorのインスタンス
   */
  static getInstance() {
    if (!StatsCollector.instance) {
      StatsCollector.instance = new StatsCollector();
    }
    return StatsCollector.instance;
  }

  /**
   * 新しいセッションを開始
   * @param {string} notebookId - ノートブックのID
   * @param {string} notebookTitle - ノートブックのタイトル
   * @param {string} icon - ノートブックのアイコン
   * @returns {Promise<string>} セッションID
   */
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

  /**
   * セッションを終了
   * @param {string} sessionId - セッションID
   * @param {number} completionRate - 完了率 (0-1)
   */
  async endSession(sessionId, completionRate = 0) {
    const session = this.currentSessions.get(sessionId);
    if (!session) return;

    session.endTime = new Date().toISOString();
    session.completionRate = Math.min(1, Math.max(0, completionRate));
    
    // 総時間を計算（一時停止時間を除く）
    const totalTime = new Date(session.endTime) - new Date(session.startTime);
    session.duration = Math.round((totalTime - session.pausedDuration) / 1000);

    // 終了イベントを記録
    session.events.push({
      type: 'end',
      timestamp: session.endTime,
      completionRate: session.completionRate
    });

    // 統計に保存
    await this.saveSessionToStats(session);
    
    // アクティブセッションから削除
    this.currentSessions.delete(sessionId);
    await this.saveActiveSessions();
  }

  /**
   * セッションにイベントを記録
   * @param {string} sessionId - セッションID
   * @param {string} eventType - イベントタイプ
   * @param {Object} metadata - イベントのメタデータ
   */
  async recordEvent(sessionId, eventType, metadata = {}) {
    const session = this.currentSessions.get(sessionId);
    if (!session) return;

    session.events.push({
      type: eventType,
      timestamp: new Date().toISOString(),
      ...metadata
    });

    // 一時停止/再開の処理
    if (eventType === 'pause' && !session.isPaused) {
      session.isPaused = true;
      session.pauseStartTime = Date.now();
    } else if (eventType === 'resume' && session.isPaused) {
      session.isPaused = false;
      if (session.pauseStartTime) {
        session.pausedDuration += Date.now() - session.pauseStartTime;
        delete session.pauseStartTime;
      }
    }

    await this.saveActiveSessions();
  }

  /**
   * アクティブなセッションを保存
   */
  async saveActiveSessions() {
    const sessions = Array.from(this.currentSessions.values());
    await chrome.storage.local.set({ [this.SESSION_KEY]: sessions });
  }

  /**
   * セッションを統計データに保存
   * @param {Object} session - セッションデータ
   */
  async saveSessionToStats(session) {
    try {
      const stats = await this.getStats();
      
      // セッションを追加
      if (!stats.sessions) stats.sessions = [];
      stats.sessions.push(session);

      // 日別統計を更新
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

      // ノートブック別統計を更新
      if (!stats.notebookStats) stats.notebookStats = {};
      if (!stats.notebookStats[session.notebookId]) {
        stats.notebookStats[session.notebookId] = {
          notebookTitle: session.notebookTitle,
          icon: session.icon,
          totalPlays: 0,
          totalDuration: 0,
          avgCompletionRate: 0,
          lastAccessed: null,
          sessions: []
        };
      }

      const notebookStat = stats.notebookStats[session.notebookId];
      notebookStat.totalPlays++;
      notebookStat.totalDuration += session.duration;
      notebookStat.lastAccessed = session.endTime;
      notebookStat.sessions.push({
        sessionId: session.sessionId,
        startTime: session.startTime,
        duration: session.duration,
        completionRate: session.completionRate
      });

      // 平均完了率を再計算
      const completionRates = notebookStat.sessions.map(s => s.completionRate);
      notebookStat.avgCompletionRate = completionRates.reduce((a, b) => a + b, 0) / completionRates.length;

      // 90日以上前のセッションを削除
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      stats.sessions = stats.sessions.filter(s => 
        new Date(s.startTime) > ninetyDaysAgo
      );

      // 各ノートブックのセッションも整理
      Object.keys(stats.notebookStats).forEach(notebookId => {
        const notebook = stats.notebookStats[notebookId];
        notebook.sessions = notebook.sessions.filter(s => 
          new Date(s.startTime) > ninetyDaysAgo
        );
        // セッションがなくなったノートブックは削除
        if (notebook.sessions.length === 0) {
          delete stats.notebookStats[notebookId];
        }
      });

      // ストレージ使用量をチェック
      await this.checkStorageQuota(stats);

      await chrome.storage.local.set({ [this.STORAGE_KEY]: stats });
    } catch (error) {
      console.error('Failed to save session stats:', error);
      // エラー時の処理
      if (error.message && error.message.includes('QUOTA_BYTES')) {
        // ストレージ容量超過時は古いデータを削除
        await this.cleanupOldData();
      }
    }
  }

  /**
   * ストレージ使用量をチェックし、必要に応じて警告
   * @param {Object} stats - 統計データ
   */
  async checkStorageQuota(stats) {
    if (chrome.storage.local.getBytesInUse) {
      const bytesInUse = await chrome.storage.local.getBytesInUse(null);
      const quota = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB
      const usagePercent = (bytesInUse / quota) * 100;
      
      if (usagePercent > 80) {
        console.warn(`Storage usage is at ${usagePercent.toFixed(1)}%`);
        // 使用量が80%を超えたら古いデータを積極的に削除
        await this.cleanupOldData(30); // 30日以上前のデータを削除
      }
    }
  }

  /**
   * 古いデータを削除
   * @param {number} daysToKeep - 保持する日数
   */
  async cleanupOldData(daysToKeep = 90) {
    const stats = await this.getStats();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    // 古いセッションを削除
    stats.sessions = stats.sessions.filter(s => 
      new Date(s.startTime) > cutoffDate
    );
    
    // 古い日別統計を削除
    Object.keys(stats.dailyStats).forEach(date => {
      if (new Date(date) < cutoffDate) {
        delete stats.dailyStats[date];
      }
    });
    
    // ノートブック統計も更新
    Object.keys(stats.notebookStats).forEach(notebookId => {
      const notebook = stats.notebookStats[notebookId];
      notebook.sessions = notebook.sessions.filter(s => 
        new Date(s.startTime) > cutoffDate
      );
      if (notebook.sessions.length === 0) {
        delete stats.notebookStats[notebookId];
      }
    });
    
    await chrome.storage.local.set({ [this.STORAGE_KEY]: stats });
  }

  /**
   * 統計データを取得
   * @returns {Promise<Object>} 統計データ
   */
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

  /**
   * アクティブなセッションを復元
   */
  async restoreActiveSessions() {
    try {
      const result = await chrome.storage.local.get(this.SESSION_KEY);
      const sessions = result[this.SESSION_KEY] || [];
      
      sessions.forEach(session => {
        this.currentSessions.set(session.sessionId, session);
      });
      
      console.log(`Restored ${sessions.length} active sessions`);
    } catch (error) {
      console.error('Failed to restore active sessions:', error);
    }
  }

  /**
   * すべての統計データをクリア
   */
  async clearAllStats() {
    await chrome.storage.local.remove([this.STORAGE_KEY, this.SESSION_KEY]);
    this.currentSessions.clear();
  }

  /**
   * 統計データをエクスポート
   * @param {string} format - エクスポート形式 ('json' または 'csv')
   * @returns {Promise<string>} エクスポートされたデータ
   */
  async exportStats(format = 'json') {
    const stats = await this.getStats();
    
    if (format === 'json') {
      return JSON.stringify(stats, null, 2);
    } else if (format === 'csv') {
      // CSV形式でエクスポート（BOM付きでExcel対応）
      let csv = '\uFEFF' + 'Date,Notebook,Duration(sec),CompletionRate\n';
      stats.sessions.forEach(session => {
        const date = new Date(session.startTime).toISOString().split('T')[0];
        csv += `${date},"${session.notebookTitle}",${session.duration},${session.completionRate}\n`;
      });
      return csv;
    }
    
    throw new Error('Unsupported export format');
  }
}

// Chrome Extension環境でのエクスポート
if (typeof chrome !== 'undefined' && chrome.storage) {
  // グローバルに公開（background scriptから使用するため）
  window.StatsCollector = StatsCollector;
}