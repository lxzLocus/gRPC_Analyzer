const fs = require('fs');

const logPath = '/app/log/boulder/pullrequest/Remove_-useV2authorizations-_boolean_flags-/2026-01-28T18-14-15-009Z_log.log';
const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));

// Save each turn to a separate file
for (const turn of data.interaction_log) {
  const turnData = {
    turn: turn.turn,
    timestamp: turn.timestamp,
    llm_request: turn.llm_request,
    llm_response: turn.llm_response,
    system_action: turn.system_action
  };
  fs.writeFileSync(`/app/turn_${turn.turn}.json`, JSON.stringify(turnData, null, 2));
}

console.log('Done. Turns:', data.interaction_log.length);
