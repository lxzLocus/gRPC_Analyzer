/**
 * commit_messages.json の型定義 (JavaScript用)
 * 
 * このファイルは /app/src/types/CommitMessages.ts と同期しています。
 * TypeScript型定義を元に、JSDocコメントで型情報を提供します。
 */

/**
 * 個々のコミット情報
 * @typedef {Object} CommitInfo
 * @property {string} hash - コミットハッシュ
 * @property {string} author - コミット作成者名
 * @property {string} email - コミット作成者のメールアドレス
 * @property {string} date - コミット日時
 * @property {string} subject - コミットの件名
 * @property {string} body - コミットの本文
 */

/**
 * commit_messages.json のデータ構造
 * プルリクエスト関連のコミット情報を集約
 * @typedef {Object} CommitMessages
 * @property {string} premerge_head - プルリク前のHEADコミットハッシュ
 * @property {string} merge_head - マージ後のHEADコミットハッシュ
 * @property {string} proto_change_commit - protoファイルが変更されたコミットハッシュ
 * @property {CommitInfo} merge_commit - マージコミットの詳細情報
 * @property {CommitInfo} proto_commit - protoファイルが変更されたコミットの詳細情報
 * @property {CommitInfo[]} all_commits - プルリクエストに含まれる全コミットのリスト
 */

// TypeScriptの型定義を参照する場合は、以下のようにインポートできます
// /** @type {import('../../src/types/CommitMessages.js').CommitMessages} */

export {};
