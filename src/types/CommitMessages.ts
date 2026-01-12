/**
 * コミットメッセージとPR情報の型定義
 * dataset のcommit_messages.json のスキーマ
 */

/**
 * 個々のコミット情報
 */
export interface CommitInfo {
  /** コミットハッシュ */
  hash: string;
  /** コミット作成者名 */
  author: string;
  /** コミット作成者のメールアドレス */
  email: string;
  /** コミット日時 */
  date: string;
  /** コミットの件名 */
  subject: string;
  /** コミットの本文 */
  body: string;
}

/**
 * commit_messages.json のデータ構造
 * プルリクエスト関連のコミット情報を集約
 */
export interface CommitMessages {
  /** プルリク前のHEADコミットハッシュ */
  premerge_head: string;
  /** マージ後のHEADコミットハッシュ */
  merge_head: string;
  /** protoファイルが変更されたコミットハッシュ */
  proto_change_commit: string;
  /** マージコミットの詳細情報 */
  merge_commit: CommitInfo;
  /** protoファイルが変更されたコミットの詳細情報 */
  proto_commit: CommitInfo;
  /** プルリクエストに含まれる全コミットのリスト */
  all_commits: CommitInfo[];
}
