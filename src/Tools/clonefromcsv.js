/*
フィルタver
GitCloneするコード

https://github.com/darioamorosodaragona-tuni/Microservices-Dataset

The filtered version is available here: 
https://figshare.com/articles/dataset/Microservices_Dataset_-_Filtered_version/24722232
*/

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { exec } = require('child_process');

// CSVファイルのパスを指定
const csvFilePath = path.join(__dirname, '../../dataset/P.U_merged_filtered - Final_merged_only_not_excluded_yes_ms_unarchived_commit_hash v2.0.csv');
// CSVヘッダー
const header = 'URL;Unnamed: 0;Identifier;_id;FileInfo;NumAuthors;MonNauth;NumActiveMon;EarliestCommitDate;EarliestCommitDateConverted;NumBlobs;LatestCommitDate;LastCommitDateConverted;ProjectID;MonNcmt;NumCore;NumCommits;CommunitySize;NumFiles;Core;NumForks;n_microservices;Tot. Duration (Y);Application Type;Application Purpose;Developed by;Archived;WIP/Incomplete;Is a Microservices?;num_services;servers;languages;num_langs;images;num_dbs;dbs;num_servers ;num_buses;buses;gates;monitors;num_discos;shared_dbs;num_dockers;dockers_raw;structure_raw;ms_depend_graph;avg_size_service;commit_hash';


// 保存先パス
const savePath = path.join(__dirname,'../../dataset');


// 1列目のデータを格納する配列
const firstColumnData = [];

// CSVファイルをストリームで読み込み、1列目のデータを操作
fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => {
        // 1列目のデータを配列に追加
        firstColumnData.push(row[header]);
    })
    .on('end', () => {
        console.log('CSV file loading has been completed.');
        
        firstColumnData.forEach((data) => {
            const parts = data.split(';');
            const url = parts[0];

            // リポジトリ名をURLから取得
            const repoName = url.split('/').pop().replace('.git', '');
            const repoSavePath = path.join(savePath, repoName);

            console.log(`Cloning repository: ${url} into ${repoSavePath}`);

            // git clone コマンドを実行
            /*
            exec(`git clone ${url} ${repoSavePath}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error cloning repository: ${error.message}`);
                    return;
                }
                if (stderr) {
                    console.error(`Error cloning repository: ${stderr}`);
                    return;
                }
                console.log(`Repository cloned successfully: ${stdout}`);
            });
            */
            exec(`git -v`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`${error.message}`);
                    return;
                }
                if (stderr) {
                    console.error(`${stderr}`);
                    return;
                }
                console.log(`${stdout}`);
            });
        });

    });
