/*
issue pull requestにてコメントのやり取りがされているかを確認するツール
*/

const axios = require('axios');
const fs = require('fs').promises;
require('dotenv').config();



const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const filePath = "dataset/get_issues_pr_from_title.json";



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

const processData = async () => {
    const allTitles = [];


    // ファイルを非同期的に読み込む
    fs.readFileSync(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        try {
            // 読み込んだデータをJSONとしてパース
            const jsonData = JSON.parse(data);

            // パースしたデータをコンソールに出力（デバッグ用）
            console.log('JSON Data:', jsonData);

            // jsonDataを使った処理をここに追加
            for (const entry of jsonData) {
                const { url, issue, pullrequest } = entry;

                // IssuesとPull Requestsを処理
                const issueTitles =  getIssuesAndPRs(url, 'issues', issue);
                const prTitles =  getIssuesAndPRs(url, 'pulls', pullrequest);

                allTitles.push(...issueTitles, ...prTitles);
            }

        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
        }
    });


    // タイトルの重複を削除
    const uniqueTitles = [...new Set(allTitles)];

    console.log('Titles with comments:', uniqueTitles);
};

processData();
