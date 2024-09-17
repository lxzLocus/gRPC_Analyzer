/*


*/
const { exec } = require('child_process');

//module import
const { compareProtoFiles } = require('./diff_proto.js');
const { requestOpenAI } = require('./request.js');


//reposiotries file path setting
const inputDir = '/app/dataset/clone/loop/pullrequest/update_api_for_loop_in';

//const protoFileContent = 'proto file content here';
const fileChangesContent = 'file changes content here';
const sourceCodeContent = 'source code content here';



//diff
(async () => {
    try {
        const results = await compareProtoFiles('/app/dataset/clone/loop/pullrequest/update_api_for_loop_in');
        console.log(results);
    } catch (error) {
        console.error(error.message);
    }
})();

let protoFileContent = compareProtoFiles(inputDir);


//request
requestOpenAI(protoFileContent, fileChangesContent, sourceCodeContent);