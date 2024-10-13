import { exec } from 'child_process';

function generateTypeScriptAst(filePath: string) {
    exec(`npx ts-morph ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating TypeScript AST: ${err.message}`);
            return;
        }
        console.log(`TypeScript AST:\n${stdout}`);
    });
}
