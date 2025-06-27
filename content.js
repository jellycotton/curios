// background.js からメッセージを受け取るリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "displayFactCheckResult") {
    // 結果が返ってきたらオーバーレイを表示
    displayOverlay(request.result);
  } else if (request.action === "showLoading") {
    // ローディング表示
    displayLoadingOverlay();
  }
});

function displayLoadingOverlay() {
  // 既存のオーバーレイがあれば削除
  const existingOverlay = document.getElementById("veritas-lens-overlay");
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = createBaseOverlay(); // ベースのオーバーレイを作成するヘルパー関数
  overlay.style.width = "200px"; // ローディング中は少し小さめに

  // ローディングコンテンツ
  const loadingContent = document.createElement("div");
  loadingContent.style.textAlign = "center";
  loadingContent.innerHTML = `
    <img src="${chrome.runtime.getURL('VeritasLens.png')}" alt="Veritas Lens Logo" style="width: 80px; margin-bottom: 10px;">
    <p>ファクトチェック中...</p>
    <div class="spinner"></div>
  `;
  overlay.appendChild(loadingContent);

  document.body.appendChild(overlay);
}


function displayOverlay(result) {
  // 既存のオーバーレイがあれば削除
  const existingOverlay = document.getElementById("veritas-lens-overlay");
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = createBaseOverlay(); // ベースのオーバーレイを作成するヘルパー関数

  // ロゴの表示
  const logoImg = document.createElement("img");
  logoImg.src = chrome.runtime.getURL('VeritasLens.png'); // 拡張機能内の画像パス
  logoImg.alt = "Veritas Lens Logo";
  logoImg.style.width = "100px"; // ロゴのサイズ調整
  logoImg.style.display = "block";
  logoImg.style.margin = "0 auto 15px auto";
  overlay.appendChild(logoImg);

  // 結果の表示
  const resultContent = document.createElement("div");
  // ここで結果のパースとスタイリングを行う
  resultContent.innerHTML = parseAndStyleResult(result);
  overlay.appendChild(resultContent);

  // 閉じるボタンの作成
  const closeButton = document.createElement("button");
  closeButton.textContent = "閉じる";
  closeButton.style.marginTop = "15px";
  closeButton.style.padding = "8px 15px";
  closeButton.style.backgroundColor = "#007bff";
  closeButton.style.color = "white";
  closeButton.style.border = "none";
  closeButton.style.borderRadius = "5px";
  closeButton.style.cursor = "pointer";
  closeButton.style.width = "100%";
  closeButton.onclick = () => overlay.remove();
  overlay.appendChild(closeButton);

  document.body.appendChild(overlay);
}

// ベースのオーバーレイを作成するヘルパー関数
function createBaseOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "veritas-lens-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "20px";
  overlay.style.right = "20px";
  overlay.style.width = "350px"; // 少し広めに
  overlay.style.maxHeight = "80vh";
  overlay.style.overflowY = "auto";
  overlay.style.backgroundColor = "rgba(255, 255, 255, 0.98)"; // 少し不透明に
  overlay.style.border = "1px solid #ddd";
  overlay.style.borderRadius = "10px"; // 角を丸く
  overlay.style.boxShadow = "0 6px 12px rgba(0, 0, 0, 0.25)"; // 影を濃く
  overlay.style.padding = "20px";
  overlay.style.zIndex = "99999";
  overlay.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"; // フォント変更
  overlay.style.fontSize = "14px";
  overlay.style.color = "#333";
  overlay.style.lineHeight = "1.6"; // 行間を広げる
  return overlay;
}

// 結果をパースしてスタイリングする関数
function parseAndStyleResult(rawResult) {
  let html = '';
  const lines = rawResult.split('\n');
  let evaluation = '';

  lines.forEach(line => {
    if (line.startsWith('【評価】:')) {
      evaluation = line.replace('【評価】:', '').trim();
      let color = '#333'; // デフォルト
      if (evaluation.includes('誤り')) {
        color = '#dc3545'; // 赤
      } else if (evaluation.includes('真実')) {
        color = '#28a745'; // 緑
      } else if (evaluation.includes('不明') || evaluation.includes('要確認')) {
        color = '#ffc107'; // 黄
      }
      html += `<p style="font-weight: bold; color: ${color}; font-size: 16px; margin-bottom: 10px;">${line}</p>`;
    } else if (line.startsWith('【解説】:')) {
      html += `<p style="margin-bottom: 10px;"><strong>${line.substring(0, 5)}</strong>${line.substring(5)}</p>`;
    } else if (line.startsWith('【根拠・情報源】:')) {
      // URLをリンクに変換する処理もここに追加可能
      html += `<p style="font-size: 12px; color: #666;"><strong>${line.substring(0, 9)}</strong>${line.substring(9)}</p>`;
    } else {
      html += `<p>${line}</p>`;
    }
  });
  return html;
}

// --- 長押し機能の追加 ---
let pressTimer;
const LONG_PRESS_TIME = 700; // 長押しと判断する時間（ミリ秒）

document.addEventListener('mousedown', (e) => {
  // テキストを選択している場合は長押しを無効にする（右クリックメニューと競合しないように）
  if (window.getSelection().toString().length > 0) {
    return;
  }

  // テキスト要素を対象とする
  if (e.target.textContent && e.target.textContent.trim().length > 0) {
    pressTimer = setTimeout(() => {
      const selectedText = e.target.textContent.trim();
      if (selectedText.length > 0) {
        // background.js にメッセージを送信
        chrome.runtime.sendMessage({
          action: "factCheckFromLongPress",
          query: selectedText
        });
      }
    }, LONG_PRESS_TIME);
  }
});

document.addEventListener('mouseup', () => {
  clearTimeout(pressTimer);
});

document.addEventListener('mousemove', () => {
  clearTimeout(pressTimer);
});

// モバイル対応 (touchstart, touchend, touchmove)
document.addEventListener('touchstart', (e) => {
  // テキストを選択している場合は長押しを無効にする
  if (window.getSelection().toString().length > 0) {
    return;
  }

  if (e.target.textContent && e.target.textContent.trim().length > 0) {
    pressTimer = setTimeout(() => {
      const selectedText = e.target.textContent.trim();
      if (selectedText.length > 0) {
        chrome.runtime.sendMessage({
          action: "factCheckFromLongPress",
          query: selectedText
        });
      }
    }, LONG_PRESS_TIME);
  }
});

document.addEventListener('touchend', () => {
  clearTimeout(pressTimer);
});

document.addEventListener('touchmove', () => {
  clearTimeout(pressTimer);
});