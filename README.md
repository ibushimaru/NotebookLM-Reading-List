# NotebookLM Reading List

Google NotebookLMの音声概要機能を効率的に管理するChrome拡張機能

![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-green.svg)

## 概要

NotebookLM Reading Listは、Google NotebookLMで作成した複数のノートブックを一元管理し、音声概要機能へ素早くアクセスできるようにするChrome拡張機能です。サイドパネルから全てのノートブックを管理し、ワンクリックで音声を再生できます。

## 主な機能

### ✅ 実装済み機能

- 📚 **ノートブック一覧表示** - NotebookLMの全ノートブックをサイドパネルに表示
- 🔍 **検索・フィルタリング** - タイトル検索とアイコンによるフィルタリング
- 🎵 **インライン音声再生** - サイドパネル内で直接音声を再生
- ⚡ **高速アクセス** - タブプールシステムにより2-3秒で音声にアクセス
- 📊 **リアルタイム進行表示** - 60fpsの滑らかなシークバーアニメーション
- 🔄 **自動状態検知** - 音声生成状態を自動検知し、適切に処理
- 💾 **キャッシュ機能** - 音声情報を3時間キャッシュして高速化
- 🏷️ **タグ管理** - ノートブックにカスタムタグを追加して整理
- 📅 **並び替え機能** - 作成日順またはNotebookLM順で表示
- 🌐 **多言語対応** - 日本語と英語に対応（ブラウザの言語設定に従う）

## インストール方法

### 開発版のインストール

1. このリポジトリをクローン
```bash
git clone https://github.com/ibushimaru/NotebookLM-Reading-List.git
cd NotebookLM-Reading-List
```

2. Chromeで拡張機能ページを開く
   - `chrome://extensions/` にアクセス
   - 右上の「デベロッパーモード」をONにする

3. 拡張機能を読み込む
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - クローンしたフォルダを選択

## 使い方

1. [NotebookLM](https://notebooklm.google.com)を開く
2. 拡張機能アイコンをクリックしてサイドパネルを表示
3. ノートブック一覧から音声を再生したいものを選択
4. 「音声概要」ボタンをクリックして再生開始

### 機能詳細

#### 🎵 音声再生コントロール
- **再生/一時停止**: ワンクリックで制御
- **シーク機能**: プログレスバーをクリックして任意の位置へジャンプ
- **進行表示**: リアルタイムで再生位置を表示

#### 🔍 検索とフィルタリング
- **テキスト検索**: ノートブックタイトルで絞り込み
- **アイコンフィルター**: NotebookLMのアイコンでカテゴリ分類

## 技術仕様

- **Chrome Extension Manifest V3**
- **Chrome Side Panel API** - 常時表示可能なサイドパネル
- **Offscreen API** - バックグラウンドでの音声再生
- **Content Scripts** - NotebookLMページのDOM操作
- **Service Worker** - バックグラウンド処理とタブ管理

### パフォーマンス最適化

- **タブプールシステム**: 事前にタブを準備して高速アクセス
- **requestAnimationFrame**: 60fpsの滑らかなアニメーション
- **GPU アクセラレーション**: transform を使用した描画最適化

## 開発

### 必要な環境

- Chrome 114以降
- Node.js 16以降（開発ツール用）

### プロジェクト構成

```
├── manifest.json          # 拡張機能マニフェスト
├── src/
│   ├── background/       # Service Worker
│   ├── content/          # Content Scripts
│   ├── sidepanel/        # サイドパネルUI
│   └── offscreen/        # 音声再生用Offscreen Document
├── icons/                # 拡張機能アイコン
├── styles/               # スタイルシート
└── docs/                 # ドキュメント
```

## トラブルシューティング

### よくある問題

**Q: 音声が再生されない**
- A: NotebookLMのタブがアクティブになっているか確認してください

**Q: "Extension context invalidated"エラーが表示される**
- A: 拡張機能をリロードするか、ページを更新してください

**Q: タブが自動的に閉じられる**
- A: これは正常な動作です。音声再生終了後に自動的にクリーンアップされます

## 貢献

プルリクエストや Issue の作成を歓迎します！

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](./LICENSE) ファイルを参照してください。

## 作者

- GitHub: [@ibushimaru](https://github.com/ibushimaru)

## 謝辞

- Google NotebookLM チーム - 素晴らしいAI要約ツールの提供
- Chrome Extensions チーム - 強力な拡張機能API
- コントリビューター - フィードバックと改善提案

---

⭐ このプロジェクトが役に立ったら、スターをお願いします！

## サポート

このプロジェクトの開発を支援していただける方は、以下からサポートをお願いします：

<a href="https://buymeacoffee.com/ibushimaru" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 40px !important;width: 150px !important;" ></a>