// Tab Pool Debug Script

let lastTabId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  refreshStats();
  log('Debug panel initialized', 'info');
  
  // Set up event listeners
  document.getElementById('refreshStats').addEventListener('click', refreshStats);
  document.getElementById('getTab').addEventListener('click', getTabFromPool);
  document.getElementById('releaseTab').addEventListener('click', releaseLastTab);
  document.getElementById('clearLog').addEventListener('click', clearLog);
  
  // Auto-refresh stats every 5 seconds
  setInterval(refreshStats, 5000);
});

// Refresh pool statistics
async function refreshStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getPoolStats' });
    const stats = response.stats;
    
    if (stats) {
      document.getElementById('stats').innerHTML = `
        <strong>Tab Pool Statistics</strong><br>
        Total Tabs: ${stats.totalTabs}<br>
        Idle Tabs: ${stats.idleTabs}<br>
        In Use Tabs: ${stats.inUseTabs}<br>
        Loading Tabs: ${stats.loadingTabs || 0}<br>
        Error Tabs: ${stats.errorTabs || 0}<br>
        Last Updated: ${new Date().toLocaleTimeString()}
      `;
    } else {
      document.getElementById('stats').innerHTML = 'Tab pool not initialized';
    }
  } catch (error) {
    log(`Failed to get stats: ${error.message}`, 'error');
  }
}

// Get a tab from the pool
async function getTabFromPool() {
  try {
    log('Requesting tab from pool...', 'info');
    
    const response = await chrome.runtime.sendMessage({
      action: 'getPooledTab',
      notebookUrl: 'https://notebooklm.google.com'
    });
    
    if (response.success) {
      lastTabId = response.tabId;
      log(`Got tab ${response.tabId} from pool`, 'success');
      
      if (response.cachedAudioInfo) {
        log(`Tab has cached audio info: ${JSON.stringify(response.cachedAudioInfo)}`, 'info');
      }
    } else {
      log(`Failed to get tab: ${response.error}`, 'error');
    }
    
    refreshStats();
  } catch (error) {
    log(`Error getting tab: ${error.message}`, 'error');
  }
}

// Release the last tab back to pool
async function releaseLastTab() {
  if (!lastTabId) {
    log('No tab to release', 'error');
    return;
  }
  
  try {
    log(`Releasing tab ${lastTabId} back to pool...`, 'info');
    
    await chrome.runtime.sendMessage({
      action: 'releaseTab',
      tabId: lastTabId
    });
    
    log(`Tab ${lastTabId} released`, 'success');
    lastTabId = null;
    
    refreshStats();
  } catch (error) {
    log(`Error releasing tab: ${error.message}`, 'error');
  }
}

// Log a message
function log(message, type = 'info') {
  const logDiv = document.getElementById('log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logDiv.appendChild(entry);
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Clear the log
function clearLog() {
  document.getElementById('log').innerHTML = '';
  log('Log cleared', 'info');
}