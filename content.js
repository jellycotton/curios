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
let selectedText = '';

// ★ オーバーレイ表示の設定値
const LONG_PRESS_TIME = 400; // 長押し時間を短縮（より反応的に）
const MINIMUM_TEXT_LENGTH = 3; // 最小テキスト長
const MIN_OVERLAY_HEIGHT = 250; // オーバーレイの最小必要高さ
const PREFERRED_OFFSET = 15; // マウス位置からの理想的な距離
const MAX_UPWARD_DISTANCE = 150; // 押した位置から上方向への最大距離
const SCREEN_MARGIN = 20; // 画面端からの余白

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
  selectedText = window.getSelection().toString().trim();

  // 視覚的フィードバック: 要素をハイライト
  if (e.target.tagName !== 'BODY' && e.target.tagName !== 'HTML') {
    e.target.style.transition = 'background-color 0.3s ease';
    e.target.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
  }

  // 長押しタイマーを開始
  pressTimer = setTimeout(() => {
    const textToFactCheck = selectedText.length > 0 ? selectedText : getElementText(e.target);

    if (textToFactCheck.length >= MINIMUM_TEXT_LENGTH) {
      isLongPressing = true; // 長押し状態に設定
      // ハプティックフィードバック（可能な場合）
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
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
  
  // ハイライトを削除
  if (e.target.style.backgroundColor) {
    e.target.style.backgroundColor = '';
  }
  
  // mouseup後、少し遅れてフラグをリセットすることで、contextmenuイベントが先に発火するのを待つ
  setTimeout(() => {
    isLongPressing = false;
  }, 50);
}, true); // キャプチャフェーズでイベントを取得

// --- ★ 右クリックメニューの制御
document.addEventListener('contextmenu', (e) => {
  if (isLongPressing) {
    // 長押しが完了していたら、デフォルトのメニューをキャンセル
    e.preventDefault();
  }
}, true); // キャプチャフェーズでイベントを取得

// --- ユーティリティ関数 ---

// 要素からテキストを安全に取得する関数
function getElementText(element) {
  if (!element) return '';
  
  // 特定のタグは除外
  const excludedTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'];
  if (excludedTags.includes(element.tagName)) return '';
  
  let text = element.textContent || element.innerText || '';
  text = text.trim();
  
  // 長すぎるテキストは切り詰める
  if (text.length > 500) {
    text = text.substring(0, 500) + '...';
  }
  
  return text;
}


// --- オーバーレイ表示関数の修正 ---

// ★ ローディング専用のオーバーレイ作成関数
function createLoadingOverlay(position) {
  const overlay = document.createElement("div");
  overlay.id = "curios-overlay";
  
  // ★ レスポンシブなローディングオーバーレイサイズ計算
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const overlayWidth = Math.min(280, screenWidth - 40); // ローディング時は少し小さめ
  const overlayHeight = 200; // ローディング時は固定高さ
  
  // ★ 結果表示と同じ位置調整ロジックを適用
  let top = position.y - (overlayHeight / 2); // 長押しポイントを縦の中心に
  let left = position.x + PREFERRED_OFFSET;
  
  // 配置方向を決定
  const spaceRight = screenWidth - position.x;
  const spaceLeft = position.x;
  const spaceBelow = screenHeight - position.y;
  const spaceAbove = position.y;
  
  // 横方向の配置決定
  if (spaceRight >= overlayWidth + SCREEN_MARGIN) {
    left = position.x + PREFERRED_OFFSET;
  } else if (spaceLeft >= overlayWidth + SCREEN_MARGIN) {
    left = position.x - overlayWidth - PREFERRED_OFFSET;
  } else {
    left = Math.max(SCREEN_MARGIN, (screenWidth - overlayWidth) / 2);
  }
  
  // 縦方向の境界チェック
  if (top < SCREEN_MARGIN) {
    top = SCREEN_MARGIN;
  } else if (top + overlayHeight > screenHeight - SCREEN_MARGIN) {
    top = screenHeight - overlayHeight - SCREEN_MARGIN;
  }
  
  // 最終的な境界チェック
  left = Math.max(SCREEN_MARGIN, Math.min(left, screenWidth - overlayWidth - SCREEN_MARGIN));
  top = Math.max(SCREEN_MARGIN, Math.min(top, screenHeight - overlayHeight - SCREEN_MARGIN));
  
  console.log(`Loading overlay: mouse: (${position.x}, ${position.y}), overlay: (${left}, ${top}), size: ${overlayWidth}x${overlayHeight}`);

  overlay.style.cssText = `
    position: fixed;
    top: ${top}px;
    left: ${left}px;
    width: ${overlayWidth}px;
    height: ${overlayHeight}px;
    background-color: rgba(255, 255, 255, 0.98);
    border: 1px solid #ddd;
    border-radius: 10px;
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.25);
    padding: 20px;
    z-index: 2147483647;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    color: #333;
    line-height: 1.6;
    text-align: center;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  `;
  
  return overlay;
}

function displayLoadingOverlay(position) {
  const existingOverlay = document.getElementById("curios-overlay");
  const existingBackdrop = document.getElementById("curios-backdrop") || document.getElementById("curios-loading-backdrop");
  
  if (existingOverlay) {
    existingOverlay.remove();
  }
  if (existingBackdrop) {
    existingBackdrop.remove();
  }
  
  // デバッグ: 位置情報をコンソールに出力
  console.log(`Loading overlay position: x=${position.x}, y=${position.y}, screen: ${window.innerWidth}x${window.innerHeight}`);
  
  // ★ 専用のローディングオーバーレイを作成
  const overlay = createLoadingOverlay(position);
  overlay.style.animation = "fadeIn 0.3s ease-out";
  
  // ★ ローディング専用の内容
  overlay.innerHTML = `
    <img src="${chrome.runtime.getURL('Curios.png')}" alt="Curios Logo" style="width: 80px; display: block; margin: 0 auto 15px auto;">
    <p style="font-weight: bold; color: #007bff; margin-bottom: 10px; font-size: 16px;">AI分析中...</p>
    <div style="display: flex; justify-content: center; align-items: center; margin: 20px 0;">
      <div style="width: 8px; height: 8px; background: #007bff; border-radius: 50%; margin: 0 2px; animation: dot-bounce 1.4s ease-in-out infinite both; animation-delay: -0.32s;"></div>
      <div style="width: 8px; height: 8px; background: #007bff; border-radius: 50%; margin: 0 2px; animation: dot-bounce 1.4s ease-in-out infinite both; animation-delay: -0.16s;"></div>
      <div style="width: 8px; height: 8px; background: #007bff; border-radius: 50%; margin: 0 2px; animation: dot-bounce 1.4s ease-in-out infinite both;"></div>
    </div>
    <p style="font-size: 12px; color: #666; margin-top: 10px; margin-bottom: 0;">しばらくお待ちください</p>
    <style>
      @keyframes dot-bounce {
        0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
        40% { transform: scale(1.2); opacity: 1; }
      }
    </style>
  `;
  
  // バックドロップ（背景クリック検出用）を作成
  const backdrop = document.createElement("div");
  backdrop.id = "curios-loading-backdrop";
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: transparent;
    z-index: 2147483646;
  `;
  
  // 閉じる関数を定義
  const closeLoadingOverlay = () => {
    overlay.style.animation = "fadeOut 0.3s ease-in";
    backdrop.style.animation = "fadeOut 0.3s ease-in";
    setTimeout(() => {
      if (overlay.parentNode) overlay.remove();
      if (backdrop.parentNode) backdrop.remove();
      document.removeEventListener('keydown', loadingEscapeHandler);
    }, 300);
  };
  
  // バックドロップを先に追加
  document.body.appendChild(backdrop);
  document.body.appendChild(overlay);
  
  // バックドロップクリックで閉じる
  backdrop.addEventListener('click', closeLoadingOverlay);
  
  // Escapeキーでも閉じられるように
  const loadingEscapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeLoadingOverlay();
    }
  };
  document.addEventListener('keydown', loadingEscapeHandler);
}

function displayOverlay(result, position) {
  const existingOverlay = document.getElementById("curios-overlay");
  const existingBackdrop = document.getElementById("curios-backdrop") || document.getElementById("curios-loading-backdrop");
  
  // ローディングオーバーレイの位置を記憶
  let loadingPosition = null;
  if (existingOverlay) {
    const rect = existingOverlay.getBoundingClientRect();
    loadingPosition = {
      top: rect.top,
      left: rect.left,
      width: rect.width
    };
    
    // ローディングから結果への滑らかな遷移
    existingOverlay.style.transition = "all 0.3s ease";
    existingOverlay.style.opacity = "0";
    existingOverlay.style.transform = "scale(0.95)";
    setTimeout(() => existingOverlay.remove(), 300);
  }
  if (existingBackdrop) {
    existingBackdrop.style.transition = "all 0.3s ease";
    existingBackdrop.style.opacity = "0";
    setTimeout(() => existingBackdrop.remove(), 300);
  }
  
  // ★ コンテンツの長さに基づく動的サイズ調整
  const estimatedContentHeight = estimateContentHeight(result);
  
  // 少し遅延を加えて滑らかな表示を実現
  setTimeout(() => {
    // ローディング画面の位置を使用して結果オーバーレイを作成
    const overlay = createResultOverlay(result, position, loadingPosition);
    overlay.style.animation = "slideIn 0.4s ease-out";
    
    // オーバーレイの内部構造をFlexboxで変更
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    
    // バックドロップ（背景クリック検出用）を作成
    const backdrop = document.createElement("div");
    backdrop.id = "curios-backdrop";
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: transparent;
      z-index: 2147483646;
    `;

    overlay.innerHTML = `
      <img src="${chrome.runtime.getURL('Curios.png')}" alt="Curios Logo" style="width: 80px; display: block; margin: 0 auto 15px auto;">
      <div style="flex-grow: 1; overflow-y: auto; padding-bottom: 15px;">${parseAndStyleResult(result)}</div>
      <div style="margin-top: auto; display: flex; gap: 10px;">
        <button id="curios-copy-btn" style="flex: 1; padding: 8px 12px; background-color: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">コピー</button>
        <button id="curios-close-btn" style="flex: 1; padding: 8px 12px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">閉じる</button>
      </div>
    `;
    
    // バックドロップを先に追加
    document.body.appendChild(backdrop);
    document.body.appendChild(overlay);
    
    // 閉じる関数を定義
    const closeOverlay = () => {
      overlay.style.animation = "fadeOut 0.3s ease-in";
      backdrop.style.animation = "fadeOut 0.3s ease-in";
      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
        if (backdrop.parentNode) backdrop.remove();
        document.removeEventListener('keydown', escapeHandler);
      }, 300);
    };

    // ボタンにイベントリスナーを追加
    document.getElementById("curios-close-btn").onclick = closeOverlay;
    
    // バックドロップクリックで閉じる
    backdrop.addEventListener('click', closeOverlay);
    
    // Escapeキーでも閉じられるように
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeOverlay();
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    document.getElementById("curios-copy-btn").onclick = () => {
      // まずモダンなClipboard APIを試す
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(result).then(() => {
          const btn = document.getElementById("curios-copy-btn");
          btn.textContent = "コピー完了!";
          btn.style.backgroundColor = "#6f42c1";
          setTimeout(() => {
            btn.textContent = "コピー";
            btn.style.backgroundColor = "#28a745";
          }, 1000);
        }).catch(() => {
          // Clipboard APIが失敗した場合はフォールバック
          fallbackCopy(result);
        });
      } else {
        // Clipboard APIが利用できない場合はフォールバック
        fallbackCopy(result);
      }
    };
    
    // フォールバック用のコピー関数
    function fallbackCopy(text) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        const btn = document.getElementById("curios-copy-btn");
        if (successful) {
          btn.textContent = "コピー完了!";
          btn.style.backgroundColor = "#6f42c1";
        } else {
          btn.textContent = "コピー失敗";
          btn.style.backgroundColor = "#dc3545";
        }
        setTimeout(() => {
          btn.textContent = "コピー";
          btn.style.backgroundColor = "#28a745";
        }, 1000);
      } catch (err) {
        const btn = document.getElementById("curios-copy-btn");
        btn.textContent = "コピー不可";
        btn.style.backgroundColor = "#dc3545";
        setTimeout(() => {
          btn.textContent = "コピー";
          btn.style.backgroundColor = "#28a745";
        }, 1000);
        console.error('フォールバックコピーも失敗:', err);
      }
      
      document.body.removeChild(textArea);
    }
  }, existingOverlay ? 300 : 0); // ローディングがある場合は遷移時間を考慮
}

// ★ コンテンツ高さを推定する関数
function estimateContentHeight(content) {
  const tempDiv = document.createElement('div');
  tempDiv.style.cssText = `
    position: absolute;
    top: -9999px;
    left: -9999px;
    width: 310px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    padding: 20px;
    box-sizing: border-box;
  `;
  tempDiv.innerHTML = parseAndStyleResult(content);
  document.body.appendChild(tempDiv);
  
  const height = tempDiv.offsetHeight;
  document.body.removeChild(tempDiv);
  
  // ロゴ、ボタン、余白分を追加
  return height + 120; // 80px(ロゴ) + 40px(ボタン・余白)
}

// ★ 結果オーバーレイ専用の作成関数（ローディング位置を基準にする）
function createResultOverlay(result, originalPosition, loadingPosition) {
  const overlay = document.createElement("div");
  overlay.id = "curios-overlay";
  
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const contentHeight = estimateContentHeight(result);
  
  let overlayWidth, overlayTop, overlayLeft, overlayMaxHeight;
  
  if (loadingPosition) {
    // ローディング画面の位置を基準にする
    overlayWidth = Math.min(350, screenWidth - 40); // 結果画面は少し幅を広げる
    overlayLeft = loadingPosition.left;
    overlayTop = loadingPosition.top + (200 / 2) - (contentHeight / 2); // ローディングの中心から結果の中心へ調整
    
    // 幅が変わった場合の左位置調整
    const widthDiff = overlayWidth - loadingPosition.width;
    if (widthDiff > 0) {
      // 右側にはみ出る場合は左に調整
      if (overlayLeft + overlayWidth > screenWidth - SCREEN_MARGIN) {
        overlayLeft = Math.max(SCREEN_MARGIN, screenWidth - overlayWidth - SCREEN_MARGIN);
      }
    }
    
    // 縦方向の境界チェック
    if (overlayTop < SCREEN_MARGIN) {
      overlayTop = SCREEN_MARGIN;
    } else if (overlayTop + contentHeight > screenHeight - SCREEN_MARGIN) {
      overlayTop = screenHeight - contentHeight - SCREEN_MARGIN;
    }
    
    overlayMaxHeight = Math.min(contentHeight, screenHeight - overlayTop - SCREEN_MARGIN);
    
  } else {
    // フォールバック：ローディング位置が不明な場合は従来の位置計算
    overlayWidth = Math.min(350, screenWidth - 40);
    overlayTop = originalPosition.y - (Math.min(screenHeight * 0.8, 600) / 2); // 長押しポイントを縦の中心に
    overlayLeft = originalPosition.x + PREFERRED_OFFSET;
    overlayMaxHeight = Math.min(screenHeight * 0.8, 600);
    
    // 基本的な境界チェック
    overlayLeft = Math.max(SCREEN_MARGIN, Math.min(overlayLeft, screenWidth - overlayWidth - SCREEN_MARGIN));
    if (overlayTop < SCREEN_MARGIN) {
      overlayTop = SCREEN_MARGIN;
    } else if (overlayTop + overlayMaxHeight > screenHeight - SCREEN_MARGIN) {
      overlayTop = screenHeight - overlayMaxHeight - SCREEN_MARGIN;
    }
  }
  
  console.log(`Result overlay: loading pos: ${loadingPosition ? `(${loadingPosition.left}, ${loadingPosition.top})` : 'none'}, result: (${overlayLeft}, ${overlayTop}), size: ${overlayWidth}x${overlayMaxHeight}, content: ${contentHeight}px`);

  overlay.style.cssText = `
    position: fixed;
    top: ${overlayTop}px;
    left: ${overlayLeft}px;
    width: ${overlayWidth}px;
    max-height: ${overlayMaxHeight}px;
    background-color: rgba(255, 255, 255, 0.98);
    border: 1px solid #ddd;
    border-radius: 10px;
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.25);
    padding: 20px;
    z-index: 2147483647;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    color: #333;
    line-height: 1.6;
    text-align: center;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    overflow-y: auto;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  `;
  
  return overlay;
}

function parseAndStyleResult(rawResult) {
    let html = '';
    // エラーメッセージを検出した場合の特別な処理
    if (rawResult.includes('【評価】: エラー') || rawResult.includes('エラー')) {
        return `<div style="background-color: #dc3545; color: white; padding: 15px; border-radius: 8px; text-align: center;">
                    <p style="font-weight: bold; font-size: 16px;">⚠️ ファクトチェックエラー</p>
                    <p style="font-size: 14px;">${rawResult.replace(/\n/g, '<br>')}</p>
                </div>`;
    }

    const sections = rawResult.split(/【(.*?)】:/).filter(Boolean);

    for (let i = 0; i < sections.length; i += 2) {
        const title = sections[i]?.trim();
        let content = sections[i + 1]?.trim().replace(/\n/g, '<br>'); // 改行を<br>に
        if (!title || !content) continue;
        
        let color = '#333';
        let emoji = '';

        if (title === '評価') {
            if (content.includes('誤り') || content.includes('虚偽') || content.includes('フェイク')) {
                color = '#dc3545'; // 赤
                emoji = '❌';
            } else if (content.includes('真実') || content.includes('事実')) {
                color = '#28a745'; // 緑
                emoji = '✅';
            } else if (content.includes('不明') || content.includes('部分的') || content.includes('文脈が必要')) {
                color = '#ffc107'; // 黄
                emoji = '⚠️';
            } else {
                emoji = '📊';
            }
            html += `<p style="font-weight: bold; color: ${color}; font-size: 16px; margin-bottom: 10px;"><strong>${emoji} 【${title}】</strong><br>${content}</p>`;
        } else if (title === '根拠・情報源') {
             // URLを自動でリンクに変換
            const urlRegex = /(https?:\/\/[^\s<]+)/g;
            content = content.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: underline;">🔗 リンク</a>');
            html += `<div style="font-size: 12px; color: #666; text-align: left; margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 5px;"><strong style="display: block; margin-bottom: 5px;">📚 【${title}】</strong>${content}</div>`;
        } else {
             html += `<div style="text-align: left; margin-top: 15px; padding: 10px; border-left: 3px solid #007bff; background-color: rgba(0, 123, 255, 0.05);"><strong style="display: block; margin-bottom: 5px;">【${title}】</strong>${content}</div>`;
        }
    }
    return html || `<p>${rawResult.replace(/\n/g, '<br>')}</p>`; // パースできなかった場合はそのまま表示
}

// --- クリーンアップとメモリ管理 ---

// ページが非表示になったときのクリーンアップ
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const overlay = document.getElementById("curios-overlay");
    if (overlay) {
      overlay.remove();
    }
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }
});

// 画面リサイズ時のオーバーレイ位置調整
window.addEventListener('resize', () => {
  const overlay = document.getElementById("curios-overlay");
  if (overlay) {
    // 現在の位置を取得
    const rect = overlay.getBoundingClientRect();
    const currentPos = { x: rect.left, y: rect.top };
    
    // 新しい位置を計算
    const overlayWidth = 350;
    const overlayMaxHeight = Math.min(window.innerHeight * 0.8, 600);
    const margin = 20;
    
    let newLeft = currentPos.x;
    let newTop = currentPos.y;
    
    // 画面外にはみ出していないかチェックして調整
    if (newLeft + overlayWidth > window.innerWidth - margin) {
      newLeft = window.innerWidth - overlayWidth - margin;
    }
    if (newLeft < margin) {
      newLeft = margin;
    }
    if (newTop + overlayMaxHeight > window.innerHeight - margin) {
      newTop = window.innerHeight - overlayMaxHeight - margin;
    }
    if (newTop < margin) {
      newTop = margin;
    }
    
    // 位置を更新
    overlay.style.left = `${newLeft}px`;
    overlay.style.top = `${newTop}px`;
    overlay.style.maxHeight = `${Math.min(window.innerHeight * 0.8, 600)}px`;
  }
});

// スクロール時のオーバーレイ位置調整
window.addEventListener('scroll', () => {
  const overlay = document.getElementById("curios-overlay");
  if (overlay) {
    // スクロール時は position: fixed なので特に調整不要だが、
    // 必要に応じて画面外に出ていないかチェック
    const rect = overlay.getBoundingClientRect();
    const margin = 20;
    
    if (rect.bottom > window.innerHeight - margin) {
      overlay.style.top = `${window.innerHeight - rect.height - margin}px`;
    }
    if (rect.top < margin) {
      overlay.style.top = `${margin}px`;
    }
  }
});

// 拡張機能が無効化されたときのクリーンアップ
window.addEventListener('beforeunload', () => {
  const overlay = document.getElementById("curios-overlay");
  if (overlay) {
    overlay.remove();
  }
});