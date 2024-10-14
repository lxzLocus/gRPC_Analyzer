import { exec } from 'child_process';
import fs from 'fs';

function checkForProtoImport(astOutput: string, filePath: string) {
    if (astOutput.includes('proto') || astOutput.includes('grpc')) {
        console.log(`Found proto import in ${filePath}`);
    } else {
        console.log(`No proto import found in ${filePath}`);
    }
}

// 1. Python AST Generation
function generatePythonAst(filePath: string) {
    exec(`python3 -c "import ast; print(ast.dump(ast.parse(open('${filePath}').read(), filename='${filePath}')))"`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating Python AST: ${err.message}`);
            return;
        }
        checkForProtoImport(stdout, filePath);
    });
}

// 2. Go AST Generation
function generateGoAst(filePath: string) {
    exec(`gopls -json file=${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating Go AST: ${err.message}`);
            return;
        }
        checkForProtoImport(stdout, filePath);
    });
}

// 3. Java AST Generation
function generateJavaAst(filePath: string) {
    exec(`java -jar javaparser-cli.jar ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating Java AST: ${err.message}`);
            return;
        }
        checkForProtoImport(stdout, filePath);
    });
}

// 4. C# AST Generation
function generateCSharpAst(filePath: string) {
    exec(`dotnet-ast --path ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating C# AST: ${err.message}`);
            return;
        }
        checkForProtoImport(stdout, filePath);
    });
}

// 5. Scala AST Generation
function generateScalaAst(filePath: string) {
    exec(`scalac -Xprint:parser ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating Scala AST: ${err.message}`);
            return;
        }
        checkForProtoImport(stdout, filePath);
    });
}

// 6. TypeScript AST Generation
function generateTypeScriptAst(filePath: string) {
    exec(`tsc --ast ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating TypeScript AST: ${err.message}`);
            return;
        }
        checkForProtoImport(stdout, filePath);
    });
}

// 7. C++ AST Generation
function generateCppAst(filePath: string) {
    exec(`clang -Xclang -ast-dump -fsyntax-only ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating C++ AST: ${err.message}`);
            return;
        }
        checkForProtoImport(stdout, filePath);
    });
}

// 8. JavaScript AST Generation
function generateJavaScriptAst(filePath: string) {
    exec(`acorn ${filePath} --ecma2020 --output ${filePath}.ast.json`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating JavaScript AST: ${err.message}`);
            return;
        }
        const astOutput = fs.readFileSync(`${filePath}.ast.json`, 'utf-8');
        checkForProtoImport(astOutput, filePath);
    });
}

// 9. Rust AST Generation
function generateRustAst(filePath: string) {
    exec(`rust-analyzer analysis-stats ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating Rust AST: ${err.message}`);
            return;
        }
        checkForProtoImport(stdout, filePath);
    });
}

/*__MAIN__*/
if (require.main === module) {
    const filePath: string = "";
    const lang: string = ""; // Language flag

    switch (lang) {
        case 'python':
            generatePythonAst(filePath);
            break;
        case 'go':
            generateGoAst(filePath);
            break;
        case 'java':
            generateJavaAst(filePath);
            break;
        case 'csharp':
            generateCSharpAst(filePath);
            break;
        case 'scala':
            generateScalaAst(filePath);
            break;
        case 'typescript':
            generateTypeScriptAst(filePath);
            break;
        case 'cpp':
            generateCppAst(filePath);
            break;
        case 'javascript':
            generateJavaScriptAst(filePath);
            break;
        case 'rust':
            generateRustAst(filePath);
            break;
        default:
            console.log('Unsupported language');
            break;
    }
}
