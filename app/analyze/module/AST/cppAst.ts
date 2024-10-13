import { exec } from 'child_process';

function generateCppAst(filePath: string) {
    exec(`clang -Xclang -ast-dump -fsyntax-only ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating C++ AST: ${err.message}`);
            return;
        }
        console.log(`C++ AST:\n${stdout}`);
    });
}
