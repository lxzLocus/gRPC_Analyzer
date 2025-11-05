/**
 * タイムスタンプユーティリティ
 * JST（日本標準時）対応
 */

/**
 * 現在の日時をJST（日本標準時）のISO文字列で取得
 * @returns JSTのISO文字列（例: "2025-07-14T15:26:37.643+09:00"）
 */
export function getJSTTimestamp(): string {
    const now = new Date();
    // JST（UTC+9時間）に変換
    const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    // ISO文字列にして、Zを+09:00に置換
    return jstTime.toISOString().replace('Z', '+09:00');
}

/**
 * ファイル名用のJSTタイムスタンプを取得
 * @returns ファイル名に適したJSTタイムスタンプ（例: "2025-07-14T15-26-37-643Z"）
 */
export function getJSTFileTimestamp(): string {
    const jstTimestamp = getJSTTimestamp();
    // ファイル名用に文字を置換（+09:00をZに変更）
    return jstTimestamp.replace(/[:.]/g, '-').replace('+09-00', 'Z');
}

/**
 * 指定した日時をJSTのISO文字列で取得
 * @param date 変換したいDate object
 * @returns JSTのISO文字列
 */
export function toJSTTimestamp(date: Date): string {
    const jstTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return jstTime.toISOString().replace('Z', '+09:00');
}

/**
 * UTC時刻からJST時刻への変換
 * @param utcTimestamp UTC時刻のISO文字列
 * @returns JST時刻のISO文字列
 */
export function convertUTCtoJST(utcTimestamp: string): string {
    const date = new Date(utcTimestamp);
    return toJSTTimestamp(date);
}

/**
 * JSTタイムゾーン情報を取得
 * @returns JSTのタイムゾーン情報
 */
export function getJSTTimezoneInfo() {
    return {
        timezone: 'Asia/Tokyo',
        offset: '+09:00',
        name: 'JST',
        fullName: 'Japan Standard Time'
    };
}
