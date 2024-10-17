/*import module*/
const { exec } = require('child_process');

/*__MAIN__*/
if (require.main === module) {
    let sourcefilePath = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/doggos/main.go";
    generateGoAst(sourcefilePath);
}

/*import module*/
function generateGoAst(filePath) {
    let output;
    exec(`gopls check ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating Go AST: ${err.message}`);
            return;
        }
        console.log(`Go AST:\n${stdout}`);
        output = stdout;
    });
}

module.exports = { generateGoAst };