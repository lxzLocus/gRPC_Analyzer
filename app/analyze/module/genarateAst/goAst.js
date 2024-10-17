/*import module*/
const { exec } = require('child_process');
const path = require('path');

/*__MAIN__*/
if (require.main === module) {
    let sourcefilePath = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/doggos/main.go";
    generateGoAst(sourcefilePath);
}

/*import module*/
function generateGoAst(filePath) {
    const goFileName = 'generateGoAst';
    const goFilePath = path.join(__dirname, goFileName)

    exec(`${goFilePath} ${filePath} `, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating Go AST: ${err.message}`);
            return;
        }
        console.log(`Go AST:\n${stdout}`);
        return stdout;
    });
}

module.exports = { generateGoAst };