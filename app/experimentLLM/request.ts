import axios from 'axios';
import fs from 'fs';
import Handlebars from 'handlebars';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_TOKEN = process.env.OPENAI_TOKEN;
const promptTextfile = './prompt.txt';


export async function requestOpenAI(protoFileContent: string, fileChangesContent: string, sourceCodeContent: string): Promise<string | number> {
    const endpoint = '/v1/chat/completions';
    const url = `https://api.openai.com${endpoint}`;

    let fileContent = fs.readFileSync(promptTextfile, 'utf-8');

    // コンテキストとして渡すデータ
    let context = {
        protoFile: protoFileContent,
        fileChanges: fileChangesContent,
        sourceCode: sourceCodeContent
    };

    // Handlebarsテンプレートをコンパイルしてプロンプト生成
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

        return response.data.choices[0].message.content;
    } catch (error: any) {
        console.error(error.response ? error.response.data : error.message);

        return 0;
    }
}

