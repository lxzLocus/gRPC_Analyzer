import { exec } from 'child_process';

function generateScalaAst(filePath: string) {
  exec(`scalac -Xprint:parser ${filePath}`, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error generating Scala AST: ${err.message}`);
      return;
    }
    console.log(`Scala AST:\n${stdout}`);
  });
}
