#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const data = JSON.parse(fs.readFileSync('/app/output/detailed_analysis_report_260102_025839.json', 'utf-8'));
const skipped = data.correctnessLevels.skipped;

// プロジェクト別に分類して各プロジェクトから1件ずつサンプリング
const byProject = {};
skipped.forEach(item => {
  const project = item.datasetEntry.split('/')[0];
  if (!byProject[project]) {
    byProject[project] = [];
  }
  byProject[project].push(item);
});

// 各プロジェクトから1件ずつ取得
const sampled = [];
Object.entries(byProject).forEach(([project, items]) => {
  sampled.push(items[0]); // 各プロジェクトの最初の項目
});

console.log('==============================================');
console.log('スキップされたログファイルの分析結果');
console.log('（各プロジェクトから代表的な1件を分析）');
console.log('==============================================\n');

// サンプリングした項目を分析
for (let i = 0; i < sampled.length; i++) {
  const item = sampled[i];
  const parts = item.datasetEntry.split('/');
  const project = parts[0];
  const category = parts[1];
  const name = parts.slice(2).join('/');
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`【${i+1}件目】 ${item.datasetEntry}`);
  console.log(`${'='.repeat(80)}`);
  
  const logDir = path.join('/app/apr-logs', project, category, name);
  
  try {
    if (!fs.existsSync(logDir)) {
      console.log(`❌ ログディレクトリが存在しません: ${logDir}`);
      continue;
    }
    
    const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
    if (logFiles.length === 0) {
      console.log(`❌ ログファイルが見つかりません`);
      continue;
    }
    
    const latestLog = logFiles.sort().pop();
    const logPath = path.join(logDir, latestLog);
    
    const logContent = fs.readFileSync(logPath, 'utf-8');
    const logData = JSON.parse(logContent);
    
    console.log(`\n✅ ログ解析成功`);
    console.log(`Status: ${logData.experiment_metadata?.status}`);
    console.log(`Total turns: ${logData.experiment_metadata?.total_turns}`);
    
    if (logData.interaction_log) {
      const turns = Array.isArray(logData.interaction_log) ? 
                   logData.interaction_log : 
                   Object.values(logData.interaction_log);
      
      console.log(`Interaction log turns: ${turns.length}`);
      
      // 各ターンの modified_diff 状態を確認
      let modificationsFound = 0;
      let nullModifications = 0;
      
      turns.forEach((turn, idx) => {
        const parsed = turn.parsed_content || turn.llm_response?.parsed_content;
        if (parsed) {
          if (parsed.modified_diff === null) {
            nullModifications++;
          } else if (parsed.modified_diff && parsed.modified_diff.trim().length > 0) {
            modificationsFound++;
            console.log(`  Turn ${idx + 1}: ✓ modified_diff あり (${parsed.modified_diff.length} chars)`);
          }
        }
      });
      
      console.log(`\n📊 集計:`);
      console.log(`  - 修正あり: ${modificationsFound} ターン`);
      console.log(`  - modified_diff=null: ${nullModifications} ターン`);
      console.log(`  - 総ターン数: ${turns.length}`);
      
      if (modificationsFound === 0) {
        console.log(`\n❌ 結論: 全ターンで修正内容なし`);
        console.log(`   → extractFinalModifications() が修正を見つけられない原因`);
      } else {
        console.log(`\n✅ 結論: ${modificationsFound}ターンで修正あり`);
        console.log(`   → パーサーロジックに問題がある可能性`);
      }
    }
    
  } catch (error) {
    console.log(`❌ エラー: ${error.message}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('分析完了');
console.log('='.repeat(80));
