/**
 * オフスクリーンAPIのテストスクリプト
 */

// ログ出力
function log(message, type = 'info') {
  const logDiv = document.getElementById('log');
  const timestamp = new Date().toLocaleTimeString();
  const entry = `[${timestamp}] ${message}\n`;
  logDiv.textContent += entry;
  logDiv.scrollTop = logDiv.scrollHeight;
  console.log(message);
}

// ステータス表示
function showStatus(elementId, message, type = 'info') {
  const status = document.getElementById(elementId);
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
  
  // 3秒後に非表示
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}

// フィーチャーフラグの読み込み
async function loadFeatureFlags() {
  try {
    const result = await chrome.storage.local.get('featureFlags');
    const flags = result.featureFlags || {};
    document.getElementById('use-offscreen').checked = flags.USE_OFFSCREEN_API || false;
    log('フィーチャーフラグを読み込みました');
  } catch (error) {
    log(`フィーチャーフラグの読み込みエラー: ${error.message}`, 'error');
  }
}

// フィーチャーフラグの保存
document.getElementById('save-features').addEventListener('click', async () => {
  try {
    const useOffscreen = document.getElementById('use-offscreen').checked;
    await chrome.storage.local.set({
      featureFlags: {
        USE_OFFSCREEN_API: useOffscreen,
        OFFSCREEN_IFRAME: useOffscreen,
        OFFSCREEN_AUDIO: useOffscreen,
        DEBUG_MODE: true
      }
    });
    showStatus('feature-status', '設定を保存しました', 'success');
    log(`USE_OFFSCREEN_API を ${useOffscreen} に設定`);
  } catch (error) {
    showStatus('feature-status', `保存エラー: ${error.message}`, 'error');
  }
});

// NotebookLMの読み込み
document.getElementById('load-notebook').addEventListener('click', async () => {
  const url = document.getElementById('notebook-url').value;
  if (!url) {
    showStatus('load-status', 'URLを入力してください', 'error');
    return;
  }
  
  try {
    log(`NotebookLMを読み込み中: ${url}`);
    showStatus('load-status', '読み込み中...', 'info');
    
    const response = await chrome.runtime.sendMessage({
      action: 'offscreenTest',
      command: 'loadNotebook',
      notebookUrl: url
    });
    
    if (response.success) {
      showStatus('load-status', '読み込み完了', 'success');
      log('NotebookLMの読み込みに成功しました');
    } else {
      showStatus('load-status', `エラー: ${response.error}`, 'error');
      log(`読み込みエラー: ${response.error}`, 'error');
    }
  } catch (error) {
    showStatus('load-status', `エラー: ${error.message}`, 'error');
    log(`読み込みエラー: ${error.message}`, 'error');
  }
});

// 音声情報の取得
document.getElementById('get-info').addEventListener('click', async () => {
  try {
    log('音声情報を取得中...');
    
    const response = await chrome.runtime.sendMessage({
      action: 'offscreenTest',
      command: 'getAudioInfo'
    });
    
    if (response.error) {
      showStatus('audio-status', `エラー: ${response.error}`, 'error');
      log(`エラー: ${response.error}`, 'error');
    } else {
      showStatus('audio-status', `状態: ${response.status}`, 'info');
      log(`音声情報: ${JSON.stringify(response, null, 2)}`);
    }
  } catch (error) {
    showStatus('audio-status', `エラー: ${error.message}`, 'error');
    log(`エラー: ${error.message}`, 'error');
  }
});

// 音声の読み込み
document.getElementById('load-audio').addEventListener('click', async () => {
  try {
    log('音声を読み込み中...');
    
    const response = await chrome.runtime.sendMessage({
      action: 'offscreenTest',
      command: 'controlAudio',
      audioCommand: 'load'
    });
    
    if (response.success) {
      showStatus('audio-status', '音声を読み込みました', 'success');
      log('音声の読み込みに成功しました');
    } else {
      showStatus('audio-status', `エラー: ${response.error}`, 'error');
      log(`エラー: ${response.error}`, 'error');
    }
  } catch (error) {
    showStatus('audio-status', `エラー: ${error.message}`, 'error');
    log(`エラー: ${error.message}`, 'error');
  }
});

// 音声の生成
document.getElementById('generate-audio').addEventListener('click', async () => {
  try {
    log('音声を生成中...');
    showStatus('audio-status', '生成中...（時間がかかります）', 'info');
    
    const response = await chrome.runtime.sendMessage({
      action: 'offscreenTest',
      command: 'controlAudio',
      audioCommand: 'generate'
    });
    
    if (response.success) {
      showStatus('audio-status', '音声生成を開始しました', 'success');
      log('音声生成を開始しました');
    } else {
      showStatus('audio-status', `エラー: ${response.error}`, 'error');
      log(`エラー: ${response.error}`, 'error');
    }
  } catch (error) {
    showStatus('audio-status', `エラー: ${error.message}`, 'error');
    log(`エラー: ${error.message}`, 'error');
  }
});

// 再生
document.getElementById('play-audio').addEventListener('click', async () => {
  try {
    log('音声を再生中...');
    
    const response = await chrome.runtime.sendMessage({
      action: 'offscreenTest',
      command: 'controlAudio',
      audioCommand: 'play'
    });
    
    if (response.success) {
      showStatus('audio-status', '再生中', 'success');
      log('音声を再生しています');
    } else {
      showStatus('audio-status', `エラー: ${response.error}`, 'error');
      log(`エラー: ${response.error}`, 'error');
    }
  } catch (error) {
    showStatus('audio-status', `エラー: ${error.message}`, 'error');
    log(`エラー: ${error.message}`, 'error');
  }
});

// 一時停止
document.getElementById('pause-audio').addEventListener('click', async () => {
  try {
    log('音声を一時停止中...');
    
    const response = await chrome.runtime.sendMessage({
      action: 'offscreenTest',
      command: 'controlAudio',
      audioCommand: 'pause'
    });
    
    if (response.success) {
      showStatus('audio-status', '一時停止', 'success');
      log('音声を一時停止しました');
    } else {
      showStatus('audio-status', `エラー: ${response.error}`, 'error');
      log(`エラー: ${response.error}`, 'error');
    }
  } catch (error) {
    showStatus('audio-status', `エラー: ${error.message}`, 'error');
    log(`エラー: ${error.message}`, 'error');
  }
});

// ログクリア
document.getElementById('clear-log').addEventListener('click', () => {
  document.getElementById('log').textContent = '';
  log('ログをクリアしました');
});

// 初期化
loadFeatureFlags();
log('Offscreen API テストツール初期化完了');