import { exec } from 'child_process';

function generateJavaAst(filePath: string) {
    exec(`java -jar javaparser-core.jar ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating Java AST: ${err.message}`);
            return;
        }
        console.log(`Java AST:\n${stdout}`);
    });
}
