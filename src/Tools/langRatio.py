import os
from collections import defaultdict
import matplotlib.pyplot as plt

# 対応する拡張子を定義する
LANGUAGE_EXTENSIONS = {
    'Python': ['.py'],
    'JavaScript': ['.js'],
    'TypeScript': ['.ts'],
    'HTML': ['.html', '.htm'],
    'CSS': ['.css'],
    'Java': ['.java'],
    'C': ['.c'],
    'C++': ['.cpp', '.cc', '.cxx'],
    'C#': ['.cs'],
    'Ruby': ['.rb'],
    'PHP': ['.php'],
    'Go': ['.go'],
    'Swift': ['.swift'],
    'Kotlin': ['.kt'],
    'R': ['.r'],
    'Shell': ['.sh'],
    'Perl': ['.pl', '.pm'],
    'Rust': ['.rs'],
    'Scala': ['.scala'],
    'Haskell': ['.hs']
}

def get_language_from_extension(extension):
    for language, extensions in LANGUAGE_EXTENSIONS.items():
        if extension in extensions:
            return language
    return None

def scan_directory(directory):
    language_count = defaultdict(int)
    total_files = 0

    for root, dirs, files in os.walk(directory):
        for file in files:
            file_extension = os.path.splitext(file)[1]
            language = get_language_from_extension(file_extension)
            if language:
                language_count[language] += 1
                total_files += 1

    return language_count, total_files

def calculate_language_percentage(language_count, total_files):
    language_percentage = {language: (count / total_files) * 100 for language, count in language_count.items()}
    return language_percentage

if __name__ == "__main__":
    directory = 'dataset/gRPC'  
    language_count, total_files = scan_directory(directory)
    if total_files == 0:
        print("指定されたディレクトリにはファイルが見つかりませんでした。")
    else:
        language_percentage = calculate_language_percentage(language_count, total_files)
        
        print(f"総ファイル数: {total_files}")
        print("各言語のファイル数:")
        for language, count in language_count.items():
            print(f"{language}: {count} files")
        
        print("\nプログラミング言語の割合:")
        for language, percentage in language_percentage.items():
            print(f"{language}: {percentage:.2f}%")
        
