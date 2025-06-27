document.getElementById('check-button').addEventListener('click', async () => {
  const text = document.getElementById('text-input').value;
  if (!text) {
    alert('テキストを入力してください。');
    return;
  }

  const response = await fetch('/fact-check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: text }), // ★ ユーザーの入力を送信するように戻す
  });

  const data = await response.json();
  displayResults(data);
});

function displayResults(data) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = ''; // 前の結果をクリア

  if (data.error) {
    resultsDiv.innerHTML = `<p style="color: red;">エラー: ${data.error}</p>`;
  } else if (data.result) {
    // ★ Geminiからのテキストを整形して表示
    const formattedResult = data.result.replace(/\n/g, '<br>'); // 改行を<br>タグに変換
    resultsDiv.innerHTML = formattedResult;
  } else {
    resultsDiv.innerHTML = '<p>結果を取得できませんでした。</p>';
  }
}