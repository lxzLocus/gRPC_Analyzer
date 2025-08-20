import { fs } from "fs";
import { path } from "path";


if (import.meta.url === `file://${process.argv[1]}`) {
    const datasetPath = "/app/dataset/filtered_fewChanged";
    const aprOutputPath = "/app/apr-logs";


}

async function patchEvaluationController(datasetPath, aprOutputPath) {
    const evaluationControllerPath = path.join(datasetPath, "evaluationController.js");
    const evaluationControllerContent = await fs.promises.readFile(evaluationControllerPath, "utf-8");

    const patchedContent = evaluationControllerContent.replace(
        /const aprOutputPath = '.*';/,
        `const aprOutputPath = '${aprOutputPath}';`
    );

    await fs.promises.writeFile(evaluationControllerPath, patchedContent, "utf-8");
}  