import { exec } from 'child_process';

function generateRustAst(filePath: string) {
    exec(`rust-analyzer ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating Rust AST: ${err.message}`);
            return;
        }
        console.log(`Rust AST:\n${stdout}`);
    });
}

/*__MAIN__*/
if (require.main === module) {
    let sourcefilePath: string = "";
    generateRustAst(sourcefilePath);
}