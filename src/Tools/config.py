from dotenv import load_dotenv
import os

# .envファイルのパスを指定する場合
load_dotenv('.env')

# 環境変数の取得
GITHUB_PERSONAL_ACCESS_TOKEN = os.getenv('GITHUB_PERSONAL_ACCESS_TOKEN')

