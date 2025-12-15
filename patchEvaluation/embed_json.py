#!/usr/bin/env python3
"""
HTMLにJSONデータを埋め込むスクリプト
"""
import json
import sys

def embed_json_in_html(html_path, json_path, output_path):
    """HTMLファイルにJSONデータを埋め込む"""
    
    # HTMLファイルを読み込み
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # JSONファイルを読み込み
    with open(json_path, 'r', encoding='utf-8') as f:
        json_data = f.read()
    
    # fetch部分を埋め込みデータに置き換え
    # 1. 不要な変数宣言を削除
    html_content = html_content.replace(
        "const statistics_json_data = 'statistics_data_251118_200522.json';",
        ""
    )
    
    # 2. fetch処理を直接代入に変更
    old_fetch = """        // JSONデータを読み込み
        async function loadData() {
            try {
                const response = await fetch(statistics_json_data);
                allData = await response.json();"""
    
    new_direct = """        // JSONデータを読み込み（埋め込みデータを使用）
        async function loadData() {
            try {
                allData = EMBEDDED_JSON_DATA;"""
    
    html_content = html_content.replace(old_fetch, new_direct)
    
    # 3. JSONデータをscriptタグの最初に埋め込み
    script_start = "    <script>"
    embedded_script = f"""    <script>
        // Embedded JSON data
        const EMBEDDED_JSON_DATA = {json_data};
"""
    
    html_content = html_content.replace(script_start, embedded_script)
    
    # 出力ファイルに書き込み
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"✅ JSONを埋め込んだHTMLを生成しました: {output_path}")
    print(f"   元のHTMLサイズ: {len(html_content.encode('utf-8')) / 1024:.1f} KB")
    print(f"   JSONサイズ: {len(json_data.encode('utf-8')) / 1024:.1f} KB")
    
    # 生成されたファイルのサイズを確認
    import os
    output_size = os.path.getsize(output_path)
    print(f"   出力ファイルサイズ: {output_size / 1024:.1f} KB ({output_size / (1024*1024):.2f} MB)")

if __name__ == '__main__':
    html_path = '/app/output/apr_comparison_viewer.html'
    json_path = '/app/output/statistics_data_251118_200522.json'
    output_path = '/app/output/apr_comparison_viewer_embedded.html'
    
    embed_json_in_html(html_path, json_path, output_path)
