import axios from "axios";

const FACT_CHECK_API_URL = "https://factchecktools.googleapis.com/v1/claims:search"; // 実際のAPIエンドポイントに変更
const API_KEY = "your-api-key"; // 必要ならAPIキーをセット

const verifyPost = async (postText) => {
  const score = Math.random(); // 仮の信頼度スコア
  return score;
};

export default verifyPost; // default export を