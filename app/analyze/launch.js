/*
extension代わりの呼び出しプログラム
*/
/*module import*/
const { initialize } = require('./init');


/*__MAIN__*/
const mergeStateFilePath = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci";

console.log(initialize(mergeStateFilePath));