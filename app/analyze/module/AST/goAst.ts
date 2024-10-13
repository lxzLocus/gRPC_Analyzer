import { exec } from 'child_process';

function generateGoAst(filePath: string) {
    exec(`gopls check ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating Go AST: ${err.message}`);
            return;
        }
        console.log(`Go AST:\n${stdout}`);
    });
}

/*__MAIN__*/
if (require.main === module) {
    let sourcefilePath: string = "";
    generateGoAst(sourcefilePath);
}