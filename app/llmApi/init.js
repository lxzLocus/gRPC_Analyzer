/*


*/
const { exec } = require('child_process');

//reposiotries file path setting


//module import
//diff
//request
exec("git diff --no-index --name-only /app/dataset/clone/alibabacloud-microservice-demo/pullrequest/add_mse-go-demo/premerge_111 /app/dataset/clone/alibabacloud-microservice-demo/pullrequest/add_mse-go-demo/merge_111", (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`Stderr: ${stderr}`);
        return;
    }
});