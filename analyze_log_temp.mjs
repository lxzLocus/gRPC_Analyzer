import fs from 'fs';

const logPath = '/app/log/boulder/pullrequest/Remove_-useV2authorizations-_boolean_flags-/2026-01-28T20-41-51-839Z_log.log';
const content = fs.readFileSync(logPath, 'utf8');

const output = [];
output.push('=== File Info ===');
output.push('Size: ' + content.length + ' bytes');
output.push('Lines: ' + content.split('\n').length);

output.push('\n=== Key Fields ===');
output.push('Has llm_response: ' + content.includes('llm_response'));
output.push('Has parsed_content: ' + content.includes('parsed_content'));
output.push('Has modified_diff: ' + content.includes('modified_diff'));
output.push('Has %_Modified_%: ' + content.includes('%_Modified_%'));
output.push('Has raw_content: ' + content.includes('raw_content'));

try {
  const data = JSON.parse(content);
  output.push('\n=== Parsed JSON ===');
  output.push('Status: ' + data.experiment_metadata?.status);
  output.push('Total turns: ' + data.experiment_metadata?.total_turns);
  
  if (data.interaction_log && data.interaction_log.length > 0) {
    for (let i = 0; i < data.interaction_log.length; i++) {
      const turn = data.interaction_log[i];
      output.push(`\n=== Turn ${i + 1} ===`);
      
      if (turn.llm_response) {
        output.push('Has llm_response object: true');
        output.push('raw_content length: ' + (turn.llm_response.raw_content?.length || 0));
        output.push('raw_content first 500 chars: ' + (turn.llm_response.raw_content?.substring(0, 500) || 'N/A'));
        
        if (turn.llm_response.raw_content && turn.llm_response.raw_content.includes('%_Modified_%')) {
          output.push('\n>>> Found %_Modified_% in raw_content <<<');
          const modIdx = turn.llm_response.raw_content.indexOf('%_Modified_%');
          output.push('Context around %_Modified_%:');
          output.push(turn.llm_response.raw_content.substring(modIdx, modIdx + 500));
        }
        
        if (turn.llm_response.parsed_content) {
          output.push('\n=== parsed_content ===');
          output.push('Keys: ' + JSON.stringify(Object.keys(turn.llm_response.parsed_content)));
          output.push('modified_diff value: ' + JSON.stringify(turn.llm_response.parsed_content.modified_diff));
          output.push('modified_diff type: ' + typeof turn.llm_response.parsed_content.modified_diff);
          output.push('modified_diff length: ' + turn.llm_response.parsed_content.modified_diff?.length);
        }
      }
      
      if (turn.error) {
        output.push('\n=== Error ===');
        output.push(JSON.stringify(turn.error, null, 2));
      }
    }
  }
} catch (e) {
  output.push('\n=== Parse Error ===');
  output.push(e.message);
  output.push('Content preview: ' + content.substring(0, 1000));
}

fs.writeFileSync('/app/log_analysis_result.txt', output.join('\n'));
console.log('Results written to /app/log_analysis_result.txt');
