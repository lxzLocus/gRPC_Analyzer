# proto fileを使っているプログラムを探索する
import os
import subprocess
from typing import List


importStrings = [
    'import "google.golang.org/grpc"', 'using Grpc.Core;', 'import io.grpc.',
    'import * as grpc from', 'import grpc', '#include <grpc/grpc.h>',
    'const grpc = require(', 
    # 'syntax = "proto3"',
    'import { grpc } from \'@grpc/grpc-js\';', 'import grpc from \'grpc\';'
]

# ドキュメントファイルの拡張子リスト
DOCUMENT_EXTENSIONS = {'.md', '.txt', '.rst', '.docx', '.pdf'}

def get_proto_files_recursive(directory: str) -> List[str]:
    results = []
    for root, dirs, files in os.walk(directory):
        if '.git' in dirs:
            dirs.remove('.git')
        for file in files:
            if file.endswith('.proto'):
                results.append(os.path.join(root, file))
    return results


def format_diff(diff_string: str) -> str:
    formatted_diff = diff_string.replace('\\n', '\n')
    return formatted_diff


def diff_files(file1: str, file2: str) -> dict:
    try:
        result = subprocess.run(
            ['diff', file1, file2], capture_output=True, text=True, encoding='utf-8'
        )
        if result.returncode == 1:
            diff_output = result.stdout.strip()
            formatted_diff_output = format_diff(diff_output)
            return {
                'relativePath': os.path.relpath(file1, os.path.dirname(file1)),
                'diff': formatted_diff_output
            }
        elif result.returncode == 0:
            return None
        else:
            raise Exception(f"Error comparing {file1} and {file2}: {result.stderr}")
    except Exception as e:
        raise Exception(f"Error running diff: {e}")

def is_document_file(file_name: str) -> bool:
    return any(file_name.lower().endswith(ext) for ext in DOCUMENT_EXTENSIONS)

def find_programs_using_proto(proto_files: List[str], premerge_dir: str) -> str:
    programs_output = []

    for proto_file in proto_files:
        proto_name = os.path.basename(proto_file)
        for root, dirs, files in os.walk(premerge_dir):
            if '.git' in dirs:
                dirs.remove('.git')
            for file in files:
                if is_document_file(file):
                    continue
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        file_content = f.read()
                        if any(import_string in file_content for import_string in importStrings):
                            programs_output.append(f"File: {file_path}\n{file_content}")
                            break
                except UnicodeDecodeError:
                    try:
                        with open(file_path, 'r', encoding='latin-1') as f:
                            content = f.read()
                            if any(import_string in content for import_string in importStrings):
                                programs_output.append(f"File: {file_path}\n{content}")
                    except UnicodeDecodeError:
                        print(f"Cannot decode file {file_path}, skipping.")

    return '\n\n'.join(programs_output)


def find_usingproto(input_dir: str):
    try:
        if not os.path.exists(input_dir):
            raise FileNotFoundError(f"Input directory {input_dir} does not exist")

        dirs = os.listdir(input_dir)
        premerge_dir = next((d for d in dirs if d.startswith('premerge')), None)
        merge_dir = next((d for d in dirs if d.startswith('merge')), None)

        if not premerge_dir or not merge_dir:
            raise FileNotFoundError("premerge または merge ディレクトリが見つかりません")

        premerge_path = os.path.join(input_dir, premerge_dir)
        merge_path = os.path.join(input_dir, merge_dir)

        premerge_proto_files = get_proto_files_recursive(premerge_path)
        print('Premerge Proto Files:', premerge_proto_files)

        diff_results = []

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

        modified_proto_files = [res['relativePath'] for res in diff_results]
        if modified_proto_files:
            programs_using_proto_output = find_programs_using_proto(modified_proto_files, premerge_path)
            print("Programs using modified proto files:\n", programs_using_proto_output)
            
            return programs_using_proto_output
        else:
            print("No modified proto files found.")

    except Exception as e:
        print(f"Error: {e}")
        raise e


if __name__ == "__main__":
    input_directory = '/app/dataset/clone/loop/pullrequest/update_api_for_loop_in'
    result = find_usingproto(input_directory)
    print(result)
