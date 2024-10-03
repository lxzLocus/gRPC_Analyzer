/*
issue pull requestにてコメントのやり取りがされているかを確認するツール
*/
const axios = require('axios');
const fs = require('fs').promises;
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const filePath = "dataset/get_issues_pr_from_title.json";

// タイトルから単語を抽出し、リストにする
const extractWords = (title) => {
    // 小文字に変換し、単語をスペースで分割
    return title.toLowerCase().split(/\s+/);
};

// タイトルの単語をカウントする
const countWords = (titles) => {
    const wordCount = new Map();
    titles.forEach(title => {
        const words = extractWords(title);
        words.forEach(word => {
            if (word) {
                wordCount.set(word, (wordCount.get(word) || 0) + 1);
            }
        });
    });
    return wordCount;
};

// 特定の単語が複数のタイトルに一致するかをチェック
const findCommonTitles = (titles) => {
    const wordCount = countWords(titles);
    const commonWords = Array.from(wordCount.entries())
        .filter(([_, count]) => count > 1) // 複数タイトルに出現する単語
        .map(([word]) => word);

    return titles.filter(title => {
        const words = extractWords(title);
        return words.some(word => commonWords.includes(word));
    });
};

const getIssuesAndPRs = async (url, type, ids) => {
    const results = [];
    for (const id of ids) {
        try {
            const response = await axios.get(`${url}/${type}/${id}`, {
                headers: { Authorization: `token ${GITHUB_TOKEN}` }
            });
            const data = response.data;

            // コメント数をチェック
            const hasComments = data.comments > 0 || (data.pull_request && data.pull_request.comments > 0);

            if (hasComments) {
                // タイトルを取得し、変換
                let title = data.title;
                title = title.replace(/_/g, ' ').replace(/-/g, ' '); // _ を空白に、- を特殊文字に変換
                results.push(title);
            }
        } catch (error) {
            console.error(`Error fetching ${type} ${id}:`, error.message);
        }
    }
    return results;
};

// メインの処理関数
const processData = async () => {
    try {
        // ファイルを非同期的に読み込む
        const data = await fs.readFile(filePath, 'utf8');
        const jsonData = JSON.parse(data);

        // パースしたデータをコンソールに出力（デバッグ用）
        console.log('JSON Data:', jsonData);

        const allTitles = [];

        for (const entry of jsonData) {
            const { url, issue, pullrequest } = entry;

            // IssuesとPull Requestsを処理
            const issueTitles = await getIssuesAndPRs(url, 'issues', issue);
            const prTitles = await getIssuesAndPRs(url, 'pulls', pullrequest);

            allTitles.push(...issueTitles, ...prTitles);
        }

        // タイトルの重複を削除
        const uniqueTitles = [...new Set(allTitles)];

        console.log('All Titles with comments:', uniqueTitles);

        // 複数タイトルに一致するタイトルを検出
        const commonTitles = findCommonTitles(uniqueTitles);

        console.log('Common Titles:', commonTitles);

    } catch (error) {
        console.error('Error processing data:', error.message);
    }
};

processData();
