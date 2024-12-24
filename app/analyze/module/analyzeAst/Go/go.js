
/*import module*/
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/*__MAIN__*/
if (require.main === module) {
    let sourcefilePath = "/app/dataset/clone/emojivote/pullrequest/01_pr/premerge_112/emojivoto-emoji-svc/api/api_test.go";
    let analysisType = "functions"; // "imports" または "functions" を指定
    analyzeGoAst(sourcefilePath, analysisType) 
        .then(temp => console.log(temp))
        .catch(err => console.error(err));
}

/*分析関数*/
/**
 * Analyzes a Go source file for either imports or functions.
 * 
 * @param {string} filePath - The path to the Go source file to analyze.
 * @param {string} analysisType - The type of analysis to perform. Either "imports" or "functions".
 * @returns {Promise<string[]>} A promise that resolves to an array of analysis results.
 * @throws Will throw an error if there is an issue generating the analysis or reading/deleting the output file.
 */
async function analyzeGoAst(filePath, analysisType) { 
    const progGoFileName = 'analyzeGo';
    const funcGoFileName = 'analyzeFuncGo'; 

    const progGoFilePath = path.join(__dirname, "prog", progGoFileName); 
    const funcGoFilePath = path.join(__dirname, "func", funcGoFileName); 

    const outputFileName = "temp.json";
    const outputDir = analysisType === "imports" ? "prog" : "func";
    const outputFilePath = path.join(__dirname, outputFileName); 

    const goExecFilePath = "/app/app/analyze/module/analyzeAst/Go/main";

    console.log(`${goExecFilePath} ${analysisType} ${filePath}`);

    return new Promise((resolve, reject) => {
        exec(`${goExecFilePath} ${analysisType} ${filePath}`, { maxBuffer: 1024 * 1024 * 100 }, 
            (err, stdout, stderr) => {
                if (err) {
                    reject(`Error generating analysis: ${err.message}`); 
                } else {
                    // 結果ファイルの読み込み 
                    fs.readFile(outputFilePath, 'utf8', (readErr, data) => { 
                        if (readErr) {
                            reject(`Error reading output file: ${readErr.message}`); 
                        } else {
                            
                            const resultObject = JSON.parse(data.trim());

                            // ファイルを削除
                            fs.unlink(outputFilePath, (unlinkErr) => { 
                                if (unlinkErr) {
                                    reject(`Error deleting output file: ${unlinkErr.message}`); 
                                } else {
                                    resolve(resultObject); 
                                }
                            });
                        }
                        
                    });
                }
            }
        ); 
    });
}

module.exports = { analyzeGoAst };
