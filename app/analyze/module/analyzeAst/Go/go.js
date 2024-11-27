/*import module*/
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/*__MAIN__*/
if (require.main === module) {
    let sourcefilePath = "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/plugin/pkg/client/auth/exec/exec.go";
    analyzeGoAst(sourcefilePath)
        .then(temp => console.log(temp))
        .catch(err => console.error(err));
}

/*import module*/
function analyzeGoAst(filePath) {
    const progGoFileName = 'analyzeGo';
    const protoGoFileName = 'analyzeProtoGo';

    const progGoFilePath = path.join(__dirname, "prog");
    const protoGoFilePath = path.join(__dirname, "proto");

    const progGoPath = path.join(progGoFilePath, progGoFileName);
    const protoGoPath = path.join(protoGoFilePath, protoGoFileName)


    const tempFilePath = path.join(progGoFilePath, "temp");


    return new Promise((resolve, reject) => {
        exec(`${progGoPath} ${filePath}`, { maxBuffer: 1024 * 1024 * 100 },
            (err, stdout, stderr) => {
                if (err) {
                    reject(`Error generating Imported Module: ${err.message}`);
                } else {
                    // 読み込むファイルの解析
                    fs.readFile(tempFilePath, 'utf8', (readErr, data) => {
                        if (readErr) {
                            reject(`Error reading temp file: ${readErr.message}`);
                        } else {
                            // 文字列を配列に変換し、スペースや改行で分割
                            const modulesArray = data.trim().slice(1, -1).split(/\s+/);

                            // ファイルを削除
                            fs.unlink(tempFilePath, (unlinkErr) => {
                                if (unlinkErr) {
                                    reject(`Error deleting temp file: ${unlinkErr.message}`);
                                } else {
                                    resolve(modulesArray);
                                }
                            });
                        }
                    });
                }
            }
        )
    });
}

module.exports = { analyzeGoAst };
