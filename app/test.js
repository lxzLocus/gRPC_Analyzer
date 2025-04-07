/*
4o
 128000 tokens. However, your messages resulted in 711011 tokens.
maximum length 1048576, but got a string with length 5000000 instead.

gpt-4.5-preview-2025-02-27
128000 tokens. However, your messages resulted in 711310 tokens
tokens per min (TPM): Limit 1000000, Requested 1250010.

*/


/*
modules
*/
const OpenAI = require('openai');
const dotenv = require('dotenv');


/*
configs
*/
dotenv.config();

const client = new OpenAI({
    apiKey: process.env.OPENAI_TOKEN,
});

// 文字数設定
const MESSAGE_LENGTH = 1048570; // 生成する文字列の長さ



if (require.main === module) {
    const message = generateLargeString(MESSAGE_LENGTH); // 大量の文字列を生成

    try {
        // OpenAIにリクエストを送る
        (async () => {
            const response = await requestOpenAI(message);

            // レスポンスをコンソールに出力
            if (response !== 0) {
                console.log(response);
            }
        })();
    } catch (error) {
        console.error(error);
    }
}


/**
 * 指定された文字数のランダムな文字列を生成します。
 * @param {number} length - 生成する文字列の長さ。
 * @returns {string} - 生成された文字列。
 */
function generateLargeString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

/**
 * 提供されたデータを使用してOpenAI APIにリクエストを送り、レスポンスを返します。
 * 
 * @param {string} message - OpenAIに送信するメッセージ。
 * @returns {Promise<string | number>} - レスポンスの内容またはエラーの場合は0。
 */
async function requestOpenAI(message) {

    try {
        const completion = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
            {
                    role: 'system',
                    content: "You are a helpful assistant."
            },
            {
                    role: 'user',
                    content: `${message}`
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