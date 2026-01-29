const fs = require('fs');
const path = require('path');

const logPath = '/app/log/boulder/pullrequest/Remove_-useV2authorizations-_boolean_flags-/2026-01-28T18-14-15-009Z_log.log';
const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));

const output = [];
const log = (...args) => output.push(args.join(' '));

log('=== EXPERIMENT METADATA ===');
log(JSON.stringify(data.experiment_metadata, null, 2));

console.log('\n=== INTERACTION LOG SUMMARY ===');
console.log('Total turns:', data.interaction_log.length);

for (const turn of data.interaction_log) {
  console.log('\n============================================');
  console.log('=== TURN', turn.turn, '===');
  console.log('============================================');
  console.log('Timestamp:', turn.timestamp);

  if (turn.llm_request) {
    console.log('\n--- LLM REQUEST ---');
    console.log('Template:', turn.llm_request.prompt_template);
    
    if (turn.llm_request.prompt_variables) {
      console.log('Prompt variables keys:', Object.keys(turn.llm_request.prompt_variables));
      
      // Suspected Files
      if (turn.llm_request.prompt_variables.SUSPECTED_FILES) {
        console.log('\n--- SUSPECTED_FILES ---');
        console.log(turn.llm_request.prompt_variables.SUSPECTED_FILES);
      }
      
      // Files provided to LLM
      if (turn.llm_request.prompt_variables.FILES) {
        console.log('\n--- FILES (first 3000 chars) ---');
        console.log(turn.llm_request.prompt_variables.FILES.substring(0, 3000));
      }
    }
  }

  if (turn.llm_response) {
    console.log('\n--- LLM RESPONSE ---');
    if (typeof turn.llm_response === 'string') {
      console.log(turn.llm_response.substring(0, 5000));
    } else if (turn.llm_response.content) {
      console.log(turn.llm_response.content.substring(0, 5000));
    } else {
      console.log('Response keys:', Object.keys(turn.llm_response));
      console.log(JSON.stringify(turn.llm_response, null, 2).substring(0, 5000));
    }
  }

  if (turn.parsed_action) {
    console.log('\n--- PARSED ACTION ---');
    console.log('Action type:', turn.parsed_action.type || turn.parsed_action.action);
    if (turn.parsed_action.files_to_read) {
      console.log('Files to read:', turn.parsed_action.files_to_read);
    }
    if (turn.parsed_action.diff) {
      console.log('Diff (first 3000 chars):', turn.parsed_action.diff.substring(0, 3000));
    }
  }
}

// Check for final result
if (data.final_result) {
  console.log('\n============================================');
  console.log('=== FINAL RESULT ===');
  console.log('============================================');
  console.log(JSON.stringify(data.final_result, null, 2));
}
