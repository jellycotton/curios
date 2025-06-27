// 拡張機能がインストールされたときに実行される処理
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "veritas-lens-fact-check",
    title: "Veritas Lensでファクトチェック",
    contexts: ["selection"]
  });
});

// 右クリックメニューがクリックされたときに実行される処理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "veritas-lens-fact-check" && info.selectionText) {
    // 右クリックからのファクトチェック
    performFactCheck(info.selectionText, tab.id);
  }
});

// content.js からのメッセージを受け取るリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "factCheckFromLongPress" && request.query) {
    // 長押しからのファクトチェック
    if (sender.tab && sender.tab.id) {
      performFactCheck(request.query, sender.tab.id);
    }
  }
});

// ファクトチェックを実行する共通関数
async function performFactCheck(query, tabId) {
  // ローディング表示をcontent.jsに送信
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { action: "showLoading" });
  }

  try {
    // APIサーバーにリクエストを送信
    const response = await fetch("http://localhost:3000/fact-check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: query }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    
    // 結果をcontent.jsに送信
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: "displayFactCheckResult",
        result: data.result
      });
    }

  } catch (error) {
    console.error("Error fetching fact-check:", error);
    // エラーもcontent.jsに送信して表示
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: "displayFactCheckResult",
        result: `【評価】: エラー\n【解説】: ファクトチェック中にエラーが発生しました。\n【根拠・情報源】: ${error.message}`
      });
    }
  }
}