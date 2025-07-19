import "./App.css";
import { useState, useEffect } from "react";
import axios from "axios";

// バックエンドのAPIを呼び出す関数
const verifyPost = async (postText) => {
  try {
    // server.jsの/fact-checkエンドポイントにリクエストを送信
    const response = await axios.post("/fact-check", {
      query: postText,
    });
    // バックエンドからの応答を返す
    return response.data.result;
  } catch (error) {
    console.error("API呼び出し失敗:", error);
    // エラーが発生した場合は、エラーメッセージを返す
    return "エラー: ファクトチェックに失敗しました。";
  }
};

// 投稿を抽出する部分はひとまずそのまま
const extractPosts = () => {
  const posts = document.querySelectorAll(".post-content, .comment-text");
  let extractedTexts = [];

  posts.forEach(post => {
    extractedTexts.push({ text: post.innerText.trim(), result: null });
  });
  
  return extractedTexts;
};

// 結果を表示するコンポーネント
const FactCheckComponent = ({ posts }) => {
  if (!posts || posts.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: "20px", textAlign: "left" }}>
      <h2>ファクトチェック結果:</h2>
      <ul>
        {posts.map((post, index) => (
          <li
            key={index}
            style={{
              backgroundColor: "#333",
              padding: "10px",
              borderRadius: "5px",
              marginBottom: "10px",
              whiteSpace: "pre-wrap" // 改行をそのまま表示
            }}
          >
           <p><b>投稿:</b> {post.text}</p>
           <p><b>結果:</b> {post.result ?? "判定中..."}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};


const Browser = () => {
  const [url, setUrl] = useState("https://www.example.com");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);


  // このuseEffectはデモ用に、コンポーネントがマウントされたときに
  // ダミーの投稿をチェックするように変更します。
  useEffect(() => {
    const checkInitialPost = async () => {
        setLoading(true);
        const dummyPosts = [{ text: "GeminiはGoogleによって開発された。", result: null }];
        const checkedPosts = await Promise.all(
            dummyPosts.map(async (post) => {
                const result = await verifyPost(post.text);
                return { ...post, result };
            })
        );
        setPosts(checkedPosts);
        setLoading(false);
    };

    checkInitialPost();
  }, []);


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
      <h1>Curios</h1>
      <p>ブラウザ拡張機能のUIモックアップ</p>

      {/* URL入力や移動ボタンはUIのイメージとして残します */}
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
        style={{
          backgroundColor: "#444",
          color: "#fff",
          width: "90%",
          padding: "10px",
          marginTop: "10px"
        }}
      >
        移動 (現在機能しません)
      </button>

      {loading && <p>判定中...</p>}
      <FactCheckComponent posts={posts} />
    </div>
  );
};

export default Browser;
