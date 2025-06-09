/*
Docs

プロンプトに埋め込むための，txtファイルを出力するプログラム

対象
- 01_proto.txt
- 02_protoFileChanges.txt
- 03_fileChanges.txt
- 04_allFilePaths.txt

コードスメルは自分で作成する
- 05_suspectedFiles.txt


リストとその内容
- 01_proto.txt

Diff
- 02_protoFileChanges.txt

変更されたファイルのリストと，その内容（premerge）
- 03_fileChanges.txt

ファイルパスのリスト
- 04_allFilePaths.txt

*/

/*modules*/
import fs from 'fs';
import path from 'path';

import  getPullRequestPaths  from './module/getPullRequestPaths';
import  findFiles from './module/generateFilePathContent';
import  getFilesDiff from './module/generateContentDiff';
import  getChangedFiles from './module/generateFileChanged';
import  getPathTree from './module/generateDirPathLists';

/*config*/
const datasetDir: string = '/app/dataset/confirmed';

/* __MAIN__ */
if (require.main === module) {
    
    const projectDirs: string[] = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());

    projectDirs.forEach((projectName: string) => {
        const projectPath: string = path.join(datasetDir, projectName);
        const pullRequestDirs: string[] = fs.readdirSync(projectPath).filter(dir => fs.statSync(path.join(projectPath, dir)).isDirectory());

        pullRequestDirs.forEach((pullRequestTitle: string) => {
            const pullRequestPath: string = path.join(projectPath, pullRequestTitle);

            console.log(`Processing: ${projectName}/${pullRequestTitle}`);

            //"premerge_"と"merge_"で始まるサブディレクトリを取得
            const premergePath: string | undefined = fs.readdirSync(pullRequestPath)
                .map(dir => path.join(pullRequestPath, dir))  // フルパスに変換
                .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('premerge_'));

            const commitSnapshotPath: string | undefined = fs.readdirSync(pullRequestPath)
                .map(dir => path.join(pullRequestPath, dir))  // フルパスに変換
                .find(filePath => fs.statSync(filePath).isDirectory() && path.basename(filePath).startsWith('merge_'));

            // 01_proto
            const protoContentList: any[] = findFiles(premergePath, '.proto');
            const protoFilePath: string = path.join(pullRequestPath, '01_proto.txt');

            // 既存のファイルがあれば削除
            if (fs.existsSync(protoFilePath)) {
                fs.unlinkSync(protoFilePath);
            }
            fs.writeFileSync(protoFilePath, JSON.stringify(protoContentList, null, 2), 'utf8');

            // 02_protoFileChanges
            (async () => {
                const diffResults: any[] = await getFilesDiff(premergePath, commitSnapshotPath, 'proto');
                const protoFileChangesPath: string = path.join(pullRequestPath, '02_protoFileChanges.txt');
                if (diffResults.length > 0) {
                    // 既存のファイルがあれば削除
                    if (fs.existsSync(protoFileChangesPath)) {
                        fs.unlinkSync(protoFileChangesPath);
                    }
                    // 新しいファイルを作成
                    for (const result of diffResults) {
                        try {
                            fs.appendFileSync(protoFileChangesPath, result.diff + '\n', 'utf8');
                        } catch (error) {
                            console.error(`Error appending to file: ${protoFileChangesPath}`, error);
                        }
                    }
                } else {

                    // 既存のファイルがあれば削除
                    if (fs.existsSync(protoFileChangesPath)) {
                        fs.unlinkSync(protoFileChangesPath);
                    }
                    // 新しいファイルを作成
                    
                    try {
                        fs.appendFileSync(protoFileChangesPath, '', 'utf8'); // 空の文字列を渡す
                    } catch (error) {
                        console.error(`Error appending to file: ${protoFileChangesPath}`, error);
                    }
                    

                    console.log('No proto file changes detected, no file created.');
                }
            })();

            // 03_fileChanges
            (async () => {
                const changedFiles: string[] = await getChangedFiles(premergePath, commitSnapshotPath, '');
                console.log('Changed Files:', changedFiles); // デバッグ用
                const fileChangesPath: string = path.join(pullRequestPath, '03_fileChanges.txt');

                // 既存のファイルがあれば削除
                if (fs.existsSync(fileChangesPath)) {
                    fs.unlinkSync(fileChangesPath);
                }
                fs.writeFileSync(fileChangesPath, JSON.stringify(changedFiles, null, 2), 'utf8');
            })();

            // 04_allFilePaths
            const allFilePaths: any[] = getPathTree(premergePath);
            const allFilePathsPath: string = path.join(pullRequestPath, '04_allFilePaths.txt');

            // 既存のファイルがあれば削除
            if (fs.existsSync(allFilePathsPath)) {
                fs.unlinkSync(allFilePathsPath);
            }
            fs.writeFileSync(allFilePathsPath, JSON.stringify(allFilePaths, null, 2), 'utf8');


            // 05_suspectedFiles

            /*
            アイデア：
            - ファイル名に`test`を含まない /\btest\b/i , /_test\./i
            - ディレクトリの親に test, testsを含む
            - 変更箇所，変更コード行が多いもの　Hunks or added_lines + deleted_lines 上位何%とかで絞る
            - protoファイルとの関連性，静的解析なしのヒューリスティック
                - protoのファイル名と類似した名前を持つファイル
                - ファイル名，パスに  grpc, rpc, client, server, service, handler, stub, generated (ただし、これは .pb.goのような自動生成コードと区別が必要) 
                - protoファイルから近い距離
                - protoの変更内容からキーワード抜き出し
            -ドキュメント・設定ファイル等の除外
                - .md, .txt, .yaml, .json の除外
            まず、ファイル名に test を含むもの、ドキュメント/設定ファイルなどを除外。
                残ったファイルに対して、以下のスコアを計算:
                LoCC_score = (追加行数 + 削除行数)
                Hunk_score = (変更ブロック数)
                ProtoKeyword_score = (ファイル名やパスに .proto 関連キーワードがあれば加点)
                GeneratedFile_score = (自動生成ファイルであれば高い固定値を加点、または別枠で必ず含める)
                これらのスコアに重み付けをして合計スコアを算出: TotalScore = (LoCC_score * w1) + (Hunk_score * w2) + (ProtoKeyword_score * w3) + ...
                TotalScore の上位 N 件を「バグの疑わしいファイル」として選定する。
                N の値は固定値 (例: 5件) にするか、あるいはスコアの閾値を設けてそれを超えたものを全て選ぶ、といった方法が考えられます。
            */
        });
    });
}
