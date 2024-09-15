const axios = require('axios');
const fs = require('fs');
const Handlebars = require('handlebars');
require('dotenv').config();

const OPENAI_TOKEN = process.env.OPENAI_TOKEN;

const promptTextfile = 'app/llmApi/prompt.txt';

const protoContent = '';
const sourceCodeContent = '';

request();

async function request() {
    const endpoint = '/v1/chat/completions';
    const url = `https://api.openai.com${endpoint}`;

    let fileContent = fs.readFileSync(promptTextfile);

    // 変数を定義する
    let context = {
        protoSource: protoContent,
        sourceCode: sourceCodeContent,
    };

    // Handlebarsテンプレートをコンパイルする
    let template = Handlebars.compile(fileContent);
    let prompt = template(context);


    const payload = {
        'model': 'gpt-4o', 
        'messages': [
            {
                "role": "system",
                "content": "Fix or improve issues in the program code related to gRPC, please refer to the proto file and make the code fixes."
            },
            {
                'role': 'user', 
                'content': `${prompt}`
            }
        ]
    };

    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_TOKEN}`
        }
    };

    try {
        const response = await axios.post(url, payload, config);
        console.log(response.data);
        console.log(response.data.choices[0].message.content); 
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
    }
}
