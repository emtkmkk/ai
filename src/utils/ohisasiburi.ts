/**
 * @packageDocumentation
 *
 * 久しぶり投稿の判定ユーティリティ。
 *
 * @remarks
 * 「前回の投稿から一定期間（既定14日）以上空いた投稿」かどうかを判定する純関数群。
 * emoji-react モジュールが :ohisasiburidesu: リアクションの判定に使う。
 *
 * 前回の投稿が「サーバがそのユーザーの投稿を取り込んでいた期間」のものであることは、
 * サーバ側（もこきー）が `users/show` で返す追跡情報（`isTracked` / `trackedSince`）で保証する。
 *
 * @internal
 */

/** 久しぶりとみなす日数の既定値 */
export const OHISASIBURI_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * サーバ側のユーザー追跡情報（`users/show` の拡張フィールド）
 *
 * @remarks
 * - `isTracked`: サーバ内の誰かがフォローしていて、投稿が配送されてくる状態かどうか
 * - `trackedSince`: 現在の追跡が途切れずに続いている開始日時（ISO 8601）。
 *   ローカルユーザーはアカウント作成日時。
 */
export type TrackingInfo = {
	isTracked?: boolean | null;
	trackedSince?: string | null;
};

/**
 * 前回投稿日時と今回投稿日時から、久しぶりの投稿かどうかを判定する
 *
 * @param previousNoteAt - 前回の投稿日時（ISO文字列・Date・epoch ms）。不明なら null/undefined
 * @param currentNoteAt - 今回の投稿日時
 * @param days - 久しぶりとみなす日数（既定 {@link OHISASIBURI_DAYS}）
 * @returns 前回投稿が分かっていて、かつ `days` 日以上空いていれば `true`
 */
export function isOhisasiburi(
	previousNoteAt: string | Date | number | null | undefined,
	currentNoteAt: string | Date | number,
	days: number = OHISASIBURI_DAYS,
): boolean {
	if (previousNoteAt == null) return false;
	const prev = new Date(previousNoteAt).getTime();
	const cur = new Date(currentNoteAt).getTime();
	if (Number.isNaN(prev) || Number.isNaN(cur)) return false;
	return cur - prev >= days * DAY_MS;
}

/**
 * 記録済みの最終投稿日時から、API で直前の投稿を確認する必要があるかを判定する
 *
 * @remarks
 * - 記録がない場合は確認する（`true`）。
 * - 記録があり、記録との差が閾値未満なら久しぶりではないと確定できるので確認しない。
 * - 記録があり、閾値以上空いている場合は確認する
 *   （ホームTLに流れなかった投稿が間にある可能性があるため）。
 *
 * @param recordedLastNoteAt - friend に記録済みの最終投稿日時（なければ null/undefined）
 * @param currentNoteAt - 今回の投稿日時
 * @param days - 久しぶりとみなす日数
 * @returns API での確認が必要なら `true`
 */
export function needsOhisasiburiCheck(
	recordedLastNoteAt: string | null | undefined,
	currentNoteAt: string | Date | number,
	days: number = OHISASIBURI_DAYS,
): boolean {
	if (recordedLastNoteAt == null) return true;
	return isOhisasiburi(recordedLastNoteAt, currentNoteAt, days);
}

/**
 * 投稿が、サーバの追跡期間中に投稿されたものかを判定する
 *
 * @remarks
 * 追跡中でない、または追跡開始日時が不明なら `false`。
 * 投稿日時が追跡開始日時以降なら、その投稿以降の投稿はすべてサーバに配送されているとみなせる。
 *
 * @param noteAt - 投稿日時
 * @param tracking - `users/show` の追跡情報
 */
export function isPostedWhileTracked(
	noteAt: string | Date | number | null | undefined,
	tracking: TrackingInfo | null | undefined,
): boolean {
	if (noteAt == null) return false;
	if (!tracking?.isTracked || !tracking.trackedSince) return false;
	const posted = new Date(noteAt).getTime();
	const since = new Date(tracking.trackedSince).getTime();
	if (Number.isNaN(posted) || Number.isNaN(since)) return false;
	return posted >= since;
}

/**
 * 直前の投稿と追跡情報を元に、久しぶりリアクションを付けるべきかを最終判定する
 *
 * @remarks
 * 次をすべて満たすときだけ `true`:
 * 1. 直前の投稿が存在する（初投稿には反応しない。welcome モジュールの担当）
 * 2. 直前の投稿がサーバの追跡期間中に投稿されたものである
 *    （＝直前の投稿から今回までの間の投稿はすべてサーバに入っているので、
 *    「取り込まれていないだけで実は投稿していた」という可能性がない）
 * 3. 直前の投稿から今回の投稿まで `days` 日以上空いている
 *
 * @param previous - `users/notes` で得た今回より前の投稿。なければ null/undefined
 * @param tracking - `users/show` の追跡情報
 * @param currentNoteAt - 今回の投稿日時
 * @param days - 久しぶりとみなす日数
 */
export function shouldReactOhisasiburi(
	previous: { createdAt?: string | null } | null | undefined,
	tracking: TrackingInfo | null | undefined,
	currentNoteAt: string | Date | number,
	days: number = OHISASIBURI_DAYS,
): boolean {
	if (!previous?.createdAt) return false;
	if (!isPostedWhileTracked(previous.createdAt, tracking)) return false;
	return isOhisasiburi(previous.createdAt, currentNoteAt, days);
}
