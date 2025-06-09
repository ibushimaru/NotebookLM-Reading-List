/**
 * 統計データ収集クラス
 * ユーザーの学習活動を記録し、統計データとして保存する
 */
class StatsCollector {
  constructor() {
    this.STORAGE_KEY = 'notebookStats';
    this.SESSION_KEY = 'activeSessions';
    this.currentSessions = new Map();
  }

  /**
   * インスタンスを取得（シングルトン）
   */
  static getInstance() {
    if (!StatsCollector.instance) {
      StatsCollector.instance = new StatsCollector();
    }
    return StatsCollector.instance;
  }

  /**
   * セッションを開始
   * @param {string} notebookId - ノートブックID
   * @param {string} notebookTitle - ノートブックタイトル
   * @param {string} icon - ノートブックアイコン
   * @returns {string} セッションID
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
   * @param {number} completionRate - 完了率（0-1）
   */
  async endSession(sessionId, completionRate = 0) {
    const session = this.currentSessions.get(sessionId);
    if (!session) return;

    session.endTime = new Date().toISOString();
    session.completionRate = Math.min(1, Math.max(0, completionRate));
    
    // 実際の再生時間を計算（一時停止時間を除く）
    const totalTime = new Date(session.endTime) - new Date(session.startTime);
    session.duration = Math.round((totalTime - session.pausedDuration) / 1000); // 秒単位

    session.events.push({
      type: 'end',
      timestamp: session.endTime,
      completionRate: session.completionRate
    });

    // 統計データに保存
    await this.saveSessionToStats(session);
    
    // アクティブセッションから削除
    this.currentSessions.delete(sessionId);
    await this.saveActiveSessions();
  }

  /**
   * セッションを一時停止
   * @param {string} sessionId - セッションID
   */
  async pauseSession(sessionId) {
    const session = this.currentSessions.get(sessionId);
    if (!session || session.isPaused) return;

    session.isPaused = true;
    session.lastPauseTime = new Date().toISOString();
    session.events.push({
      type: 'pause',
      timestamp: session.lastPauseTime
    });

    await this.saveActiveSessions();
  }

  /**
   * セッションを再開
   * @param {string} sessionId - セッションID
   */
  async resumeSession(sessionId) {
    const session = this.currentSessions.get(sessionId);
    if (!session || !session.isPaused) return;

    const pauseTime = new Date() - new Date(session.lastPauseTime);
    session.pausedDuration += pauseTime;
    session.isPaused = false;
    
    const resumeTime = new Date().toISOString();
    session.events.push({
      type: 'resume',
      timestamp: resumeTime
    });

    await this.saveActiveSessions();
  }

  /**
   * イベントを記録
   * @param {string} sessionId - セッションID
   * @param {string} eventType - イベントタイプ
   * @param {object} metadata - 追加情報
   */
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

  /**
   * セッションデータを統計に保存
   * @param {object} session - セッションデータ
   */
  async saveSessionToStats(session) {
    try {
      const stats = await this.getStats();
      
      // セッションを追加
      if (!stats.sessions) stats.sessions = [];
      stats.sessions.push(session);

      // 日次統計を更新
      const date = new Date(session.startTime).toISOString().split('T')[0];
      if (!stats.dailyStats) stats.dailyStats = {};
      if (!stats.dailyStats[date]) {
        stats.dailyStats[date] = {
          totalSessions: 0,
          totalDuration: 0,
          uniqueNotebooks: new Set(),
          completedSessions: 0
        };
      }

      const dailyStat = stats.dailyStats[date];
      dailyStat.totalSessions++;
      dailyStat.totalDuration += session.duration;
      dailyStat.uniqueNotebooks.add(session.notebookId);
      if (session.completionRate >= 0.9) {
        dailyStat.completedSessions++;
      }

      // SetをArrayに変換して保存
      dailyStat.uniqueNotebooks = Array.from(dailyStat.uniqueNotebooks);

      // ノートブック別統計を更新
      if (!stats.notebookStats) stats.notebookStats = {};
      if (!stats.notebookStats[session.notebookId]) {
        stats.notebookStats[session.notebookId] = {
          notebookTitle: session.notebookTitle,
          icon: session.icon,
          totalPlays: 0,
          totalDuration: 0,
          lastAccessed: null,
          completionRates: []
        };
      }

      const notebookStat = stats.notebookStats[session.notebookId];
      notebookStat.totalPlays++;
      notebookStat.totalDuration += session.duration;
      notebookStat.lastAccessed = session.endTime;
      notebookStat.completionRates.push(session.completionRate);

      // 古いデータのクリーンアップ（90日以上前のセッションを削除）
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

  /**
   * アクティブセッションを保存
   */
  async saveActiveSessions() {
    const sessions = Array.from(this.currentSessions.values());
    await chrome.storage.local.set({ [this.SESSION_KEY]: sessions });
  }

  /**
   * アクティブセッションを復元
   */
  async restoreActiveSessions() {
    try {
      const result = await chrome.storage.local.get(this.SESSION_KEY);
      const sessions = result[this.SESSION_KEY] || [];
      
      // 24時間以上前のセッションは破棄
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      sessions.forEach(session => {
        if (new Date(session.startTime) > oneDayAgo) {
          this.currentSessions.set(session.sessionId, session);
        }
      });

      // クリーンアップ
      if (this.currentSessions.size !== sessions.length) {
        await this.saveActiveSessions();
      }
    } catch (error) {
      console.error('Failed to restore active sessions:', error);
    }
  }

  /**
   * 統計データを取得
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
   * 特定日の統計を取得
   * @param {string} date - 日付（YYYY-MM-DD形式）
   */
  async getDailyStats(date) {
    const stats = await this.getStats();
    return stats.dailyStats[date] || null;
  }

  /**
   * 特定ノートブックの統計を取得
   * @param {string} notebookId - ノートブックID
   */
  async getNotebookStats(notebookId) {
    const stats = await this.getStats();
    return stats.notebookStats[notebookId] || null;
  }

  /**
   * セッションデータを取得
   * @param {string} sessionId - セッションID
   */
  getSessionData(sessionId) {
    return this.currentSessions.get(sessionId) || null;
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
   * @param {string} format - エクスポート形式（'json' or 'csv'）
   */
  async exportStats(format = 'json') {
    const stats = await this.getStats();
    
    if (format === 'json') {
      return JSON.stringify(stats, null, 2);
    } else if (format === 'csv') {
      // CSV形式でエクスポート
      let csv = 'Date,Notebook,Duration(sec),CompletionRate\n';
      stats.sessions.forEach(session => {
        const date = new Date(session.startTime).toISOString().split('T')[0];
        csv += `${date},"${session.notebookTitle}",${session.duration},${session.completionRate}\n`;
      });
      return csv;
    }
    
    throw new Error('Unsupported export format');
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StatsCollector;
}