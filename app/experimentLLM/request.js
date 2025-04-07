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
const promptDir = '/app/app/experimentLLM/prompt';
const promptTextfile = 'prompt.txt';
const outputDir = '/app/app/experimentLLM/output';

const client = new OpenAI({
    apiKey: OPENAI_TOKEN,
});


if (require.main === module) {
    const tmp = path.join(promptDir, 'proto.txt');
    console.log(tmp);

    const protoFileContent = fs.readFileSync(path.join(promptDir, 'proto.txt'), 'utf-8');
    const dependencyTree = fs.readFileSync(path.join(promptDir, 'dependencyTree.txt'), 'utf-8');
    const protoFileChanges = fs.readFileSync(path.join(promptDir, 'protoFileChanges.txt'), 'utf-8');
    const fileChangesContent = fs.readFileSync(path.join(promptDir, 'fileChanges.txt'), 'utf-8');
    const sourceCodeContent = fs.readFileSync(path.join(promptDir, 'sourceCode.txt'), 'utf-8');

    try {
        // OpenAIにリクエストを送る
        const response = await requestOpenAI(protoFileContent, fileChangesContent, sourceCodeContent, dependencyTree, protoFileChanges);

        // レスポンスをファイルに書き出す
        if (response !== 0) {
            fs.writeFileSync(path.join(outputDir, 'response.txt'), response);
            console.log('修正されたコードがtxtに保存されました');
        }
    } catch (error) {
        console.error('OpenAIリクエスト中のエラー:', error);
    }
}


/**
 * 提供されたデータを使用してOpenAI APIにリクエストを送り、レスポンスを返します。
 * 
 * @param {string} protoFileContent - プロトファイルの内容。
 * @param {string} fileChangesContent - ファイル変更の内容。
 * @param {string} sourceCodeContent - ソースコードの内容。
 * @param {string} dependencyTree - 依存ツリー。
 * @param {string} protoFileChanges - プロトファイルの変更。
 * @returns {Promise<string | number>} - レスポンスの内容またはエラーの場合は0。
 */
async function requestOpenAI(protoFileContent, fileChangesContent, sourceCodeContent, dependencyTree, protoFileChanges) {
    let fileContent = fs.readFileSync(path.join(promptDir, promptTextfile), 'utf-8');

    // コンテキストとして渡すデータ
    let context = {
        protoFile: protoFileContent,
        fileChanges: fileChangesContent,
        sourceCode: sourceCodeContent,
        dependencyTree: dependencyTree,
        protoFileChanges: protoFileChanges,
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