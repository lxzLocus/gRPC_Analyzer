#探索後のproto fileのフォーマット処理

def format_proto_content(proto_content):
    # 結果を格納するリスト
    formatted_content = []
    
    # proto_contentリストの各要素に対して処理を実行
    for i, proto in enumerate(proto_content):
        # relativePath を最初の行に追加
        formatted_content.append(proto['relativePath'])
        
        # content をその後の行に追加
        formatted_content.append(proto['content'])
        
        # 複数の proto_content の場合は一行空白を追加（最後の要素には追加しない）
        if i < len(proto_content) - 1:
            formatted_content.append("")  # 空白行
    
    # リストの要素を改行で結合して、1つの文字列にする
    return "\n".join(formatted_content)

if __name__ == '__main__':

    proto_content = [
        {'relativePath': 'path/to/file1.proto', 'content': 'syntax = "proto3";\nmessage Example1 {}'},
        {'relativePath': 'path/to/file2.proto', 'content': 'syntax = "proto3";\nmessage Example2 {}'}
    ]

    result = format_proto_content(proto_content)
    
    print(result)