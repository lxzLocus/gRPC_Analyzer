/*
Docs

バグが疑わしいファイルは渡すが，差分は渡さない
ファイル参照が必要な場合は返信させる

*/


/*
modules
*/
const OpenAI = require('openai');
const fs = require('fs');
const Handlebars = require('handlebars');
const dotenv = require('dotenv');
const path = require('path');

/*
configs
*/
dotenv.config();

const OPENAI_TOKEN = process.env.OPENAI_TOKEN;
const promptDir = '/app/app/experimentLLM_nonTreeWithdiff/prompt';
const promptTextfile = '00_prompt.txt';

const outputDir = '/app/app/experimentLLM_nonTreeWithdiff/output';

const client = new OpenAI({
    apiKey: OPENAI_TOKEN,
});


if (require.main === module) {
    (async () => {

    const protoFileContent = fs.readFileSync(path.join(promptDir, '01_proto.txt'), 'utf-8');
    const protoFileChanges = fs.readFileSync(path.join(promptDir, '02_protoFileChanges.txt'), 'utf-8');
    const fileChangesContent = fs.readFileSync(path.join(promptDir, '03_fileChanges.txt'), 'utf-8');
    const allFilePaths = fs.readFileSync(path.join(promptDir, '04_allFilePaths.txt'), 'utf-8');
    const suspectedFiles = fs.readFileSync(path.join(promptDir, '05_suspectedFiles.txt'), 'utf-8');

    try {
        // OpenAIにリクエストを送る
            const response = await requestOpenAI(protoFileContent, protoFileChanges, fileChangesContent, allFilePaths, suspectedFiles);

        // レスポンスをファイルに書き出す
        if (response !== 0) {
            // レスポンス内に"%_Reply Required_%"の文字列が含まれるかをチェック
            if (response.includes('%_Reply Required_%')) {
                console.log('レスポンスに"%_Reply Required_%"が含まれています');
            } else {
                console.log('レスポンスに"%_Reply Required_%"は含まれていません');
            }

            // 出力ディレクトリに新しいファイル名を生成して保存
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const tmpOutputPath = path.join('/app/tmp', `response_${timestamp}.txt`);
            fs.writeFileSync(tmpOutputPath, response);
            console.log(`レスポンスが/tmpに保存されました: ${tmpOutputPath}`);

            //fs.writeFileSync(path.join(outputDir, 'response.txt'), response);
            //console.log('修正されたコードがtxtに保存されました');
        }
    } catch (error) {
        console.error('OpenAIリクエスト中のエラー:', error);
    }
    })();
}


/**
 * 提供されたデータを使用してOpenAI APIにリクエストを送り、レスポンスを返します。
 * 
 * @param {string} protoFileContent - プロトファイルの内容。
 * @param {string} protoFileChanges - プロトファイル変更の内容。
 * @param {string} fileChangesContent - 変更されたファイルの内容。
 * @param {string} allFilePaths - ファイルパスのリスト。
 * @param {string} suspectedFiles - 疑わしいファイルのリスト。
 * @returns {Promise<string | number>} - レスポンスの内容またはエラーの場合は0。
 */
async function requestOpenAI(protoFileContent, protoFileChanges, fileChangesContent, allFilePaths, suspectedFiles) {
    let fileContent = fs.readFileSync(path.join(promptDir, promptTextfile), 'utf-8');

    // コンテキストとして渡すデータ
    let context = {
        protoFile: protoFileContent,
        protoFileChanges: protoFileChanges,
        fileChanges: fileChangesContent,
        allFilePaths: allFilePaths,
        suspectedFiles: suspectedFiles
    };

    // Handlebarsテンプレートをコンパイルしてプロンプト生成
    let template = Handlebars.compile(fileContent);
    let prompt = template(context);

    try {
        const completion = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
            {
                    role: 'system',
                    content: "Fix or improve program code related to gRPC. It may contain potential bugs. Refer to the proto to make code corrections."
            },
            {
                    role: 'user',
                    content: `${prompt}`
            }
            ],
        });

        console.log(completion.choices[0].message.content);
        return completion.choices[0].message.content;
    } catch (error) {
        console.error(error.message);
        return 0;
    }
}
