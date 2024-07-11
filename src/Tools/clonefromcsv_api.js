/*
Use GithubAPi

フィルタver
GitCloneするコード

保存先 : app/dataset/reps 

https://github.com/darioamorosodaragona-tuni/Microservices-Dataset

The filtered version is available here: 
https://figshare.com/articles/dataset/Microservices_Dataset_-_Filtered_version/24722232
*/

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { exec } = require('child_process');
const { Octokit } = require('@octokit/rest');

// CSVファイルのパスを指定
const csvFilePath = path.join(__dirname, '../../dataset/P.U_merged_filtered - Final_merged_only_not_excluded_yes_ms_unarchived_commit_hash v2.0.csv');
// CSVヘッダー
const header = 'URL;Unnamed: 0;Identifier;_id;FileInfo;NumAuthors;MonNauth;NumActiveMon;EarliestCommitDate;EarliestCommitDateConverted;NumBlobs;LatestCommitDate;LastCommitDateConverted;ProjectID;MonNcmt;NumCore;NumCommits;CommunitySize;NumFiles;Core;NumForks;n_microservices;Tot. Duration (Y);Application Type;Application Purpose;Developed by;Archived;WIP/Incomplete;Is a Microservices?;num_services;servers;languages;num_langs;images;num_dbs;dbs;num_servers ;num_buses;buses;gates;monitors;num_discos;shared_dbs;num_dockers;dockers_raw;structure_raw;ms_depend_graph;avg_size_service;commit_hash';

// 保存先パス
const savePath = path.join(__dirname, '../../dataset/reps');

const outputPath = path.join(savePath, 'log.txt');

// GitHubトークンを環境変数から取得
const githubToken = process.env.GITHUB_TOKEN;
// GitHubクライアントを作成
const octokit = new Octokit({ auth: githubToken });

// 1列目のデータを格納する配列
const firstColumnData = [];

// 遅延時間（ミリ秒）
const delay = 5000; // 5秒の遅延を導入

// CSVファイルをストリームで読み込み、1列目のデータを操作
fs.createReadStream(csvFilePath)
    .pipe(csv({ separator: ';' }))
    .on('data', (row) => {
        // 1列目のデータを配列に追加
        firstColumnData.push(row['URL']);
    })
    .on('end', async () => {
        console.log('CSV file loading has been completed.');

        for (const [index, url] of firstColumnData.entries()) {
            const parts = url.split('/');
            const owner = parts[3];
            const repo = parts[4].replace('.git', '');
            const repoSavePath = path.join(savePath, repo);

            console.log(`Cloning repository: ${url} into ${repoSavePath}`);

            // 遅延を導入
            await new Promise(resolve => setTimeout(resolve, index * delay));

            try {
                const { data } = await octokit.repos.get({ owner, repo });
                const cloneUrl = data.clone_url;

                // リポジトリをクローンする（gitコマンドを使用する部分は残す）
                exec(`git clone ${cloneUrl} ${repoSavePath}`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error cloning repository: ${error.message}`);
                        logError(url); // エラーログをファイルに書き込む
                        return;
                    }
                    if (stderr) {
                        console.error(`Error cloning repository: ${stderr}`);
                        logError(url); // エラーログをファイルに書き込む
                        return;
                    }
                    console.log(`Repository cloned successfully: ${stdout}`);
                });
            } catch (error) {
                console.error(`Error accessing repository: ${error.message}`);
                logError(url); // エラーログをファイルに書き込む
            }
        }
    });

// エラーURLをログファイルに書き込む関数
const logError = (url) => {
    fs.appendFile(outputPath, `Error cloning repository: ${url}\n`, (err) => {
        if (err) {
            console.error(`Error writing to log file: ${err.message}`);
        }
    });
};