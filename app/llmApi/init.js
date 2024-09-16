/*


*/
const { exec } = require('child_process');

//module import
const { compareProtoFiles } = require('./diff_proto.js');
const { requestOpenAI } = require('./request.js');


//reposiotries file path setting
const inputDir = '/app/dataset/clone/loop/pullrequest/update_api_for_loop_in';

const protoFileContent = 'proto file content here';
const fileChangesContent = 'file changes content here';
const sourceCodeContent = 'source code content here';



//diff
compareProtoFiles(inputDir);


//request
requestOpenAI(protoFileContent, fileChangesContent, sourceCodeContent);