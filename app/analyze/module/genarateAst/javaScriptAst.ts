import { exec } from 'child_process';
import esprima from 'esprima';
import fs from 'fs';

function generateJavaScriptAst(filePath: string) {

    function loadSrcFile(filename) {
        const src = fs.readFileSync(filename, 'utf-8');
        return src;
    }

    function parseSrc(src) {
        const tokens = esprima.tokenize(src);
        const ast = esprima.parseScript(src);
        attachTokensToAST(ast, tokens);

        return ast;
    }

    function attachTokensToAST(ast, tokens) {
        let tokenIndex = 0;

        function walk(node) {
            if (Array.isArray(node)) {
                node.forEach(walk);
            } else if (node && typeof node == 'object') {
                for (const key in node) {
                    if (node.hasOwnProperty(key)) {
                        const child = node[key];
                        if (child && typeof child == 'object') {
                            if (child.type == 'Identifier' || child.type == 'Literal') {
                                const token = tokens[tokenIndex++];
                                child.start = token.start;
                                child.end = token.end;
                            }
                            walk(child);
                        }
                    }
                }
            }
        }

        walk(ast);
    }

    console.log('Loading src file: %s\n', filePath);

    try {
        const src = loadSrcFile(filePath);
        const ast = parseSrc(src);

        console.log(`JavaScript AST:\n${ast}`);

        return ast;

    } catch (err) {
        console.error(`Error generating JavaScript AST: ${err.message}`);
        return;
    }
}

function generateJavaScriptAstAcorn(filePath: string) {
    exec(`npx acorn ${filePath}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`Error generating JavaScript AST: ${err.message}`);
            return;
        }
        console.log(`JavaScript AST:\n${stdout}`);
    });
}


/*__MAIN__*/
if (require.main === module) {
    let sourcefilePath: string = "";
    generateJavaScriptAst(sourcefilePath);
}
