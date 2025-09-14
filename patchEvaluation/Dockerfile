FROM node:24-alpine3.21

WORKDIR /app

# パッケージファイルのみを先にコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# 必要なソースファイルとスクリプトをコピー
COPY . .

RUN apk update && apk add --no-cache git
