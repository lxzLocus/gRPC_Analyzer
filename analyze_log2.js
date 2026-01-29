const fs = require('fs');

const logPath = '/app/log/boulder/pullrequest/Remove_-useV2authorizations-_boolean_flags-/2026-01-28T18-14-15-009Z_log.log';
const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));

const output = [];
const log = (...args) => output.push(args.join(' '));

log('=== EXPERIMENT METADATA ===');
log(JSON.stringify(data.experiment_metadata, null, 2));

log('\n=== INTERACTION LOG SUMMARY ===');
log('Total turns:', data.interaction_log.length);

for (const turn of data.interaction_log) {
  log('\n============================================');
  log('=== TURN', turn.turn, '===');
  log('============================================');
  log('Timestamp:', turn.timestamp);

  if (turn.llm_request) {
    log('\n--- LLM REQUEST ---');
    log('Template:', turn.llm_request.prompt_template);
    
    if (turn.llm_request.prompt_variables) {
      log('Prompt variables keys:', Object.keys(turn.llm_request.prompt_variables).join(', '));
      
      // Suspected Files
      if (turn.llm_request.prompt_variables.SUSPECTED_FILES) {
        log('\n--- SUSPECTED_FILES ---');
        log(turn.llm_request.prompt_variables.SUSPECTED_FILES);
      }
      
      // Files provided to LLM
      if (turn.llm_request.prompt_variables.FILES) {
        log('\n--- FILES (first 5000 chars) ---');
        log(turn.llm_request.prompt_variables.FILES.substring(0, 5000));
      }
    }
  }

  if (turn.llm_response) {
    log('\n--- LLM RESPONSE ---');
    if (typeof turn.llm_response === 'string') {
      log(turn.llm_response.substring(0, 8000));
    } else if (turn.llm_response.content) {
      log(turn.llm_response.content.substring(0, 8000));
    } else {
      log('Response keys:', Object.keys(turn.llm_response).join(', '));
      log(JSON.stringify(turn.llm_response, null, 2).substring(0, 8000));
    }
  }

  if (turn.parsed_action) {
    log('\n--- PARSED ACTION ---');
    log('Action type:', turn.parsed_action.type || turn.parsed_action.action);
    if (turn.parsed_action.files_to_read) {
      log('Files to read:', JSON.stringify(turn.parsed_action.files_to_read));
    }
    if (turn.parsed_action.diff) {
      log('Diff:', turn.parsed_action.diff);
    }
  }
}

// Check for final result
if (data.final_result) {
  log('\n============================================');
  log('=== FINAL RESULT ===');
  log('============================================');
  log(JSON.stringify(data.final_result, null, 2));
}

fs.writeFileSync('/app/analysis_output.txt', output.join('\n'));
console.log('Output written to /app/analysis_output.txt');
