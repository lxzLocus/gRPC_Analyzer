const fs = require('fs');

const logFile = process.argv[2] || '/app/log/boulder/pullrequest/Remove_-useV2authorizations-_boolean_flags-/2026-01-28T20-41-51-839Z_log.log';

try {
    const data = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    const logs = data.interaction_log || [];
    const lastLog = logs[logs.length - 1];

    console.log('Log entry keys:', Object.keys(lastLog));

    if (lastLog.system_action) {
        console.log('\nsystem_action:', JSON.stringify(lastLog.system_action, null, 2));
    }

    if (lastLog.llm_response) {
        console.log('\nllm_response parsed_content:', JSON.stringify(lastLog.llm_response.parsed_content, null, 2));
    }
} catch (e) {
    console.error('Error:', e.message);
}
