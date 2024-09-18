#proto fileを使っているプログラムを探索する

import os
import subprocess
from pathlib import Path
from typing import List

# .protoファイルを再帰的に探索する関数
def get_proto_files_recursive(directory: str) -> List[str]:
    results = []
    # .gitディレクトリを除外して再帰的に検索
    for root, dirs, files in os.walk(directory):
        if '.git' in dirs:
            dirs.remove('.git')
        # .protoファイルのみ取得
        for file in files:
            if file.endswith('.proto'):
                results.append(os.path.join(root, file))
    return results

# diff の出力を整形する関数
def format_diff(diff_string: str) -> str:
    # '\\n' を改行コード '\n' に置換
    formatted_diff = diff_string.replace('\\n', '\n')
    return formatted_diff

# premerge と merge ディレクトリ内で同名の .proto ファイルを diff
def diff_files(file1: str, file2: str) -> dict:
    try:
        print(f"Running diff between: {file1} and {file2}")
        result = subprocess.run(
            ['diff', file1, file2], capture_output=True, text=True, encoding='utf-8'
        )
        if result.returncode == 1:  # 差分がある場合
            # 改行コードを整形して差分結果を出力
            diff_output = result.stdout.strip()  # 先頭・末尾の改行を削除
            formatted_diff_output = format_diff(diff_output)  # 整形

            return {
                'relativePath': os.path.relpath(file1, os.path.dirname(file1)),
                'diff': formatted_diff_output
            }
        elif result.returncode == 0:  # 差分なし
            return None
        else:
            raise Exception(f"Error comparing {file1} and {file2}: {result.stderr}")
    except Exception as e:
        raise Exception(f"Error running diff: {e}")

# .protoファイルを利用しているプログラムを探す関数
def find_programs_using_proto(proto_files: List[str], project_dir: str) -> List[str]:
    programs = []
    for proto_file in proto_files:
        proto_name = os.path.basename(proto_file)
        # プロジェクトディレクトリ内でprotoファイル名が使われているファイルを検索
        for root, dirs, files in os.walk(project_dir):
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    # utf-8 での読み込みを試みる
                    with open(file_path, 'r', encoding='utf-8') as f:
                        if proto_name in f.read():
                            programs.append(file_path)
                except UnicodeDecodeError:
                    # エンコーディングエラー発生時に 'latin-1' など別のエンコーディングを試す
                    try:
                        with open(file_path, 'r', encoding='latin-1') as f:
                            if proto_name in f.read():
                                programs.append(file_path)
                    except UnicodeDecodeError:
                        # エンコーディングが分からない場合はエラーメッセージを出力してスキップ
                        print(f"Cannot decode file {file_path}, skipping.")
    return programs

# メインの比較関数
def find_usingproto(input_dir: str):
    try:
        # input_dir の存在チェック
        if not os.path.exists(input_dir):
            raise FileNotFoundError(f"Input directory {input_dir} does not exist")

        # premerge と merge ディレクトリの検出
        dirs = os.listdir(input_dir)
        premerge_dir = next((d for d in dirs if d.startswith('premerge')), None)
        merge_dir = next((d for d in dirs if d.startswith('merge')), None)

        if not premerge_dir or not merge_dir:
            raise FileNotFoundError("premerge または merge ディレクトリが見つかりません")

        # フルパスの生成
        premerge_path = os.path.join(input_dir, premerge_dir)
        merge_path = os.path.join(input_dir, merge_dir)

        # premergeディレクトリから.protoファイルリストを取得
        premerge_proto_files = get_proto_files_recursive(premerge_path)
        print('Premerge Proto Files:', premerge_proto_files)

        diff_results = []

        # premerge と merge ディレクトリ内で同名の .proto ファイルを diff
        for file1 in premerge_proto_files:
            relative_path = os.path.relpath(file1, premerge_path)
            file2 = os.path.join(merge_path, relative_path)

            if os.path.exists(file2):
                try:
                    diff_result = diff_files(file1, file2)
                    if diff_result:
                        diff_results.append(diff_result)
                except Exception as e:
                    print(f"Error comparing files: {e}")
            else:
                print(f"No corresponding file for {file1} in merge directory")

        # 変更されたprotoファイルを利用しているプログラムを探す
        modified_proto_files = [res['relativePath'] for res in diff_results]
        if modified_proto_files:
            programs_using_proto = find_programs_using_proto(modified_proto_files, input_dir)
            print("Programs using modified proto files:", programs_using_proto)
        else:
            print("No modified proto files found.")

        print('Diff Results:', diff_results)
        return diff_results

    except Exception as e:
        print(f"Error: {e}")
        raise e

# モジュールとして利用可能にする
if __name__ == "__main__":
    # テスト用の呼び出し
    input_directory = '/app/dataset/clone/loop/pullrequest/update_api_for_loop_in'
    result = find_usingproto(input_directory)
    print(result)