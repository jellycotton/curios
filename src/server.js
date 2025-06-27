import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai'; // ★ Geminiライブラリをインポート

// --- (ESM環境での__dirname設定は変更なし) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });
// -----------------------------------------

const app = express();
const port = 3000;

// ★ Gemini APIの初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // .envのキー名を変更
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// --- (/fact-check エンドポイントをGemini用に書き換え) ---
app.post('/fact-check', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    // ★ AIへの指示（プロンプト）
    const prompt = `
      以下のテキストについて、ファクトチェックを行ってください。
      主張が事実に基づいているか、誤解を招く情報でないか、公平な視点で評価してください。
      評価の根拠となる情報源や、関連する情報があれば、それも合わせて提示してください。
      回答は簡潔に、以下の形式でまとめてください。

      【評価】: (例: 誤り, ほぼ真実, 事実であるが文脈が必要, など)
      【解説】: (評価の理由を具体的に説明)
      【根拠・情報源】: (参考になるURLなど)

      ---
      テキスト: "${query}"
      ---
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ result: text });

  } catch (error) {
    console.error('Error with Gemini API:', error);
    res.status(500).json({ error: 'Failed to fetch data from Gemini API' });
  }
});
// ----------------------------------------------------

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});