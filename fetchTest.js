import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config(); // 🔹 .env の環境変数を読み込む！

const apiKey = process.env.GOOGLE_API_KEY; // 🔹 .env からAPIキー取得
const query = "ニュース";

async function fetchFactCheck() {
   const response = await fetch(`https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${query}&languageCode=ja&key=${apiKey}`);
   const data = await response.json();
   console.log(data);
}

fetchFactCheck();