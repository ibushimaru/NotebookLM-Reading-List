/**
 * オフスクリーンドキュメントの初期化ログ
 */

console.log('Offscreen document loaded');
console.log('Scripts loading...');

// すべてのスクリプトが読み込まれたことを確認
window.addEventListener('load', () => {
  console.log('All scripts loaded');
  console.log('Controllers available:', {
    NotebookLMController: typeof NotebookLMController !== 'undefined',
    controller: typeof controller !== 'undefined'
  });
});