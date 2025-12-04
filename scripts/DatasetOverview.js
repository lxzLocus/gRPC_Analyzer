/**
 * データセット全体の概要を表示するスクリプト
 * 
 * 使用方法:
 *   node scripts/DatasetOverview.js [dataset-path]
 * 
 * 例:
 *   node scripts/DatasetOverview.js
 *   node scripts/DatasetOverview.js /app/dataset/filtered_fewChanged
 */

import fs from 'fs';
import path from 'path';

// コマンドライン引数からデータセットパスを取得（オプションフラグを除外）
const args = process.argv.slice(2);
const pathArg = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-') && arg !== args[args.indexOf('--project') + 1]);
const DATASET_DIR = pathArg || '/app/dataset/filtered_fewChanged';

/**
 * ディレクトリ一覧の取得（アルファベット順）
 */
function getDirectories(dirPath) {
    try {
        return fs.readdirSync(dirPath)
            .filter(item => fs.statSync(path.join(dirPath, item)).isDirectory())
            .sort();
    } catch (error) {
        return [];
    }
}

/**
 * データセット構造を解析
 */
function analyzeDataset() {
    console.log('📊 Dataset Analysis');
    console.log('=' .repeat(80));
    console.log(`📂 Dataset: ${DATASET_DIR}\n`);

    const projects = getDirectories(DATASET_DIR);
    let totalPRs = 0;
    let projectDetails = [];

    projects.forEach((project, projectIndex) => {
        const projectPath = path.join(DATASET_DIR, project);
        const categories = getDirectories(projectPath);
        
        let projectPRCount = 0;
        let categoryDetails = [];

        categories.forEach(category => {
            const categoryPath = path.join(projectPath, category);
            const prs = getDirectories(categoryPath);
            projectPRCount += prs.length;
            
            categoryDetails.push({
                name: category,
                prCount: prs.length,
                prs: prs
            });
        });

        totalPRs += projectPRCount;
        projectDetails.push({
            index: projectIndex + 1,
            name: project,
            categoryCount: categories.length,
            prCount: projectPRCount,
            categories: categoryDetails
        });
    });

    // サマリー表示
    console.log('📈 Summary');
    console.log('-'.repeat(80));
    console.log(`Total Projects:        ${projects.length}`);
    console.log(`Total Pull Requests:   ${totalPRs}`);
    console.log(`Average PRs/Project:   ${(totalPRs / projects.length).toFixed(1)}`);
    console.log('');

    // プロジェクト別詳細
    console.log('📁 Projects (in processing order)');
    console.log('-'.repeat(80));
    
    let cumulativePRs = 0;
    projectDetails.forEach(project => {
        cumulativePRs += project.prCount;
        const progressBar = '█'.repeat(Math.floor(project.prCount / 2));
        
        console.log(`${String(project.index).padStart(2, ' ')}. ${project.name.padEnd(25)} ` +
                    `${String(project.prCount).padStart(3)} PRs  ` +
                    `${String(project.categoryCount).padStart(2)} cats  ` +
                    `[${progressBar}] ` +
                    `(cumulative: ${cumulativePRs}/${totalPRs})`);
        
        // カテゴリ詳細（オプション）
        if (process.argv.includes('--detailed')) {
            project.categories.forEach(cat => {
                console.log(`    └─ ${cat.name}: ${cat.prCount} PRs`);
            });
        }
    });

    console.log('');
    console.log('💡 Tips:');
    console.log('  - Use --detailed flag to see category breakdown');
    console.log('  - Processing order is alphabetical (boulder → daos → emojivoto → ...)');
    console.log('  - Use ResumeScript.js to continue from any project/category/PR');
    console.log('');

    // 処理時間の見積もり
    const avgTimePerPR = 2; // 分（仮定）
    const estimatedMinutes = totalPRs * avgTimePerPR;
    const estimatedHours = (estimatedMinutes / 60).toFixed(1);
    
    console.log('⏱️  Estimated Processing Time:');
    console.log(`  - Total PRs: ${totalPRs}`);
    console.log(`  - Average time per PR: ~${avgTimePerPR} minutes`);
    console.log(`  - Estimated total: ~${estimatedHours} hours`);
    console.log('  (Actual time may vary based on PR complexity and LLM response time)');
    console.log('');

    return { projects: projectDetails, totalPRs };
}

/**
 * 特定プロジェクトの詳細表示
 */
function showProjectDetails(projectName) {
    const projectPath = path.join(DATASET_DIR, projectName);
    
    if (!fs.existsSync(projectPath)) {
        console.error(`❌ Project not found: ${projectName}`);
        return;
    }

    console.log(`\n📂 Project: ${projectName}`);
    console.log('='.repeat(80));

    const categories = getDirectories(projectPath);
    
    categories.forEach((category, catIndex) => {
        const categoryPath = path.join(projectPath, category);
        const prs = getDirectories(categoryPath);
        
        console.log(`\n${catIndex + 1}. Category: ${category} (${prs.length} PRs)`);
        console.log('-'.repeat(80));
        
        prs.forEach((pr, prIndex) => {
            console.log(`   ${String(prIndex + 1).padStart(3)}. ${pr}`);
        });
    });
    
    console.log('');
}

/**
 * 進捗状況の確認
 */
function checkProgress() {
    console.log('\n📊 Processing Progress Check');
    console.log('='.repeat(80));
    
    const projects = getDirectories(DATASET_DIR);
    let totalPRs = 0;
    let processedPRs = 0;

    projects.forEach(project => {
        const projectPath = path.join(DATASET_DIR, project);
        const categories = getDirectories(projectPath);
        
        categories.forEach(category => {
            const categoryPath = path.join(projectPath, category);
            const prs = getDirectories(categoryPath);
            
            prs.forEach(pr => {
                totalPRs++;
                const logDir = path.join('/app/log', project, category, pr);
                
                if (fs.existsSync(logDir)) {
                    const logs = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
                    if (logs.length > 0) {
                        processedPRs++;
                    }
                }
            });
        });
    });

    const progressPercent = ((processedPRs / totalPRs) * 100).toFixed(1);
    const remaining = totalPRs - processedPRs;

    console.log(`Total PRs:      ${totalPRs}`);
    console.log(`Processed:      ${processedPRs}`);
    console.log(`Remaining:      ${remaining}`);
    console.log(`Progress:       ${progressPercent}%`);
    
    const progressBar = '█'.repeat(Math.floor(processedPRs / 2)) + 
                        '░'.repeat(Math.floor(remaining / 2));
    console.log(`[${progressBar}]`);
    console.log('');
}

/**
 * メイン処理
 */
function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
📊 Dataset Overview Script

Usage:
  node scripts/DatasetOverview.js [options] [dataset-path]

Options:
  --detailed, -d       Show category breakdown for each project
  --project <name>     Show detailed PR list for a specific project
  --progress, -p       Check processing progress (requires log files)
  --help, -h           Show this help message

Examples:
  # Basic overview
  node scripts/DatasetOverview.js

  # Detailed view with categories
  node scripts/DatasetOverview.js --detailed

  # Specific project details
  node scripts/DatasetOverview.js --project boulder

  # Check progress
  node scripts/DatasetOverview.js --progress
`);
        return;
    }

    if (!fs.existsSync(DATASET_DIR)) {
        console.error(`❌ Dataset directory not found: ${DATASET_DIR}`);
        process.exit(1);
    }

    // プロジェクト詳細表示
    const projectIndex = args.indexOf('--project');
    if (projectIndex !== -1 && args[projectIndex + 1]) {
        showProjectDetails(args[projectIndex + 1]);
        return;
    }

    // 進捗確認
    if (args.includes('--progress') || args.includes('-p')) {
        checkProgress();
        return;
    }

    // 通常の概要表示
    analyzeDataset();
}

main();
