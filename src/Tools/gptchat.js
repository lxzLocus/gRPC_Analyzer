const axios = require('axios');
const fs = require('fs');
const Handlebars = require('handlebars');
require('dotenv').config();

const OPENAI_TOKEN = process.env.OPENAI_TOKEN;

const prompt = "github apiのレートリミットはわかりますか？"

request();

async function request() {
    const endpoint = '/v1/chat/completions';
    const url = `https://api.openai.com${endpoint}`;

    const payload = {
        'model': 'gpt-4.1',
        'messages': [
            {
                "role": "system",
                "content": "Please answer the input"
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
