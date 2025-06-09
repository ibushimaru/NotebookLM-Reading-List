# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-06-10

### 🎉 初回リリース

#### ✨ 機能
- **ノートブック一覧表示**: サイドパネルで全ノートブックを管理
- **検索・フィルタリング**: タイトル検索とアイコンフィルター
- **インライン音声再生**: サイドパネル内で直接再生
- **高速アクセス**: タブプールシステムで2-3秒でアクセス
- **リアルタイム進行表示**: 60fpsの滑らかなシークバー
- **自動状態検知**: 音声生成状態を自動検知
- **キャッシュ機能**: 3時間の音声情報キャッシュ

#### 🎨 UI/UX
- シークバーにスライダーサム（まるポチ）追加
- アクティブな音声を青色で強調表示
- 折りたたまれたStudioタブの自動展開
- ローディングスピナーのサイズ最適化

#### ⚡ パフォーマンス
- requestAnimationFrameによる60fps更新
- GPUアクセラレーション（transform使用）
- DOM操作の最小化
- 擬似カウントアップで1秒の遅延を解消

#### 🐛 修正
- Extension Context Invalidatedエラーの対処
- タブが閉じられた時の適切なエラーハンドリング
- シークバーのカクつき問題を解決

---

## バージョニングについて

- **Major (X.0.0)**: 破壊的変更、大規模な機能追加
- **Minor (0.X.0)**: 新機能追加（後方互換性あり）
- **Patch (0.0.X)**: バグ修正、小さな改善