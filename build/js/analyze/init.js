"use strict";
/*
標準入力 + 関数呼び出し対応

*/
/*import module*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = initialize;
/*programs*/
if (require.main === module) {
    let mergeStateFilePath = process.argv.slice(2)[0];
    initialize(mergeStateFilePath);
}
/*main func*/
function initialize(mergeStateFilePath) {
    //関数呼び出し記述
    console.log(mergeStateFilePath);
    return "";
}
//# sourceMappingURL=init.js.map