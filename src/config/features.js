/**
 * フィーチャーフラグ設定
 * 新機能の段階的リリースに使用
 */
const FEATURES = {
  // オフスクリーンAPIを使用するかどうか
  USE_OFFSCREEN_API: false,
  
  // オフスクリーンでiframeを使用するか
  OFFSCREEN_IFRAME: false,
  
  // オフスクリーンで音声を再生するか
  OFFSCREEN_AUDIO: false,
  
  // デバッグモード
  DEBUG_MODE: true
};

// 環境変数やストレージから設定を読み込む
async function loadFeatureFlags() {
  try {
    const stored = await chrome.storage.local.get('featureFlags');
    if (stored.featureFlags) {
      Object.assign(FEATURES, stored.featureFlags);
    }
  } catch (error) {
    console.error('Failed to load feature flags:', error);
  }
}

// フィーチャーフラグを保存
async function saveFeatureFlags() {
  try {
    await chrome.storage.local.set({ featureFlags: FEATURES });
  } catch (error) {
    console.error('Failed to save feature flags:', error);
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FEATURES, loadFeatureFlags, saveFeatureFlags };
}