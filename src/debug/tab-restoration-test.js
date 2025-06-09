// タブ復元診断ツール

function log(message, type = 'info') {
  const logDiv = document.getElementById('log');
  const timestamp = new Date().toISOString();
  const typeSymbol = {
    'info': 'ℹ️',
    'success': '✅',
    'error': '❌',
    'warning': '⚠️'
  }[type] || '•';
  
  const entry = `[${timestamp}] ${typeSymbol} ${message}\n`;
  logDiv.textContent += entry;
  logDiv.scrollTop = logDiv.scrollHeight;
  console.log(`[Tab Restoration Test] ${message}`);
}

// 権限チェック
document.getElementById('check-permissions').addEventListener('click', async () => {
  const resultDiv = document.getElementById('permissions-result');
  resultDiv.innerHTML = '';
  
  try {
    log('権限チェックを開始...');
    const manifest = chrome.runtime.getManifest();
    
    const permissions = manifest.permissions || [];
    const hostPermissions = manifest.host_permissions || [];
    
    let html = '<div class="test-result success">';
    html += '<h3>付与されている権限:</h3>';
    html += '<ul>';
    permissions.forEach(perm => {
      html += `<li>${perm}</li>`;
      log(`権限: ${perm}`, 'success');
    });
    html += '</ul>';
    
    html += '<h3>ホスト権限:</h3>';
    html += '<ul>';
    hostPermissions.forEach(host => {
      html += `<li>${host}</li>`;
      log(`ホスト権限: ${host}`, 'success');
    });
    html += '</ul>';
    html += '</div>';
    
    resultDiv.innerHTML = html;
    
    // タブ操作に必要な権限をチェック
    const requiredPerms = ['tabs', 'activeTab'];
    const hasRequiredPerms = requiredPerms.every(perm => permissions.includes(perm));
    
    if (hasRequiredPerms) {
      log('✅ タブ操作に必要な権限があります', 'success');
    } else {
      log('⚠️ 一部の権限が不足している可能性があります', 'warning');
    }
    
  } catch (error) {
    resultDiv.innerHTML = `<div class="test-result error">エラー: ${error.message}</div>`;
    log(`権限チェックエラー: ${error.message}`, 'error');
  }
});

// タブ操作テスト
document.getElementById('test-tab-operations').addEventListener('click', async () => {
  const resultDiv = document.getElementById('tab-operations-result');
  resultDiv.innerHTML = '<div class="test-result">テスト中...</div>';
  
  try {
    log('タブ操作テストを開始...');
    
    // 1. 現在のタブを取得
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    log(`現在のタブ: ${currentTab.id} - ${currentTab.url}`, 'info');
    
    // 2. 新しいタブを作成
    const newTab = await chrome.tabs.create({ 
      url: 'about:blank', 
      active: false 
    });
    log(`新しいタブを作成: ${newTab.id}`, 'success');
    
    // 3. タブをアクティブにする
    await new Promise(resolve => setTimeout(resolve, 500));
    await chrome.tabs.update(newTab.id, { active: true });
    log(`タブ ${newTab.id} をアクティブ化`, 'success');
    
    // 4. 元のタブに戻る
    await new Promise(resolve => setTimeout(resolve, 500));
    await chrome.tabs.update(currentTab.id, { active: true });
    log(`元のタブ ${currentTab.id} に復元`, 'success');
    
    // 5. 新しいタブをピン留め
    await chrome.tabs.update(newTab.id, { pinned: true });
    log(`タブ ${newTab.id} をピン留め`, 'success');
    
    // 6. テストタブを削除
    await new Promise(resolve => setTimeout(resolve, 1000));
    await chrome.tabs.remove(newTab.id);
    log(`テストタブ ${newTab.id} を削除`, 'success');
    
    resultDiv.innerHTML = '<div class="test-result success">✅ すべてのタブ操作が正常に動作しました</div>';
    
  } catch (error) {
    resultDiv.innerHTML = `<div class="test-result error">❌ エラー: ${error.message}</div>`;
    log(`タブ操作エラー: ${error.message}`, 'error');
  }
});

// タブ復元シミュレーション
document.getElementById('simulate-restoration').addEventListener('click', async () => {
  const resultDiv = document.getElementById('restoration-result');
  resultDiv.innerHTML = '<div class="test-result">シミュレーション中...</div>';
  
  try {
    log('タブ復元シミュレーションを開始...');
    
    // 現在のタブを記録
    const [originalTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    log(`元のタブ: ${originalTab.id} - ${originalTab.url}`);
    
    // NotebookLMのシミュレーションタブを作成
    const simTab = await chrome.tabs.create({ 
      url: 'https://example.com', 
      active: false,
      index: originalTab.index + 1
    });
    log(`シミュレーションタブを作成: ${simTab.id}`);
    
    // 初回再生のシミュレーション
    log('初回再生をシミュレート...');
    
    // タブをアクティブ化（300ms）
    await chrome.tabs.update(simTab.id, { active: true });
    log(`タブ ${simTab.id} をアクティブ化`);
    
    // 300ms待機
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 元のタブに復元を試みる
    try {
      // タブの存在確認
      const tabCheck = await chrome.tabs.get(originalTab.id);
      log(`元のタブは存在します: ${tabCheck.id}`);
      
      // 復元
      await chrome.tabs.update(originalTab.id, { active: true });
      log(`✅ タブ ${originalTab.id} への復元成功！`, 'success');
      
      // ピン留め
      await chrome.tabs.update(simTab.id, { pinned: true });
      log(`✅ タブ ${simTab.id} のピン留め成功！`, 'success');
      
      resultDiv.innerHTML = '<div class="test-result success">✅ タブ復元シミュレーション成功</div>';
      
    } catch (restoreError) {
      log(`❌ 復元エラー: ${restoreError.message}`, 'error');
      resultDiv.innerHTML = `<div class="test-result error">❌ 復元失敗: ${restoreError.message}</div>`;
    }
    
    // クリーンアップ
    setTimeout(async () => {
      try {
        await chrome.tabs.remove(simTab.id);
        log('シミュレーションタブを削除');
      } catch (e) {
        // 無視
      }
    }, 2000);
    
  } catch (error) {
    resultDiv.innerHTML = `<div class="test-result error">❌ エラー: ${error.message}</div>`;
    log(`シミュレーションエラー: ${error.message}`, 'error');
  }
});

// タイミングテスト
document.getElementById('test-timing').addEventListener('click', async () => {
  const resultDiv = document.getElementById('timing-result');
  const delay = parseInt(document.getElementById('restoration-delay').value);
  resultDiv.innerHTML = `<div class="test-result">タイミングテスト中 (${delay}ms)...</div>`;
  
  try {
    log(`タイミングテスト開始 (遅延: ${delay}ms)`);
    
    const [originalTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const testTab = await chrome.tabs.create({ 
      url: 'about:blank', 
      active: false 
    });
    
    // タブをアクティブ化
    const activateStart = performance.now();
    await chrome.tabs.update(testTab.id, { active: true });
    const activateEnd = performance.now();
    log(`アクティブ化時間: ${(activateEnd - activateStart).toFixed(2)}ms`);
    
    // 指定された遅延
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // 復元
    const restoreStart = performance.now();
    try {
      await chrome.tabs.update(originalTab.id, { active: true });
      const restoreEnd = performance.now();
      log(`✅ 復元成功！ 復元時間: ${(restoreEnd - restoreStart).toFixed(2)}ms`, 'success');
      
      resultDiv.innerHTML = `
        <div class="test-result success">
          ✅ ${delay}ms の遅延で復元成功<br>
          アクティブ化: ${(activateEnd - activateStart).toFixed(2)}ms<br>
          復元: ${(restoreEnd - restoreStart).toFixed(2)}ms
        </div>`;
      
    } catch (error) {
      log(`❌ ${delay}ms の遅延で復元失敗: ${error.message}`, 'error');
      resultDiv.innerHTML = `<div class="test-result error">❌ ${delay}ms の遅延で復元失敗</div>`;
    }
    
    // クリーンアップ
    setTimeout(() => chrome.tabs.remove(testTab.id), 1000);
    
  } catch (error) {
    resultDiv.innerHTML = `<div class="test-result error">❌ エラー: ${error.message}</div>`;
    log(`タイミングテストエラー: ${error.message}`, 'error');
  }
});

// ログクリア
document.getElementById('clear-log').addEventListener('click', () => {
  document.getElementById('log').textContent = '';
  log('ログをクリアしました');
});

// 初期化
log('タブ復元診断ツール準備完了', 'success');