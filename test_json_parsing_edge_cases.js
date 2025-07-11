/**
 * JSON解析のエッジケースをテストする
 */

import MessageHandler from './dist/js/modules/messageHandler.js';

function testEdgeCase(name, testMessage) {
    console.log(`\n=== Testing: ${name} ===`);
    const handler = new MessageHandler();
    
    try {
        const result = handler.analyzeMessages(testMessage);
        console.log('✅ Parsing successful');
        console.log('Required files:', result.requiredFileInfos);
    } catch (error) {
        console.log('❌ Error occurred:', error.message);
        console.log('Stack:', error.stack);
    }
}

// Test cases for edge scenarios
const testCases = [
    {
        name: "Empty Required Section",
        message: `
%_Reply Required_%

%%_Fin_%%`
    },
    {
        name: "Incomplete JSON - Missing closing bracket",
        message: `
%_Reply Required_%
[
  {
    "type": "FILE_CONTENT",
    "path": "test.go"
  }

%%_Fin_%%`
    },
    {
        name: "Incomplete JSON - Missing opening bracket",
        message: `
%_Reply Required_%
  {
    "type": "FILE_CONTENT",
    "path": "test.go"
  }
]

%%_Fin_%%`
    },
    {
        name: "Malformed JSON - Missing quotes",
        message: `
%_Reply Required_%
[
  {
    type: FILE_CONTENT,
    path: test.go
  }
]

%%_Fin_%%`
    },
    {
        name: "Only whitespace in required section",
        message: `
%_Reply Required_%
   
   

%%_Fin_%%`
    },
    {
        name: "Mixed format - JSON and plain text",
        message: `
%_Reply Required_%
[
  {
    "type": "FILE_CONTENT",
    "path": "file1.go"
  }
]
"file2.go"
"file3.go"

%%_Fin_%%`
    },
    {
        name: "Truncated JSON",
        message: `
%_Reply Required_%
[
  {
    "type": "FILE_

%%_Fin_%%`
    }
];

console.log('🧪 Running JSON parsing edge case tests...');

testCases.forEach(testCase => {
    testEdgeCase(testCase.name, testCase.message);
});

console.log('\n🏁 All tests completed');
