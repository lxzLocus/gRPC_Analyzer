/*
txtからcsvのurlを抜き出す
*/
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const readline = require('readline');

// CSVファイルのパスを指定
const txtFilePath = '../../dataset/cloned_reps_issue/gRPC_reps_list.txt';
const csvFilePath = '../../dataset/P.U_merged_filtered - Final_merged_only_not_excluded_yes_ms_unarchived_commit_hash v2.0.csv';
// CSVヘッダー
const header = 'URL;Unnamed: 0;Identifier;_id;FileInfo;NumAuthors;MonNauth;NumActiveMon;EarliestCommitDate;EarliestCommitDateConverted;NumBlobs;LatestCommitDate;LastCommitDateConverted;ProjectID;MonNcmt;NumCore;NumCommits;CommunitySize;NumFiles;Core;NumForks;n_microservices;Tot. Duration (Y);Application Type;Application Purpose;Developed by;Archived;WIP/Incomplete;Is a Microservices?;num_services;servers;languages;num_langs;images;num_dbs;dbs;num_servers ;num_buses;buses;gates;monitors;num_discos;shared_dbs;num_dockers;dockers_raw;structure_raw;ms_depend_graph;avg_size_service;commit_hash';

// 保存先パス
const savePath = path.join(__dirname, 'dataset/cloned_reps_issue');
const outputPath = path.join(savePath, 'fullurl.txt');

// CSVデータを格納する配列
const csvData = [];

// CSVファイルをストリームで読み込み、データを格納
fs.createReadStream(csvFilePath)
    .pipe(csv({
        separator: ';',
        headers: header.split(';')
    }))
    .on('data', (row) => {
        csvData.push(row);
    })
    .on('end', () => {
        console.log('CSV file loading has been completed.');

        // テキストファイルを読み込むための設定
        const fileStream = fs.createReadStream(txtFilePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            // テキストファイルの各行を処理
            const repoName = line.trim();

            // CSVデータ内で一致する行を検索
            const matchingRow = csvData.find(row => {
                const url = row['URL'];
                const repo = url.split('/').pop().replace('.git', '');
                return repo === repoName;
            });

            if (matchingRow) {
                // console.log(`Found matching row for repoName: ${repoName}`);
                console.log(matchingRow.URL);
            } 
        });

        rl.on('close', () => {
            console.log('Text file processing has been completed.');
        });
    });

// エラーURLをログファイルに書き込む関数
const logError = (url) => {
    fs.appendFile(outputPath, `Error cloning repository: ${url}\n`, (err) => {
        if (err) {
            console.error(`Error writing to log file: ${err.message}`);
        }
    });
};
