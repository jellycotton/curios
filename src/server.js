import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';
import axios from 'axios'; // axiosをインポート

// --- (ESM環境での__dirname設定は変更なし) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// -----------------------------------------

const app = express();
const port = 3000;

app.use(cors());

// Custom Search APIの設定
const CUSTOM_SEARCH_API_KEY = process.env.CUSTOM_SEARCH_API_KEY;
const CSE_ID = process.env.CSE_ID;

// Web検索を実行する関数
async function googleSearch(query) {
  if (!CUSTOM_SEARCH_API_KEY || !CSE_ID) {
    console.warn("Custom Search API Key or CSE ID is not set. Skipping web search.");
    return null;
  }

  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: CUSTOM_SEARCH_API_KEY,
        cx: CSE_ID,
        q: query,
        num: 3, // 取得する検索結果の数（最大10）
      },
    });

    if (response.data.items && response.data.items.length > 0) {
      // 検索結果からタイトル、スニペット、URLを抽出
      return response.data.items.map(item => ({
        title: item.title,
        snippet: item.snippet,
        link: item.link,
      }));
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error with Custom Search API:', error.response ? error.response.data : error.message);
    return null;
  }
}

// ★ Gemini APIの初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// --- (/fact-check エンドポイントをGemini用に書き換え) ---
app.post('/fact-check', async (req, res) => {
  const { query } = req.body; // webContentはbackground.jsから削除したので、ここでは受け取らない

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  // テキストの長さをチェック
  if (query.length > 2000) {
    return res.status(400).json({ error: 'Query too long. Maximum 2000 characters allowed.' });
  }

  try {
    console.log(`[${new Date().toISOString()}] Fact-checking request: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
    
    // Web検索を実行
    const searchResults = await googleSearch(query);
    let webContentString = 'なし';
    if (searchResults && searchResults.length > 0) {
      webContentString = searchResults.map(item => `タイトル: ${item.title}\nスニペット: ${item.snippet}\nURL: ${item.link}`).join('\n\n');
    }

    // ★ AIへの指示（プロンプト）- より詳細で構造化された指示
    const prompt = `
      以下のテキストについて、正確で客観的なファクトチェックを行ってください。
      主張が事実に基づいているか、誤解を招く情報でないか、公平な視点で評価してください。
      提供されたWeb検索結果を参考にし、その情報源の信頼性も考慮して判断してください。
      
      回答は必ず以下の形式で、簡潔かつ分かりやすくまとめてください：

      【評価】: (例: 事実, ほぼ事実, 部分的に正しい, 誤りの可能性, 誤り, 情報不足, など)
      【解説】: (評価の理由を具体的に説明。150文字以内で)
      【根拠・情報源】: (参考になったWeb検索結果のURLや、その他の根拠)

      ---
      検証対象テキスト: "${query}"
      ---
      Web検索結果:
      ${webContentString}
      ---
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log(`[${new Date().toISOString()}] Fact-check completed successfully`);
    res.json({ result: text });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error with Gemini API:`, error);
    
    // より詳細なエラー情報を提供
    let errorMessage = 'ファクトチェック中にエラーが発生しました。';
    if (error.message.includes('API_KEY')) {
      errorMessage = 'API認証エラーが発生しました。設定を確認してください。';
    } else if (error.message.includes('QUOTA')) {
      errorMessage = 'API利用制限に達しました。しばらく時間をおいてから再試行してください。';
    } else if (error.message.includes('TIMEOUT')) {
      errorMessage = 'タイムアウトエラーが発生しました。再試行してください。';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
// ----------------------------------------------------

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});