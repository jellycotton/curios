// background.js からメッセージを受け取るリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "displayFactCheckResult") {
    // 結果が返ってきたらオーバーレイを表示
    displayOverlay(request.result, request.position); // ★ 表示位置を受け取る
  } else if (request.action === "showLoading") {
    // ローディング表示
    displayLoadingOverlay(request.position); // ★ 表示位置を受け取る
  }
});

// --- ★ 位置情報と状態管理のグローバル変数 ---
let lastMousePosition = { x: 0, y: 0 };
let pressTimer = null;
let isLongPressing = false;
const LONG_PRESS_TIME = 500; // 長押し時間を少し短縮

// --- イベントリスナーの整理 ---

// マウスの位置を常に追跡
document.addEventListener('mousemove', (e) => {
  lastMousePosition = { x: e.clientX, y: e.clientY };
  // マウスが動いたら長押しタイマーはリセット
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
}, true); // キャプチャフェーズでイベントを取得

document.addEventListener('mousedown', (e) => {
  // 左クリック(e.button === 0) または 右クリック(e.button === 2) の場合にのみ作動
  if (e.button !== 0 && e.button !== 2) return;

  // 選択されたテキストを取得
  const selectedText = window.getSelection().toString().trim();

  // 長押しタイマーを開始
  pressTimer = setTimeout(() => {
    const textToFactCheck = selectedText.length > 0 ? selectedText : e.target.textContent.trim();

    if (textToFactCheck.length > 0) {
      isLongPressing = true; // 長押し状態に設定
      // background.js にメッセージを送信
      chrome.runtime.sendMessage({
        action: "factCheckFromLongPress",
        query: textToFactCheck,
        position: lastMousePosition // ★ マウスの位置を渡す
      });
    }
    pressTimer = null;
  }, LONG_PRESS_TIME);

}, true); // キャプチャフェーズでイベントを取得

document.addEventListener('mouseup', (e) => {
  clearTimeout(pressTimer);
  pressTimer = null;
  // mouseup後、少し遅れてフラグをリセットすることで、contextmenuイベントが先に発火するのを待つ
  setTimeout(() => {
    isLongPressing = false;
  }, 50);
}, true); // キャプチャフェーズでイベントを取得

// ★ 右クリックメニューの制御
document.addEventListener('contextmenu', (e) => {
  if (isLongPressing) {
    // 長押しが完了していたら、デフォルトのメニューをキャンセル
    e.preventDefault();
  }
}, true); // キャプチャフェーズでイベントを取得


// --- オーバーレイ表示関数の修正 ---

function displayLoadingOverlay(position) {
  const existingOverlay = document.getElementById("veritas-lens-overlay");
  if (existingOverlay) {
    existingOverlay.remove();
  }
  const overlay = createBaseOverlay(position); // ★ 位置を渡す
  overlay.style.width = "200px";
  overlay.innerHTML = `
    <img src="${chrome.runtime.getURL('VeritasLens.png')}" alt="Veritas Lens Logo" style="width: 80px; margin-bottom: 10px;">
    <p style="font-weight: bold; color: #007bff;">AIが情報を分析中...</p>
    <div class="spinner"></div>
  `;
  document.body.appendChild(overlay);
}

function displayOverlay(result, position) {
  const existingOverlay = document.getElementById("veritas-lens-overlay");
  if (existingOverlay) {
    existingOverlay.remove();
  }
  const overlay = createBaseOverlay(position); // ★ 位置を渡す
  overlay.innerHTML = `
    <img src="${chrome.runtime.getURL('VeritasLens.png')}" alt="Veritas Lens Logo" style="width: 100px; display: block; margin: 0 auto 15px auto;">
    <div>${parseAndStyleResult(result)}</div>
    <button id="veritas-lens-close-btn" style="margin-top: 15px; padding: 8px 15px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; width: 100%;">閉じる</button>
  `;
  document.body.appendChild(overlay);

  // 閉じるボタンにイベントリスナーを追加
  document.getElementById("veritas-lens-close-btn").onclick = () => overlay.remove();
}

function createBaseOverlay(position) {
  const overlay = document.createElement("div");
  overlay.id = "veritas-lens-overlay";
  // ★ 位置調整ロジック
  const overlayWidth = 350;
  const overlayHeight = 400; // 仮の高さ
  let top = position.y + 15;
  let left = position.x + 15;

  // 画面外にはみ出さないように調整
  if (left + overlayWidth > window.innerWidth) {
    left = window.innerWidth - overlayWidth - 20;
  }
  if (top + overlayHeight > window.innerHeight) {
    top = window.innerHeight - overlayHeight - 20;
  }

  overlay.style.cssText = `
    position: fixed;
    top: ${top}px;
    left: ${left}px;
    width: ${overlayWidth}px;
    max-height: 80vh;
    background-color: rgba(255, 255, 255, 0.98);
    border: 1px solid #ddd;
    border-radius: 10px;
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.25);
    padding: 20px;
    z-index: 2147483647; /* 他の要素より手前に */
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    color: #333;
    line-height: 1.6;
    overflow-y: auto;
    text-align: center;
  `;
  return overlay;
}

function parseAndStyleResult(rawResult) {
    let html = '';
    // エラーメッセージを検出した場合の特別な処理
    if (rawResult.includes('【評価】: エラー')) {
        return `<div style="background-color: #dc3545; color: white; padding: 15px; border-radius: 8px; text-align: center;">
                    <p style="font-weight: bold; font-size: 16px;">ファクトチェックエラー</p>
                    <p>${rawResult.replace(/\n/g, '<br>')}</p>
                </div>`;
    }

    const sections = rawResult.split(/【(.*?)】:/).filter(Boolean);

    for (let i = 0; i < sections.length; i += 2) {
        const title = sections[i].trim();
        let content = sections[i + 1].trim().replace(/\n/g, '<br>'); // 改行を<br>に
        let color = '#333';

        if (title === '評価') {
            if (content.includes('誤り') || content.includes('虚偽')) {
                color = '#dc3545'; // 赤
            } else if (content.includes('真実') || content.includes('事実')) {
                color = '#28a745'; // 緑
            } else if (content.includes('不明') || content.includes('部分的に正しい') || content.includes('文脈が必要')) {
                color = '#ffc107'; // 黄
            }
            html += `<p style="font-weight: bold; color: ${color}; font-size: 16px; margin-bottom: 10px;"><strong>【${title}】</strong><br>${content}</p>`;
        } else if (title === '根拠・情報源') {
             // URLを自動でリンクに変換
            const urlRegex = /(https?:\/\/[^\s<]+)/g;
            content = content.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #007bff;">$1</a>');
            html += `<div style="font-size: 12px; color: #666; text-align: left; margin-top: 15px;"><strong style="display: block; margin-bottom: 5px;">【${title}】</strong>${content}</div>`;
        } else {
             html += `<div style="text-align: left; margin-top: 15px;"><strong style="display: block; margin-bottom: 5px;">【${title}】</strong>${content}</div>`;
        }
    }
    return html || `<p>${rawResult.replace(/\n/g, '<br>')}</p>`; // パースできなかった場合はそのまま表示
}