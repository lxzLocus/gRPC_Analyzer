/*
Protoファイルから package名 + option go_package取得
*/
/*import module*/
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');
const { parse } = require("protobufjs");





/*__MAIN__*/
if (require.main === module) {
    const protoPath = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/ptypes/any/any.proto";

    main(protoPath);
}

/*functions*/
function main(protoFilePath){
    const source = fs.readFileSync(protoFilePath, "utf-8");
    const ast = parse(source, root);

    console.log(ast);
}