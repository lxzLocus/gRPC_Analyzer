#!/usr/bin/env python3
"""
raw_clonedからpremerge→merge差分コミットを使った分析結果の集計
"""
import json
import sys

def main():
    filepath = '/app/output/bug_fix_with_merge_results.json'
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON: {e}", file=sys.stderr)
        return 1
    
    total_prs = len(data)
    print(f"📊 raw_clonedからpremerge→merge差分コミット分析結果")
    print(f"=" * 60)
    print(f"総PR数: {total_prs}")
    print()
    
    # プロジェクト別カウント
    projects = {}
    for pr in data:
        proj = pr['projectName']
        projects[proj] = projects.get(proj, 0) + 1
    
    print("プロジェクト別PR数:")
    for proj, count in sorted(projects.items(), key=lambda x: -x[1]):
        print(f"  {proj:20s}: {count:2d}")
    print()
    
    # コミット数の統計
    commit_counts = []
    for pr in data:
        commit_counts.append(len(pr['commits']))
    
    print(f"コミット数の統計:")
    print(f"  平均: {sum(commit_counts)/len(commit_counts):.2f}")
    print(f"  最小: {min(commit_counts)}")
    print(f"  最大: {max(commit_counts)}")
    
    # 1コミットのみのPR数
    single_commit_prs = sum(1 for c in commit_counts if c == 1)
    print(f"  1コミットのみ: {single_commit_prs}/{total_prs} ({single_commit_prs/total_prs*100:.1f}%)")
    print()
    
    # バグ修正カウント
    bug_fixes = sum(1 for pr in data if pr['hasBugFixSignals'])
    print(f"✅ バグ修正PR: {bug_fixes}/{total_prs} ({bug_fixes/total_prs*100:.1f}%)")
    print()
    
    # 分類別カウント
    categories = {}
    for pr in data:
        cat = pr['classification']['category']
        categories[cat] = categories.get(cat, 0) + 1
    
    print("分類別:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  {cat:15s}: {count:2d} ({count/total_prs*100:.1f}%)")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
