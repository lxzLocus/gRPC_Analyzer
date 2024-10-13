import { exec } from 'child_process';

function generatePythonAst(filePath: string) {
    exec(`python3 -c "import ast; print(ast.dump(ast.parse(open('${filePath}').read(), filename='${filePath}')))"`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating Python AST: ${err.message}`);
            return;
        }
        console.log(`Python AST:\n${stdout}`);
    });
}

/*__MAIN__*/
if (require.main === module) {
    let sourcefilePath: string = "";
    generatePythonAst(sourcefilePath);
}