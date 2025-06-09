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
    
    // シンプルコントローラーを試す
    const response = await chrome.runtime.sendMessage({
      action: 'offscreenSimpleTest',
      command: 'openNotebook',
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
      action: 'offscreenSimpleTest',
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
      action: 'offscreenSimpleTest',
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
      action: 'offscreenSimpleTest',
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

// 再生/停止トグル（ユーザーインタラクションコンテキストを活用）
let isPlaying = false;
document.getElementById('play-audio').addEventListener('click', async () => {
  try {
    const command = isPlaying ? 'pause' : 'play';
    log(`音声を${isPlaying ? '停止' : '再生'}中...`);
    
    // まずタブIDを取得
    const infoResponse = await chrome.runtime.sendMessage({
      action: 'offscreenSimpleTest',
      command: 'getTabId'
    });
    
    if (!infoResponse.tabId) {
      throw new Error('タブが開かれていません');
    }
    
    const tabId = infoResponse.tabId;
    log(`タブID: ${tabId} で音声を${isPlaying ? '停止' : '再生'}します`);
    
    // 初回再生チェック（再生時のみ）
    if (!isPlaying) {
      const firstPlayCheck = await chrome.runtime.sendMessage({
        action: 'checkFirstPlay',
        tabId: tabId
      });
      
      if (firstPlayCheck && firstPlayCheck.isFirstPlay) {
        log('初回再生を検出、タブを一時的にアクティブ化');
        
        // 現在のアクティブタブを記録
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs.find(tab => 
          tab.url && 
          !tab.url.startsWith('chrome-extension://') &&
          tab.id !== tabId
        );
        
        await chrome.tabs.update(tabId, { active: true });
        
        // 短時間で元のタブに戻す
        setTimeout(async () => {
          if (currentTab && currentTab.id) {
            try {
              await chrome.tabs.update(currentTab.id, { active: true });
            } catch (e) {
              log('タブ復元エラー: ' + e.message);
            }
          }
          // タブをピン留め
          try {
            await chrome.tabs.update(tabId, { pinned: true });
          } catch (e) {
            log('ピン留めエラー: ' + e.message);
          }
        }, 300);
        
        await chrome.runtime.sendMessage({
          action: 'markAsPlayed',
          tabId: tabId
        });
      }
    }
    
    // デバッグページから直接タブにメッセージを送信（ユーザーインタラクションのコンテキストで）
    try {
      const directResponse = await chrome.tabs.sendMessage(tabId, {
        action: 'controlAudio',
        command: command
      });
      
      if (directResponse && directResponse.success) {
        isPlaying = !isPlaying;
        document.getElementById('play-audio').textContent = isPlaying ? '停止' : '再生';
        showStatus('audio-status', isPlaying ? '再生中' : '停止中', 'success');
        log(`音声を${isPlaying ? '再生しています' : '停止しました'}（直接制御）`);
      } else {
        throw new Error('直接制御が失敗しました');
      }
    } catch (directError) {
      log(`直接制御エラー: ${directError.message}`, 'error');
      
      // フォールバック：オフスクリーン経由
      const response = await chrome.runtime.sendMessage({
        action: 'offscreenSimpleTest',
        command: 'controlAudio',
        audioCommand: command
      });
      
      if (response.success) {
        isPlaying = !isPlaying;
        document.getElementById('play-audio').textContent = isPlaying ? '停止' : '再生';
        showStatus('audio-status', isPlaying ? '再生中' : '停止中', 'success');
        log(`音声を${isPlaying ? '再生しています' : '停止しました'}（オフスクリーン経由）`);
      } else {
        showStatus('audio-status', `エラー: ${response.error}`, 'error');
        log(`エラー: ${response.error}`, 'error');
      }
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