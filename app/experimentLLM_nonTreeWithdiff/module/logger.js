const fs = require('fs');
const path = require('path');

const outputDir = "app/app/experimentLLM_nonTreeWithdiff/output/log";

const timestamp = new Date().toISOString();

// ログファイルのパスを設定
const logFilePath = path.join(outputDir, `${timestamp}_log.txt`);

/**
 * 入力プロンプトとレスポンスをログファイルに出力します。
 * 複数回呼び出された場合でも、1つのファイルに追記されます。
 * 各リクエストごとにタイムスタンプと区切り線("---")を追加します。
 *
 * @param {string} prompt - 入力プロンプト
 * @param {string} response - レスポンス
 */
function logInteraction(prompt, response) {
  const logEntry = `Input Prompt: \n ${prompt}\n Response: \n ${response}\n --- \n`;
  try {
    fs.appendFileSync(logFilePath, logEntry, 'utf8');
    console.log('ログに保存しました。');
  } catch (error) {
    console.error('ログファイルへの書き込みに失敗しました:', error);
  }
}

module.exports = logInteraction;
