import "./App.css";
import logo from "./assets/A_magnifying_glass_w.png"; // 修正後の画像パス
import { useState, useEffect } from "react";
import axios from "axios";

const FACT_CHECK_API_URL = "https://factchecktools.googleapis.com/v1/claims:search"; // APIエンドポイント
const API_KEY = "your-api-key"; // ここに **実際の API キー** をセット

const verifyPost = async (postText) => {
  try {
    const response = await axios.get(FACT_CHECK_API_URL, {
      params: {
        query: postText,
        languageCode: "ja",
        key: API_KEY,
      },
    });

    const claims = response.data.claims || [];
    if (claims.length > 0) {
      return claims[0].claimReview[0].textualRating === "True" ? 1.0 : 0.3;
    }

    return 0.5;
  } catch (error) {
    console.error("API呼び出し失敗:", error);
    return Math.random();
  }
};

const extractPosts = () => {
  const posts = document.querySelectorAll(".post-content, .comment-text");
  let extractedTexts = [];

  posts.forEach(post => {
    extractedTexts.push({ text: post.innerText.trim(), score: null });
  });

  return extractedTexts;
};

const FactCheckComponent = ({ posts }) => {
  return (
    <div style={{ marginTop: "20px" }}>
      <h2>投稿のファクトチェック結果:</h2>
      <ul>
        {posts.map((post, index) => (
          <li
            key={index}
            style={{
              backgroundColor: post.score > 0.7 ? "#4CAF50" : "#F44336",
              padding: "10px",
              borderRadius: "5px"
            }}
          >
            {post.text} (信頼度: {post.score?.toFixed(2) ?? "計算中..."})
          </li>
        ))}
      </ul>
    </div>
  );
};

const Browser = () => {
  const [url, setUrl] = useState("https://www.example.com");
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    setTimeout(async () => {
      const extracted = extractPosts();
      for (const post of extracted) {
        post.score = await verifyPost(post.text);
      }
      setPosts([...extracted]);
    }, 3000);
  }, [url]);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        maxWidth: "414px",
        backgroundColor: "#1e1e1e",
        color: "#ffffff",
        padding: "20px",
        textAlign: "center"
      }}
    >
      {/* ロゴを表示 */}
      <img src={logo} alt="Veritas Logo" style={{ width: "150px", height: "auto" }} />

      <h1>Veritas</h1>

      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URLを入力"
        style={{
          backgroundColor: "#333",
          color: "#fff",
          width: "90%",
          padding: "10px",
          borderRadius: "5px"
        }}
      />
      <button
        onClick={() => window.location.href = url}
        style={{
          backgroundColor: "#444",
          color: "#fff",
          width: "90%",
          padding: "10px",
          marginTop: "10px"
        }}
      >
        🔍 移動
      </button>

      <FactCheckComponent posts={posts} />
    </div>
  );
};

export default Browser;