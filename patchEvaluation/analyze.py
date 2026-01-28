import json

with open('/app/output/detailed_analysis_report_260128_134135.json', 'r') as f:
    data = json.load(f)

print('📊 レポート統計分析')
print('=' * 60)
print(f'📦 総マッチングペア数: {len(data["matched_pairs"])}件')

intent_stats = {'total': 0, 'INTENT_FULFILLED': 0, 'INTENT_PARTIALLY_FULFILLED': 0, 
                'INTENT_ACKNOWLEDGED_BUT_NOT_FULFILLED': 0, 'INTENT_NOT_FULFILLED': 0}
fouraxis_count = 0

for i, pair in enumerate(data['matched_pairs']):
    # Intent統計
    if ('intentFulfillmentEvaluation' in pair and pair['intentFulfillmentEvaluation'] and 
        'data' in pair['intentFulfillmentEvaluation']):
        intent_data = pair['intentFulfillmentEvaluation']['data']
        if 'label' in intent_data:
            intent_stats['total'] += 1
            label = intent_data['label']
            if label in intent_stats:
                intent_stats[label] += 1
    
    # 4軸評価統計
    if 'fourAxisEvaluation' in pair and pair['fourAxisEvaluation'] is not None:
        fouraxis_count += 1
        
    # 最初の5件をデバッグ表示
    if i < 5:
        print(f'\n📝 エントリ {i+1}: {pair.get("pullRequestName", "Unknown")}')
        print(f'   - APRステータス: {pair.get("aprStatus", "Unknown")}')
        intent_label = 'なし'
        if ('intentFulfillmentEvaluation' in pair and pair['intentFulfillmentEvaluation'] and 
            'data' in pair['intentFulfillmentEvaluation']):
            intent_label = pair['intentFulfillmentEvaluation']['data'].get('label', 'なし')
        print(f'   - Intent評価: {intent_label}')
        fouraxis_status = 'あり' if pair.get('fourAxisEvaluation') is not None else 'なし'
        print(f'   - 4軸評価: {fouraxis_status}')

print('\n📊 Intent Fulfillment統計（LLM_C）:')
print(f'   評価実行数: {intent_stats["total"]}件')
for key, value in intent_stats.items():
    if key != 'total':
        print(f'   - {key}: {value}件')

print('\n📊 4軸評価統計（LLM_B）:')
print(f'   評価実行数: {fouraxis_count}件')