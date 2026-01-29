const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/app/patchEvaluation/output/detailed_analysis_report_260129_041537.json', 'utf8'));
const pairs = data.matched_pairs || [];

console.log('=== 全体統計 ===');
console.log('総ケース数:', pairs.length);

const categories = {};
pairs.forEach(p => {
  const cat = p.finalCategory || 'N/A';
  categories[cat] = (categories[cat] || 0) + 1;
});

console.log('\n--- finalCategory分布 ---');
Object.entries(categories)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, cnt]) => {
    const pct = (cnt / pairs.length * 100).toFixed(1);
    console.log(cat + ': ' + cnt + ' (' + pct + '%)');
  });

const incorrect = pairs.filter(p => p.finalCategory === 'INCORRECT');
console.log('\n=== INCORRECTケースの詳細分析 ===');
console.log('INCORRECTケース数:', incorrect.length);

const accuracyLabels = {}, soundnessLabels = {}, consistencyLabels = {}, validityLabels = {};

incorrect.forEach(p => {
  const fe = p.fourAxisEvaluation || {};
  const acc = (fe.accuracy || {}).label || 'N/A';
  const snd = (fe.decision_soundness || {}).label || 'N/A';
  const con = (fe.directional_consistency || {}).label || 'N/A';
  const val = (fe.validity || {}).label || 'N/A';
  accuracyLabels[acc] = (accuracyLabels[acc] || 0) + 1;
  soundnessLabels[snd] = (soundnessLabels[snd] || 0) + 1;
  consistencyLabels[con] = (consistencyLabels[con] || 0) + 1;
  validityLabels[val] = (validityLabels[val] || 0) + 1;
});

console.log('\n--- Accuracy Label分布 ---');
Object.entries(accuracyLabels).sort((a,b) => b[1] - a[1]).forEach(([lbl, cnt]) => {
  const pct = (cnt / incorrect.length * 100).toFixed(1);
  console.log(lbl + ': ' + cnt + ' (' + pct + '%)');
});

console.log('\n--- Decision Soundness Label分布 ---');
Object.entries(soundnessLabels).sort((a,b) => b[1] - a[1]).forEach(([lbl, cnt]) => {
  const pct = (cnt / incorrect.length * 100).toFixed(1);
  console.log(lbl + ': ' + cnt + ' (' + pct + '%)');
});

console.log('\n--- Directional Consistency Label分布 ---');
Object.entries(consistencyLabels).sort((a,b) => b[1] - a[1]).forEach(([lbl, cnt]) => {
  const pct = (cnt / incorrect.length * 100).toFixed(1);
  console.log(lbl + ': ' + cnt + ' (' + pct + '%)');
});

console.log('\n--- Validity Label分布 ---');
Object.entries(validityLabels).sort((a,b) => b[1] - a[1]).forEach(([lbl, cnt]) => {
  const pct = (cnt / incorrect.length * 100).toFixed(1);
  console.log(lbl + ': ' + cnt + ' (' + pct + '%)');
});

// PLAUSIBLEケースの分析
const plausible = pairs.filter(p => p.finalCategory === 'PLAUSIBLE');
console.log('\n=== PLAUSIBLEケースの詳細分析 ===');
console.log('PLAUSIBLEケース数:', plausible.length);

// SKIPPEDケースの分析
const skipped = pairs.filter(p => p.finalCategory === 'SKIPPED' || p.status === 'SKIPPED');
console.log('\n=== SKIPPEDケースの分析 ===');
console.log('SKIPPEDケース数:', skipped.length);

const skipReasons = {};
skipped.forEach(p => {
  const reason = p.skipSource || p.errorSource || 'UNKNOWN';
  skipReasons[reason] = (skipReasons[reason] || 0) + 1;
});

console.log('\n--- SKIP理由分布 ---');
Object.entries(skipReasons).sort((a,b) => b[1] - a[1]).forEach(([reason, cnt]) => {
  console.log(reason + ': ' + cnt);
});

// INCORRECTケースのパターン組み合わせ分析
console.log('\n=== INCORRECTケースのパターン組み合わせ ===');
const patterns = {};
incorrect.forEach(p => {
  const fe = p.fourAxisEvaluation || {};
  const acc = (fe.accuracy || {}).label || 'N/A';
  const snd = (fe.decision_soundness || {}).label || 'N/A';
  const con = (fe.directional_consistency || {}).label || 'N/A';
  const val = (fe.validity || {}).label || 'N/A';
  const key = `Acc:${acc} | Snd:${snd} | Con:${con} | Val:${val}`;
  patterns[key] = (patterns[key] || 0) + 1;
});

console.log('\n上位パターン:');
Object.entries(patterns).sort((a,b) => b[1] - a[1]).slice(0, 15).forEach(([pattern, cnt]) => {
  const pct = (cnt / incorrect.length * 100).toFixed(1);
  console.log(`  ${pattern}: ${cnt} (${pct}%)`);
});

// 代表例の出力
console.log('\n=== 代表例 ===');

// NO_MATCH + UNSOUND + CONSISTENT + VALID パターン
const noMatchUnsoundConsistent = incorrect.filter(p => {
  const fe = p.fourAxisEvaluation || {};
  return (fe.accuracy || {}).label === 'NO_MATCH' &&
         (fe.decision_soundness || {}).label === 'UNSOUND' &&
         (fe.directional_consistency || {}).label === 'CONSISTENT';
}).slice(0, 3);

console.log('\n--- パターン: NO_MATCH + UNSOUND + CONSISTENT ---');
noMatchUnsoundConsistent.forEach(p => {
  console.log('\nデータセット:', p.datasetEntry);
  console.log('理由:', (p.fourAxisEvaluation.accuracy || {}).reasoning?.slice(0, 200) + '...');
});

// NO_MATCH + UNSOUND + CONTRADICTORY パターン
const noMatchContradictory = incorrect.filter(p => {
  const fe = p.fourAxisEvaluation || {};
  return (fe.accuracy || {}).label === 'NO_MATCH' &&
         (fe.directional_consistency || {}).label === 'CONTRADICTORY';
}).slice(0, 3);

console.log('\n--- パターン: NO_MATCH + CONTRADICTORY ---');
noMatchContradictory.forEach(p => {
  console.log('\nデータセット:', p.datasetEntry);
  console.log('理由:', (p.fourAxisEvaluation.directional_consistency || {}).reasoning?.slice(0, 200) + '...');
});

// INVALID パターン
const invalidCases = incorrect.filter(p => {
  const fe = p.fourAxisEvaluation || {};
  return (fe.validity || {}).label === 'INVALID';
}).slice(0, 3);

console.log('\n--- パターン: INVALID ---');
invalidCases.forEach(p => {
  console.log('\nデータセット:', p.datasetEntry);
  console.log('理由:', (p.fourAxisEvaluation.validity || {}).reasoning?.slice(0, 200) + '...');
});

// 改善可能性が高いケース (CONSISTENT + VALID だが NO_MATCH)
const improvable = incorrect.filter(p => {
  const fe = p.fourAxisEvaluation || {};
  return (fe.accuracy || {}).label === 'NO_MATCH' &&
         (fe.directional_consistency || {}).label === 'CONSISTENT' &&
         (fe.validity || {}).label === 'VALID';
});

console.log('\n=== 改善可能性が高いケース (CONSISTENT + VALID だが NO_MATCH) ===');
console.log('該当数:', improvable.length);
improvable.slice(0, 5).forEach(p => {
  console.log('\nデータセット:', p.datasetEntry);
  console.log('Accuracy理由:', (p.fourAxisEvaluation.accuracy || {}).reasoning?.slice(0, 150) + '...');
});
