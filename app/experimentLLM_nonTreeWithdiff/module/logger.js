const fs = require('fs');
const path = require('path');

/**
 * 入力プロンプトとレスポンスをログファイルに出力します。
 * 複数回呼び出された場合でも、1つのファイルに追記されます。
 * 各リクエストごとにタイムスタンプと区切り線("---")を追加します。
 *
 * @param {string} prompt - 入力プロンプト
 * @param {string} response - レスポンス
 * @param {string} logFilePath - ログファイルのパス
 */
// logInteractionの変更
function logInteraction(prompt, response, logFilePath) {
  const logEntry = `%_Input Prompt_%: \n ${prompt}\n\n%_Response_%: \n ${response}\n\n ---------- \n\n`;

  try {
    fs.appendFileSync(logFilePath, logEntry, 'utf8');
    console.log('ログに保存しました。');

  } catch (error) {
    console.error('ログファイルへの書き込みに失敗しました:', error);
  }
}

module.exports = logInteraction;
