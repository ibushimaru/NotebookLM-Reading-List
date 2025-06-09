// Offscreen document for audio playback

let currentAudio = null;

// メッセージリスナー（音声再生専用）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Offscreen audio handler received:', request);
  
  if (request.target !== 'offscreen') {
    console.log('Message not for offscreen, ignoring');
    return;
  }
  
  // offscreen-controller.jsで処理するアクションは除外
  const controllerActions = ['loadNotebook', 'getAudioInfo', 'controlAudio', 'playAudio', 'pauseAudio', 'getAudioStatus'];
  if (controllerActions.includes(request.action)) {
    console.log('Delegating to controller:', request.action);
    return false; // 他のリスナーに処理を委譲
  }
  
  switch (request.action) {
    case 'play':
      playAudio(request.audioUrl, request.title);
      sendResponse({ success: true });
      break;
      
    case 'pause':
      pauseAudio();
      sendResponse({ success: true });
      break;
      
    case 'getStatus':
      sendResponse(getAudioStatus());
      break;
      
    case 'fetchAndPlay':
      fetchAndPlayAudio(request.audioUrl, request.title)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // 非同期レスポンス
      
    case 'seek':
      seekAudio(request.percentage);
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// 音声を再生
function playAudio(audioUrl, title) {
  const audio = document.getElementById('audio-player');
  
  if (audio.src !== audioUrl) {
    audio.src = audioUrl;
  }
  
  audio.play().catch(error => {
    console.error('Play error:', error);
  });
  
  currentAudio = { url: audioUrl, title: title };
}

// 音声を一時停止
function pauseAudio() {
  const audio = document.getElementById('audio-player');
  audio.pause();
}

// シーク機能
function seekAudio(percentage) {
  const audio = document.getElementById('audio-player');
  if (audio.duration && !isNaN(audio.duration)) {
    const newTime = (audio.duration * percentage) / 100;
    audio.currentTime = newTime;
  }
}

// 音声の状態を取得
function getAudioStatus() {
  const audio = document.getElementById('audio-player');
  
  return {
    isPlaying: !audio.paused,
    currentTime: formatTime(audio.currentTime),
    duration: formatTime(audio.duration),
    progress: audio.duration ? (audio.currentTime / audio.duration) * 100 : 0,
    title: currentAudio?.title || ''
  };
}

// Blob URLをfetchして再生（CORS回避）
async function fetchAndPlayAudio(blobUrl, title) {
  try {
    // Blob URLからデータを取得
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    
    // 新しいBlob URLを作成
    const newBlobUrl = URL.createObjectURL(blob);
    
    // 音声を再生
    playAudio(newBlobUrl, title);
    
    // メモリリークを防ぐため、古いURLを解放
    setTimeout(() => {
      URL.revokeObjectURL(newBlobUrl);
    }, 60000); // 1分後に解放
    
  } catch (error) {
    console.error('Fetch and play error:', error);
    throw error;
  }
}

// 時間をフォーマット
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// audio要素のイベントリスナー
document.addEventListener('DOMContentLoaded', () => {
  const audio = document.getElementById('audio-player');
  
  // 再生状態の変更を通知
  audio.addEventListener('play', () => {
    chrome.runtime.sendMessage({
      from: 'offscreen',
      event: 'play'
    });
  });
  
  audio.addEventListener('pause', () => {
    chrome.runtime.sendMessage({
      from: 'offscreen',
      event: 'pause'
    });
  });
  
  audio.addEventListener('ended', () => {
    chrome.runtime.sendMessage({
      from: 'offscreen',
      event: 'ended'
    });
  });
  
  // 進行状況の更新
  audio.addEventListener('timeupdate', () => {
    chrome.runtime.sendMessage({
      from: 'offscreen',
      event: 'timeupdate',
      data: getAudioStatus()
    });
  });
  
  // より頻繁な更新のために追加のインターバル
  let updateInterval;
  audio.addEventListener('play', () => {
    updateInterval = setInterval(() => {
      chrome.runtime.sendMessage({
        from: 'offscreen',
        event: 'timeupdate',
        data: getAudioStatus()
      });
    }, 100); // 0.1秒ごとに更新（よりスムーズな動き）
  });
  
  audio.addEventListener('pause', () => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });
  
  audio.addEventListener('ended', () => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });
});