/**
 * 学習統計ダッシュボードコンポーネント
 */
class StatsDashboard {
  constructor() {
    this.container = null;
    this.stats = null;
    this.currentView = 'summary'; // summary, daily, notebooks
    this.currentPeriod = 'week'; // today, week, month
  }

  /**
   * ダッシュボードを初期化
   * @param {HTMLElement} container - ダッシュボードを表示するコンテナ
   */
  async initialize(container) {
    this.container = container;
    await this.loadStats();
    this.render();
    
    // 定期的に統計を更新
    setInterval(() => this.updateStats(), 60000); // 1分ごと
  }

  /**
   * 統計データを読み込み
   */
  async loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getStats' });
      this.stats = response || {
        sessions: [],
        dailyStats: {},
        notebookStats: {}
      };
      
      // 計算された統計を追加
      this.stats.calculated = this.calculateStats();
    } catch (error) {
      console.error('Failed to load stats:', error);
      this.stats = {
        sessions: [],
        dailyStats: {},
        notebookStats: {},
        calculated: {}
      };
    }
  }

  /**
   * 統計を計算
   */
  calculateStats() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const stats = {
      today: {
        sessions: 0,
        duration: 0,
        uniqueNotebooks: new Set(),
        completedSessions: 0
      },
      week: {
        sessions: 0,
        duration: 0,
        uniqueNotebooks: new Set(),
        completedSessions: 0,
        dailyAverage: 0
      },
      month: {
        sessions: 0,
        duration: 0,
        uniqueNotebooks: new Set(),
        completedSessions: 0,
        dailyAverage: 0
      },
      streak: 0,
      topNotebooks: [],
      hourlyDistribution: new Array(24).fill(0),
      completionRate: 0
    };

    // セッションデータを集計
    this.stats.sessions.forEach(session => {
      const sessionDate = new Date(session.startTime).toISOString().split('T')[0];
      const hour = new Date(session.startTime).getHours();
      
      // 時間帯別分布
      stats.hourlyDistribution[hour]++;
      
      // 今日
      if (sessionDate === today) {
        stats.today.sessions++;
        stats.today.duration += session.duration;
        stats.today.uniqueNotebooks.add(session.notebookId);
        if (session.completionRate >= 0.9) stats.today.completedSessions++;
      }
      
      // 週間
      if (sessionDate >= weekAgo) {
        stats.week.sessions++;
        stats.week.duration += session.duration;
        stats.week.uniqueNotebooks.add(session.notebookId);
        if (session.completionRate >= 0.9) stats.week.completedSessions++;
      }
      
      // 月間
      if (sessionDate >= monthAgo) {
        stats.month.sessions++;
        stats.month.duration += session.duration;
        stats.month.uniqueNotebooks.add(session.notebookId);
        if (session.completionRate >= 0.9) stats.month.completedSessions++;
      }
    });

    // 平均を計算
    stats.week.dailyAverage = Math.round(stats.week.duration / 7);
    stats.month.dailyAverage = Math.round(stats.month.duration / 30);

    // 連続学習日数を計算
    stats.streak = this.calculateStreak();

    // トップノートブックを取得
    stats.topNotebooks = this.getTopNotebooks(5);

    // 完了率を計算
    if (stats.month.sessions > 0) {
      stats.completionRate = Math.round((stats.month.completedSessions / stats.month.sessions) * 100);
    }

    return stats;
  }

  /**
   * 連続学習日数を計算
   */
  calculateStreak() {
    const dates = new Set();
    this.stats.sessions.forEach(session => {
      const date = new Date(session.startTime).toISOString().split('T')[0];
      dates.add(date);
    });

    const sortedDates = Array.from(dates).sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    
    let streak = 0;
    let checkDate = new Date();
    
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (dates.has(dateStr)) {
        streak++;
      } else if (dateStr !== today) {
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    return streak;
  }

  /**
   * トップノートブックを取得
   */
  getTopNotebooks(limit = 5) {
    const notebookCounts = {};
    
    this.stats.sessions.forEach(session => {
      if (!notebookCounts[session.notebookId]) {
        notebookCounts[session.notebookId] = {
          id: session.notebookId,
          title: session.notebookTitle,
          icon: session.icon,
          count: 0,
          duration: 0
        };
      }
      notebookCounts[session.notebookId].count++;
      notebookCounts[session.notebookId].duration += session.duration;
    });

    return Object.values(notebookCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * ダッシュボードをレンダリング
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="stats-dashboard">
        <div class="dashboard-header">
          <h2>📊 学習統計</h2>
          <div class="dashboard-controls">
            <select class="period-selector" id="period-selector">
              <option value="today">今日</option>
              <option value="week" selected>今週</option>
              <option value="month">今月</option>
            </select>
            <button class="view-toggle" data-view="summary">概要</button>
            <button class="view-toggle" data-view="daily">日別</button>
            <button class="view-toggle" data-view="notebooks">ノートブック</button>
          </div>
        </div>
        <div class="dashboard-content">
          ${this.renderContent()}
        </div>
        <div class="dashboard-footer">
          <button class="export-btn" id="export-stats">📥 エクスポート</button>
          <button class="clear-btn" id="clear-stats">🗑️ データをクリア</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * コンテンツをレンダリング
   */
  renderContent() {
    switch (this.currentView) {
      case 'summary':
        return this.renderSummaryView();
      case 'daily':
        return this.renderDailyView();
      case 'notebooks':
        return this.renderNotebooksView();
      default:
        return this.renderSummaryView();
    }
  }

  /**
   * サマリービューをレンダリング
   */
  renderSummaryView() {
    const stats = this.stats.calculated[this.currentPeriod] || this.stats.calculated.week;
    const streak = this.stats.calculated.streak;
    const topNotebooks = this.stats.calculated.topNotebooks;

    return `
      <div class="summary-view">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">⏱️</div>
            <div class="stat-content">
              <div class="stat-value">${this.formatDuration(stats.duration)}</div>
              <div class="stat-label">総学習時間</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📚</div>
            <div class="stat-content">
              <div class="stat-value">${stats.sessions}</div>
              <div class="stat-label">セッション数</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">🔥</div>
            <div class="stat-content">
              <div class="stat-value">${streak}日</div>
              <div class="stat-label">連続学習</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-content">
              <div class="stat-value">${this.stats.calculated.completionRate}%</div>
              <div class="stat-label">完了率</div>
            </div>
          </div>
        </div>
        
        <div class="chart-section">
          <h3>週間アクティビティ</h3>
          <div class="weekly-chart">
            ${this.renderWeeklyChart()}
          </div>
        </div>
        
        <div class="top-notebooks-section">
          <h3>よく聴くノートブック</h3>
          <div class="top-notebooks">
            ${topNotebooks.map((nb, index) => `
              <div class="notebook-rank">
                <span class="rank-number">${index + 1}</span>
                <span class="notebook-icon">${nb.icon}</span>
                <span class="notebook-title">${nb.title}</span>
                <span class="notebook-count">${nb.count}回</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 日別ビューをレンダリング
   */
  renderDailyView() {
    const days = this.getRecentDays(7);
    
    return `
      <div class="daily-view">
        <h3>日別学習時間</h3>
        <div class="daily-chart">
          ${days.map(day => {
            const stats = this.stats.dailyStats[day.date] || { totalDuration: 0, totalSessions: 0 };
            const height = Math.max(10, (stats.totalDuration / 3600) * 50); // 1時間 = 50px
            
            return `
              <div class="daily-bar">
                <div class="bar" style="height: ${height}px" title="${this.formatDuration(stats.totalDuration)}">
                  <span class="bar-value">${stats.totalSessions}</span>
                </div>
                <div class="day-label">${day.label}</div>
              </div>
            `;
          }).join('')}
        </div>
        
        <h3>時間帯別分布</h3>
        <div class="hourly-heatmap">
          ${this.renderHourlyHeatmap()}
        </div>
      </div>
    `;
  }

  /**
   * ノートブックビューをレンダリング
   */
  renderNotebooksView() {
    const notebooks = Object.values(this.stats.notebookStats || {});
    
    return `
      <div class="notebooks-view">
        <h3>ノートブック別統計</h3>
        <div class="notebooks-list">
          ${notebooks.map(nb => `
            <div class="notebook-stat-item">
              <div class="notebook-info">
                <span class="notebook-icon">${nb.icon || '📚'}</span>
                <span class="notebook-title">${nb.notebookTitle}</span>
              </div>
              <div class="notebook-stats">
                <span class="stat-item">
                  <span class="stat-icon">🎧</span>
                  <span class="stat-value">${nb.totalPlays}回</span>
                </span>
                <span class="stat-item">
                  <span class="stat-icon">⏱️</span>
                  <span class="stat-value">${this.formatDuration(nb.totalDuration)}</span>
                </span>
                <span class="stat-item">
                  <span class="stat-icon">📅</span>
                  <span class="stat-value">${this.formatDate(nb.lastAccessed)}</span>
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * 週間チャートをレンダリング
   */
  renderWeeklyChart() {
    const days = this.getRecentDays(7);
    const maxDuration = Math.max(...days.map(day => {
      const stats = this.stats.dailyStats[day.date] || { totalDuration: 0 };
      return stats.totalDuration;
    }));

    return days.map(day => {
      const stats = this.stats.dailyStats[day.date] || { totalDuration: 0 };
      const percentage = maxDuration > 0 ? (stats.totalDuration / maxDuration) * 100 : 0;
      
      return `
        <div class="weekly-bar">
          <div class="bar-fill" style="height: ${percentage}%"></div>
          <div class="day-initial">${day.initial}</div>
        </div>
      `;
    }).join('');
  }

  /**
   * 時間帯別ヒートマップをレンダリング
   */
  renderHourlyHeatmap() {
    const distribution = this.stats.calculated.hourlyDistribution;
    const max = Math.max(...distribution);
    
    return `
      <div class="heatmap-grid">
        ${distribution.map((count, hour) => {
          const intensity = max > 0 ? count / max : 0;
          const color = `rgba(26, 115, 232, ${intensity})`;
          
          return `
            <div class="heatmap-cell" style="background-color: ${color}" title="${hour}時: ${count}回">
              ${hour}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * 最近の日付を取得
   */
  getRecentDays(count) {
    const days = [];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      days.push({
        date: dateStr,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        initial: dayNames[date.getDay()]
      });
    }
    
    return days;
  }

  /**
   * 時間をフォーマット
   */
  formatDuration(seconds) {
    if (!seconds) return '0分';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}時間${minutes}分`;
    } else {
      return `${minutes}分`;
    }
  }

  /**
   * 日付をフォーマット
   */
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  /**
   * イベントリスナーを設定
   */
  attachEventListeners() {
    // 期間セレクター
    const periodSelector = document.getElementById('period-selector');
    if (periodSelector) {
      periodSelector.addEventListener('change', (e) => {
        this.currentPeriod = e.target.value;
        this.updateContent();
      });
    }

    // ビュー切り替えボタン
    document.querySelectorAll('.view-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentView = e.target.dataset.view;
        document.querySelectorAll('.view-toggle').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.updateContent();
      });
    });
    
    // 初期アクティブ状態を設定
    const activeBtn = document.querySelector(`.view-toggle[data-view="${this.currentView}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    // エクスポートボタン
    const exportBtn = document.getElementById('export-stats');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportStats());
    }

    // クリアボタン
    const clearBtn = document.getElementById('clear-stats');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearStats());
    }
  }

  /**
   * コンテンツを更新
   */
  updateContent() {
    const contentEl = document.querySelector('.dashboard-content');
    if (contentEl) {
      contentEl.innerHTML = this.renderContent();
    }
  }

  /**
   * 統計を更新
   */
  async updateStats() {
    await this.loadStats();
    this.updateContent();
  }

  /**
   * 統計をエクスポート
   */
  async exportStats() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'exportStats',
        format: 'csv'
      });
      
      if (response && response.data) {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notebooklm-stats-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export stats:', error);
      alert('統計のエクスポートに失敗しました。');
    }
  }

  /**
   * 統計をクリア
   */
  async clearStats() {
    if (!confirm('すべての統計データを削除しますか？この操作は取り消せません。')) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({ action: 'clearStats' });
      await this.loadStats();
      this.render();
      alert('統計データを削除しました。');
    } catch (error) {
      console.error('Failed to clear stats:', error);
      alert('統計データの削除に失敗しました。');
    }
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StatsDashboard;
}