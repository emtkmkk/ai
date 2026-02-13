/**
 * @packageDocumentation
 *
 * 日付文字列パースユーティリティ。
 *
 * @remarks
 * ユーザー入力の日付文字列を Date オブジェクトに変換する。
 * 誕生日登録（{@link ../friend | Friend}）や UNIX タイム変換で使用される。
 *
 * @internal
 */

/**
 * 日付文字列を Date オブジェクトにパースする
 *
 * @remarks
 * 以下の形式に対応する:
 * - `yyyy/mm/dd`（例: `2024/01/05`）
 * - `yyyymmdd`（例: `20240105`）
 *
 * いずれの形式にも該当しない場合は `null` を返す。
 * 入力が `undefined` や `null` の場合はそのまま返す。
 *
 * @param dateString - パース対象の日付文字列（`undefined` / `null` も受け付ける）
 * @returns パースされた Date オブジェクト。不正な形式の場合は `null`、入力が `undefined`/`null` の場合はそのまま返す
 * @internal
 */
export default function (dateString: string | undefined | null): Date | undefined | null {
  let year: number, month: number, day: number;

	if (typeof dateString !== "string") {
		return dateString;
	}

  // yyyy/mm/ddの形式を確認
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateString)) {
    const parts = dateString.split('/');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // JavaScriptのDateは0から始まる月を使用
    day = parseInt(parts[2], 10);
  }
  // yyyymmddの形式を確認
  else if (/^\d{8}$/.test(dateString)) {
    year = parseInt(dateString.slice(0, 4), 10);
    month = parseInt(dateString.slice(4, 6), 10) - 1; // JavaScriptのDateは0から始まる月を使用
    day = parseInt(dateString.slice(6, 8), 10);
  } else {
    // サポートされていない形式の場合はnullを返す
    return null;
  }

  // Dateオブジェクトを作成
  return new Date(year, month, day);
}
