import { exec } from 'child_process';

function generateJavaScriptAst(filePath: string) {
    exec(`npx acorn ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating JavaScript AST: ${err.message}`);
            return;
        }
        console.log(`JavaScript AST:\n${stdout}`);
    });
}
