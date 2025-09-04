#!/usr/bin/env node

/**
 * Configuration Test Script
 * プロバイダーとモデルの設定がどこから来ているかを確認するスクリプト
 */

import Config from '../dist/js/modules/config.js';
import LLMClientFactory from '../dist/js/modules/llmClientFactory.js';

console.log('=== Configuration Test ===\n');

// 現在のプロジェクトディレクトリで設定を初期化
const config = new Config('/tmp');

console.log('📋 Current Settings:');
console.log(`  LLM Provider: ${config.get('llm.provider', 'N/A')}`);
console.log(`  LLM Max Tokens: ${config.get('llm.maxTokens', 'N/A')}`);
console.log(`  LLM Temperature: ${config.get('llm.temperature', 'N/A')}`);
console.log(`  LLM Timeout: ${config.get('llm.timeout', 'N/A')}`);
console.log(`  OpenAI Model: ${config.get('openai.model', 'N/A')}`);
console.log(`  OpenAI Max Tokens: ${config.get('openai.maxTokens', 'N/A')}`);
console.log(`  Gemini Model: ${config.get('gemini.model', 'N/A')}`);
console.log(`  Gemini Max Tokens: ${config.get('gemini.maxTokens', 'N/A')}`);

console.log('\n🌍 Environment Variables:');
console.log(`  LLM_PROVIDER: ${process.env.LLM_PROVIDER || 'not set'}`);
console.log(`  LLM_MAX_TOKENS: ${process.env.LLM_MAX_TOKENS || 'not set'}`);
console.log(`  LLM_TEMPERATURE: ${process.env.LLM_TEMPERATURE || 'not set'}`);
console.log(`  LLM_TIMEOUT: ${process.env.LLM_TIMEOUT || 'not set'}`);
console.log(`  OPENAI_MODEL: ${process.env.OPENAI_MODEL || 'not set'}`);
console.log(`  OPENAI_MAX_TOKENS: ${process.env.OPENAI_MAX_TOKENS || 'not set'}`);
console.log(`  GEMINI_MODEL: ${process.env.GEMINI_MODEL || 'not set'}`);
console.log(`  GEMINI_MAX_TOKENS: ${process.env.GEMINI_MAX_TOKENS || 'not set'}`);

console.log('\n📄 Config File Values:');
// config.jsonから直接読み取り
import fs from 'fs';
try {
    const configContent = fs.readFileSync('/app/config/config.json', 'utf-8');
    const configData = JSON.parse(configContent);
    console.log(`  llm section: ${configData.llm ? 'exists' : 'removed'}`);
    console.log(`  openai section: ${configData.openai ? 'exists' : 'removed'}`);
    console.log(`  gemini section: ${configData.gemini ? 'exists' : 'removed'}`);
    console.log(`  system.debugMode: ${configData.system?.debugMode}`);
    console.log(`  fileOperations.maxFileSize: ${configData.fileOperations?.maxFileSize}`);
} catch (error) {
    console.log(`  Error reading config file: ${error.message}`);
}

console.log('\n🏭 LLM Client Factory Selection:');
const autoSelectedProvider = LLMClientFactory.autoSelectProvider(config);
console.log(`  Auto-selected provider: ${autoSelectedProvider}`);

console.log('\n🔍 Analysis:');
console.log('Priority order for settings:');
console.log('  1. Environment Variables (highest priority)');
console.log('  2. Config file values (lower priority)');
console.log('  3. Default values (fallback)');

console.log('\n📊 Current Configuration Source:');
const envProvider = process.env.LLM_PROVIDER;
const configProvider = config.get('llm.provider');
if (envProvider) {
    console.log(`  ✅ LLM Provider: Using environment variable (${envProvider})`);
} else {
    console.log(`  ⚙️  LLM Provider: Using config file (${configProvider})`);
}

const envOpenAIModel = process.env.OPENAI_MODEL;
const configOpenAIModel = config.get('openai.model');
if (envOpenAIModel) {
    console.log(`  ✅ OpenAI Model: Using environment variable (${envOpenAIModel})`);
} else {
    console.log(`  ⚙️  OpenAI Model: Using config file (${configOpenAIModel})`);
}

const envGeminiModel = process.env.GEMINI_MODEL;
const configGeminiModel = config.get('gemini.model');
if (envGeminiModel) {
    console.log(`  ✅ Gemini Model: Using environment variable (${envGeminiModel})`);
} else {
    console.log(`  ⚙️  Gemini Model: Using config file (${configGeminiModel})`);
}
