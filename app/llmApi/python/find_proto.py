#protoファイルを探索するプログラム

import os

# .protoファイルを再帰的に探索し、その内容を文字列化して返す関数
def get_proto_file_contents_recursive(input_dir: str):
    proto_files_contents = []

    # input_dir 内で 'premerge' ディレクトリを探す
    dirs = os.listdir(input_dir)
    premerge_dir = next((d for d in dirs if d.startswith('premerge')), None)

    if not premerge_dir:
        raise FileNotFoundError("'premerge' ディレクトリが見つかりません")

    # premerge ディレクトリのフルパスを取得
    premerge_path = os.path.join(input_dir, premerge_dir)

    # .protoファイルを再帰的に探索
    for root, dirs, files in os.walk(premerge_path):
        if '.git' in dirs:
            dirs.remove('.git')  # .gitディレクトリを除外
        if 'node_modules' in dirs:
            dirs.remove('node_modules')  # node_modulesディレクトリを除外
        # .protoファイルのみ取得
        for file in files:
            if file.endswith('.proto'):
                file_path = os.path.join(root, file)
                try:
                    # ファイルの中身を読み込む
                    with open(file_path, 'r', encoding='utf-8') as f:
                        file_content = f.read()
                    # ファイルの相対パスと内容を保存
                    proto_files_contents.append({
                        'relativePath': os.path.relpath(file_path, premerge_path),
                        'content': file_content
                    })
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

    return proto_files_contents
# モジュールとして利用可能にする
if __name__ == "__main__":
    # テスト用の呼び出し
    input_directory = './path/to/your/premerge'  # premergeディレクトリを指定
    proto_files_contents = get_proto_file_contents_recursive(input_directory)
    print(proto_files_contents)
