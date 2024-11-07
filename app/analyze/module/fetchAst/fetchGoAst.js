/*import module*/
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');

/*__MAIN__*/
if (require.main === module) {
    let ast = [''];

    fetchGoAst(ast);
}

/*functions*/
function fetchGoAst(ast){
    const goFileName = 'goAstFetcher';
    const goFilePath = path.join(__dirname, goFileName);

    return new Promise((resolve, reject) => {
           exec(`${goFilePath} "${ast}"`, { maxBuffer: 1024 * 1024 * 100 },
            (err, stdout, stderr) => {
                if (err) {
                    reject(`Error generating Go AST: ${err.message}`);
                } else {
                    resolve(stdout);
                }
            });
    });
}


module.exports = { fetchGoAst };