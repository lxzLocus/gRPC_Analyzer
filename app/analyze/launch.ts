/*
extension代わりの呼び出しプログラム
*/
/*module import*/
import initialize from './init';


/*__MAIN__*/
let mergeStateFilePath: string = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci";

console.log(initialize(mergeStateFilePath));