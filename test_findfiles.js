import findFiles from './dist/js/modules/generateFilePathContent.js';

const testPath = '/app/dataset/test/servantes/pullrequest/add_Secrets_service-_global_yaml/premerge_54';

console.log('Testing findFiles...');

try {
    const result = findFiles(testPath, '.proto');
    console.log('Result structure:', typeof result, Object.keys(result));
    console.log('Full result:', JSON.stringify(result, null, 2));
} catch (error) {
    console.error('Error:', error);
}
