import fs from 'fs';
import path from 'path';

const datasetDir = '/app/dataset/filtered_fewChanged';
const projectDirs = fs.readdirSync(datasetDir).filter(dir => fs.statSync(path.join(datasetDir, dir)).isDirectory());

const emptyFileChanges = [];
let totalCount = 0;

for (const projectName of projectDirs) {
    const projectPath = path.join(datasetDir, projectName);
    const categoryDirs = fs.readdirSync(projectPath).filter(dir => fs.statSync(path.join(projectPath, dir)).isDirectory());
    
    for (const category of categoryDirs) {
        const categoryPath = path.join(projectPath, category);
        const titleDirs = fs.readdirSync(categoryPath).filter(dir => fs.statSync(path.join(categoryPath, dir)).isDirectory());
        
        for (const pullRequestTitle of titleDirs) {
            totalCount++;
            const fileChangesPath = path.join(categoryPath, pullRequestTitle, '03_fileChanges.txt');
            
            if (fs.existsSync(fileChangesPath)) {
                const content = fs.readFileSync(fileChangesPath, 'utf8').trim();
                if (content === '[]') {
                    emptyFileChanges.push(`${projectName}/${category}/${pullRequestTitle}`);
                }
            }
        }
    }
}

console.log('総テストケース数:', totalCount);
console.log('03_fileChanges.txt が [] のケース数:', emptyFileChanges.length);
console.log('');
if (emptyFileChanges.length > 0) {
    console.log('=== 空配列のケース ===');
    emptyFileChanges.forEach((c, i) => console.log(`${i+1}. ${c}`));
}

// JSON出力
const outputPath = '/app/output/empty_filechanges_check.json';
fs.writeFileSync(outputPath, JSON.stringify({
    summary: {
        total: totalCount,
        emptyCount: emptyFileChanges.length,
        percentage: ((emptyFileChanges.length / totalCount) * 100).toFixed(1) + '%'
    },
    emptyCases: emptyFileChanges
}, null, 2));
console.log(`\n結果を保存しました: ${outputPath}`);
