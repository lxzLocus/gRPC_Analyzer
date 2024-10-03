#Open AI APIを利用したリクエスト

import os
import requests
from jinja2 import Template
from dotenv import load_dotenv

# .envファイルから環境変数をロード
load_dotenv()

OPENAI_TOKEN = os.getenv('OPENAI_TOKEN')
PROMPT_TEXT_FILE = '/app/app/llmApi/prompt.txt'

def request_openai(proto_file_content, file_changes_content, source_code_content):
    """
    OpenAI APIにリクエストを送信する

    :param proto_file_content: .protoファイルの内容
    :param file_changes_content: 変更ファイルの内容
    :param source_code_content: ソースコードの内容
    :return: OpenAI APIのレスポンス内容（成功した場合）または0（失敗した場合）
    """
    endpoint = '/v1/chat/completions'
    url = f'https://api.openai.com{endpoint}'

    try:
        # プロンプトテキストファイルの読み込み
        with open(PROMPT_TEXT_FILE, 'r', encoding='utf-8') as file:
            file_content = file.read()

        # Jinja2テンプレートのコンパイルとコンテキストの適用
        context = {
            'protoFile': proto_file_content,
            'fileChanges': file_changes_content[0]['diff'],
            'sourceCode': source_code_content
        }

        template = Template(file_content)
        prompt = template.render(context)

        payload = {
            'model': 'gpt-4',
            'messages': [
                {
                    'role': 'system',
                    'content': 'Fix or improve issues in the program code related to gRPC, please refer to the proto file and make the code fixes.'
                },
                {
                    'role': 'user',
                    'content': prompt
                }
            ]
        }

        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {OPENAI_TOKEN}'
        }

        # OpenAI APIへPOSTリクエストを送信
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()

        # APIレスポンスを取得して出力
        data = response.json()
        print(data)
        print(data['choices'][0]['message']['content'])

        return data['choices'][0]['message']['content']

    except requests.exceptions.RequestException as e:
        print(f"Error during the request: {e}")
        return 0

    except Exception as e:
        print(f"Unexpected error: {e}")
        return 0


# モジュールとしてエクスポートできるようにする
if __name__ == '__main__':
    # テスト用に関数を呼び出し
    proto_content = "syntax = 'proto3';"
    file_changes = "some file changes"
    source_code = "def some_function(): pass"

    result = request_openai(proto_content, file_changes, source_code)
    print("OpenAI Response:", result)
