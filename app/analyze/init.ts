/*
標準入力 + 関数呼び出し対応

*/
/*import module*/



/*programs*/
if (require.main === module) {
    let mergeStateFilePath: String = process.argv.slice(2)[0];
    initialize(mergeStateFilePath);
}

/*main func*/
export default function initialize(mergeStateFilePath: String): String {


    //関数呼び出し記述

    console.log(mergeStateFilePath);

    return "";
}
