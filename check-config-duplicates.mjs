#!/usr/bin/env node

/**
 * 設定の重複チェックスクリプト
 * config.json と .env ファイルの設定重複と優先順位を確認
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// .env ファイルを読み込み
config({ path: path.join(process.cwd(), '.env') });

// config.json を読み込み
const configPath = '/app/config/config.json';
let configJson = {};
try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    configJson = JSON.parse(configContent);
} catch (error) {
    console.error('❌ config.json の読み込みに失敗:', error);
}

console.log('🔍 設定の重複チェック結果\n');
console.log('='.repeat(80));

// LLM関連設定の比較
console.log('\n📝 LLM設定の比較:');
console.log('-'.repeat(50));

const llmSettings = [
    { key: 'provider', envKey: 'LLM_PROVIDER', configPath: 'llm.provider' },
    { key: 'model', envKey: 'LLM_MODEL', configPath: 'llm.model' },
    { key: 'maxTokens', envKey: 'LLM_MAX_TOKENS', configPath: 'llm.maxTokens' },
    { key: 'temperature', envKey: 'LLM_TEMPERATURE', configPath: 'llm.temperature' },
    { key: 'timeout', envKey: 'LLM_TIMEOUT', configPath: 'llm.timeout' },
    { key: 'summaryThreshold', envKey: 'LLM_SUMMARY_THRESHOLD', configPath: 'llm.summaryThreshold' },
    { key: 'summaryModel', envKey: 'LLM_SUMMARY_MODEL', configPath: 'llm.summaryModel' },
    { key: 'summaryTemperature', envKey: 'LLM_SUMMARY_TEMPERATURE', configPath: 'llm.summaryTemperature' },
];

function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

llmSettings.forEach(setting => {
    const envValue = process.env[setting.envKey];
    const configValue = getNestedValue(configJson, setting.configPath);
    
    console.log(`${setting.key}:`);
    console.log(`  📄 config.json: ${configValue || 'undefined'}`);
    console.log(`  🔧 .env:        ${envValue || 'undefined'}`);
    
    if (envValue && configValue) {
        console.log(`  ⚠️  重複あり - 環境変数が優先されます`);
    } else if (envValue) {
        console.log(`  ✅ 環境変数のみ設定済み`);
    } else if (configValue) {
        console.log(`  ✅ config.jsonのみ設定済み`);
    } else {
        console.log(`  ❌ 両方とも未設定`);
    }
    console.log('');
});

// OpenAI設定の比較
console.log('\n🤖 OpenAI設定の比較:');
console.log('-'.repeat(50));

const openaiSettings = [
    { key: 'model', envKey: 'OPENAI_MODEL', configPath: 'openai.model' },
    { key: 'maxTokens', envKey: 'OPENAI_MAX_TOKENS', configPath: 'openai.maxTokens' },
    { key: 'temperature', envKey: 'OPENAI_TEMPERATURE', configPath: 'openai.temperature' },
    { key: 'timeout', envKey: 'OPENAI_TIMEOUT', configPath: 'openai.timeout' },
];

openaiSettings.forEach(setting => {
    const envValue = process.env[setting.envKey];
    const configValue = getNestedValue(configJson, setting.configPath);
    
    console.log(`${setting.key}:`);
    console.log(`  📄 config.json: ${configValue || 'undefined'}`);
    console.log(`  🔧 .env:        ${envValue || 'undefined'}`);
    
    if (envValue && configValue) {
        console.log(`  ⚠️  重複あり - 環境変数が優先されます`);
    } else if (envValue) {
        console.log(`  ✅ 環境変数のみ設定済み`);
    } else if (configValue) {
        console.log(`  ✅ config.jsonのみ設定済み`);
    } else {
        console.log(`  ❌ 両方とも未設定`);
    }
    console.log('');
});

// Gemini設定の比較
console.log('\n🧠 Gemini設定の比較:');
console.log('-'.repeat(50));

const geminiSettings = [
    { key: 'model', envKey: 'GEMINI_MODEL', configPath: 'gemini.model' },
    { key: 'maxTokens', envKey: 'GEMINI_MAX_TOKENS', configPath: 'gemini.maxTokens' },
    { key: 'temperature', envKey: 'GEMINI_TEMPERATURE', configPath: 'gemini.temperature' },
    { key: 'timeout', envKey: 'GEMINI_TIMEOUT', configPath: 'gemini.timeout' },
];

geminiSettings.forEach(setting => {
    const envValue = process.env[setting.envKey];
    const configValue = getNestedValue(configJson, setting.configPath);
    
    console.log(`${setting.key}:`);
    console.log(`  📄 config.json: ${configValue || 'undefined'}`);
    console.log(`  🔧 .env:        ${envValue || 'undefined'}`);
    
    if (envValue && configValue) {
        console.log(`  ⚠️  重複あり - 環境変数が優先されます`);
    } else if (envValue) {
        console.log(`  ✅ 環境変数のみ設定済み`);
    } else if (configValue) {
        console.log(`  ✅ config.jsonのみ設定済み`);
    } else {
        console.log(`  ❌ 両方とも未設定`);
    }
    console.log('');
});

// その他の設定の比較
console.log('\n⚙️  その他の設定の比較:');
console.log('-'.repeat(50));

const otherSettings = [
    { key: 'debugMode', envKey: 'DEBUG_MODE', configPath: 'system.debugMode' },
    { key: 'logLevel', envKey: 'LOG_LEVEL', configPath: 'system.logLevel' },
    { key: 'maxFileSize', envKey: 'MAX_FILE_SIZE', configPath: 'fileOperations.maxFileSize' },
    { key: 'fileTimeout', envKey: 'FILE_TIMEOUT', configPath: 'fileOperations.timeout' },
    { key: 'backupEnabled', envKey: 'BACKUP_ENABLED', configPath: 'fileOperations.backupEnabled' },
];

otherSettings.forEach(setting => {
    const envValue = process.env[setting.envKey];
    const configValue = getNestedValue(configJson, setting.configPath);
    
    console.log(`${setting.key}:`);
    console.log(`  📄 config.json: ${configValue || 'undefined'}`);
    console.log(`  🔧 .env:        ${envValue || 'undefined'}`);
    
    if (envValue && configValue) {
        console.log(`  ⚠️  重複あり - 環境変数が優先されます`);
    } else if (envValue) {
        console.log(`  ✅ 環境変数のみ設定済み`);
    } else if (configValue) {
        console.log(`  ✅ config.jsonのみ設定済み`);
    } else {
        console.log(`  ❌ 両方とも未設定`);
    }
    console.log('');
});

console.log('\n🔧 設定の優先順位:');
console.log('-'.repeat(50));
console.log('1. 環境変数 (.env ファイル) 【最高優先度】');
console.log('2. config.json ファイル');
console.log('3. デフォルト値 【最低優先度】');

console.log('\n💡 推奨事項:');
console.log('-'.repeat(50));
console.log('• API キーなどの機密情報: .env ファイルのみに記載');
console.log('• 環境固有の設定: .env ファイルに記載');
console.log('• 共通設定やデフォルト値: config.json に記載');
console.log('• 重複設定は環境変数が優先されるため、片方に統一を推奨');

console.log('\n' + '='.repeat(80));
