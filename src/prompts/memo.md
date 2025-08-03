# Memo

## prompt 

渡すもの
protofile 内容も含め
変更された proto file diff 差分
変更されたファイルリストとその内容（修正前）
プロジェクト内のファイルパスリスト
疑わしいファイル　ファイルパスと内容

修正前データセットのみ渡すようにした
protoの変更のみ，差分と与える
変更されたファイルのヒントは与えるが，修正後の状態との差分は渡さない
疑わしいファイルは渡す


## tokenizer

https://platform.openai.com/tokenizer

## Models

gpt-4.1

max length : 1048576 charactors
max tokens : 128000 tokens

## Tokens

00_prompt : 383 tokens, 1,797 charactors

01_proto : 19,636 tokens, 67,725 charactors

02_protoFileChanges: 209 tokens, 656 charactors

03_FileChanges: 55,010 tokens, 126,315 charactors (pbの自動生成ファイルは除いている)

%%%03_filechange : 17,328 tokens, 52,403 charactors

04_allFilePaths: 198,858 tokens, 711,100 charactors

%%%04_fix paths : 39,029 tokens, 158,034 charactors


05_suspectedFiles: 6,267 tokens, 22,115 charactors

----

total : 280,363 tokens, 929,708 charactors

150,822 tokens