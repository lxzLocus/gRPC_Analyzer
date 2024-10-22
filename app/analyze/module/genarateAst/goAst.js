/*import module*/
const { exec } = require('child_process');
const path = require('path');

/*__MAIN__*/
if (require.main === module) {
    let sourcefilePath = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/doggos/main.go";
    generateGoAst(sourcefilePath)
        .then(temp => console.log(temp))
        .catch(err => console.error(err));
}

/*import module*/
function generateGoAst(filePath) {
    const goFileName = 'generateGoAst';
    const goFilePath = path.join(__dirname, goFileName);

    return new Promise((resolve, reject) => {
        exec(`${goFilePath} ${filePath}`, (err, stdout, stderr) => {
            if (err) {
                reject(`Error generating Go AST: ${err.message}`);
            } else {
                resolve(stdout);
            }
        });
    });
}

module.exports = { generateGoAst };
