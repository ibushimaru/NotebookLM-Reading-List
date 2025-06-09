# 学習統計ダッシュボード機能 設計書

## 概要

NotebookLM Reading Listに学習の進捗や利用パターンを可視化する統計ダッシュボード機能を追加します。ユーザーは自分の学習習慣を把握し、より効果的な学習計画を立てることができます。

## 機能要件

### 1. 収集するデータ

#### 基本統計
- **再生回数**: ノートブックごと、日付ごと
- **総再生時間**: 日次、週次、月次
- **完了率**: 音声を最後まで聴いた割合
- **アクセス頻度**: 各ノートブックへのアクセス回数

#### 詳細統計
- **再生パターン**: 時間帯別の利用状況
- **連続学習日数**: ストリーク記録
- **お気に入りノートブック**: 最も頻繁にアクセスするトップ5
- **平均セッション時間**: 1回の利用での平均時間

### 2. データ構造

```javascript
// Chrome Storage に保存するデータ構造
{
  "statistics": {
    "sessions": [
      {
        "notebookId": "nb_123",
        "notebookTitle": "機械学習入門",
        "sessionId": "sess_456",
        "startTime": "2025-01-06T10:00:00Z",
        "endTime": "2025-01-06T10:25:00Z",
        "duration": 1500, // 秒
        "completionRate": 0.85, // 85%
        "events": [
          {
            "type": "play",
            "timestamp": "2025-01-06T10:00:00Z"
          },
          {
            "type": "pause",
            "timestamp": "2025-01-06T10:10:00Z"
          }
        ]
      }
    ],
    "dailyStats": {
      "2025-01-06": {
        "totalSessions": 5,
        "totalDuration": 7200, // 秒
        "uniqueNotebooks": 3,
        "completedSessions": 4
      }
    },
    "notebookStats": {
      "nb_123": {
        "totalPlays": 15,
        "totalDuration": 18000,
        "lastAccessed": "2025-01-06T10:00:00Z",
        "averageCompletion": 0.75,
        "icon": "📚"
      }
    }
  }
}
```

### 3. UI設計

#### ダッシュボードレイアウト

```
┌─────────────────────────────────────┐
│  📊 学習統計ダッシュボード           │
├─────────────────────────────────────┤
│  今日の学習時間: 2時間15分          │
│  連続学習: 7日 🔥                   │
├─────────────────────────────────────┤
│  [週間サマリー]                     │
│  月 火 水 木 金 土 日               │
│  ▁ ▃ ▅ ▇ ▅ ▃ ▁                   │
├─────────────────────────────────────┤
│  [よく聴くノートブック]             │
│  1. 📚 機械学習入門 (15回)          │
│  2. 🧮 統計学基礎 (12回)            │
│  3. 🎯 プロジェクト管理 (10回)      │
├─────────────────────────────────────┤
│  [詳細統計を見る] [エクスポート]    │
└─────────────────────────────────────┘
```

#### 詳細統計ビュー

```
┌─────────────────────────────────────┐
│  📈 詳細統計                        │
├─────────────────────────────────────┤
│  期間: [今週 ▼] [カスタム期間]      │
├─────────────────────────────────────┤
│  総再生時間: 15時間30分             │
│  平均セッション: 25分               │
│  完了率: 78%                        │
├─────────────────────────────────────┤
│  時間帯別利用状況                   │
│  [グラフ表示]                       │
├─────────────────────────────────────┤
│  ノートブック別統計                 │
│  [テーブル表示]                     │
└─────────────────────────────────────┘
```

### 4. 実装計画

#### Phase 1: データ収集基盤 (PR #1)
- `src/storage/statsCollector.js`
  - セッション開始/終了の記録
  - イベントトラッキング
  - データ永続化

#### Phase 2: 統計計算ロジック (PR #2)
- `src/utils/statsCalculator.js`
  - 日次/週次/月次集計
  - 完了率計算
  - トレンド分析

#### Phase 3: UI実装 (PR #3)
- `src/sidepanel/components/dashboard.js`
  - ダッシュボードコンポーネント
  - グラフ表示
  - インタラクティブ要素

#### Phase 4: エクスポート機能 (PR #4)
- CSV/JSONエクスポート
- レポート生成
- 共有機能

### 5. 技術的考慮事項

#### パフォーマンス
- データは定期的に集計して保存
- 大量データの場合は古いデータを圧縮
- IndexedDBの使用を検討（大量データ用）

#### プライバシー
- すべてのデータはローカルに保存
- 個人を特定する情報は収集しない
- ユーザーがデータを削除できる機能

#### 制限事項
- Chrome Storage APIの容量制限（5MB）
- 古いデータの自動アーカイブ（90日以上）

### 6. 将来の拡張

- **目標設定機能**: 日次/週次の学習目標
- **達成バッジ**: ゲーミフィケーション要素
- **インサイト**: AIによる学習パターン分析
- **共有機能**: 統計の共有とコミュニティ比較

## API設計

### statsCollector.js

```javascript
class StatsCollector {
  // セッション管理
  startSession(notebookId, notebookTitle)
  endSession(sessionId)
  pauseSession(sessionId)
  resumeSession(sessionId)
  
  // イベント記録
  recordEvent(sessionId, eventType, metadata)
  
  // データ取得
  getSessionData(sessionId)
  getDailyStats(date)
  getNotebookStats(notebookId)
}
```

### statsCalculator.js

```javascript
class StatsCalculator {
  // 集計関数
  calculateDailyStats(sessions)
  calculateWeeklyStats(dailyStats)
  calculateMonthlyStats(dailyStats)
  
  // 分析関数
  getTopNotebooks(limit)
  getStudyStreak()
  getAverageSessionDuration()
  getCompletionRate()
  
  // トレンド分析
  getTrends(period)
  getPeakHours()
}
```

### dashboard.js

```javascript
class Dashboard {
  // UI管理
  render()
  updateStats()
  
  // グラフ描画
  drawWeeklyChart(data)
  drawHourlyHeatmap(data)
  
  // インタラクション
  handlePeriodChange(period)
  handleExport(format)
}
```

## テスト計画

1. **単体テスト**
   - データ収集の正確性
   - 統計計算の検証
   - エッジケースの処理

2. **統合テスト**
   - 実際の使用シナリオ
   - パフォーマンステスト
   - データ整合性

3. **ユーザビリティテスト**
   - UIの使いやすさ
   - 情報の見やすさ
   - レスポンス速度