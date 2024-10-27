/*import module*/
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/*__MAIN__*/
if (require.main === module) {
    // let mergeStateFilePath = process.argv.slice(2)[0];
    let protoPathList = '';
    let programFileList = [''];

    main(Ast, protoPathList);
}

/*functions*/
function main(Ast, protoFile){

}


module.exports = { main };