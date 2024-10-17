import { exec } from 'child_process';

function generateCSharpAst(filePath: string) {
    exec(`dotnet tool install -g dotnet-ast && dotnet-ast ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating C# AST: ${err.message}`);
            return;
        }
        console.log(`C# AST:\n${stdout}`);
    });
}

/*__MAIN__*/
if (require.main === module) {
    let sourcefilePath: string = "";
    generateCSharpAst(sourcefilePath);
}
